import type { Account, ClientServiceHold, IsoDate, MoveVisitInput, ResizeVisitInput, ScheduleDayAction, ScheduleSeries, ScheduleWeek, ServiceLocation, Team, Visit } from '../../domain/types.js';
import { activeHold, actionsForCell, visitDoNotService } from '../../domain/operations.js';
import { locationForVisit, nextSortOrder, normaliseDuration, visitsForCell } from '../../domain/schedule.js';
import { recurrenceLabel } from '../../domain/recurrence.js';
import { todayIso, weekDays } from '../../domain/dates.js';

export interface CalendarController { destroy(): void; }
interface CalendarCallbacks{
  dragEnabled:boolean;
  selectedVisitIds:ReadonlySet<string>;
  onSelectionChange:(visitIds:Set<string>)=>void;
  onMove:(move:MoveVisitInput)=>Promise<void>;
  onMoveGroup:(moves:MoveVisitInput[])=>Promise<void>;
  onQueue:(visitId:string)=>Promise<void>;
  onQueueGroup:(visitIds:string[])=>Promise<void>;
  onResize:(input:ResizeVisitInput)=>Promise<void>;
  onAdd:(date:IsoDate,teamId:string,index:number,sortOrder:number)=>void;
  onVisitAction:(visit:Visit,account:Account|undefined,hold:ClientServiceHold|null)=>void;
  onDayAction:(kind:'team_note'|'internal_event',date:IsoDate,teamId:string,existing:ScheduleDayAction|null)=>void;
}

