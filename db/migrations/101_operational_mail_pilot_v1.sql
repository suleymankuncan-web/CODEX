-- Additive notification capture. Does not replay historical rows or alter business decisions.
CREATE TABLE IF NOT EXISTS ops.operational_mail_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('checklist_completed','actions_assigned','action_closed','action_reminder',
    'entry_requested','exit_requested','target_submitted','target_missing','target_missing_digest','weekly_report','monthly_report','personnel_roster')),
  company_id UUID REFERENCES ops.company(company_id),
  store_id UUID REFERENCES ops.store(store_id),
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(payload)='object'),
  available_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expanded_at TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS ops.operational_mail_delivery (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ops.operational_mail_event(event_id),
  recipient TEXT NOT NULL CHECK(recipient=LOWER(BTRIM(recipient))),
  audience TEXT NOT NULL CHECK(audience IN ('author_bm','region_manager','store_manager','store_mailbox','hr','owner','personnel_roster')),
  user_id UUID REFERENCES ops.user_account(user_id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','uncertain','cancelled')),
  claimed_at TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  smtp_message_id TEXT, attachment_sha256 TEXT,
  UNIQUE(event_id,recipient)
);
CREATE INDEX IF NOT EXISTS operational_mail_pending ON ops.operational_mail_delivery(event_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS ops.operational_mail_activation (
  stream TEXT PRIMARY KEY CHECK(stream IN ('operational','weekly','monthly','personnel')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION ops.operational_mail_capture_v1() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mail_kind TEXT; mail_entity TEXT; store_scope UUID; company_scope UUID; data JSONB; checklist UUID; parent_event UUID;
BEGIN
  IF TG_TABLE_NAME='checklist_instance' THEN
    IF NEW.status<>'completed' OR (TG_OP='UPDATE' AND OLD.status='completed') THEN RETURN NEW; END IF;
    mail_kind:='checklist_completed'; mail_entity:=NEW.checklist_instance_id::text; store_scope:=NEW.store_id;
    data:=jsonb_build_object('checklistId',mail_entity,'authorId',NEW.completed_by_user_id,'completedAt',NEW.completed_at);
  ELSIF TG_TABLE_NAME='store_action_plan' THEN
    IF NEW.source_type<>'checklist_remediation' OR NEW.source_id !~ '^checklist:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:item:' THEN RETURN NEW; END IF;
    checklist:=split_part(NEW.source_id,':',2)::uuid; store_scope:=NEW.store_id;
    mail_entity:=NEW.store_action_plan_id::text;
    IF NOT EXISTS(SELECT 1 FROM ops.checklist_instance ci WHERE ci.checklist_instance_id=checklist AND ci.store_id=store_scope AND ci.status='completed') THEN RETURN NEW; END IF;
    IF TG_OP='INSERT' THEN
      mail_kind:='actions_assigned';
      PERFORM pg_advisory_xact_lock(hashtext('operational-mail-actions:'||checklist::text)::bigint);
      SELECT event_id INTO parent_event FROM ops.operational_mail_event
        WHERE kind='actions_assigned' AND store_id=store_scope AND payload->>'checklistId'=checklist::text
          AND expanded_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM ops.operational_mail_delivery delivery WHERE delivery.event_id=ops.operational_mail_event.event_id)
          AND created_at >= COALESCE((SELECT activated_at FROM ops.operational_mail_activation WHERE stream='operational'),'-infinity'::timestamptz)
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
      IF parent_event IS NOT NULL THEN
        UPDATE ops.operational_mail_event SET available_at=clock_timestamp()+INTERVAL '1 minute',
          payload=jsonb_set(payload,'{actionIds}',(payload->'actionIds')||to_jsonb(mail_entity)) WHERE event_id=parent_event;
        RETURN NEW;
      END IF;
      data:=jsonb_build_object('checklistId',checklist,'actionIds',jsonb_build_array(mail_entity));
    ELSIF NEW.status='closed' AND OLD.status<>'closed' THEN
      mail_kind:='action_closed'; data:=jsonb_build_object('checklistId',checklist,'actionIds',jsonb_build_array(mail_entity));
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME IN ('seller_code_request','employee_offboarding_request') THEN
    IF NEW.request_status<>'pending_hr_approval' OR (TG_OP='UPDATE' AND OLD.request_status='pending_hr_approval') THEN RETURN NEW; END IF;
    store_scope:=NEW.store_id;
    IF TG_TABLE_NAME='seller_code_request' THEN mail_kind:='entry_requested'; mail_entity:=NEW.seller_code_request_id::text;
    ELSE mail_kind:='exit_requested'; mail_entity:=NEW.offboarding_request_id::text; END IF;
    data:='{}'::jsonb;
  ELSIF TG_TABLE_NAME='target_distribution_request' THEN
    IF NEW.request_status<>'pending_region_approval' OR (TG_OP='UPDATE' AND OLD.request_status='pending_region_approval') THEN RETURN NEW; END IF;
    mail_kind:='target_submitted'; mail_entity:=NEW.target_distribution_request_id::text; store_scope:=NEW.store_id;
    data:=jsonb_build_object('period',to_char(NEW.request_month,'YYYY-MM'));
  END IF;
  SELECT company_id INTO company_scope FROM ops.store WHERE store_id=store_scope;
  IF company_scope IS NULL THEN RETURN NEW; END IF;
  INSERT INTO ops.operational_mail_event(event_key,kind,company_id,store_id,entity_id,payload,available_at)
    VALUES(mail_kind||':'||mail_entity||CASE WHEN mail_kind IN ('entry_requested','exit_requested','target_submitted')
      THEN ':'||(to_jsonb(NEW)->>'updated_at') ELSE '' END,
      mail_kind,company_scope,store_scope,mail_entity,data,clock_timestamp()+CASE WHEN mail_kind='actions_assigned' THEN INTERVAL '1 minute' ELSE INTERVAL '0 seconds' END)
    ON CONFLICT(event_key) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS operational_mail_checklist ON ops.checklist_instance;
CREATE TRIGGER operational_mail_checklist AFTER INSERT OR UPDATE OF status ON ops.checklist_instance
  FOR EACH ROW EXECUTE FUNCTION ops.operational_mail_capture_v1();
DROP TRIGGER IF EXISTS operational_mail_action ON ops.store_action_plan;
CREATE TRIGGER operational_mail_action AFTER INSERT OR UPDATE OF status ON ops.store_action_plan
  FOR EACH ROW EXECUTE FUNCTION ops.operational_mail_capture_v1();
DROP TRIGGER IF EXISTS operational_mail_entry ON ops.seller_code_request;
CREATE TRIGGER operational_mail_entry AFTER INSERT OR UPDATE OF request_status ON ops.seller_code_request
  FOR EACH ROW EXECUTE FUNCTION ops.operational_mail_capture_v1();
DROP TRIGGER IF EXISTS operational_mail_exit ON ops.employee_offboarding_request;
CREATE TRIGGER operational_mail_exit AFTER INSERT OR UPDATE OF request_status ON ops.employee_offboarding_request
  FOR EACH ROW EXECUTE FUNCTION ops.operational_mail_capture_v1();
DROP TRIGGER IF EXISTS operational_mail_target ON ops.target_distribution_request;
CREATE TRIGGER operational_mail_target AFTER INSERT OR UPDATE OF request_status ON ops.target_distribution_request
  FOR EACH ROW EXECUTE FUNCTION ops.operational_mail_capture_v1();
