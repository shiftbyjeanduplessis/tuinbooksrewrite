function stringField(payload, ...keys) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim())
            return value.trim();
    }
    return null;
}
export function serviceLocationIdFromLegacyPayload(payload) {
    return stringField(payload, 'serviceLocationId', 'serviceSiteId', 'siteId', 'service_site_id');
}
export function visitTypeFromPayload(payload) {
    const raw = (stringField(payload, 'visitType', 'workKind', 'workType', 'type') || '').toLowerCase();
    if (raw.includes('additional') || raw === 'a')
        return 'additional';
    if (raw.includes('quote') || raw.includes('extra'))
        return 'quoted';
    if (raw.includes('once'))
        return 'once-off';
    return 'routine';
}
export function billingDispositionFromPayload(payload) {
    const raw = (stringField(payload, 'billingDisposition', 'cancellationBilling', 'billing') || '').toLowerCase();
    if (raw.includes('no') && raw.includes('charge'))
        return 'no-charge';
    if (raw.includes('charge'))
        return 'charge';
    if (raw.includes('additional'))
        return 'additional';
    if (raw.includes('quote'))
        return 'quoted';
    return visitTypeFromPayload(payload) === 'additional' ? 'additional' : 'routine';
}
export function moveVisitOptimistically(visits, move) {
    return visits.map(visit => {
        if (visit.id !== move.visitId)
            return visit;
        const recurring = !!visit.seriesId;
        return { ...visit, date: move.date, teamId: move.teamId, sortOrder: move.sortOrder, recurrenceManualOverride: recurring ? move.scope !== 'future' : visit.recurrenceManualOverride, occurrenceDate: recurring && move.scope === 'future' ? move.date : visit.occurrenceDate };
    });
}
export function resizeVisitOptimistically(visits, input) {
    const minutes = normaliseDuration(input.estimatedMinutes);
    return visits.map(visit => visit.id === input.visitId ? { ...visit, estimatedMinutes: minutes, payload: { ...visit.payload, estimatedMinutes: minutes, durationUnknownV59320: false, durationOverrideV59320: true } } : visit);
}
export function visitsForCell(visits, date, teamId) {
    return visits.filter(v => v.date === date && v.teamId === teamId).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}
export function locationForVisit(visit, locations) {
    if (visit.serviceLocationId) {
        const exact = locations.find(location => location.id === visit.serviceLocationId);
        if (exact)
            return exact;
    }
    const accountLocations = locations.filter(location => location.accountId === visit.accountId && location.active);
    return accountLocations[0] ?? null;
}
export function nextSortOrder(visits, date, teamId) {
    const inCell = visitsForCell(visits, date, teamId);
    return inCell.length ? Math.max(...inCell.map(v => v.sortOrder)) + 100 : 100;
}
export function sortOrderForIndex(visits, date, teamId, index) {
    const rows = visitsForCell(visits, date, teamId);
    const at = Math.max(0, Math.min(rows.length, index));
    const before = rows[at - 1]?.sortOrder;
    const after = rows[at]?.sortOrder;
    if (before === undefined && after === undefined)
        return 100;
    if (before === undefined)
        return after - 100;
    if (after === undefined)
        return before + 100;
    if (after - before > 1)
        return Math.floor((before + after) / 2);
    return before + 1;
}
export function normaliseDuration(minutes) { return Math.max(15, Math.min(480, Math.round(Number(minutes || 0) / 15) * 15 || 15)); }
export function queueVisitOptimistically(visits, queueItems, visitId) {
    const visit = visits.find(row => row.id === visitId);
    if (!visit)
        return { visits, queueItems };
    const item = { id: `queue-${visit.id}`, businessId: visit.businessId, accountId: visit.accountId, serviceLocationId: visit.serviceLocationId, sourceVisitId: visit.id, seriesId: visit.seriesId, seriesSlotId: visit.seriesSlotId, occurrenceDate: visit.occurrenceDate, originalDate: visit.date, originalTeamId: visit.teamId, estimatedMinutes: visit.estimatedMinutes, serviceIds: [...visit.serviceIds], visitType: visit.visitType, billingDisposition: visit.billingDisposition, reason: 'Moved from calendar', payload: { ...visit.payload } };
    return { visits: visits.filter(row => row.id !== visitId), queueItems: [...queueItems.filter(row => row.sourceVisitId !== visit.id), item] };
}
export function placeQueueItemOptimistically(visits, queueItems, queueItemId, date, teamId, sortOrder) {
    const item = queueItems.find(row => row.id === queueItemId);
    if (!item)
        return { visits, queueItems };
    const visit = { id: item.sourceVisitId || `visit-${item.id}`, businessId: item.businessId, date, accountId: item.accountId, serviceLocationId: item.serviceLocationId, teamId, status: 'scheduled', estimatedMinutes: item.estimatedMinutes, sortOrder, serviceIds: [...item.serviceIds], visitType: item.visitType, billingDisposition: item.billingDisposition, seriesId: item.seriesId, seriesSlotId: item.seriesSlotId, occurrenceDate: item.occurrenceDate, recurrenceManualOverride: !!item.seriesId, payload: { ...item.payload, v2RestoredFromQueue: true }, updatedAt: null };
    return { visits: [...visits, visit], queueItems: queueItems.filter(row => row.id !== queueItemId) };
}
export function buildAdditionalVisit(input, businessId) {
    const task = input.task.trim(), notes = input.notes.trim();
    return { id: input.id, businessId, date: input.date, accountId: input.accountId, serviceLocationId: input.serviceLocationId, teamId: input.teamId, status: 'scheduled', estimatedMinutes: 0, sortOrder: input.sortOrder, serviceIds: [], visitType: 'additional', billingDisposition: 'additional', seriesId: null, seriesSlotId: null, occurrenceDate: null, recurrenceManualOverride: true, updatedAt: null, payload: { visitType: 'additional', billingDisposition: 'additional', workKind: 'additional-visit', revenueType: 'Additional visit', workMarker: 'A', additionalVisitV2: true, serviceLocationId: input.serviceLocationId, serviceDescription: task, customTasks: task, visitTasks: task ? [task] : [], description: task || 'Additional visit', reason: task || 'Additional visit', officeNotes: notes, notes, manualOverride: true, autoGenerated: false, autoAssigned: false, durationUnknownV59320: true, durationOverrideV59320: false } };
}
//# sourceMappingURL=schedule.js.map