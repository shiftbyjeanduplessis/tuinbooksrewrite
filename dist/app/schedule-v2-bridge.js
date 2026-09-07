/* TuinBooks Schedule V2 bridge v60.8.0
   Final parent-page authority for Schedule only.
   The Schedule UI runs in a same-origin iframe; legacy Schedule patch scripts are not loaded.
   Work, Billing and Management code paths are untouched. */
(()=>{
  'use strict';
  const VERSION='60.8.0-consolidated';
  const HOST_ID='tbScheduleV2Host';
  const IFRAME_ID='tbScheduleV2Frame';

  // app.js intentionally runs inside an IIFE. Its `state` and `backendV28` are
  // not window properties. Reuse the existing narrow runtime bridge instead of
  // reaching for window.state/window.backendV28.
  const appRuntime=()=>window.__tuinbooksOnboardingRuntimeV60423||null;
  const appState=()=>{try{return appRuntime()?.getState?.()||null;}catch(_){return null;}};
  const appBackend=()=>{try{return appRuntime()?.getBackend?.()||null;}catch(_){return null;}};
  const appUid=(prefix='id')=>{try{return appRuntime()?.uid?.(prefix)||`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}catch(_){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}};

  const clone=value=>{
    try{return structuredClone(value);}catch(_){return JSON.parse(JSON.stringify(value??null));}
  };
  const today=()=>typeof window.localDateISO==='function'?window.localDateISO():new Date().toISOString().slice(0,10);
  const monday=iso=>typeof window.startOfWeek==='function'?window.startOfWeek(iso):(()=>{const d=new Date(`${iso}T12:00:00`),n=(d.getDay()+6)%7;d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);})();
  const plus=(iso,n)=>typeof window.dateAdd==='function'?window.dateAdd(iso,n):(()=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);})();
  const datesForWeek=week=>typeof window.weekDates==='function'?window.weekDates(week):Array.from({length:6},(_,i)=>plus(week,i));
  const dayName=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString('en-ZA',{weekday:'long'});
  const markerFor=job=>{
    const explicit=String(job?.workMarker||'').toUpperCase();
    if(explicit==='R'||explicit==='O')return explicit;
    return job?.workKind==='recurring'||/recurring/i.test(String(job?.revenueType||''))?'R':'O';
  };
  const terminal=status=>['completed','cancelled','canceled','deferred','rescheduled','no-charge','access-failed','archived','deleted'].includes(String(status||'').toLowerCase());
  const clientById=id=>(appState()?.clients||[]).find(c=>String(c.id)===String(id))||{};
  const teamById=id=>(appState()?.teams||[]).find(t=>String(t.id)===String(id))||{};
  const routeArea=client=>String(client?.suburb||client?.routeArea||client?.serviceArea||client?.siteGroupName||client?.address||'').trim();
  const now=()=>new Date().toISOString();
  const hoursLabel=value=>`${Math.max(.25,Number(value||1)).toFixed(1)}h`;

  function scheduleBackup(){
    const st=appState();return clone({
      schedules:st?.schedules||[],scheduleBasket:st?.scheduleBasket||[],scheduleOverflowQueue:st?.scheduleOverflowQueue||[],
      serviceCommitments:st?.serviceCommitments||[],catchUps:st?.catchUps||[],quotes:st?.quotes||[],clients:st?.clients||[],serviceAgreements:st?.serviceAgreements||[]
    });
  }
  function restoreScheduleBackup(backup){
    const st=appState();if(!st||!backup)return;
    for(const key of Object.keys(backup))st[key]=backup[key];
    try{appRuntime()?.saveBusinessWorkbookLocalV6054?.();}catch(_){ }
  }
  async function persistSchedule(){
    const runtime=appRuntime();if(!runtime)throw new Error('TuinBooks workspace is not ready.');
    if(typeof runtime.saveBusinessWorkbookLocalV6054==='function')runtime.saveBusinessWorkbookLocalV6054();
    else window.save?.();
    const backend=appBackend();
    if(backend?.mode==='supabase'&&backend?.client&&backend?.businessId){
      if(typeof runtime.syncBusinessWorkbookOperationalV6054!=='function')throw new Error('The live Schedule save connection is unavailable.');
      const saved=await runtime.syncBusinessWorkbookOperationalV6054();
      if(!saved)throw new Error('The Schedule change did not save online. The previous schedule has been restored.');
    }
    return true;
  }
  function quoteDescription(quote){return (quote?.lineItems||[]).map(line=>String(line.description||'').trim()).filter(Boolean).slice(0,2).join(' · ')||'Accepted quoted work';}
  function quoteScheduled(quote){return Boolean(quote?.scheduled||(appState()?.schedules||[]).some(job=>String(job.quoteId||'')===String(quote?.id||'')&&!terminal(job.status)));}
  function basketCard({queueKey,client,label,reason,marker,group,hours}){
    return {queueKey,name:client?.name||client?.address||'Work item',label,meta:[routeArea(client),hoursLabel(hours),reason].filter(Boolean).join(' · '),marker,group};
  }

  function basketRowsDirect(){
    const st=appState();if(!st)return [];
    st.scheduleBasket=Array.isArray(st.scheduleBasket)?st.scheduleBasket:[];
    st.scheduleOverflowQueue=Array.isArray(st.scheduleOverflowQueue)?st.scheduleOverflowQueue:[];
    const rows=[],representedJobs=new Set(),representedQuotes=new Set();
    for(const item of st.scheduleBasket){
      const client=clientById(item.clientId),marker=markerFor(item.jobPayload||item);representedJobs.add(String(item.sourceJobId||''));representedQuotes.add(String(item.quoteId||item.jobPayload?.quoteId||''));
      rows.push(basketCard({queueKey:`manual-basket:${item.id}`,client,label:item.newRecurringV6036===true?'NEW R':'Removed from calendar',reason:item.reason||'',marker,group:marker==='O'?'Once-off work':'Recurring work',hours:item.estimatedHours||item.jobPayload?.estimatedHours}));
    }
    for(const job of st.schedules||[]){
      if(job.date&&String(job.status||'').toLowerCase()!=='unscheduled')continue;
      if(representedJobs.has(String(job.id)))continue;
      const client=clientById(job.clientId),marker=markerFor(job);
      rows.push(basketCard({queueKey:`stored-unscheduled:${job.id}`,client,label:'Unscheduled work',reason:job.notes||'',marker,group:marker==='O'?'Once-off work':'Recurring work',hours:job.estimatedHours}));
    }
    for(const item of st.scheduleOverflowQueue){
      const client=clientById(item.clientId),marker=markerFor(item);
      rows.push(basketCard({queueKey:`could-not-fit:${item.id}`,client,label:'Could not fit',reason:item.reason||'',marker,group:'Could not fit',hours:item.estimatedHours}));
    }
    for(const quote of st.quotes||[]){
      if(!['approved','accepted'].includes(String(quote.status||'').toLowerCase())||quoteScheduled(quote)||representedQuotes.has(String(quote.id)))continue;
      const client=clientById(quote.clientId);
      rows.push(basketCard({queueKey:`accepted-quote:${quote.id}`,client,label:'Accepted quote',reason:quoteDescription(quote),marker:'O',group:'Once-off work',hours:quote.estimatedHours||quote.durationHours||client.estimatedHours}));
    }
    for(const item of st.catchUps||[]){
      if(!['waiting','unscheduled'].includes(String(item.status||'').toLowerCase()))continue;
      const source=(st.schedules||[]).find(job=>String(job.id)===String(item.sourceJobId||item.scheduleJobId||''));
      const client=clientById(item.clientId||source?.clientId);
      rows.push(basketCard({queueKey:`catchup-waiting:${item.id}`,client,label:'Catch-up ready',reason:item.reason||'Missed work waiting for a new date.',marker:markerFor(source||item),group:'Catch-up',hours:item.estimatedHours||source?.estimatedHours||client.estimatedHours}));
    }
    const seen=new Set();return rows.filter(row=>row.queueKey&&!seen.has(row.queueKey)&&(seen.add(row.queueKey),true));
  }

  function basketEntry(queueKey){
    const st=appState(),key=String(queueKey||'');if(!st)return null;
    if(key.startsWith('manual-basket:'))return {kind:'manual',item:(st.scheduleBasket||[]).find(row=>String(row.id)===key.slice(14))};
    if(key.startsWith('stored-unscheduled:'))return {kind:'stored',job:(st.schedules||[]).find(row=>String(row.id)===key.slice(19))};
    if(key.startsWith('could-not-fit:'))return {kind:'overflow',item:(st.scheduleOverflowQueue||[]).find(row=>String(row.id)===key.slice(14))};
    if(key.startsWith('accepted-quote:'))return {kind:'quote',quote:(st.quotes||[]).find(row=>String(row.id)===key.slice(15))};
    if(key.startsWith('catchup-waiting:'))return {kind:'catchup',item:(st.catchUps||[]).find(row=>String(row.id)===key.slice(16))};
    return null;
  }

  function installHost(){
    const view=document.getElementById('view-schedule');
    if(!view)return false;
    if(document.getElementById(HOST_ID))return true;
    view.innerHTML=`<div id="${HOST_ID}" style="position:relative;width:100%;height:calc(100vh - 178px);min-height:620px;overflow:hidden;background:#f5f8f6">
      <div id="tbScheduleV2Compat" style="display:none!important" aria-hidden="true">
        <input id="scheduleWeekPicker" type="date"><div id="rollingScheduleOverview"></div><div id="weeklyScheduleBoard"></div>
        <div id="schedulePrioritySummaryV5535"></div><div id="weekReviewPanel"></div><div id="scheduleDetailPanel"></div>
        <button id="scheduleBasketLauncherV58931" type="button"></button><div id="scheduleParkingLotV5537"></div>
      </div>
      <iframe id="${IFRAME_ID}" title="TuinBooks Schedule V2" src="schedule-v2/index.html?v=${VERSION}" style="border:0;width:100%;height:100%;display:block;background:#f5f8f6"></iframe>
    </div>`;
    view.style.padding='0';
    view.style.margin='0';
    document.documentElement.dataset.scheduleRenderer='schedule-v2-consolidated';
    return true;
  }

  function postRefresh(){
    const frame=document.getElementById(IFRAME_ID);
    try{frame?.contentWindow?.postMessage({type:'tuinbooks-schedule-v2-refresh'},location.origin);}catch(_){ }
  }

  function renderScheduleV2Host(){
    installHost();
    postRefresh();
    return true;
  }

  async function loadActions(weekStart){
    const b=appBackend();
    if(b?.mode!=='supabase'||!b.client||!b.businessId)return [];
    const dates=datesForWeek(weekStart),from=dates[0],to=dates.at(-1);
    try{
      const {data,error}=await b.client.from('operational_actions_v59674').select('*').eq('business_id',b.businessId).gte('calendar_date',from).lte('calendar_date',to).order('calendar_date',{ascending:true});
      if(error)throw error;
      return (data||[]).filter(row=>String(row.assigned_type||row.assignedType||'team')==='team'&&String(row.status||'').toLowerCase()!=='cancelled').map(row=>({
        id:row.id,title:row.title||'',detail:row.detail||'',teamId:row.assigned_id||row.assignedId||'',date:row.calendar_date||row.calendarDate||'',time:row.calendar_time||row.calendarTime||'',kind:row.payload?.kindV6005||row.payload?.kindV59694||(/instruction|team note/i.test(String(row.title||''))?'team_note':'internal_event')
      }));
    }catch(error){console.warn('[Schedule V2] action load',error);return [];}
  }

  function weekSummaries(){
    const current=monday(today()),jobs=appState()?.schedules||[],out=[];
    for(let i=0;i<8;i++){
      const start=plus(current,i*7),dates=new Set(datesForWeek(start));
      const rows=jobs.filter(j=>dates.has(String(j.date||'').slice(0,10))&&String(j.status||'').toLowerCase()!=='cancelled');
      out.push({weekStart:start,count:rows.length,hours:rows.reduce((s,j)=>s+Number(j.estimatedHours||0),0)});
    }
    return out;
  }

  async function getSnapshot(weekStart){
    const st=appState();
    if(!st)return {ready:false,version:VERSION,error:'TuinBooks workspace is still loading.'};
    const start=monday(weekStart||today()),dates=datesForWeek(start),dateSet=new Set(dates);
    const clients=(st.clients||[]).map(c=>({id:c.id,name:c.name||c.address||'Unknown client',address:c.address||'',suburb:routeArea(c),frequency:c.frequency||'',serviceIds:[...(c.serviceIds||[])],preferredDay:c.preferredDay||'',preferredTeamId:c.preferredTeamId||c.teamId||''}));
    const jobs=(st.schedules||[]).filter(j=>dateSet.has(String(j.date||'').slice(0,10))&&String(j.status||'').toLowerCase()!=='cancelled').map(j=>({
      id:j.id,date:String(j.date||'').slice(0,10),clientId:j.clientId,teamId:j.teamId,status:j.status||'scheduled',estimatedHours:Number(j.estimatedHours||0),sort:Number(j.sort||99),workMarker:markerFor(j),workKind:j.workKind||'',revenueType:j.revenueType||'',manualOverride:j.manualOverride===true,autoGenerated:j.autoGenerated===true,routeArea:j.routeArea||''
    }));
    const actions=await loadActions(start);
    return {ready:true,version:VERSION,businessName:st.business?.name||document.getElementById('businessNameHeader')?.textContent||'TuinBooks',today:today(),weekStart:start,dates,teams:(st.teams||[]).filter(t=>t.active!==false).map(t=>({id:t.id,name:t.name||'Team',leaderName:t.leaderName||t.leader_name||'',colour:t.colour||t.color||t.visualColor||'#2d6a4f'})),clients,jobs,basket:basketRowsDirect(),actions,weeks:weekSummaries()};
  }

  function normalizeLane(teamId,date){
    (appState()?.schedules||[]).filter(j=>String(j.teamId)===String(teamId)&&String(j.date)===String(date)&&String(j.status||'').toLowerCase()!=='cancelled').sort((a,b)=>Number(a.sort||99)-Number(b.sort||99)).forEach((j,i)=>{j.sort=(i+1)*10;});
  }
  function insertAt(teamId,date,job,index){
    const rows=(appState()?.schedules||[]).filter(j=>j.id!==job.id&&String(j.teamId)===String(teamId)&&String(j.date)===String(date)&&String(j.status||'').toLowerCase()!=='cancelled').sort((a,b)=>Number(a.sort||99)-Number(b.sort||99));
    rows.splice(Math.max(0,Math.min(Number(index)||0,rows.length)),0,job);
    rows.forEach((j,i)=>{j.sort=(i+1)*10;});
  }

  function applyFuturePattern(job){
    const st=appState(),client=clientById(job.clientId),team=teamById(job.teamId);if(!st||!client||!team)return 0;
    const day=dayName(job.date),anchor=String(job.date||''),dayIndex=Math.max(0,datesForWeek(monday(anchor)).indexOf(anchor));
    client.preferredDay=day;client.teamId=team.id;client.preferredTeamId=team.id;client.recurrenceAnchorDate=anchor;
    (st.serviceAgreements||[]).filter(a=>String(a.clientId)===String(client.id)&&String(a.status||'').toLowerCase()==='active').forEach(a=>{a.preferredDays=[day];a.defaultTeamId=team.id;(a.lines||[]).filter(l=>l.active!==false).forEach(l=>{l.anchorDate=anchor;});a.updatedAt=new Date().toISOString();});
    let updated=0;const touched=new Set();
    (st.schedules||[]).forEach(f=>{
      if(f.id===job.id||String(f.clientId)!==String(job.clientId)||markerFor(f)!=='R'||String(f.date||'')<=anchor)return;
      if(terminal(f.status)||f.manualOverride===true||f.autoGenerated!==true)return;
      const week=monday(f.date),target=datesForWeek(week)[dayIndex]||f.date;
      touched.add(`${f.teamId}|${f.date}`);f.date=target;f.teamId=team.id;f.autoAssigned=true;f.updatedAt=new Date().toISOString();f.audit=[...(f.audit||[]),{at:new Date().toISOString(),actor:'Office',action:'Recurring pattern updated',note:`${day} · ${team.name}`}];touched.add(`${f.teamId}|${f.date}`);updated++;
    });
    touched.forEach(k=>{const [tid,d]=k.split('|');normalizeLane(tid,d);});
    return updated;
  }

  async function moveJob({jobId,teamId,date,index=999,scope='once'}){
    const st=appState(),job=(st?.schedules||[]).find(j=>String(j.id)===String(jobId)),team=teamById(teamId);if(!st||!job||!team)return {ok:false,error:'Visit not found.'};
    if(String(date)<today())return {ok:false,error:'Past dates are locked.'};
    if(['completed','cancelled','canceled'].includes(String(job.status||'').toLowerCase()))return {ok:false,error:'Completed or cancelled visits cannot be moved.'};
    const backup=scheduleBackup();
    const oldTeam=job.teamId,oldDate=job.date;
    try{
      job.teamId=teamId;job.date=date;job.status='scheduled';job.manualOverride=true;job.autoGenerated=false;job.autoAssigned=false;job.updatedAt=new Date().toISOString();
      window.addJobAuditV14?.(job,'Schedule moved in Schedule V2',`${oldDate} → ${date} · ${team.name}`);
      normalizeLane(oldTeam,oldDate);insertAt(teamId,date,job,index);
      let futureUpdated=0;if(scope==='future'&&markerFor(job)==='R')futureUpdated=applyFuturePattern(job);
      await persistSchedule();window.toast?.(`${clientById(job.clientId).name||'Visit'} moved.`);
      postRefresh();return {ok:true,futureUpdated};
    }catch(error){restoreScheduleBackup(backup);console.error('[Schedule V2] move rollback',error);return {ok:false,error:String(error?.message||error)};}
  }

  async function moveJobToBasket(jobId){
    const st=appState(),job=(st?.schedules||[]).find(row=>String(row.id)===String(jobId));
    if(!st||!job)return {ok:false,error:'Visit not found.'};
    if(terminal(job.status))return {ok:false,error:'Completed or resolved visits remain in history and cannot be moved.'};
    const backup=scheduleBackup(),client=clientById(job.clientId),stamp=now();
    try{
      st.scheduleBasket=Array.isArray(st.scheduleBasket)?st.scheduleBasket:[];
      const missed=String(job.date||'')<today();
      const source=clone(job);
      if(missed){source.id=appUid('sch');source.status='unscheduled';source.sourceMissedJobIdV2=job.id;job.status='rescheduled';job.resolution='Rescheduled';job.resolvedAtV2=stamp;job.audit=[...(job.audit||[]),{at:stamp,actor:'Office',action:'Missed visit moved to Schedule V2 basket',note:job.date||''}];}
      const existing=st.scheduleBasket.find(item=>String(item.sourceJobId)===String(source.id));
      const item={id:existing?.id||appUid('basket'),sourceJobId:source.id,clientId:source.clientId,originalDate:existing?.originalDate||job.date||'',originalTeamId:existing?.originalTeamId||job.teamId||'',weekStart:existing?.weekStart||monday(job.date||today()),estimatedHours:Math.max(.25,Number(job.estimatedHours||client.estimatedHours||1)),serviceIds:[...(job.serviceIds||[])],workTypeIds:[...(job.workTypeIds||client.workTypeIds||[])],clusterId:job.clusterId||client.clusterId||'',quoteId:job.quoteId||'',workKind:job.workKind||'',revenueType:job.revenueType||'',workMarker:markerFor(job),reason:missed?'Missed visit waiting to be rescheduled':'Removed from the calendar by the office',jobPayload:source,createdAt:existing?.createdAt||stamp,updatedAt:stamp};
      if(existing)Object.assign(existing,item);else st.scheduleBasket.push(item);
      if(!missed)st.schedules=st.schedules.filter(row=>String(row.id)!==String(job.id));
      (st.serviceCommitments||[]).filter(row=>String(row.scheduleJobId)===String(job.id)).forEach(row=>{row.scheduleJobId='';row.status='Unscheduled';row.updatedAt=stamp;});
      if(job.quoteId){const quote=(st.quotes||[]).find(row=>String(row.id)===String(job.quoteId));if(quote){quote.scheduled=false;delete quote.scheduledDate;delete quote.scheduledTeamId;delete quote.scheduledJobId;}}
      await persistSchedule();window.toast?.(`${client.name||'Visit'} moved to the Schedule basket.`);postRefresh();return {ok:true};
    }catch(error){restoreScheduleBackup(backup);console.error('[Schedule V2] basket rollback',error);return {ok:false,error:String(error?.message||error)};}
  }

  async function placeBasket({queueKey,teamId,date,index=999}){
    if(String(date)<today())return {ok:false,error:'Past dates are locked.'};
    const st=appState(),team=teamById(teamId),entry=basketEntry(queueKey);if(!st||!team)return {ok:false,error:'The destination team could not be found.'};if(!entry)return {ok:false,error:'The basket item could not be found. Refresh and try again.'};
    const backup=scheduleBackup(),stamp=now();
    try{
      let job=null,client=null;
      if(entry.kind==='manual'){
        const item=entry.item;if(!item)throw new Error('Basket item not found.');client=clientById(item.clientId);const source=clone(item.jobPayload||{});
        job={...source,id:item.sourceJobId||source.id||appUid('sch'),date,teamId,status:'scheduled',sort:99,manualOverride:true,autoGenerated:false,autoAssigned:false,estimatedHours:Math.max(.25,Number(item.estimatedHours||source.estimatedHours||client.estimatedHours||1)),serviceIds:[...(item.serviceIds||source.serviceIds||[])],workTypeIds:[...(item.workTypeIds||source.workTypeIds||[])],audit:[...(source.audit||[]),{at:stamp,actor:'Office',action:'Placed from Schedule V2 basket',note:`${date} · ${team.name}`} ]};
        delete job.completedAt;delete job.completedByTeamId;delete job.catchUpStatus;delete job.resolution;delete job.resolvedAtV2;
        st.schedules=(st.schedules||[]).filter(row=>String(row.id)!==String(job.id));st.schedules.push(job);st.scheduleBasket=(st.scheduleBasket||[]).filter(row=>String(row.id)!==String(item.id));
        if(item.newRecurringV6036===true){client.awaitingInitialRecurringPlacementV6036=false;client.preferredDay=dayName(date);client.teamId=teamId;client.preferredTeamId=teamId;client.recurrenceAnchorDate=date;client.serviceStartDate=date;job.initialRecurringPlacementV6036=true;job.workKind='recurring';job.revenueType='Recurring contract';job.workMarker='R';}
      }else if(entry.kind==='stored'){
        job=entry.job;if(!job)throw new Error('Unscheduled job not found.');client=clientById(job.clientId);Object.assign(job,{date,teamId,status:'scheduled',manualOverride:true,autoGenerated:false,autoAssigned:false,updatedAt:stamp});
      }else if(entry.kind==='overflow'){
        const item=entry.item;if(!item)throw new Error('Overflow item not found.');client=clientById(item.clientId);job={id:appUid('sch'),date,clientId:client.id,teamId,clusterId:item.clusterId||client.clusterId||'',status:'scheduled',estimatedHours:Math.max(.25,Number(item.estimatedHours||client.estimatedHours||1)),sort:99,revenueType:item.revenueType||'Recurring contract',workKind:item.workKind||(item.quoteId?'once-off':'recurring'),workMarker:markerFor(item),quoteId:item.quoteId||'',serviceIds:[...(item.serviceIds||[])],workTypeIds:[...(item.workTypeIds||client.workTypeIds||[])],autoGenerated:false,autoAssigned:false,manualOverride:true,createdAt:stamp};st.schedules.push(job);st.scheduleOverflowQueue=(st.scheduleOverflowQueue||[]).filter(row=>String(row.id)!==String(item.id));
      }else if(entry.kind==='quote'){
        const quote=entry.quote;if(!quote)throw new Error('Accepted quote not found.');client=clientById(quote.clientId);job={id:appUid('sch'),date,clientId:client.id,teamId,clusterId:client.clusterId||'',status:'scheduled',estimatedHours:Math.max(.25,Number(quote.estimatedHours||quote.durationHours||client.estimatedHours||1)),sort:99,quoteId:quote.id,revenueType:'Quoted work',workKind:'once-off',workMarker:'O',serviceIds:[],workTypeIds:[...(client.workTypeIds||[])],manualOverride:true,autoGenerated:false,createdAt:stamp,description:quoteDescription(quote),audit:[{at:stamp,actor:'Office',action:'Accepted quote scheduled in Schedule V2',note:date}]};st.schedules.push(job);quote.scheduled=true;quote.scheduledAt=stamp;quote.scheduledDate=date;quote.scheduledTeamId=teamId;quote.scheduledJobId=job.id;
      }else if(entry.kind==='catchup'){
        const item=entry.item;if(!item)throw new Error('Catch-up item not found.');const source=(st.schedules||[]).find(row=>String(row.id)===String(item.sourceJobId||item.scheduleJobId||''));client=clientById(item.clientId||source?.clientId);if(!source?.id||!client?.id)throw new Error('The original missed visit could not be found.');job={...clone(source),id:appUid('sch'),date,teamId,status:'scheduled',sort:99,manualOverride:true,autoGenerated:false,autoAssigned:false,linkedFromJobId:source.id,catchUpId:item.id,estimatedHours:Math.max(.25,Number(item.estimatedHours||source.estimatedHours||client.estimatedHours||1)),audit:[...(source.audit||[]),{at:stamp,actor:'Office',action:'Catch-up scheduled in Schedule V2',note:date}]};delete job.completedAt;delete job.completedByTeamId;item.status='scheduled';item.scheduledDate=date;item.teamId=teamId;item.scheduledJobId=job.id;item.updatedAt=stamp;st.schedules.push(job);
      }
      if(!job)throw new Error('No schedule job was created.');
      (st.serviceCommitments||[]).filter(commitment=>(job.commitmentIds||[]).includes(commitment.id)||(String(commitment.clientId)===String(job.clientId)&&!commitment.scheduleJobId)).forEach(commitment=>{commitment.scheduleJobId=job.id;commitment.status='Scheduled';commitment.updatedAt=stamp;});
      if(job.quoteId){const quote=(st.quotes||[]).find(row=>String(row.id)===String(job.quoteId));if(quote){quote.scheduled=true;quote.scheduledAt=stamp;quote.scheduledDate=date;quote.scheduledTeamId=teamId;quote.scheduledJobId=job.id;}}
      insertAt(teamId,date,job,index);await persistSchedule();window.toast?.(`${client?.name||'Work item'} scheduled for ${dayName(date)}.`);postRefresh();return {ok:true,jobId:job.id};
    }catch(error){restoreScheduleBackup(backup);console.error('[Schedule V2] placement rollback',error);return {ok:false,error:String(error?.message||error)};}
  }

  async function addAction(input){
    const b=appBackend();if(b?.mode!=='supabase'||!b.client||!b.businessId)return {ok:false,error:'Live business connection is not ready.'};
    const kind=input.kind==='team_note'?'team_note':'internal_event';
    const id=appUid('act');
    const payload={kindV6005:kind,kindV59694:kind,createdByFeature:'schedule-v2-60.8.0'};
    const row={id,title:input.title|| (kind==='team_note'?'Team instruction':'Ad-hoc event'),detail:input.detail||'',status:'scheduled',priority:'normal',assignedType:'team',assignedId:input.teamId||'',calendarDate:input.date||'',calendarTime:input.time||'',payload};
    try{
      let result=await b.client.rpc('tuinbooks_save_operational_action_v59674',{p_business_id:b.businessId,p_row:row});
      if(result.error&&/function|rpc|schema cache|not found/i.test(String(result.error.message||result.error))){
        result=await b.client.from('operational_actions_v59674').upsert({id,business_id:b.businessId,title:row.title,detail:row.detail,status:'scheduled',priority:'normal',assigned_type:'team',assigned_id:row.assignedId,calendar_date:row.calendarDate,calendar_time:row.calendarTime||null,payload},{onConflict:'id'}).select('*').single();
      }
      if(result.error)throw result.error;postRefresh();return {ok:true};
    }catch(error){console.error('[Schedule V2] action save',error);return {ok:false,error:String(error?.message||error)};}
  }

  async function refreshRolling(){
    try{
      const canonical=window.__tuinbooksCanonicalRollingV6010?.ensure;
      if(typeof canonical!=='function')return {ok:false,error:'Canonical rolling-schedule engine is unavailable.'};
      const result=await canonical({reason:'schedule-v2-manual',showFeedback:true});postRefresh();return {ok:true,result};
    }catch(error){return {ok:false,error:String(error?.message||error)};}
  }

  window.TuinBooksScheduleV2Bridge={version:VERSION,getSnapshot,moveJob,moveJobToBasket,placeBasket,addAction,refreshRolling,refresh:postRefresh};

  // Explicit hooks consumed by app.js's final Schedule router. This means every
  // historical in-app renderSchedule() call lands here once V2 is available.
  window.__tuinbooksScheduleV2Render=renderScheduleV2Host;
  window.__tuinbooksScheduleV2ApplyTab=()=>true;

  // Final Schedule authority: app.js keeps its state and persistence; the legacy DOM renderer is replaced.
  try{window.renderSchedule=renderScheduleV2Host;}catch(error){console.error('[Schedule V2] could not bind renderer',error);}
  // renderDesktopView() still invokes the historical Schedule sub-tab hook after
  // rendering. Make that hook inert so it cannot open or repaint the old basket.
  try{window.applyScheduleTabV58930=()=>true;}catch(error){console.error('[Schedule V2] could not disable legacy Schedule tabs',error);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installHost();if(String(window.activeView||'')==='schedule')renderScheduleV2Host();},{once:true});
  else{installHost();if(String(window.activeView||'')==='schedule')renderScheduleV2Host();}
  window.__TUINBOOKS_SCHEDULE_V2__={version:VERSION,isolated:true,directBasketState:true,directSchedulePersistence:true,legacyPatchChainLoaded:false,allAppRenderCallsRouted:true};
})();
