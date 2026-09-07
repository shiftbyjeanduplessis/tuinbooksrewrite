import { addDays, parseIsoDate, startOfWeek } from './dates.js';
export function isoWeekday(date) {
    const day = parseIsoDate(date).getUTCDay();
    return day === 0 ? 7 : day;
}
export function daysBetween(a, b) {
    return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / 86_400_000);
}
export function monthlyOrdinalForDate(date) {
    return Math.min(5, Math.ceil(Number(date.slice(8, 10)) / 7));
}
export function monthlyDueDate(yearMonth, weekday, ordinal) {
    const [year, month] = yearMonth.split('-').map(Number);
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const firstWeekday = isoWeekday(first);
    const offset = (weekday - firstWeekday + 7) % 7;
    let day = 1 + offset + (Math.max(1, Math.min(5, ordinal)) - 1) * 7;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    while (day > lastDay)
        day -= 7;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function recurrenceLabel(series) {
    if (series.frequency === 'weekly') {
        const count = Math.max(1, series.slots.length);
        return count === 1 ? 'Weekly' : `${count}× weekly`;
    }
    if (series.frequency === 'fortnightly')
        return 'Fortnightly';
    if (series.frequency === 'four-weekly')
        return 'Every 4 weeks';
    return 'Monthly';
}
export function slotDueDates(series, slot, from, through) {
    if (series.status !== 'active' || through < from)
        return [];
    if (series.frequency === 'monthly')
        return monthlySlotDates(series, slot, from, through);
    const interval = series.frequency === 'fortnightly' ? 2 : series.frequency === 'four-weekly' ? 4 : 1;
    const anchorWeek = startOfWeek(series.anchorDate), rows = [];
    for (let date = from; date <= through; date = addDays(date, 1)) {
        if (date < series.anchorDate || isoWeekday(date) !== slot.weekday)
            continue;
        const weeks = Math.floor(daysBetween(anchorWeek, startOfWeek(date)) / 7);
        if (weeks >= 0 && weeks % interval === 0)
            rows.push(date);
    }
    return rows;
}
export function seriesDueDates(series, from, through) {
    return series.slots.flatMap(slot => slotDueDates(series, slot, from, through).map(date => ({ slotId: slot.id, date }))).sort((a, b) => a.date.localeCompare(b.date) || a.slotId.localeCompare(b.slotId));
}
export function moveSeriesPatternOptimistically(series, slotId, sourceOccurrence, targetDate, targetTeamId) {
    const slot = series.slots.find(row => row.id === slotId);
    if (!slot)
        return series;
    const newWeekday = isoWeekday(targetDate), siblings = series.slots.filter(row => row.id !== slotId);
    if (series.frequency === 'weekly' && siblings.some(row => row.weekday === newWeekday))
        throw new Error('This recurring client already has another visit on that weekday.');
    const updatedSlot = { ...slot, weekday: newWeekday, monthlyOrdinal: series.frequency === 'monthly' ? monthlyOrdinalForDate(targetDate) : slot.monthlyOrdinal, defaultTeamId: targetTeamId };
    const shiftAnchor = series.frequency === 'fortnightly' || series.frequency === 'four-weekly' || series.frequency === 'monthly';
    return { ...series, anchorDate: shiftAnchor ? targetDate : series.anchorDate, slots: series.slots.map(row => row.id === slotId ? updatedSlot : row), payload: { ...series.payload, lastPatternMove: { from: sourceOccurrence, to: targetDate, slotId } } };
}
export function isMappedRecurringVisit(seriesId, slotId, occurrenceDate) {
    return !!seriesId && !!slotId && !!occurrenceDate;
}
function monthlySlotDates(series, slot, from, through) {
    const rows = [];
    let cursor = `${from.slice(0, 7)}-01`;
    const lastMonth = `${through.slice(0, 7)}-01`;
    while (cursor <= lastMonth) {
        const due = monthlyDueDate(cursor.slice(0, 7), slot.weekday, slot.monthlyOrdinal || monthlyOrdinalForDate(series.anchorDate));
        if (due >= from && due <= through && due >= series.anchorDate)
            rows.push(due);
        const parsed = parseIsoDate(cursor);
        const next = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 1));
        cursor = next.toISOString().slice(0, 10);
    }
    return rows;
}
//# sourceMappingURL=recurrence.js.map