ALTER TABLE stg.integration_source
DROP CONSTRAINT IF EXISTS integration_source_source_code_key;

ALTER TABLE stg.integration_source
ADD CONSTRAINT integration_source_source_code_entity_type_key
UNIQUE (source_code, entity_type);
