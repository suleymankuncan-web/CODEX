import type { DatabaseService } from '../../../shared/database/database.service';
export type PersonnelRosterMailRow={store_name:string|null;position_name:string|null;first_name:string;last_name:string;phone_number:string|null;hire_date:string;status:'Aktif'|'Pasif'};
/** All stored personnel, including former employees and employees with no store assignment. No identity/financial fields. */
export async function readPersonnelRosterForMail(db:DatabaseService,asOf:string) {
  return (await db.query<PersonnelRosterMailRow>(`SELECT store.store_name,position.position_name,employee.first_name,employee.last_name,
    employee.phone_number,to_char(employee.hire_date,'DD.MM.YYYY') AS hire_date,
    CASE WHEN employee.employment_status='active' AND (employee.termination_date IS NULL OR employee.termination_date>$1::date)
      THEN 'Aktif' ELSE 'Pasif' END AS status
    FROM ops.employee employee LEFT JOIN LATERAL (
      SELECT history.store_id,history.position_id FROM ops.employee_assignment_history history
      WHERE history.employee_id=employee.employee_id AND history.start_date<=$1::date
      ORDER BY (history.end_date IS NULL OR history.end_date>=$1::date) DESC,
        history.is_primary_assignment DESC,history.start_date DESC,history.created_at DESC,history.assignment_id DESC LIMIT 1
    ) assignment ON TRUE
    LEFT JOIN ops.store store ON store.store_id=assignment.store_id
    LEFT JOIN ops.position position ON position.position_id=assignment.position_id
    ORDER BY store.store_name NULLS LAST,employee.last_name,employee.first_name,employee.employee_id`,[asOf])).rows;
}
