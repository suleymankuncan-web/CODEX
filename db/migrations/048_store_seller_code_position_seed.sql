INSERT INTO ops.position (
    company_id,
    position_code,
    position_name,
    job_family,
    is_managerial
)
SELECT
    c.company_id,
    required_positions.position_code,
    required_positions.position_name,
    'store',
    required_positions.is_managerial
FROM ops.company c
CROSS JOIN (
    VALUES
        ('STORE_MANAGER', 'Mağaza Müdürü', TRUE),
        ('ASSISTANT_MANAGER', 'Mağaza Müdür Yardımcısı', TRUE),
        ('SENIOR_SALES_CONSULTANT', 'Uzman Satış Danışmanı', FALSE),
        ('SALES_ASSOCIATE', 'Satış Danışmanı', FALSE),
        ('CASHIER', 'Kasa Sorumlusu', FALSE)
) AS required_positions(position_code, position_name, is_managerial)
WHERE c.status = 'active'
ON CONFLICT (company_id, position_code) DO UPDATE
SET
    position_name = EXCLUDED.position_name,
    job_family = COALESCE(ops.position.job_family, EXCLUDED.job_family),
    is_managerial = EXCLUDED.is_managerial;
