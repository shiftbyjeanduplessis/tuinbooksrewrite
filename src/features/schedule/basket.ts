import type { Account, PlaceQueueItemInput, ScheduleQueueItem, ServiceLocation, Visit } from '../../domain/types.js';
import { nextSortOrder } from '../../domain/schedule.js';

export interface BasketController { destroy():void; }
export function renderBasket(host:HTMLElement,items:ScheduleQueueItem[],accounts:Account[],locations:ServiceLocation[],visits:Visit[],onPlace:(input:PlaceQueueItemInput)=>Promise<void>):BasketController{
  const accountById=new Map(accounts.map(a=>[a.id,a])); const locationById=new Map(locations.map(s=>[s.id,s]));
  host.innerHTML='';
  const summary=document.createElement('div');summary.className='basket-summary';
  const routine=items.filter(i=>i.visitType==='routine').length,additional=items.filter(i=>i.visitType==='additional').length,quoted=items.filter(i=>i.visitType==='quoted').length;
  summary.innerHTML=`<div><strong>${items.length}</strong><span>waiting</span></div><div><strong>${routine}</strong><span>routine</span></div><div><strong>${additional+quoted}</strong><span>extra / quoted</span></div>`;host.append(summary);
  if(!items.length){host.insertAdjacentHTML('beforeend','<div class="basket-empty"><strong>Basket empty</strong><p>Move a visit here or add accepted/unscheduled work.</p></div>');return{destroy(){host.innerHTML='';}};}
  const list=document.createElement('div');list.className='basket-list';host.append(list);const cleanup:Array<()=>void>=[];
  for(const item of items){
    const account=accountById.get(item.accountId),location=item.serviceLocationId?locationById.get(item.serviceLocationId):undefined,type=typeLabel(item);
    const card=document.createElement('article');card.className=`basket-card basket-${item.visitType}`;card.dataset.queueItemId=item.id;
    card.innerHTML=`<span class="basket-marker ${item.visitType}">${marker(item)}</span><div><strong>${esc(account?.name||item.accountId)}</strong><small>${esc(location?.address||'Address not linked')}${location?.suburb?` · ${esc(location.suburb)}`:''}</small><span>${esc(type)} · ${item.estimatedMinutes?`${item.estimatedMinutes} min`:'duration unset'}</span><em>${esc(item.reason||'Unscheduled work')}</em></div><b title="Drag to calendar">⋮⋮</b>`;
    list.append(card);const down=(event:PointerEvent)=>beginPointerDrag(event,item,card,onPlace,visits);card.addEventListener('pointerdown',down);cleanup.push(()=>card.removeEventListener('pointerdown',down));
  }
  return{destroy(){cleanup.forEach(fn=>fn());host.innerHTML='';}};
}
function beginPointerDrag(event:PointerEvent,item:ScheduleQueueItem,card:HTMLElement,onPlace:(input:PlaceQueueItemInput)=>Promise<void>,visits:Visit[]):void{
  if(event.button!==0)return;event.preventDefault(); const rect=card.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=card.querySelector('strong')?.textContent||'Basket item';document.body.append(ghost);
  const ox=event.clientX-rect.left,oy=event.clientY-rect.top;let moved=false;place(event.clientX,event.clientY);const move=(e:PointerEvent)=>{e.preventDefault();moved=true;place(e.clientX,e.clientY);};
  const end=(e:PointerEvent)=>{cleanup();if(!moved)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-schedule-cell]');const date=target?.dataset.date,teamId=target?.dataset.teamId;if(date&&teamId)void onPlace({queueItemId:item.id,date:date as Visit['date'],teamId,sortOrder:nextSortOrder(visits,date,teamId)});};
  const cancel=()=>cleanup(); function place(x:number,y:number){ghost.style.left=`${x-ox}px`;ghost.style.top=`${y-oy}px`;} function cleanup(){ghost.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);}
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
}
function marker(item:ScheduleQueueItem):string{return item.visitType==='additional'?'A':item.visitType==='quoted'?'Q':item.visitType==='once-off'?'1×':'R';}
function typeLabel(item:ScheduleQueueItem):string{return item.visitType==='additional'?'Additional visit':item.visitType==='quoted'?'Accepted quoted work':item.visitType==='once-off'?'Once-off work':'Recurring visit';}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
