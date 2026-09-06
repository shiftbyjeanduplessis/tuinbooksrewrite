import { visitDoNotService } from '../../domain/operations.js';
export function openVisitActionDialog(visit, account, teams, hold, callbacks) {
    const d = document.createElement('dialog');
    d.className = 'operation-dialog visit-control-dialog';
    document.body.append(d);
    const status = String(visit.status).toLowerCase();
    const visitDns = visitDoNotService(visit);
    const teamOptions = teams.map(t => `<option value="${esc(t.id)}" ${t.id === visit.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    const clientName = account?.name || visit.accountId;
    d.innerHTML = `<form class="dialog-shell">
    <header class="visit-dialog-head"><div><p class="eyebrow">Visit</p><h2>${esc(clientName)}</h2><p class="scope-copy">${esc(visit.date)} · ${esc(statusLabel(status))}</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></header>

    ${(visitDns.active || hold) ? `<div class="dialog-warning-stack">${visitDns.active ? `<div class="dialog-warning visit-dns"><strong>DO NOT SERVICE — THIS VISIT</strong><span>${esc([visitDns.reason, visitDns.note].filter(Boolean).join(' · '))}</span></div>` : ''}${hold ? `<div class="dialog-warning client-dns"><strong>DO NOT SERVICE — CLIENT</strong><span>${esc([hold.reason, hold.note].filter(Boolean).join(' · '))}</span></div>` : ''}</div>` : ''}

    ${status === 'missed' ? `<section class="dialog-section missed-resolution-section">
      <div class="dialog-section-title"><strong>Resolve missed visit</strong><span>Choose the actual outcome. The original visit stays in history.</span></div>
      <div class="missed-resolution-grid">
        <button type="button" data-op="missed-complete" class="resolution-choice completed"><b>It was completed</b><span>Office confirms the visit happened and records it in Work.</span></button>
        <button type="button" data-op="reschedule" class="resolution-choice catchup"><b>Reschedule / catch-up</b><span>Create a linked replacement visit. Keep the original missed visit in history.</span></button>
        <button type="button" data-op="missed-no-return" class="resolution-choice no-return"><b>No catch-up / no charge</b><span>Close the missed visit with no replacement and no charge.</span></button>
      </div>
    </section>` : `<section class="dialog-section">
      <div class="dialog-section-title"><strong>Visit actions</strong><span>Changes apply to this visit only unless stated otherwise.</span></div>
      <div class="operation-grid compact-operation-grid">
        ${status === 'scheduled' ? `${visitDns.active ? `<button type="button" data-op="clear-visit-dns" class="dns-primary-action"><b>Clear Do not service</b><span>Allow this visit to be serviced again</span></button>` : `<button type="button" data-op="visit-dns" class="dns-primary-action"><b>Do not service this visit</b><span>Block this occurrence only. Future recurrence is unchanged.</span></button>`}<button type="button" data-op="cancel-no"><b>Cancel visit</b><span>Do not charge</span></button><button type="button" data-op="cancel-charge"><b>Cancel visit</b><span>Charge</span></button><button type="button" data-op="missed"><b>Mark missed</b><span>Keep in history for resolution</span></button><button type="button" data-op="suspend"><b>Suspend visit</b><span>Pause this occurrence</span></button>` : ''}
        ${status === 'suspended' ? `<button type="button" data-op="resume"><b>Resume visit</b><span>Return to scheduled</span></button>` : ''}
        ${status === 'cancelled' ? `<button type="button" data-op="undo-cancel"><b>Undo cancellation</b><span>Restore this visit</span></button>` : ''}
      </div>
    </section>`}

    <section class="dialog-section dns-controls-section client-dns-section">
      <div class="dialog-section-title"><strong>Client-level Do not service</strong><span>This is different from blocking one visit. It applies until cleared.</span></div>
      <div class="operation-grid compact-operation-grid">
        ${hold ? `<button type="button" data-op="clear-hold"><b>Clear client warning</b><span>Allow future visits again</span></button>` : `<button type="button" data-op="hold"><b>Do not service client</b><span>Block the client until the warning is cleared</span></button>`}
      </div>
    </section>

    <section class="operation-fields hidden" data-reason-panel><label>Reason / note<textarea data-reason rows="3" placeholder="Optional note for office and field team"></textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-reason-cancel>Back</button><button type="button" class="primary-button" data-reason-save>Confirm</button></div></section>
    <section class="operation-fields hidden" data-missed-resolution-panel><label>Office note<textarea data-missed-resolution-note rows="3" placeholder="Optional reason or confirmation note"></textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-missed-resolution-cancel>Back</button><button type="button" class="primary-button" data-missed-resolution-save>Confirm outcome</button></div></section>
    <section class="operation-fields hidden" data-reschedule-panel><label>New date<input data-new-date type="date" value="${esc(visit.date)}"></label><label>Team<select data-new-team>${teamOptions}</select></label><div class="dialog-actions"><button type="button" class="secondary-button" data-reschedule-cancel>Back</button><button type="button" class="primary-button" data-reschedule-save>Reschedule</button></div></section>
    <section class="operation-fields hidden" data-dns-panel><label>Reason<input data-dns-reason value="${esc(visitDns.reason || 'Do not service this visit')}"></label><label>Note<textarea data-dns-note rows="3">${esc(visitDns.note || '')}</textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-dns-cancel>Back</button><button type="button" class="primary-button" data-dns-save>Save visit warning</button></div></section>
    <section class="operation-fields hidden" data-hold-panel><label>Reason<input data-hold-reason value="${esc(hold?.reason || 'Do not service')}"></label><label>Note<textarea data-hold-note rows="3">${esc(hold?.note || '')}</textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-hold-cancel>Back</button><button type="button" class="primary-button" data-hold-save>Save client warning</button></div></section>
  </form>`;
    const close = () => d.close();
    d.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    d.addEventListener('close', () => d.remove(), { once: true });
    const sections = Array.from(d.querySelectorAll('.dialog-section'));
    const reasonPanel = d.querySelector('[data-reason-panel]');
    const missedResolutionPanel = d.querySelector('[data-missed-resolution-panel]');
    const reschedulePanel = d.querySelector('[data-reschedule-panel]');
    const dnsPanel = d.querySelector('[data-dns-panel]');
    const holdPanel = d.querySelector('[data-hold-panel]');
    let pending = '';
    const showPanel = (panel) => { sections.forEach(s => s.classList.add('hidden')); for (const p of [reasonPanel, missedResolutionPanel, reschedulePanel, dnsPanel, holdPanel])
        p.classList.add('hidden'); panel.classList.remove('hidden'); };
    const showSections = () => { for (const p of [reasonPanel, missedResolutionPanel, reschedulePanel, dnsPanel, holdPanel])
        p.classList.add('hidden'); sections.forEach(s => s.classList.remove('hidden')); };
    d.querySelectorAll('[data-op]').forEach(button => button.onclick = () => {
        const op = button.dataset.op || '';
        if (['cancel-no', 'cancel-charge', 'missed', 'suspend'].includes(op)) {
            pending = op;
            showPanel(reasonPanel);
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
        if (op === 'clear-visit-dns') {
            void callbacks.onVisitDoNotService(visit.id, false, visitDns.reason, visitDns.note).then(close);
            return;
        }
        if (op === 'hold') {
            showPanel(holdPanel);
            return;
        }
        if (op === 'clear-hold') {
            void callbacks.onClientHold(visit.accountId, false, hold?.reason || 'Do not service', hold?.note || '').then(close);
        }
    });
    d.querySelector('[data-reason-cancel]').onclick = showSections;
    d.querySelector('[data-reason-save]').onclick = () => { const reason = (d.querySelector('[data-reason]').value || '').trim(); if (pending === 'cancel-no')
        void callbacks.onCancel(visit.id, 'no-charge', reason).then(close); if (pending === 'cancel-charge')
        void callbacks.onCancel(visit.id, 'charge', reason).then(close); if (pending === 'missed')
        void callbacks.onMissed(visit.id, reason).then(close); if (pending === 'suspend')
        void callbacks.onSuspend([visit.id], true, reason).then(close); };
    d.querySelector('[data-missed-resolution-cancel]').onclick = showSections;
    d.querySelector('[data-missed-resolution-save]').onclick = () => { const note = (d.querySelector('[data-missed-resolution-note]').value || '').trim(); if (pending === 'missed-complete')
        void callbacks.onResolveMissed(visit.id, 'complete', note).then(close); if (pending === 'missed-no-return')
        void callbacks.onResolveMissed(visit.id, 'no-return', note).then(close); };
    d.querySelector('[data-reschedule-cancel]').onclick = showSections;
    d.querySelector('[data-reschedule-save]').onclick = () => { const date = d.querySelector('[data-new-date]').value, teamId = d.querySelector('[data-new-team]').value; if (!date || !teamId)
        return; void callbacks.onReschedule({ visitId: visit.id, newVisitId: `sch-v2-rescheduled-${crypto.randomUUID()}`, date, teamId, sortOrder: visit.sortOrder }).then(close); };
    d.querySelector('[data-dns-cancel]').onclick = showSections;
    d.querySelector('[data-dns-save]').onclick = () => { const reason = d.querySelector('[data-dns-reason]').value.trim() || 'Do not service this visit', note = d.querySelector('[data-dns-note]').value.trim(); void callbacks.onVisitDoNotService(visit.id, true, reason, note).then(close); };
    d.querySelector('[data-hold-cancel]').onclick = showSections;
    d.querySelector('[data-hold-save]').onclick = () => { const reason = d.querySelector('[data-hold-reason]').value.trim() || 'Do not service', note = d.querySelector('[data-hold-note]').value.trim(); void callbacks.onClientHold(visit.accountId, true, reason, note).then(close); };
    d.showModal();
}
function statusLabel(status) { if (status === 'scheduled')
    return 'Scheduled'; if (status === 'missed')
    return 'Missed'; if (status === 'suspended')
    return 'Suspended'; if (status === 'cancelled')
    return 'Cancelled'; if (status === 'completed')
    return 'Completed'; if (status === 'rescheduled')
    return 'Rescheduled'; return status || 'Visit'; }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=visitActionDialog.js.map