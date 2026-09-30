CREATE TABLE ops.incentive_legacy_approval (
    package_id UUID PRIMARY KEY REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id),
    package_scope TEXT NOT NULL CHECK (package_scope IN ('legacy_region','manager_assignment')),
    classified_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- Classification only: no historical decision, grant or payment is rewritten.
INSERT INTO ops.incentive_legacy_approval (package_id,package_scope)
SELECT sales_target_incentive_region_package_id,package_scope
FROM ops.sales_target_incentive_region_package WHERE package_status='admin_approved';

CREATE TABLE ops.incentive_company_cycle (
    cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    period_key CHAR(7) NOT NULL CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    current_revision INTEGER NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
    stage TEXT NOT NULL DEFAULT 'preparation' CHECK (stage IN ('preparation','sales_director','hr','general_manager','final')),
    UNIQUE (company_id,period_key), UNIQUE (cycle_id,company_id,period_key)
);
CREATE TABLE ops.incentive_company_revision (
    cycle_id UUID NOT NULL REFERENCES ops.incentive_company_cycle(cycle_id),
    revision_no INTEGER NOT NULL CHECK (revision_no > 0),
    seal_hash TEXT NOT NULL CHECK (seal_hash ~ '^[a-f0-9]{64}$'),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='object'),
    sealed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    sealed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (cycle_id,revision_no), UNIQUE (cycle_id,revision_no,seal_hash)
);
CREATE TABLE ops.incentive_company_decision (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL,
    revision_no INTEGER NOT NULL,
    seal_hash TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('sales_director','hr','general_manager')),
    decision TEXT NOT NULL CHECK (decision IN ('approve','return')),
    actor_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    reason_note TEXT,
    authority_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (cycle_id,revision_no,seal_hash) REFERENCES ops.incentive_company_revision(cycle_id,revision_no,seal_hash),
    UNIQUE (cycle_id,revision_no,stage),
    CHECK (decision<>'return' OR NULLIF(BTRIM(reason_note),'') IS NOT NULL)
);
ALTER TABLE ops.incentive_hr_delivery ADD COLUMN final_cycle_id UUID,
    ADD COLUMN final_revision_no INTEGER, ADD COLUMN final_seal_hash TEXT,
    ADD CONSTRAINT incentive_hr_final_proof_fk FOREIGN KEY (final_cycle_id,final_revision_no,final_seal_hash)
      REFERENCES ops.incentive_company_revision(cycle_id,revision_no,seal_hash),
    ADD CONSTRAINT incentive_hr_final_proof_complete CHECK (
      (final_cycle_id IS NULL AND final_revision_no IS NULL AND final_seal_hash IS NULL) OR
      (final_cycle_id IS NOT NULL AND final_revision_no IS NOT NULL AND final_seal_hash IS NOT NULL));

CREATE FUNCTION ops.guard_incentive_company_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Company incentive evidence is append-only' USING ERRCODE='23514';
END $$;
CREATE TRIGGER incentive_legacy_immutable BEFORE INSERT OR UPDATE OR DELETE ON ops.incentive_legacy_approval
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_append_only();
CREATE TRIGGER incentive_revision_immutable BEFORE UPDATE OR DELETE ON ops.incentive_company_revision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_append_only();
CREATE TRIGGER incentive_decision_immutable BEFORE UPDATE OR DELETE ON ops.incentive_company_decision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_append_only();
CREATE TRIGGER incentive_cycle_no_delete BEFORE DELETE ON ops.incentive_company_cycle
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_append_only();

