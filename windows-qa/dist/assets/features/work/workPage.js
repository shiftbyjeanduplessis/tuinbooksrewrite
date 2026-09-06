import { addDays, todayIso } from '../../domain/dates.js';
import { accountForWork, holdForWork, locationForWork, opportunitiesForVisit, recordsForVisit, tasksForVisit, teamProgress, workDayProgress } from '../../domain/work.js';
import { mountWorkspace } from '../shell/chrome.js';
import { demoWorkDay } from './demoWork.js';
import { loadWorkDay, signedPhotoUrl } from './workRepository.js';
export function renderWorkPage(root, identity, navigation) {
    const page = mountWorkspace(root, identity, 'work', navigation, 'work-page');
    let date = todayIso(), day = null;
    page.innerHTML = `<section class="work-toolbar"><div><p class="eyebrow">Work</p><h1>Today’s operation</h1><p class="muted" id="workDateLabel"></p></div><div class="toolbar-actions"><button id="workPrev">← Previous</button><button id="workToday">Today</button><button id="workNext">Next →</button><button id="workRefresh">Refresh</button></div></section><div id="workError" class="error-box hidden"></div><section id="workSummary"></section><section id="workAttention"></section><section id="workTeams" class="work-team-grid"><div class="loading-state">Loading work…</div></section>`;
    const error = page.querySelector('#workError'), summary = page.querySelector('#workSummary'), teamsHost = page.querySelector('#workTeams'), attention = page.querySelector('#workAttention'), label = page.querySelector('#workDateLabel');
    async function load() { error.classList.add('hidden'); teamsHost.innerHTML = '<div class="loading-state">Loading work…</div>'; label.textContent = formatDate(date); try {
        day = identity.demo ? demoWorkDay(date) : await loadWorkDay(identity.businessId, date);
        render();
    }
    catch (e) {
        error.textContent = e instanceof Error ? e.message : String(e);
        error.classList.remove('hidden');
        teamsHost.innerHTML = '<div class="basket-empty">Work could not be loaded.</div>';
    } }
    function render() { if (!day)
        return; const p = workDayProgress(day); summary.innerHTML = `<div class="work-summary"><div><span>Visits</span><strong>${p.total}</strong></div><div><span>Completed</span><strong>${p.completed}</strong></div><div><span>Progress</span><strong>${p.percent}%</strong></div><div><span>Opportunities</span><strong>${day.opportunities.filter(o => o.status === 'new').length}</strong></div></div>`; renderAttention(); teamsHost.innerHTML = ''; for (const team of day.teams) {
        const visits = day.visits.filter(v => v.teamId === team.id).sort((a, b) => a.sortOrder - b.sortOrder), tp = teamProgress(day.visits, team.id), actions = day.dayActions.filter(a => a.teamId === team.id);
        const section = document.createElement('article');
        section.className = 'work-team-card';
        section.innerHTML = `<header><div><p class="eyebrow">Team</p><h2>${esc(team.name)}</h2></div><strong>${tp.completed}/${tp.total}</strong></header><div class="progress-track"><span style="width:${tp.percent}%"></span></div>${actions.map(a => `<div class="work-day-action"><b>${a.kind === 'team_note' ? 'INSTRUCTION' : 'EVENT'}</b><span>${esc(a.detail || a.title)}${a.time ? ` · ${esc(a.time)}` : ''}</span></div>`).join('')}<div class="work-visit-list"></div>`;
        const host = section.querySelector('.work-visit-list');
        if (!visits.length)
            host.innerHTML = '<div class="agreement-empty">No visits.</div>';
        for (const visit of visits)
            host.append(renderVisit(day, visit));
        teamsHost.append(section);
    } }
    function renderAttention() { if (!day)
        return; const rows = day.opportunities.filter(o => o.status === 'new'); if (!rows.length) {
        attention.innerHTML = '';
        return;
    } attention.innerHTML = `<section class="work-attention"><header><div><p class="eyebrow">Needs attention</p><h2>Field opportunities</h2></div><strong>${rows.length}</strong></header><div id="workOpportunityRows"></div></section>`; const host = attention.querySelector('#workOpportunityRows'); for (const opp of rows) {
        const account = accountForWork(day, opp.accountId), visit = opp.scheduleJobId ? day.visits.find(v => v.id === opp.scheduleJobId) : undefined, location = visit ? locationForWork(day, visit.serviceLocationId) : undefined, row = document.createElement('article');
        row.className = 'work-opportunity-row';
        row.innerHTML = `<span><strong>${esc(opp.category)} · ${esc(account?.name || 'Client')}</strong><small>${esc(location?.address || '')}${location?.suburb ? ` · ${esc(location.suburb)}` : ''}</small></span><p>${esc(opp.note)}</p>${opp.photoPaths.length ? `<button data-photos>${opp.photoPaths.length} photo${opp.photoPaths.length === 1 ? '' : 's'}</button>` : ''}`;
        row.querySelector('[data-photos]')?.addEventListener('click', () => void openPhotos(opp.photoPaths));
        host.append(row);
    } }
    async function openPhotos(paths) { const dialog = document.createElement('dialog'); dialog.className = 'mobile-dialog'; dialog.innerHTML = '<div class="dialog-shell"><header><div><p class="eyebrow">Field photos</p><h2>Visit photos</h2></div><button class="icon-button" data-close>×</button></header><div class="photo-grid" id="photoGrid"><div class="loading-state">Loading photos…</div></div></div>'; document.body.append(dialog); dialog.querySelector('[data-close]').onclick = () => dialog.close(); dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal(); const urls = await Promise.all(paths.map(signedPhotoUrl)); const host = dialog.querySelector('#photoGrid'); host.innerHTML = urls.map((url, i) => url ? `<img src="${esc(url)}" alt="Field photo ${i + 1}">` : '').join('') || '<div class="mobile-empty">Photos could not be opened.</div>'; }
    page.querySelector('#workPrev').onclick = () => { date = addDays(date, -1); void load(); };
    page.querySelector('#workToday').onclick = () => { date = todayIso(); void load(); };
    page.querySelector('#workNext').onclick = () => { date = addDays(date, 1); void load(); };
    page.querySelector('#workRefresh').onclick = () => void load();
    void load();
}
function renderVisit(day, visit) { const account = accountForWork(day, visit.accountId), location = locationForWork(day, visit.serviceLocationId), hold = holdForWork(day, visit.accountId), records = recordsForVisit(day, visit.id), opps = opportunitiesForVisit(day, visit.id), row = document.createElement('div'); row.className = `work-visit-row status-${safe(visit.status)}${hold ? ' do-not-service' : ''}`; row.innerHTML = `<span class="work-marker ${visit.visitType}">${visit.visitType === 'additional' ? 'A' : visit.visitType === 'quoted' ? 'Q' : 'R'}</span><span class="work-client"><strong>${esc(account?.name || 'Unknown client')}</strong><small>${esc(location?.address || '')}${location?.suburb ? ` · ${esc(location.suburb)}` : ''}</small>${hold ? `<b>DO NOT SERVICE · ${esc(hold.note || hold.reason)}</b>` : ''}</span><span class="work-task"><strong>${esc(tasksForVisit(visit).join(', '))}</strong><small>${records[0]?.outcome || visit.status}${opps.length ? ` · ${opps.length} opportunity${opps.length === 1 ? '' : 's'}` : ''}</small></span><span class="work-state">${esc(visit.status)}</span>`; return row; }
function formatDate(date) { return new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
function safe(v) { return v.replace(/[^a-z0-9-]/gi, '-').toLowerCase(); }
//# sourceMappingURL=workPage.js.map