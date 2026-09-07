import type { Account, PlaceQueueItemInput, ScheduleQueueItem, ServiceLocation, Visit } from '../../domain/types.js';
import { nextSortOrder } from '../../domain/schedule.js';

export interface BasketController { destroy():void; }
interface BasketCallbacks{
  selectedQueueItemIds:ReadonlySet<string>;
  onSelectionChange:(queueItemIds:Set<string>)=>void;
  onPlace:(input:PlaceQueueItemInput)=>Promise<void>;
  onPlaceGroup:(inputs:PlaceQueueItemInput[])=>Promise<void>;
}

export function renderBasket(host:HTMLElement,items:ScheduleQueueItem[],accounts:Account[],locations:ServiceLocation[],visits:Visit[],dragEnabled:boolean,callbacks:BasketCallbacks):BasketController{
  const accountById=new Map(accounts.map(a=>[a.id,a]));
  const locationById=new Map(locations.map(s=>[s.id,s]));
  const itemById=new Map(items.map(item=>[item.id,item]));
  const selected=new Set([...callbacks.selectedQueueItemIds].filter(id=>itemById.has(id)));
  host.innerHTML='';
  if(!items.length){
    host.innerHTML='<div class="basket-empty"><strong>Basket empty</strong><p>Drag a visit here when you want to move it out of the week.</p></div>';
    return{destroy(){host.innerHTML='';}};
  }

  const toolbar=document.createElement('div');toolbar.className='basket-selection-toolbar';
  toolbar.innerHTML=`<label class="basket-select-all"><input type="checkbox" data-select-all-queue aria-label="Select all Basket items"><span>Select all</span></label><strong data-basket-selection-count>${selected.size} selected</strong>`;
  host.append(toolbar);

  const list=document.createElement('div');list.className='basket-list';host.append(list);const cleanup:Array<()=>void>=[];
  const syncToolbar=()=>{
    const count=selected.size;
    toolbar.querySelector<HTMLElement>('[data-basket-selection-count]')!.textContent=`${count} selected`;
    const all=toolbar.querySelector<HTMLInputElement>('[data-select-all-queue]')!;
    all.checked=count===items.length&&items.length>0;
    all.indeterminate=count>0&&count<items.length;
  };
  const publishSelection=()=>{syncToolbar();callbacks.onSelectionChange(new Set(selected));};

  for(const item of items){
    const account=accountById.get(item.accountId),location=item.serviceLocationId?locationById.get(item.serviceLocationId):undefined;
    const card=document.createElement('article');
    card.className=`basket-card basket-card-compact${dragEnabled?' basket-draggable':' basket-locked'}${selected.has(item.id)?' basket-multi-selected':''}`;
    card.dataset.queueItemId=item.id;
    const selectControl=dragEnabled?`<label class="basket-select-control" title="Select this Basket item for a group placement"><input type="checkbox" data-select-queue ${selected.has(item.id)?'checked':''} aria-label="Select ${esc(account?.name||item.accountId)} for group placement"><span></span></label>`:'';
    card.innerHTML=`${selectControl}<div><strong>${esc(account?.name||item.accountId)}</strong><small>${esc(location?.address||'Address not linked')}${location?.suburb?` · ${esc(location.suburb)}`:''}</small></div><b title="${dragEnabled?'Drag to calendar':'Turn on Drag mode to place this visit'}">${dragEnabled?'⋮⋮':'•'}</b>`;
    card.title=dragEnabled?'Drag onto a team/day':'Turn on Drag mode to place Basket visits';
    list.append(card);

    const checkbox=card.querySelector<HTMLInputElement>('[data-select-queue]');
    if(checkbox){
      const click=(event:Event)=>event.stopPropagation();
      const change=()=>{if(checkbox.checked)selected.add(item.id);else selected.delete(item.id);card.classList.toggle('basket-multi-selected',checkbox.checked);publishSelection();};
      checkbox.addEventListener('click',click);checkbox.addEventListener('change',change);
      cleanup.push(()=>{checkbox.removeEventListener('click',click);checkbox.removeEventListener('change',change);});
    }

    if(dragEnabled){
      const down=(event:PointerEvent)=>{
        if((event.target as HTMLElement).closest('[data-select-queue]'))return;
        const group=selected.has(item.id)&&selected.size>1?items.filter(row=>selected.has(row.id)):[item];
        beginPointerDrag(event,item,group,card,callbacks.onPlace,callbacks.onPlaceGroup,visits);
      };
      card.addEventListener('pointerdown',down);cleanup.push(()=>card.removeEventListener('pointerdown',down));
    }
  }

  const selectAll=toolbar.querySelector<HTMLInputElement>('[data-select-all-queue]')!;
  const onSelectAll=()=>{
    selected.clear();
    if(selectAll.checked)items.forEach(item=>selected.add(item.id));
    list.querySelectorAll<HTMLInputElement>('[data-select-queue]').forEach(box=>{box.checked=selected.has(box.closest<HTMLElement>('[data-queue-item-id]')?.dataset.queueItemId||'');box.closest('.basket-card')?.classList.toggle('basket-multi-selected',box.checked);});
    publishSelection();
  };
  selectAll.addEventListener('change',onSelectAll);cleanup.push(()=>selectAll.removeEventListener('change',onSelectAll));
  syncToolbar();
  return{destroy(){cleanup.forEach(fn=>fn());host.innerHTML='';}};
}

function beginPointerDrag(event:PointerEvent,item:ScheduleQueueItem,group:ScheduleQueueItem[],card:HTMLElement,onPlace:(input:PlaceQueueItemInput)=>Promise<void>,onPlaceGroup:(inputs:PlaceQueueItemInput[])=>Promise<void>,visits:Visit[]):void{
  if(event.button!==0)return;event.preventDefault();
  const rect=card.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='drag-ghost drag-id-ghost';
  ghost.innerHTML=group.length>1
    ? `<strong>${group.length} Basket items selected</strong><small>Place together · anchor ID ${esc(shortId(item.id))}</small>`
    : `<strong>${esc(card.querySelector('strong')?.textContent||'Basket item')}</strong><small>ID ${esc(shortId(item.id))}</small>`;
  document.body.append(ghost);
  const ox=event.clientX-rect.left,oy=event.clientY-rect.top;let moved=false;place(event.clientX,event.clientY);
  const move=(e:PointerEvent)=>{e.preventDefault();moved=true;place(e.clientX,e.clientY);};
  const end=(e:PointerEvent)=>{
    cleanup();if(!moved)return;
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-schedule-cell]');const date=target?.dataset.date,teamId=target?.dataset.teamId;
    if(!date||!teamId)return;
    const base=nextSortOrder(visits,date,teamId);
    if(group.length>1){
      void onPlaceGroup(group.map((row,index)=>({queueItemId:row.id,date:date as Visit['date'],teamId,sortOrder:base+index*100})));
    }else{
      void onPlace({queueItemId:item.id,date:date as Visit['date'],teamId,sortOrder:base});
    }
  };
  const cancel=()=>cleanup();
  function place(x:number,y:number){ghost.style.left=`${x-ox}px`;ghost.style.top=`${y-oy}px`;}
  function cleanup(){ghost.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);}
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
}
function shortId(value:string):string{const text=String(value||'');return text.length<=8?text:text.slice(-8);}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
