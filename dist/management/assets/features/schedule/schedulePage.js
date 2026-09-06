import { addDays, startOfWeek, todayIso } from '../../domain/dates.js';
import { buildAdditionalVisit, moveVisitOptimistically, placeQueueItemOptimistically, queueVisitOptimistically, resizeVisitOptimistically } from '../../domain/schedule.js';
import { cancelVisitOptimistically, markMissedOptimistically, removeDayActionOptimistically, rescheduleMissedOptimistically, setClientHoldOptimistically, setSuspendedOptimistically, setVisitDoNotServiceOptimistically, undoCancelOptimistically, upsertDayActionOptimistically } from '../../domain/operations.js';
import { moveSeriesPatternOptimistically } from '../../domain/recurrence.js';
import { renderCalendar } from './calendar.js';
import { renderBasket } from './basket.js';
import { openAdditionalVisitDialog } from './additionalVisitDialog.js';
import { chooseMoveScope } from './recurrenceScopeDialog.js';
import { openVisitActionDialog } from './visitActionDialog.js';
import { openDayActionDialog } from './dayActionDialog.js';
import { demoWeek } from './demoData.js';
import { loadWeek, persistAdditionalVisit, persistCancelVisit, persistClientHold, persistDayAction, persistMarkMissed, persistQueuePlacement, persistRemoveDayAction, persistRescheduleMissed, persistSuspension, persistUndoCancel, persistVisitDoNotService, persistVisitMove, persistVisitResize, persistVisitToBasket } from './scheduleRepository.js';
import { mountWorkspace } from '../shell/chrome.js';
export function renderSchedulePage(root, identity, navigation) {
    const page = mountWorkspace(root, identity, 'schedule', navigation, 'schedule-page');
    page.innerHTML = `
    <section class="page-heading schedule-toolbar">
      <div>
        <p class="eyebrow">Live scheduling board</p>
        <h1>Schedule</h1>
        <p id="weekTitle">Loading selected week…</p>
      </div>
      <div class="heading-actions toolbar-actions">
        <button class="button secondary compact" id="prevWeek">← Previous</button>
        <button class="button secondary" id="todayWeek">Today</button>
        <button class="button secondary compact" id="nextWeek">Next →</button>
        <button class="button secondary" id="refreshWeek">Refresh</button>
        <button class="button secondary schedule-basket-toggle" id="basketToggle">Basket <span id="basketCount">0</span></button>
      </div>
    </section>
    <section class="schedule-week-navigation" aria-label="Rolling schedule weeks">
      <div id="rollingWeekCards" class="rolling-week-strip-v2"></div>
      <div class="schedule-drag-controls">
        <span id="dragScopeControls" class="drag-scope-controls hidden">
          <button type="button" data-drag-scope="one" class="active">THIS VISIT</button>
          <button type="button" data-drag-scope="future">THIS + FUTURE</button>
        </span>
        <button type="button" class="button secondary compact schedule-drag-toggle" id="dragModeToggle">↔ Drag mode</button>
      </div>
    </section>
    <div id="pageError" class="error-box hidden" role="alert"></div>
    <div id="saveIndicator" class="save-indicator hidden">Saving…</div>
    <section class="schedule-legend compact-schedule-legend">
      <div><span class="legend-marker recurring">R</span>Recurring</div>
      <div><span class="legend-marker additional">A</span>Additional visit</div>
      <div><span class="legend-marker quoted">Q</span>Quoted work</div>
      <div><span class="legend-status missed"></span>Missed / attention</div>
      <div><span class="legend-status dns"></span>Do not service</div>
      <p id="scheduleModeHelp">Schedule is locked. Turn on <strong>Drag mode</strong> when you want to rearrange visits.</p>
    </section>
    <div class="schedule-layout" id="scheduleLayout">
      <aside class="basket-panel" data-basket-drop="1">
        <div class="basket-header">
          <div><p class="eyebrow">Basket</p><strong>Unscheduled work</strong></div>
          <button id="closeBasket" aria-label="Close basket">×</button>
        </div>
        <div id="basketHost"></div>
      </aside>
      <button id="openBasket" class="basket-launcher hidden">Basket</button>
      <section class="calendar-panel"><div id="calendarHost" class="loading-state">Loading this week…</div></section>
    </div>`;
    let weekStart = startOfWeek(todayIso());
    let data = null;
    let calendar = null;
    let basketController = null;
    let saves = 0;
    let dragMode = false;
    let dragScope = 'one';
    const host = root.querySelector('#calendarHost');
    const basketHost = root.querySelector('#basketHost');
    const errorBox = root.querySelector('#pageError');
    const saveIndicator = root.querySelector('#saveIndicator');
    const dragToggle = root.querySelector('#dragModeToggle');
    const dragScopeControls = root.querySelector('#dragScopeControls');
    const modeHelp = root.querySelector('#scheduleModeHelp');
    const updateTitle = () => {
        const end = addDays(weekStart, 6);
        const a = new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        const b = new Date(`${end}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        root.querySelector('#weekTitle').textContent = `${a} – ${b}`;
    };
    const showError = (message = '') => { errorBox.textContent = message; errorBox.classList.toggle('hidden', !message); };
    const showSaving = () => saveIndicator.classList.toggle('hidden', saves === 0);
    const renderDragChrome = () => {
        dragToggle.classList.toggle('active', dragMode);
        dragToggle.classList.toggle('secondary', !dragMode);
        dragToggle.textContent = dragMode ? '✓ Done dragging' : '↔ Drag mode';
        dragScopeControls.classList.toggle('hidden', !dragMode);
        dragScopeControls.querySelectorAll('[data-drag-scope]').forEach(button => button.classList.toggle('active', button.dataset.dragScope === dragScope));
        modeHelp.innerHTML = dragMode
            ? `Drag mode is on · <strong>${dragScope === 'future' ? 'this + future' : 'this visit'}</strong>. Street addresses and drag IDs stay visible while you rearrange.`
            : `Schedule is locked. Turn on <strong>Drag mode</strong> when you want to rearrange visits.`;
    };
    const rollingStarts = () => {
        const current = startOfWeek(todayIso());
        let start = addDays(current, -7);
        const defaultEnd = addDays(start, 49);
        if (weekStart < start || weekStart > defaultEnd)
            start = addDays(weekStart, -7);
        return Array.from({ length: 8 }, (_, index) => addDays(start, index * 7));
    };
    const weekLabel = (value) => {
        const current = startOfWeek(todayIso());
        if (value === current)
            return 'This week';
        if (value === addDays(current, 7))
            return 'Next week';
        if (value === addDays(current, -7))
            return 'Last week';
        return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    };
    const renderWeekCards = () => {
        const strip = root.querySelector('#rollingWeekCards');
        strip.innerHTML = rollingStarts().map(start => {
            const end = addDays(start, 6), selected = start === weekStart;
            const count = selected && data ? `${data.visits.length} visits` : new Date(`${end}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
            return `<button type="button" class="rolling-week-card-v2${selected ? ' active' : ''}" data-week-start="${esc(start)}"><span>${esc(weekLabel(start))}</span><strong>${esc(count)}</strong></button>`;
        }).join('');
        strip.querySelectorAll('[data-week-start]').forEach(button => button.onclick = () => { const start = button.dataset.weekStart; if (!start || start === weekStart)
            return; weekStart = start; void fetchWeek(); });
    };
    const render = () => {
        calendar?.destroy();
        basketController?.destroy();
        if (!data)
            return;
        host.classList.remove('loading-state');
        renderWeekCards();
        renderDragChrome();
        root.querySelector('#basketCount').textContent = String(data.queueItems.length);
        calendar = renderCalendar(host, data, {
            dragEnabled: dragMode,
            dragScope,
            onMove: moveVisit,
            onQueue: queueVisit,
            onResize: resizeVisit,
            onAdd: openAdditional,
            onVisitAction: openVisitActions,
            onDayAction: openDayAction,
        });
        basketController = renderBasket(basketHost, data.queueItems, data.accounts, data.locations, data.visits, placeQueueItem);
    };
    async function fetchWeek() {
        updateTitle();
        renderWeekCards();
        showError();
        host.className = 'loading-state';
        host.textContent = 'Loading this week…';
        try {
            data = identity.demo ? demoWeek(weekStart) : await loadWeek(identity.businessId, weekStart);
            render();
        }
        catch (error) {
            showError(msg(error));
            host.textContent = 'Calendar could not be loaded.';
        }
    }
    async function saveOptimistic(before, work) {
        if (identity.demo)
            return true;
        saves++;
        showSaving();
        try {
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
        }
    }
    async function moveVisit(proposed) {
        if (!data)
            return;
        const visit = data.visits.find(row => row.id === proposed.visitId);
        if (!visit)
            return;
        let move = { ...proposed, scope: proposed.scope ?? 'one' };
        const series = visit.seriesId ? data.series.find(row => row.id === visit.seriesId) : undefined;
        if (series && visit.seriesSlotId && visit.occurrenceDate && !proposed.scope) {
            const scope = await chooseMoveScope(visit, series);
            if (!scope)
                return;
            move = { ...proposed, scope };
        }
        const before = data;
        try {
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
        }
        const saved = await saveOptimistic(before, () => persistVisitMove(identity.businessId, move));
        if (saved && move.scope === 'future' && !identity.demo)
            await fetchWeek();
    }
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
        return; openVisitActionDialog(visit, account, data.teams, hold, { onCancel: cancelVisit, onUndoCancel: undoCancel, onMissed: markMissed, onReschedule: rescheduleMissed, onSuspend: setSuspension, onVisitDoNotService: setVisitDoNotService, onClientHold: setClientHold }); }
    async function cancelVisit(visitId, mode, reason) { if (!data)
        return; const before = data; data = { ...data, visits: cancelVisitOptimistically(data.visits, visitId, mode, reason) }; render(); await saveOptimistic(before, () => persistCancelVisit(identity.businessId, visitId, mode, reason)); }
    async function undoCancel(visitId) { if (!data)
        return; const before = data; data = { ...data, visits: undoCancelOptimistically(data.visits, visitId) }; render(); await saveOptimistic(before, () => persistUndoCancel(identity.businessId, visitId)); }
    async function markMissed(visitId, reason) { if (!data)
        return; const before = data; data = { ...data, visits: markMissedOptimistically(data.visits, visitId, reason) }; render(); await saveOptimistic(before, () => persistMarkMissed(identity.businessId, visitId, reason)); }
    async function rescheduleMissed(input) { if (!data)
        return; const before = data; data = { ...data, visits: rescheduleMissedOptimistically(data.visits, input) }; render(); const saved = await saveOptimistic(before, () => persistRescheduleMissed(identity.businessId, input)); if (saved && !identity.demo && (input.date < weekStart || input.date > addDays(weekStart, 6)))
        await fetchWeek(); }
    async function setSuspension(visitIds, suspended, reason) { if (!data)
        return; const before = data; data = { ...data, visits: setSuspendedOptimistically(data.visits, visitIds, suspended, reason) }; render(); await saveOptimistic(before, () => persistSuspension(identity.businessId, visitIds, suspended, reason)); }
    async function setVisitDoNotService(visitId, active, reason, note) { if (!data)
        return; const before = data; data = { ...data, visits: setVisitDoNotServiceOptimistically(data.visits, visitId, active, reason, note) }; render(); await saveOptimistic(before, () => persistVisitDoNotService(identity.businessId, visitId, active, reason, note)); }
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
    dragToggle.onclick = () => { dragMode = !dragMode; render(); };
    dragScopeControls.querySelectorAll('[data-drag-scope]').forEach(button => button.onclick = () => { dragScope = button.dataset.dragScope === 'future' ? 'future' : 'one'; render(); });
    const layout = page.querySelector('#scheduleLayout');
    const basket = page.querySelector('.basket-panel');
    const launcher = page.querySelector('#openBasket');
    const basketToggle = page.querySelector('#basketToggle');
    const closeBasket = () => { basket.classList.add('hidden'); launcher.classList.remove('hidden'); layout.classList.add('basket-closed'); basketToggle.classList.remove('active'); };
    const openBasket = () => { basket.classList.remove('hidden'); launcher.classList.add('hidden'); layout.classList.remove('basket-closed'); basketToggle.classList.add('active'); };
    page.querySelector('#closeBasket').onclick = closeBasket;
    launcher.onclick = openBasket;
    basketToggle.onclick = () => basket.classList.contains('hidden') ? openBasket() : closeBasket();
    renderWeekCards();
    renderDragChrome();
    openBasket();
    void fetchWeek();
}
function msg(error) { return error instanceof Error ? error.message : (error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)); }
function esc(v) { return v.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=schedulePage.js.map