export function renderCalendar(container:HTMLElement,data:ScheduleWeek,callbacks:CalendarCallbacks):CalendarController{
  container.innerHTML='';
  const scroll=document.createElement('div');scroll.className='calendar-scroll';
  const grid=document.createElement('div');grid.className=`calendar-grid schedule-parity-board${callbacks.dragEnabled?' drag-mode-active':''}`;scroll.append(grid);container.append(scroll);
  const accountById=new Map<string,Account>(data.accounts.map(a=>[a.id,a]));
  const seriesById=new Map<string,ScheduleSeries>(data.series.map(s=>[s.id,s]));
  const days=weekDays(data.weekStart),today=todayIso(),cleanup:Array<()=>void>=[];
  const selected=new Set(callbacks.selectedVisitIds);
  const movable=(visit:Visit)=>!['completed','cancelled','rescheduled','suspended'].includes(String(visit.status).toLowerCase());
  for(const id of [...selected])if(!data.visits.some(v=>v.id===id&&movable(v)))selected.delete(id);

  const corner=document.createElement('div');corner.className='calendar-corner';
  corner.innerHTML='<strong>Teams</strong><small>Route order</small>';grid.append(corner);

  for(const day of days){
    const rows=data.visits.filter(v=>v.date===day&&String(v.status).toLowerCase()!=='cancelled');
    const d=new Date(`${day}T12:00:00`),h=document.createElement('div');
    h.className=`day-header${day===today?' today':''}`;
    h.innerHTML=`<div class="day-heading-main"><span>${d.toLocaleDateString(undefined,{weekday:'short'})}</span><strong>${d.getDate()}</strong></div><div class="day-heading-meta"><small>${rows.length} visit${rows.length===1?'':'s'}</small></div>`;
    grid.append(h);
  }

  for(const [teamIndex,team] of data.teams.entries()){
    const teamTheme=teamColour(teamIndex);
    const teamWeek=data.visits.filter(v=>v.teamId===team.id&&String(v.status).toLowerCase()!=='cancelled');
    const completed=teamWeek.filter(v=>String(v.status).toLowerCase()==='completed').length;
    const label=document.createElement('div');label.className='team-label';
    applyTeamColour(label,teamTheme);
    label.innerHTML=`<div class="team-label-name"><span class="team-dot"></span><strong>${esc(team.name)}</strong></div><small>${teamWeek.length} scheduled${completed?` · ${completed} done`:''}</small>`;
    grid.append(label);

    for(const day of days){
      const cell=document.createElement('div');
      const rows=visitsForCell(data.visits,day,team.id);
      const visibleRows=rows.filter(v=>String(v.status).toLowerCase()!=='cancelled');
      const completedToday=visibleRows.filter(v=>String(v.status).toLowerCase()==='completed').length;
      cell.className=`schedule-cell${day===today?' today':''}${visibleRows.length>14?' very-dense':visibleRows.length>8?' dense':''}`;
      applyTeamColour(cell,teamTheme);
      cell.dataset.scheduleCell='1';cell.dataset.date=day;cell.dataset.teamId=team.id;

      const cellSummary=document.createElement('div');cellSummary.className='schedule-cell-summary';
      cellSummary.innerHTML=`<span><strong>${visibleRows.length}</strong> job${visibleRows.length===1?'':'s'}${completedToday?` · ${completedToday} done`:''}</span>`;
      cell.append(cellSummary);

      const actionBar=document.createElement('div');actionBar.className='day-action-bar day-action-buttons';
      actionBar.innerHTML='<button type="button" class="day-mini-button" data-new-note>Note</button><button type="button" class="day-mini-button" data-new-event>Event</button><button type="button" class="day-mini-button additional" data-new-additional>+ Visit</button>';
      actionBar.querySelector<HTMLButtonElement>('[data-new-note]')!.onclick=e=>{e.stopPropagation();callbacks.onDayAction('team_note',day,team.id,null);};
      actionBar.querySelector<HTMLButtonElement>('[data-new-event]')!.onclick=e=>{e.stopPropagation();callbacks.onDayAction('internal_event',day,team.id,null);};
      actionBar.querySelector<HTMLButtonElement>('[data-new-additional]')!.onclick=e=>{e.stopPropagation();callbacks.onAdd(day,team.id,rows.length,nextSortOrder(data.visits,day,team.id));};
      cell.append(actionBar);

      for(const action of actionsForCell(data.dayActions,day,team.id)){
        const node=document.createElement('button');node.type='button';node.className=`day-action day-action-${action.kind}`;
        node.innerHTML=`<span>${action.kind==='team_note'?'NOTE':esc(action.time||'EVENT')}</span><strong>${esc(action.kind==='team_note'?action.detail:action.title)}</strong>`;
        node.onclick=e=>{e.stopPropagation();callbacks.onDayAction(action.kind,day,team.id,action);};cell.append(node);
      }

      rows.forEach((visit,index)=>{
        const account=accountById.get(visit.accountId),hold=activeHold(data.clientHolds,visit.accountId);
        cell.append(makeVisitCard(
          visit,index+1,team,account,locationForVisit(visit,data.locations),
          visit.seriesId?seriesById.get(visit.seriesId):undefined,hold,
          callbacks.dragEnabled,selected.has(visit.id),beginDrag,callbacks.onResize,()=>callbacks.onVisitAction(visit,account,hold),
          checked=>{if(checked)selected.add(visit.id);else selected.delete(visit.id);callbacks.onSelectionChange(new Set(selected));},
        ));
      });
      grid.append(cell);
    }
  }

  let drag:{visit:Visit;route:number;visitIds:string[];ghost:HTMLElement;offsetX:number;offsetY:number;moved:boolean}|null=null;
  function beginDrag(event:PointerEvent,visit:Visit,route:number,card:HTMLElement):void{
    if(!callbacks.dragEnabled||event.button!==0||(event.target as HTMLElement).closest('[data-resize-handle],[data-select-visit],[data-visit-info-hover]')||!movable(visit))return;
    event.preventDefault();
    const selectedGroup=selected.has(visit.id)&&selected.size>1
      ? data.visits.filter(v=>selected.has(v.id)&&movable(v)).sort(groupSort)
      : [visit];
    const visitIds=selectedGroup.map(v=>v.id);
    const r=card.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='drag-ghost drag-id-ghost';
    const name=accountById.get(visit.accountId)?.name??visit.accountId;
    ghost.innerHTML=visitIds.length>1
      ? `<strong>${visitIds.length} visits selected</strong><small>Move together · anchor #${route} · ID ${esc(shortId(visit.id))}</small>`
      : `<strong>#${route} · ${esc(name)}</strong><small>ID ${esc(shortId(visit.id))}</small>`;
    document.body.append(ghost);drag={visit,route,visitIds,ghost,offsetX:event.clientX-r.left,offsetY:event.clientY-r.top,moved:false};place(event.clientX,event.clientY);
    const move=(e:PointerEvent)=>{if(!drag)return;e.preventDefault();drag.moved=true;place(e.clientX,e.clientY);};
    const end=(e:PointerEvent)=>{
      if(!drag)return;const current=drag;drag=null;current.ghost.remove();unwire();if(!current.moved)return;
      const el=document.elementFromPoint(e.clientX,e.clientY);
      if(el?.closest('[data-basket-drop]')){
        if(current.visitIds.length>1)void callbacks.onQueueGroup(current.visitIds);
        else void callbacks.onQueue(current.visit.id);
        return;
      }
      const target=el?.closest<HTMLElement>('[data-schedule-cell]');const date=target?.dataset.date,teamId=target?.dataset.teamId;
      if(date&&teamId){
        const base=nextSortOrder(data.visits.filter(v=>!current.visitIds.includes(v.id)),date,teamId);
        if(current.visitIds.length>1){
          const group=data.visits.filter(v=>current.visitIds.includes(v.id)).sort(groupSort);
          void callbacks.onMoveGroup(group.map((v,index)=>({visitId:v.id,date:date as IsoDate,teamId,sortOrder:base+index*100,scope:'one'})));
        }else void callbacks.onMove({visitId:current.visit.id,date:date as IsoDate,teamId,sortOrder:base});
      }
    };
    const cancel=()=>{if(drag){drag.ghost.remove();drag=null;}unwire();};
    const unwire=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);};
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancel,{once:true});cleanup.push(unwire);
  }
  function groupSort(a:Visit,b:Visit):number{
    const teamA=data.teams.findIndex(t=>t.id===a.teamId),teamB=data.teams.findIndex(t=>t.id===b.teamId);
    return String(a.date).localeCompare(String(b.date))||teamA-teamB||a.sortOrder-b.sortOrder||a.id.localeCompare(b.id);
  }
  function place(x:number,y:number){if(!drag)return;drag.ghost.style.left=`${x-drag.offsetX}px`;drag.ghost.style.top=`${y-drag.offsetY}px`;}
  return{destroy(){cleanup.forEach(fn=>fn());if(drag?.ghost)drag.ghost.remove();container.innerHTML='';}};
}

