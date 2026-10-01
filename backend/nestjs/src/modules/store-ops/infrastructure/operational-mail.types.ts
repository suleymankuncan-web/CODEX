import type { WorkflowMailKind } from "../../../shared/mail/workflow.templates";
export type OperationalMailEvent={event_id:string;event_key:string;kind:WorkflowMailKind;company_id:string|null;store_id:string|null;entity_id:string|null;payload:Record<string,unknown>;created_at:string};
export type OperationalAudience="author_bm"|"region_manager"|"store_manager"|"store_mailbox"|"hr"|"owner"|"personnel_roster";
export type OperationalRecipient={recipient:string;audience:OperationalAudience;user_id:string|null};
export type OperationalDelivery=OperationalRecipient & {delivery_id:string};
export type OperationalReportManager={user_id:string;email:string;store_ids:string[];company_ids:string[]};
