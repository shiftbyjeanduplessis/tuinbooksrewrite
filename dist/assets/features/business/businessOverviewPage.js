import { documentTotal, invoiceBalance } from '../../domain/billing.js';
import { todayIso } from '../../domain/dates.js';
import { mountWorkspace } from '../shell/chrome.js';
import { loadClientWorkspace } from '../clients/clientsRepository.js';
import { demoClientWorkspace } from '../clients/demoClients.js';
import { loadMoneyWorkspace } from '../billing/moneyRepository.js';
import { demoMoneyWorkspace } from '../billing/demoMoney.js';
export function renderBusinessOverviewPage(root, identity, navigation) {
    const page = mountWorkspace(root, identity, 'business', navigation, 'business-page business-health-view');
    page.innerHTML = `<section class="page-heading"><div><p class="eyebrow">Business health</p><h1>Business</h1><p>See the business at a glance, then open the monthly review when you need more detail.</p></div><div class="heading-actions"><button class="button secondary" id="businessRefresh">Refresh</button></div></section><nav class="page-subtabs business-tabs" aria-label="Business sections"><button class="page-subtab active" data-business-tab="overview">Overview</button><button class="page-subtab" data-business-tab="review">Monthly Review</button></nav><div id="businessOverviewHost"><div class="loading-state">Loading business…</div></div>`;
    const host = page.querySelector('#businessOverviewHost');
    let mode = 'overview';
    let clients = null, money = null;
    async function load() { host.innerHTML = '<div class="loading-state">Loading business…</div>'; try {
        [clients, money] = identity.demo ? [demoClientWorkspace(), demoMoneyWorkspace()] : await Promise.all([loadClientWorkspace(identity.businessId), loadMoneyWorkspace(identity.businessId)]);
        draw();
    }
    catch (e) {
        host.innerHTML = `<div class="error-box">${esc(msg(e))}</div>`;
    } }
    function draw() {
        if (!clients || !money)
            return;
        const month = todayIso().slice(0, 7), monthInvoices = money.invoices.filter((i) => String(i.issueDate || i.month || '').startsWith(month)), invoiced = monthInvoices.reduce((s, i) => s + documentTotal(i.lines), 0), received = money.payments.filter((p) => !p.reversedAt && String(p.date).startsWith(month)).reduce((s, p) => s + Number(p.amount || 0), 0), outstanding = money.invoices.reduce((s, i) => s + invoiceBalance(i, money.payments), 0), activeClients = clients.accounts.filter((a) => a.status === 'active').length, activeTeams = clients.teams.filter((t) => t.active !== false).length, openQuotes = money.quotes.filter((q) => !['Declined', 'Accepted', 'Expired'].includes(q.status)).length;
        if (mode === 'overview') {
            host.innerHTML = `<section class="metric-grid five"><article class="metric-card"><span>Active clients</span><strong>${activeClients}</strong><small>${clients.locations.length} service locations</small></article><article class="metric-card"><span>Teams</span><strong>${activeTeams}</strong><small>Active operational teams</small></article><article class="metric-card"><span>This month invoiced</span><strong>R ${moneyFmt(invoiced)}</strong><small>${monthInvoices.length} invoices</small></article><article class="metric-card"><span>This month received</span><strong>R ${moneyFmt(received)}</strong><small>Recorded payments</small></article><article class="metric-card ${outstanding > 0 ? 'alert' : ''}"><span>Outstanding</span><strong>R ${moneyFmt(outstanding)}</strong><small>Across issued invoices</small></article></section><section class="panel"><div class="section-title-row"><div><p class="eyebrow">Current picture</p><h2>What needs attention</h2><p>Compact operational and financial signals without changing any underlying records.</p></div></div><div class="simple-list"><div><span>Open quotes</span><strong>${openQuotes}</strong></div><div><span>Unbilled work facts</span><strong>${money.billingFacts.filter((f) => !f.alreadyInvoiced && f.billingDisposition !== 'no-charge').length}</strong></div><div><span>Paused clients</span><strong>${clients.accounts.filter((a) => a.status === 'paused').length}</strong></div><div><span>Draft service agreements</span><strong>${clients.agreements.filter((a) => a.status === 'draft').length}</strong></div></div></section>`;
            return;
        }
        const priorMonth = previousMonth(month), priorInvoices = money.invoices.filter((i) => String(i.issueDate || i.month || '').startsWith(priorMonth)), priorTotal = priorInvoices.reduce((s, i) => s + documentTotal(i.lines), 0), delta = priorTotal ? ((invoiced - priorTotal) / priorTotal) * 100 : null, totalPayments = money.payments.filter((p) => !p.reversedAt).reduce((s, p) => s + Number(p.amount || 0), 0), issued = money.invoices.reduce((s, i) => s + documentTotal(i.lines), 0);
        host.innerHTML = `<section class="panel business-review-hero"><p class="eyebrow">Monthly business review</p><h2>${monthLabel(month)}</h2><p>Sales, collections, clients and work for the selected current month.</p></section><section class="metric-grid four"><article class="metric-card"><span>Sales</span><strong>R ${moneyFmt(invoiced)}</strong><small>${delta == null ? 'No previous-month comparison' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs ${monthLabel(priorMonth)}`}</small></article><article class="metric-card"><span>Cash collected</span><strong>R ${moneyFmt(received)}</strong><small>This month</small></article><article class="metric-card"><span>Client base</span><strong>${activeClients}</strong><small>${clients.accounts.length} total accounts</small></article><article class="metric-card"><span>Collection position</span><strong>${issued ? Math.min(100, (totalPayments / issued) * 100).toFixed(0) : '0'}%</strong><small>Lifetime recorded payments / issued value</small></article></section><div class="business-two-column"><section class="panel"><div class="section-title-row"><div><p class="eyebrow">Money movement</p><h2>Financial performance</h2></div></div><div class="simple-list"><div><span>Invoiced this month</span><strong>R ${moneyFmt(invoiced)}</strong></div><div><span>Received this month</span><strong>R ${moneyFmt(received)}</strong></div><div><span>Outstanding now</span><strong>R ${moneyFmt(outstanding)}</strong></div></div></section><section class="panel"><div class="section-title-row"><div><p class="eyebrow">Client base</p><h2>Client movement</h2></div></div><div class="simple-list"><div><span>Active</span><strong>${activeClients}</strong></div><div><span>Paused</span><strong>${clients.accounts.filter((a) => a.status === 'paused').length}</strong></div><div><span>Service locations</span><strong>${clients.locations.length}</strong></div></div></section></div>`;
    }
    page.querySelectorAll('[data-business-tab]').forEach(b => b.onclick = () => { mode = b.dataset.businessTab === 'review' ? 'review' : 'overview'; page.querySelectorAll('[data-business-tab]').forEach(x => x.classList.toggle('active', x === b)); draw(); });
    page.querySelector('#businessRefresh').onclick = () => void load();
    void load();
}
function previousMonth(month) { const [y, m] = month.split('-').map(Number), d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function monthLabel(month) { const [y, m] = month.split('-').map(Number); return new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))); }
function moneyFmt(v) { return Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
function msg(e) { return e instanceof Error ? e.message : String(e); }
//# sourceMappingURL=businessOverviewPage.js.map