function makeVisitCard(visit:Visit,route:number,team:Team,account:Account|undefined,location:ServiceLocation|null,series:ScheduleSeries|undefined,hold:ClientServiceHold|null,dragEnabled:boolean,isSelected:boolean,begin:(e:PointerEvent,v:Visit,r:number,c:HTMLElement)=>void,onResize:(input:ResizeVisitInput)=>Promise<void>,onAction:()=>void,onSelect:(checked:boolean)=>void):HTMLElement{
  const status=String(visit.status).toLowerCase(),locked=['completed','cancelled','rescheduled','suspended'].includes(status),card=document.createElement('article');
  const visitDns=visitDoNotService(visit),dnsActive=visitDns.active||!!hold;
  card.className=`visit-card visit-${visit.visitType} status-${status}${visit.recurrenceManualOverride?' recurrence-exception':''}${dnsActive?' do-not-service':''}${visitDns.active?' visit-do-not-service':''}${hold?' client-do-not-service':''}${dragEnabled&&!locked?' drag-enabled':''}${isSelected?' multi-selected':''}`;card.dataset.visitId=visit.id;
  card.style.setProperty('--visit-height',`${Math.max(48,Math.min(110,48+Math.max(0,visit.estimatedMinutes-60)/15*3))}px`);
  const duration=visit.estimatedMinutes?`${visit.estimatedMinutes} min`:'Duration unset',type=visitTypeLabel(visit),statusInfo=statusLabel(status);
  const recurrence=series?recurrenceLabel(series):'';
  const task=taskSummary(visit.payload),notes=notesSummary(visit.payload);
  const badges=[visit.visitType==='additional'?'<span class="visit-badge">A</span>':'',visit.visitType==='quoted'?'<span class="visit-badge quoted">Q</span>':'',series?`<span class="recurrence-badge" title="${esc(recurrence)}${visit.recurrenceManualOverride?' · this visit is a manual exception':''}">↻</span>`:'',visitDns.active?'<span class="dns-badge visit-dns-badge" title="Do not service this visit">DNS</span>':hold?'<span class="dns-badge" title="Client do not service">DNS</span>':'',status!=='scheduled'?`<span class="status-badge-v2 ${esc(statusInfo.key)}">${esc(statusInfo.label.toUpperCase())}</span>`:''].join('');
  const taskLine=task?`<div class="visit-task" title="${esc(task)}">${esc(task)}</div>`:'';
  const selectControl=dragEnabled&&!locked?`<label class="visit-select-control" title="Select this visit for a group move"><input type="checkbox" data-select-visit ${isSelected?'checked':''} aria-label="Select ${esc(account?.name??visit.accountId)} for group move"><span></span></label>`:'';
  const hover=visitHoverInfo(visit,route,team,account,location,series,hold,task,notes);
  card.innerHTML=`${selectControl}<div class="visit-card-topline"><span class="visit-route" title="Route order">${route}</span><strong title="${esc(account?.name??visit.accountId)}">${esc(account?.name??visit.accountId)}</strong><span class="visit-badges">${badges}<span data-visit-info-hover class="visit-info-hover" tabindex="0" aria-label="Hover for visit information">i<span class="visit-hover-card" role="tooltip">${hover}</span></span></span></div><div class="visit-location" title="${esc([location?.address,location?.suburb].filter(Boolean).join(' · ')||'Address not linked')}">${esc(location?.address||'Address not linked')}${location?.suburb?`<span class="visit-suburb-inline"> · ${esc(location.suburb)}</span>`:''}</div>${taskLine}<div class="visit-card-footer"><span>${esc(type)}</span><b>${duration}</b></div>${!locked&&dragEnabled?'<span class="resize-handle" data-resize-handle title="Drag to change duration"></span>':''}`;
  card.addEventListener('pointerdown',e=>begin(e,visit,route,card));
  const checkbox=card.querySelector<HTMLInputElement>('[data-select-visit]');
  if(checkbox){checkbox.onclick=e=>e.stopPropagation();checkbox.onchange=()=>{card.classList.toggle('multi-selected',checkbox.checked);onSelect(checkbox.checked);};}
  card.addEventListener('click',e=>{if(dragEnabled||(e.target as HTMLElement).closest('[data-resize-handle],[data-select-visit]'))return;onAction();});
  const handle=card.querySelector<HTMLElement>('[data-resize-handle]');
  if(handle)handle.addEventListener('pointerdown',event=>{
    event.preventDefault();event.stopPropagation();const startY=event.clientY,start=visit.estimatedMinutes||60;let current=start;
    const move=(e:PointerEvent)=>{e.preventDefault();current=normaliseDuration(start+Math.round((e.clientY-startY)/10)*15);card.querySelector<HTMLElement>('.visit-card-footer b')!.textContent=`${current} min`;card.style.setProperty('--visit-height',`${Math.max(48,Math.min(110,48+Math.max(0,current-60)/15*3))}px`);};
    const end=()=>{off();if(current!==visit.estimatedMinutes)void onResize({visitId:visit.id,estimatedMinutes:current});};
    const off=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);};
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});
  });
  return card;
}

