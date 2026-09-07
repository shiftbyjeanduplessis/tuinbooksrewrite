/* ========================================================================== 
   TuinBooks v60.4.9 — small day-to-day features
   1) Office-side "Save as accepted" is wired inside Quick Quote in app.js.
   2) A routine visit can be cancelled from its i/detail panel without changing
      the client's recurring pattern or any future visit.
   Frozen Schedule visual/drag behaviour remains owned by v60.3.5.
   ========================================================================== */
(()=>{
  const BUILD='60.4.9-small-features';
  const EXCEPTION_KEY='singleVisitCancellationsV6049';

  function appState(){
    try{return state||null;}catch(_){return null;}
  }
  function backendState(){
    try{return backendV28||null;}catch(_){return null;}
  }
  function currentBusinessId(){
    return String(backendState()?.businessId||'');
  }
  function routineJob(job){
    if(!job)return false;
    try{if(typeof workMarkerForJobV5546==='function')return String(workMarkerForJobV5546(job)||'').toUpperCase()==='R';}catch(_){ }
    return String(job.workKind||'').toLowerCase()==='recurring'||/recurring/i.test(String(job.revenueType||''));
  }
  function occurrenceWeek(job){
    const explicit=String(job?.rollingWeekStartV58929||'').slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(explicit))return explicit;
    const keyDate=String(job?.recurrenceKey||job?.sourceOccurrenceKey||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1];
    if(keyDate)return keyDate;
    try{return typeof startOfWeek==='function'?startOfWeek(String(job?.date||localDateISO())):String(job?.date||'').slice(0,10);}catch(_){return String(job?.date||'').slice(0,10);}
  }
  function registry(){
    const st=appState();if(!st)return [];
    st[EXCEPTION_KEY]=Array.isArray(st[EXCEPTION_KEY])?st[EXCEPTION_KEY]:[];
    return st[EXCEPTION_KEY];
  }
  function exceptionId(row){return `${row.businessId||''}|${row.clientId||''}|${row.weekStart||''}|${row.jobId||''}`;}
  function registerException(job){
    const rows=registry(),row={
      businessId:currentBusinessId(),clientId:String(job.clientId||''),jobId:String(job.id||''),
      date:String(job.date||'').slice(0,10),weekStart:occurrenceWeek(job),createdAt:job.cancelledAtV6049||new Date().toISOString()
    };
    const id=exceptionId(row),index=rows.findIndex(item=>exceptionId(item)===id);
    if(index>=0)rows[index]=row;else rows.push(row);
    // Keep this tiny runtime ledger bounded while retaining more than a year of audit protection.
    const cutoff=Date.now()-1000*60*60*24*550;
    appState()[EXCEPTION_KEY]=rows.filter(item=>{
      const t=Date.parse(item.createdAt||item.date||'');return !Number.isFinite(t)||t>=cutoff;
    }).slice(-250);
    return row;
  }
  function capturePersistedExceptions(){
    const st=appState();if(!st||!Array.isArray(st.schedules))return;
    st.schedules.forEach(job=>{
      if(job?.singleVisitCancelledV6049===true||String(job?.cancelScopeV6049||'')==='single-visit')registerException(job);
    });
  }
  function hasException(client,weekStart){
    const businessId=currentBusinessId(),clientId=String(client?.id||''),week=String(weekStart||'').slice(0,10);
    return registry().some(row=>String(row.clientId||'')===clientId&&String(row.weekStart||'')===week&&(!businessId||!row.businessId||String(row.businessId)===businessId));
  }

  // Capture the special cancelled audit row before the existing manual/live
  // projection removes cancelled rows from the browser's operational array.
  try{
    if(typeof projectOperationalScheduleV59330==='function'&&!projectOperationalScheduleV59330.__v6049Wrapped){
      const baseProject=projectOperationalScheduleV59330;
      projectOperationalScheduleV59330=function projectOperationalScheduleV6049(){capturePersistedExceptions();return baseProject.apply(this,arguments);};
      projectOperationalScheduleV59330.__v6049Wrapped=true;
      window.projectOperationalScheduleV59330=projectOperationalScheduleV59330;
    }
  }catch(error){console.warn('[v60.4.9] schedule projection wrapper',error);}

  // The rolling engine still sees the client's normal recurrence, except for
  // the one due week represented by a deliberately cancelled booking.
  try{
    if(typeof recurringPlanForClientV5608==='function'&&!recurringPlanForClientV5608.__v6049Wrapped){
      const basePlan=recurringPlanForClientV5608;
      recurringPlanForClientV5608=function recurringPlanForClientV6049(client,weekStart,dates){
        const plan=basePlan.apply(this,arguments);
        if(plan&&!plan.notDue&&hasException(client,weekStart))return {...plan,skip:'single visit cancelled by office',singleVisitCancelledV6049:true};
        return plan;
      };
      recurringPlanForClientV5608.__v6049Wrapped=true;
      window.recurringPlanForClientV5608=recurringPlanForClientV5608;
    }
  }catch(error){console.warn('[v60.4.9] recurrence exception wrapper',error);}

  window.cancelSingleRoutineVisitV6049=async function cancelSingleRoutineVisitV6049(jobId){
    const st=appState(),job=st?.schedules?.find(row=>String(row.id)===String(jobId));
    if(!job)return window.toast?.('That booking could not be found. Refresh and try again.','error');
    if(!routineJob(job))return window.toast?.('This action is only for an individual routine booking.','error');
    const status=String(job.status||'scheduled').toLowerCase();
    if(['completed','cancelled','canceled','rescheduled','no-charge'].includes(status))return window.toast?.('This booking already has a final outcome.','error');
    let client={};try{client=typeof clientById==='function'?clientById(job.clientId)||{}:{};}catch(_){ }
    let dateLabel=String(job.date||'');try{if(typeof fmtDate==='function')dateLabel=fmtDate(job.date);}catch(_){ }
    const name=client.name||'this client';
    if(!window.confirm(`Cancel only this visit for ${name} on ${dateLabel}? Future routine visits will not be affected.`))return;

    const before=JSON.parse(JSON.stringify(job)),beforeRegistry=JSON.parse(JSON.stringify(registry()));
    try{
      const now=new Date().toISOString();
      job.status='cancelled';
      job.singleVisitCancelledV6049=true;
      job.cancelScopeV6049='single-visit';
      job.cancelledAtV6049=now;
      job.cancelledOccurrenceDateV6049=String(job.date||'').slice(0,10);
      job.cancelledOccurrenceWeekV6049=occurrenceWeek(job);
      job.manualOverride=true;
      job.autoAssigned=false;
      job.audit=[...(job.audit||[]),{at:now,actor:'Office',action:'Single routine visit cancelled',note:'This booking only. Future recurrence unchanged.'}];
      registerException(job);
      if(typeof save==='function')save();

      const backend=backendState();
      if(backend?.mode==='supabase'&&typeof syncOperationalDeltaV59394==='function'){
        const ok=await syncOperationalDeltaV59394(true);
        if(!ok)throw new Error('The cancellation could not be confirmed online.');
      }

      try{selectedScheduleDetailV23=null;}catch(_){ }
      try{document.getElementById('scheduleDetailPanel')?.classList.add('hidden');}catch(_){ }
      try{if(typeof renderSchedule==='function')renderSchedule();}catch(_){ }
      window.toast?.(`${name}: this booking was cancelled. Future routine visits are unchanged.`);
    }catch(error){
      Object.keys(job).forEach(key=>delete job[key]);Object.assign(job,before);
      const stateNow=appState();if(stateNow)stateNow[EXCEPTION_KEY]=beforeRegistry;
      try{if(typeof save==='function')save();if(typeof renderSchedule==='function')renderSchedule();}catch(_){ }
      window.toast?.(String(error?.message||error),'error');
    }
  };

  // Put the action exactly where users asked for it: inside the information
  // panel opened by the calendar's i button. No calendar renderer is replaced.
  try{
    if(typeof scheduleDetailJobV55==='function'&&!scheduleDetailJobV55.__v6049Wrapped){
      const baseDetail=scheduleDetailJobV55;
      scheduleDetailJobV55=function scheduleDetailJobV6049(job){
        let html=baseDetail.apply(this,arguments);
        const status=String(job?.status||'scheduled').toLowerCase();
        let today='';try{today=typeof localDateISO==='function'?localDateISO():new Date().toISOString().slice(0,10);}catch(_){today=new Date().toISOString().slice(0,10);}
        const cancellable=routineJob(job)&&String(job?.date||'')>=today&&!['completed','cancelled','canceled','rescheduled','no-charge'].includes(status);
        if(!cancellable||html.includes('cancelSingleRoutineVisitV6049'))return html;
        const button=`<button type="button" class="button danger secondary" onclick="cancelSingleRoutineVisitV6049('${String(job.id).replace(/'/g,"\\'")}')">Cancel this booking</button>`;
        if(html.includes('<div class="dialog-actions">'))html=html.replace('<div class="dialog-actions">',`<div class="dialog-actions">${button}`);
        else html+=`<div class="dialog-actions">${button}</div>`;
        return html;
      };
      scheduleDetailJobV55.__v6049Wrapped=true;
      window.scheduleDetailJobV55=scheduleDetailJobV55;
    }
  }catch(error){console.warn('[v60.4.9] schedule detail action',error);}

  function markBuild(){
    window.__tuinbooksSmallFeaturesV6049={build:BUILD,quickQuoteOfficeAccept:true,singleRoutineVisitCancel:true,frozenSchedule:'60.3.5'};
    window.__tuinbooksBuild=BUILD;
    const marker=document.querySelector('[id^="tuinbooksBuildV"]');
    if(marker){marker.id='tuinbooksBuildV6049';marker.textContent='v60.4.9';marker.title='Small features: office Save as accepted + cancel one routine booking · frozen Schedule remains v60.3.5';}
  }
  capturePersistedExceptions();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(markBuild,0),{once:true});else setTimeout(markBuild,0);
  window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>{capturePersistedExceptions();markBuild();},0));
  // Older client/release markers re-assert themselves for a few seconds.
  setTimeout(markBuild,1500);setTimeout(markBuild,4200);
})();
