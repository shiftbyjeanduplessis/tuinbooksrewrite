import type { Account, AccountInput, ClientWorkspace, ServiceAgreement, ServiceAgreementInput, ServiceLocation, ServiceLocationInput } from './types.js';

export function normaliseAccount(input:AccountInput,businessId:string):Account{
  const name=input.name.trim();if(!name)throw new Error('Account name is required.');
  return{id:input.id,businessId,name,status:input.status||'active',contactName:input.contactName.trim(),phone:input.phone.trim(),email:input.email.trim().toLowerCase()};
}
export function normaliseLocation(input:ServiceLocationInput,businessId:string):ServiceLocation{
  if(!input.accountId)throw new Error('A service location must belong to an account.');
  if(!input.address.trim())throw new Error('Street address is required.');
  return{id:input.id,businessId,accountId:input.accountId,siteName:input.siteName.trim(),address:input.address.trim(),suburb:input.suburb.trim(),accessNotes:input.accessNotes.trim(),instructions:input.instructions.trim(),active:input.active};
}
export function normaliseAgreement(input:ServiceAgreementInput,businessId:string):ServiceAgreement{
  if(!input.accountId||!input.serviceLocationId)throw new Error('Agreement account and service location are required.');
  if(!input.defaultTeamId)throw new Error('Default team is required.');
  if(!input.startDate)throw new Error('Agreement start date is required.');
  const weekdays=[...new Set(input.weekdays.map(Number).filter(day=>day>=1&&day<=7))].sort((a,b)=>a-b);
  if(!weekdays.length)throw new Error('Choose at least one service day.');
  if(input.frequency!=='weekly'&&weekdays.length>1)throw new Error('Fortnightly, four-weekly and monthly agreements use one recurring day.');
  if(input.frequency==='monthly'&&(input.monthlyOrdinal??0)<1)throw new Error('Monthly agreements require a week-of-month.');
  const estimatedMinutes=Math.max(15,Math.min(480,Math.round(Number(input.estimatedMinutes||60)/15)*15));
  return{id:input.id,businessId,accountId:input.accountId,serviceLocationId:input.serviceLocationId,status:input.status||'draft',startDate:input.startDate,endDate:input.endDate,frequency:input.frequency,weekdays,monthlyOrdinal:input.frequency==='monthly'?Math.max(1,Math.min(5,Number(input.monthlyOrdinal||1))):null,defaultTeamId:input.defaultTeamId,estimatedMinutes,serviceIds:[...new Set(input.serviceIds.map(v=>v.trim()).filter(Boolean))],notes:input.notes.trim(),monthlyFee:input.monthlyFee===null||input.monthlyFee===undefined||Number.isNaN(Number(input.monthlyFee))?null:Math.max(0,Number(input.monthlyFee)),scheduleSeriesId:null,version:0,updatedAt:null};
}
export function locationsForAccount(workspace:ClientWorkspace,accountId:string):ServiceLocation[]{return workspace.locations.filter(row=>row.accountId===accountId).sort((a,b)=>(a.siteName||a.address).localeCompare(b.siteName||b.address));}
export function agreementsForAccount(workspace:ClientWorkspace,accountId:string):ServiceAgreement[]{return workspace.agreements.filter(row=>row.accountId===accountId).sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||''));}
export function agreementsForLocation(workspace:ClientWorkspace,locationId:string):ServiceAgreement[]{return workspace.agreements.filter(row=>row.serviceLocationId===locationId).sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));}
export function agreementFrequencyLabel(agreement:Pick<ServiceAgreement,'frequency'|'weekdays'>):string{
  if(agreement.frequency==='weekly'&&agreement.weekdays.length>1)return `${agreement.weekdays.length}× weekly`;
  return agreement.frequency==='four-weekly'?'Every 4 weeks':agreement.frequency.charAt(0).toUpperCase()+agreement.frequency.slice(1);
}
export function accountSearch(workspace:ClientWorkspace,query:string):Account[]{const q=query.trim().toLowerCase();if(!q)return workspace.accounts;return workspace.accounts.filter(account=>{const sites=workspace.locations.filter(site=>site.accountId===account.id);return[account.name,account.contactName,account.phone,account.email,...sites.flatMap(site=>[site.siteName,site.address,site.suburb])].some(value=>String(value||'').toLowerCase().includes(q));});}
