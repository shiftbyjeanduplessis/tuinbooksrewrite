import { accountSearch, agreementFrequencyLabel, agreementsForLocation, locationsForAccount, normaliseAccount, normaliseAgreement, normaliseLocation } from '../../domain/clients.js';
import { demoClientWorkspace } from './demoClients.js';
import { loadClientWorkspace, saveAccount, saveAgreement, saveLocation } from './clientsRepository.js';
import { openAccountDialog, openAgreementDialog, openLocationDialog } from './clientDialogs.js';
import { mountWorkspace } from '../shell/chrome.js';
export function renderClientsPage(root, identity, navigation) {
    const page = mountWorkspace(root, identity, 'clients', navigation, 'clients-page');
    page.innerHTML = `<section class="page-heading clients-toolbar"><div><p class="eyebrow">Customer records</p><h1>Clients</h1><p>Manage recurring service, contact details, billing and site notes.</p></div><div class="heading-actions toolbar-actions"><button class="button secondary" id="refreshClients">Refresh</button><button id="newAccount" class="button">+ New client</button></div></section><div id="clientError" class="error-box hidden" role="alert"></div><section class="clients-workspace"><aside class="client-list-panel"><div class="client-search"><input id="clientSearch" type="search" placeholder="Search client, address or suburb"><span id="clientCount"></span></div><div id="clientList" class="client-list"><div class="loading-state">Loading clients…</div></div></aside><section id="clientDetail" class="client-detail"><div class="empty-detail"><strong>Select a client</strong><span>Account, service locations and routine agreements will appear here.</span></div></section></section>`;
    let data = null, selectedId = null, query = '';
    const list = page.querySelector('#clientList'), detail = page.querySelector('#clientDetail'), errorBox = page.querySelector('#clientError'), count = page.querySelector('#clientCount');
    const showError = (message = '') => { errorBox.textContent = message; errorBox.classList.toggle('hidden', !message); };
    async function fetchData() { showError(); list.innerHTML = '<div class="loading-state">Loading clients…</div>'; try {
        data = identity.demo ? demoClientWorkspace() : await loadClientWorkspace(identity.businessId);
        if (selectedId && !data.accounts.some(a => a.id === selectedId))
            selectedId = null;
        render();
    }
    catch (error) {
        showError(msg(error));
        list.innerHTML = '<div class="basket-empty">Clients could not be loaded.</div>';
    } }
    function render() { if (!data)
        return; const rows = accountSearch(data, query); count.textContent = `${rows.length} of ${data.accounts.length}`; list.innerHTML = ''; if (!rows.length) {
        list.innerHTML = '<div class="basket-empty">No matching accounts.</div>';
    } for (const account of rows) {
        const locations = locationsForAccount(data, account.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `client-list-row${selectedId === account.id ? ' active' : ''}`;
        button.innerHTML = `<span><strong>${esc(account.name)}</strong><small>${locations.length} location${locations.length === 1 ? '' : 's'} · ${esc(account.status)}</small></span><b>›</b>`;
        button.onclick = () => { selectedId = account.id; render(); };
        list.append(button);
    } renderDetail(); }
    function renderDetail() {
        if (!data)
            return;
        const account = data.accounts.find(a => a.id === selectedId);
        if (!account) {
            detail.innerHTML = '<div class="empty-detail"><strong>Select a client</strong><span>Account, service locations and routine agreements will appear here.</span></div>';
            return;
        }
        const locations = locationsForAccount(data, account.id);
        detail.innerHTML = `<header class="detail-header"><div><p class="eyebrow">Account</p><h2>${esc(account.name)}</h2><div class="detail-meta"><span class="state-pill state-${esc(account.status)}">${esc(account.status)}</span>${account.contactName ? `<span>${esc(account.contactName)}</span>` : ''}${account.phone ? `<span>${esc(account.phone)}</span>` : ''}${account.email ? `<span>${esc(account.email)}</span>` : ''}</div></div><div class="detail-actions"><button data-edit-account>Edit account</button><button class="primary-button" data-add-location>+ Service location</button></div></header><div class="location-stack" id="locationStack"></div>`;
        detail.querySelector('[data-edit-account]').onclick = () => openAccountDialog(account, saveAccountFromDialog);
        detail.querySelector('[data-add-location]').onclick = () => openLocationDialog(account, null, saveLocationFromDialog);
        const stack = detail.querySelector('#locationStack');
        if (!locations.length)
            stack.innerHTML = '<div class="empty-section"><strong>No service locations yet</strong><span>Add the physical property where this client receives service.</span></div>';
        for (const location of locations)
            stack.append(renderLocation(account, location));
    }
    function renderLocation(account, location) { const card = document.createElement('article'); card.className = `location-card${location.active ? '' : ' inactive'}`; const agreements = data ? agreementsForLocation(data, location.id) : []; card.innerHTML = `<header><div><p class="eyebrow">Service location</p><h3>${esc(location.siteName || location.address)}</h3><p>${esc(location.address)}${location.suburb ? ` · ${esc(location.suburb)}` : ''}</p></div><div class="detail-actions"><button data-edit-location>Edit</button><button data-new-agreement>+ Agreement</button></div></header>${location.accessNotes ? `<div class="location-note"><strong>Access</strong><span>${esc(location.accessNotes)}</span></div>` : ''}${location.instructions ? `<div class="location-note"><strong>Instructions</strong><span>${esc(location.instructions)}</span></div>` : ''}<section class="agreements-section"><div class="section-heading"><strong>Service agreements</strong><span>${agreements.length}</span></div><div class="agreement-list"></div></section>`; card.querySelector('[data-edit-location]').onclick = () => openLocationDialog(account, location, saveLocationFromDialog); card.querySelector('[data-new-agreement]').onclick = () => openAgreementDialog(account, location, data?.teams ?? [], null, saveAgreementFromDialog); const host = card.querySelector('.agreement-list'); if (!agreements.length)
        host.innerHTML = '<div class="agreement-empty">No routine agreement for this location.</div>'; for (const agreement of agreements) {
        const team = data?.teams.find(t => t.id === agreement.defaultTeamId);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'agreement-row';
        row.innerHTML = `<span><strong>${esc(agreementFrequencyLabel(agreement))}</strong><small>${esc(team?.name || 'Team not set')} · ${agreement.estimatedMinutes} min${agreement.serviceIds.length ? ` · ${esc(agreement.serviceIds.join(', '))}` : ''}</small></span><span class="agreement-status status-${esc(agreement.status)}">${esc(agreement.status)}</span>`;
        row.onclick = () => openAgreementDialog(account, location, data?.teams ?? [], agreement, saveAgreementFromDialog);
        host.append(row);
    } return card; }
    async function saveAccountFromDialog(input) { showError(); if (identity.demo) {
        if (!data)
            return;
        const row = normaliseAccount(input, identity.businessId);
        const exists = data.accounts.some(a => a.id === row.id);
        data = { ...data, accounts: exists ? data.accounts.map(a => a.id === row.id ? row : a) : [...data.accounts, row] };
        selectedId = row.id;
        render();
        return;
    } await saveAccount(identity.businessId, input); selectedId = input.id; await fetchData(); }
    async function saveLocationFromDialog(input) { showError(); if (identity.demo) {
        if (!data)
            return;
        const row = normaliseLocation(input, identity.businessId), exists = data.locations.some(s => s.id === row.id);
        data = { ...data, locations: exists ? data.locations.map(s => s.id === row.id ? row : s) : [...data.locations, row] };
        render();
        return;
    } await saveLocation(identity.businessId, input); await fetchData(); }
    async function saveAgreementFromDialog(input) { showError(); if (identity.demo) {
        if (!data)
            return;
        const row = normaliseAgreement(input, identity.businessId), previous = data.agreements.find(a => a.id === row.id);
        row.version = (previous?.version ?? 0) + 1;
        row.scheduleSeriesId = row.status === 'active' ? `series-${row.id}-v${row.version}` : null;
        const exists = !!previous;
        data = { ...data, agreements: exists ? data.agreements.map(a => a.id === row.id ? row : a) : [...data.agreements, row] };
        render();
        return;
    } await saveAgreement(identity.businessId, input); await fetchData(); }
    page.querySelector('#clientSearch').oninput = e => { query = e.currentTarget.value; render(); };
    page.querySelector('#refreshClients').onclick = () => void fetchData();
    page.querySelector('#newAccount').onclick = () => openAccountDialog(null, saveAccountFromDialog);
    void fetchData();
}
function msg(error) { return error instanceof Error ? error.message : (error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=clientsPage.js.map