CREATE FUNCTION ops.incentive_stage_authorized(actor UUID,company UUID,stage_value TEXT) RETURNS boolean
LANGUAGE sql VOLATILE AS $$
    SELECT EXISTS (
      SELECT 1 FROM ops.user_permission_assignment grant_row
      JOIN ops.permission permission ON permission.permission_id=grant_row.permission_id
      JOIN ops.user_role_assignment role_assignment ON role_assignment.user_role_assignment_id=grant_row.user_role_assignment_id
      JOIN ops.role role ON role.role_id=role_assignment.role_id
      JOIN ops.user_account account ON account.user_id=grant_row.user_id
      JOIN ops.company company_row ON company_row.company_id=grant_row.company_id
      WHERE grant_row.user_id=actor AND grant_row.company_id=company AND grant_row.scope_type='company'
        AND role_assignment.user_id=actor AND role_assignment.company_id=company AND role_assignment.scope_type='company'
        AND role.role_code=CASE WHEN stage_value IN ('hr','payroll') THEN 'HR_ADMIN' ELSE 'REPORT_VIEWER' END
        AND permission.permission_code=CASE stage_value WHEN 'sales_director' THEN 'INCENTIVE_SALES_DIRECTOR_APPROVAL'
          WHEN 'hr' THEN 'INCENTIVE_HR_APPROVAL' WHEN 'general_manager' THEN 'INCENTIVE_GENERAL_MANAGER_APPROVAL'
          WHEN 'payroll' THEN 'INCENTIVE_PAYROLL_DELIVERY' ELSE '' END
        AND account.is_active AND company_row.status='active' AND grant_row.revoked_at IS NULL
        AND grant_row.starts_at<=clock_timestamp() AND (grant_row.ends_at IS NULL OR grant_row.ends_at>clock_timestamp())
        AND role_assignment.start_at<=clock_timestamp() AND (role_assignment.end_at IS NULL OR role_assignment.end_at>clock_timestamp())
    )
$$;

CREATE FUNCTION ops.incentive_responsibility_current(payload JSONB,at_time TIMESTAMPTZ) RETURNS boolean
LANGUAGE sql VOLATILE AS $$
    SELECT jsonb_typeof(payload->'responsibility')='array' AND jsonb_array_length(payload->'responsibility')>0
      AND (SELECT jsonb_agg(store_id::text ORDER BY store_id) FROM ops.store WHERE company_id::text=payload->>'companyId' AND status='active'
        AND ops.store_was_company_during(store_id,(payload->>'period'||'-01')::date,((payload->>'period'||'-01')::date+INTERVAL '1 month - 1 day')::date))
        IS NOT DISTINCT FROM (SELECT jsonb_agg(frozen->>'store_id' ORDER BY frozen->>'store_id') FROM jsonb_array_elements(payload->'responsibility') frozen)
      AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(payload->'responsibility') frozen
      LEFT JOIN ops.store store ON store.store_id=(frozen->>'store_id')::uuid
      WHERE store.company_id::text IS DISTINCT FROM payload->>'companyId' OR store.status IS DISTINCT FROM 'active'
        OR jsonb_array_length(frozen->'owners')<>1 OR frozen->'owners' IS DISTINCT FROM (
          SELECT to_jsonb(array_agg(DISTINCT account.user_id::text ORDER BY account.user_id::text))
          FROM ops.user_action_store_assignment assigned JOIN ops.user_account account ON account.user_id=assigned.user_id AND account.is_active
          JOIN ops.user_role_assignment ura ON ura.user_id=account.user_id
          JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='REGION_MANAGER'
          WHERE assigned.store_id=store.store_id AND assigned.start_at<=at_time AND (assigned.end_at IS NULL OR assigned.end_at>at_time)
            AND ura.start_at<=at_time AND (ura.end_at IS NULL OR ura.end_at>at_time))
    )
$$;

