export const OPPORTUNITY_CATEGORIES = ['Lawn', 'Plants', 'Irrigation', 'Trees', 'Upgrade', 'Other'];
export const TASK_OUTCOMES = ['Done', 'Not required today', 'Could not complete', 'Client declined'];
export function tasksForVisit(visit) {
    const direct = visit.serviceIds.map(x => String(x).trim()).filter(Boolean);
    if (direct.length)
        return unique(direct);
    const payload = visit.payload ?? {};
    for (const key of ['tasks', 'workTypeIds', 'serviceIds']) {
        const value = payload[key];
        if (Array.isArray(value)) {
            const rows = value.map(x => typeof x === 'string' ? x.trim() : '').filter(Boolean);
            if (rows.length)
                return unique(rows);
        }
    }
    const task = String(payload.task ?? payload.serviceDescription ?? '').trim();
    return task ? [task] : ['Garden service'];
}
export function defaultTaskOutcomes(visit) { return tasksForVisit(visit).map(task => ({ task, outcome: 'Done', note: '' })); }
export function validateTaskOutcomes(rows) {
    const errors = [];
    if (!rows.length)
        errors.push('At least one task is required.');
    rows.forEach((row, index) => { if (!row.task.trim())
        errors.push(`Task ${index + 1} is blank.`); if (!TASK_OUTCOMES.includes(row.outcome))
        errors.push(`Task ${index + 1} has an invalid outcome.`); if (['Could not complete', 'Client declined'].includes(row.outcome) && !row.note.trim())
        errors.push(`Task ${index + 1} needs a reason.`); });
    return errors;
}
export function workOutcome(rows, note = '') {
    const done = rows.filter(r => r.outcome === 'Done' || r.outcome === 'Not required today').length;
    const failed = rows.filter(r => r.outcome === 'Could not complete' || r.outcome === 'Client declined').length;
    if (failed === 0)
        return 'Completed';
    if (done > 0 || note.trim())
        return 'Partially completed';
    return 'Unable to complete';
}
export function completionStatus(outcome) { return outcome === 'Completed' ? 'completed' : outcome === 'Partially completed' ? 'attention' : 'missed'; }
export function completeVisitOptimistically(visits, visitId, rows, note = '') {
    const outcome = workOutcome(rows, note), status = completionStatus(outcome);
    return visits.map(v => v.id === visitId ? { ...v, status, payload: { ...v.payload, fieldOutcome: outcome, taskOutcomesV2: rows, completionNoteV2: note } } : v);
}
export function teamProgress(visits, teamId) {
    const rows = visits.filter(v => v.teamId === teamId && v.status !== 'cancelled' && v.status !== 'suspended' && v.status !== 'rescheduled');
    const completed = rows.filter(v => v.status === 'completed').length, attention = rows.filter(v => v.status === 'attention' || v.status === 'missed').length, total = rows.length, remaining = Math.max(0, total - completed - attention);
    return { total, completed, attention, remaining, percent: total ? Math.round((completed / total) * 100) : 0 };
}
export function workDayProgress(day) { const active = day.visits.filter(v => v.status !== 'cancelled' && v.status !== 'suspended' && v.status !== 'rescheduled'); const completed = active.filter(v => v.status === 'completed').length; return { total: active.length, completed, percent: active.length ? Math.round(completed / active.length * 100) : 0 }; }
export function accountForWork(day, accountId) { return day.accounts.find(a => a.id === accountId); }
export function locationForWork(day, locationId) { return locationId ? day.locations.find(s => s.id === locationId) : undefined; }
export function holdForWork(day, accountId) { return day.clientHolds.find(h => h.clientId === accountId && h.active); }
export function recordsForVisit(day, visitId) { return day.workRecords.filter(r => r.scheduleJobId === visitId); }
export function opportunitiesForVisit(day, visitId) { return day.opportunities.filter(o => o.scheduleJobId === visitId); }
export function mobileVisibleTeams(profile, teams, assignedTeamIds) { return profile === 'owner_mobile' ? teams : teams.filter(t => assignedTeamIds.includes(t.id)); }
export function mobileVisibleVisits(profile, visits, assignedTeamIds) { return profile === 'owner_mobile' ? visits : visits.filter(v => assignedTeamIds.includes(v.teamId)); }
export function canCompleteTeam(profile, teamId, assignedTeamIds) { return profile === 'owner_mobile' || assignedTeamIds.includes(teamId); }
export function makeWorkRecordId(date, visitId) { return `work-v2-${date}-${visitId}-${cryptoSafeId()}`; }
export function makeSubmissionId(visitId) { return `submit-v2-${visitId}-${cryptoSafeId()}`; }
export function makeOpportunityId(visitId) { return `opp-v2-${visitId}-${cryptoSafeId()}`; }
function unique(rows) { return [...new Set(rows)]; }
function cryptoSafeId() { return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2); }
//# sourceMappingURL=work.js.map