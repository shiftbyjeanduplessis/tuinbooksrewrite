import { addDays, todayIso } from './domain/dates.js';
import { accountForWork, canCompleteTeam, completeVisitOptimistically, holdForWork, locationForWork, mobileVisibleTeams, mobileVisibleVisits, opportunitiesForVisit, recordsForVisit, tasksForVisit, teamProgress } from './domain/work.js';
import { supabase } from './lib/supabase.js';
import { demoWorkDay } from './features/work/demoWork.js';
import { completeVisit, createOpportunity, loadMobileContext, loadWorkDay, uploadWorkPhotos } from './features/work/workRepository.js';
import { openCompletionDialog } from './features/work/completionDialog.js';
import { openOpportunityDialog } from './features/work/opportunityDialog.js';
import { demoClientWorkspace } from './features/clients/demoClients.js';
import { loadClientWorkspace } from './features/clients/clientsRepository.js';
import { demoMoneyWorkspace } from './features/billing/demoMoney.js';
import { loadMoneyWorkspace } from './features/billing/moneyRepository.js';
import { invoiceBalance, moneySummary, quoteTotal } from './domain/billing.js';
const root = document.getElementById('root');
if (!root)
    throw new Error('Mobile root missing.');
const demoParam = new URLSearchParams(location.search).get('demo');
let context = null, day = null, date = todayIso(), tab = 'work';
async function boot() { if (demoParam === 'field' || demoParam === 'owner') {
    context = { businessId: 'demo', businessName: 'TuinBooks Demo', userId: 'demo', displayName: demoParam === 'owner' ? 'Demo Owner' : 'Demo Field Phone', profile: demoParam === 'owner' ? 'owner_mobile' : 'field_worker', assignedTeamIds: demoParam === 'owner' ? ['team-1', 'team-2', 'team-3'] : ['team-1'] };
    renderShell();
    await loadDay();
    return;
} root.innerHTML = '<main class="mobile-boot"><div class="spinner"></div><strong>Opening mobile…</strong></main>'; try {
    context = await loadMobileContext();
    if (!context) {
        renderMobileGateway();
        return;
    }
    renderShell();
    await loadDay();
}
catch {
    renderMobileGateway();
} }
function renderMobileGateway() { root.innerHTML = `<main class="mobile-gateway"><img src="./tuinbooks-logo.png" alt="TuinBooks"><p class="eyebrow">TuinBooks Mobile v2</p><h1>Open your mobile workspace</h1><section class="mobile-auth-card"><h2>Owner</h2><p>Sign in with your TuinBooks owner/admin account.</p><input id="mobileEmail" type="email" placeholder="Email"><input id="mobilePassword" type="password" placeholder="Password"><button id="mobileOwnerSignIn" class="primary-button">Sign in</button></section><div class="mobile-or">or</div><section class="mobile-auth-card"><h2>Field phone</h2><p>Enter the 4-digit PIN created by the office.</p><input id="mobilePin" inputmode="numeric" maxlength="4" placeholder="0000"><button id="mobilePair" class="primary-button">Pair phone</button></section><div id="mobileAuthError" class="error-box hidden"></div></main>`; const error = root.querySelector('#mobileAuthError'); root.querySelector('#mobileOwnerSignIn').onclick = async () => { error.classList.add('hidden'); const email = root.querySelector('#mobileEmail').value, password = root.querySelector('#mobilePassword').value; const result = await supabase.auth.signInWithPassword({ email, password }); if (result.error) {
    show(result.error.message);
    return;
} context = await loadMobileContext(); if (!context) {
    show('This account does not have mobile access.');
    return;
} renderShell(); await loadDay(); }; root.querySelector('#mobilePair').onclick = async () => { error.classList.add('hidden'); let session = (await supabase.auth.getSession()).data.session; if (!session) {
    const anon = await supabase.auth.signInAnonymously();
    if (anon.error) {
        show(anon.error.message);
        return;
    }
    session = anon.data.session;
} const pin = root.querySelector('#mobilePin').value.trim(); const result = await supabase.rpc('tuinbooks_v2_claim_field_pin', { p_pin: pin, p_device_name: 'TuinBooks v2 field phone' }); if (result.error) {
    show(result.error.message);
    return;
} if (!result.data?.business_id) {
    show('PIN was not accepted. Check the code with the office.');
    return;
} context = await loadMobileContext(); if (!context) {
    show('Phone paired but mobile profile could not be loaded.');
    return;
} renderShell(); await loadDay(); }; function show(message) { error.textContent = message; error.classList.remove('hidden'); } }
function renderShell() { if (!context)
    return; root.innerHTML = `<div class="mobile-app"><header class="mobile-topbar"><div><img src="./tuinbooks-logo.png" alt=""><span>${esc(context.businessName)}</span></div><button id="mobileRefresh" aria-label="Refresh">↻</button></header><main id="mobileMain"></main><nav class="mobile-nav"><button data-tab="work" class="active">Work</button>${context.profile === 'owner_mobile' ? '<button data-tab="clients">Clients</button><button data-tab="quotes">Quotes</button><button data-tab="money">Money</button>' : ''}</nav></div>`; root.querySelector('#mobileRefresh').onclick = () => void (tab === 'work' ? loadDay() : tab === 'clients' ? renderClients() : renderOwnerMoney(tab)); root.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === button)); if (tab === 'work')
    void loadDay();
