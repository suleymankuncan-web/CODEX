ALTER TABLE ops.employee ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE ops.personnel_correction_request ADD COLUMN IF NOT EXISTS proposed_national_id_hash TEXT;
ALTER TABLE ops.identity_lifecycle_job DROP CONSTRAINT identity_lifecycle_job_operation_check;
ALTER TABLE ops.identity_lifecycle_job ADD CONSTRAINT identity_lifecycle_job_operation_check CHECK (operation IN ('provision','enable','disable','update_profile'));
INSERT INTO ops.position (company_id,position_code,position_name,job_family,is_managerial)
SELECT company_id,'WAREHOUSE_SUPERVISOR','Depo Sorumlusu','store',FALSE FROM ops.company
ON CONFLICT (company_id,position_code) DO UPDATE SET position_name=EXCLUDED.position_name;
COMMENT ON TABLE ops.position IS 'Personnel selection exposes the six canonical retail positions; historical references are retained.';
