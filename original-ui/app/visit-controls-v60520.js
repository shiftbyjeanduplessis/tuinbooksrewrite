(() => {
  'use strict';

  const BUILD = '60.5.20-pre-rolling-stable-ui';
  if (window.__tuinbooksVisitControlsV60513 === BUILD) return;
  window.__tuinbooksVisitControlsV60513 = BUILD;

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

  /* -----------------------------------------------------------------------
     Confirmed client work only.

     Older TuinBooks builds auto-inferred serviceIds from free text. Those
     inferred values must not be presented to the office/field team as if the
     client explicitly confirmed them. From v60.5.12 onward a client is treated
     as confirmed when:
       • an office user explicitly saves the client after this patch, OR
       • the business was imported from the Business Workbook Client Services,
         OR
       • a confirmed-by-office service agreement exists for the client.
     ----------------------------------------------------------------------- */
  const serviceCatalogV60512 = () => {
    const rows = stateNow()?.business?.serviceCatalog;
    return Array.isArray(rows) ? rows : [];
  };
  const serviceDefV60512 = id => serviceCatalogV60512().find(s => String(s.id) === String(id));
  const uniqueV60512 = rows => [...new Set((rows || []).map(v => String(v || '').trim()).filter(Boolean))];
  function confirmedAgreementServiceIdsV60512(clientId) {
    const rows = stateNow().serviceAgreements || [];
    return uniqueV60512(rows
      .filter(a => String(a.clientId) === String(clientId) && String(a.source || '').toLowerCase() === 'confirmed-by-office' && String(a.status || '').toLowerCase() !== 'archived')
      .flatMap(a => (a.lines || []).filter(line => line?.active !== false).map(line => line?.serviceId))
      .filter(id => !!serviceDefV60512(id)));
  }
  function clientWorkConfirmedV60512(client) {
    if (!client) return false;
    if (client.visitWorkConfirmedV60512 === true) return true;
    if (stateNow()?.business?.businessWorkbookV60426 && Array.isArray(client.serviceIds)) return true;
    return confirmedAgreementServiceIdsV60512(client.id).length > 0;
  }
  function confirmedServiceIdsV60512(client) {
    if (!client) return [];
    const agreement = confirmedAgreementServiceIdsV60512(client.id);
    if (agreement.length) return agreement;
    if (!clientWorkConfirmedV60512(client)) return [];
    return uniqueV60512((client.serviceIds || []).filter(id => !!serviceDefV60512(id)));
  }
  function confirmedTaskLinesV60512(client) {
    if (!client || !clientWorkConfirmedV60512(client)) return [];
    const rows = [];
    // A post-v60.5.12 client save rebuilds serviceDescription from the actual
    // selected client work fields, so it is safe as an explicit office source.
    if (client.visitWorkConfirmedV60512 === true) {
      String(client.serviceDescription || '').split(/[;\n]+/).map(v => v.trim()).filter(Boolean).forEach(v => rows.push(v));
      String(client.customTasks || '').split(/\n+/).map(v => v.trim()).filter(Boolean).forEach(v => rows.push(v));
    }
    if (!rows.length) {
      confirmedServiceIdsV60512(client).forEach(id => {
        const service = serviceDefV60512(id);
        (service?.defaultChecklist || []).forEach(task => rows.push(task));
      });
    }
    return uniqueV60512(rows);
  }
  function confirmedWorkHtmlV60512(job) {
    const client = clientForId(job?.clientId);
    const ids = confirmedServiceIdsV60512(client);
    const tasks = confirmedTaskLinesV60512(client);
    if (!ids.length && !tasks.length) {
      return `<h3>Work required</h3><div class="confirmed-work-empty-v60512"><strong>No confirmed services or visit tasks</strong><span>Confirm the client’s work in Clients before giving the team a checklist.</span></div>`;
    }
    const chips = ids.length ? `<div class="confirmed-service-strip-v60512">${ids.map(id => {
      const s = serviceDefV60512(id); return s ? `<span>${htmlEsc(s.shortLabel || s.name || 'Service')}</span>` : '';
    }).join('')}</div>` : '';
    const checklist = tasks.length ? `<article class="confirmed-task-card-v60512"><h4>Confirmed visit tasks</h4><div class="visit-checklist-v551">${tasks.map(task => `<label><input type="checkbox" ${String(job?.status || '').toLowerCase()==='completed'?'checked disabled':''}><span>${htmlEsc(task)}</span></label>`).join('')}</div></article>` : '';
    return `<h3>Work required</h3>${chips}${checklist}`;
  }
  function replaceWorkRequiredV60512(html, job) {
    try {
      const box = document.createElement('div'); box.innerHTML = html;
      [...box.querySelectorAll('section.visit-workspace-section-v551')].forEach(section => {
        const title = section.querySelector(':scope > h3');
        if (String(title?.textContent || '').trim() === 'Work required') section.innerHTML = confirmedWorkHtmlV60512(job);
      });
      return box.innerHTML;
    } catch (_) { return html; }
  }

  function persistAndRefresh(message) {
    try { if (typeof window.save === 'function') window.save(); } catch (e) { console.warn('[TuinBooks] save warning', e); }
    try { if (typeof window.queueOperationalSyncV41 === 'function') window.queueOperationalSyncV41(); else if (typeof queueOperationalSyncV41 === 'function') queueOperationalSyncV41(); } catch (_) {}
    try { if (typeof window.renderSchedule === 'function') window.renderSchedule(); } catch (_) {}
    try { if (typeof window.renderClients === 'function' && window.activeView === 'clients') window.renderClients(); } catch (_) {}
    decorateScheduleCards();
    if (message) {
      try { if (typeof window.toast === 'function') window.toast(message); } catch (_) {}
    }
  }

  /* -----------------------------------------------------------------------
     DO NOT SERVICE — client warning only. Bookings remain visible.
     ----------------------------------------------------------------------- */
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

  /* -----------------------------------------------------------------------
     Direct, explicit cancellation buttons. No second choice screen.
     ----------------------------------------------------------------------- */
  window.cancelVisitDirectV6054 = function cancelVisitDirectV6054(jobId, mode) {
    const job = jobForId(jobId), client = clientForId(job?.clientId);
    if (!job || !client) return window.toast?.('This visit could not be loaded.','error');
    if (!['charge','no-charge'].includes(mode)) return;
    const label = mode === 'charge' ? 'CHARGE CLIENT' : 'DO NOT CHARGE';
    if (!window.confirm(`Cancel this visit only — ${label}?\n\n${client.name || 'Client'} · ${job.date || ''}\nFuture recurring visits will not be changed.`)) return;
    if (typeof window.applyScheduleCancellationV6052 !== 'function') return window.toast?.('The single-visit cancellation control is unavailable in this build.','error');
    window.applyScheduleCancellationV6052(job.id, mode, 'Client cancelled this visit');
  };

  function removeOldCancellationSection(html) {
    try {
      const box = document.createElement('div');
      box.innerHTML = html;
      box.querySelectorAll('section').forEach(section => {
        const text = String(section.textContent || '');
        if (text.includes('Client cancelled this visit?') || text.includes('Single-visit cancellation') || text.includes('Visit controls')) section.remove();
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

    const hold = held(client) ? `<div class="dns-alert-v6054"><strong>DO NOT SERVICE</strong><span>${htmlEsc(holdReason(client))}${holdNote(client) ? ` · ${htmlEsc(holdNote(client))}` : ''}</span><button type="button" class="button secondary compact" onclick="clearDoNotServiceV6053('${htmlEsc(client.id)}')">Remove notice</button></div>` : '';

    let cancel = '';
    if (isCancelled) {
      const detail = cancellationMode(job) === 'charge' ? 'Cancelled — CHARGE CLIENT' : 'Cancelled — DO NOT CHARGE';
      cancel = `<span class="visit-control-status-v6054">${htmlEsc(detail)}</span><button type="button" class="button secondary" onclick="undoScheduleCancellationV6052('${htmlEsc(job.id)}')">Undo cancellation</button>`;
    } else if (!isPast && !isCompleted) {
      cancel = `<button type="button" class="button cancel-no-charge-v60511" onclick="cancelVisitDirectV6054('${htmlEsc(job.id)}','no-charge')">Cancel visit — DO NOT CHARGE</button><button type="button" class="button cancel-charge-v60511" onclick="cancelVisitDirectV6054('${htmlEsc(job.id)}','charge')">Cancel visit — CHARGE CLIENT</button>`;
    }

    const holdButton = held(client) ? '' : `<button type="button" class="button dns-hold-button-v60511" onclick="openDoNotServiceV6053('${htmlEsc(client.id)}')">Mark client — DO NOT SERVICE</button>`;
    if (!cancel && !holdButton && !hold) return '';

    return `${hold}<section class="visit-controls-v6054"><div><span class="eyebrow">Visit controls</span><h3>Office actions</h3><p>These cancellation buttons affect this booking only. Future recurring visits stay unchanged.</p></div><div class="visit-controls-actions-v6054">${cancel}${holdButton}</div></section>`;
  }

  function installScheduleDetailWrapper() {
    if (window.__tuinbooksVisitDetailWrappedV6054) return true;
    let base;
    try { base = window.scheduleDetailJobV55; } catch (_) { base = null; }
    if (typeof base !== 'function') return false;
    const wrapped = function scheduleDetailJobV6054(job) {
      let html = base(job);
      html = removeOldCancellationSection(html);
      html = replaceWorkRequiredV60512(html, job);
      return visitControlsHtml(job) + html;
    };
    try { window.scheduleDetailJobV55 = wrapped; } catch (_) { return false; }
    window.__tuinbooksVisitDetailWrappedV6054 = true;
    return true;
  }

  function decorateScheduleCards() {
    try {
      document.querySelectorAll('[data-job-id]').forEach(card => {
        const job = jobForId(card.getAttribute('data-job-id'));
        const client = clientForId(job?.clientId);
        card.classList.toggle('do-not-service-card-v6054', !!held(client));
        const old = card.querySelector('.dns-card-badge-v6054');
        if (held(client) && !old) {
          const badge = document.createElement('span');
          badge.className = 'dns-card-badge-v6054';
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
    host.querySelector('.dns-mobile-v6054')?.remove();
    if (!held(client)) return;
    const notice = document.createElement('div');
    notice.className = 'dns-mobile-v6054';
    notice.innerHTML = `<strong>DO NOT SERVICE</strong><span>${htmlEsc(holdReason(client))}${holdNote(client) ? ` · ${htmlEsc(holdNote(client))}` : ''}</span>`;
    host.prepend(notice);
  }

  function installClientWorkConfirmationV60512() {
    if (window.__tuinbooksClientWorkConfirmationV60512) return true;
    if (typeof window.saveClientForm !== 'function') return false;
    const base = window.saveClientForm;
    window.saveClientForm = function saveClientFormV60512(event) {
      const st = stateNow(), before = new Set((st.clients || []).map(c => String(c.id)));
      const existingId = document.getElementById('clientId')?.value || '';
      if (existingId) {
        const c = clientForId(existingId); if (c) { c.visitWorkConfirmedV60512 = true; c.visitWorkConfirmedAtV60512 = new Date().toISOString(); }
      }
      const result = base.apply(this, arguments);
      if (!existingId) {
        const created = (stateNow().clients || []).find(c => !before.has(String(c.id)));
        if (created) {
          created.visitWorkConfirmedV60512 = true; created.visitWorkConfirmedAtV60512 = new Date().toISOString();
          try { window.save?.(); } catch (_) {}
        }
      }
      return result;
    };
    window.__tuinbooksClientWorkConfirmationV60512 = true;
    return true;
  }

  function installVisitPanelTopResetV60512() {
    if (window.__tuinbooksVisitPanelTopResetV60512) return true;
    if (typeof window.openScheduleJobV55 !== 'function') return false;
    const base = window.openScheduleJobV55;
    window.openScheduleJobV55 = function openScheduleJobV60512() {
      const result = base.apply(this, arguments);
      requestAnimationFrame(() => {
        const panel = document.getElementById('scheduleDetailPanel');
        const content = document.getElementById('scheduleDetailContent');
        if (panel) panel.scrollTop = 0;
        if (content) content.scrollTop = 0;
      });
      return result;
    };
    window.__tuinbooksVisitPanelTopResetV60512 = true;
    return true;
  }

  function enforceConfirmedMobileWorkV60512(clientId) {
    const client = clientForId(clientId); if (!client || clientWorkConfirmedV60512(client)) return;
    document.querySelector('#mobileActiveClient .v55-service-strip')?.remove();
    const host = document.getElementById('mobileWorkChecklist');
    if (host) host.innerHTML = '<div class="confirmed-work-empty-v60512"><strong>No confirmed visit tasks</strong><span>The office must confirm this client’s work before a checklist is shown.</span></div>';
    const script = document.getElementById('mobileJobScript');
    if (script) { script.innerHTML = '<span class="eyebrow">Work required</span><h2>No confirmed tasks</h2><p>Ask the office to confirm the client work before servicing.</p>'; script.classList.remove('hidden'); }
  }

  function installMobileWrapper() {
    if (window.__tuinbooksMobileDnsWrappedV6054) return true;
    if (typeof window.openMobileClient !== 'function') return false;
    const base = window.openMobileClient;
    window.openMobileClient = function openMobileClientV6054(clientId, scheduleId='') {
      const result = base.apply(this, arguments);
      setTimeout(() => { addMobileWarning(clientId); enforceConfirmedMobileWorkV60512(clientId); }, 0);
      return result;
    };
    window.__tuinbooksMobileDnsWrappedV6054 = true;
    return true;
  }

  /* Rolling schedule intentionally left to the original TuinBooks scheduler. */

  /* -----------------------------------------------------------------------
     Readability / layout only. No schedule logic in these styles.
     ----------------------------------------------------------------------- */
  /* -----------------------------------------------------------------------
     ONE ad-hoc renderer only.
     v6010 is the final schedule renderer and survives every board repaint.
     Keep it authoritative, make it look like the approved blue-edge card,
     and suppress the older v59694/v6005 copies before they can flash.
     ----------------------------------------------------------------------- */
  let approvedActionObserverV60514 = null;
  let approvedActionObservedHostV60514 = null;
  let approvedActionPaintQueuedV60514 = false;

  function hideDuplicateActionRenderersV60514(){
    try{
      document.querySelectorAll(
        '#weeklyScheduleBoard .schedule-operational-items-v59694, '+
        '#weeklyScheduleBoard .schedule-actions-v6005, '+
        '.mobile-operational-items-v59694'
      ).forEach(node=>node.remove());
    }catch(_){ }
  }

  function paintApprovedActionsV60514(){
    hideDuplicateActionRenderersV60514();
  }

  function scheduleApprovedActionPaintV60514(){
    if(approvedActionPaintQueuedV60514)return;
    approvedActionPaintQueuedV60514=true;
    requestAnimationFrame(()=>{
      approvedActionPaintQueuedV60514=false;
      hideDuplicateActionRenderersV60514();
    });
  }

  function observeApprovedActionHostV60514(){
    const host=document.getElementById('view-schedule')||document.getElementById('weeklyScheduleBoard')||document.getElementById('mobileScheduleList');
    if(!host)return;
    if(!approvedActionObserverV60514){
      approvedActionObserverV60514=new MutationObserver(()=>scheduleApprovedActionPaintV60514());
    }
    if(approvedActionObservedHostV60514!==host){
      try{approvedActionObserverV60514.disconnect();}catch(_){ }
      approvedActionObservedHostV60514=host;
    }
    try{approvedActionObserverV60514.observe(host,{childList:true,subtree:true});}catch(_){ }
  }

  function reconcileScheduleActionRenderersV60511(){
    hideDuplicateActionRenderersV60514();
    observeApprovedActionHostV60514();
  }
  function injectStyles() {
    if (document.getElementById('visitControlsStyleV6055')) return;
    const style = document.createElement('style');
    style.id = 'visitControlsStyleV6055';
    style.textContent = `

      /* One calm office action colour. All three buttons are deliberate office controls. */
      .visit-controls-v6054{color:#24302b!important}
      .visit-controls-v6054 p{color:#46544e!important}
      .visit-controls-actions-v6054 .button{
        background:#0d4f35!important;color:#fff!important;border:1px solid #0d4f35!important;
        box-shadow:none!important;font-weight:850!important
      }
      .visit-controls-actions-v6054 .button:hover{background:#083d29!important;border-color:#083d29!important;color:#fff!important}

      /* One ad-hoc renderer only: v6010 is the persistent final renderer. */
      #weeklyScheduleBoard .schedule-operational-items-v59694,
      #weeklyScheduleBoard .schedule-actions-v6005,
      .mobile-operational-items-v59694{display:none!important}
      #weeklyScheduleBoard .schedule-actions-v6010{display:grid!important;gap:5px!important;padding:5px 6px 2px!important}
      #weeklyScheduleBoard .schedule-action-v6010{
        width:100%!important;box-sizing:border-box!important;
        display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;
        grid-template-areas:"label time" "copy copy"!important;
        column-gap:8px!important;row-gap:5px!important;align-items:start!important;
        padding:8px 9px!important;border-radius:9px!important;text-align:left!important;overflow:hidden!important
      }
      #weeklyScheduleBoard .schedule-action-v6010.event{
        background:#f1f7fb!important;border:1px solid #b9cddd!important;border-left:4px solid #4c87ad!important;color:#294a61!important
      }
      #weeklyScheduleBoard .schedule-action-v6010.instruction{
        background:#fff8dc!important;border:1px solid #ddc98c!important;border-left:4px solid #c6a33a!important;color:#4f431e!important
      }
      #weeklyScheduleBoard .schedule-action-v6010>span{
        grid-area:label!important;justify-self:start!important;min-width:0!important;max-width:100%!important;
        font-size:.54rem!important;line-height:1.15!important;font-weight:900!important;letter-spacing:.06em!important;white-space:normal!important
      }
      #weeklyScheduleBoard .schedule-action-v6010>div{grid-area:copy!important;min-width:0!important;width:100%!important}
      #weeklyScheduleBoard .schedule-action-v6010 strong{
        display:block!important;width:100%!important;margin:0!important;font-size:.71rem!important;line-height:1.22!important;
        white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important
      }
      #weeklyScheduleBoard .schedule-action-v6010 small{
        display:block!important;width:100%!important;margin:4px 0 0!important;font-size:.62rem!important;line-height:1.3!important;
        white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important
      }
      #weeklyScheduleBoard .schedule-action-v6010 time{
        grid-area:time!important;justify-self:end!important;align-self:start!important;margin:1px 0 0!important;
        font-size:.58rem!important;line-height:1!important;font-weight:900!important;white-space:nowrap!important
      }
      .visit-controls-v6054{margin:0 0 14px;padding:14px 16px;border:1px solid #d9dedb;border-radius:14px;background:#fff;display:grid;gap:12px}
      .visit-controls-v6054 h3{margin:2px 0 3px}.visit-controls-v6054 p{margin:0;color:#68706c;font-size:13px}.visit-controls-actions-v6054{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.visit-control-status-v6054{font-weight:800;font-size:13px}
      .dns-alert-v6054{margin:0 0 12px;padding:12px 14px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dns-alert-v6054 strong{color:#8d2c24;letter-spacing:.04em}.dns-alert-v6054 span{flex:1;min-width:180px;color:#5b2925}
      .do-not-service-card-v6054{outline:2px solid #a63d32!important;outline-offset:-2px;position:relative}.dns-card-badge-v6054{position:absolute;right:5px;bottom:4px;background:#8d2c24;color:#fff;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;letter-spacing:.04em;line-height:1.2;z-index:3}
      .dns-mobile-v6054{margin:0 0 10px;padding:12px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;color:#5b2925;display:flex;flex-direction:column;gap:3px}.dns-mobile-v6054 strong{color:#8d2c24;font-size:16px;letter-spacing:.05em}

      /* Readable schedule cards: full name first; area and time get separate rows. */
      .schedule-card-clean.v59384-card{
        height:auto!important;
        min-height:max(62px,var(--card-height))!important;
        padding:6px 6px 9px 5px!important;
        overflow:hidden!important;
        align-items:start!important;
      }
      .schedule-card-clean.v59384-card .schedule-work-marker{align-self:start!important;margin-top:1px!important}
      .schedule-card-clean.v59384-card .schedule-card-copy{
        display:flex!important;flex-direction:column!important;align-items:stretch!important;
        min-width:0!important;width:100%!important;gap:3px!important;padding-right:1px!important;
      }
      .schedule-card-clean.v59384-card strong{
        display:block!important;width:100%!important;white-space:normal!important;overflow:visible!important;
        text-overflow:clip!important;word-break:normal!important;overflow-wrap:anywhere!important;
        font-size:.70rem!important;line-height:1.18!important;font-weight:850!important;
      }
      .schedule-card-clean.v59384-card .schedule-card-meta{
        display:flex!important;flex-direction:column!important;align-items:stretch!important;
        justify-content:flex-start!important;gap:3px!important;min-width:0!important;width:100%!important;
      }
      .schedule-card-clean.v59384-card .schedule-card-suburb{
        display:block!important;width:100%!important;min-width:0!important;white-space:normal!important;
        overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important;
        font-size:.56rem!important;line-height:1.18!important;font-weight:650!important;
      }
      .schedule-card-clean.v59384-card .v59384-card-meta-right{
        display:flex!important;width:100%!important;align-items:center!important;justify-content:flex-start!important;
        gap:5px!important;min-width:0!important;white-space:nowrap!important;
      }
      .schedule-card-clean.v59384-card .v59384-card-time,
      .schedule-card-clean.v59384-card .schedule-card-duration{font-size:.54rem!important;line-height:1.05!important}
      .schedule-card-clean.v59384-card .schedule-card-info-v58931{align-self:start!important;margin-top:0!important}


      /* The visit workspace must behave like a real modal: everything behind it is obscured. */
      body.schedule-zoom-open::before{
        content:""!important;display:block!important;position:fixed!important;inset:0!important;
        background:rgba(9,32,23,.62)!important;backdrop-filter:blur(2px)!important;
        z-index:2147482400!important;pointer-events:auto!important
      }
      .schedule-control-room.detail-open .schedule-detail-panel.job-workspace-v551{
        position:fixed!important;top:12px!important;right:12px!important;bottom:12px!important;left:auto!important;
        transform:none!important;width:min(720px,calc(100vw - 24px))!important;height:auto!important;
        max-height:calc(100vh - 24px)!important;overflow:hidden!important;z-index:2147482401!important;
        border-radius:18px!important;background:#fff!important;box-shadow:0 24px 90px rgba(0,0,0,.34)!important
      }
      .schedule-control-room.detail-open .schedule-detail-panel.job-workspace-v551 .schedule-detail-head{
        position:sticky!important;top:0!important;z-index:5!important;background:#fff!important
      }
      .schedule-control-room.detail-open .schedule-detail-panel.job-workspace-v551 .schedule-detail-content{
        height:calc(100% - 70px)!important;overflow:auto!important
      }
      .confirmed-service-strip-v60512{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 9px}
      .confirmed-service-strip-v60512 span{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#edf5f0;color:#174c36;font-size:.74rem;font-weight:800}
      .confirmed-task-card-v60512{padding:12px;border:1px solid #d8e3dd;border-radius:12px;background:#fff}
      .confirmed-task-card-v60512 h4{margin:0 0 9px;color:#173f31}
      .confirmed-work-empty-v60512{display:grid;gap:3px;padding:12px;border:1px dashed #c4d4cc;border-radius:11px;background:#f8fbf9;color:#405049}
      .confirmed-work-empty-v60512 strong{color:#173f31}
      .confirmed-work-empty-v60512 span{font-size:.8rem;color:#65746d}

      /* v60.5.15 — spacing only. Keep text away from borders and the resize handle. */
      .schedule-card-clean.v59384-card{
        min-height:max(70px,var(--card-height))!important;
        padding:8px 9px 14px 7px!important;
        column-gap:7px!important;
      }
      .schedule-card-clean.v59384-card .schedule-card-copy{gap:4px!important;padding-right:2px!important}
      .schedule-card-clean.v59384-card strong{
        font-size:.69rem!important;line-height:1.22!important;
        padding-right:2px!important;
      }
      .schedule-card-clean.v59384-card .schedule-card-meta{gap:4px!important}
      .schedule-card-clean.v59384-card .schedule-card-suburb{
        font-size:.57rem!important;line-height:1.24!important;padding-right:2px!important;
      }
      .schedule-card-clean.v59384-card .v59384-card-meta-right{
        margin-top:1px!important;min-height:14px!important;
      }
      .schedule-card-clean.v59384-card .schedule-card-resize{bottom:1px!important;height:8px!important}

      /* v60.5.17 — Management Mode has its own sticky banner. Keep the normal
         TuinBooks header below it instead of allowing two sticky headers at top:0. */
      body.management-route-v60517 .admin-header{top:var(--tb-management-banner-h,0px)!important}
      body.management-route-v60517 .schedule-basket-launcher-v58931{top:calc(170px + var(--tb-management-banner-h,0px))!important}

      /* Give narrow schedule cards a genuine inner gutter on all four sides. */
      .schedule-card-clean.v59384-card{
        grid-template-columns:17px minmax(0,1fr) 20px!important;
        min-height:max(76px,var(--card-height))!important;
        padding:9px 10px 16px 8px!important;
        column-gap:8px!important;
        box-sizing:border-box!important;
      }
      .schedule-card-clean.v59384-card .schedule-card-copy{padding:0 3px 0 0!important;gap:5px!important}
      .schedule-card-clean.v59384-card strong,
      .schedule-card-clean.v59384-card .schedule-card-suburb{max-width:100%!important;margin:0!important}
      .schedule-card-clean.v59384-card .schedule-card-info-v58931{margin:0!important;justify-self:end!important}
      .schedule-card-clean.v59384-card .schedule-card-resize{left:28px!important;right:10px!important;bottom:2px!important}

      @media(max-width:700px){
        .visit-controls-actions-v6054{width:100%}.visit-controls-actions-v6054 .button{flex:1 1 100%}
        .schedule-control-room.detail-open .schedule-detail-panel.job-workspace-v551{top:0!important;right:0!important;bottom:0!important;left:0!important;width:100vw!important;max-height:100vh!important;border-radius:0!important}
      }
    `;
    document.head.appendChild(style);
  }

  function syncManagementOffsetV60517(){
    try{
      const banner=document.querySelector('#managementModeBannerV5936,#managementModeBannerV5935');
      const height=banner?Math.ceil(banner.getBoundingClientRect().height):0;
      document.body?.classList.toggle('management-route-v60517',!!banner);
      document.documentElement.style.setProperty('--tb-management-banner-h',`${height}px`);
    }catch(_){}
  }

  function install() {
    injectStyles();
    syncManagementOffsetV60517();
    setTimeout(syncManagementOffsetV60517,250);
    setTimeout(syncManagementOffsetV60517,1200);
    installScheduleDetailWrapper();
    installClientWorkConfirmationV60512();
    installVisitPanelTopResetV60512();
    installMobileWrapper();
    decorateScheduleCards();
    reconcileScheduleActionRenderersV60511();
    if(document.body?.dataset?.app!=='mobile'){
      observeApprovedActionHostV60514();
      scheduleApprovedActionPaintV60514(true);
    }
  }

  window.__tuinbooksVisitUiV60520Test={reconcileScheduleActionRenderersV60511,paintApprovedActionsV60514,hideDuplicateActionRenderersV60514,clientWorkConfirmedV60512,confirmedServiceIdsV60512,confirmedTaskLinesV60512,replaceWorkRequiredV60512};

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
