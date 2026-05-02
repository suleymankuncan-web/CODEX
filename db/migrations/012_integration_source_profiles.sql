ALTER TABLE stg.integration_source
ADD COLUMN IF NOT EXISTS source_system TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE stg.integration_source
ADD COLUMN IF NOT EXISTS state_model TEXT NOT NULL DEFAULT 'latest_state';
