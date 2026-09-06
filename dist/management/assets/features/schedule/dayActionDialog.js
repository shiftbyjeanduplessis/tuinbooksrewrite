export function openDayActionDialog(kind, date, teamId, teams, existing, onSave, onRemove) {
    const note = kind === 'team_note', d = document.createElement('dialog');
    d.className = 'operation-dialog';
    document.body.append(d);
    const options = teams.map(t => `<option value="${esc(t.id)}" ${t.id === (existing?.teamId || teamId) ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    d.innerHTML = `<form class="dialog-shell"><header><div><p class="eyebrow">Team-day operations</p><h2>${existing ? 'Edit' : 'New'} ${note ? 'day instruction' : 'ad-hoc event'}</h2></div><button type="button" class="icon-button" data-close>×</button></header><div class="form-grid"><label>Date<input data-date type="date" required value="${esc(existing?.date || date)}"></label><label>Team<select data-team>${options}</select></label>${note ? '' : `<label>Time<input data-time type="time" value="${esc(existing?.time || '')}"></label><label>Event title<input data-title required value="${esc(existing?.title || '')}"></label>`}<label class="span-two">${note ? 'Instruction' : 'Details'}<textarea data-detail rows="4" ${note ? 'required' : ''}>${esc(existing?.detail || '')}</textarea></label></div><footer>${existing ? '<button type="button" class="danger-button" data-remove>Remove</button>' : '<span></span>'}<div><button type="button" class="secondary-button" data-close>Cancel</button><button class="primary-button" type="submit">Save</button></div></footer></form>`;
    const close = () => d.close();
    d.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    d.addEventListener('close', () => d.remove(), { once: true });
    d.querySelector('[data-remove]')?.addEventListener('click', () => existing && void onRemove(existing.id).then(close));
    d.querySelector('form').onsubmit = e => { e.preventDefault(); const input = { id: existing?.id || `action-v2-${crypto.randomUUID()}`, date: d.querySelector('[data-date]').value, teamId: d.querySelector('[data-team]').value, kind, title: note ? 'Day instruction' : d.querySelector('[data-title]').value.trim(), detail: d.querySelector('[data-detail]').value.trim(), time: note ? '' : d.querySelector('[data-time]').value }; if (note && !input.detail)
        return; if (!note && !input.title)
        return; void onSave(input).then(close); };
    d.showModal();
}
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=dayActionDialog.js.map