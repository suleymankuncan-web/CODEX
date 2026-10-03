-- Earlier catalog migrations only populated companies present at that time.
-- Complete catalogs for companies provisioned later, retaining existing IDs,
-- managerial eligibility, job families and all historical references.
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
        ('CASHIER', 'Kasa Sorumlusu', FALSE),
        ('WAREHOUSE_SUPERVISOR', 'Depo Sorumlusu', FALSE)
) AS canonical(position_code, position_name, is_managerial)
ON CONFLICT (company_id, position_code)
DO UPDATE SET position_name = EXCLUDED.position_name;
