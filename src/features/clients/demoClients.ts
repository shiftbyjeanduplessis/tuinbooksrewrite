import type { ClientWorkspace, ServiceAgreement } from '../../domain/types.js';
import { demoWeek } from '../schedule/demoData.js';
import { todayIso } from '../../domain/dates.js';

export function demoClientWorkspace():ClientWorkspace{
  const week=demoWeek();
  const agreements:ServiceAgreement[]=[
    {id:'agreement-demo-1',businessId:'demo',accountId:'client-1',serviceLocationId:'site-1',status:'active',startDate:todayIso(),endDate:null,frequency:'weekly',weekdays:[1],monthlyOrdinal:null,defaultTeamId:'team-1',estimatedMinutes:60,serviceIds:['Garden service'],notes:'Routine weekly maintenance.',monthlyFee:1200,scheduleSeriesId:'series-1',version:1,updatedAt:null},
    {id:'agreement-demo-2',businessId:'demo',accountId:'client-2',serviceLocationId:'site-2',status:'active',startDate:todayIso(),endDate:null,frequency:'weekly',weekdays:[2,5],monthlyOrdinal:null,defaultTeamId:'team-2',estimatedMinutes:75,serviceIds:['Garden service','Lawn'],notes:'Two visits per week.',monthlyFee:2200,scheduleSeriesId:'series-2',version:1,updatedAt:null},
    {id:'agreement-demo-3',businessId:'demo',accountId:'client-3',serviceLocationId:'site-3',status:'active',startDate:todayIso(),endDate:null,frequency:'fortnightly',weekdays:[3],monthlyOrdinal:null,defaultTeamId:'team-3',estimatedMinutes:60,serviceIds:['Garden service'],notes:'',monthlyFee:650,scheduleSeriesId:'series-3',version:1,updatedAt:null}
  ];
  const extraSite={id:'site-2-office',businessId:'demo',accountId:'client-2',siteName:'Office',address:'44 Market Street',suburb:'George Central',accessNotes:'Reception has gate remote',instructions:'Service courtyard only',active:true};
  return{accounts:week.accounts,locations:[...week.locations,extraSite],agreements,teams:week.teams};
}
