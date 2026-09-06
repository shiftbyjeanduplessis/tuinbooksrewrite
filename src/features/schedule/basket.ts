import type { Account, PlaceQueueItemInput, ScheduleQueueItem, ServiceLocation, Visit } from '../../domain/types.js';
import { nextSortOrder } from '../../domain/schedule.js';

export interface BasketController { destroy():void; }
export function renderBasket(host:HTMLElement,items:ScheduleQueueItem[],accounts:Account[],locations:ServiceLocation[],visits:Visit[],onPlace:(input:PlaceQueueItemInput)=>Promise<void>):BasketController{
  const accountById=new Map(accounts.map(a=>[a.id,a])); const locationById=new Map(locations.map(s=>[s.id,s]));
  host.innerHTML='';
  if(!items.length){host.innerHTML='<div class="basket-empty"><strong>Basket empty</strong><p>Move a visit here or add accepted/unscheduled work.</p></div>';return{destroy(){host.innerHTML='';}};}
  const list=document.createElement('div');list.className='basket-list';host.append(list);
  const cleanup:Array<()=>void>=[];
  for(const item of items){
    const account=accountById.get(item.accountId); const location=item.serviceLocationId?locationById.get(item.serviceLocationId):undefined;
    const card=document.createElement('article');card.className=`basket-card basket-${item.visitType}`;card.dataset.queueItemId=item.id;
    card.innerHTML=`<div><strong>${esc(account?.name||item.accountId)}</strong><small>${esc(location?.address||item.reason||'Unscheduled work')}</small><span>${item.estimatedMinutes?`${item.estimatedMinutes} min`:'Duration unset'} · ${esc(item.reason)}</span></div><b>⋮⋮</b>`;
    list.append(card);
    const down=(event:PointerEvent)=>beginPointerDrag(event,item,card,onPlace,visits);card.addEventListener('pointerdown',down);cleanup.push(()=>card.removeEventListener('pointerdown',down));
  }
  return{destroy(){cleanup.forEach(fn=>fn());host.innerHTML='';}};
}
function beginPointerDrag(event:PointerEvent,item:ScheduleQueueItem,card:HTMLElement,onPlace:(input:PlaceQueueItemInput)=>Promise<void>,visits:Visit[]):void{
  if(event.button!==0)return;event.preventDefault(); const rect=card.getBoundingClientRect();
  const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=card.querySelector('strong')?.textContent||'Basket item';document.body.append(ghost);
  const ox=event.clientX-rect.left,oy=event.clientY-rect.top;let moved=false;place(event.clientX,event.clientY);
  const move=(e:PointerEvent)=>{e.preventDefault();moved=true;place(e.clientX,e.clientY);};
  const end=(e:PointerEvent)=>{cleanup();if(!moved)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-schedule-cell]');const date=target?.dataset.date,teamId=target?.dataset.teamId;if(date&&teamId)void onPlace({queueItemId:item.id,date:date as Visit['date'],teamId,sortOrder:nextSortOrder(visits,date,teamId)});};
  const cancel=()=>cleanup(); function place(x:number,y:number){ghost.style.left=`${x-ox}px`;ghost.style.top=`${y-oy}px`;}
  function cleanup(){ghost.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);}
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
}
function esc(v:string):string{return v.replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
