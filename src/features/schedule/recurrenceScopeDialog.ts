import type { ScheduleSeries, Visit, VisitMoveScope } from '../../domain/types.js';
import { recurrenceLabel } from '../../domain/recurrence.js';

export function chooseMoveScope(visit:Visit,series:ScheduleSeries):Promise<VisitMoveScope|null>{
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='scope-dialog';
    dialog.innerHTML=`<form method="dialog" class="dialog-shell"><header><div><p class="eyebrow">Recurring visit</p><h2>Move ${esc(recurrenceLabel(series).toLowerCase())} work</h2></div><button class="icon-button" value="cancel" aria-label="Close">×</button></header><p class="scope-copy">Choose whether this is a one-off schedule exception or a change to this recurring slot from here onward.</p><div class="scope-options"><button type="button" data-scope="one"><strong>This visit only</strong><span>Keep the recurrence pattern unchanged.</span></button><button type="button" data-scope="future"><strong>This + future visits</strong><span>Change this recurring slot from this occurrence onward. Past, completed and previous manual exceptions stay unchanged.</span></button></div><footer><button class="secondary-button" value="cancel">Cancel</button></footer></form>`;
    document.body.append(dialog);let settled=false;const done=(value:VisitMoveScope|null)=>{if(settled)return;settled=true;resolve(value);dialog.close();};
    dialog.querySelector<HTMLButtonElement>('[data-scope="one"]')!.onclick=()=>done('one');dialog.querySelector<HTMLButtonElement>('[data-scope="future"]')!.onclick=()=>done('future');dialog.addEventListener('cancel',event=>{event.preventDefault();done(null);});dialog.addEventListener('close',()=>{if(!settled)resolve(null);dialog.remove();},{once:true});dialog.showModal();
  });
}
function esc(v:string):string{return v.replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
