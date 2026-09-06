import { supabase } from '../../lib/supabase.js';
import { addDays } from '../../domain/dates.js';
import { billingDispositionFromPayload, serviceLocationIdFromLegacyPayload, visitTypeFromPayload } from '../../domain/schedule.js';
function payloadObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
const accountSelect = 'id,name,status,contact_name,email,phone';
const locationSelect = 'id,customer_id,site_name,address,suburb,access_notes,instructions,active';
const teamSelect = 'id,name,active,capacity_hours,buffer_hours,created_at';
const visitSelect = 'id,visit_date,client_id,team_id,status,estimated_hours,sort_order,service_ids,payload,updated_at';
const queueSelect = 'id,client_id,service_site_id,source_schedule_job_id,original_date,original_team_id,estimated_minutes,service_ids,item_type,billing_disposition,reason,payload';
const occurrenceSelect = 'schedule_job_id,queue_item_id,series_id,slot_id,occurrence_date,planned_date,manual_override,status';
const seriesSelect = 'id,client_id,service_site_id,status,frequency,anchor_date,payload';
const slotSelect = 'id,series_id,weekday,monthly_ordinal,default_team_id,estimated_minutes,service_ids,payload';
const holdSelect = 'client_id,active,reason,note,updated_at';
const dayActionSelect = 'id,calendar_date,team_id,kind,title,detail,calendar_time,status,updated_at';
export async function loadWeek(businessId, weekStart) {
    const started = performance.now(), weekEnd = addDays(weekStart, 6);
    const { data, error } = await supabase.rpc('tuinbooks_v2_load_schedule_week', { p_business_id: businessId, p_week_start: weekStart });
    if (error) {
        if (/does not exist|schema cache|PGRST20[25]|42883/i.test(String(error?.message ?? error)))
            throw new Error('The TuinBooks v2 release migration has not been installed in this database.');
        throw error;
    }
    const raw = data ?? {}, rawVisits = Array.isArray(raw.visits) ? raw.visits : [], rawQueue = Array.isArray(raw.queue_items) ? raw.queue_items : [], occurrenceRows = Array.isArray(raw.occurrences) ? raw.occurrences : [], seriesRows = Array.isArray(raw.series) ? raw.series : [], slotRows = Array.isArray(raw.slots) ? raw.slots : [];
    const occurrenceByJob = new Map(occurrenceRows.filter(r => r.schedule_job_id).map(r => [String(r.schedule_job_id), r])), occurrenceByQueue = new Map(occurrenceRows.filter(r => r.queue_item_id).map(r => [String(r.queue_item_id), r]));
    const series = seriesRows.map((r) => ({ id: String(r.id), businessId, accountId: String(r.client_id), serviceLocationId: r.service_site_id ? String(r.service_site_id) : null, status: String(r.status), frequency: String(r.frequency), anchorDate: String(r.anchor_date), slots: slotRows.filter((slot) => String(slot.series_id) === String(r.id)).map((slot) => ({ id: String(slot.id), seriesId: String(slot.series_id), weekday: Number(slot.weekday), monthlyOrdinal: slot.monthly_ordinal == null ? null : Number(slot.monthly_ordinal), defaultTeamId: String(slot.default_team_id || ''), estimatedMinutes: Number(slot.estimated_minutes ?? 60), serviceIds: Array.isArray(slot.service_ids) ? slot.service_ids.filter((x) => typeof x === 'string') : [], payload: payloadObject(slot.payload) })), payload: payloadObject(r.payload) }));
    const teams = (Array.isArray(raw.teams) ? raw.teams : []).map((r) => ({ id: String(r.id), businessId, name: String(r.name), active: r.active !== false, capacityHours: Number(r.capacity_hours ?? 8), bufferHours: Number(r.buffer_hours ?? 1) }));
    const accounts = (Array.isArray(raw.accounts) ? raw.accounts : []).map((r) => ({ id: String(r.id), businessId, name: String(r.name), status: String(r.status), contactName: String(r.contact_name ?? ''), phone: String(r.phone ?? ''), email: String(r.email ?? '') }));
    const locations = (Array.isArray(raw.locations) ? raw.locations : []).map((r) => ({ id: String(r.id), businessId, accountId: String(r.customer_id), siteName: String(r.site_name ?? ''), address: String(r.address ?? ''), suburb: String(r.suburb ?? ''), accessNotes: String(r.access_notes ?? ''), instructions: String(r.instructions ?? ''), active: r.active !== false }));
    const visits = rawVisits.map((r) => { const payload = payloadObject(r.payload), occ = occurrenceByJob.get(String(r.id)); return { id: String(r.id), businessId, date: String(r.visit_date), accountId: String(r.client_id), serviceLocationId: serviceLocationIdFromLegacyPayload(payload), teamId: String(r.team_id), status: String(r.status), estimatedMinutes: Math.max(0, Math.round(Number(r.estimated_hours ?? 0) * 60)), sortOrder: Number(r.sort_order ?? 99), serviceIds: Array.isArray(r.service_ids) ? r.service_ids.filter((x) => typeof x === 'string') : [], visitType: visitTypeFromPayload(payload), billingDisposition: billingDispositionFromPayload(payload), seriesId: occ?.series_id ? String(occ.series_id) : null, seriesSlotId: occ?.slot_id ? String(occ.slot_id) : null, occurrenceDate: occ?.occurrence_date ? String(occ.occurrence_date) : null, recurrenceManualOverride: occ?.manual_override === true, payload, updatedAt: r.updated_at ? String(r.updated_at) : null }; });
    const queueItems = rawQueue.map((r) => { const occ = occurrenceByQueue.get(String(r.id)); return { id: String(r.id), businessId, accountId: String(r.client_id), serviceLocationId: r.service_site_id ? String(r.service_site_id) : null, sourceVisitId: r.source_schedule_job_id ? String(r.source_schedule_job_id) : null, seriesId: occ?.series_id ? String(occ.series_id) : null, seriesSlotId: occ?.slot_id ? String(occ.slot_id) : null, occurrenceDate: occ?.occurrence_date ? String(occ.occurrence_date) : null, originalDate: r.original_date ? String(r.original_date) : null, originalTeamId: r.original_team_id ? String(r.original_team_id) : null, estimatedMinutes: Number(r.estimated_minutes ?? 0), serviceIds: Array.isArray(r.service_ids) ? r.service_ids.filter((x) => typeof x === 'string') : [], visitType: String(r.item_type || 'routine'), billingDisposition: String(r.billing_disposition || 'routine'), reason: String(r.reason || 'Unscheduled work'), payload: payloadObject(r.payload) }; });
    const clientHolds = (Array.isArray(raw.holds) ? raw.holds : []).map((r) => ({ businessId, clientId: String(r.client_id), active: r.active === true, reason: String(r.reason || 'Do not service'), note: String(r.note || ''), updatedAt: r.updated_at ? String(r.updated_at) : null }));
    const dayActions = (Array.isArray(raw.day_actions) ? raw.day_actions : []).map((r) => ({ id: String(r.id), businessId, date: String(r.calendar_date), teamId: String(r.team_id), kind: String(r.kind), title: String(r.title || ''), detail: String(r.detail || ''), time: String(r.calendar_time || ''), status: String(r.status || 'active'), response: String(r.response || ''), resolvedAt: r.resolved_at ? String(r.resolved_at) : null, updatedAt: r.updated_at ? String(r.updated_at) : null }));
    console.info(`[TuinBooks v2] Week ready in ${Math.round(performance.now() - started)}ms`, { teams: teams.length, visits: visits.length, queue: queueItems.length, accounts: accounts.length, series: series.length });
    return { weekStart, weekEnd, teams, accounts, locations, visits, queueItems, series, clientHolds, dayActions };
}
export async function loadAdditionalVisitClients(businessId) {
    const [a, s] = await Promise.all([supabase.from('customers').select(accountSelect).eq('business_id', businessId).eq('status', 'active').order('name').limit(1000), supabase.from('service_sites').select(locationSelect).eq('business_id', businessId).eq('active', true).limit(2000)]);
    if (a.error)
        throw a.error;
    if (s.error)
        throw s.error;
    return { accounts: (a.data ?? []).map((r) => ({ id: String(r.id), businessId, name: String(r.name), status: String(r.status), contactName: String(r.contact_name ?? ''), phone: String(r.phone ?? ''), email: String(r.email ?? '') })), locations: (s.data ?? []).map((r) => ({ id: String(r.id), businessId, accountId: String(r.customer_id), siteName: String(r.site_name ?? ''), address: String(r.address ?? ''), suburb: String(r.suburb ?? ''), accessNotes: String(r.access_notes ?? ''), instructions: String(r.instructions ?? ''), active: r.active !== false })) };
}
export async function persistVisitMove(businessId, move) {
    if (move.scope === 'future')
        await rpc('tuinbooks_v2_move_series_future', { p_business_id: businessId, p_visit_id: move.visitId, p_date: move.date, p_team_id: move.teamId, p_sort_order: move.sortOrder });
    else
        await rpc('tuinbooks_v2_move_visit', { p_business_id: businessId, p_visit_id: move.visitId, p_date: move.date, p_team_id: move.teamId, p_sort_order: move.sortOrder });
}
export async function persistVisitResize(businessId, input) { await rpc('tuinbooks_v2_resize_visit', { p_business_id: businessId, p_visit_id: input.visitId, p_estimated_minutes: input.estimatedMinutes }); }
export async function persistVisitToBasket(businessId, visitId) { await rpc('tuinbooks_v2_move_visit_to_basket', { p_business_id: businessId, p_visit_id: visitId }); }
export async function persistQueuePlacement(businessId, input) { await rpc('tuinbooks_v2_schedule_queue_item', { p_business_id: businessId, p_queue_item_id: input.queueItemId, p_date: input.date, p_team_id: input.teamId, p_sort_order: input.sortOrder }); }
export async function persistAdditionalVisit(businessId, input) { await rpc('tuinbooks_v2_create_additional_visit', { p_business_id: businessId, p_visit_id: input.id, p_date: input.date, p_team_id: input.teamId, p_sort_order: input.sortOrder, p_client_id: input.accountId, p_service_site_id: input.serviceLocationId, p_task: input.task, p_notes: input.notes }); }
export async function persistCancelVisit(businessId, visitId, mode, reason) { await rpc('tuinbooks_v2_cancel_visit', { p_business_id: businessId, p_visit_id: visitId, p_charge: mode === 'charge', p_reason: reason }); }
export async function persistUndoCancel(businessId, visitId) { await rpc('tuinbooks_v2_undo_cancel_visit', { p_business_id: businessId, p_visit_id: visitId }); }
export async function persistMarkMissed(businessId, visitId, reason) { await rpc('tuinbooks_v2_mark_visit_missed', { p_business_id: businessId, p_visit_id: visitId, p_reason: reason }); }
export async function persistRescheduleMissed(businessId, input) { await rpc('tuinbooks_v2_reschedule_missed_visit', { p_business_id: businessId, p_visit_id: input.visitId, p_new_visit_id: input.newVisitId, p_date: input.date, p_team_id: input.teamId, p_sort_order: input.sortOrder }); }
export async function persistSuspension(businessId, visitIds, suspended, reason) { await rpc('tuinbooks_v2_set_visit_suspension', { p_business_id: businessId, p_visit_ids: visitIds, p_suspended: suspended, p_reason: reason }); }
export async function persistClientHold(businessId, clientId, active, reason, note) { await rpc('tuinbooks_v2_set_client_service_hold', { p_business_id: businessId, p_client_id: clientId, p_active: active, p_reason: reason, p_note: note }); }
export async function persistVisitDoNotService(businessId, visitId, active, reason, note) { await rpc('tuinbooks_v2_set_visit_do_not_service', { p_business_id: businessId, p_visit_id: visitId, p_active: active, p_reason: reason, p_note: note }); }
export async function persistDayAction(businessId, input) { await rpc('tuinbooks_v2_save_day_action_r8', { p_business_id: businessId, p_action_id: input.id, p_date: input.date, p_team_id: input.teamId, p_kind: input.kind, p_title: input.title, p_detail: input.detail, p_time: input.time || null, p_response: input.response ?? '', p_status: input.status ?? 'active' }); }
export async function persistRemoveDayAction(businessId, actionId) { await rpc('tuinbooks_v2_remove_day_action', { p_business_id: businessId, p_action_id: actionId }); }
async function tryEnsureRecurrenceHorizon(businessId, from, through) {
    const { error } = await supabase.rpc('tuinbooks_v2_ensure_series_horizon', { p_business_id: businessId, p_from: from, p_through: through });
    if (error && !isMissingRecurrenceSchema(error) && !/Admin access required/i.test(String(error.message || '')))
        throw error;
}
async function rpc(name, args) { const { error } = await supabase.rpc(name, args); if (error) {
    if (/does not exist|schema cache|PGRST202/i.test(String(error.message || '')))
        throw new Error('The required TuinBooks v2 QA migration has not been installed in this database.');
    throw error;
} }
function isMissingV2Table(error) { return !!error && /schedule_queue_items_v2|does not exist|schema cache|PGRST205|42P01/i.test([error.code, error.message, error.details].map(String).join(' ')); }
function isMissingRecurrenceSchema(error) { return !!error && /schedule_(series|occurrences)_v2|schedule_series_slots_v2|tuinbooks_v2_ensure_series_horizon|does not exist|schema cache|PGRST20[25]|42P01|42883/i.test([error.code, error.message, error.details].map(String).join(' ')); }
function isMissingOperationalSchema(error) { return !!error && /client_service_holds_v2|schedule_day_actions_v2|does not exist|schema cache|PGRST20[25]|42P01/i.test([error.code, error.message, error.details].map(String).join(' ')); }
//# sourceMappingURL=scheduleRepository.js.map