SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE FUNCTION ops.target_distribution_employee_ids_unique_v1(allocation JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN pg_catalog.jsonb_typeof(allocation) IS DISTINCT FROM 'array' THEN TRUE
    ELSE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(allocation) AS entry(item)
      WHERE pg_catalog.jsonb_typeof(entry.item) = 'object'
        AND pg_catalog.jsonb_typeof(entry.item -> 'employeeId') = 'string'
      GROUP BY pg_catalog.lower(entry.item ->> 'employeeId')
      HAVING pg_catalog.count(*) > 1
    )
  END;
$function$;

ALTER TABLE ops.target_distribution_request
  ADD CONSTRAINT ck_target_distribution_employee_ids_unique_v1
  CHECK (ops.target_distribution_employee_ids_unique_v1(allocation_json))
  NOT VALID;

ALTER TABLE ops.target_distribution_request
  VALIDATE CONSTRAINT ck_target_distribution_employee_ids_unique_v1;