function visitHoverInfo(visit:Visit,route:number,team:Team,account:Account|undefined,location:ServiceLocation|null,series:ScheduleSeries|undefined,hold:ClientServiceHold|null,task:string,notes:string):string{
  const recurrence=series?recurrenceLabel(series):'One-off / no recurring series';
  const status=statusLabel(String(visit.status).toLowerCase()).label;
  const dns=visitDoNotService(visit);
  const rows=[
    `<strong>${esc(account?.name??'Client')}</strong>`,
    `<span>${esc(location?.address||'Address not linked')}${location?.suburb?` · ${esc(location.suburb)}`:''}</span>`,
    `<small>${esc(team.name)} · route ${route} · ${esc(status)} · ${esc(visitTypeLabel(visit))}</small>`,
    `<small>${esc(recurrence)}${visit.estimatedMinutes?` · ${visit.estimatedMinutes} min`:''}</small>`,
    task?`<small><b>Task:</b> ${esc(task)}</small>`:'',
    location?.accessNotes?`<small class="warning"><b>Access notes:</b> ${esc(location.accessNotes)}</small>`:'',
    location?.instructions?`<small><b>Site instructions:</b> ${esc(location.instructions)}</small>`:'',
    notes?`<small><b>Notes:</b> ${esc(notes)}</small>`:'',
    dns.active?`<small class="danger"><b>DO NOT SERVICE THIS VISIT:</b> ${esc([dns.reason,dns.note].filter(Boolean).join(' · '))}</small>`:'',
    hold?`<small class="danger"><b>DO NOT SERVICE CLIENT:</b> ${esc([hold.reason,hold.note].filter(Boolean).join(' · '))}</small>`:'',
  ];
  return rows.filter(Boolean).join('');
}

