(() => {
  'use strict';

  const BUILD = '60.5.5-explicit-cancel-readable-cards-pattern-rolling';
  if (window.__tuinbooksVisitControlsV6055 === BUILD) return;
  window.__tuinbooksVisitControlsV6055 = BUILD;

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
     Established-pattern rolling schedule.
     The v59.3.30 diary/manual guard in the legacy build suppresses the old
     rolling generator for imported tenants. This repair deliberately does
     NOT change that core guard. Instead it extends only patterns already
     proven by real schedule history.

     Rules:
     - current week + next 7 weeks;
     - no guessed hourly capacity and no overflow caused by hours;
     - existing, moved, completed, missed or cancelled occurrences are kept;
     - NEW R clients stay in the Basket until first manual placement;
     - Custom/legacy frequency may be inferred only from repeated real visits.
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
    const end=addDays(weekStart,6);
    return (stateNow().schedules||[]).some(job=>String(job.clientId)===String(clientId)&&routineEvidenceJob(job,clientForId(clientId))&&String(job.date||'')>=weekStart&&String(job.date||'')<=end);
  }
  function makeRecurringJob(client,pattern,weekStart,date){
    const t=pattern.template||{},now=new Date().toISOString();
    const newId=(()=>{try{if(typeof window.uid==='function')return window.uid('sch');}catch(_){}return `sch-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;})();
    const job={...t,id:newId,date,clientId:client.id,teamId:pattern.teamId,status:'scheduled',sort:Number(t.sort||99),revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',autoGenerated:true,autoAssigned:false,manualOverride:false,recurrenceKey:`${client.id}:${weekStart}`,sourceOccurrenceKey:`rolling:${client.id}:${weekStart}`,rollingWeekStartV58929:weekStart,rollingGeneratedV58929:true,createdAt:now,updatedAt:now};
    ['completedAt','completedByTeamId','cancelReason','cancelledAt','cancelledAtV6052','cancelledByV6052','cancellationBillingV6052','cancellationPreviousStatusV6052','cancellationPreviousChargeableV6052','resolution','resolvedAtV58931','catchUpStatus','movedFromWeekStartV58930'].forEach(k=>delete job[k]);
    return job;
  }

  let rollingBusy=false,rollingLastRun=0;
  async function maintainRollingScheduleV6055(reason='automatic'){
    if(rollingBusy)return {busy:true};
    const state=stateNow();if(!Array.isArray(state.clients)||!Array.isArray(state.schedules)||!state.clients.length)return {ready:false};
    try{const b=window.backendV28||{};if(b.managementOperationalLoadRequiredV59371&&!b.managementOperationalReadyV59371)return {ready:false};}catch(_){}
    rollingBusy=true;
    try{
      const now=today(),firstWeek=mondayOf(now),weeks=Array.from({length:8},(_,i)=>addDays(firstWeek,i*7));
      let created=0,skippedNew=0,skippedNoPattern=0;
      for(const client of state.clients.filter(c=>String(c.status||'').toLowerCase()==='active')){
        if(client.awaitingInitialRecurringPlacementV6036===true){skippedNew++;continue;}
        const pattern=clientPattern(client);if(!pattern.enoughEvidence){skippedNoPattern++;continue;}
        for(const weekStart of weeks){
          const target=targetForWeek(pattern,weekStart);if(!target||target<now)continue;
          if(weekHasOccurrence(client.id,weekStart)||basketHasOccurrence(client.id,weekStart))continue;
          state.schedules.push(makeRecurringJob(client,pattern,weekStart,target));created++;
        }
      }
      if(created){try{window.save?.();}catch(e){console.warn('[TuinBooks v60.5.6] save',e);}try{window.renderSchedule?.();}catch(_){}setTimeout(decorateScheduleCards,0);}
      rollingLastRun=Date.now();
      window.__tuinbooksRollingV6055Last={reason,created,skippedNew,skippedNoPattern,at:new Date().toISOString()};
      console.info('[TuinBooks v60.5.6] established rolling pattern',{reason,created,skippedNew,skippedNoPattern});
      return window.__tuinbooksRollingV6055Last;
    }catch(error){console.error('[TuinBooks v60.5.6] rolling schedule failed',error);return {error:String(error?.message||error)};}
    finally{rollingBusy=false;}
  }
  window.maintainRollingScheduleV6055=maintainRollingScheduleV6055;
  function scheduleRollingMaintenance(reason,delay=350){clearTimeout(window.__tuinbooksRollingV6055Timer);window.__tuinbooksRollingV6055Timer=setTimeout(()=>maintainRollingScheduleV6055(reason),delay);}

  /* -----------------------------------------------------------------------
     Readability / layout only. No schedule logic in these styles.
     ----------------------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('visitControlsStyleV6055')) return;
    const style = document.createElement('style');
    style.id = 'visitControlsStyleV6055';
    style.textContent = `
      .visit-controls-v6054{margin:0 0 14px;padding:14px 16px;border:1px solid #d9dedb;border-radius:14px;background:#fff;display:grid;gap:12px}
      .visit-controls-v6054 h3{margin:2px 0 3px}.visit-controls-v6054 p{margin:0;color:#68706c;font-size:13px}.visit-controls-actions-v6054{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.visit-control-status-v6054{font-weight:800;font-size:13px}
      .dns-alert-v6054{margin:0 0 12px;padding:12px 14px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dns-alert-v6054 strong{color:#8d2c24;letter-spacing:.04em}.dns-alert-v6054 span{flex:1;min-width:180px;color:#5b2925}
      .do-not-service-card-v6054{outline:2px solid #a63d32!important;outline-offset:-2px;position:relative}.dns-card-badge-v6054{position:absolute;right:5px;bottom:4px;background:#8d2c24;color:#fff;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;letter-spacing:.04em;line-height:1.2;z-index:3}
      .dns-mobile-v6054{margin:0 0 10px;padding:12px;border:2px solid #a63d32;border-radius:12px;background:#fff1ef;color:#5b2925;display:flex;flex-direction:column;gap:3px}.dns-mobile-v6054 strong{color:#8d2c24;font-size:16px;letter-spacing:.05em}

      /* Readable schedule cards: stack metadata instead of allowing text to collide. */
      .schedule-card-clean.v59384-card{height:auto!important;min-height:62px!important;padding:6px 6px 8px 5px!important;overflow:visible!important;align-items:start!important}
      .schedule-card-clean.v59384-card .schedule-card-copy{min-width:0!important;gap:3px!important}
      .schedule-card-clean.v59384-card strong{white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;line-height:1.16!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;max-height:2.35em!important}
      .schedule-card-clean.v59384-card .schedule-card-meta{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:3px!important;align-items:start!important;min-width:0!important}
      .schedule-card-clean.v59384-card .schedule-card-suburb{white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;line-height:1.18!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;max-height:2.4em!important;min-width:0!important}
      .schedule-card-clean.v59384-card .v59384-card-meta-right{justify-self:start!important;justify-content:flex-start!important;align-items:center!important;gap:4px!important;white-space:nowrap!important}
      .schedule-card-clean.v59384-card .schedule-card-info-v58931{align-self:start!important;margin-top:0!important}
      .schedule-card-clean.v59384-card .schedule-card-duration,.schedule-card-clean.v59384-card .v59384-card-time{line-height:1.05!important}

      @media(max-width:700px){.visit-controls-actions-v6054{width:100%}.visit-controls-actions-v6054 .button{flex:1 1 100%}}
    `;
    document.head.appendChild(style);
  }

  /* -----------------------------------------------------------------------
     v60.5.6 — universal close safety.
     Prevent any full-screen/detail workspace from trapping the user.
     ----------------------------------------------------------------------- */
  function injectOverlayCloseStylesV6056(){
    if(document.getElementById('overlayCloseStylesV6056'))return;
    const style=document.createElement('style');style.id='overlayCloseStylesV6056';
    style.textContent=`
      #scheduleDetailPanel{position:relative}
      #scheduleDetailPanel .universal-overlay-close-v6056{
        position:absolute!important;top:10px!important;right:10px!important;z-index:2147482000!important;
        width:38px!important;height:38px!important;min-width:38px!important;border:1px solid #cfded6!important;
        border-radius:11px!important;background:#fff!important;color:#174b37!important;box-shadow:0 4px 14px rgba(20,55,42,.16)!important;
        display:grid!important;place-items:center!important;font:800 24px/1 system-ui,sans-serif!important;cursor:pointer!important
      }
      #scheduleDetailPanel .universal-overlay-close-v6056:hover{background:#f0f7f3!important}
      #scheduleDetailPanel .schedule-detail-head{padding-right:58px!important}
      dialog[open] .dialog-heading .icon-button{position:relative;z-index:5}
    `;document.head.appendChild(style);
  }
  function schedulePanelOpenV6056(){
    const panel=document.getElementById('scheduleDetailPanel');
    return panel&&!panel.classList.contains('hidden')&&getComputedStyle(panel).display!=='none'?panel:null;
  }
  function closeSchedulePanelV6056(){
    try{if(typeof window.closeScheduleDetailV23==='function'){window.closeScheduleDetailV23();return true;}}catch(_){}
    const panel=document.getElementById('scheduleDetailPanel');if(panel){panel.classList.add('hidden');document.body.classList.remove('schedule-zoom-open');document.querySelector('.schedule-control-room')?.classList.remove('detail-open');return true;}return false;
  }
  function ensureScheduleCloseV6056(){
    const panel=schedulePanelOpenV6056();if(!panel)return;
    let button=panel.querySelector('.universal-overlay-close-v6056');
    if(!button){button=document.createElement('button');button.type='button';button.className='universal-overlay-close-v6056';button.setAttribute('aria-label','Close');button.title='Close';button.textContent='×';button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeSchedulePanelV6056();});panel.appendChild(button);}
  }
  function bindDialogSafetyV6056(){
    document.querySelectorAll('dialog').forEach(dialog=>{
      if(dialog.dataset.closeSafetyV6056==='1')return;dialog.dataset.closeSafetyV6056='1';
      dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    });
  }
  function closeTopOverlayV6056(){
    const dialogs=[...document.querySelectorAll('dialog[open]')];if(dialogs.length){dialogs[dialogs.length-1].close();return true;}
    if(schedulePanelOpenV6056())return closeSchedulePanelV6056();
    if(document.body.classList.contains('client-record-modal-open-v6042')){document.getElementById('clearClientFormBtn')?.click();return true;}
    if(document.body.classList.contains('record-history-open-v58930')){try{window.closeRecordHistoryV58930?.();return true;}catch(_){} }
    return false;
  }
  function installOverlaySafetyV6056(){
    injectOverlayCloseStylesV6056();bindDialogSafetyV6056();ensureScheduleCloseV6056();
    if(document.documentElement.dataset.overlaySafetyV6056==='1')return;document.documentElement.dataset.overlaySafetyV6056='1';
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&closeTopOverlayV6056()){event.preventDefault();event.stopPropagation();}},true);
    document.addEventListener('pointerdown',event=>{
      const panel=schedulePanelOpenV6056();if(!panel||panel.contains(event.target))return;
      if(!document.body.classList.contains('schedule-zoom-open'))return;
      event.preventDefault();event.stopPropagation();closeSchedulePanelV6056();
    },true);
  }

  function install() {
    injectStyles();
    installOverlaySafetyV6056();
    installScheduleDetailWrapper();
    installMobileWrapper();
    decorateScheduleCards();

    // Rolling maintenance is an office/desktop responsibility only.
    if (document.body?.dataset?.app !== 'mobile') {
      scheduleRollingMaintenance('startup',900);
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
    }

    const observer = new MutationObserver(() => {
      installScheduleDetailWrapper();
      installMobileWrapper();
      decorateScheduleCards();
      bindDialogSafetyV6056();
      ensureScheduleCloseV6056();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.__tuinbooksSchedulePolishV6056Test={explicitCadence,inferCadence,clientPattern,targetForWeek,maintainRollingScheduleV6055};

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
