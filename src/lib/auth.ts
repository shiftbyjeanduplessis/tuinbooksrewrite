import { supabase } from './supabase.js';
import type { Business, Membership } from '../domain/types.js';

export interface AuthContext {
  userId: string;
  email: string;
  membership: Membership;
  business: Business;
}

export async function loadAuthContext(): Promise<AuthContext | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  const { data, error } = await supabase.rpc('tuinbooks_v2_auth_context');
  if (error) {
    if (/does not exist|schema cache|PGRST20[25]|42883/i.test(String(error?.message ?? error))) {
      throw new Error('The TuinBooks v2 release migration has not been installed in this database.');
    }
    throw error;
  }
  if (!data?.business_id) throw new Error('No active TuinBooks business membership was found for this user.');
  return {
    userId: String(data.user_id),
    email: String(data.email ?? sessionData.session.user.email ?? ''),
    membership: { businessId: String(data.business_id), role: String(data.role), displayName: String(data.display_name ?? '') },
    business: { id: String(data.business_id), name: String(data.business_name ?? 'TuinBooks') }
  };
}

function supportRow(value:any):any{return Array.isArray(value)?(value[0]??null):(value??null);}
function uuid(value:string):boolean{return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
function supportCanRead(ctx:any):boolean{return !!(ctx?.operational_read??ctx?.allow_operational_read)||!!(ctx?.financial_read??ctx?.allow_financial_read)||!!(ctx?.operational_edit??ctx?.allow_operational_edit)||!!(ctx?.financial_edit??ctx?.allow_financial_edit);}

export async function loadSupportAuthContext(businessId:string,sessionId:string):Promise<AuthContext|null>{
  const session=(await supabase.auth.getSession()).data.session;if(!session)return null;
  if(!uuid(businessId))throw new Error('The Management link is missing a valid business ID. Return to Management and open the account again.');
  if(!uuid(sessionId))throw new Error('The Management link is missing the exact support session ID. Return to Management and open the account again.');
  let result=await supabase.rpc('tuinbooks_management_open_context_v5938',{p_business_id:businessId,p_session_id:sessionId});
  if(result.error&&/PGRST202|42883|Could not find the function|function .* does not exist|schema cache/i.test(String(result.error.message??result.error))){
    result=await supabase.rpc('tuinbooks_current_support_context');
  }
  if(result.error)throw new Error(result.error.message);
  const data=supportRow(result.data);
  if(!data?.business_id)throw new Error('No active management session was found. Return to Management and open the account again.');
  if(String(data.business_id)!==businessId)throw new Error('The verified support session belongs to a different client account.');
  if(data.session_id&&String(data.session_id)!==sessionId)throw new Error('The verified support session does not match this Management link.');
  if(data.status&&String(data.status).toLowerCase()!=='active')throw new Error('This management session is no longer active.');
  if(data.is_unexpired===false)throw new Error('This management session has expired.');
  if(!supportCanRead(data))throw new Error('This management session has no readable account access.');
  return{userId:String(data.user_id??session.user.id),email:String(data.email??session.user.email??''),business:{id:String(data.business_id),name:String(data.business_name??'Business')},membership:{businessId:String(data.business_id),role:'support',displayName:String(data.support_display_name??data.display_name??'Platform support')}};
}
