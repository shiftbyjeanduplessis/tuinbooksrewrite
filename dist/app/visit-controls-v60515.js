(() => {
  'use strict';

  const BUILD = '60.5.15-card-spacing-adhoc-layout';
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

  /* -----------------------------------------------------------------------
     Cloud-aware rolling schedule.

     v60.5.7 exposed an important production fact: cancelled/removed recurring
     rows can remain in Supabase for audit while the live browser projection
     hides them. Creating a new row from browser state alone can therefore hit
     schedule_jobs_recurrence_unique_v53 even though the week looks empty.

     v60.5.10 never writes a recurring occurrence until it has first read the
     authoritative cloud rows for the entire 8-week horizon. ANY existing
     recurring occurrence for that client/week — including cancelled audit
     rows — blocks a replacement. New rows are sent as a narrow schedule-only
     operational delta; browser state is updated only after the cloud accepts
     them. A 23505 recurrence collision triggers one re-read/reconcile, not a
     blind Retry Save loop.
     ----------------------------------------------------------------------- */
  const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const validIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  function parseNoon(value) { return new Date(`${value}T12:00:00`); }
  function iso(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function addDays(value, days) { const d = parseNoon(value); d.setDate(d.getDate()+days); return iso(d); }
  function mondayOf(value) { const d=parseNoon(value); const day=d.getDay(); d.setDate(d.getDate()-((day+6)%7)); return iso(d); }
  function daysBetween(a,b) { return Math.round((parseNoon(b)-parseNoon(a))/86400000); }
  function dayIndex(name) { return DAY_NAMES.indexOf(String(name || '')); }
  function dayNameOf(value) { const d=parseNoon(value); const js=d.getDay(); return js===0?'Sunday':DAY_NAMES[js-1]||''; }
  function normalStatus(value){return String(value||'scheduled').toLowerCase().replace(/[-\\s]+/g,'_');}
  function terminalCancellation(job){return ['cancelled','canceled','cancelled_before_visit','canceled_before_visit'].includes(normalStatus(job?.status));}

  function explicitCadence(value) {
    const f=String(value || '').trim().toLowerCase();
    if (/fortnight|biweekly|bi weekly|every 2 week|two week/.test(f)) return 'fortnightly';
    if (/weekly|every week|once a week/.test(f) && !/fortnight/.test(f)) return 'weekly';
    if (/monthly|once a month|every month/.test(f)) return 'monthly';
    return '';
  }
  function workMarker(job){
    const marker=String(job?.workMarker||'').toUpperCase();
    if(marker)return marker;
    try{if(typeof window.workMarkerForJobV5546==='function')return String(window.workMarkerForJobV5546(job)||'').toUpperCase();}catch(_){ }
    return '';
  }
  function routineEvidenceJob(job,client){
    if(!job||!validIso(job.date)||String(job.clientId)!==String(client?.id))return false;
    if(job.quoteId||workMarker(job)==='O')return false;
    const text=`${job.workKind||''} ${job.revenueType||''}`.toLowerCase();
    if(/once[- ]?off|additional|quote/.test(text))return false;
    if(workMarker(job)==='R'||job.recurrenceKey||job.rollingGeneratedV58929||job.initialRecurringPlacementV6036)return true;
    const clientRecurring=!!explicitCadence(client?.frequency)||String(client?.recordKindV58951||'').toLowerCase().includes('recurring');
    return clientRecurring;
  }
  function mode(values){
    const counts=new Map();
    values.filter(Boolean).forEach(v=>counts.set(v,(counts.get(v)||0)+1));
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])))[0]?.[0]||'';
  }
  function median(nums){const a=[...nums].sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function inferCadence(client,jobs){
    const explicit=explicitCadence(client?.frequency);if(explicit)return explicit;
    const dates=[...new Set(jobs.map(j=>j.date).filter(validIso))].sort();
    const gaps=[];for(let i=1;i<dates.length;i++){const gap=daysBetween(dates[i-1],dates[i]);if(gap>=5&&gap<=45)gaps.push(gap);}
    const gap=median(gaps.slice(-6));
    if(gap>=5&&gap<=10)return 'weekly';
    if(gap>=11&&gap<=20)return 'fortnightly';
    if(gap>=21&&gap<=40)return 'monthly';
    return '';
  }
  function nthWeekdayInMonth(yearMonth, preferredDay, anchor) {
    const [year,month]=yearMonth.split('-').map(Number), preferredIndex=dayIndex(preferredDay);
    if(preferredIndex<0)return '';
    const jsDay=preferredIndex+1, anchorOrdinal=Math.min(5,Math.ceil(Number(String(anchor).slice(8,10))/7));
    const first=new Date(year,month-1,1,12), offset=(jsDay-first.getDay()+7)%7;
    let day=1+offset+(anchorOrdinal-1)*7;const lastDay=new Date(year,month,0,12).getDate();while(day>lastDay)day-=7;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function clientPattern(client){
    const jobs=(stateNow().schedules||[]).filter(j=>routineEvidenceJob(j,client)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const usable=jobs.filter(j=>!terminalCancellation(j));
    const recent=usable.slice(-8), template=recent.at(-1)||usable.at(-1)||jobs.at(-1)||null;
    const cadence=inferCadence(client,usable.length?usable:jobs);
    const historyDays=recent.map(j=>dayNameOf(j.date)).filter(d=>DAY_NAMES.includes(d));
    const preferredDay=mode(historyDays)||String(client.preferredDay||'');
    const teamId=mode(recent.map(j=>String(j.teamId||'')).filter(Boolean))||String(client.preferredTeamId||client.teamId||template?.teamId||'');
    const anchor=[client.recurrenceAnchorDate,client.serviceStartDate,usable[0]?.date,jobs[0]?.date].find(validIso)||'';
    const enoughEvidence=!!template&&!!cadence&&!!teamId&&DAY_NAMES.includes(preferredDay)&&(usable.length>=2||!!explicitCadence(client.frequency));
    return {jobs,usable,template,cadence,preferredDay,teamId,anchor,enoughEvidence};
  }
  function targetForWeek(pattern,weekStart){
    if(!pattern.enoughEvidence||!validIso(pattern.anchor))return '';
    const idx=dayIndex(pattern.preferredDay);if(idx<0)return '';
    const target=addDays(weekStart,idx);if(target<pattern.anchor)return '';
    if(pattern.cadence==='weekly')return target;
    if(pattern.cadence==='fortnightly'){
      const weeks=Math.floor(daysBetween(mondayOf(pattern.anchor),weekStart)/7);
      return weeks>=0&&weeks%2===0?target:'';
    }
    if(pattern.cadence==='monthly')return target===nthWeekdayInMonth(target.slice(0,7),pattern.preferredDay,pattern.anchor)?target:'';
    return '';
  }
  function basketHasOccurrence(clientId,weekStart){
    const rows=[...(stateNow().scheduleBasket||[]),...(stateNow().scheduleOverflowQueue||[])];
    return rows.some(item=>{
      const cid=String(item.clientId||item.jobPayload?.clientId||'');if(cid!==String(clientId))return false;
      const marker=String(item.workMarker||item.jobPayload?.workMarker||(item.quoteId||item.jobPayload?.quoteId?'O':'R')).toUpperCase();if(marker!=='R')return false;
      const d=String(item.originalDate||item.jobPayload?.date||'');const w=String(item.weekStart||item.originalWeekStart||(validIso(d)?mondayOf(d):''));
      return w===weekStart;
    });
  }
  function weekHasOccurrence(clientId,weekStart){
    const end=addDays(weekStart,6),client=clientForId(clientId);
    return (stateNow().schedules||[]).some(job=>String(job.clientId)===String(clientId)&&routineEvidenceJob(job,client)&&String(job.date||'')>=weekStart&&String(job.date||'')<=end);
  }
  function movedOccurrenceExistsV60511(clientId,weekStart){
    return (stateNow().schedules||[]).some(job=>String(job.clientId)===String(clientId)&&String(job.movedFromWeekStartV58930||'')===String(weekStart));
  }
  function explicitClientTasksV60511(client){
    if(!client)return [];
    const standard=(()=>{try{return typeof window.workTypeLabelsV9==='function'?window.workTypeLabelsV9(client.workTypeIds||[]):[];}catch(_){return [];}})();
    const custom=(()=>{try{return typeof window.customTaskLinesV9==='function'?window.customTaskLinesV9(client.customTasks||''):String(client.customTasks||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);}catch(_){return [];}})();
    return [...standard,...custom].map(v=>String(v||'').trim()).filter((v,i,a)=>v&&a.indexOf(v)===i);
  }
  function syncRoutineJobTasksFromClientsV60511(){
    try{
      (stateNow().schedules||[]).forEach(job=>{
        const client=clientForId(job?.clientId);if(!client||workMarker(job)==='O'||job?.quoteId)return;
        const status=normalStatus(job?.status);if(status==='completed')return;
        const tasks=explicitClientTasksV60511(client);if(!tasks.length)return; // legacy clients keep existing fallback
        job.workTypeIds=[...(client.workTypeIds||[])];
        job.customTasks=String(client.customTasks||'');
        job.serviceIds=[...(client.serviceIds||job.serviceIds||[])];
        job.visitTasks=[...tasks];
      });
    }catch(_){ }
  }
  function makeRecurringJob(client,pattern,weekStart,date){
    const t=pattern.template||{},now=new Date().toISOString();
    const newId=(()=>{try{if(typeof window.uid==='function')return window.uid('sch');}catch(_){}return `sch-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;})();
    const tasks=explicitClientTasksV60511(client);
    const job={...t,id:newId,date,clientId:client.id,teamId:pattern.teamId,status:'scheduled',sort:Number(t.sort||99),revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',autoGenerated:true,autoAssigned:false,manualOverride:false,recurrenceKey:`${client.id}:${weekStart}`,sourceOccurrenceKey:`rolling:${client.id}:${weekStart}`,rollingWeekStartV58929:weekStart,rollingGeneratedV58929:true,workTypeIds:[...(client.workTypeIds||t.workTypeIds||[])],customTasks:String(client.customTasks||t.customTasks||''),serviceIds:[...(client.serviceIds||t.serviceIds||[])],visitTasks:tasks.length?[...tasks]:[...(t.visitTasks||[])],createdAt:now,updatedAt:now};
    ['completedAt','completedByTeamId','cancelReason','cancelledAt','cancelledAtV6052','cancelledByV6052','cancellationBillingV6052','cancellationPreviousStatusV6052','cancellationPreviousChargeableV6052','resolution','resolvedAtV58931','catchUpStatus','movedFromWeekStartV58930'].forEach(k=>delete job[k]);
    return job;
  }

  function managementRouteV60511(){
    try{const p=new URLSearchParams(location.search);return p.get('support')==='1'&&!!p.get('business');}catch(_){return false;}
  }
  function rollingWorkspaceReadyV60511(){
    const b=window.backendV28||{},st=stateNow();
    if(!Array.isArray(st.clients)||!Array.isArray(st.schedules)||!st.clients.length)return false;
    // Rolling maintenance is additive background work. Never compete with a user save,
    // an unresolved cloud conflict, or initial hydration.
    if(b.operationalHydrating||b.operationalSyncing||b.operationalDirty||b.operationalConflict)return false;
    if(managementRouteV60511())return !!b.managementCoreReadyV5950&&!!(b.managementOperationalReadyV5950||b.managementOperationalReadyV59371)&&!!b.lastOperationalJson;
    if(String(b.mode||'').toLowerCase()==='supabase')return !!b.businessId&&!!b.lastOperationalJson;
    return true;
  }
  function cloudRoutineRowV60511(row){
    const p=row?.payload||{};
    const marker=String(p.workMarker||'').toUpperCase();
    if(p.quoteId||marker==='O')return false;
    const text=`${p.workKind||''} ${p.revenueType||''}`.toLowerCase();
    if(/once[- ]?off|additional|quote/.test(text))return false;
    return marker==='R'||!!p.recurrenceKey||!!p.rollingGeneratedV58929||!!p.initialRecurringPlacementV6036||/recurring|routine/.test(text);
  }
  async function cloudScheduleRowsV60511(){
    const b=window.backendV28||{};
    if(String(b.mode||'').toLowerCase()!=='supabase'||!b.client||!b.businessId)return [];
    // IMPORTANT: recurrenceKey is globally unique per business regardless of visit_date.
    // Read all schedule rows so a moved/cancelled/audit row outside the visible 8-week
    // date range can never be mistaken for a free recurrence slot.
    const {data,error}=await b.client.from('schedule_jobs')
      .select('id,visit_date,client_id,team_id,status,estimated_hours,sort_order,billing_profile_id,payload,updated_at')
      .eq('business_id',b.businessId);
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }
  function cloudOccurrenceIndexV60511(rows){
    const keys=new Set(),weeks=new Set(),moved=new Set();
    (rows||[]).forEach(row=>{
      if(!cloudRoutineRowV60511(row))return;
      const p=row.payload||{},cid=String(row.client_id||p.clientId||''),date=String(row.visit_date||p.date||'').slice(0,10);
      const recurrenceKey=String(p.recurrenceKey||'');if(recurrenceKey)keys.add(recurrenceKey);
      if(cid&&validIso(date))weeks.add(`${cid}:${mondayOf(date)}`);
      const movedWeek=String(p.movedFromWeekStartV58930||'');if(cid&&validIso(movedWeek))moved.add(`${cid}:${movedWeek}`);
    });
    return {keys,weeks,moved};
  }
  function cloudBlocksOccurrenceV60511(index,clientId,weekStart){
    const pair=`${clientId}:${weekStart}`;
    return index.keys.has(pair)||index.weeks.has(pair)||index.moved.has(pair);
  }
  function scheduleCloudRowV60511(job){
    return {id:job.id,visit_date:job.date,client_id:job.clientId,team_id:job.teamId,status:job.status||'scheduled',estimated_hours:Number.isFinite(Number(job.estimatedHours))?Number(job.estimatedHours):0,sort_order:Number(job.sort||99),billing_profile_id:job.billingProfileId||job.billing_profile_id||null,payload:{...job}};
  }
  function recurrenceCollisionV60511(error){
    const text=[error?.message,error?.details,error?.hint,error?.code].map(v=>String(v||'')).join(' ');
    return /23505|schedule_jobs_recurrence_unique_v53|recurrenceKey/i.test(text)&&/duplicate|unique|23505/i.test(text);
  }
  function operationalDeltaRpcV60511(){
    const p=new URLSearchParams(location.search),support=p.get('support')==='1',session=support?String(p.get('session')||''):'';
    return {name:support&&session?'tuinbooks_management_save_operational_delta_v5968':'tuinbooks_save_operational_delta_v59394',session};
  }
  async function latestOperationalRevisionV60511(){
    const b=window.backendV28||{};
    if(String(b.mode||'').toLowerCase()!=='supabase'||!b.client||!b.businessId)return Number(b.operationalRevision||0);
    const {data,error}=await b.client.from('operational_meta').select('revision').eq('business_id',b.businessId).maybeSingle();
    if(error)throw error;
    const revision=Number(data?.revision??b.operationalRevision??0);
    b.operationalRevision=revision;
    return revision;
  }
  function operationsConflictV60511(error){
    const text=[error?.message,error?.details,error?.hint,error?.code].map(v=>String(v||'')).join(' ');
    return /OPERATIONS_CONFLICT|reload_required|newer operational data|expected .* current|40001/i.test(text);
  }
  async function pauseOperationalRealtimeV60511(){
    const b=window.backendV28||{};
    if(String(b.mode||'').toLowerCase()!=='supabase'||!b.client||!b.realtimeChannel)return false;
    try{await b.client.removeChannel(b.realtimeChannel);b.realtimeChannel=null;return true;}catch(_){return false;}
  }
  function resumeOperationalRealtimeV60511(paused){
    if(!paused)return;
    // Resubscribe once after the batch. This avoids a board repaint for every
    // individual schedule row inserted by the rolling batch.
    setTimeout(()=>{try{window.subscribeOperationalV41?.();}catch(error){console.warn('[TuinBooks v60.5.11] realtime resume',error);}},120);
  }

  async function saveRollingBatchOnceV60511(batch){
    const b=window.backendV28||{};
    if(!batch.length)return {saved:[],revision:Number(b.operationalRevision||0)};
    const expectedRevision=await latestOperationalRevisionV60511();
    const rpc=operationalDeltaRpcV60511();
    const payload={p_business_id:b.businessId,p_expected_revision:expectedRevision,p_schedules:batch.map(scheduleCloudRowV60511),p_work_records:[],p_opportunities:[],p_quotes:[],p_invoices:[],p_meta:null,p_deleted_schedule_ids:[],p_deleted_quote_ids:[],p_deleted_invoice_ids:[]};
    if(rpc.session)payload.p_session_id=rpc.session;
    const {data,error}=await b.client.rpc(rpc.name,payload);
    if(error)throw error;
    if(data?.conflict===true||data?.reload_required===true){
      const current=Number(data?.current_revision??data?.revision??expectedRevision);b.operationalRevision=current;
      throw Object.assign(new Error(`OPERATIONS_CONFLICT expected ${expectedRevision} current ${current}`),{code:'40001'});
    }
    return {saved:batch,revision:Number(data?.revision??expectedRevision+1)};
  }
  async function saveRollingChunkV60511(chunk,depth=0){
    if(!chunk.length)return {saved:[],failed:[],revision:Number((window.backendV28||{}).operationalRevision||0)};
    let current=[...chunk],lastError=null;
    for(let attempt=0;attempt<4;attempt++){
      try{
        const rows=await cloudScheduleRowsV60511(),index=cloudOccurrenceIndexV60511(rows);
        current=current.filter(job=>!cloudBlocksOccurrenceV60511(index,job.clientId,mondayOf(job.date)));
        if(!current.length)return {saved:[],failed:[],revision:Number((window.backendV28||{}).operationalRevision||0)};
        return {...await saveRollingBatchOnceV60511(current),failed:[]};
      }catch(error){
        lastError=error;
        if(operationsConflictV60511(error)){try{await latestOperationalRevisionV60511();}catch(_){};continue;}
        if(recurrenceCollisionV60511(error)){
          // A unique collision means at least one occurrence now exists in cloud.
          // Re-read, drop those rows, then split any unresolved batch so one stale
          // occurrence cannot block the rest of the rolling horizon.
          try{
            const rows=await cloudScheduleRowsV60511(),index=cloudOccurrenceIndexV60511(rows);
            current=current.filter(job=>!cloudBlocksOccurrenceV60511(index,job.clientId,mondayOf(job.date)));
          }catch(_){}
          if(!current.length)return {saved:[],failed:[],revision:Number((window.backendV28||{}).operationalRevision||0)};
          break;
        }
        break;
      }
    }
    if(current.length>1&&depth<8){
      const mid=Math.ceil(current.length/2);
      const a=await saveRollingChunkV60511(current.slice(0,mid),depth+1);
      const b=await saveRollingChunkV60511(current.slice(mid),depth+1);
      return {saved:[...a.saved,...b.saved],failed:[...a.failed,...b.failed],revision:Number(b.revision||a.revision||0)};
    }
    // Never poison the whole workspace for one occurrence. Keep it unsaved and
    // report it only in diagnostics; the next maintenance pass can try again.
    return {saved:[],failed:current.map(job=>({job,error:String(lastError?.message||lastError||'save failed')})),revision:Number((window.backendV28||{}).operationalRevision||0)};
  }
  async function saveRollingCandidatesV60511(candidates){
    const b=window.backendV28||{};
    if(!candidates.length)return {saved:[],failed:[],revision:Number(b.operationalRevision||0)};
    if(String(b.mode||'').toLowerCase()!=='supabase')return {saved:candidates,failed:[],revision:Number(b.operationalRevision||0)};
    const allSaved=[],allFailed=[];let revision=Number(b.operationalRevision||0);
    // Small chunks reduce Management revision conflicts and make a single hidden
    // recurrence unable to reject the whole rolling horizon.
    for(let i=0;i<candidates.length;i+=10){
      const result=await saveRollingChunkV60511(candidates.slice(i,i+10));
      allSaved.push(...result.saved);allFailed.push(...result.failed);revision=Number(result.revision||revision);
    }
    return {saved:allSaved,failed:allFailed,revision};
  }
  function adoptSavedCandidatesV60511(candidates,revision){
    if(!candidates.length)return;
    const st=stateNow(),existingIds=new Set((st.schedules||[]).map(j=>String(j.id)));
    candidates.forEach(job=>{if(!existingIds.has(String(job.id)))st.schedules.push(job);});
    const b=window.backendV28||{};b.operationalRevision=Number(revision||b.operationalRevision||0);
    try{if(typeof operationalSnapshotJsonV41==='function'&&typeof makeOperationalSnapshotV41==='function')b.lastOperationalJson=operationalSnapshotJsonV41(makeOperationalSnapshotV41());}catch(_){ }
    try{if(typeof clearOperationalSaveErrorV59394==='function')clearOperationalSaveErrorV59394();else{b.lastOperationalErrorV5604=null;b.operationalDirty=false;b.operationalConflict=false;window.renderOperationalSaveIssueV5604?.();}}catch(_){ }
  }
  function clearStaleRecurrenceErrorV60511(){
    const b=window.backendV28||{},e=b.lastOperationalErrorV5604||{};
    if(!recurrenceCollisionV60511(e))return;
    try{const delta=typeof operationalDeltaV59394==='function'?operationalDeltaV59394():null;if(delta&&!delta.hasChanges&&typeof clearOperationalSaveErrorV59394==='function')clearOperationalSaveErrorV59394();}catch(_){ }
  }

  let rollingBusy=false,rollingLastRun=0;
  async function maintainRollingScheduleV60511(reason='automatic'){
    if(rollingBusy)return {busy:true};
    if(!rollingWorkspaceReadyV60511())return {ready:false};
    rollingBusy=true;
    let realtimePaused=false;
    try{
      clearStaleRecurrenceErrorV60511();
      const now=today(),firstWeek=mondayOf(now),weeks=Array.from({length:8},(_,i)=>addDays(firstWeek,i*7));
      let cloudRows=await cloudScheduleRowsV60511(),cloudIndex=cloudOccurrenceIndexV60511(cloudRows);
      const candidates=[];let skippedNew=0,skippedNoPattern=0,skippedCloud=0;
      for(const client of (stateNow().clients||[]).filter(c=>String(c.status||'').toLowerCase()==='active')){
        const pattern=clientPattern(client);
        if(client.awaitingInitialRecurringPlacementV6036===true&&!(pattern.jobs||[]).length){skippedNew++;continue;}
        if(!pattern.enoughEvidence){skippedNoPattern++;continue;}
        for(const weekStart of weeks){
          const target=targetForWeek(pattern,weekStart);if(!target||target<now)continue;
          if(weekHasOccurrence(client.id,weekStart)||basketHasOccurrence(client.id,weekStart)||movedOccurrenceExistsV60511(client.id,weekStart))continue;
          if(cloudBlocksOccurrenceV60511(cloudIndex,client.id,weekStart)){skippedCloud++;continue;}
          const key=`${client.id}:${weekStart}`;
          if(candidates.some(j=>j.recurrenceKey===key))continue;
          candidates.push(makeRecurringJob(client,pattern,weekStart,target));
        }
      }
      if(!candidates.length){
        rollingLastRun=Date.now();
        window.__tuinbooksRollingV60511Last={reason,created:0,skippedNew,skippedNoPattern,skippedCloud,at:new Date().toISOString()};
        return window.__tuinbooksRollingV60511Last;
      }

      // A large rolling batch can otherwise fire one realtime repaint per row.
      // Pause this tab's operational channel, save the batch, adopt it once, then
      // resubscribe. Other tabs remain fully realtime.
      if(candidates.length>4)realtimePaused=await pauseOperationalRealtimeV60511();

      // Re-read once more immediately before writing, then save in conflict-safe
      // chunks. One stale/hidden occurrence can no longer reject every new week.
      cloudRows=await cloudScheduleRowsV60511();cloudIndex=cloudOccurrenceIndexV60511(cloudRows);
      const pending=candidates.filter(job=>!cloudBlocksOccurrenceV60511(cloudIndex,job.clientId,mondayOf(job.date)));
      const savedResult=await saveRollingCandidatesV60511(pending);
      adoptSavedCandidatesV60511(savedResult.saved,savedResult.revision);
      if(String(window.activeView||'')==='schedule'){try{window.renderSchedule?.();}catch(_){}}
      setTimeout(decorateScheduleCards,0);
      rollingLastRun=Date.now();
      window.__tuinbooksRollingV60511Last={reason,created:savedResult.saved.length,skippedNew,skippedNoPattern,skippedCloud,reconciled:candidates.length-savedResult.saved.length,failed:(savedResult.failed||[]).length,at:new Date().toISOString()};
      console.info('[TuinBooks v60.5.11] rolling schedule',window.__tuinbooksRollingV60511Last);
      if((savedResult.failed||[]).length&&reason!=='retry-after-partial'){
        setTimeout(()=>{if(rollingWorkspaceReadyV60511())maintainRollingScheduleV60511('retry-after-partial');},1800);
      }
      return window.__tuinbooksRollingV60511Last;
    }catch(error){
      console.warn('[TuinBooks v60.5.11] rolling maintenance deferred safely',error);
      window.__tuinbooksRollingV60511Last={reason,error:String(error?.message||error),created:0,at:new Date().toISOString()};
      // Background maintenance must never hijack the user's session with a red
      // toast. Manual recovery still reports the failure explicitly.
      return window.__tuinbooksRollingV60511Last;
    }finally{
      resumeOperationalRealtimeV60511(realtimePaused);
      rollingBusy=false;
    }
  }
  window.maintainRollingScheduleV60511=maintainRollingScheduleV60511;
  function scheduleRollingMaintenance(reason,delay=350){
    clearTimeout(window.__tuinbooksRollingV60511Timer);
    window.__tuinbooksRollingV60511Timer=setTimeout(()=>maintainRollingScheduleV60511(reason),delay);
  }
  function waitForRollingWorkspaceV60511(reason='startup'){
    clearInterval(window.__tuinbooksRollingReadyPollV60511);
    const started=Date.now();
    const attempt=()=>{
      if(rollingWorkspaceReadyV60511()){
        clearInterval(window.__tuinbooksRollingReadyPollV60511);window.__tuinbooksRollingReadyPollV60511=null;
        scheduleRollingMaintenance(reason,180);return true;
      }
      if(Date.now()-started>90000){clearInterval(window.__tuinbooksRollingReadyPollV60511);window.__tuinbooksRollingReadyPollV60511=null;}
      return false;
    };
    if(attempt())return;
    window.__tuinbooksRollingReadyPollV60511=setInterval(attempt,500);
  }

  /* -----------------------------------------------------------------------
     Readability / layout only. No schedule logic in these styles.
     ----------------------------------------------------------------------- */
  /* -----------------------------------------------------------------------
     ONE ad-hoc renderer only.
     The approved card is the v59.6.94 operational-item card (blue left edge
     for events). v6005 and v6010 are legacy duplicate renderers and stay
     hidden. The approved renderer is re-applied AFTER every board repaint.
     ----------------------------------------------------------------------- */
  let approvedActionObserverV60514 = null;
  let approvedActionObservedHostV60514 = null;
  let approvedActionPaintQueuedV60514 = false;
  let approvedActionPaintBusyV60514 = false;

  function hideDuplicateActionRenderersV60514(){
    try{
      document.querySelectorAll('#weeklyScheduleBoard .schedule-actions-v6005, #weeklyScheduleBoard .schedule-actions-v6010').forEach(node=>node.remove());
    }catch(_){ }
  }

  function paintApprovedActionsV60514(forceLoad=false){
    if(document.body?.dataset?.app==='mobile')return;
    if(approvedActionPaintBusyV60514)return;
    approvedActionPaintBusyV60514=true;
    try{
      hideDuplicateActionRenderersV60514();
      // stability-repair-v59694 owns the card the user approved. Its injector
      // is global in the classic script and safely replaces its own host.
      if(typeof window.injectScheduleItems94==='function')window.injectScheduleItems94();
      if(typeof window.loadActions94==='function'){
        Promise.resolve(window.loadActions94(!!forceLoad)).then(()=>{
          try{
            hideDuplicateActionRenderersV60514();
            if(typeof window.injectScheduleItems94==='function')window.injectScheduleItems94();
          }catch(_){ }
        }).catch(()=>{});
      }
    }finally{
      approvedActionPaintBusyV60514=false;
    }
  }

  function scheduleApprovedActionPaintV60514(forceLoad=false){
    if(approvedActionPaintQueuedV60514)return;
    approvedActionPaintQueuedV60514=true;
    requestAnimationFrame(()=>{
      approvedActionPaintQueuedV60514=false;
      // Disconnect while our own injector replaces its host so the observer
      // cannot trigger itself indefinitely.
      try{approvedActionObserverV60514?.disconnect();}catch(_){ }
      paintApprovedActionsV60514(forceLoad);
      observeApprovedActionHostV60514();
    });
  }

  function observeApprovedActionHostV60514(){
    if(document.body?.dataset?.app==='mobile')return;
    const host=document.getElementById('view-schedule')||document.getElementById('weeklyScheduleBoard');
    if(!host)return;
    if(!approvedActionObserverV60514){
      approvedActionObserverV60514=new MutationObserver(mutations=>{
        // Ignore mutations that only touch our approved v59694 host.
        const meaningful=mutations.some(m=>{
          const target=m.target?.nodeType===1?m.target:m.target?.parentElement;
          if(target?.closest?.('.schedule-operational-items-v59694'))return false;
          return true;
        });
        if(meaningful)scheduleApprovedActionPaintV60514(false);
      });
    }
    if(approvedActionObservedHostV60514!==host){
      try{approvedActionObserverV60514.disconnect();}catch(_){ }
      approvedActionObservedHostV60514=host;
    }
    try{approvedActionObserverV60514.observe(host,{childList:true,subtree:true});}catch(_){ }
  }

  function reconcileScheduleActionRenderersV60511(){
    paintApprovedActionsV60514(false);
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

      /* One ad-hoc renderer only: keep the approved blue-edge v59694 card. */
      #weeklyScheduleBoard .schedule-actions-v6005,
      #weeklyScheduleBoard .schedule-actions-v6010{display:none!important}
      #weeklyScheduleBoard .schedule-operational-items-v59694{display:grid!important}
      #weeklyScheduleBoard .schedule-operational-item-v59694.event{
        background:#f1f7fb!important;border-color:#b9cddd!important;border-left:4px solid #4c87ad!important;color:#294a61!important
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

      /* Ad-hoc/day-instruction card: use the whole lane width rather than a narrow middle column. */
      #weeklyScheduleBoard .schedule-operational-item-v59694{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        grid-template-areas:"badge time" "copy copy"!important;
        column-gap:8px!important;row-gap:6px!important;
        align-items:start!important;
        padding:9px 10px!important;
        min-height:68px!important;
        overflow:hidden!important;
      }
      #weeklyScheduleBoard .schedule-operational-item-v59694>span{
        grid-area:badge!important;justify-self:start!important;align-self:start!important;
        width:auto!important;max-width:100%!important;white-space:normal!important;
        font-size:.54rem!important;line-height:1.15!important;padding:3px 5px!important;
      }
      #weeklyScheduleBoard .schedule-operational-item-v59694>div{
        grid-area:copy!important;min-width:0!important;width:100%!important;
        display:block!important;padding:0!important;margin:0!important;
      }
      #weeklyScheduleBoard .schedule-operational-item-v59694 strong{
        display:block!important;width:100%!important;
        font-size:.71rem!important;line-height:1.22!important;
        white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
        margin:0!important;padding:0!important;
      }
      #weeklyScheduleBoard .schedule-operational-item-v59694 small{
        display:block!important;width:100%!important;
        font-size:.62rem!important;line-height:1.3!important;
        white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
        margin:4px 0 0!important;padding:0!important;
      }
      #weeklyScheduleBoard .schedule-operational-item-v59694 time{
        grid-area:time!important;justify-self:end!important;align-self:start!important;
        font-size:.58rem!important;line-height:1!important;white-space:nowrap!important;
        margin-top:3px!important;
      }

      @media(max-width:700px){
        .visit-controls-actions-v6054{width:100%}.visit-controls-actions-v6054 .button{flex:1 1 100%}
        .schedule-control-room.detail-open .schedule-detail-panel.job-workspace-v551{top:0!important;right:0!important;bottom:0!important;left:0!important;width:100vw!important;max-height:100vh!important;border-radius:0!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installSingleRollingAuthorityV60511(){
    const ensure=async options=>{
      const reason=typeof options==='string'?options:String(options?.reason||'canonical');
      if(!rollingWorkspaceReadyV60511())return {ready:false};
      return maintainRollingScheduleV60511(reason);
    };
    const refresh=(reason='automatic',delay=180)=>{
      clearTimeout(window.__tuinbooksSingleRollingTimerV60511);
      window.__tuinbooksSingleRollingTimerV60511=setTimeout(()=>{
        if(rollingWorkspaceReadyV60511())maintainRollingScheduleV60511(reason);
        else waitForRollingWorkspaceV60511(reason);
      },Math.max(0,Number(delay)||0));
      return true;
    };
    const generate=()=>ensure({reason:'manual-recovery',showFeedback:true});
    const canonical=window.__tuinbooksCanonicalRollingV6010;
    if(canonical){canonical.ensure=ensure;canonical.refresh=refresh;canonical.generate=generate;}
    // If v60.3.5 already restored the canonical functions, replace those too.
    window.ensureRollingScheduleV58929=ensure;
    window.scheduleRollingRefreshV58929=refresh;
    window.generateRecurringWeek=generate;
    window.__tuinbooksRollingAuthority='v60511-single-authority';
  }

  function install() {
    injectStyles();
    installScheduleDetailWrapper();
    installClientWorkConfirmationV60512();
    installVisitPanelTopResetV60512();
    installMobileWrapper();
    decorateScheduleCards();
    reconcileScheduleActionRenderersV60511();

    // ONE rolling authority only. The approved v60.3.5 Schedule module restores
    // window.__tuinbooksCanonicalRollingV6010 during hydration. Replace that
    // canonical implementation here BEFORE DOMContentLoaded so the Schedule module
    // cannot start the legacy writer in parallel with this reconciled writer.
    if (document.body?.dataset?.app !== 'mobile') {
      // Authority is installed at script evaluation time below, before the
      // v60.3.5 DOMContentLoaded boot can restore the legacy writer.
      waitForRollingWorkspaceV60511('workspace-hydrated');
      document.addEventListener('click',event=>{
        if (event.target?.closest?.('.nav-tab[data-view="schedule"], [data-view="schedule"]')) waitForRollingWorkspaceV60511('schedule-open');
      },true);
    }

    if(document.body?.dataset?.app!=='mobile'){
      observeApprovedActionHostV60514();
      scheduleApprovedActionPaintV60514(true);
    }
  }

  window.__tuinbooksSchedulePolishV60511Test={explicitCadence,inferCadence,clientPattern,targetForWeek,rollingWorkspaceReadyV60511,maintainRollingScheduleV60511,cloudOccurrenceIndexV60511,cloudBlocksOccurrenceV60511,installSingleRollingAuthorityV60511,explicitClientTasksV60511,reconcileScheduleActionRenderersV60511,paintApprovedActionsV60514,hideDuplicateActionRenderersV60514,clientWorkConfirmedV60512,confirmedServiceIdsV60512,confirmedTaskLinesV60512,replaceWorkRequiredV60512};

  // Install the single rolling authority NOW, while the document is still
  // loading. schedule-exact-canary-v6035.js registered its boot earlier, but
  // that boot has not run yet; it will therefore restore this authority rather
  // than starting a second writer.
  if(document.body?.dataset?.app!=='mobile')installSingleRollingAuthorityV60511();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
