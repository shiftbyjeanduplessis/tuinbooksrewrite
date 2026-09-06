import type { AdditionalVisitInput, ClientServiceHold, MoveVisitInput, PlaceQueueItemInput, ResizeVisitInput, ScheduleDayAction, IsoDate, ScheduleSeries, ScheduleWeek, Visit } from '../../domain/types.js';
import { addDays, startOfWeek, todayIso } from '../../domain/dates.js';
import { buildAdditionalVisit, moveVisitOptimistically, placeQueueItemOptimistically, queueVisitOptimistically, resizeVisitOptimistically } from '../../domain/schedule.js';
import { cancelVisitOptimistically, markMissedOptimistically, removeDayActionOptimistically, rescheduleMissedOptimistically, setClientHoldOptimistically, setSuspendedOptimistically, setVisitDoNotServiceOptimistically, undoCancelOptimistically, upsertDayActionOptimistically, type CancelMode, type DayActionInput, type RescheduleMissedInput } from '../../domain/operations.js';
import { moveSeriesPatternOptimistically } from '../../domain/recurrence.js';
import { renderCalendar, type CalendarController } from './calendar.js';
import { renderBasket, type BasketController } from './basket.js';
import { openAdditionalVisitDialog } from './additionalVisitDialog.js';
import { chooseMoveScope } from './recurrenceScopeDialog.js';
import { openVisitActionDialog } from './visitActionDialog.js';
import { openDayActionDialog } from './dayActionDialog.js';
import { demoWeek } from './demoData.js';
import { loadWeek, persistAdditionalVisit, persistCancelVisit, persistClientHold, persistDayAction, persistMarkMissed, persistQueuePlacement, persistRemoveDayAction, persistRescheduleMissed, persistSuspension, persistUndoCancel, persistVisitDoNotService, persistVisitMove, persistVisitResize, persistVisitToBasket } from './scheduleRepository.js';
import { mountWorkspace, type WorkspaceIdentity, type WorkspaceNavigation } from '../shell/chrome.js';

export type ScheduleIdentity=WorkspaceIdentity;

