import type { IsoDate, ScheduleDayAction, Team } from '../../domain/types.js';
import type { DayActionInput } from '../../domain/operations.js';

export function openDayActionDialog(kind:'team_note'|'internal_event',date:IsoDate,teamId:string,teams:Team[],existing:ScheduleDayAction|null,onSave:(input:DayActionInput)=>Promise<void>,onRemove:(id:string)=>Promise<void>):void{
  const note=kind==='team_note';
  const d=document.createElement('dialog');d.className='operation-dialog day-action-dialog';document.body.append(d);
  const options=teams.map(t=>`<option value="${esc(t.id)}" ${t.id===(existing?.teamId||teamId)?'selected':''}>${esc(t.name)}</option>`).join('');
  d.innerHTML=`<form class="dialog-shell">
    <header><div><p class="eyebrow">${note?'Team note':'Event'}</p><h2>${existing?'Edit':'Add'} ${note?'note':'event'}</h2><p class="scope-copy">Keep the calendar compact; details and responses live here.</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></header>
    <div class="form-grid">
      <label>Date<input data-date type="date" required value="${esc(existing?.date||date)}"></label>
      <label>Team<select data-team>${options}</select></label>
      ${note?'':`<label>Time<input data-time type="time" value="${esc(existing?.time||'')}"></label><label>Event title<input data-title required value="${esc(existing?.title||'')}"></label>`}
      <label class="span-two">${note?'Note / instruction':'Details'}<textarea data-detail rows="4" ${note?'required':''}>${esc(existing?.detail||'')}</textarea></label>
      ${note?'':`<label class="span-two event-response-field">Response / outcome<textarea data-response rows="3" placeholder="Record the response, decision or outcome here">${esc(existing?.response||'')}</textarea></label>`}
    </div>
    <footer class="day-action-footer">
      <div>${existing?'<button type="button" class="danger-button" data-remove>Remove</button>':'<span></span>'}</div>
      <div class="dialog-actions"><button type="button" class="secondary-button" data-close>Cancel</button><button class="secondary-button" type="submit" data-save>${existing?'Save changes':'Save'}</button>${!note&&existing?'<button type="button" class="primary-button" data-resolve>Respond & resolve</button>':''}</div>
    </footer>
  </form>`;

  const close=()=>d.close();
  d.querySelectorAll<HTMLElement>('[data-close]').forEach(b=>b.onclick=close);
  d.addEventListener('close',()=>d.remove(),{once:true});
  d.querySelector<HTMLButtonElement>('[data-remove]')?.addEventListener('click',()=>existing&&void onRemove(existing.id).then(close));

  const input=(status:'active'|'resolved'):DayActionInput=>({
    id:existing?.id||`action-v2-${crypto.randomUUID()}`,
    date:d.querySelector<HTMLInputElement>('[data-date]')!.value as IsoDate,
    teamId:d.querySelector<HTMLSelectElement>('[data-team]')!.value,
    kind,
    title:note?'Day instruction':d.querySelector<HTMLInputElement>('[data-title]')!.value.trim(),
    detail:d.querySelector<HTMLTextAreaElement>('[data-detail]')!.value.trim(),
    time:note?'':d.querySelector<HTMLInputElement>('[data-time]')!.value,
    response:note?'':d.querySelector<HTMLTextAreaElement>('[data-response]')!.value.trim(),
    status,
  });
  const valid=(value:DayActionInput)=>note?!!value.detail:!!value.title;
  const save=(status:'active'|'resolved')=>{const value=input(status);if(!valid(value))return;void onSave(value).then(close);};
  d.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();save('active');};
  d.querySelector<HTMLButtonElement>('[data-resolve]')?.addEventListener('click',()=>save('resolved'));
  d.showModal();
}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
