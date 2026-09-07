-- Rollback only an unused feature. Preserve observations once they exist.
BEGIN;
SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';
LOCK TABLE ops.personnel_observation_attempt IN ACCESS EXCLUSIVE MODE;
LOCK TABLE ops.personnel_observation IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.personnel_observation)
        OR EXISTS (SELECT 1 FROM ops.personnel_observation_attempt) THEN
        RAISE EXCEPTION 'Personnel observations exist; preserve them before rollback';
    END IF;
END $$;
DROP TABLE ops.personnel_observation;
DROP TABLE ops.personnel_observation_attempt;
DELETE FROM audit.schema_migration
WHERE migration_name = '076_sales_personnel_observations_v1.sql';
COMMIT;