CREATE FUNCTION ops.guard_incentive_company_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cycle ops.incentive_company_cycle; sealed JSONB;
BEGIN
    SELECT * INTO STRICT cycle FROM ops.incentive_company_cycle WHERE cycle_id=NEW.cycle_id FOR UPDATE;
    IF cycle.current_revision<>NEW.revision_no OR cycle.stage<>NEW.stage THEN
      RAISE EXCEPTION 'Company revision or stage changed' USING ERRCODE='23514';
    END IF;
    IF NOT ops.incentive_stage_authorized(NEW.actor_user_id,cycle.company_id,NEW.stage) THEN
      RAISE EXCEPTION 'Live stage capability required' USING ERRCODE='42501';
    END IF;
    NEW.decided_at:=clock_timestamp();
    SELECT jsonb_build_object('permissionAssignment',to_jsonb(g),'roleAssignment',to_jsonb(a),
      'roleCode',role.role_code,'permissionCode',permission.permission_code) INTO STRICT NEW.authority_evidence
      FROM ops.user_permission_assignment g JOIN ops.permission permission ON permission.permission_id=g.permission_id
      JOIN ops.user_role_assignment a ON a.user_role_assignment_id=g.user_role_assignment_id
      JOIN ops.role role ON role.role_id=a.role_id
      WHERE g.user_id=NEW.actor_user_id AND g.company_id=cycle.company_id AND g.scope_type='company'
        AND a.user_id=NEW.actor_user_id AND a.company_id=cycle.company_id AND a.scope_type='company'
        AND role.role_code=CASE WHEN NEW.stage='hr' THEN 'HR_ADMIN' ELSE 'REPORT_VIEWER' END
        AND permission.permission_code=CASE NEW.stage WHEN 'sales_director' THEN 'INCENTIVE_SALES_DIRECTOR_APPROVAL'
          WHEN 'hr' THEN 'INCENTIVE_HR_APPROVAL' ELSE 'INCENTIVE_GENERAL_MANAGER_APPROVAL' END
        AND g.revoked_at IS NULL AND g.starts_at<=NEW.decided_at AND (g.ends_at IS NULL OR g.ends_at>NEW.decided_at)
        AND a.start_at<=NEW.decided_at AND (a.end_at IS NULL OR a.end_at>NEW.decided_at);
    SELECT payload INTO STRICT sealed FROM ops.incentive_company_revision
      WHERE cycle_id=NEW.cycle_id AND revision_no=NEW.revision_no AND seal_hash=NEW.seal_hash;
    IF NEW.decision='approve' AND NOT ops.incentive_responsibility_current(sealed,NEW.decided_at) THEN
      RAISE EXCEPTION 'Live sealed responsibility changed before the decision' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(sealed->'packages') p WHERE p->>'submitted_by_user_id'=NEW.actor_user_id::text) THEN
      RAISE EXCEPTION 'Submitter cannot approve own company submission' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER incentive_decision_guard BEFORE INSERT ON ops.incentive_company_decision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_decision();

CREATE FUNCTION ops.guard_incentive_company_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cycle ops.incentive_company_cycle;
BEGIN
    SELECT * INTO STRICT cycle FROM ops.incentive_company_cycle WHERE cycle_id=NEW.cycle_id FOR UPDATE;
    NEW.sealed_at:=clock_timestamp();
    IF cycle.stage<>'preparation' OR NEW.revision_no<>cycle.current_revision+1
      OR NEW.payload->>'companyId' IS DISTINCT FROM cycle.company_id::text OR NEW.payload->>'period' IS DISTINCT FROM cycle.period_key::text
      OR NEW.payload->>'contract' IS DISTINCT FROM 'incentive-company-seal-v1'
      OR jsonb_typeof(NEW.payload->'packages') IS DISTINCT FROM 'array' OR jsonb_typeof(NEW.payload->'stores') IS DISTINCT FROM 'array'
      OR ops.incentive_responsibility_current(NEW.payload,NEW.sealed_at) IS DISTINCT FROM TRUE
      OR NEW.seal_hash<>encode(digest(NEW.payload::text,'sha256'),'hex')
      OR NOT ops.incentive_stage_authorized(NEW.sealed_by_user_id,cycle.company_id,'sales_director') THEN
      RAISE EXCEPTION 'Revision requires exact sealed company preparation and live Sales Director authority' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER incentive_revision_guard BEFORE INSERT ON ops.incentive_company_revision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_revision();

CREATE FUNCTION ops.guard_incentive_company_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.cycle_id,OLD.company_id,OLD.period_key) IS DISTINCT FROM ROW(NEW.cycle_id,NEW.company_id,NEW.period_key) THEN
      RAISE EXCEPTION 'Company cycle identity is immutable' USING ERRCODE='23514';
    END IF;
    IF NEW.current_revision=OLD.current_revision+1 AND NEW.stage='sales_director' AND OLD.stage='preparation'
      AND EXISTS(SELECT 1 FROM ops.incentive_company_revision WHERE cycle_id=OLD.cycle_id AND revision_no=NEW.current_revision) THEN RETURN NEW; END IF;
    IF NEW.current_revision=OLD.current_revision AND EXISTS(SELECT 1 FROM ops.incentive_company_decision d
      WHERE d.cycle_id=OLD.cycle_id AND d.revision_no=OLD.current_revision AND d.stage=OLD.stage
        AND ((d.decision='return' AND NEW.stage='preparation') OR (d.decision='approve' AND NEW.stage=
          CASE OLD.stage WHEN 'sales_director' THEN 'hr' WHEN 'hr' THEN 'general_manager' WHEN 'general_manager' THEN 'final' ELSE '' END))) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Company stages require the exact revision decision' USING ERRCODE='23514';
