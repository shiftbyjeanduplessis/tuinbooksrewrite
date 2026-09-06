import { supabase } from '../../lib/supabase.js';
import { normaliseAccount, normaliseAgreement, normaliseLocation } from '../../domain/clients.js';
import { todayIso } from '../../domain/dates.js';
const customerSelect = 'id,name,status,contact_name,email,phone';
const siteSelect = 'id,customer_id,site_name,address,suburb,access_notes,instructions,active';
const agreementSelect = 'id,client_id,service_site_id,status,start_date,end_date,frequency,weekdays,monthly_ordinal,default_team_id,estimated_minutes,service_ids,notes,monthly_fee,schedule_series_id,version,updated_at';
const teamSelect = 'id,name,active,capacity_hours,buffer_hours,created_at';
export async function loadClientWorkspace(businessId) {
    const [customers, sites, agreementsRaw, teams] = await Promise.all([
        supabase.from('customers').select(customerSelect).eq('business_id', businessId).order('name'),
        supabase.from('service_sites').select(siteSelect).eq('business_id', businessId).order('customer_id').order('site_name'),
        supabase.from('client_service_agreements_v2').select(agreementSelect).eq('business_id', businessId).order('client_id').order('start_date'),
        supabase.from('teams').select(teamSelect).eq('business_id', businessId).eq('active', true).order('created_at')
    ]);
    if (customers.error)
        throw customers.error;
    if (sites.error)
        throw sites.error;
    if (teams.error)
        throw teams.error;
    const agreementsResult = isMissingM5Schema(agreementsRaw.error) ? { data: [], error: null } : agreementsRaw;
    if (agreementsResult.error)
        throw agreementsResult.error;
    const accounts = (customers.data ?? []).map((r) => ({ id: String(r.id), businessId, name: String(r.name ?? ''), status: String(r.status ?? 'active'), contactName: String(r.contact_name ?? ''), email: String(r.email ?? ''), phone: String(r.phone ?? '') }));
    const locations = (sites.data ?? []).map((r) => ({ id: String(r.id), businessId, accountId: String(r.customer_id), siteName: String(r.site_name ?? ''), address: String(r.address ?? ''), suburb: String(r.suburb ?? ''), accessNotes: String(r.access_notes ?? ''), instructions: String(r.instructions ?? ''), active: r.active !== false }));
    const agreements = (agreementsResult.data ?? []).map((r) => ({ id: String(r.id), businessId, accountId: String(r.client_id), serviceLocationId: String(r.service_site_id), status: String(r.status ?? 'draft'), startDate: r.start_date ? String(r.start_date) : null, endDate: r.end_date ? String(r.end_date) : null, frequency: String(r.frequency ?? 'weekly'), weekdays: Array.isArray(r.weekdays) ? r.weekdays.map(Number) : [], monthlyOrdinal: r.monthly_ordinal == null ? null : Number(r.monthly_ordinal), defaultTeamId: String(r.default_team_id ?? ''), estimatedMinutes: Number(r.estimated_minutes ?? 60), serviceIds: Array.isArray(r.service_ids) ? r.service_ids.map(String) : [], notes: String(r.notes ?? ''), monthlyFee: r.monthly_fee == null ? null : Number(r.monthly_fee), scheduleSeriesId: r.schedule_series_id ? String(r.schedule_series_id) : null, version: Number(r.version ?? 0), updatedAt: r.updated_at ? String(r.updated_at) : null }));
    const mappedTeams = (teams.data ?? []).map((r) => ({ id: String(r.id), businessId, name: String(r.name ?? ''), active: r.active !== false, capacityHours: Number(r.capacity_hours ?? 8), bufferHours: Number(r.buffer_hours ?? 0) }));
    return { accounts, locations, agreements, teams: mappedTeams };
}
export async function saveAccount(businessId, input) {
    const row = normaliseAccount(input, businessId);
    const { error } = await supabase.rpc('tuinbooks_v2_save_account', { p_business_id: businessId, p_id: row.id, p_name: row.name, p_status: row.status, p_contact_name: row.contactName, p_phone: row.phone, p_email: row.email });
    if (error)
        throw error;
}
export async function saveLocation(businessId, input) {
    const row = normaliseLocation(input, businessId);
    const { error } = await supabase.rpc('tuinbooks_v2_save_service_location', { p_business_id: businessId, p_id: row.id, p_client_id: row.accountId, p_site_name: row.siteName, p_address: row.address, p_suburb: row.suburb, p_access_notes: row.accessNotes, p_instructions: row.instructions, p_active: row.active });
    if (error)
        throw error;
}
export async function saveAgreement(businessId, input) {
    const row = normaliseAgreement(input, businessId);
    const { error } = await supabase.rpc('tuinbooks_v2_save_service_agreement', { p_business_id: businessId, p_id: row.id, p_client_id: row.accountId, p_service_site_id: row.serviceLocationId, p_status: row.status, p_start_date: row.startDate, p_end_date: row.endDate, p_frequency: row.frequency, p_weekdays: row.weekdays, p_monthly_ordinal: row.monthlyOrdinal, p_default_team_id: row.defaultTeamId, p_estimated_minutes: row.estimatedMinutes, p_service_ids: row.serviceIds, p_notes: row.notes, p_monthly_fee: row.monthlyFee, p_effective_date: todayIso() });
    if (error)
        throw error;
}
function isMissingM5Schema(error) { if (!error)
    return false; const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase(); return text.includes('client_service_agreements_v2') && (text.includes('does not exist') || text.includes('schema cache') || text.includes('pgrst205')); }
//# sourceMappingURL=clientsRepository.js.map