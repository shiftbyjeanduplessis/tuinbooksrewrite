import { supabase } from '../../lib/supabase.js';
import type { Account, AccountInput, ClientWorkspace, ServiceAgreement, ServiceAgreementInput, ServiceLocation, ServiceLocationInput, Team } from '../../domain/types.js';
import { normaliseAccount, normaliseAgreement, normaliseLocation } from '../../domain/clients.js';
import { todayIso } from '../../domain/dates.js';

type AnyRow=Record<string,any>;

export async function loadClientWorkspace(businessId:string):Promise<ClientWorkspace>{
  const {data,error}=await supabase.rpc('tuinbooks_v2_load_client_workspace',{p_business_id:businessId});if(error)throw error;
  const accounts:Account[]=(data?.accounts??[]).map((r:AnyRow)=>({id:String(r.id),businessId,name:String(r.name??''),status:String(r.status??'active'),contactName:String(r.contact_name??''),email:String(r.email??''),phone:String(r.phone??'')}));
  const locations:ServiceLocation[]=(data?.locations??[]).map((r:AnyRow)=>({id:String(r.id),businessId,accountId:String(r.customer_id),siteName:String(r.site_name??''),address:String(r.address??''),suburb:String(r.suburb??''),accessNotes:String(r.access_notes??''),instructions:String(r.instructions??''),active:r.active!==false}));
  const agreements:ServiceAgreement[]=(data?.agreements??[]).map((r:AnyRow)=>({id:String(r.id),businessId,accountId:String(r.client_id),serviceLocationId:String(r.service_site_id),status:String(r.status??'draft'),startDate:r.start_date?String(r.start_date) as ServiceAgreement['startDate']:null,endDate:r.end_date?String(r.end_date) as ServiceAgreement['endDate']:null,frequency:String(r.frequency??'weekly') as ServiceAgreement['frequency'],weekdays:Array.isArray(r.weekdays)?r.weekdays.map(Number):[],monthlyOrdinal:r.monthly_ordinal==null?null:Number(r.monthly_ordinal),defaultTeamId:String(r.default_team_id??''),estimatedMinutes:Number(r.estimated_minutes??60),serviceIds:Array.isArray(r.service_ids)?r.service_ids.map(String):[],notes:String(r.notes??''),monthlyFee:r.monthly_fee==null?null:Number(r.monthly_fee),scheduleSeriesId:r.schedule_series_id?String(r.schedule_series_id):null,version:Number(r.version??0),updatedAt:r.updated_at?String(r.updated_at):null}));
  const mappedTeams:Team[]=(data?.teams??[]).map((r:AnyRow)=>({id:String(r.id),businessId,name:String(r.name??''),active:r.active!==false,capacityHours:Number(r.capacity_hours??8),bufferHours:Number(r.buffer_hours??0)}));
  return{accounts,locations,agreements,teams:mappedTeams};
}

export async function saveAccount(businessId:string,input:AccountInput):Promise<void>{
  const row=normaliseAccount(input,businessId);const {error}=await supabase.rpc('tuinbooks_v2_save_account',{p_business_id:businessId,p_id:row.id,p_name:row.name,p_status:row.status,p_contact_name:row.contactName,p_phone:row.phone,p_email:row.email});if(error)throw error;
}
export async function saveLocation(businessId:string,input:ServiceLocationInput):Promise<void>{
  const row=normaliseLocation(input,businessId);const {error}=await supabase.rpc('tuinbooks_v2_save_service_location',{p_business_id:businessId,p_id:row.id,p_client_id:row.accountId,p_site_name:row.siteName,p_address:row.address,p_suburb:row.suburb,p_access_notes:row.accessNotes,p_instructions:row.instructions,p_active:row.active});if(error)throw error;
}
export async function saveAgreement(businessId:string,input:ServiceAgreementInput):Promise<void>{
  const row=normaliseAgreement(input,businessId);const {error}=await supabase.rpc('tuinbooks_v2_save_service_agreement',{p_business_id:businessId,p_id:row.id,p_client_id:row.accountId,p_service_site_id:row.serviceLocationId,p_status:row.status,p_start_date:row.startDate,p_end_date:row.endDate,p_frequency:row.frequency,p_weekdays:row.weekdays,p_monthly_ordinal:row.monthlyOrdinal,p_default_team_id:row.defaultTeamId,p_estimated_minutes:row.estimatedMinutes,p_service_ids:row.serviceIds,p_notes:row.notes,p_monthly_fee:row.monthlyFee,p_effective_date:todayIso()});if(error)throw error;
}
