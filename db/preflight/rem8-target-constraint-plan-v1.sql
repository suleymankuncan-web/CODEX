-- Trace: FR-07; NFR-01, NFR-07; AC-02; EC-08, EC-16.
SELECT COUNT(*)::integer
FROM ops.target_distribution_request request
WHERE request.target_label IS DISTINCT FROM 'pilot_imported_personnel_targets'
  AND pg_catalog.jsonb_typeof(request.allocation_json) = 'array'
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(request.allocation_json) AS entry(item)
    WHERE pg_catalog.jsonb_typeof(entry.item) = 'object'
      AND pg_catalog.jsonb_typeof(entry.item -> 'employeeId') = 'string'
    GROUP BY pg_catalog.lower(entry.item ->> 'employeeId')
    HAVING pg_catalog.count(*) > 1
  );
