import { ConfigService } from "@nestjs/config";
import { incentiveMailOrigin } from "./incentive-mail-link";
import type { WorkflowMailKind } from "./workflow.templates";

export function workflowMailOrigin(config:ConfigService) {
  const explicit=config.get<string>('OPERATIONAL_MAIL_APP_ORIGIN')?.trim();
  if(!explicit) return incentiveMailOrigin(config);
  try {const url=new URL(explicit);return url.protocol==='https:' && url.pathname==='/' && !url.username && !url.password && !url.search && !url.hash ? url.origin : null;} catch {return null;}
}
export function workflowMailLink(origin:string,event:{kind:WorkflowMailKind;payload:Record<string,unknown>}) {
  const route=event.kind==='visit_plan_created' ? '/store/checklists' : event.kind==='checklist_completed' ? '/store/checklists' : event.kind.includes('action') ? '/store/tasks'
    : event.kind.endsWith('requested') ? '/admin/inbox' : event.kind.includes('report') ? '/store/reports' : '/store/targets';
  const url=new URL(route,origin);
  if(event.kind==='checklist_completed') {url.searchParams.set('overlay','result');url.searchParams.set('checklistInstanceId',String(event.payload.checklistId));}
  if(event.kind.endsWith('requested')) url.searchParams.set('tab',event.kind==='entry_requested' ? 'seller-code' : 'offboarding');
  if(event.kind.includes('report')) url.searchParams.set('period',String(event.payload.end).slice(0,7));
  return url.href;
}
