-- Notify one completed weekly planning save; never replay historical plans.
SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';
ALTER TABLE ops.operational_mail_event DROP CONSTRAINT operational_mail_event_kind_check;
ALTER TABLE ops.operational_mail_event ADD CONSTRAINT operational_mail_event_kind_check
  CHECK(kind IN ('checklist_completed','actions_assigned','action_closed','action_reminder',
    'entry_requested','exit_requested','target_submitted','target_missing','target_missing_digest',
    'weekly_report','monthly_report','personnel_roster','visit_plan_created'));
ALTER TABLE ops.operational_mail_delivery DROP CONSTRAINT operational_mail_delivery_audience_check;
ALTER TABLE ops.operational_mail_delivery ADD CONSTRAINT operational_mail_delivery_audience_check
  CHECK(audience IN ('author_bm','region_manager','store_manager','store_mailbox','hr','owner','personnel_roster','visit_plan'));
ALTER TABLE ops.operational_mail_activation DROP CONSTRAINT operational_mail_activation_stream_check;
ALTER TABLE ops.operational_mail_activation ADD CONSTRAINT operational_mail_activation_stream_check
  CHECK(stream IN ('operational','weekly','monthly','personnel','visit_plans'));

CREATE OR REPLACE FUNCTION ops.visit_plan_mail_scope_v1(actor UUID)
RETURNS TABLE(store_id UUID,region_id UUID) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT store.store_id,store.region_id FROM ops.user_account account
  JOIN ops.user_action_store_assignment assigned ON assigned.user_id=account.user_id
    AND assigned.start_at<=CURRENT_TIMESTAMP AND (assigned.end_at IS NULL OR assigned.end_at>CURRENT_TIMESTAMP)
  JOIN ops.store store ON store.store_id=assigned.store_id AND store.status='active'
  JOIN ops.company company ON company.company_id=store.company_id AND company.status='active'
  JOIN ops.region region ON region.region_id=store.region_id AND region.company_id=store.company_id AND region.status='active'
  WHERE account.user_id=actor AND account.is_active AND EXISTS(
    SELECT 1 FROM ops.user_role_assignment ura JOIN ops.role role USING(role_id)
    WHERE ura.user_id=account.user_id AND role.role_code='REGION_MANAGER'
      AND ura.start_at<=CURRENT_TIMESTAMP AND (ura.end_at IS NULL OR ura.end_at>CURRENT_TIMESTAMP)
      AND (ura.scope_type='global' OR (ura.scope_type='company' AND ura.company_id=store.company_id)
        OR (ura.scope_type='region' AND ura.region_id=store.region_id) OR (ura.scope_type='store' AND ura.store_id=store.store_id)))
$$;

CREATE OR REPLACE FUNCTION ops.capture_visit_plan_mail_v1() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE week_start DATE; data JSONB; mail_key TEXT;
BEGIN
  IF NEW.event_type<>'region_weekly_visit_plan.revised' OR NEW.entity_name<>'ops.region_weekly_visit_plan'
    OR NOT EXISTS(SELECT 1 FROM ops.operational_mail_activation WHERE stream='visit_plans' AND activated_at<=clock_timestamp())
    THEN RETURN NEW; END IF;
  SELECT week_start_date INTO week_start FROM ops.region_weekly_visit_plan WHERE plan_id=NEW.entity_id;
  IF week_start IS NULL OR NOT EXISTS(SELECT 1 FROM ops.visit_plan_mail_scope_v1(NEW.actor_user_id)) THEN RETURN NEW; END IF;
  WITH scope AS (SELECT * FROM ops.visit_plan_mail_scope_v1(NEW.actor_user_id)), revisions AS (
    SELECT revision.revision_id FROM ops.region_weekly_visit_plan_revision revision
    WHERE revision.is_current AND revision.week_start_date=week_start AND revision.visit_type='BM_STORE_VISIT'
      AND revision.region_id IN (SELECT region_id FROM scope)
  ) SELECT jsonb_build_object('weekStart',week_start,'userId',NEW.actor_user_id,
    'storeIds',(SELECT jsonb_agg(store_id ORDER BY store_id) FROM scope),
    'revisionIds',COALESCE((SELECT jsonb_agg(revision_id ORDER BY revision_id) FROM revisions),'[]'::jsonb)) INTO data;
  -- A portfolio spans regional storage partitions: all their audit rows commit
  -- together and update one snapshot before another worker can see the event.
  mail_key:='visit-plan:'||NEW.actor_user_id::text||':'||week_start::text||':'||txid_current()::text;
  INSERT INTO ops.operational_mail_event(event_key,kind,entity_id,payload)
    VALUES(mail_key,'visit_plan_created',NEW.actor_user_id::text,data)
    ON CONFLICT(event_key) DO UPDATE SET payload=EXCLUDED.payload;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS visit_plan_created_mail ON audit.event_log;
CREATE TRIGGER visit_plan_created_mail AFTER INSERT ON audit.event_log
  FOR EACH ROW WHEN (NEW.event_type='region_weekly_visit_plan.revised')
  EXECUTE FUNCTION ops.capture_visit_plan_mail_v1();
