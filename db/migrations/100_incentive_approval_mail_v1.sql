-- Incentive approval mail outbox v1. No monetary rows, recipients or decisions are rewritten.
CREATE TABLE IF NOT EXISTS ops.incentive_approval_mail_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES ops.company(company_id),
  period_key TEXT NOT NULL CHECK(period_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  stage TEXT NOT NULL CHECK(stage IN ('region_manager','sales_director','hr','general_manager')),
  actor_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
  approver_name TEXT NOT NULL CHECK(NULLIF(BTRIM(approver_name),'') IS NOT NULL),
  company_name TEXT NOT NULL,
  package_id UUID REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id),
  cycle_id UUID, revision_no INTEGER, seal_hash TEXT,
  FOREIGN KEY(cycle_id,revision_no,seal_hash) REFERENCES ops.incentive_company_revision(cycle_id,revision_no,seal_hash),
  expanded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK((stage='region_manager' AND package_id IS NOT NULL AND cycle_id IS NULL AND revision_no IS NULL AND seal_hash IS NULL)
    OR (stage<>'region_manager' AND cycle_id IS NOT NULL AND revision_no IS NOT NULL AND seal_hash IS NOT NULL))
);
ALTER TABLE ops.incentive_approval_mail_event ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS ops.incentive_approval_mail_delivery (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ops.incentive_approval_mail_event(event_id),
  user_id UUID REFERENCES ops.user_account(user_id),
  audience TEXT NOT NULL CHECK(audience IN ('region_manager','sales_director','hr','general_manager')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','uncertain','cancelled')),
  claimed_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, smtp_message_id TEXT,
  UNIQUE(event_id,recipient)
);
CREATE INDEX IF NOT EXISTS incentive_approval_mail_pending ON ops.incentive_approval_mail_delivery(event_id) WHERE status='pending';
ALTER TABLE ops.incentive_hr_delivery ADD COLUMN IF NOT EXISTS delivery_origin TEXT NOT NULL DEFAULT 'manual'
  CHECK(delivery_origin IN ('manual','gm_final'));

CREATE OR REPLACE FUNCTION ops.incentive_mail_hr_recipient_allowed(company UUID,emails TEXT[]) RETURNS boolean
LANGUAGE sql VOLATILE AS $$
  SELECT cardinality(emails)>0 AND EXISTS(SELECT 1 FROM ops.company WHERE company_id=$1 AND status='active') AND NOT EXISTS(
    SELECT 1 FROM ops.user_account account WHERE lower(account.email)=ANY(ARRAY(SELECT lower(e) FROM unnest(emails) e))
      AND (NOT account.is_active OR NOT(ops.incentive_stage_authorized(account.user_id,company,'hr')
        OR ops.incentive_stage_authorized(account.user_id,company,'payroll'))
        OR EXISTS(SELECT 1 FROM ops.user_role_assignment ura JOIN ops.role role ON role.role_id=ura.role_id
          WHERE ura.user_id=account.user_id AND role.role_code='REGION_MANAGER'
            AND ura.start_at<=clock_timestamp() AND (ura.end_at IS NULL OR ura.end_at>clock_timestamp()))
        OR EXISTS(SELECT 1 FROM ops.user_permission_assignment grant_row WHERE grant_row.user_id=account.user_id
          AND (ops.incentive_stage_authorized(account.user_id,grant_row.company_id,'sales_director')
            OR ops.incentive_stage_authorized(account.user_id,grant_row.company_id,'general_manager'))))
  )
$$;

-- Automatic final delivery records its real GM initiator. Manual delivery keeps its HR capability boundary.
CREATE OR REPLACE FUNCTION ops.guard_incentive_payroll_final_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.company_id,NEW.period_key,NEW.final_cycle_id,NEW.final_revision_no,NEW.final_seal_hash,NEW.delivery_origin,NEW.recipients)
      IS DISTINCT FROM ROW(OLD.company_id,OLD.period_key,OLD.final_cycle_id,OLD.final_revision_no,OLD.final_seal_hash,OLD.delivery_origin,OLD.recipients) THEN
      RAISE EXCEPTION 'Payroll approval proof is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.final_cycle_id IS NULL THEN
    IF NEW.delivery_origin<>'manual'
      OR EXISTS(SELECT 1 FROM ops.incentive_company_cycle WHERE company_id=NEW.company_id AND period_key=NEW.period_key)
      OR NOT EXISTS(SELECT 1 FROM ops.incentive_legacy_approval l JOIN ops.sales_target_incentive_region_package p
        ON p.sales_target_incentive_region_package_id=l.package_id WHERE p.company_id=NEW.company_id AND p.period_key=NEW.period_key)
      OR EXISTS(SELECT 1 FROM ops.sales_target_incentive_region_package p LEFT JOIN ops.incentive_legacy_approval l
        ON l.package_id=p.sales_target_incentive_region_package_id WHERE p.company_id=NEW.company_id AND p.period_key=NEW.period_key
        AND (p.package_status<>'admin_approved' OR l.package_id IS NULL)) THEN
      RAISE EXCEPTION 'Historical delivery requires actual legacy approval evidence' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NOT ops.incentive_mail_hr_recipient_allowed(NEW.company_id,NEW.recipients) THEN
      RAISE EXCEPTION 'Final incentive workbook recipients must be HR only' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM ops.incentive_company_cycle c JOIN ops.incentive_company_decision d ON d.cycle_id=c.cycle_id
      WHERE c.cycle_id=NEW.final_cycle_id AND c.company_id=NEW.company_id AND c.period_key=NEW.period_key AND c.stage='final'
        AND c.current_revision=NEW.final_revision_no AND d.revision_no=NEW.final_revision_no AND d.seal_hash=NEW.final_seal_hash
        AND d.stage='general_manager' AND d.decision='approve'
        AND (NEW.delivery_origin='manual' OR d.actor_user_id=NEW.created_by_user_id)) THEN
      RAISE EXCEPTION 'Payroll delivery requires the exact General Manager final seal' USING ERRCODE='23514';
    END IF;
    IF NOT ops.incentive_stage_authorized(NEW.created_by_user_id,NEW.company_id,
      CASE WHEN NEW.delivery_origin='gm_final' THEN 'general_manager' ELSE 'payroll' END) THEN
      RAISE EXCEPTION 'Payroll delivery requires live matching initiator authority' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
