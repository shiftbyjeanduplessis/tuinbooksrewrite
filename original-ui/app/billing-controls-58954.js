(() => {
  'use strict';

  const BUILD = '58.9.54-billing-controls';
  const $ = (id) => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function appState() {
    try { return window.state || {}; } catch (_) { return {}; }
  }

  function activeClients() {
    return (appState().clients || []).filter(client => client && client.status !== 'archived');
  }

  function invoices() {
    return Array.isArray(appState().invoices) ? appState().invoices : [];
  }

  function payments() {
    const admin = appState().adminLifecycleV56 || {};
    return Array.isArray(admin.payments) ? admin.payments.filter(row => !row?.reversedAt) : [];
  }

  function isCredit(invoice) {
    return invoice?.status === 'Credited' || invoice?.transactionType === 'Credit Note';
  }

  function isDraft(invoice) {
    const status = String(invoice?.status || '').toLowerCase();
    return status === 'draft' || status === 'ready';
  }

  function unpaidSentInvoices() {
    return invoices().filter(invoice => {
      if (!invoice || isCredit(invoice) || isDraft(invoice)) return false;
      const delivery = String(invoice.deliveryStatus || invoice.status || '').toLowerCase();
      const payment = String(invoice.paymentStatus || '').trim().toLowerCase();
      const settled = payment === 'paid' || payment === 'fully paid' || payment === 'credited';
      return (delivery.includes('sent') || String(invoice.status || '').toLowerCase() === 'sent') && !settled;
    });
  }

  function showMessage(title, message, actionLabel, action) {
    let dialog = $('billingMessageDialogV58954');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'billingMessageDialogV58954';
      dialog.className = 'dialog';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
      <div class="dialog-shell">
        <div class="dialog-heading">
          <div><span class="eyebrow">Billing</span><h2>${escapeHtml(title)}</h2></div>
          <button type="button" class="icon-button" data-close-billing-message aria-label="Close">×</button>
        </div>
        <div class="persistent-inline-note">${escapeHtml(message)}</div>
        <div class="dialog-actions">
          <button type="button" class="button secondary" data-close-billing-message>Close</button>
          ${actionLabel ? `<button type="button" class="button" data-billing-message-action>${escapeHtml(actionLabel)}</button>` : ''}
        </div>
      </div>`;
    qsa('[data-close-billing-message]', dialog).forEach(button => button.onclick = () => dialog.close());
    const actionButton = dialog.querySelector('[data-billing-message-action]');
    if (actionButton) actionButton.onclick = () => { dialog.close(); action?.(); };
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function call(name, fallbackMessage) {
    const fn = window[name];
    if (typeof fn !== 'function') {
      showMessage('Billing action unavailable', fallbackMessage || 'Reload the page and try again.');
      console.error(`[${BUILD}] Missing function: ${name}`);
      return false;
    }
    try {
      fn();
      return true;
    } catch (error) {
      console.error(`[${BUILD}] ${name} failed`, error);
      showMessage('Billing action could not open', error?.message || fallbackMessage || 'Reload the page and try again.');
      return false;
    }
  }

  function createInvoice() {
    if (!activeClients().length) {
      showMessage('No client available', 'Add or activate a client before creating an invoice.', 'Open Clients', () => window.showView?.('clients'));
      return;
    }
    call('openNewInvoiceV58952', 'The invoice editor could not be opened.');
  }

  function createStatement() {
    const hasTransactions = invoices().some(invoice => !isDraft(invoice)) || payments().length > 0;
    if (!hasTransactions) {
      showMessage('No statement activity yet', 'Statements become available after an invoice has been issued or a payment has been recorded.');
      return;
    }
    call('openStatementBuilderV58952', 'The statement builder could not be opened.');
  }

  function recordPayment() {
    if (!unpaidSentInvoices().length) {
      showMessage('No unpaid invoices', 'There are no sent invoices with an outstanding balance to allocate a payment to.');
      return;
    }
    call('openCustomerPaymentV56', 'The payment form could not be opened.');
  }

  function bindStaticControls() {
    $('billingCreateInvoiceBtnV58954')?.addEventListener('click', createInvoice);
    $('billingCreateStatementBtnV58954')?.addEventListener('click', createStatement);
    $('customerPaymentBtnV56')?.addEventListener('click', recordPayment);
    $('billingCreditNotesBtnV58954')?.addEventListener('click', () => call('openCreditNotesV58952', 'The credit-note register could not be opened.'));

    qsa('[data-billing-statements-v58954]').forEach(button => button.addEventListener('click', () => call('openStatementHistoryV58952', 'The statement register could not be opened.')));
    qsa('[data-billing-main-v58952]').forEach(button => button.addEventListener('click', () => {
      const view = button.dataset.billingMainV58952;
      const fn = window.setBillingMainV58952;
      if (typeof fn === 'function') fn(view);
      else showMessage('Billing tab unavailable', 'Reload the page and try again.');
    }));
    qsa('[data-invoice-filter-v58952]').forEach(button => button.addEventListener('click', () => {
      const filter = button.dataset.invoiceFilterV58952;
      const fn = window.setInvoiceFilterV58952;
      if (typeof fn === 'function') fn(filter);
      else showMessage('Invoice filter unavailable', 'Reload the page and try again.');
    }));
    $('billingInvoiceSearchV58952')?.addEventListener('input', event => window.searchInvoicesV58952?.(event.target.value));
  }

  function bindDynamicPaymentButton() {
    const view = $('view-invoices');
    if (!view) return;
    view.addEventListener('click', event => {
      const button = event.target.closest('#customerPaymentBtnV56');
      if (!button || button.dataset.billingBoundV58954 === 'yes') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      recordPayment();
    }, true);
  }

  function initialise() {
    bindStaticControls();
    bindDynamicPaymentButton();
    window.__tuinbooksBillingControlsV58954 = {
      build: BUILD,
      createInvoice,
      createStatement,
      recordPayment,
      activeClients: () => activeClients().length,
      unpaidInvoices: () => unpaidSentInvoices().length
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
