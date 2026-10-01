-- Scope current manager authority to the actual company/region/store; preserve archived decisions and money.
CREATE OR REPLACE FUNCTION ops.incentive_responsibility_current(payload JSONB,at_time TIMESTAMPTZ) RETURNS boolean
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
            AND ura.start_at<=at_time AND (ura.end_at IS NULL OR ura.end_at>at_time)
            AND (ura.scope_type='global' OR (ura.scope_type='company' AND ura.company_id=store.company_id)
              OR (ura.scope_type='region' AND ura.region_id=store.region_id) OR (ura.scope_type='store' AND ura.store_id=store.store_id)))
    )
$$;