END $$;
CREATE TRIGGER incentive_company_state BEFORE UPDATE ON ops.incentive_company_cycle
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_state();

CREATE FUNCTION ops.guard_incentive_new_package_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='UPDATE' AND OLD.package_status='admin_approved' AND to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
      RAISE EXCEPTION 'Approved package proof is immutable' USING ERRCODE='23514';
    END IF;
    IF NEW.package_status='admin_approved' AND (TG_OP='INSERT' OR OLD.package_status IS DISTINCT FROM NEW.package_status)
      AND NOT EXISTS (SELECT 1 FROM ops.incentive_company_decision d
        JOIN ops.incentive_company_cycle c ON c.cycle_id=d.cycle_id
        JOIN ops.incentive_company_revision r ON r.cycle_id=d.cycle_id AND r.revision_no=d.revision_no
        CROSS JOIN LATERAL jsonb_array_elements(r.payload->'packages') p
        WHERE c.company_id=NEW.company_id AND c.period_key=NEW.period_key AND c.current_revision=d.revision_no
          AND d.stage='general_manager' AND d.decision='approve' AND d.actor_user_id=NEW.reviewed_by_user_id
          AND p->>'sales_target_incentive_region_package_id'=NEW.sales_target_incentive_region_package_id::text) THEN
      RAISE EXCEPTION 'New packages require General Manager company final approval' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER incentive_new_package_approval BEFORE INSERT OR UPDATE ON ops.sales_target_incentive_region_package
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_new_package_approval();

CREATE FUNCTION ops.guard_incentive_approved_copy_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM 1 FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=NEW.region_package_id
      AND package_status='admin_approved' FOR SHARE;
    IF FOUND THEN RAISE EXCEPTION 'Approved package store evidence is immutable' USING ERRCODE='23514'; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER incentive_approved_copy_insert BEFORE INSERT ON ops.sales_target_incentive_region_package_store
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_approved_copy_insert();

CREATE FUNCTION ops.guard_incentive_company_money() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposal JSONB; cycle ops.incentive_company_cycle;
BEGIN
    IF TG_OP<>'INSERT' AND OLD.status='approved' THEN
      RAISE EXCEPTION 'Approved money evidence is immutable' USING ERRCODE='23514';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    IF NEW.status<>'approved' THEN RETURN NEW; END IF;
    IF NEW.adjustment_scope='projection' AND NOT EXISTS (
      SELECT 1 FROM ops.incentive_company_cycle WHERE company_id=NEW.company_id AND period_key=NEW.period_key
    ) THEN RETURN NEW; END IF;
    IF NEW.adjustment_scope='final_snapshot' AND EXISTS (
      SELECT 1 FROM ops.incentive_legacy_approval legacy
      JOIN ops.sales_target_incentive_region_package_store ps ON ps.region_package_id=legacy.package_id
      JOIN rpt.sales_target_incentive_final_row row ON row.final_snapshot_id=ps.final_snapshot_id
      WHERE row.sales_target_incentive_final_row_id=NEW.final_row_id AND ps.company_id=NEW.company_id AND ps.period_key=NEW.period_key
    ) THEN RETURN NEW; END IF;
    SELECT * INTO cycle FROM ops.incentive_company_cycle WHERE company_id=NEW.company_id AND period_key=NEW.period_key FOR UPDATE;
    SELECT item INTO proposal FROM ops.incentive_company_revision r
      JOIN ops.incentive_company_decision d ON d.cycle_id=r.cycle_id AND d.revision_no=r.revision_no AND d.seal_hash=r.seal_hash
      CROSS JOIN LATERAL jsonb_array_elements(r.payload->'proposals') item
      WHERE r.cycle_id=cycle.cycle_id AND r.revision_no=cycle.current_revision
        AND d.stage='general_manager' AND d.decision='approve' AND d.actor_user_id=NEW.approved_by_user_id
        AND r.seal_hash=NEW.evidence->>'companySealHash'
        AND item->>'sales_target_incentive_region_correction_id'=NEW.evidence->>'regionCorrectionId'
        AND item->>'final_row_id'=NEW.final_row_id::text
        AND item->>'store_id'=NEW.store_id::text AND item->>'employee_id'=NEW.employee_id::text
        AND (item->>'final_amount')::numeric=NEW.after_amount
        AND (item->>'raw_baseline')::numeric=NEW.before_amount
        AND NEW.adjustment_amount=NEW.after_amount-NEW.before_amount
        AND item->>'reason_note'=NEW.reason_note;
    IF proposal IS NULL OR cycle.stage<>'general_manager' OR
      NOT ops.incentive_stage_authorized(NEW.approved_by_user_id,NEW.company_id,'general_manager') THEN
      RAISE EXCEPTION 'Only sealed General Manager final approval can apply money' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM ops.sales_target_incentive_adjustment a WHERE a.status='approved'
      AND a.evidence->>'companySealHash'=NEW.evidence->>'companySealHash'
      AND a.evidence->>'regionCorrectionId'=NEW.evidence->>'regionCorrectionId') THEN
      RAISE EXCEPTION 'Sealed proposal already applied' USING ERRCODE='23505';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER incentive_company_money BEFORE INSERT OR UPDATE OR DELETE ON ops.sales_target_incentive_adjustment
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_company_money();
CREATE UNIQUE INDEX incentive_company_proposal_once ON ops.sales_target_incentive_adjustment
    ((evidence->>'companySealHash'),(evidence->>'regionCorrectionId'))
    WHERE status='approved' AND evidence ? 'companySealHash';

