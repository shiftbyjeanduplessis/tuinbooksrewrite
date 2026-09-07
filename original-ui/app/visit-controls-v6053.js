(() => {
  'use strict';

  const BUILD = '60.5.3-visible-cancel-and-do-not-service';
  if (window.__tuinbooksVisitControlsV6053 === BUILD) return;
  window.__tuinbooksVisitControlsV6053 = BUILD;

  const htmlEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const today = () => {
    try { return typeof window.localDateISO === 'function' ? window.localDateISO() : new Date().toISOString().slice(0,10); }
    catch (_) { return new Date().toISOString().slice(0,10); }
  };
  const stateNow = () => window.state || { clients: [], schedules: [] };
  const clientForId = id => {
    try { if (typeof window.clientById === 'function') return window.clientById(id); } catch (_) {}
    return (stateNow().clients || []).find(c => String(c.id) === String(id));
  };
  const jobForId = id => (stateNow().schedules || []).find(j => String(j.id) === String(id));
  const held = client => client?.doNotServiceV6053 === true;
  const holdReason = client => String(client?.doNotServiceReasonV6053 || 'Do not service').trim();
  const holdNote = client => String(client?.doNotServiceNoteV6053 || '').trim();
  const cancellationMode = job => String(job?.cancellationBillingV6052 || '').toLowerCase();
  const cancelledByVisitControl = job => ['charge','no-charge'].includes(cancellationMode(job));

  function persistAndRefresh(message) {
    try { if (typeof window.save === 'function') window.save(); } catch (e) { console.warn('[TuinBooks] save warning', e); }
    try { if (typeof window.renderSchedule === 'function') window.renderSchedule(); } catch (_) {}
    try { if (typeof window.renderClients === 'function' && window.activeView === 'clients') window.renderClients(); } catch (_) {}
    decorateScheduleCards();
    if (message) {
      try { if (typeof window.toast === 'function') window.toast(message); } catch (_) {}
    }
  }

  window.setDoNotServiceV6053 = function setDoNotServiceV6053(clientId, reason, note='') {
    const client = clientForId(clientId);
    if (!client) return;
    client.doNotServiceV6053 = true;
    client.doNotServiceReasonV6053 = String(reason || 'Non-payment').trim() || 'Non-payment';
    client.doNotServiceNoteV6053 = String(note || '').trim();
    client.doNotServiceSinceV6053 = new Date().toISOString();
    client.updatedAt = new Date().toISOString();
    persistAndRefresh('DO NOT SERVICE notice added. Existing bookings stay on the schedule.');
  };

  window.clearDoNotServiceV6053 = function clearDoNotServiceV6053(clientId) {
    const client = clientForId(clientId);
    if (!client) return;
    delete client.doNotServiceV6053;
    delete client.doNotServiceReasonV6053;
    delete client.doNotServiceNoteV6053;
    delete client.doNotServiceSinceV6053;
    client.updatedAt = new Date().toISOString();
    persistAndRefresh('DO NOT SERVICE notice removed.');
  };

  window.openDoNotServiceV6053 = function openDoNotServiceV6053(clientId) {
    const client = clientForId(clientId);
    if (!client) return;
    let dialog = document.getElementById('doNotServiceDialogV6053');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'doNotServiceDialogV6053';
      dialog.className = 'dialog';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<div class="dialog-shell">
      <div class="dialog-heading"><div><span class="eyebrow">Client service hold</span><h2>DO NOT SERVICE — ${htmlEsc(client.name || 'client')}</h2><p>The client stays on the schedule. This is a warning to the office and field team, not a cancellation.</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></div>
      <label>Reason<select data-reason><option>Non-payment</option><option>Client requested hold</option><option>Access issue</option><option>Other</option></select></label>
      <label>Note <span class="muted-copy">(optional)</span><textarea data-note maxlength="250" placeholder="e.g. Outstanding account — do not enter property until office clears it"></textarea></label>
      <div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button danger" data-save>Mark DO NOT SERVICE</button></div>
    </div>`;
    dialog.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dialog.close());
    dialog.querySelector('[data-save]').onclick = () => {
      const reason = dialog.querySelector('[data-reason]')?.value || 'Non-payment';
      const note = dialog.querySelector('[data-note]')?.value || '';
      dialog.close();
      window.setDoNotServiceV6053(client.id, reason, note);
    };
    dialog.showModal();
  };

  function removeOldCancellationSection(html) {
    try {
      const box = document.createElement('div');
      box.innerHTML = html;
      box.querySelectorAll('section').forEach(section => {
        const text = String(section.textContent || '');
        if (text.includes('Client cancelled this visit?') || text.includes('Single-visit cancellation')) section.remove();
      });
      return box.innerHTML;
    } catch (_) { return html; }
  }

  function visitControlsHtml(job) {
    const client = clientForId(job?.clientId);
    if (!job || !client) return '';
    const status = String(job.status || 'scheduled').toLowerCase();
    const isPast = String(job.date || '') < today();
    const isCompleted = status === 'completed';
    const isCancelled = cancelledByVisitControl(job);

    const hold = held(client) ? `<div class="dns-alert-v6053"><strong>DO NOT SERVICE</strong><span>${htmlEsc(holdReason(client))}${holdNote(client) ? ` · ${htmlEsc(holdNote(client))}` : ''}</span><button type="button" class="button secondary compact" onclick="clearDoNotServiceV6053('${htmlEsc(client.id)}')">Remove notice</button></div>` : '';

    let cancel = '';
    if (isCancelled) {
      const detail = cancellationMode(job) === 'charge' ? 'Cancelled — Billable' : 'Cancelled — No charge';
      cancel = `<button type="button" class="button secondary" onclick="undoScheduleCancellationV6052('${htmlEsc(job.id)}')">Undo cancellation</button><span class="visit-control-status-v6053">${htmlEsc(detail)}</span>`;
    } else if (!isPast && !isCompleted) {
      cancel = `<button type="button" class="button danger secondary" onclick="openScheduleCancellationV6052('${htmlEsc(job.id)}')">Cancel this visit</button>`;
    }

    const holdButton = held(client) ? '' : `<button type="button" class="button secondary" onclick="openDoNotServiceV6053('${htmlEsc(client.id)}')">Mark client — DO NOT SERVICE</button>`;
    if (!cancel && !holdButton && !hold) return '';

    return `${hold}<section class="visit-controls-v6053"><div><span class="eyebrow">Visit controls</span><h3>Office actions</h3><p>Cancellation affects this booking only. DO NOT SERVICE is a client warning and leaves bookings visible.</p></div><div class="visit-controls-actions-v6053">${cancel}${holdButton}</div></section>`;
  }

  function installScheduleDetailWrapper() {
    if (window.__tuinbooksVisitDetailWrappedV6053) return true;
    let base;
    try { base = window.scheduleDetailJobV55; } catch (_) { base = null; }
    if (typeof base !== 'function') return false;
    const wrapped = function scheduleDetailJobV6053(job) {
      let html = base(job);
      html = removeOldCancellationSection(html);
      return visitControlsHtml(job) + html;
    };
    try { window.scheduleDetailJobV55 = wrapped; } catch (_) { return false; }
    window.__tuinbooksVisitDetailWrappedV6053 = true;
    return true;
  }

  function decorateScheduleCards() {
    try {
      document.querySelectorAll('[data-job-id]').forEach(card => {
        const job = jobForId(card.getAttribute('data-job-id'));
        const client = clientForId(job?.clientId);
        card.classList.toggle('do-not-service-card-v6053', !!held(client));
        const old = card.querySelector('.dns-card-badge-v6053');
        if (held(client) && !old) {
          const badge = document.createElement('span');
          badge.className = 'dns-card-badge-v6053';
          badge.textContent = 'DO NOT SERVICE';
          card.appendChild(badge);
        } else if (!held(client) && old) old.remove();
      });
    } catch (_) {}
  }

  function addMobileWarning(clientId) {
    const host = document.getElementById('mobileActiveClient');
    const client = clientForId(clientId);
    if (!host) return;
    host.querySelector('.dns-mobile-v6053')?.remove();
    if (!held(client)) return;
    const notice = document.createElement('div');
    notice.className = 'dns-mobile-v6053';
    notice.innerHTML = `<strong>DO NOT SERVICE</strong><span>${htmlEsc(holdReason(client))}${holdNote(client) ? ` · ${htmlEsc(holdNote(client))}` : ''}</span>`;
    host.prepend(notice);
  }

  function installMobileWrapper() {
    if (window.__tuinbooksMobileDnsWrappedV6053) return true;
    if (typeof window.openMobileClient !== 'function') return false;
    const base = window.openMobileClient;
    window.openMobileClient = function openMobileClientV6053(clientId, scheduleId='') {
      const result = base.apply(this, arguments);
      setTimeout(() => addMobileWarning(clientId), 0);
      return result;
    };
    window.__tuinbooksMobileDnsWrappedV6053 = true;
    return true;
  }

  function injectStyles() {
    if (document.getElementById('visitControlsStyleV6053')) return;
    const style = document.createElement('style');
    style.id = 'visitControlsStyleV6053';
    style.textContent = `
      .visit-controls-v6053{margin:0 0 14px;padding:14px 16px;border:1px solid #d9dedb;border-radius:14px;background:#fff;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}
      .visit-controls-v6053 h3{margin:2px 0 3px}.visit-controls-v6053 p{margin:0;color:#68706c;font-size:13px}.visit-controls-actions-v6053{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.visit-control-status-v6053{font-weight:700;font-size:13px}
      .dns-alert-v6053{margin:0 0 12px;padding:12px 14px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dns-alert-v6053 strong{color:#8d2c24;letter-spacing:.04em}.dns-alert-v6053 span{flex:1;min-width:180px;color:#5b2925}
      .do-not-service-card-v6053{outline:2px solid #a63d32!important;outline-offset:-2px;position:relative}.dns-card-badge-v6053{position:absolute;right:5px;bottom:4px;background:#8d2c24;color:#fff;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;letter-spacing:.04em;line-height:1.2;z-index:3}
      .dns-mobile-v6053{margin:0 0 10px;padding:12px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;color:#5b2925;display:flex;flex-direction:column;gap:3px}.dns-mobile-v6053 strong{color:#8d2c24;font-size:16px;letter-spacing:.05em}
      @media(max-width:700px){.visit-controls-v6053{align-items:stretch}.visit-controls-actions-v6053{width:100%}.visit-controls-actions-v6053 .button{flex:1 1 100%}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    injectStyles();
    installScheduleDetailWrapper();
    installMobileWrapper();
    decorateScheduleCards();

    const observer = new MutationObserver(() => {
      installScheduleDetailWrapper();
      installMobileWrapper();
      decorateScheduleCards();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
