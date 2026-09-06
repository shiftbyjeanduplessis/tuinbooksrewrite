import type { Account, BusinessService, ClientServiceHold, IsoDate, ServiceAgreement, ServiceLocation, Team, Visit } from '../../domain/types.js';
import { visitDoNotService } from '../../domain/operations.js';
import type { CancelMode, RescheduleMissedInput } from '../../domain/operations.js';

export interface VisitActionCallbacks{
  onCancel:(visitId:string,mode:CancelMode,reason:string)=>Promise<void>;
  onUndoCancel:(visitId:string)=>Promise<void>;
  onMissed:(visitId:string,reason:string)=>Promise<void>;
  onResolveMissed:(visitId:string,decision:'complete'|'no-return',note:string)=>Promise<void>;
  onReschedule:(input:RescheduleMissedInput)=>Promise<void>;
  onSuspend:(visitIds:string[],suspended:boolean,reason:string)=>Promise<void>;
  onVisitDoNotService:(visitId:string,active:boolean,reason:string,note:string)=>Promise<void>;
  onClientHold:(clientId:string,active:boolean,reason:string,note:string)=>Promise<void>;
}

export function openVisitActionDialog(
  visit:Visit,
  account:Account|undefined,
  location:ServiceLocation|undefined,
  agreement:ServiceAgreement|undefined,
  services:BusinessService[],
  teams:Team[],
  hold:ClientServiceHold|null,
  callbacks:VisitActionCallbacks
):void{
  const d=document.createElement('dialog');
  d.className='operation-dialog visit-control-dialog visit-detail-dialog-r14';
  document.body.append(d);
  const status=String(visit.status).toLowerCase();
  const visitDns=visitDoNotService(visit);
  const team=teams.find(t=>t.id===visit.teamId);
  const teamOptions=teams.map(t=>`<option value="${esc(t.id)}" ${t.id===visit.teamId?'selected':''}>${esc(t.name)}</option>`).join('');
  const clientName=account?.name||visit.accountId;
  const taskLabels=tasksForVisitDetail(visit,agreement,services);
  const address=[location?.address,location?.suburb].filter(Boolean).join(' · ');
  const visitNote=String(visit.payload?.notes??visit.payload?.note??'').trim();
  const typeLabel=visit.visitType==='additional'?'Additional visit':visit.visitType==='quoted'?'Quoted work':'Recurring visit';

  d.innerHTML=`<form class="dialog-shell">
    <header class="visit-dialog-head"><div><p class="eyebrow">${esc(typeLabel)}</p><h2>${esc(clientName)}</h2><p class="scope-copy">${esc(visit.date)} · ${esc(team?.name||'No team')} · ${esc(statusLabel(status))}</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></header>

    <section class="visit-work-detail-r14 dialog-section">
      <div class="visit-address-line-r14"><strong>${esc(location?.siteName||address||'Service location')}</strong>${address?`<span>${esc(address)}</span>`:''}</div>
      <div class="dialog-section-title"><strong>Work for this visit</strong><span>What the team is expected to do</span></div>
      <div class="visit-task-list-r14">${taskLabels.map(task=>`<div class="visit-task-r14"><span aria-hidden="true">✓</span><strong>${esc(task)}</strong></div>`).join('')}</div>
      ${(location?.instructions||location?.accessNotes||agreement?.notes||visitNote)?`<div class="visit-instructions-r14">
        ${location?.instructions?`<p><b>Site instructions</b><span>${esc(location.instructions)}</span></p>`:''}
        ${location?.accessNotes?`<p><b>Access</b><span>${esc(location.accessNotes)}</span></p>`:''}
        ${agreement?.notes?`<p><b>Routine notes</b><span>${esc(agreement.notes)}</span></p>`:''}
        ${visitNote?`<p><b>This visit</b><span>${esc(visitNote)}</span></p>`:''}
      </div>`:''}
    </section>

    ${(visitDns.active||hold)?`<div class="dialog-warning-stack">${visitDns.active?`<div class="dialog-warning visit-dns active-dns-warning-r15"><div><strong>DO NOT SERVICE — THIS VISIT</strong><span>${esc([visitDns.reason,visitDns.note].filter(Boolean).join(' · '))}</span></div><button type="button" data-op="clear-visit-dns" class="dns-clear-inline-r15">Allow this visit again</button></div>`:''}${hold?`<div class="dialog-warning client-dns active-dns-warning-r15"><div><strong>DO NOT SERVICE — CLIENT</strong><span>${esc([hold.reason,hold.note].filter(Boolean).join(' · '))}</span></div><button type="button" data-op="clear-hold" class="dns-clear-inline-r15">Clear client DNS</button></div>`:''}</div>`:''}

    ${status==='missed'?`<section class="dialog-section missed-resolution-section">
      <div class="dialog-section-title"><strong>Resolve missed visit</strong><span>Choose what actually happened</span></div>
      <div class="missed-resolution-grid">
        <button type="button" data-op="missed-complete" class="resolution-choice completed"><b>It was completed</b><span>Record the visit in Work.</span></button>
        <button type="button" data-op="reschedule" class="resolution-choice catchup"><b>Reschedule / catch-up</b><span>Create a linked replacement visit.</span></button>
        <button type="button" data-op="missed-no-return" class="resolution-choice no-return"><b>No catch-up / no charge</b><span>Close this visit without replacement.</span></button>
      </div>
    </section>`:`<section class="dialog-section visit-actions-r14">
      <div class="dialog-section-title"><strong>Visit actions</strong><span>Administrative actions are secondary to the work details above</span></div>
      <div class="operation-grid compact-operation-grid primary-actions-r14">
        ${status==='scheduled'?`<button type="button" data-op="dns-choice" class="dns-primary-action"><b>${visitDns.active||hold?'Do not service settings':'Do not service'}</b><span>${visitDns.active||hold?'Change visit/client DNS scope':'Choose this visit or the client'}</span></button><button type="button" data-op="cancel-choice"><b>Cancel visit</b><span>Choose charge or no charge</span></button>`:''}
        ${status==='suspended'?`<button type="button" data-op="resume"><b>Resume visit</b><span>Return this occurrence to scheduled</span></button>`:''}
        ${status==='cancelled'?`<button type="button" data-op="undo-cancel"><b>Undo cancellation</b><span>Restore this visit</span></button>`:''}
      </div>
    </section>`}

    <section class="operation-fields hidden" data-cancel-choice-panel>
      <div class="dialog-section-title"><strong>Cancel this visit</strong><span>Future recurrence is unchanged</span></div>
      <label>Reason / note<textarea data-reason rows="3" placeholder="Optional cancellation note"></textarea></label>
      <div class="operation-grid compact-operation-grid"><button type="button" data-op="cancel-no"><b>Cancel — no charge</b><span>Do not bill this occurrence</span></button><button type="button" data-op="cancel-charge"><b>Cancel & charge</b><span>Keep this occurrence billable</span></button></div>
      <div class="dialog-actions"><button type="button" class="secondary-button" data-cancel-choice-back>Back</button></div>
    </section>

    <section class="operation-fields hidden" data-dns-choice-panel>
      <div class="dialog-section-title"><strong>Do not service</strong><span>Choose the scope deliberately</span></div>
      <div class="operation-grid compact-operation-grid"><button type="button" data-op="visit-dns"><b>This visit only</b><span>Future recurrence remains unchanged</span></button>${hold?`<button type="button" data-op="clear-hold"><b>Clear client warning</b><span>Client-level Do not service is currently active</span></button>`:`<button type="button" data-op="hold"><b>Entire client</b><span>Block client visits until cleared</span></button>`}</div>
      <div class="dialog-actions"><button type="button" class="secondary-button" data-dns-choice-back>Back</button></div>
    </section>

    <section class="operation-fields hidden" data-missed-resolution-panel><label>Office note<textarea data-missed-resolution-note rows="3" placeholder="Optional reason or confirmation note"></textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-missed-resolution-cancel>Back</button><button type="button" class="primary-button" data-missed-resolution-save>Confirm outcome</button></div></section>
    <section class="operation-fields hidden" data-reschedule-panel><label>New date<input data-new-date type="date" value="${esc(visit.date)}"></label><label>Team<select data-new-team>${teamOptions}</select></label><div class="dialog-actions"><button type="button" class="secondary-button" data-reschedule-cancel>Back</button><button type="button" class="primary-button" data-reschedule-save>Reschedule</button></div></section>
    <section class="operation-fields hidden" data-dns-panel><label>Reason<input data-dns-reason value="${esc(visitDns.reason||'Do not service this visit')}"></label><label>Note<textarea data-dns-note rows="3">${esc(visitDns.note||'')}</textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-dns-cancel>Back</button><button type="button" class="primary-button" data-dns-save>Save visit warning</button></div></section>
    <section class="operation-fields hidden" data-hold-panel><label>Reason<input data-hold-reason value="${esc(hold?.reason||'Do not service')}"></label><label>Note<textarea data-hold-note rows="3">${esc(hold?.note||'')}</textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-hold-cancel>Back</button><button type="button" class="primary-button" data-hold-save>Save client warning</button></div></section>
  </form>`;

  const close=()=>d.close();
  d.querySelectorAll<HTMLElement>('[data-close]').forEach(b=>b.onclick=close);
  d.addEventListener('close',()=>d.remove(),{once:true});
  const mainSections=Array.from(d.querySelectorAll<HTMLElement>('.dialog-section,.dialog-warning-stack'));
  const cancelChoicePanel=d.querySelector<HTMLElement>('[data-cancel-choice-panel]')!;
  const dnsChoicePanel=d.querySelector<HTMLElement>('[data-dns-choice-panel]')!;
  const missedResolutionPanel=d.querySelector<HTMLElement>('[data-missed-resolution-panel]')!;
  const reschedulePanel=d.querySelector<HTMLElement>('[data-reschedule-panel]')!;
  const dnsPanel=d.querySelector<HTMLElement>('[data-dns-panel]')!;
  const holdPanel=d.querySelector<HTMLElement>('[data-hold-panel]')!;
  const panels=[cancelChoicePanel,dnsChoicePanel,missedResolutionPanel,reschedulePanel,dnsPanel,holdPanel];
  let pending:''|'missed-complete'|'missed-no-return'='';

  const showPanel=(panel:HTMLElement)=>{mainSections.forEach(s=>s.classList.add('hidden'));panels.forEach(p=>p.classList.add('hidden'));panel.classList.remove('hidden');};
  const showSections=()=>{panels.forEach(p=>p.classList.add('hidden'));mainSections.forEach(s=>s.classList.remove('hidden'));};

  d.querySelectorAll<HTMLButtonElement>('[data-op]').forEach(button=>button.onclick=()=>{
    const op=button.dataset.op||'';
    if(op==='cancel-choice'){showPanel(cancelChoicePanel);return;}
    if(op==='dns-choice'){showPanel(dnsChoicePanel);return;}
    if(op==='cancel-no'||op==='cancel-charge'){const reason=(d.querySelector<HTMLTextAreaElement>('[data-reason]')?.value||'').trim();void callbacks.onCancel(visit.id,op==='cancel-charge'?'charge':'no-charge',reason).then(close);return;}
    if(op==='resume'){void callbacks.onSuspend([visit.id],false,'').then(close);return;}
    if(op==='undo-cancel'){void callbacks.onUndoCancel(visit.id).then(close);return;}
    if(op==='missed-complete'||op==='missed-no-return'){pending=op;showPanel(missedResolutionPanel);return;}
    if(op==='reschedule'){showPanel(reschedulePanel);return;}
    if(op==='visit-dns'){showPanel(dnsPanel);return;}
    if(op==='clear-visit-dns'){void callbacks.onVisitDoNotService(visit.id,false,visitDns.reason,visitDns.note).then(close);return;}
    if(op==='hold'){showPanel(holdPanel);return;}
    if(op==='clear-hold'){void callbacks.onClientHold(visit.accountId,false,hold?.reason||'Do not service',hold?.note||'').then(close);}
  });

  d.querySelector<HTMLButtonElement>('[data-cancel-choice-back]')!.onclick=showSections;
  d.querySelector<HTMLButtonElement>('[data-dns-choice-back]')!.onclick=showSections;
  d.querySelector<HTMLButtonElement>('[data-missed-resolution-cancel]')!.onclick=showSections;
  d.querySelector<HTMLButtonElement>('[data-missed-resolution-save]')!.onclick=()=>{const note=(d.querySelector<HTMLTextAreaElement>('[data-missed-resolution-note]')!.value||'').trim();if(pending==='missed-complete')void callbacks.onResolveMissed(visit.id,'complete',note).then(close);if(pending==='missed-no-return')void callbacks.onResolveMissed(visit.id,'no-return',note).then(close);};
  d.querySelector<HTMLButtonElement>('[data-reschedule-cancel]')!.onclick=showSections;
  d.querySelector<HTMLButtonElement>('[data-reschedule-save]')!.onclick=()=>{const date=d.querySelector<HTMLInputElement>('[data-new-date]')!.value as IsoDate,teamId=d.querySelector<HTMLSelectElement>('[data-new-team]')!.value;if(!date||!teamId)return;void callbacks.onReschedule({visitId:visit.id,newVisitId:`sch-v2-rescheduled-${crypto.randomUUID()}`,date,teamId,sortOrder:visit.sortOrder}).then(close);};
  d.querySelector<HTMLButtonElement>('[data-dns-cancel]')!.onclick=()=>showPanel(dnsChoicePanel);
  d.querySelector<HTMLButtonElement>('[data-dns-save]')!.onclick=()=>{const reason=d.querySelector<HTMLInputElement>('[data-dns-reason]')!.value.trim()||'Do not service this visit',note=d.querySelector<HTMLTextAreaElement>('[data-dns-note]')!.value.trim();void callbacks.onVisitDoNotService(visit.id,true,reason,note).then(close);};
  d.querySelector<HTMLButtonElement>('[data-hold-cancel]')!.onclick=()=>showPanel(dnsChoicePanel);
  d.querySelector<HTMLButtonElement>('[data-hold-save]')!.onclick=()=>{const reason=d.querySelector<HTMLInputElement>('[data-hold-reason]')!.value.trim()||'Do not service',note=d.querySelector<HTMLTextAreaElement>('[data-hold-note]')!.value.trim();void callbacks.onClientHold(visit.accountId,true,reason,note).then(close);};
  d.showModal();
}

function tasksForVisitDetail(visit:Visit,agreement:ServiceAgreement|undefined,services:BusinessService[]):string[]{
  const labels:string[]=[];
  const add=(value:unknown)=>{const text=String(value??'').trim();if(text&&!labels.includes(text))labels.push(text);};
  const payload=visit.payload??{};
  for(const key of ['tasks','customTasks']){
    const value=payload[key];
    if(Array.isArray(value))value.forEach(add);
    else if(typeof value==='string')value.split(/\r?\n|\s*;\s*/).forEach(add);
  }
  add(payload.task);
  add(payload.serviceDescription);
  const serviceIds=visit.serviceIds.length?visit.serviceIds:(agreement?.serviceIds??[]);
  for(const id of serviceIds){const service=services.find(row=>row.id===id);add(service?.name||id);}
  if(!labels.length)add('Garden service');
  return labels;
}
function statusLabel(status:string):string{if(status==='scheduled')return 'Scheduled';if(status==='missed')return 'Missed';if(status==='suspended')return 'Suspended';if(status==='cancelled')return 'Cancelled';if(status==='completed')return 'Completed';if(status==='rescheduled')return 'Rescheduled';return status||'Visit';}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
