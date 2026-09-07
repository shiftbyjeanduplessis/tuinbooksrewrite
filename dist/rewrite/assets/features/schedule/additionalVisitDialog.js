export function openAdditionalVisitDialog(context, onSave) {
    const existing = document.getElementById('additionalVisitDialogV2');
    existing?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'additionalVisitDialogV2';
    dialog.className = 'additional-dialog';
    document.body.append(dialog);
    const eligible = context.accounts.filter(a => a.status === 'active');
    dialog.innerHTML = `<form method="dialog" class="dialog-shell" id="additionalVisitFormV2"><header><div><p class="eyebrow">Additional visit</p><h2>Add to this route</h2></div><button type="button" data-close class="icon-button" aria-label="Close">×</button></header><p class="muted">Date and team come from the calendar position. Billing is decided later.</p><label>Existing routine client<input id="additionalClientSearchV2" autocomplete="off" placeholder="Client name, address or suburb"></label><div id="additionalClientResultsV2" class="client-results"></div><input id="additionalClientIdV2" type="hidden"><label>Service / task<input id="additionalTaskV2" placeholder="e.g. Extra garden clean-up"></label><label>Notes<textarea id="additionalNotesV2" rows="3"></textarea></label><div id="additionalErrorV2" class="error-box hidden"></div><footer><button type="button" data-close class="secondary-button">Cancel</button><button type="submit" id="additionalSaveV2" class="primary-button" disabled>Add visit</button></footer></form>`;
    const search = dialog.querySelector('#additionalClientSearchV2'), results = dialog.querySelector('#additionalClientResultsV2'), clientId = dialog.querySelector('#additionalClientIdV2'), save = dialog.querySelector('#additionalSaveV2'), error = dialog.querySelector('#additionalErrorV2');
    const locationText = (accountId) => context.locations.filter(s => s.accountId === accountId && s.active).map(s => `${s.address} ${s.suburb}`).join(' ');
    const render = () => { const term = search.value.trim().toLowerCase(); const rows = eligible.filter(a => !term || `${a.name} ${locationText(a.id)}`.toLowerCase().includes(term)).slice(0, 25); results.innerHTML = rows.map(a => { const loc = context.locations.find(s => s.accountId === a.id && s.active); return `<button type="button" data-client="${esc(a.id)}"><strong>${esc(a.name)}</strong><small>${esc([loc?.address, loc?.suburb].filter(Boolean).join(' · ') || 'No address')}</small></button>`; }).join('') || '<p class="muted">No matching active routine clients.</p>'; results.querySelectorAll('[data-client]').forEach(btn => btn.onclick = () => { clientId.value = btn.dataset.client || ''; const a = eligible.find(row => row.id === clientId.value); search.value = a?.name || ''; save.disabled = !clientId.value; render(); }); };
    search.addEventListener('input', () => { clientId.value = ''; save.disabled = true; render(); });
    render();
    dialog.querySelectorAll('[data-close]').forEach(button => button.onclick = () => dialog.close('cancel'));
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('cancel'); });
    dialog.addEventListener('pointerdown', event => { if (event.target !== dialog)
        return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
        dialog.close('cancel'); });
    dialog.querySelector('#additionalVisitFormV2').addEventListener('submit', async (e) => { e.preventDefault(); if (!clientId.value)
        return; save.disabled = true; error.classList.add('hidden'); try {
        const loc = context.locations.find(s => s.accountId === clientId.value && s.active) || null;
        await onSave({ id: `sch-v2-${crypto.randomUUID()}`, date: context.date, teamId: context.teamId, sortOrder: context.sortOrder, accountId: clientId.value, serviceLocationId: loc?.id || null, task: dialog.querySelector('#additionalTaskV2').value, notes: dialog.querySelector('#additionalNotesV2').value });
        dialog.close('saved');
    }
    catch (err) {
        error.textContent = err instanceof Error ? err.message : String(err);
        error.classList.remove('hidden');
        save.disabled = false;
    } });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();
    setTimeout(() => search.focus(), 0);
}
function esc(v) { return v.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=additionalVisitDialog.js.map