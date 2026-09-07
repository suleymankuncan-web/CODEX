SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE TABLE IF NOT EXISTS ops.personnel_observation_attempt (
    source_id UUID NOT NULL REFERENCES stg.integration_source(integration_source_id),
    business_date DATE NOT NULL,
    generation BIGINT NOT NULL DEFAULT 0 CHECK (generation >= 0),
    accepted_generation BIGINT NOT NULL DEFAULT 0,
    accepted_digest CHAR(64),
    PRIMARY KEY (source_id, business_date),
    CHECK (accepted_generation >= 0 AND accepted_generation <= generation),
    CHECK ((accepted_generation = 0 AND accepted_digest IS NULL)
        OR (accepted_generation > 0 AND accepted_digest IS NOT NULL AND accepted_digest ~ '^[a-f0-9]{64}$'))
);

CREATE TABLE IF NOT EXISTS ops.personnel_observation (
    source_id UUID NOT NULL,
    business_date DATE NOT NULL,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    personnel_code TEXT NOT NULL CHECK (
        length(personnel_code) BETWEEN 1 AND 80
        AND personnel_code = btrim(personnel_code)
    ),
    PRIMARY KEY (source_id, business_date, store_id, personnel_code),
    FOREIGN KEY (source_id, business_date)
        REFERENCES ops.personnel_observation_attempt(source_id, business_date)
);

CREATE INDEX IF NOT EXISTS ix_personnel_observation_store_date
    ON ops.personnel_observation (store_id, business_date DESC, personnel_code);

COMMENT ON TABLE ops.personnel_observation IS
    'Code-only sales observations; not employment, assignment, identity or authorization records.';
