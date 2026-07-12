ALTER TABLE ops.target_distribution_request
  ADD CONSTRAINT ck_target_distribution_employee_ids_unique_v1
  CHECK (ops.target_distribution_employee_ids_unique_v1(allocation_json))
  NOT VALID;
