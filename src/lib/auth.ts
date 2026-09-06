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

export async function loadSupportAuthContext(businessId:string):Promise<AuthContext|null>{const session=(await supabase.auth.getSession()).data.session;if(!session)return null;const{data,error}=await supabase.rpc('tuinbooks_v2_support_context',{p_business_id:businessId});if(error)throw new Error(error.message);if(!data?.business_id)return null;return{userId:String(data.user_id??session.user.id),email:String(data.email??session.user.email??''),business:{id:String(data.business_id),name:String(data.business_name??'Business')},membership:{businessId:String(data.business_id),role:'support',displayName:String(data.display_name??'Platform support')}};}
