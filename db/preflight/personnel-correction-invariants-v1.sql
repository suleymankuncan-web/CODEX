-- Additive diagnostic; the original invariant preflight remains immutable.
SELECT substr(md5(r.request_id::text), 1, 12) AS record_fingerprint
FROM ops.personnel_correction_request r
JOIN ops.store s ON s.store_id = r.store_id
JOIN ops.region region ON region.region_id = r.region_id
JOIN ops.employee e ON e.employee_id = r.employee_id
JOIN ops.employee_assignment_history a ON a.assignment_id = r.assignment_id
WHERE r.company_id IS DISTINCT FROM s.company_id
   OR r.company_id IS DISTINCT FROM region.company_id
   OR r.company_id IS DISTINCT FROM e.company_id
   OR r.employee_id IS DISTINCT FROM a.employee_id;