else if (tab === 'clients')
    void renderClients();
else
    void renderOwnerMoney(tab); }); }
async function loadDay() { if (!context)
    return; const main = root.querySelector('#mobileMain'); if (!main)
    return; main.innerHTML = '<div class="mobile-loading">Loading work…</div>'; try {
    day = demoParam ? demoWorkDay(date) : await loadWorkDay(context.businessId, date);
    renderWork();
}
catch (e) {
    main.innerHTML = `<div class="mobile-error"><strong>Could not load work.</strong><span>${esc(msg(e))}</span><button id="mobileRetry">Retry</button></div>`;
    main.querySelector('#mobileRetry').onclick = () => void loadDay();
} }
function renderWork() { if (!context || !day)
    return; const main = root.querySelector('#mobileMain'), teams = mobileVisibleTeams(context.profile, day.teams, context.assignedTeamIds), visits = mobileVisibleVisits(context.profile, day.visits, context.assignedTeamIds), owner = context.profile === 'owner_mobile'; main.innerHTML = `<section class="mobile-page-head"><p class="eyebrow">${owner ? 'Owner Mobile' : 'Field Worker'}</p><h1>${formatDate(date)}</h1><p>${owner ? 'All teams · operational view' : 'Assigned route only'}</p></section>${owner ? `<div class="mobile-day-nav"><button id="mPrev">←</button><button id="mToday">Today</button><button id="mNext">→</button></div>` : ''}<div id="mobileTeams"></div>`; if (owner) {
    main.querySelector('#mPrev').onclick = () => { date = addDays(date, -1); void loadDay(); };
    main.querySelector('#mToday').onclick = () => { date = todayIso(); void loadDay(); };
    main.querySelector('#mNext').onclick = () => { date = addDays(date, 1); void loadDay(); };
} const host = main.querySelector('#mobileTeams'); for (const team of teams) {
    const teamVisits = visits.filter(v => v.teamId === team.id).sort((a, b) => a.sortOrder - b.sortOrder), p = teamProgress(visits, team.id), actions = day.dayActions.filter(a => a.teamId === team.id);
    const section = document.createElement('section');
    section.className = 'mobile-team-section';
    section.innerHTML = `<header><div><strong>${esc(team.name)}</strong><span>${p.completed}/${p.total} complete</span></div><b>${p.percent}%</b></header><div class="mobile-progress"><span style="width:${p.percent}%"></span></div>${actions.map(a => `<article class="mobile-day-note ${a.kind}"><b>${a.kind === 'team_note' ? 'TODAY’S INSTRUCTION' : 'EVENT'}</b><strong>${esc(a.detail || a.title)}</strong>${a.time ? `<span>${esc(a.time)}</span>` : ''}</article>`).join('')}<div class="mobile-route"></div>`;
    const route = section.querySelector('.mobile-route');
    if (!teamVisits.length)
        route.innerHTML = '<div class="mobile-empty">No visits.</div>';
    teamVisits.forEach((visit, index) => route.append(renderMobileVisit(visit, index + 1)));
    host.append(section);
} }
function renderMobileVisit(visit, index) { if (!context || !day)
    throw new Error('Mobile day missing'); const account = accountForWork(day, visit.accountId), location = locationForWork(day, visit.serviceLocationId), hold = holdForWork(day, visit.accountId), record = recordsForVisit(day, visit.id)[0], opps = opportunitiesForVisit(day, visit.id), card = document.createElement('article'); card.className = `mobile-visit status-${safe(visit.status)}${hold ? ' do-not-service' : ''}`; card.innerHTML = `<div class="mobile-route-number">${index}</div><div class="mobile-visit-main"><div class="mobile-visit-title"><strong>${esc(account?.name || 'Client')}</strong><span>${visit.visitType === 'additional' ? 'A' : visit.visitType === 'quoted' ? 'Q' : 'R'}</span></div><p>${esc(location?.address || '')}${location?.suburb ? ` · ${esc(location.suburb)}` : ''}</p>${hold ? `<div class="mobile-stop"><strong>DO NOT SERVICE</strong><span>${esc(hold.note || hold.reason)}</span></div>` : ''}<div class="mobile-task-summary">${tasksForVisit(visit).map(t => `<span>✓ ${esc(t)}</span>`).join('')}</div>${location?.accessNotes ? `<small><b>Access:</b> ${esc(location.accessNotes)}</small>` : ''}${location?.instructions ? `<small><b>Instructions:</b> ${esc(location.instructions)}</small>` : ''}<footer><span class="mobile-status">${esc(record?.outcome || visit.status)}</span><div>${canCompleteTeam(context.profile, visit.teamId, context.assignedTeamIds) && !['completed', 'cancelled', 'suspended', 'rescheduled'].includes(visit.status) ? '<button data-complete class="mobile-primary-small">Complete</button>' : ''}<button data-opportunity>Opportunity${opps.length ? ` (${opps.length})` : ''}</button></div></footer></div>`; card.querySelector('[data-complete]')?.addEventListener('click', () => openCompletionDialog(day, visit, draft => saveCompletion(visit, draft))); card.querySelector('[data-opportunity]').onclick = () => openOpportunityDialog(day, visit, record?.id ?? null, draft => saveOpportunity(visit, draft)); return card; }
