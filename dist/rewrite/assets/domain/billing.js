export function round2(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
export function lineSubtotal(line) { const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0), discount = Math.max(0, Math.min(100, Number(line.discountPercent || 0))); return round2(gross * (1 - discount / 100)); }
export function lineVat(line) { return round2(lineSubtotal(line) * Number(line.vatRate || 0) / 100); }
export function lineTotal(line) { return round2(lineSubtotal(line) + lineVat(line)); }
export function documentSubtotal(lines) { return round2(lines.reduce((sum, line) => sum + lineSubtotal(line), 0)); }
export function documentVat(lines) { return round2(lines.reduce((sum, line) => sum + lineVat(line), 0)); }
export function documentTotal(lines) { return round2(lines.reduce((sum, line) => sum + lineTotal(line), 0)); }
export function quoteTotal(quote) { return documentTotal(quote.lines); }
export function invoiceTotal(invoice) { return documentTotal(invoice.lines); }
export function activePayments(payments, invoiceId) { return payments.filter(p => p.invoiceId === invoiceId && !p.reversedAt); }
export function paidAmount(payments, invoiceId) { return round2(activePayments(payments, invoiceId).reduce((sum, p) => sum + Number(p.amount || 0), 0)); }
export function invoiceBalance(invoice, payments) { return Math.max(0, round2(invoiceTotal(invoice) - paidAmount(payments, invoice.id))); }
export function paymentStatus(invoice, payments) { const paid = paidAmount(payments, invoice.id), total = invoiceTotal(invoice); if (total > 0 && paid >= total - .01)
    return 'Paid'; if (paid > 0)
    return 'Partially paid'; return invoice.status === 'Paid' ? 'Paid' : 'Unpaid'; }
export function overdue(invoice, payments, today) { return !!invoice.dueDate && invoice.dueDate < today && invoiceBalance(invoice, payments) > .01 && !['Draft', 'Void', 'Credited'].includes(invoice.status); }
export function eligibleBillingFacts(facts) { return facts.filter(f => !f.alreadyInvoiced && ((f.status === 'completed' && ['routine', 'additional', 'quoted'].includes(f.billingDisposition)) || (f.status === 'cancelled' && f.billingDisposition === 'charge'))); }
export function nonBillableFacts(facts) { return facts.filter(f => (f.status === 'cancelled' && f.billingDisposition === 'no-charge') || f.status === 'suspended' || f.status === 'rescheduled'); }
export function factCategory(fact) { if (fact.status === 'cancelled' && fact.billingDisposition === 'charge')
    return 'cancellation'; if (fact.billingDisposition === 'additional')
    return 'additional'; if (fact.billingDisposition === 'quoted')
    return 'quoted'; return 'routine'; }
export function lineFromFact(fact, unitPrice, vatRate) { return { id: `line-${fact.visitId}`, description: fact.description || 'Garden service', quantity: 1, unitPrice: round2(unitPrice), vatRate: Number(vatRate || 0), sourceVisitId: fact.visitId, sourceQuoteId: null, category: factCategory(fact) }; }
export function invoiceLinkedVisitIds(invoice) { return invoice.lines.map(l => l.sourceVisitId).filter((id) => !!id); }
export function duplicateVisitLinks(invoices) { const seen = new Set(), dupes = new Set(); for (const inv of invoices.filter(i => !['Void', 'Credited'].includes(i.status)))
    for (const id of invoiceLinkedVisitIds(inv)) {
        if (seen.has(id))
            dupes.add(id);
        seen.add(id);
    } return [...dupes]; }
export function statementRows(accountId, invoices, payments) { const rows = []; for (const inv of invoices.filter(i => i.accountId === accountId && !['Draft', 'Void'].includes(i.status)))
    rows.push({ date: inv.issueDate || `${inv.month}-01`, type: 'Invoice', reference: inv.number, debit: invoiceTotal(inv), credit: 0, balance: 0 }); for (const p of payments.filter(p => p.accountId === accountId && !p.reversedAt))
    rows.push({ date: p.date, type: 'Payment', reference: p.reference || p.method, debit: 0, credit: p.amount, balance: 0 }); rows.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type)); let balance = 0; for (const row of rows) {
    balance = round2(balance + row.debit - row.credit);
    row.balance = balance;
} return rows; }
export function moneySummary(invoices, payments, today) { const issued = invoices.filter(i => !['Draft', 'Void', 'Credited'].includes(i.status)), invoiced = round2(issued.reduce((s, i) => s + invoiceTotal(i), 0)), received = round2(payments.filter(p => !p.reversedAt).reduce((s, p) => s + p.amount, 0)), outstanding = round2(issued.reduce((s, i) => s + invoiceBalance(i, payments), 0)), overdueAmount = round2(issued.filter(i => overdue(i, payments, today)).reduce((s, i) => s + invoiceBalance(i, payments), 0)); return { invoiced, received, outstanding, overdue: overdueAmount, drafts: invoices.filter(i => i.status === 'Draft').length }; }
export function validatePayment(amount, balance) { const errors = []; if (!Number.isFinite(amount) || amount <= 0)
    errors.push('Payment amount must be greater than zero.'); if (amount > balance + .01)
    errors.push('Payment cannot exceed the outstanding balance.'); return errors; }
//# sourceMappingURL=billing.js.map