INSERT INTO ops.position (
    company_id,
    position_code,
    position_name,
    job_family,
    is_managerial
)
SELECT
    company.company_id,
    canonical.position_code,
    canonical.position_name,
    'store',
    canonical.is_managerial
FROM ops.company company
CROSS JOIN (
    VALUES
        ('STORE_MANAGER', 'Mağaza Müdürü', TRUE),
        ('ASSISTANT_MANAGER', 'Mağaza Müdür Yardımcısı', TRUE),
        ('SENIOR_SALES_CONSULTANT', 'Uzman Satış Danışmanı', FALSE),
        ('SALES_ASSOCIATE', 'Satış Danışmanı', FALSE),
        ('CASHIER', 'Kasa Sorumlusu', FALSE)
) AS canonical(position_code, position_name, is_managerial)
ON CONFLICT (company_id, position_code)
DO UPDATE SET
    position_name = EXCLUDED.position_name,
    job_family = COALESCE(ops.position.job_family, EXCLUDED.job_family),
    is_managerial = EXCLUDED.is_managerial;

UPDATE ops.employee_assignment_history assignment
SET position_id = canonical.position_id,
    updated_at = NOW()
FROM ops.position legacy
INNER JOIN ops.position canonical
    ON canonical.company_id = legacy.company_id
   AND canonical.position_code = CASE legacy.position_code
       WHEN 'SHIFT_LEAD' THEN 'ASSISTANT_MANAGER'
       WHEN 'DEMO_STORE_MANAGER' THEN 'STORE_MANAGER'
       WHEN 'DEMO_STORE_PERSONNEL' THEN 'SALES_ASSOCIATE'
   END
WHERE assignment.position_id = legacy.position_id
  AND legacy.position_code IN ('SHIFT_LEAD', 'DEMO_STORE_MANAGER', 'DEMO_STORE_PERSONNEL');

COMMENT ON TABLE ops.position IS
    'Company position catalog. Personnel administration exposes only the five canonical Turkish retail positions.';
