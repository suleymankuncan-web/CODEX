import { workflowMailContent } from './workflow.templates';
import { renderBaseTemplate } from './base.template';
import { workflowMailLink,workflowMailOrigin } from './workflow-mail-link';
import { ConfigService } from '@nestjs/config';
describe('operational mail content',()=>{
  it('escapes actual names and includes a real HTTPS detail CTA without mock labels',()=>{
    const rendered=renderBaseTemplate(workflowMailContent({kind:'checklist_completed',storeName:'A <script>',checklistName:'BM ziyareti',date:'01.10.2026',url:'https://hr.example/store/checklists?overlay=result&checklistInstanceId=123'}));
    expect(rendered.html).toContain('A &lt;script&gt;');expect(rendered.html).not.toContain('Şablon görünümü');
    expect(rendered.text).toContain('Checklist detayına git');expect(rendered.attachments).toHaveLength(2);
  });
  it('does not conflate requests, review responsibility and missed deadlines',()=>{
    expect(workflowMailContent({kind:'entry_requested',name:'Personel',storeName:'Mağaza',date:'02.10.2026',url:'https://hr.example'}).paragraphs[0]).toContain('Talep İK onayı bekliyor');
    const review=workflowMailContent({kind:'action_reminder',storeName:'Mağaza',daysLeft:-2,reviewPending:true,url:'https://hr.example'});
    expect(review.title).toBe('Aksiyon çözümü onay bekliyor');expect(review.paragraphs[0]).not.toContain('termin geçti');
    expect(workflowMailContent({kind:'action_reminder',daysLeft:3,url:'https://hr.example'}).paragraphs[0]).toContain('3 gün');
  });
  it('rejects unsafe origins and points checklist and HR links at implemented routes',()=>{
    expect(workflowMailOrigin(new ConfigService({OPERATIONAL_MAIL_APP_ORIGIN:'http://hr.example'}))).toBeNull();
    expect(workflowMailLink('https://hr.example',{kind:'entry_requested',payload:{}} as never)).toBe('https://hr.example/admin/inbox?tab=seller-code');
    expect(workflowMailLink('https://hr.example',{kind:'checklist_completed',payload:{checklistId:'fixture'}} as never)).toContain('overlay=result&checklistInstanceId=fixture');
  });
});