CREATE FUNCTION ops.guard_incentive_payroll_final_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='UPDATE' THEN
      IF ROW(NEW.company_id,NEW.period_key,NEW.final_cycle_id,NEW.final_revision_no,NEW.final_seal_hash)
        IS DISTINCT FROM ROW(OLD.company_id,OLD.period_key,OLD.final_cycle_id,OLD.final_revision_no,OLD.final_seal_hash) THEN
        RAISE EXCEPTION 'Payroll approval proof is immutable' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.final_cycle_id IS NULL THEN
      IF EXISTS(SELECT 1 FROM ops.incentive_company_cycle WHERE company_id=NEW.company_id AND period_key=NEW.period_key)
        OR NOT EXISTS(SELECT 1 FROM ops.incentive_legacy_approval l JOIN ops.sales_target_incentive_region_package p
          ON p.sales_target_incentive_region_package_id=l.package_id WHERE p.company_id=NEW.company_id AND p.period_key=NEW.period_key)
        OR EXISTS(SELECT 1 FROM ops.sales_target_incentive_region_package p LEFT JOIN ops.incentive_legacy_approval l
          ON l.package_id=p.sales_target_incentive_region_package_id WHERE p.company_id=NEW.company_id AND p.period_key=NEW.period_key
          AND (p.package_status<>'admin_approved' OR l.package_id IS NULL)) THEN
        RAISE EXCEPTION 'Historical delivery requires actual legacy approval evidence' USING ERRCODE='23514';
      END IF;
    ELSIF NOT EXISTS(SELECT 1 FROM ops.incentive_company_cycle c JOIN ops.incentive_company_decision d ON d.cycle_id=c.cycle_id
      WHERE c.cycle_id=NEW.final_cycle_id AND c.company_id=NEW.company_id AND c.period_key=NEW.period_key AND c.stage='final'
        AND c.current_revision=NEW.final_revision_no AND d.revision_no=NEW.final_revision_no AND d.seal_hash=NEW.final_seal_hash
        AND d.stage='general_manager' AND d.decision='approve') OR
      NOT ops.incentive_stage_authorized(NEW.created_by_user_id,NEW.company_id,'payroll') THEN
      RAISE EXCEPTION 'Payroll delivery requires the exact General Manager final seal and live HR delivery capability' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER incentive_payroll_final_proof BEFORE INSERT OR UPDATE ON ops.incentive_hr_delivery
    FOR EACH ROW EXECUTE FUNCTION ops.guard_incentive_payroll_final_proof();
