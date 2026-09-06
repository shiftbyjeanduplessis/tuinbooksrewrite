import { accountForWork, locationForWork, makeOpportunityId, OPPORTUNITY_CATEGORIES } from '../../domain/work.js';
export function openOpportunityDialog(day, visit, workRecordId, onSubmit) {
    const account = accountForWork(day, visit.accountId), location = locationForWork(day, visit.serviceLocationId), dialog = document.createElement('dialog');
    dialog.className = 'mobile-dialog';
    dialog.innerHTML = `<form method="dialog" class="dialog-shell"><header><div><p class="eyebrow">Opportunity</p><h2>${esc(account?.name || 'Client')}</h2><p class="dialog-subtitle">${esc(location?.address || '')}</p></div><button class="icon-button" value="cancel">×</button></header><label>Category<select id="oppCategory">${OPPORTUNITY_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></label><label>What did you notice?<textarea id="oppNote" rows="4" required></textarea></label><label>Photos<input id="oppPhotos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple></label><div id="oppError" class="dialog-error hidden"></div><footer><button value="cancel" class="secondary-button">Cancel</button><button type="button" class="primary-button" id="saveOpp">Send to office</button></footer></form>`;
    document.body.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.querySelector('#saveOpp').onclick = async () => { const note = dialog.querySelector('#oppNote').value.trim(), error = dialog.querySelector('#oppError'), button = dialog.querySelector('#saveOpp'); if (!note) {
        error.textContent = 'Add a short note.';
        error.classList.remove('hidden');
        return;
    } button.disabled = true; button.textContent = 'Sending…'; try {
        await onSubmit({ id: makeOpportunityId(visit.id), visitId: visit.id, workRecordId, category: dialog.querySelector('#oppCategory').value, note, photoPaths: [], files: [...dialog.querySelector('#oppPhotos').files ?? []] });
        dialog.close();
    }
    catch (e) {
        error.textContent = e instanceof Error ? e.message : String(e);
        error.classList.remove('hidden');
        button.disabled = false;
        button.textContent = 'Send to office';
    } };
}
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=opportunityDialog.js.map