function visitTypeLabel(visit:Visit):string{if(visit.visitType==='additional')return 'Additional visit';if(visit.visitType==='quoted')return 'Quoted work';if(visit.visitType==='once-off')return 'Once-off';return 'Recurring';}
function statusLabel(status:string):{key:string;label:string}{if(status==='completed')return{key:'completed',label:'Completed'};if(status==='missed')return{key:'attention',label:'Missed'};if(status==='cancelled')return{key:'cancelled',label:'Cancelled'};if(status==='rescheduled')return{key:'neutral',label:'Rescheduled'};if(status==='suspended')return{key:'neutral',label:'Suspended'};if(status==='deferred')return{key:'attention',label:'Deferred'};return{key:'scheduled',label:'Scheduled'};}
function taskSummary(payload:Record<string,unknown>):string{const list=payload.visitTasks;if(Array.isArray(list)){const text=list.filter(v=>typeof v==='string'&&v.trim()).map(String).join(' · ');if(text)return text;}for(const key of ['customTasks','serviceDescription','description','reason','task']){const value=payload[key];if(typeof value==='string'&&value.trim())return value.trim();}return '';}
function notesSummary(payload:Record<string,unknown>):string{for(const key of ['officeNotes','notes','internalNotes']){const value=payload[key];if(typeof value==='string'&&value.trim())return value.trim();}return '';}
const TEAM_COLOURS=[
  {accent:'#247a57',soft:'#eaf5ef'},
  {accent:'#3f6fa7',soft:'#edf3fa'},
  {accent:'#9a6a2b',soft:'#faf3e8'},
  {accent:'#795ba3',soft:'#f4effa'},
  {accent:'#ad5b63',soft:'#fbefef'},
  {accent:'#2f7d82',soft:'#eaf6f6'},
  {accent:'#8a6d36',soft:'#f8f3e8'},
  {accent:'#577c45',soft:'#eef6ea'},
] as const;
function teamColour(index:number){return TEAM_COLOURS[index%TEAM_COLOURS.length];}
function applyTeamColour(el:HTMLElement,theme:{accent:string;soft:string}):void{el.style.setProperty('--team-accent',theme.accent);el.style.setProperty('--team-soft',theme.soft);}

function shortId(value:string):string{const text=String(value||'');return text.length<=8?text:text.slice(-8);}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
