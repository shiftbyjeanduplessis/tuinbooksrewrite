import { accountForWork, defaultTaskOutcomes, holdForWork, locationForWork, makeSubmissionId, makeWorkRecordId, TASK_OUTCOMES, validateTaskOutcomes } from '../../domain/work.js';
export function openCompletionDialog(day, visit, onSubmit) {
    const account = accountForWork(day, visit.accountId), location = locationForWork(day, visit.serviceLocationId), hold = holdForWork(day, visit.accountId), tasks = defaultTaskOutcomes(visit);
    const dialog = document.createElement('dialog');
    dialog.className = 'mobile-dialog completion-dialog';
    dialog.innerHTML = `<form method="dialog" class="dialog-shell"><header><div><p class="eyebrow">Complete visit</p><h2>${esc(account?.name || 'Client')}</h2><p class="dialog-subtitle">${esc(location?.address || '')}${location?.suburb ? ` · ${esc(location.suburb)}` : ''}</p></div><button class="icon-button" value="cancel" aria-label="Close">×</button></header>${hold ? `<div class="mobile-stop"><strong>DO NOT SERVICE</strong><span>${esc(hold.note || hold.reason)}</span></div>` : ''}<section class="mobile-instructions">${location?.accessNotes ? `<div><strong>Access</strong><span>${esc(location.accessNotes)}</span></div>` : ''}${location?.instructions ? `<div><strong>Instructions</strong><span>${esc(location.instructions)}</span></div>` : ''}</section><div class="task-checklist" id="taskChecklist"></div><label>Visit note<textarea id="completionNote" rows="3" placeholder="Optional note for the office"></textarea></label><label>Photos<input id="completionPhotos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple><small>Optional. Up to the browser/device limit.</small></label><div id="completionError" class="dialog-error hidden"></div><footer><button value="cancel" class="secondary-button">Cancel</button><button type="button" class="primary-button" id="saveCompletion">Complete visit</button></footer></form>`;
    document.body.append(dialog);
    renderTasks();
    dialog.showModal();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    function renderTasks() { const host = dialog.querySelector('#taskChecklist'); host.innerHTML = tasks.map((row, index) => `<article class="task-row"><strong>${esc(row.task)}</strong><select data-task-outcome="${index}">${TASK_OUTCOMES.map(o => `<option${row.outcome === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select><input data-task-note="${index}" placeholder="Reason if not completed" value="${esc(row.note)}"></article>`).join(''); host.querySelectorAll('[data-task-outcome]').forEach(select => select.onchange = () => { tasks[Number(select.dataset.taskOutcome)].outcome = select.value; }); host.querySelectorAll('[data-task-note]').forEach(input => input.oninput = () => { tasks[Number(input.dataset.taskNote)].note = input.value; }); }
    dialog.querySelector('#saveCompletion').onclick = async () => { const error = dialog.querySelector('#completionError'), button = dialog.querySelector('#saveCompletion'), note = dialog.querySelector('#completionNote').value.trim(), files = [...dialog.querySelector('#completionPhotos').files ?? []], errors = validateTaskOutcomes(tasks); if (errors.length) {
        error.textContent = errors.join(' ');
        error.classList.remove('hidden');
        return;
    } error.classList.add('hidden'); button.disabled = true; button.textContent = files.length ? 'Uploading & saving…' : 'Saving…'; try {
        await onSubmit({ submissionId: makeSubmissionId(visit.id), workRecordId: makeWorkRecordId(day.date, visit.id), visitId: visit.id, taskOutcomes: tasks.map(x => ({ ...x })), note, photoPaths: [], files });
        dialog.close();
    }
    catch (e) {
        error.textContent = msg(e);
        error.classList.remove('hidden');
        button.disabled = false;
        button.textContent = 'Complete visit';
    } };
}
function msg(e) { return e instanceof Error ? e.message : String(e); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=completionDialog.js.map