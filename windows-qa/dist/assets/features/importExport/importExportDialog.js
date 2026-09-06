import { V4_SHEETS, importPreviewText, parseV4Sheets, v4RowsForExport } from '../../domain/business.js';
import { createXlsx, downloadBlob, readXlsx } from '../../lib/xlsx.js';
import { importV4Snapshot, loadV4ExportData } from './importExportRepository.js';
export function openImportExportDialog(identity) { let d = document.querySelector('#v2ImportExportDialog'); d?.remove(); d = document.createElement('dialog'); d.id = 'v2ImportExportDialog'; d.className = 'money-dialog import-dialog'; d.innerHTML = `<div class="dialog-shell"><header><div><p class="eyebrow">Business data</p><h2>v4 Import / Export</h2><p class="dialog-subtitle">Exact 8-sheet TuinBooks workbook contract. Import previews first; nothing writes until confirmed.</p></div><button data-close>×</button></header><section class="import-grid"><article><h3>Import v4 workbook</h3><input id="v4File" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><div id="v4Preview" class="import-preview">Choose a workbook.</div><button class="primary-button" id="v4Commit" disabled>Import business</button></article><article><h3>Export current business</h3><p>Creates the same 8-sheet v4 structure for round-trip use.</p><button id="v4Export">Export v4 workbook</button><div class="sheet-contract">${V4_SHEETS.map(s => `<span>${s}</span>`).join('')}</div></article></section></div>`; document.body.appendChild(d); let validation = null; const preview = d.querySelector('#v4Preview'), commit = d.querySelector('#v4Commit'); d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close()); d.querySelector('#v4File').onchange = async (e) => { const file = e.currentTarget.files?.[0]; if (!file)
    return; preview.textContent = 'Reading workbook…'; commit.disabled = true; try {
    validation = parseV4Sheets(await readXlsx(file));
    preview.innerHTML = `<strong>${esc(importPreviewText(validation))}</strong>${validation.errors.length ? `<ul class="error-list">${validation.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${validation.warnings.length ? `<details><summary>${validation.warnings.length} warning(s)</summary><ul>${validation.warnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}`;
    commit.disabled = !validation.ok || !!identity.demo;
}
catch (err) {
    validation = null;
    preview.innerHTML = `<div class="error-box">${esc(msg(err))}</div>`;
} }; commit.onclick = async () => { if (!validation?.snapshot)
    return; commit.disabled = true; commit.textContent = 'Importing…'; try {
    const result = await importV4Snapshot(identity.businessId, validation.snapshot);
    preview.innerHTML = `<div class="success-box"><strong>Import complete</strong><p>${esc(JSON.stringify(result))}</p></div>`;
}
catch (e) {
    preview.innerHTML = `<div class="error-box">${esc(msg(e))}</div>`;
}
finally {
    commit.textContent = 'Import business';
    commit.disabled = !validation?.ok || !!identity.demo;
} }; d.querySelector('#v4Export').onclick = async () => { const b = d.querySelector('#v4Export'); b.disabled = true; b.textContent = 'Building workbook…'; try {
    const data = identity.demo ? demoExport() : await loadV4ExportData(identity.businessId), rows = v4RowsForExport(data);
    downloadBlob(createXlsx(V4_SHEETS.map(name => ({ name, rows: rows[name] }))), `TuinBooks_${safe(data.business.name)}_v4.xlsx`);
}
catch (e) {
    preview.innerHTML = `<div class="error-box">${esc(msg(e))}</div>`;
}
finally {
    b.disabled = false;
    b.textContent = 'Export v4 workbook';
} }; d.showModal(); }
function demoExport() { return { business: { name: 'TuinBooks Demo', phone: '', email: '', address: '', suburb: 'George', province: 'Western Cape', vatRegistered: false, vatNumber: '', mode: 'financials', weekAStartsOn: '2026-08-31', invoiceDay: 28, paymentTermsDays: 7, invoicePrefix: 'INV-', statementMessage: '', emailFromName: '', whatsappMessage: '' }, services: [{ id: 'svc', name: 'Routine Garden Service', notes: '', active: true }], teams: [{ id: 't1', name: 'Daniel', capacityHours: 8, bufferHours: 1, active: true }], accounts: [{ name: 'Demo Client', contactName: '', phone: '', email: '', invoiceMethod: 'By Account', billingBasis: 'Monthly fixed fee', billingAmount: 450, invoiceDay: 28, billingNotes: '' }], locations: [{ accountName: 'Demo Client', locationName: 'Home', address: '1 Garden Road', suburb: 'George', team: 'Daniel', service: 'Routine Garden Service', frequency: 'weekly', weekdays: [1], fortnightlyCycle: null, monthlyOrdinal: null, startDate: '2026-09-07', locationBillingBasis: '', locationBillingAmount: null, routePreference: 'Normal', routingNotes: '', accessNotes: '' }], routes: [] }; }
function safe(s) { return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Business'; }
function msg(e) { return e instanceof Error ? e.message : String(e); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=importExportDialog.js.map