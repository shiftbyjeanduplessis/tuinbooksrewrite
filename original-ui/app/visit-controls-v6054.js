(() => {
  'use strict';

  const BUILD = '60.5.4-explicit-cancel-readable-cards-rolling-8-week';
  if (window.__tuinbooksVisitControlsV6054 === BUILD) return;
  window.__tuinbooksVisitControlsV6054 = BUILD;

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
      cancel = `<button type="button" class="button danger" onclick="cancelVisitDirectV6054('${htmlEsc(job.id)}','no-charge')">Cancel visit — DO NOT CHARGE</button><button type="button" class="button danger secondary" onclick="cancelVisitDirectV6054('${htmlEsc(job.id)}','charge')">Cancel visit — CHARGE CLIENT</button>`;
    }

    const holdButton = held(client) ? '' : `<button type="button" class="button secondary" onclick="openDoNotServiceV6053('${htmlEsc(client.id)}')">Mark client — DO NOT SERVICE</button>`;
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

  function installMobileWrapper() {
    if (window.__tuinbooksMobileDnsWrappedV6054) return true;
    if (typeof window.openMobileClient !== 'function') return false;
    const base = window.openMobileClient;
    window.openMobileClient = function openMobileClientV6054(clientId, scheduleId='') {
      const result = base.apply(this, arguments);
      setTimeout(() => addMobileWarning(clientId), 0);
      return result;
    };
    window.__tuinbooksMobileDnsWrappedV6054 = true;
    return true;
  }

  /* -----------------------------------------------------------------------
     Jobs-per-day rolling schedule repair.
     - Fills missing established recurring visits for current + 7 weeks.
     - Does NOT enforce guessed hourly capacity.
     - Does NOT touch existing/moved/cancelled/completed visits.
     - Does NOT auto-place NEW R clients awaiting their first placement.
     ----------------------------------------------------------------------- */
  const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const validIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  function parseNoon(value) { return new Date(`${value}T12:00:00`); }
  function iso(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function addDays(value, days) { const d = parseNoon(value); d.setDate(d.getDate()+days); return iso(d); }
  function mondayOf(value) { const d=parseNoon(value); const day=d.getDay(); d.setDate(d.getDate()-((day+6)%7)); return iso(d); }
  function daysBetween(a,b) { return Math.round((parseNoon(b)-parseNoon(a))/86400000); }
  function dayIndex(name) { const i=DAY_NAMES.indexOf(String(name || '')); return i >= 0 ? i : 0; }
  function dayNameOf(value) { const js=parseNoon(value).getDay(); return DAY_NAMES[(js+6)%7]; }
  function recurringFrequency(client) {
    const f=String(client?.frequency || '').trim().toLowerCase();
    if (f.includes('custom') || f.includes('ad hoc') || f.includes('seasonal')) return '';
    if (f.includes('fortnight')) return 'fortnightly';
    if (f.includes('month')) return 'monthly';
    if (f.includes('week')) return 'weekly';
    return '';
  }
  function nthWeekdayInMonth(yearMonth, preferredDay, anchor) {
    const [year,month]=yearMonth.split('-').map(Number);
    const preferredIndex=dayIndex(preferredDay), jsDay=preferredIndex+1;
    const anchorOrdinal=Math.min(5,Math.ceil(Number(String(anchor).slice(8,10))/7));
    const first=new Date(year,month-1,1,12), offset=(jsDay-first.getDay()+7)%7;
    let day=1+offset+(anchorOrdinal-1)*7;
    const lastDay=new Date(year,month,0,12).getDate(); while(day>lastDay)day-=7;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function routineJob(job) {
    if (!job) return false;
    try { if (typeof window.workMarkerForJobV5546 === 'function') return window.workMarkerForJobV5546(job) === 'R'; } catch (_) {}
    const marker=String(job.workMarker || '').toUpperCase();
    if (marker) return marker === 'R';
    if (job.rollingGeneratedV58929 || job.initialRecurringPlacementV6036 || job.recurrenceKey) return true;
    if (String(job.workKind || '').toLowerCase()==='recurring') return true;
    return String(job.revenueType || '').toLowerCase().includes('recurring') && !job.quoteId;
  }
  function basketHasOccurrence(clientId, weekStart) {
    const all=[...(stateNow().scheduleBasket || []),...(stateNow().scheduleOverflowQueue || [])];
    return all.some(item => {
      const cid=String(item.clientId || item.jobPayload?.clientId || '');
      if (cid !== String(clientId)) return false;
      const marker=String(item.workMarker || item.jobPayload?.workMarker || (item.quoteId || item.jobPayload?.quoteId ? 'O' : 'R')).toUpperCase();
      if (marker !== 'R') return false;
      const w=String(item.weekStart || item.originalWeekStart || (item.originalDate ? mondayOf(item.originalDate) : item.jobPayload?.date ? mondayOf(item.jobPayload.date) : ''));
      return w === weekStart;
    });
  }
  function clientEvidence(client) {
    const jobs=(stateNow().schedules || []).filter(job => String(job.clientId)===String(client.id) && routineJob(job)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    const usable=jobs.filter(job => validIso(job.date));
    const nonCancelled=usable.filter(job => !['cancelled','canceled','deleted','archived','returned_to_queue','removed_from_calendar'].includes(String(job.status||'').toLowerCase()));
    const template=(nonCancelled.length?nonCancelled:usable).at(-1) || null;
    const anchor=validIso(client.recurrenceAnchorDate)?client.recurrenceAnchorDate:validIso(client.serviceStartDate)?client.serviceStartDate:(usable[0]?.date || '');
    const preferredDay=String(client.preferredDay || (template?.date ? dayNameOf(template.date) : '')).trim();
    const teamId=String(client.preferredTeamId || client.teamId || template?.teamId || '');
    return {jobs,template,anchor,preferredDay,teamId};
  }
  function dueTarget(client, evidence, weekStart) {
    const frequency=recurringFrequency(client); if (!frequency || !validIso(evidence.anchor) || !evidence.preferredDay) return '';
    const target=addDays(weekStart,dayIndex(evidence.preferredDay));
    if (target < evidence.anchor) return '';
    if (frequency==='weekly') return target;
    if (frequency==='fortnightly') {
      const weeks=Math.floor(daysBetween(mondayOf(evidence.anchor),weekStart)/7);
      return weeks>=0 && weeks%2===0 ? target : '';
    }
    if (frequency==='monthly') return target===nthWeekdayInMonth(target.slice(0,7),evidence.preferredDay,evidence.anchor) ? target : '';
    return '';
  }
  function makeRecurringJob(client,evidence,weekStart,date) {
    const t=evidence.template || {}, now=new Date().toISOString();
    const newId=(() => { try { if (typeof window.uid==='function') return window.uid('sch'); } catch (_) {} return `sch-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; })();
    const job={
      ...t,
      id:newId,
      date,
      clientId:client.id,
      teamId:evidence.teamId,
      clusterId:client.clusterId || t.clusterId || '',
      status:'scheduled',
      estimatedHours:Number.isFinite(Number(t.estimatedHours))?Number(t.estimatedHours):Math.max(.25,Number(client.estimatedHours||1)),
      sort:Number(t.sort || 99),
      revenueType:'Recurring contract',
      workKind:'recurring',
      workMarker:'R',
      serviceIds:[...(client.serviceIds || t.serviceIds || [])],
      workTypeIds:[...(client.workTypeIds || t.workTypeIds || [])],
      customTasks:client.customTasks || t.customTasks || '',
      visitTasks:[...(t.visitTasks || [])],
      autoGenerated:true,
      autoAssigned:false,
      manualOverride:false,
      recurrenceKey:`${client.id}:${weekStart}`,
      sourceOccurrenceKey:`rolling:${client.id}:${weekStart}`,
      rollingWeekStartV58929:weekStart,
      rollingGeneratedV58929:true,
      createdAt:now,
      updatedAt:now
    };
    ['completedAt','completedByTeamId','cancelReason','cancelledAt','cancelledAtV6052','cancelledByV6052','cancellationBillingV6052','cancellationPreviousStatusV6052','cancellationPreviousChargeableV6052','resolution','resolvedAtV58931','catchUpStatus'].forEach(key=>delete job[key]);
    return job;
  }

  let rollingBusy=false, rollingLastRun=0;
  async function maintainRollingScheduleV6054(reason='automatic') {
    if (rollingBusy) return {busy:true};
    const state=stateNow();
    if (!Array.isArray(state.clients) || !Array.isArray(state.schedules) || !Array.isArray(state.teams) || !state.clients.length || !state.teams.length) return {ready:false};
    try {
      const b=window.backendV28 || {};
      if (b.managementOperationalLoadRequiredV59371 && !b.managementOperationalReadyV59371) return {ready:false};
    } catch (_) {}
    rollingBusy=true;
    try {
      const nowDate=today(), firstWeek=mondayOf(nowDate), weeks=Array.from({length:8},(_,i)=>addDays(firstWeek,i*7));
      let created=0, skippedNew=0, skippedNoEvidence=0;
      for (const client of state.clients.filter(c=>String(c.status||'').toLowerCase()==='active')) {
        if (client.awaitingInitialRecurringPlacementV6036===true) { skippedNew++; continue; }
        if (!recurringFrequency(client)) continue;
        const evidence=clientEvidence(client);
        if (!evidence.jobs.length || !evidence.teamId || !validIso(evidence.anchor)) { skippedNoEvidence++; continue; }
        for (const weekStart of weeks) {
          const target=dueTarget(client,evidence,weekStart); if (!target || target<nowDate) continue;
          const weekEnd=addDays(weekStart,6);
          const existing=(state.schedules || []).some(job => String(job.clientId)===String(client.id) && routineJob(job) && String(job.date||'')>=weekStart && String(job.date||'')<=weekEnd);
          if (existing || basketHasOccurrence(client.id,weekStart)) continue;
          state.schedules.push(makeRecurringJob(client,evidence,weekStart,target)); created++;
        }
      }
      if (created) {
        try { if (typeof window.save==='function') window.save(); else if (typeof save==='function') save(); } catch (_) {}
        try { if (typeof window.queueOperationalSyncV41==='function') window.queueOperationalSyncV41(); else if (typeof queueOperationalSyncV41==='function') queueOperationalSyncV41(); } catch (_) {}
        try { if (typeof window.renderSchedule==='function') window.renderSchedule(); } catch (_) {}
        setTimeout(decorateScheduleCards,0);
        console.info('[TuinBooks v60.5.4] rolling schedule filled',{reason,created,skippedNew,skippedNoEvidence});
      }
      rollingLastRun=Date.now();
      window.__tuinbooksRollingV6054Last={reason,created,skippedNew,skippedNoEvidence,at:new Date().toISOString()};
      return window.__tuinbooksRollingV6054Last;
    } catch (error) {
      console.error('[TuinBooks v60.5.4] rolling schedule fill failed',error);
      return {error:String(error?.message||error)};
    } finally { rollingBusy=false; }
  }
  window.maintainRollingScheduleV6054=maintainRollingScheduleV6054;

  function scheduleRollingMaintenance(reason,delay=350) {
    clearTimeout(window.__tuinbooksRollingV6054Timer);
    window.__tuinbooksRollingV6054Timer=setTimeout(()=>maintainRollingScheduleV6054(reason),delay);
  }

  /* -----------------------------------------------------------------------
     Readability / layout only. No schedule logic in these styles.
     ----------------------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('visitControlsStyleV6054')) return;
    const style = document.createElement('style');
    style.id = 'visitControlsStyleV6054';
    style.textContent = `
      .visit-controls-v6054{margin:0 0 14px;padding:14px 16px;border:1px solid #d9dedb;border-radius:14px;background:#fff;display:grid;gap:12px}
      .visit-controls-v6054 h3{margin:2px 0 3px}.visit-controls-v6054 p{margin:0;color:#68706c;font-size:13px}.visit-controls-actions-v6054{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.visit-control-status-v6054{font-weight:800;font-size:13px}
      .dns-alert-v6054{margin:0 0 12px;padding:12px 14px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dns-alert-v6054 strong{color:#8d2c24;letter-spacing:.04em}.dns-alert-v6054 span{flex:1;min-width:180px;color:#5b2925}
      .do-not-service-card-v6054{outline:2px solid #a63d32!important;outline-offset:-2px;position:relative}.dns-card-badge-v6054{position:absolute;right:5px;bottom:4px;background:#8d2c24;color:#fff;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;letter-spacing:.04em;line-height:1.2;z-index:3}
      .dns-mobile-v6054{margin:0 0 10px;padding:12px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;color:#5b2925;display:flex;flex-direction:column;gap:3px}.dns-mobile-v6054 strong{color:#8d2c24;font-size:16px;letter-spacing:.05em}

      /* Detailed schedule cards: use available vertical space instead of truncating useful text. */
      .schedule-card-clean.v59384-card{height:auto!important;min-height:54px!important;padding-top:6px!important;padding-bottom:8px!important;overflow:visible!important;align-items:start!important}
      .schedule-card-clean.v59384-card strong{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.18!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important}
      .schedule-card-clean.v59384-card .schedule-card-suburb{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.2!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important}
      .schedule-card-clean.v59384-card .schedule-card-meta{align-items:flex-start!important;flex-wrap:wrap!important;row-gap:2px!important}
      .schedule-card-clean.v59384-card .v59384-card-meta-right{align-self:flex-start!important}
      .schedule-card-clean.v59384-card .schedule-card-info-v58931{position:relative!important;z-index:4!important;flex:none!important}
      .schedule-destination-group{overflow:visible!important}

      /* Consolidated cards use the same rule: names and area text may wrap. */
      .v6006-job{min-height:48px!important;align-items:start!important;padding-top:6px!important;padding-bottom:6px!important}
      .v6006-job-copy strong,.v6006-job-copy small{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.18!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important}
      .v6006-status{max-width:92px!important;white-space:normal!important;text-align:center!important;line-height:1.12!important}

      @media(max-width:700px){.visit-controls-actions-v6054{width:100%}.visit-controls-actions-v6054 .button{flex:1 1 100%}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    injectStyles();
    installScheduleDetailWrapper();
    installMobileWrapper();
    decorateScheduleCards();
    scheduleRollingMaintenance('startup',700);

    window.addEventListener('tuinbooks:runtime-ready',()=>scheduleRollingMaintenance('runtime-ready',250));
    document.addEventListener('click',event=>{
      if (event.target?.closest?.('.nav-tab[data-view="schedule"], [data-view="schedule"]')) scheduleRollingMaintenance('schedule-open',250);
    },true);
    document.addEventListener('drop',event=>{
      if (event.target?.closest?.('#weeklyScheduleBoard,.schedule-day-lane')) scheduleRollingMaintenance('schedule-drop',900);
    },true);

    // Low-frequency safety pass. It only creates genuinely missing occurrences.
    setInterval(()=>{
      if (document.visibilityState==='visible' && Date.now()-rollingLastRun>45000) scheduleRollingMaintenance('visible-safety',150);
    },60000);

    const observer = new MutationObserver(() => {
      installScheduleDetailWrapper();
      installMobileWrapper();
      decorateScheduleCards();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.__tuinbooksSchedulePolishV6054Test={recurringFrequency,mondayOf,daysBetween,dueTarget,nthWeekdayInMonth,routineJob,clientEvidence,maintainRollingScheduleV6054};

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
