ALTER TABLE ops.store
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE ops.employee
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE ops.employee_assignment_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION ops.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_touch_updated_at ON ops.store;
CREATE TRIGGER trg_store_touch_updated_at
  BEFORE UPDATE ON ops.store
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

DROP TRIGGER IF EXISTS trg_employee_touch_updated_at ON ops.employee;
CREATE TRIGGER trg_employee_touch_updated_at
  BEFORE UPDATE ON ops.employee
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

DROP TRIGGER IF EXISTS trg_employee_assignment_history_touch_updated_at ON ops.employee_assignment_history;
CREATE TRIGGER trg_employee_assignment_history_touch_updated_at
  BEFORE UPDATE ON ops.employee_assignment_history
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();
