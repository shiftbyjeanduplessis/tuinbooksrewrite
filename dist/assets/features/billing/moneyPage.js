import { documentTotal, eligibleBillingFacts, invoiceBalance, moneySummary, overdue, paymentStatus, quoteTotal, statementRows } from '../../domain/billing.js';
import { addDays, todayIso } from '../../domain/dates.js';
import { mountWorkspace } from '../shell/chrome.js';
import { demoMoneyWorkspace } from './demoMoney.js';
import { createInvoiceFromFacts, createPublicDocument, loadMoneyWorkspace, recordPayment, reversePayment, saveInvoice, saveQuote, scheduleAcceptedQuote, setInvoiceStatus, setQuoteStatus, setVisitBillingAmount } from './moneyRepository.js';
import { openInvoiceDialog, openPaymentDialog, openQuoteDialog } from './moneyDialogs.js';
export function renderMoneyPage(root, identity, navigation, mode = 'money') {
    const page = mountWorkspace(root, identity, mode, navigation, mode === 'quotes' ? 'quotes-page' : 'money-page');
    let data = null, activeTab = mode === 'quotes' ? 'quotes' : 'invoices';
    page.innerHTML = `<section class="page-heading workspace-heading"><div><p class="eyebrow">${mode === 'quotes' ? 'Quote-to-work pipeline' : 'Routine billing control'}</p><h1>${mode === 'quotes' ? 'Quotes' : 'Billing'}</h1><p>${mode === 'quotes' ? 'Create the quote, record the customer decision, then schedule or invoice the accepted work.' : 'Review routine billing, invoices, payments and statements without changing completed work history.'}</p></div><div class="heading-actions toolbar-actions"><button class="button secondary" id="moneyRefresh">Refresh</button>${mode === 'quotes' ? '<button id="newQuote" class="button">+ Quick quote</button>' : '<button id="newInvoice" class="button">+ Quick invoice</button>'}</div></section><div id="moneyContent"><div class="loading-state">Loading…</div></div>`;
    page.querySelector('#moneyRefresh').onclick = () => void load();
    page.querySelector('#newQuote')?.addEventListener('click', () => data && openQuoteDialog(data.accounts, null, data.defaultVatRate, input => mutate(() => saveQuote(identity.businessId, input))));
    page.querySelector('#newInvoice')?.addEventListener('click', () => data && openInvoiceDialog(data.accounts, null, data.defaultVatRate, data.paymentTermsDays, input => mutate(() => saveInvoice(identity.businessId, input))));
    async function load() { const host = page.querySelector('#moneyContent'); host.innerHTML = '<div class="loading-state">Loading…</div>'; try {
        data = identity.demo ? demoMoneyWorkspace() : await loadMoneyWorkspace(identity.businessId);
        draw();
    }
    catch (e) {
        host.innerHTML = `<div class="error-box">${esc(msg(e))}</div>`;
    } }
    async function mutate(action) { if (identity.demo) {
        await action().catch(() => { });
        await load();
        return;
    } await action(); await load(); }
    function draw() { if (!data)
        return; const host = page.querySelector('#moneyContent'); if (mode === 'quotes') {
        host.innerHTML = `<div class="quote-list" id="quoteList"></div>`;
        drawQuotes(host.querySelector('#quoteList'));
        return;
    } const summary = moneySummary(data.invoices, data.payments, todayIso()); host.innerHTML = `<section class="money-summary"><article><span>Invoiced</span><strong>R ${summary.invoiced.toFixed(2)}</strong></article><article><span>Received</span><strong>R ${summary.received.toFixed(2)}</strong></article><article><span>Outstanding</span><strong>R ${summary.outstanding.toFixed(2)}</strong></article><article class="${summary.overdue ? 'alert' : ''}"><span>Overdue</span><strong>R ${summary.overdue.toFixed(2)}</strong></article></section><nav class="subtabs"><button data-tab="invoices" class="active">Invoices</button><button data-tab="review">Billing review</button><button data-tab="payments">Payments</button><button data-tab="statements">Statements</button></nav><div id="moneyTab"></div>`; host.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { activeTab = b.dataset.tab; host.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b)); drawTab(); }); drawTab(); }
    function drawTab() { if (!data)
        return; const host = page.querySelector('#moneyTab'); if (activeTab === 'review')
        drawReview(host);
    else if (activeTab === 'payments')
        drawPayments(host);
    else if (activeTab === 'statements')
        drawStatements(host);
    else
        drawInvoices(host); }
    function drawQuotes(host) { if (!data)
        return; host.innerHTML = data.quotes.map(q => { const a = data.accounts.find(x => x.id === q.accountId); return `<article class="document-row"><div><strong>${esc(q.number)}</strong><span>${esc(a?.name || 'Client')} · ${q.date}</span></div><b>R ${quoteTotal(q).toFixed(2)}</b><span class="status-pill">${esc(q.status)}</span><div class="row-actions"><button data-edit="${attr(q.id)}">Edit</button>${q.status === 'Draft' ? `<button data-status="Sent" data-id="${attr(q.id)}">Mark sent</button>` : ''}${['Draft', 'Sent'].includes(q.status) ? `<button data-email-quote="${attr(q.id)}">Email</button><button data-wa-quote="${attr(q.id)}">WhatsApp</button>` : ''}${q.status === 'Sent' ? `<button data-status="Accepted" data-id="${attr(q.id)}">Accept</button>` : ''}${q.status === 'Accepted' ? `<button data-queue="${attr(q.id)}">Send to Basket</button>` : ''}</div></article>`; }).join('') || '<div class="empty-state">No quotes yet.</div>'; host.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const q = data.quotes.find(x => x.id === b.dataset.edit); openQuoteDialog(data.accounts, q, data.defaultVatRate, input => mutate(() => saveQuote(identity.businessId, input))); }); host.querySelectorAll('[data-status]').forEach(b => b.onclick = () => void mutate(() => setQuoteStatus(identity.businessId, b.dataset.id, b.dataset.status))); host.querySelectorAll('[data-email-quote]').forEach(b => b.onclick = () => void deliverQuote(data.quotes.find(x => x.id === b.dataset.emailQuote), 'email')); host.querySelectorAll('[data-wa-quote]').forEach(b => b.onclick = () => void deliverQuote(data.quotes.find(x => x.id === b.dataset.waQuote), 'whatsapp')); host.querySelectorAll('[data-queue]').forEach(b => b.onclick = () => void mutate(() => scheduleAcceptedQuote(identity.businessId, b.dataset.queue))); }
    function drawInvoices(host) { if (!data)
        return; host.innerHTML = `<div class="document-list">${data.invoices.map(i => invoiceRow(i)).join('') || '<div class="empty-state">No invoices yet.</div>'}</div>`; host.querySelectorAll('[data-edit-invoice]').forEach(b => b.onclick = () => { const inv = data.invoices.find(x => x.id === b.dataset.editInvoice); openInvoiceDialog(data.accounts, inv, data.defaultVatRate, data.paymentTermsDays, input => mutate(() => saveInvoice(identity.businessId, input))); }); host.querySelectorAll('[data-pay]').forEach(b => { b.onclick = () => { const inv = data.invoices.find(x => x.id === b.dataset.pay); openPaymentDialog(inv, data.payments, input => mutate(() => recordPayment(identity.businessId, input))); }; }); host.querySelectorAll('[data-ready]').forEach(b => b.onclick = () => void mutate(() => setInvoiceStatus(identity.businessId, b.dataset.ready, 'Ready'))); host.querySelectorAll('[data-send-invoice]').forEach(b => b.onclick = () => void mutate(() => setInvoiceStatus(identity.businessId, b.dataset.sendInvoice, 'Sent'))); host.querySelectorAll('[data-void-invoice]').forEach(b => b.onclick = () => { if (confirm('Void this unissued invoice?'))
        void mutate(() => setInvoiceStatus(identity.businessId, b.dataset.voidInvoice, 'Void')); }); host.querySelectorAll('[data-email-invoice]').forEach(b => b.onclick = () => void deliverInvoice(data.invoices.find(x => x.id === b.dataset.emailInvoice), 'email')); host.querySelectorAll('[data-wa-invoice]').forEach(b => b.onclick = () => void deliverInvoice(data.invoices.find(x => x.id === b.dataset.waInvoice), 'whatsapp')); }
    function invoiceRow(inv) { const a = data.accounts.find(x => x.id === inv.accountId), balance = invoiceBalance(inv, data.payments), status = ['Draft', 'Ready', 'Void', 'Credited'].includes(inv.status) ? inv.status : (overdue(inv, data.payments, todayIso()) ? 'Overdue' : paymentStatus(inv, data.payments)); return `<article class="document-row"><div><strong>${esc(inv.number)}</strong><span>${esc(a?.name || 'Client')} · ${inv.issueDate || inv.month}</span></div><b>R ${documentTotal(inv.lines).toFixed(2)}</b><span class="status-pill ${status === 'Overdue' ? 'alert' : ''}">${status}</span><small>Balance R ${balance.toFixed(2)}</small><div class="row-actions">${['Draft', 'Ready'].includes(inv.status) ? `<button data-edit-invoice="${attr(inv.id)}">Edit</button>` : ''}${inv.status === 'Draft' ? `<button data-ready="${attr(inv.id)}">Mark ready</button><button data-void-invoice="${attr(inv.id)}">Void</button>` : ''}${inv.status === 'Ready' ? `<button data-send-invoice="${attr(inv.id)}">Mark sent</button><button data-void-invoice="${attr(inv.id)}">Void</button>` : ''}${['Ready', 'Sent', 'Partially paid', 'Paid'].includes(inv.status) ? `<button data-email-invoice="${attr(inv.id)}">Email</button><button data-wa-invoice="${attr(inv.id)}">WhatsApp</button>` : ''}${balance > .01 && ['Sent', 'Partially paid'].includes(inv.status) ? `<button data-pay="${attr(inv.id)}">Record payment</button>` : ''}</div></article>`; }
    function drawReview(host) { if (!data)
        return; const facts = eligibleBillingFacts(data.billingFacts), groups = new Map(); facts.forEach(f => groups.set(f.accountId, [...(groups.get(f.accountId) || []), f])); host.innerHTML = [...groups].map(([accountId, rows]) => { const a = data.accounts.find(x => x.id === accountId); return `<article class="billing-review-card"><header><div><strong>${esc(a?.name || 'Client')}</strong><span>${rows.length} billable visit${rows.length === 1 ? '' : 's'}</span></div><button data-create-fact-invoice="${attr(accountId)}">Create draft invoice</button></header>${rows.map(f => `<div class="billing-fact-row"><span>${f.date} · ${esc(f.description)}</span><b>${esc(f.billingDisposition)}</b>${f.billingDisposition !== 'routine' ? `<label>Amount <input data-fact-amount="${attr(f.visitId)}" type="number" min="0" step="0.01" value="${f.amount ?? ''}" placeholder="Set in Billing"></label><button data-save-fact-amount="${attr(f.visitId)}">Save amount</button>` : ''}</div>`).join('')}</article>`; }).join('') || '<div class="empty-state">No unbilled completed/chargeable work.</div>'; host.querySelectorAll('[data-save-fact-amount]').forEach(b => b.onclick = () => { const input = host.querySelector(`[data-fact-amount="${CSS.escape(b.dataset.saveFactAmount)}"]`); void mutate(() => setVisitBillingAmount(identity.businessId, b.dataset.saveFactAmount, Number(input.value))); }); host.querySelectorAll('[data-create-fact-invoice]').forEach(b => b.onclick = () => { const accountId = b.dataset.createFactInvoice, rows = groups.get(accountId) || [], month = todayIso().slice(0, 7); void mutate(() => createInvoiceFromFacts(identity.businessId, accountId, month, todayIso(), addDays(todayIso(), data.paymentTermsDays), rows.map(r => r.visitId))); }); }
    function drawPayments(host) { if (!data)
        return; host.innerHTML = data.payments.filter(p => !p.reversedAt).map(p => { const inv = data.invoices.find(i => i.id === p.invoiceId), a = data.accounts.find(x => x.id === p.accountId); return `<article class="payment-row"><div><strong>R ${p.amount.toFixed(2)}</strong><span>${p.date} · ${esc(a?.name || 'Client')} · ${esc(inv?.number || p.invoiceId)}</span></div><span>${esc(p.method)} ${esc(p.reference)}</span><button data-reverse="${attr(p.id)}">Reverse</button></article>`; }).join('') || '<div class="empty-state">No payments recorded.</div>'; host.querySelectorAll('[data-reverse]').forEach(b => b.onclick = () => { const reason = prompt('Reason for reversing this payment:', 'Applied incorrectly'); if (reason)
        void mutate(() => reversePayment(identity.businessId, b.dataset.reverse, reason)); }); }
    function drawStatements(host) { if (!data)
        return; host.innerHTML = `<label class="statement-select">Client<select id="statementAccount"><option value="">Choose client</option>${data.accounts.map(a => `<option value="${attr(a.id)}">${esc(a.name)}</option>`).join('')}</select></label><div class="statement-actions"><button id="emailStatement">Email statement</button><button id="waStatement">WhatsApp statement</button></div><div id="statementRows" class="statement-rows"><div class="empty-state">Choose a client.</div></div>`; const select = host.querySelector('#statementAccount'), rows = host.querySelector('#statementRows'); host.querySelector('#emailStatement').onclick = () => void deliverStatement(select.value, 'email'); host.querySelector('#waStatement').onclick = () => void deliverStatement(select.value, 'whatsapp'); select.onchange = () => { const list = statementRows(select.value, data.invoices, data.payments); rows.innerHTML = list.map(r => `<div><span>${r.date}</span><span>${r.type} ${esc(r.reference)}</span><span>${r.debit ? `R ${r.debit.toFixed(2)}` : ''}</span><span>${r.credit ? `R ${r.credit.toFixed(2)}` : ''}</span><strong>R ${r.balance.toFixed(2)}</strong></div>`).join('') || '<div class="empty-state">No statement activity.</div>'; }; }
    async function secureLink(type, documentId, accountId, snapshot) {
        if (identity.demo)
            return new URL(type === 'quote' ? './accept.html?demo=1' : './document.html?demo=1', location.href).href;
        const expires = new Date(Date.now() + (type === 'quote' ? 14 : 90) * 86400000).toISOString(), created = await createPublicDocument(identity.businessId, type, documentId, accountId, snapshot, expires), url = new URL(type === 'quote' ? './accept.html' : './document.html', location.href);
        url.searchParams.set('token', created.token);
        return url.href;
    }
    async function deliverQuote(q, channel) { if (!data)
        return; const account = data.accounts.find(a => a.id === q.accountId); if (!account)
        return; try {
        const total = quoteTotal(q), link = await secureLink('quote', q.id, q.accountId, { documentType: 'quote', businessName: identity.businessName, number: q.number, accountName: account.name, date: q.date, validUntil: q.validUntil, lines: q.lines, total, notes: q.notes });
        const text = `${identity.businessName}\nQuote ${q.number}\nTotal: R ${total.toFixed(2)}\nValid until: ${q.validUntil || 'Not set'}\nReview and respond: ${link}`;
        if (channel === 'email') {
            if (!account.email) {
                alert('This client has no email address.');
                return;
            }
            location.href = `mailto:${encodeURIComponent(account.email)}?subject=${encodeURIComponent(`Quote ${q.number} - ${identity.businessName}`)}&body=${encodeURIComponent(text)}`;
        }
        else {
            const phone = account.phone.replace(/[^0-9]/g, '').replace(/^0/, '27');
            if (!phone) {
                alert('This client has no phone number.');
                return;
            }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        }
    }
    catch (e) {
        alert(msg(e));
    } }
    async function deliverInvoice(inv, channel) { if (!data)
        return; const account = data.accounts.find(a => a.id === inv.accountId); if (!account)
        return; try {
        const total = documentTotal(inv.lines), balance = invoiceBalance(inv, data.payments), link = await secureLink('invoice', inv.id, inv.accountId, { documentType: 'invoice', businessName: identity.businessName, number: inv.number, accountName: account.name, issueDate: inv.issueDate, dueDate: inv.dueDate, lines: inv.lines, total, balance, notes: inv.notes });
        const text = `${identity.businessName}\nInvoice ${inv.number}\nTotal: R ${total.toFixed(2)}\nOutstanding: R ${balance.toFixed(2)}\nDue: ${inv.dueDate || 'Not set'}\nView document: ${link}`;
        if (channel === 'email') {
            if (!account.email) {
                alert('This client has no email address.');
                return;
            }
            location.href = `mailto:${encodeURIComponent(account.email)}?subject=${encodeURIComponent(`Invoice ${inv.number} - ${identity.businessName}`)}&body=${encodeURIComponent(text)}`;
        }
        else {
            const phone = account.phone.replace(/[^0-9]/g, '').replace(/^0/, '27');
            if (!phone) {
                alert('This client has no phone number.');
                return;
            }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        }
    }
    catch (e) {
        alert(msg(e));
    } }
    async function deliverStatement(accountId, channel) { if (!data || !accountId) {
        alert('Choose a client first.');
        return;
    } const account = data.accounts.find(a => a.id === accountId); if (!account)
        return; try {
        const rows = statementRows(accountId, data.invoices, data.payments), balance = rows.at(-1)?.balance ?? 0, id = `statement-${accountId}-${todayIso()}`, link = await secureLink('statement', id, accountId, { documentType: 'statement', businessName: identity.businessName, number: `Statement ${todayIso()}`, accountName: account.name, date: todayIso(), statementRows: rows, balance });
        const text = `${identity.businessName}\nStatement for ${account.name}\nCurrent balance: R ${balance.toFixed(2)}\nView statement: ${link}`;
        if (channel === 'email') {
            if (!account.email) {
                alert('This client has no email address.');
                return;
            }
            location.href = `mailto:${encodeURIComponent(account.email)}?subject=${encodeURIComponent(`Statement - ${identity.businessName}`)}&body=${encodeURIComponent(text)}`;
        }
        else {
            const phone = account.phone.replace(/[^0-9]/g, '').replace(/^0/, '27');
            if (!phone) {
                alert('This client has no phone number.');
                return;
            }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        }
    }
    catch (e) {
        alert(msg(e));
    } }
    void load();
}
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
function attr(v) { return esc(v); }
function msg(e) { return e instanceof Error ? e.message : String(e); }
//# sourceMappingURL=moneyPage.js.map