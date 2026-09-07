import { visitDoNotService } from '../../domain/operations.js';
export function openVisitActionDialog(visit, account, location, agreement, services, teams, hold, callbacks) {
    const d = document.createElement('dialog');
    d.className = 'operation-dialog visit-control-dialog visit-detail-dialog-r14';
    document.body.append(d);
    const status = String(visit.status).toLowerCase();
    const visitDns = visitDoNotService(visit);
    const anyDns = visitDns.active || Boolean(hold);
    const team = teams.find(t => t.id === visit.teamId);
    const teamOptions = teams.map(t => `<option value="${esc(t.id)}" ${t.id === visit.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    const clientName = account?.name || visit.accountId;
    const workItems = workItemsForVisitDetail(visit, agreement, services);
    const serviceItems = workItems.filter(item => item.kind === 'service');
    const taskItems = workItems.filter(item => item.kind === 'task');
    const address = [location?.address, location?.suburb].filter(Boolean).join(' · ');
    const visitNote = String(visit.payload?.notes ?? visit.payload?.note ?? '').trim();
    const typeLabel = visit.visitType === 'additional' ? 'Additional visit' : visit.visitType === 'quoted' ? 'Quoted work' : 'Recurring visit';
    d.innerHTML = `<form class="dialog-shell">
    <header class="visit-dialog-head"><div><p class="eyebrow">${esc(typeLabel)}</p><h2>${esc(clientName)}</h2><p class="scope-copy">${esc(visit.date)} · ${esc(team?.name || 'No team')} · ${esc(statusLabel(status))}</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></header>

    <section class="visit-work-detail-r14 dialog-section visit-work-detail-r16">
      <div class="visit-address-line-r14"><strong>${esc(location?.siteName || address || 'Service location')}</strong>${address ? `<span>${esc(address)}</span>` : ''}</div>
      <div class="dialog-section-title"><strong>Work for this visit</strong><span>The actual service scope for this property</span></div>
      <div class="visit-service-strip-r16">${serviceItems.map(item => `<div class="visit-service-chip-r16" title="${esc(item.label)}">${workIconSvg(item.icon)}<span>${esc(item.label)}</span></div>`).join('') || `<div class="visit-service-chip-r16">${workIconSvg('maintenance')}<span>Garden service</span></div>`}</div>
      ${taskItems.length ? `<div class="visit-specific-work-r16"><div class="visit-specific-work-title-r16">${workIconSvg('task')}<strong>Specific instructions</strong></div>${taskItems.map(item => `<div class="visit-specific-task-r16">${workIconSvg(item.icon)}<span>${esc(item.label)}</span></div>`).join('')}</div>` : ''}
      ${(location?.instructions || location?.accessNotes || agreement?.notes || visitNote) ? `<div class="visit-instructions-r14">
        ${location?.instructions ? `<p><b>${workIconSvg('site')} Site instructions</b><span>${esc(location.instructions)}</span></p>` : ''}
        ${location?.accessNotes ? `<p><b>${workIconSvg('key')} Access</b><span>${esc(location.accessNotes)}</span></p>` : ''}
        ${agreement?.notes ? `<p><b>${workIconSvg('repeat')} Routine notes</b><span>${esc(agreement.notes)}</span></p>` : ''}
        ${visitNote ? `<p><b>${workIconSvg('note')} This visit</b><span>${esc(visitNote)}</span></p>` : ''}
      </div>` : ''}
    </section>

    ${status === 'scheduled' ? `<section class="dialog-section service-status-section-r16">
      <div class="dialog-section-title"><strong>Service status</strong><span>Use this as the single Do not service toggle</span></div>
      <div class="service-state-toggle-r16" role="group" aria-label="Service status">
        <button type="button" data-op="service-normal" class="${anyDns ? '' : 'active'}">${workIconSvg('check')}<span><b>Service normally</b><small>${anyDns ? 'Clear Do not service and allow this visit' : 'This visit will be serviced as planned'}</small></span></button>
        <button type="button" data-op="dns-choice" class="${anyDns ? 'active dns' : 'dns'}">${workIconSvg('blocked')}<span><b>Do not service</b><small>${anyDns ? dnsSummary(visitDns.active, Boolean(hold)) : 'Block this visit or the entire client'}</small></span></button>
      </div>
      ${anyDns ? `<div class="service-status-current-r16 ${hold ? 'client-wide' : ''}"><strong>${hold ? 'Do not service is active for this client' : 'Do not service is active for this visit'}</strong><span>${esc([visitDns.reason, visitDns.note, hold?.reason, hold?.note].filter(Boolean).join(' · '))}</span></div>` : ''}
    </section>` : ''}

    ${status === 'missed' ? `<section class="dialog-section missed-resolution-section">
      <div class="dialog-section-title"><strong>Resolve missed visit</strong><span>Choose what actually happened</span></div>
      <div class="missed-resolution-grid">
        <button type="button" data-op="missed-complete" class="resolution-choice completed"><b>It was completed</b><span>Record the visit in Work.</span></button>
        <button type="button" data-op="reschedule" class="resolution-choice catchup"><b>Reschedule / catch-up</b><span>Create a linked replacement visit.</span></button>
        <button type="button" data-op="missed-no-return" class="resolution-choice no-return"><b>No catch-up / no charge</b><span>Close this visit without replacement.</span></button>
      </div>
    </section>` : `<section class="dialog-section visit-actions-r14">
      <div class="dialog-section-title"><strong>Visit administration</strong><span>Secondary controls</span></div>
      <div class="operation-grid compact-operation-grid primary-actions-r14">
        ${status === 'scheduled' ? `<button type="button" data-op="cancel-choice"><b>Cancel visit</b><span>Choose charge or no charge</span></button>` : ''}
        ${status === 'suspended' ? `<button type="button" data-op="resume"><b>Resume visit</b><span>Return this occurrence to scheduled</span></button>` : ''}
        ${status === 'cancelled' ? `<button type="button" data-op="undo-cancel"><b>Undo cancellation</b><span>Restore this visit</span></button>` : ''}
      </div>
    </section>`}

    <section class="operation-fields hidden" data-cancel-choice-panel>
      <div class="dialog-section-title"><strong>Cancel this visit</strong><span>Future recurrence is unchanged</span></div>
      <label>Reason / note<textarea data-reason rows="3" placeholder="Optional cancellation note"></textarea></label>
      <div class="operation-grid compact-operation-grid"><button type="button" data-op="cancel-no"><b>Cancel — no charge</b><span>Do not bill this occurrence</span></button><button type="button" data-op="cancel-charge"><b>Cancel & charge</b><span>Keep this occurrence billable</span></button></div>
      <div class="dialog-actions"><button type="button" class="secondary-button" data-cancel-choice-back>Back</button></div>
    </section>

    <section class="operation-fields hidden" data-dns-choice-panel>
      <div class="dialog-section-title"><strong>Do not service</strong><span>Choose how widely the warning applies</span></div>
      <div class="operation-grid compact-operation-grid dns-scope-grid-r16">
        <button type="button" data-op="visit-dns" class="${visitDns.active ? 'active-choice-r16' : ''}"><b>This visit only</b><span>${visitDns.active ? 'Currently active · edit reason' : 'Future recurrence remains unchanged'}</span></button>
        <button type="button" data-op="hold" class="${hold ? 'active-choice-r16' : ''}"><b>Entire client</b><span>${hold ? 'Currently active · edit reason' : 'Block all client visits until cleared'}</span></button>
      </div>
      <div class="dialog-actions"><button type="button" class="secondary-button" data-dns-choice-back>Back</button></div>
    </section>

    <section class="operation-fields hidden" data-missed-resolution-panel><label>Office note<textarea data-missed-resolution-note rows="3" placeholder="Optional reason or confirmation note"></textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-missed-resolution-cancel>Back</button><button type="button" class="primary-button" data-missed-resolution-save>Confirm outcome</button></div></section>
    <section class="operation-fields hidden" data-reschedule-panel><label>New date<input data-new-date type="date" value="${esc(visit.date)}"></label><label>Team<select data-new-team>${teamOptions}</select></label><div class="dialog-actions"><button type="button" class="secondary-button" data-reschedule-cancel>Back</button><button type="button" class="primary-button" data-reschedule-save>Reschedule</button></div></section>
    <section class="operation-fields hidden" data-dns-panel><label>Reason<input data-dns-reason value="${esc(visitDns.reason || 'Do not service this visit')}"></label><label>Note<textarea data-dns-note rows="3">${esc(visitDns.note || '')}</textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-dns-cancel>Back</button><button type="button" class="primary-button" data-dns-save>${visitDns.active ? 'Update visit warning' : 'Do not service this visit'}</button></div></section>
    <section class="operation-fields hidden" data-hold-panel><label>Reason<input data-hold-reason value="${esc(hold?.reason || 'Do not service')}"></label><label>Note<textarea data-hold-note rows="3">${esc(hold?.note || '')}</textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-hold-cancel>Back</button><button type="button" class="primary-button" data-hold-save>${hold ? 'Update client warning' : 'Do not service client'}</button></div></section>
  </form>`;
    const close = () => d.close();
    d.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    d.addEventListener('close', () => d.remove(), { once: true });
    const mainSections = Array.from(d.querySelectorAll('.dialog-section'));
    const cancelChoicePanel = d.querySelector('[data-cancel-choice-panel]');
    const dnsChoicePanel = d.querySelector('[data-dns-choice-panel]');
    const missedResolutionPanel = d.querySelector('[data-missed-resolution-panel]');
    const reschedulePanel = d.querySelector('[data-reschedule-panel]');
    const dnsPanel = d.querySelector('[data-dns-panel]');
    const holdPanel = d.querySelector('[data-hold-panel]');
    const panels = [cancelChoicePanel, dnsChoicePanel, missedResolutionPanel, reschedulePanel, dnsPanel, holdPanel];
    let pending = '';
    const showPanel = (panel) => { mainSections.forEach(s => s.classList.add('hidden')); panels.forEach(p => p.classList.add('hidden')); panel.classList.remove('hidden'); };
    const showSections = () => { panels.forEach(p => p.classList.add('hidden')); mainSections.forEach(s => s.classList.remove('hidden')); };
    d.querySelectorAll('[data-op]').forEach(button => button.onclick = () => {
        const op = button.dataset.op || '';
        if (op === 'cancel-choice') {
            showPanel(cancelChoicePanel);
            return;
        }
        if (op === 'dns-choice') {
            showPanel(dnsChoicePanel);
            return;
        }
        if (op === 'service-normal') {
            const operations = [];
            if (visitDns.active)
                operations.push(callbacks.onVisitDoNotService(visit.id, false, visitDns.reason, visitDns.note));
            if (hold)
                operations.push(callbacks.onClientHold(visit.accountId, false, hold.reason || 'Do not service', hold.note || ''));
            if (!operations.length) {
                close();
                return;
            }
            void Promise.all(operations).then(() => close());
            return;
        }
        if (op === 'cancel-no' || op === 'cancel-charge') {
            const reason = (d.querySelector('[data-reason]')?.value || '').trim();
            void callbacks.onCancel(visit.id, op === 'cancel-charge' ? 'charge' : 'no-charge', reason).then(close);
            return;
        }
        if (op === 'resume') {
            void callbacks.onSuspend([visit.id], false, '').then(close);
            return;
        }
        if (op === 'undo-cancel') {
            void callbacks.onUndoCancel(visit.id).then(close);
            return;
        }
        if (op === 'missed-complete' || op === 'missed-no-return') {
            pending = op;
            showPanel(missedResolutionPanel);
            return;
        }
        if (op === 'reschedule') {
            showPanel(reschedulePanel);
            return;
        }
        if (op === 'visit-dns') {
            showPanel(dnsPanel);
            return;
        }
        if (op === 'hold') {
            showPanel(holdPanel);
            return;
        }
    });
    d.querySelector('[data-cancel-choice-back]').onclick = showSections;
    d.querySelector('[data-dns-choice-back]').onclick = showSections;
    d.querySelector('[data-missed-resolution-cancel]').onclick = showSections;
    d.querySelector('[data-missed-resolution-save]').onclick = () => { const note = (d.querySelector('[data-missed-resolution-note]').value || '').trim(); if (pending === 'missed-complete')
        void callbacks.onResolveMissed(visit.id, 'complete', note).then(close); if (pending === 'missed-no-return')
        void callbacks.onResolveMissed(visit.id, 'no-return', note).then(close); };
    d.querySelector('[data-reschedule-cancel]').onclick = showSections;
    d.querySelector('[data-reschedule-save]').onclick = () => { const date = d.querySelector('[data-new-date]').value, teamId = d.querySelector('[data-new-team]').value; if (!date || !teamId)
        return; void callbacks.onReschedule({ visitId: visit.id, newVisitId: `sch-v2-rescheduled-${crypto.randomUUID()}`, date, teamId, sortOrder: visit.sortOrder }).then(close); };
    d.querySelector('[data-dns-cancel]').onclick = () => showPanel(dnsChoicePanel);
    d.querySelector('[data-dns-save]').onclick = () => { const reason = d.querySelector('[data-dns-reason]').value.trim() || 'Do not service this visit', note = d.querySelector('[data-dns-note]').value.trim(); void callbacks.onVisitDoNotService(visit.id, true, reason, note).then(close); };
    d.querySelector('[data-hold-cancel]').onclick = () => showPanel(dnsChoicePanel);
    d.querySelector('[data-hold-save]').onclick = () => { const reason = d.querySelector('[data-hold-reason]').value.trim() || 'Do not service', note = d.querySelector('[data-hold-note]').value.trim(); void callbacks.onClientHold(visit.accountId, true, reason, note).then(close); };
    d.showModal();
}
function workItemsForVisitDetail(visit, agreement, services) {
    const rows = [];
    const seen = new Set();
    const add = (label, kind, icon) => { const text = String(label ?? '').trim(); const key = text.toLowerCase(); if (!text || seen.has(key))
        return; seen.add(key); rows.push({ label: text, kind, icon: icon || serviceIcon(text, text) }); };
    const serviceIds = visit.serviceIds.length ? visit.serviceIds : (agreement?.serviceIds ?? []);
    for (const id of serviceIds) {
        const service = services.find(row => row.id === id);
        add(service?.name || id, 'service', serviceIcon(id, service?.name || id));
    }
    const payload = visit.payload ?? {};
    const addTaskValue = (value) => { if (Array.isArray(value))
        value.forEach(v => add(v, 'task', 'task'));
    else if (typeof value === 'string')
        value.split(/\r?\n|\s*;\s*/).forEach(v => add(v, 'task', 'task')); };
    addTaskValue(payload.tasks);
    addTaskValue(payload.customTasks);
    add(payload.task, 'task', 'task');
    const serviceDescription = String(payload.serviceDescription ?? '').trim();
    if (serviceDescription && !rows.some(row => row.label.toLowerCase() === serviceDescription.toLowerCase()))
        addTaskValue(serviceDescription);
    if (!rows.length)
        add('Garden service', 'service', 'maintenance');
    return rows;
}
function serviceIcon(id, label) {
    const text = `${id} ${label}`.toLowerCase();
    if (/irrig.*repair|repair.*irrig/.test(text))
        return 'repair';
    if (/irrig|sprinkler|water/.test(text))
        return 'irrigation';
    if (/hedge/.test(text))
        return 'hedge';
    if (/prun/.test(text))
        return 'pruning';
    if (/tree/.test(text))
        return 'tree';
    if (/edg/.test(text))
        return 'edging';
    if (/lawn|grass|mow/.test(text))
        return 'lawn';
    if (/treat|fertili|feed|spray/.test(text))
        return 'treatment';
    if (/waste|refuse|remove/.test(text))
        return 'waste';
    if (/clean.?up|season/.test(text))
        return 'cleanup';
    if (/landscap|install/.test(text))
        return 'landscaping';
    if (/other/.test(text))
        return 'other';
    return 'maintenance';
}
function workIconSvg(name) {
    const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
    const paths = {
        maintenance: '<path d="M4 20c5-1 8-4 10-9"/><path d="M9 15C5 14 3 11 3 7c4 0 7 2 8 6M14 11c0-4 2-7 7-8 0 5-2 8-7 8Z"/>',
        lawn: '<path d="M3 19h18M5 19c1-4 1-7 0-11M9 19c0-5 1-9 3-13M14 19c0-4 2-8 5-11M18 19c0-3 1-5 3-7"/>',
        edging: '<path d="M4 18h16M8 18V8l8-4v14M8 9h8"/><path d="M5 21h14"/>',
        hedge: '<path d="M4 7h16M7 4l10 6M17 4 7 10"/><path d="M6 15c3-3 9-3 12 0v5H6v-5Z"/>',
        pruning: '<circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/><path d="m9 15 8-11M15 15 7 4"/>',
        irrigation: '<path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10Z"/><path d="M9.5 14.5c.6 1 1.4 1.5 2.5 1.5"/>',
        repair: '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-3 3-3-3 3-3Z"/>',
        tree: '<path d="M12 21v-6M8 21h8"/><path d="M12 3c-4 0-7 3-7 7 0 3 2 5 5 5h4c3 0 5-2 5-5 0-4-3-7-7-7Z"/>',
        treatment: '<path d="M9 3h6M10 3v4l-4 7v6h12v-6l-4-7V3"/><path d="M8 14h8M10 17h.01M14 17h.01"/>',
        cleanup: '<path d="m7 3 4 9M4 13h10l-2 8H6l-2-8ZM14 5h6M17 2v6"/>',
        waste: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
        landscaping: '<path d="m4 20 7-7M8 16l-3-3 8-8 3 3-8 8ZM14 18h7M17 15v6"/>',
        other: '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
        task: '<path d="M9 5h10M9 12h10M9 19h10"/><circle cx="4" cy="5" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="19" r="1.2"/>',
        site: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/>',
        key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>',
        repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
        note: '<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        blocked: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>'
    };
    return `<svg ${common}>${paths[name] || paths.maintenance}</svg>`;
}
function dnsSummary(visitActive, clientActive) { if (visitActive && clientActive)
    return 'Visit and client warnings active'; if (clientActive)
    return 'Client-wide warning active'; return 'This visit is blocked'; }
function statusLabel(status) { if (status === 'scheduled')
    return 'Scheduled'; if (status === 'missed')
    return 'Missed'; if (status === 'suspended')
    return 'Suspended'; if (status === 'cancelled')
    return 'Cancelled'; if (status === 'completed')
    return 'Completed'; if (status === 'rescheduled')
    return 'Rescheduled'; return status || 'Visit'; }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=visitActionDialog.js.map