async function saveCompletion(visit, draft) { if (!context || !day)
    return; if (demoParam) {
    day = { ...day, visits: completeVisitOptimistically(day.visits, visit.id, draft.taskOutcomes, draft.note) };
    renderWork();
    return;
} const photoPaths = draft.files.length ? await uploadWorkPhotos(context.businessId, visit.teamId, visit.id, draft.files) : []; await completeVisit(context.businessId, { ...draft, photoPaths }); await loadDay(); }
async function saveOpportunity(visit, draft) { if (!context || !day)
    return; if (demoParam) {
    day = { ...day, opportunities: [...day.opportunities, { id: draft.id, businessId: context.businessId, accountId: visit.accountId, scheduleJobId: visit.id, workRecordId: draft.workRecordId, teamId: visit.teamId, category: draft.category, note: draft.note, photoPaths: [], status: 'new', reviewDecision: 'new', createdAt: new Date().toISOString(), payload: {} }] };
    renderWork();
    return;
} const photoPaths = draft.files.length ? await uploadWorkPhotos(context.businessId, visit.teamId, visit.id, draft.files) : []; await createOpportunity(context.businessId, { ...draft, photoPaths }); await loadDay(); }
async function renderClients() { if (!context || context.profile !== 'owner_mobile')
    return; const main = root.querySelector('#mobileMain'); main.innerHTML = '<div class="mobile-loading">Loading clients…</div>'; try {
    const data = demoParam ? demoClientWorkspace() : await loadClientWorkspace(context.businessId);
    main.innerHTML = `<section class="mobile-page-head"><p class="eyebrow">Owner Mobile</p><h1>Clients</h1><input id="mobileClientSearch" class="mobile-search" placeholder="Search name, address or suburb"></section><div id="mobileClientRows"></div>`;
    const input = main.querySelector('#mobileClientSearch'), host = main.querySelector('#mobileClientRows');
    const draw = () => { const q = input.value.trim().toLowerCase(); const accounts = data.accounts.filter(a => { const sites = data.locations.filter(s => s.accountId === a.id); return !q || `${a.name} ${a.phone} ${a.email} ${sites.map(s => `${s.address} ${s.suburb}`).join(' ')}`.toLowerCase().includes(q); }); host.innerHTML = accounts.map(a => { const sites = data.locations.filter(s => s.accountId === a.id); return `<article class="mobile-client-card"><strong>${esc(a.name)}</strong><span>${esc(a.phone || a.email || a.status)}</span>${sites.map(s => `<small>${esc(s.address)}${s.suburb ? ` · ${esc(s.suburb)}` : ''}</small>`).join('')}</article>`; }).join('') || '<div class="mobile-empty">No matching clients.</div>'; };
    input.oninput = draw;
    draw();
}
catch (e) {
    main.innerHTML = `<div class="mobile-error">${esc(msg(e))}</div>`;
} }
async function renderOwnerMoney(kind) { if (!context || context.profile !== 'owner_mobile')
    return; const main = root.querySelector('#mobileMain'); main.innerHTML = '<div class="mobile-loading">Loading…</div>'; try {
    const data = demoParam ? demoMoneyWorkspace() : await loadMoneyWorkspace(context.businessId);
    if (kind === 'quotes') {
        main.innerHTML = `<section class="mobile-page-head"><p class="eyebrow">Owner Mobile</p><h1>Quotes</h1></section><div>${data.quotes.map(q => { const a = data.accounts.find(x => x.id === q.accountId); return `<article class="mobile-client-card"><strong>${esc(q.number)} · ${esc(a?.name || 'Client')}</strong><span>${esc(q.status)} · R ${quoteTotal(q).toFixed(2)}</span><small>${q.date}</small></article>`; }).join('') || '<div class="mobile-empty">No quotes.</div>'}</div>`;
        return;
    }
    const summary = moneySummary(data.invoices, data.payments, todayIso());
    main.innerHTML = `<section class="mobile-page-head"><p class="eyebrow">Owner Mobile</p><h1>Money</h1></section><section class="mobile-money-summary"><article><span>Invoiced</span><strong>R ${summary.invoiced.toFixed(2)}</strong></article><article><span>Received</span><strong>R ${summary.received.toFixed(2)}</strong></article><article><span>Outstanding</span><strong>R ${summary.outstanding.toFixed(2)}</strong></article><article><span>Overdue</span><strong>R ${summary.overdue.toFixed(2)}</strong></article></section><div>${data.invoices.slice(0, 20).map(i => { const a = data.accounts.find(x => x.id === i.accountId); return `<article class="mobile-client-card"><strong>${esc(i.number)} · ${esc(a?.name || 'Client')}</strong><span>${esc(i.status)} · Balance R ${invoiceBalance(i, data.payments).toFixed(2)}</span><small>${i.issueDate || i.month}</small></article>`; }).join('') || '<div class="mobile-empty">No invoices.</div>'}</div>`;
}
catch (e) {
    main.innerHTML = `<div class="mobile-error">${esc(msg(e))}</div>`;
} }
function formatDate(value) { return new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
function msg(e) { return e instanceof Error ? e.message : String(e); }
function safe(v) { return v.replace(/[^a-z0-9-]/gi, '-').toLowerCase(); }
void boot();
//# sourceMappingURL=mobileApp.js.map