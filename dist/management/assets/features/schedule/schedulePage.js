import { addDays, startOfWeek, todayIso } from '../../domain/dates.js';
import { buildAdditionalVisit, moveVisitOptimistically, placeQueueItemOptimistically, queueVisitOptimistically, resizeVisitOptimistically } from '../../domain/schedule.js';
import { cancelVisitOptimistically, markMissedOptimistically, removeDayActionOptimistically, rescheduleMissedOptimistically, setClientHoldOptimistically, setSuspendedOptimistically, undoCancelOptimistically, upsertDayActionOptimistically } from '../../domain/operations.js';
import { moveSeriesPatternOptimistically } from '../../domain/recurrence.js';
import { renderCalendar } from './calendar.js';
import { renderBasket } from './basket.js';
import { openAdditionalVisitDialog } from './additionalVisitDialog.js';
import { chooseMoveScope } from './recurrenceScopeDialog.js';
import { openVisitActionDialog } from './visitActionDialog.js';
import { openDayActionDialog } from './dayActionDialog.js';
import { demoWeek } from './demoData.js';
import { loadWeek, persistAdditionalVisit, persistCancelVisit, persistClientHold, persistDayAction, persistMarkMissed, persistQueuePlacement, persistRemoveDayAction, persistRescheduleMissed, persistSuspension, persistUndoCancel, persistVisitMove, persistVisitResize, persistVisitToBasket } from './scheduleRepository.js';
import { mountWorkspace } from '../shell/chrome.js';
export function renderSchedulePage(root, identity, navigation) {
    const page = mountWorkspace(root, identity, 'schedule', navigation, 'schedule-page');
    page.innerHTML = `<section class="page-heading schedule-toolbar"><div><p class="eyebrow">Live scheduling board</p><h1>Schedule</h1><p id="weekTitle">Loading selected week…</p></div><div class="heading-actions toolbar-actions"><button class="button secondary compact" id="prevWeek">←</button><button class="button secondary" id="todayWeek">Today</button><button class="button secondary compact" id="nextWeek">→</button><button class="button secondary" id="refreshWeek">Refresh</button></div></section><div id="pageError" class="error-box hidden" role="alert"></div><div id="saveIndicator" class="save-indicator hidden">Saving…</div><div class="schedule-layout" id="scheduleLayout"><aside class="basket-panel" data-basket-drop="1"><div class="basket-header"><div><p class="eyebrow">Basket</p><strong>Unscheduled work</strong></div><button id="closeBasket" aria-label="Close basket">×</button></div><div id="basketHost"></div></aside><button id="openBasket" class="basket-launcher hidden">Basket</button><section class="calendar-panel"><div id="calendarHost" class="loading-state">Loading this week…</div></section></div>`;
    let weekStart = startOfWeek(todayIso()), data = null, calendar = null, basketController = null, saves = 0;
    const host = root.querySelector('#calendarHost'), basketHost = root.querySelector('#basketHost'), errorBox = root.querySelector('#pageError'), saveIndicator = root.querySelector('#saveIndicator');
    const updateTitle = () => { const end = addDays(weekStart, 6), a = new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), b = new Date(`${end}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); root.querySelector('#weekTitle').textContent = `${a} – ${b}`; };
    const showError = (message = '') => { errorBox.textContent = message; errorBox.classList.toggle('hidden', !message); };
    const showSaving = () => saveIndicator.classList.toggle('hidden', saves === 0);
    const render = () => { calendar?.destroy(); basketController?.destroy(); if (!data)
        return; host.classList.remove('loading-state'); calendar = renderCalendar(host, data, { onMove: moveVisit, onQueue: queueVisit, onResize: resizeVisit, onAdd: openAdditional, onVisitAction: openVisitActions, onDayAction: openDayAction }); basketController = renderBasket(basketHost, data.queueItems, data.accounts, data.locations, data.visits, placeQueueItem); };
    async function fetchWeek() { updateTitle(); showError(); host.className = 'loading-state'; host.textContent = 'Loading this week…'; try {
        data = identity.demo ? demoWeek(weekStart) : await loadWeek(identity.businessId, weekStart);
        render();
    }
    catch (error) {
        showError(msg(error));
        host.textContent = 'Calendar could not be loaded.';
    } }
    async function saveOptimistic(before, work) { if (identity.demo)
        return true; saves++; showSaving(); try {
        await work();
        return true;
    }
    catch (error) {
        data = before;
        render();
        showError(`Change was not saved. The previous schedule was restored. ${msg(error)}`);
        return false;
    }
    finally {
        saves = Math.max(0, saves - 1);
        showSaving();
    } }
    async function moveVisit(proposed) { if (!data)
        return; const visit = data.visits.find(row => row.id === proposed.visitId); if (!visit)
        return; let move = { ...proposed, scope: proposed.scope ?? 'one' }; const series = visit.seriesId ? data.series.find(row => row.id === visit.seriesId) : undefined; if (series && visit.seriesSlotId && visit.occurrenceDate && !proposed.scope) {
        const scope = await chooseMoveScope(visit, series);
        if (!scope)
            return;
        move = { ...proposed, scope };
    } const before = data; try {
        let nextSeries = data.series;
        if (move.scope === 'future' && series && visit.seriesSlotId && visit.occurrenceDate) {
            const changed = moveSeriesPatternOptimistically(series, visit.seriesSlotId, visit.occurrenceDate, move.date, move.teamId);
            nextSeries = data.series.map(row => row.id === series.id ? changed : row);
        }
        data = { ...data, series: nextSeries, visits: moveVisitOptimistically(data.visits, move) };
        render();
    }
    catch (error) {
        showError(msg(error));
        return;
    } const saved = await saveOptimistic(before, () => persistVisitMove(identity.businessId, move)); if (saved && move.scope === 'future' && !identity.demo)
        await fetchWeek(); }
    async function resizeVisit(input) { if (!data)
        return; const before = data; data = { ...data, visits: resizeVisitOptimistically(data.visits, input) }; render(); await saveOptimistic(before, () => persistVisitResize(identity.businessId, input)); }
    async function queueVisit(visitId) { if (!data)
        return; const before = data, next = queueVisitOptimistically(data.visits, data.queueItems, visitId); data = { ...data, ...next }; render(); await saveOptimistic(before, () => persistVisitToBasket(identity.businessId, visitId)); }
    async function placeQueueItem(input) { if (!data)
        return; const before = data, next = placeQueueItemOptimistically(data.visits, data.queueItems, input.queueItemId, input.date, input.teamId, input.sortOrder); data = { ...data, ...next }; render(); await saveOptimistic(before, () => persistQueuePlacement(identity.businessId, input)); }
    async function openAdditional(date, teamId, _index, sortOrder) { if (!data)
        return; openAdditionalVisitDialog({ businessId: identity.businessId, date, teamId, sortOrder, accounts: data.accounts, locations: data.locations }, createAdditional); }
    async function createAdditional(input) { if (!data)
        return; const before = data, visit = buildAdditionalVisit(input, identity.businessId); data = { ...data, visits: [...data.visits, visit] }; render(); const saved = await saveOptimistic(before, () => persistAdditionalVisit(identity.businessId, input)); if (saved && !data.accounts.some(a => a.id === input.accountId) && !identity.demo)
        await fetchWeek(); }
    function openVisitActions(visit, account, hold) { if (!data)
        return; openVisitActionDialog(visit, account, data.teams, hold, { onCancel: cancelVisit, onUndoCancel: undoCancel, onMissed: markMissed, onReschedule: rescheduleMissed, onSuspend: setSuspension, onClientHold: setClientHold }); }
    async function cancelVisit(visitId, mode, reason) { if (!data)
        return; const before = data; data = { ...data, visits: cancelVisitOptimistically(data.visits, visitId, mode, reason) }; render(); await saveOptimistic(before, () => persistCancelVisit(identity.businessId, visitId, mode, reason)); }
    async function undoCancel(visitId) { if (!data)
        return; const before = data; data = { ...data, visits: undoCancelOptimistically(data.visits, visitId) }; render(); await saveOptimistic(before, () => persistUndoCancel(identity.businessId, visitId)); }
    async function markMissed(visitId, reason) { if (!data)
        return; const before = data; data = { ...data, visits: markMissedOptimistically(data.visits, visitId, reason) }; render(); await saveOptimistic(before, () => persistMarkMissed(identity.businessId, visitId, reason)); }
    async function rescheduleMissed(input) { if (!data)
        return; const before = data; data = { ...data, visits: rescheduleMissedOptimistically(data.visits, input) }; render(); const saved = await saveOptimistic(before, () => persistRescheduleMissed(identity.businessId, input)); if (saved && !identity.demo && input.date < weekStart || saved && !identity.demo && input.date > addDays(weekStart, 6))
        await fetchWeek(); }
    async function setSuspension(visitIds, suspended, reason) { if (!data)
        return; const before = data; data = { ...data, visits: setSuspendedOptimistically(data.visits, visitIds, suspended, reason) }; render(); await saveOptimistic(before, () => persistSuspension(identity.businessId, visitIds, suspended, reason)); }
    async function setClientHold(clientId, active, reason, note) { if (!data)
        return; const before = data; data = { ...data, clientHolds: setClientHoldOptimistically(data.clientHolds, identity.businessId, clientId, active, reason, note) }; render(); await saveOptimistic(before, () => persistClientHold(identity.businessId, clientId, active, reason, note)); }
    function openDayAction(kind, date, teamId, existing) { if (!data)
        return; openDayActionDialog(kind, date, teamId, data.teams, existing, saveDayAction, removeDayAction); }
    async function saveDayAction(input) { if (!data)
        return; const before = data; data = { ...data, dayActions: upsertDayActionOptimistically(data.dayActions, identity.businessId, input) }; render(); await saveOptimistic(before, () => persistDayAction(identity.businessId, input)); }
    async function removeDayAction(actionId) { if (!data)
        return; const before = data; data = { ...data, dayActions: removeDayActionOptimistically(data.dayActions, actionId) }; render(); await saveOptimistic(before, () => persistRemoveDayAction(identity.businessId, actionId)); }
    page.querySelector('#prevWeek').onclick = () => { weekStart = addDays(weekStart, -7); void fetchWeek(); };
    page.querySelector('#todayWeek').onclick = () => { weekStart = startOfWeek(todayIso()); void fetchWeek(); };
    page.querySelector('#nextWeek').onclick = () => { weekStart = addDays(weekStart, 7); void fetchWeek(); };
    page.querySelector('#refreshWeek').onclick = () => void fetchWeek();
    const layout = page.querySelector('#scheduleLayout'), basket = page.querySelector('.basket-panel'), launcher = page.querySelector('#openBasket');
    page.querySelector('#closeBasket').onclick = () => { basket.classList.add('hidden'); launcher.classList.remove('hidden'); layout.classList.add('basket-closed'); };
    launcher.onclick = () => { basket.classList.remove('hidden'); launcher.classList.add('hidden'); layout.classList.remove('basket-closed'); };
    void fetchWeek();
}
function msg(error) { return error instanceof Error ? error.message : String(error); }
function esc(v) { return v.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=schedulePage.js.map