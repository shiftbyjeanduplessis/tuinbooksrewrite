import type { ClientServiceHold, IsoDate, ScheduleDayAction, Team, Visit } from './types.js';

export type CancelMode='charge'|'no-charge';
export interface RescheduleMissedInput{visitId:string;newVisitId:string;date:IsoDate;teamId:string;sortOrder:number;}
export interface DayActionInput{id:string;date:IsoDate;teamId:string;kind:'team_note'|'internal_event';title:string;detail:string;time:string;response?:string;status?:'active'|'resolved';}

export function cancelVisitOptimistically(visits:Visit[],visitId:string,mode:CancelMode,reason=''):Visit[]{
  return visits.map(v=>v.id===visitId?{...v,status:'cancelled',billingDisposition:mode,payload:{...v.payload,cancellationBilling:mode,billingDisposition:mode,cancelReason:reason,cancelledV2:true}}:v);
}
export function undoCancelOptimistically(visits:Visit[],visitId:string):Visit[]{
  return visits.map(v=>{if(v.id!==visitId)return v;const billing=v.visitType==='additional'?'additional':v.visitType==='quoted'?'quoted':'routine';const payload={...v.payload};delete payload.cancellationBilling;delete payload.cancelReason;delete payload.cancelledV2;return {...v,status:'scheduled',billingDisposition:billing,payload:{...payload,billingDisposition:billing,cancelUndoV2:true}};});
}
export function markMissedOptimistically(visits:Visit[],visitId:string,reason=''):Visit[]{
  return visits.map(v=>v.id===visitId?{...v,status:'missed',payload:{...v.payload,missedReason:reason,missedV2:true}}:v);
}
export function rescheduleMissedOptimistically(visits:Visit[],input:RescheduleMissedInput):Visit[]{
  const source=visits.find(v=>v.id===input.visitId);if(!source||source.status!=='missed')return visits;
  const replacement:Visit={...source,id:input.newVisitId,date:input.date,teamId:input.teamId,sortOrder:input.sortOrder,status:'scheduled',seriesId:null,seriesSlotId:null,occurrenceDate:null,recurrenceManualOverride:true,payload:{...source.payload,rescheduledVisitV2:true,rescheduledFromVisitId:source.id,manualOverride:true},updatedAt:null};
  return [...visits.map(v=>v.id===source.id?{...v,status:'rescheduled',payload:{...v.payload,rescheduledToVisitId:input.newVisitId,resolvedMissedV2:true}}:v),replacement];
}
export function setSuspendedOptimistically(visits:Visit[],visitIds:string[],suspended:boolean,reason=''):Visit[]{
  const ids=new Set(visitIds);return visits.map(v=>ids.has(v.id)?{...v,status:suspended?'suspended':'scheduled',payload:{...v.payload,suspensionReason:suspended?reason:'',suspendedV2:suspended}}:v);
}

export function visitDoNotService(visit:Visit):{active:boolean;reason:string;note:string}{
  const active=visit.payload?.doNotServiceVisitV2===true;
  return {active,reason:active?String(visit.payload?.doNotServiceVisitReasonV2||'Do not service this visit'):'',note:active?String(visit.payload?.doNotServiceVisitNoteV2||''):''};
}
export function setVisitDoNotServiceOptimistically(visits:Visit[],visitId:string,active:boolean,reason:string,note:string):Visit[]{
  return visits.map(v=>v.id!==visitId?v:{...v,payload:{...v.payload,doNotServiceVisitV2:active,doNotServiceVisitReasonV2:active?(reason.trim()||'Do not service this visit'):'',doNotServiceVisitNoteV2:active?note.trim():'',doNotServiceVisitChangedAtV2:new Date().toISOString()}});
}

export function setClientHoldOptimistically(holds:ClientServiceHold[],businessId:string,clientId:string,active:boolean,reason:string,note:string):ClientServiceHold[]{
  const row:ClientServiceHold={businessId,clientId,active,reason:reason.trim()||'Do not service',note:note.trim(),updatedAt:null};return [...holds.filter(h=>h.clientId!==clientId),row];
}
export function activeHold(holds:ClientServiceHold[],clientId:string):ClientServiceHold|null{return holds.find(h=>h.clientId===clientId&&h.active)??null;}
export function upsertDayActionOptimistically(actions:ScheduleDayAction[],businessId:string,input:DayActionInput):ScheduleDayAction[]{
  const row:ScheduleDayAction={id:input.id,businessId,date:input.date,teamId:input.teamId,kind:input.kind,title:input.kind==='team_note'?'Day instruction':input.title.trim(),detail:input.detail.trim(),time:input.kind==='team_note'?'':input.time,status:input.status??'active',response:input.kind==='team_note'?'':String(input.response??'').trim(),resolvedAt:input.status==='resolved'?new Date().toISOString():null,updatedAt:null};return [...actions.filter(a=>a.id!==input.id),row];
}
export function removeDayActionOptimistically(actions:ScheduleDayAction[],id:string):ScheduleDayAction[]{return actions.filter(a=>a.id!==id);}
export function actionsForCell(actions:ScheduleDayAction[],date:IsoDate,teamId:string):ScheduleDayAction[]{return actions.filter(a=>a.date===date&&a.teamId===teamId&&a.status==='active').sort((a,b)=>(a.kind==='team_note'?0:1)-(b.kind==='team_note'?0:1)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id));}
export function canModifyVisit(visit:Visit):boolean{return !['completed','cancelled','rescheduled'].includes(String(visit.status).toLowerCase());}
export function canRescheduleMissed(visit:Visit):boolean{return visit.status==='missed';}
export function validRescheduleTeam(teams:Team[],teamId:string):boolean{return teams.some(t=>t.id===teamId&&t.active);}