export function renderSchedulePage(root:HTMLElement,identity:ScheduleIdentity,navigation:WorkspaceNavigation):void{
  const page=mountWorkspace(root,identity,'schedule',navigation,'schedule-page');
  page.innerHTML=`
    <section class="page-heading schedule-toolbar">
      <div>
        <p class="eyebrow">Live scheduling board</p>
        <h1>Schedule</h1>
        <p id="weekTitle">Loading selected week…</p>
      </div>
      <div class="heading-actions toolbar-actions">
        <button class="button secondary compact" id="prevWeek">← Previous</button>
        <button class="button secondary" id="todayWeek">Today</button>
        <button class="button secondary compact" id="nextWeek">Next →</button>
        <button class="button secondary" id="refreshWeek">Refresh</button>
        <button class="button secondary schedule-basket-toggle" id="basketToggle">Basket <span id="basketCount">0</span></button>
      </div>
    </section>
    <section class="schedule-week-navigation" aria-label="Rolling schedule weeks">
      <div id="rollingWeekCards" class="rolling-week-strip-v2"></div>
      <div class="schedule-drag-controls">
        <span class="rearrange-mode-label hidden" id="rearrangeModeLabel">REARRANGE WEEK</span>
        <button type="button" class="button secondary compact schedule-drag-toggle" id="dragModeToggle">↔ Drag mode</button>
      </div>
    </section>
    <div id="pageError" class="error-box hidden" role="alert"></div>
    <div id="saveIndicator" class="save-indicator hidden">Saving…</div>
    <section class="schedule-legend compact-schedule-legend">
      <div><span class="legend-marker recurring">R</span>Recurring</div>
      <div><span class="legend-marker additional">A</span>Additional visit</div>
      <div><span class="legend-marker quoted">Q</span>Quoted work</div>
      <div><span class="legend-status missed"></span>Missed / attention</div>
      <div><span class="legend-status dns"></span>Do not service</div>
      <p id="scheduleModeHelp">Schedule is locked. Turn on <strong>Drag mode</strong> when you want to rearrange visits.</p>
    </section>
    <div class="schedule-layout" id="scheduleLayout">
      <aside class="basket-panel floating-basket" id="floatingBasket" data-basket-drop="1" aria-label="Unscheduled work Basket">
        <div class="basket-header basket-drag-handle" id="basketDragHandle">
          <div><p class="eyebrow">Basket</p><strong>Unscheduled work</strong></div>
          <div class="basket-window-actions">
            <button type="button" id="minimizeBasket" aria-label="Minimize basket" title="Minimize Basket">−</button>
            <button type="button" id="closeBasket" aria-label="Tuck basket away" title="Tuck Basket away">×</button>
          </div>
        </div>
        <div id="basketHost" class="basket-body"></div>
      </aside>
      <button id="openBasket" class="basket-launcher hidden" aria-label="Open Basket"><span>Basket</span><b id="basketStripCount">0</b></button>
      <section class="calendar-panel"><div id="calendarHost" class="loading-state">Loading this week…</div></section>
    </div>`;

  let weekStart=startOfWeek(todayIso());
  let data:ScheduleWeek|null=null;
  let calendar:CalendarController|null=null;
  let basketController:BasketController|null=null;
  let saves=0;
  let dragMode=false;

  const host=root.querySelector<HTMLElement>('#calendarHost')!;
  const basketHost=root.querySelector<HTMLElement>('#basketHost')!;
  const errorBox=root.querySelector<HTMLElement>('#pageError')!;
  const saveIndicator=root.querySelector<HTMLElement>('#saveIndicator')!;
  const dragToggle=root.querySelector<HTMLButtonElement>('#dragModeToggle')!;
  const rearrangeModeLabel=root.querySelector<HTMLElement>('#rearrangeModeLabel')!;
  const modeHelp=root.querySelector<HTMLElement>('#scheduleModeHelp')!;

  const updateTitle=()=>{
    const end=addDays(weekStart,6);
    const a=new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
    const b=new Date(`${end}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
    root.querySelector<HTMLElement>('#weekTitle')!.textContent=`${a} – ${b}`;
  };
  const showError=(message='')=>{errorBox.textContent=message;errorBox.classList.toggle('hidden',!message);};
  const showSaving=()=>saveIndicator.classList.toggle('hidden',saves===0);

  const renderDragChrome=()=>{
    page.classList.toggle('rearrange-mode',dragMode);
    dragToggle.classList.toggle('active',dragMode);
    dragToggle.classList.toggle('secondary',!dragMode);
    dragToggle.textContent=dragMode?'✓ Done rearranging':'↔ Drag mode';
    rearrangeModeLabel.classList.toggle('hidden',!dragMode);
    modeHelp.innerHTML=dragMode
      ? `Rearrange mode is on. Drag visits between days/teams or to and from the Basket. Recurring visits ask <strong>This visit</strong> or <strong>This + future</strong> when you drop them.`
      : `Normal mode is for day-to-day operations. Turn on <strong>Drag mode</strong> only when you want to rearrange the week.`;
  };

  const rollingStarts=():IsoDate[]=>{
    const current=startOfWeek(todayIso());
    let start=addDays(current,-7);
    const defaultEnd=addDays(start,49);
    if(weekStart<start||weekStart>defaultEnd)start=addDays(weekStart,-7);
    return Array.from({length:8},(_,index)=>addDays(start,index*7));
  };
  const weekLabel=(value:IsoDate):string=>{
    const current=startOfWeek(todayIso());
    if(value===current)return 'This week';
    if(value===addDays(current,7))return 'Next week';
    if(value===addDays(current,-7))return 'Last week';
    return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
  };
  const renderWeekCards=()=>{
    const strip=root.querySelector<HTMLElement>('#rollingWeekCards')!;
    strip.innerHTML=rollingStarts().map(start=>{
      const end=addDays(start,6),selected=start===weekStart;
      const count=selected&&data?`${data.visits.length} visits`:new Date(`${end}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
      return `<button type="button" class="rolling-week-card-v2${selected?' active':''}" data-week-start="${esc(start)}"><span>${esc(weekLabel(start))}</span><strong>${esc(count)}</strong></button>`;
    }).join('');
    strip.querySelectorAll<HTMLButtonElement>('[data-week-start]').forEach(button=>button.onclick=()=>{const start=button.dataset.weekStart;if(!start||start===weekStart)return;weekStart=start as IsoDate;void fetchWeek();});
  };

  const render=()=>{
    calendar?.destroy();
    basketController?.destroy();
    if(!data)return;
    host.classList.remove('loading-state');
    renderWeekCards();
    renderDragChrome();
    root.querySelector<HTMLElement>('#basketCount')!.textContent=String(data.queueItems.length);root.querySelector<HTMLElement>('#basketStripCount')!.textContent=String(data.queueItems.length);
    calendar=renderCalendar(host,data,{
      dragEnabled:dragMode,
      onMove:moveVisit,
      onQueue:queueVisit,
      onResize:resizeVisit,
      onAdd:openAdditional,
      onVisitAction:openVisitActions,
      onDayAction:openDayAction,
    });
    basketController=renderBasket(basketHost,data.queueItems,data.accounts,data.locations,data.visits,dragMode,placeQueueItem);
  };

  async function fetchWeek(){
    updateTitle();renderWeekCards();showError();
    host.className='loading-state';host.textContent='Loading this week…';
    try{data=identity.demo?demoWeek(weekStart):await loadWeek(identity.businessId,weekStart);render();}
    catch(error){showError(msg(error));host.textContent='Calendar could not be loaded.';}
  }

  async function saveOptimistic(before:ScheduleWeek,work:()=>Promise<unknown>){
    if(identity.demo)return true;
    saves++;showSaving();
    try{await work();return true;}
    catch(error){data=before;render();showError(`Change was not saved. The previous schedule was restored. ${msg(error)}`);return false;}
    finally{saves=Math.max(0,saves-1);showSaving();}
  }

  async function moveVisit(proposed:MoveVisitInput){
    if(!data)return;
    const visit=data.visits.find(row=>row.id===proposed.visitId);if(!visit)return;
    let move={...proposed,scope:proposed.scope??'one'} as MoveVisitInput;
    const series=visit.seriesId?data.series.find(row=>row.id===visit.seriesId):undefined;
    if(series&&visit.seriesSlotId&&visit.occurrenceDate&&!proposed.scope){
      const scope=await chooseMoveScope(visit,series);if(!scope)return;move={...proposed,scope};
    }
    const before=data;
    try{
      let nextSeries=data.series;
      if(move.scope==='future'&&series&&visit.seriesSlotId&&visit.occurrenceDate){
        const changed=moveSeriesPatternOptimistically(series,visit.seriesSlotId,visit.occurrenceDate,move.date,move.teamId);
        nextSeries=data.series.map(row=>row.id===series.id?changed:row);
      }
      data={...data,series:nextSeries,visits:moveVisitOptimistically(data.visits,move)};render();
    }catch(error){showError(msg(error));return;}
    const saved=await saveOptimistic(before,()=>persistVisitMove(identity.businessId,move));
    if(saved&&move.scope==='future'&&!identity.demo)await fetchWeek();
  }
  async function resizeVisit(input:ResizeVisitInput){if(!data)return;const before=data;data={...data,visits:resizeVisitOptimistically(data.visits,input)};render();await saveOptimistic(before,()=>persistVisitResize(identity.businessId,input));}
  async function queueVisit(visitId:string){if(!data)return;const before=data,next=queueVisitOptimistically(data.visits,data.queueItems,visitId);data={...data,...next};render();await saveOptimistic(before,()=>persistVisitToBasket(identity.businessId,visitId));}
  async function placeQueueItem(input:PlaceQueueItemInput){if(!data)return;const before=data,next=placeQueueItemOptimistically(data.visits,data.queueItems,input.queueItemId,input.date,input.teamId,input.sortOrder);data={...data,...next};render();await saveOptimistic(before,()=>persistQueuePlacement(identity.businessId,input));}
  async function openAdditional(date:AdditionalVisitInput['date'],teamId:string,_index:number,sortOrder:number){if(!data)return;openAdditionalVisitDialog({businessId:identity.businessId,date,teamId,sortOrder,accounts:data.accounts,locations:data.locations},createAdditional);}
  async function createAdditional(input:AdditionalVisitInput){if(!data)return;const before=data,visit=buildAdditionalVisit(input,identity.businessId);data={...data,visits:[...data.visits,visit]};render();const saved=await saveOptimistic(before,()=>persistAdditionalVisit(identity.businessId,input));if(saved&&!data.accounts.some(a=>a.id===input.accountId)&&!identity.demo)await fetchWeek();}
  function openVisitActions(visit:Visit,account:any,hold:ClientServiceHold|null){if(!data)return;openVisitActionDialog(visit,account,data.teams,hold,{onCancel:cancelVisit,onUndoCancel:undoCancel,onMissed:markMissed,onReschedule:rescheduleMissed,onSuspend:setSuspension,onVisitDoNotService:setVisitDoNotService,onClientHold:setClientHold});}
  async function cancelVisit(visitId:string,mode:CancelMode,reason:string){if(!data)return;const before=data;data={...data,visits:cancelVisitOptimistically(data.visits,visitId,mode,reason)};render();await saveOptimistic(before,()=>persistCancelVisit(identity.businessId,visitId,mode,reason));}
  async function undoCancel(visitId:string){if(!data)return;const before=data;data={...data,visits:undoCancelOptimistically(data.visits,visitId)};render();await saveOptimistic(before,()=>persistUndoCancel(identity.businessId,visitId));}
  async function markMissed(visitId:string,reason:string){if(!data)return;const before=data;data={...data,visits:markMissedOptimistically(data.visits,visitId,reason)};render();await saveOptimistic(before,()=>persistMarkMissed(identity.businessId,visitId,reason));}
  async function rescheduleMissed(input:RescheduleMissedInput){if(!data)return;const before=data;data={...data,visits:rescheduleMissedOptimistically(data.visits,input)};render();const saved=await saveOptimistic(before,()=>persistRescheduleMissed(identity.businessId,input));if(saved&&!identity.demo&&(input.date<weekStart||input.date>addDays(weekStart,6)))await fetchWeek();}
  async function setSuspension(visitIds:string[],suspended:boolean,reason:string){if(!data)return;const before=data;data={...data,visits:setSuspendedOptimistically(data.visits,visitIds,suspended,reason)};render();await saveOptimistic(before,()=>persistSuspension(identity.businessId,visitIds,suspended,reason));}
  async function setVisitDoNotService(visitId:string,active:boolean,reason:string,note:string){if(!data)return;const before=data;data={...data,visits:setVisitDoNotServiceOptimistically(data.visits,visitId,active,reason,note)};render();await saveOptimistic(before,()=>persistVisitDoNotService(identity.businessId,visitId,active,reason,note));}
  async function setClientHold(clientId:string,active:boolean,reason:string,note:string){if(!data)return;const before=data;data={...data,clientHolds:setClientHoldOptimistically(data.clientHolds,identity.businessId,clientId,active,reason,note)};render();await saveOptimistic(before,()=>persistClientHold(identity.businessId,clientId,active,reason,note));}
  function openDayAction(kind:'team_note'|'internal_event',date:ScheduleWeek['weekStart'],teamId:string,existing:ScheduleDayAction|null){if(!data)return;openDayActionDialog(kind,date,teamId,data.teams,existing,saveDayAction,removeDayAction);}
  async function saveDayAction(input:DayActionInput){if(!data)return;const before=data;data={...data,dayActions:upsertDayActionOptimistically(data.dayActions,identity.businessId,input)};render();await saveOptimistic(before,()=>persistDayAction(identity.businessId,input));}
  async function removeDayAction(actionId:string){if(!data)return;const before=data;data={...data,dayActions:removeDayActionOptimistically(data.dayActions,actionId)};render();await saveOptimistic(before,()=>persistRemoveDayAction(identity.businessId,actionId));}

  page.querySelector<HTMLButtonElement>('#prevWeek')!.onclick=()=>{weekStart=addDays(weekStart,-7);void fetchWeek();};
  page.querySelector<HTMLButtonElement>('#todayWeek')!.onclick=()=>{weekStart=startOfWeek(todayIso());void fetchWeek();};
  page.querySelector<HTMLButtonElement>('#nextWeek')!.onclick=()=>{weekStart=addDays(weekStart,7);void fetchWeek();};
  page.querySelector<HTMLButtonElement>('#refreshWeek')!.onclick=()=>void fetchWeek();
  dragToggle.onclick=()=>{dragMode=!dragMode;if(dragMode)setBasketState('open');render();};

  const basket=page.querySelector<HTMLElement>('#floatingBasket')!;
  const launcher=page.querySelector<HTMLButtonElement>('#openBasket')!;
  const basketToggle=page.querySelector<HTMLButtonElement>('#basketToggle')!;
  const minimizeButton=page.querySelector<HTMLButtonElement>('#minimizeBasket')!;
  const dragHandle=page.querySelector<HTMLElement>('#basketDragHandle')!;
  type BasketWindowState='open'|'minimized'|'tucked';
  const basketStateKey='tuinbooks.schedule.basket.state';
  const basketPositionKey='tuinbooks.schedule.basket.position';
  let basketWindowState:BasketWindowState=(localStorage.getItem(basketStateKey) as BasketWindowState)||'open';
  const setBasketState=(state:BasketWindowState)=>{
    basketWindowState=state;localStorage.setItem(basketStateKey,state);
    basket.classList.toggle('hidden',state==='tucked');
    basket.classList.toggle('minimized',state==='minimized');
    launcher.classList.toggle('hidden',state!=='tucked');
    basketToggle.classList.toggle('active',state!=='tucked');
    minimizeButton.textContent=state==='minimized'?'□':'−';
    minimizeButton.title=state==='minimized'?'Restore Basket':'Minimize Basket';
    minimizeButton.setAttribute('aria-label',minimizeButton.title);
  };
  const restoreBasketPosition=()=>{
    try{const raw=localStorage.getItem(basketPositionKey);if(!raw)return;const pos=JSON.parse(raw) as {left?:number;top?:number};if(Number.isFinite(pos.left))basket.style.left=`${Math.max(0,Math.min(Number(pos.left),window.innerWidth-Math.min(320,window.innerWidth-20)))}px`;if(Number.isFinite(pos.top))basket.style.top=`${Math.max(68,Math.min(Number(pos.top),window.innerHeight-54))}px`;}catch(_){ }
  };
  const storeBasketPosition=()=>{const rect=basket.getBoundingClientRect();localStorage.setItem(basketPositionKey,JSON.stringify({left:Math.round(rect.left),top:Math.round(rect.top)}));};
  const tuckBasket=()=>setBasketState('tucked');
  const openBasket=()=>setBasketState('open');
  const toggleMinimizeBasket=()=>setBasketState(basketWindowState==='minimized'?'open':'minimized');
  page.querySelector<HTMLButtonElement>('#closeBasket')!.onclick=tuckBasket;
  minimizeButton.onclick=toggleMinimizeBasket;
  launcher.onclick=openBasket;
  basketToggle.onclick=()=>basketWindowState==='tucked'?openBasket():tuckBasket();
  dragHandle.addEventListener('pointerdown',event=>{
    if(event.button!==0||(event.target as HTMLElement).closest('button'))return;
    event.preventDefault();
    if(basketWindowState==='tucked')return;
    const rect=basket.getBoundingClientRect(),offsetX=event.clientX-rect.left,offsetY=event.clientY-rect.top;
    basket.classList.add('basket-moving');
    const move=(e:PointerEvent)=>{const width=basket.getBoundingClientRect().width;const maxLeft=Math.max(0,window.innerWidth-width);const maxTop=Math.max(68,window.innerHeight-48);basket.style.left=`${Math.max(0,Math.min(e.clientX-offsetX,maxLeft))}px`;basket.style.top=`${Math.max(68,Math.min(e.clientY-offsetY,maxTop))}px`;};
    const end=()=>{basket.classList.remove('basket-moving');storeBasketPosition();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});
  });
  window.addEventListener('resize',()=>{const rect=basket.getBoundingClientRect();if(rect.right>window.innerWidth)basket.style.left=`${Math.max(0,window.innerWidth-rect.width-8)}px`;if(rect.bottom>window.innerHeight&&basketWindowState==='minimized')basket.style.top=`${Math.max(68,window.innerHeight-54)}px`;storeBasketPosition();});

  restoreBasketPosition();setBasketState(basketWindowState);renderWeekCards();renderDragChrome();void fetchWeek();
}

function msg(error:unknown):string{return error instanceof Error?error.message:(error&&typeof error==='object'&&'message' in error?String((error as any).message):String(error));}
function esc(v:string):string{return v.replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
