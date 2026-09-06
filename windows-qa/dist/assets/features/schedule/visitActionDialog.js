export function openVisitActionDialog(visit, account, teams, hold, callbacks) {
    const d = document.createElement('dialog');
    d.className = 'operation-dialog';
    document.body.append(d);
    const status = String(visit.status).toLowerCase();
    const teamOptions = teams.map(t => `<option value="${esc(t.id)}" ${t.id === visit.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    d.innerHTML = `<form class="dialog-shell"><header><div><p class="eyebrow">Visit actions</p><h2>${esc(account?.name || visit.accountId)}</h2><p class="scope-copy">${esc(visit.date)} · ${esc(status)}</p></div><button type="button" class="icon-button" data-close>×</button></header>
  <section class="operation-grid">
    ${status === 'scheduled' ? `<button type="button" data-op="cancel-no">Cancel visit – do not charge</button><button type="button" data-op="cancel-charge">Cancel visit – charge</button><button type="button" data-op="missed">Mark missed</button><button type="button" data-op="suspend">Suspend visit</button>` : ''}
    ${status === 'missed' ? `<button type="button" data-op="reschedule">Reschedule missed visit</button><button type="button" data-op="cancel-no">Cancel visit – do not charge</button>` : ''}
    ${status === 'suspended' ? `<button type="button" data-op="resume">Resume visit</button>` : ''}
    ${status === 'cancelled' ? `<button type="button" data-op="undo-cancel">Undo cancellation</button>` : ''}
    ${hold ? `<button type="button" data-op="clear-hold">Remove DO NOT SERVICE</button>` : `<button type="button" data-op="hold">Mark client – DO NOT SERVICE</button>`}
  </section>
  <section class="operation-fields hidden" data-reason-panel><label>Reason / note<textarea data-reason rows="3"></textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-reason-cancel>Back</button><button type="button" class="primary-button" data-reason-save>Confirm</button></div></section>
  <section class="operation-fields hidden" data-reschedule-panel><label>New date<input data-new-date type="date" value="${esc(visit.date)}"></label><label>Team<select data-new-team>${teamOptions}</select></label><div class="dialog-actions"><button type="button" class="secondary-button" data-reschedule-cancel>Back</button><button type="button" class="primary-button" data-reschedule-save>Reschedule</button></div></section>
  <section class="operation-fields hidden" data-hold-panel><label>Reason<input data-hold-reason value="${esc(hold?.reason || 'Do not service')}"></label><label>Note<textarea data-hold-note rows="3">${esc(hold?.note || '')}</textarea></label><div class="dialog-actions"><button type="button" class="secondary-button" data-hold-cancel>Back</button><button type="button" class="primary-button" data-hold-save>Save warning</button></div></section>
  </form>`;
    const close = () => d.close();
    d.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    d.addEventListener('close', () => d.remove(), { once: true });
    let pending = '';
    const panel = d.querySelector('[data-reason-panel]');
    const operations = d.querySelector('.operation-grid');
    const show = (el) => { operations.classList.add('hidden'); panel.classList.add('hidden'); d.querySelector('[data-reschedule-panel]').classList.add('hidden'); d.querySelector('[data-hold-panel]').classList.add('hidden'); el.classList.remove('hidden'); };
    d.querySelectorAll('[data-op]').forEach(button => button.onclick = () => { const op = button.dataset.op || ''; if (['cancel-no', 'cancel-charge', 'missed', 'suspend'].includes(op)) {
        pending = op;
        show(panel);
        return;
    } if (op === 'resume') {
        void callbacks.onSuspend([visit.id], false, '').then(close);
        return;
    } if (op === 'undo-cancel') {
        void callbacks.onUndoCancel(visit.id).then(close);
        return;
    } if (op === 'reschedule') {
        show(d.querySelector('[data-reschedule-panel]'));
        return;
    } if (op === 'hold') {
        show(d.querySelector('[data-hold-panel]'));
        return;
    } if (op === 'clear-hold') {
        void callbacks.onClientHold(visit.accountId, false, hold?.reason || 'Do not service', hold?.note || '').then(close);
    } });
    d.querySelector('[data-reason-cancel]').onclick = () => { panel.classList.add('hidden'); operations.classList.remove('hidden'); };
    d.querySelector('[data-reason-save]').onclick = () => { const reason = (d.querySelector('[data-reason]').value || '').trim(); if (pending === 'cancel-no')
        void callbacks.onCancel(visit.id, 'no-charge', reason).then(close); if (pending === 'cancel-charge')
        void callbacks.onCancel(visit.id, 'charge', reason).then(close); if (pending === 'missed')
        void callbacks.onMissed(visit.id, reason).then(close); if (pending === 'suspend')
        void callbacks.onSuspend([visit.id], true, reason).then(close); };
    d.querySelector('[data-reschedule-cancel]').onclick = () => { d.querySelector('[data-reschedule-panel]').classList.add('hidden'); operations.classList.remove('hidden'); };
    d.querySelector('[data-reschedule-save]').onclick = () => { const date = d.querySelector('[data-new-date]').value, teamId = d.querySelector('[data-new-team]').value; if (!date || !teamId)
        return; void callbacks.onReschedule({ visitId: visit.id, newVisitId: `sch-v2-rescheduled-${crypto.randomUUID()}`, date, teamId, sortOrder: visit.sortOrder }).then(close); };
    d.querySelector('[data-hold-cancel]').onclick = () => { d.querySelector('[data-hold-panel]').classList.add('hidden'); operations.classList.remove('hidden'); };
    d.querySelector('[data-hold-save]').onclick = () => { const reason = d.querySelector('[data-hold-reason]').value.trim() || 'Do not service', note = d.querySelector('[data-hold-note]').value.trim(); void callbacks.onClientHold(visit.accountId, true, reason, note).then(close); };
    d.showModal();
}
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=visitActionDialog.js.map