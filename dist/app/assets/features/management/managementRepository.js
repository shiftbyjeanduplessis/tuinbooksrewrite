import { supabase } from '../../lib/supabase.js';
export async function listManagedBusinesses(search = '') { const { data, error } = await supabase.rpc('tuinbooks_v2_management_list_businesses', { p_search: search }); if (error)
    throw explain(error); return (data ?? []); }
export async function setSupportGrant(businessId, input) { const { error } = await supabase.rpc('tuinbooks_v2_management_set_support_grant', { p_business_id: businessId, p_status: input.status, p_expires_at: input.expiresAt, p_operational_read: input.operationalRead, p_operational_edit: input.operationalEdit, p_financial_read: input.financialRead, p_financial_edit: input.financialEdit }); if (error)
    throw explain(error); }
export async function currentStaff() { const { data, error } = await supabase.rpc('tuinbooks_v2_management_current_staff', {}); if (error)
    throw explain(error); return data; }
function explain(e) { if (/platform staff|not authorised|permission/i.test(String(e?.message ?? e)))
    return new Error('This account is not authorised for TuinBooks Management.'); if (/does not exist|schema cache|PGRST20[25]|42883/i.test(String(e?.message ?? e)))
    return new Error('The TuinBooks v2 Management migration has not been installed in this database.'); return e instanceof Error ? e : new Error(String(e?.message ?? e)); }
//# sourceMappingURL=managementRepository.js.map