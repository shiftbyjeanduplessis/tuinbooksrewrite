import { supabase } from './lib/supabase.js';
import { currentStaff, listManagedBusinesses, setSupportGrant } from './features/management/managementRepository.js';
const root = document.getElementById('root');
if (!root)
    throw new Error('Management root missing.');
let rows = [];
async function boot() { root.innerHTML = '<main class="boot-screen"><div class="spinner"></div><strong>Opening Management…</strong></main>'; const { data } = await supabase.auth.getSession(); if (!data.session) {
    root.innerHTML = `<main class="login-page"><form class="login-card" id="mgmtLogin"><img src="./tuinbooks-logo.png" class="login-logo"><p class="eyebrow">Management</p><h1>Platform sign in</h1><label>Email<input id="email" type="email" required></label><label>Password<input id="password" type="password" required></label><button class="primary-button">Sign in</button><div id="err"></div></form></main>`;
    root.querySelector('#mgmtLogin').onsubmit = async (e) => { e.preventDefault(); const email = root.querySelector('#email').value, password = root.querySelector('#password').value, { error } = await supabase.auth.signInWithPassword({ email, password }); if (error)
        root.querySelector('#err').textContent = error.message;
    else
        await boot(); };
    return;
} try {
    const staff = await currentStaff();
    await render(staff);
}
catch (e) {
    root.innerHTML = `<main class="login-page"><section class="login-card"><h1>Management unavailable</h1><div class="error-box">${esc(msg(e))}</div><button id="out">Sign out</button></section></main>`;
    root.querySelector('#out').onclick = async () => { await supabase.auth.signOut(); boot(); };
} }
async function render(staff) { root.innerHTML = `<div class="management-shell"><header class="topbar"><div class="brand"><img src="./tuinbooks-logo.png"><div><strong>TuinBooks Management</strong><span>${esc(String(staff?.displayName ?? staff?.staffRole ?? 'Platform staff'))}</span></div></div><div class="management-search"><input id="search" placeholder="Search businesses"><button id="refresh">Search</button></div><button id="signOut" class="text-button">Sign out</button></header><main class="management-page"><div id="businesses" class="management-grid"></div></main></div>`; root.querySelector('#signOut').onclick = async () => { await supabase.auth.signOut(); boot(); }; root.querySelector('#refresh').onclick = () => load(); root.querySelector('#search').onkeydown = e => { if (e.key === 'Enter')
    load(); }; await load(); }
async function load() { const host = root.querySelector('#businesses'); host.innerHTML = '<div class="loading-state">Loading businesses…</div>'; try {
    rows = await listManagedBusinesses(root.querySelector('#search')?.value ?? '');
    host.innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty-state">No businesses found.</div>';
    host.querySelectorAll('[data-grant]').forEach(b => b.onclick = () => openGrant(b.dataset.grant));
}
catch (e) {
    host.innerHTML = `<div class="error-box">${esc(msg(e))}</div>`;
} }
function card(b) { return `<article class="management-card"><header><div><h2>${esc(b.name)}</h2><span>${esc(b.email || b.phone || b.id)}</span></div><span class="status-pill ${b.support?.status === 'active' ? '' : 'alert'}">${b.support?.status === 'active' ? 'Support active' : 'No active support'}</span></header><div class="health-grid"><div><b>${b.health.clients}</b><span>Clients</span></div><div><b>${b.health.locations}</b><span>Locations</span></div><div><b>${b.health.teams}</b><span>Teams</span></div><div><b>${b.health.futureVisits}</b><span>Future visits</span></div><div><b>${b.health.openInvoices}</b><span>Open invoices</span></div></div><footer><small>${b.onboardingComplete ? 'Onboarding complete' : 'Onboarding incomplete'} · ${esc(b.id)}</small><button data-grant="${esc(b.id)}">Support access</button></footer></article>`; }
function openGrant(id) { const b = rows.find(x => x.id === id); if (!b)
    return; const g = b.support; const d = document.createElement('dialog'); d.className = 'money-dialog'; d.innerHTML = `<form method="dialog" class="dialog-shell"><header><div><p class="eyebrow">Support access</p><h2>${esc(b.name)}</h2></div><button value="cancel">×</button></header><p>Support grants are explicit, scoped and revocable. They do not create a business membership.</p><div class="form-grid two"><label>Expires<input id="expires" type="datetime-local" value="${g?.expiresAt ? esc(g.expiresAt.slice(0, 16)) : ''}"></label><label class="check"><input id="opRead" type="checkbox" ${g?.operationalRead !== false ? 'checked' : ''}> Operational read</label><label class="check"><input id="opEdit" type="checkbox" ${g?.operationalEdit ? 'checked' : ''}> Operational edit</label><label class="check"><input id="finRead" type="checkbox" ${g?.financialRead ? 'checked' : ''}> Financial read</label><label class="check"><input id="finEdit" type="checkbox" ${g?.financialEdit ? 'checked' : ''}> Financial edit</label></div><footer><button value="cancel">Cancel</button><button type="button" id="revoke">Revoke</button><button type="button" class="primary-button" id="save">Save grant</button></footer></form>`; document.body.appendChild(d); const save = async (status) => { const val = (q) => d.querySelector(q); try {
    await setSupportGrant(id, { status, expiresAt: val('#expires').value ? new Date(val('#expires').value).toISOString() : null, operationalRead: val('#opRead').checked, operationalEdit: val('#opEdit').checked, financialRead: val('#finRead').checked, financialEdit: val('#finEdit').checked });
    d.close();
    d.remove();
    await load();
}
catch (e) {
    alert(msg(e));
} }; d.querySelector('#save').onclick = () => save('active'); d.querySelector('#revoke').onclick = () => save('revoked'); d.addEventListener('close', () => d.remove(), { once: true }); d.showModal(); }
function msg(e) { return e instanceof Error ? e.message : String(e); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
void boot();
//# sourceMappingURL=managementApp.js.map