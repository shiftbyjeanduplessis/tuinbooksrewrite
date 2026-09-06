import { supabase } from '../../lib/supabase.js';
import type { V4ExportData, V4ImportSnapshot } from '../../domain/business.js';
export async function importV4Snapshot(businessId:string,snapshot:V4ImportSnapshot):Promise<any>{const{data,error}=await supabase.rpc('tuinbooks_v2_import_v4_snapshot',{p_business_id:businessId,p_snapshot:snapshot});if(error)throw schema(error);return data;}
export async function loadV4ExportData(businessId:string):Promise<V4ExportData>{const{data,error}=await supabase.rpc('tuinbooks_v2_export_v4_data',{p_business_id:businessId});if(error)throw schema(error);return data as V4ExportData;}
function schema(e:any):Error{if(/does not exist|schema cache|PGRST20[25]|42883/i.test(String(e?.message??e)))return new Error('The TuinBooks v2 Import/Export migration has not been installed in this database.');return e instanceof Error?e:new Error(String(e?.message??e));}
