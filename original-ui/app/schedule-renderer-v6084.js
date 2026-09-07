/* TuinBooks v60.0.11 CANARY
   Schedule calendar actions + mobile first-item day instructions.
   Canary only. Production index.html/app.js/mobile.html remain untouched.
*/
(()=>{
  'use strict';
  const BUILD='60.3.5-exact-v6011-calendar-production';
  const terminal=new Set(['completed','cancelled','canceled','rescheduled','deferred','no-charge','access-failed']);
  let actions=[];
  let actionsBusiness='';
  let actionsLoadedAt=0;
  let actionsPromise=null;
  let promptedJobId='';
  let promptedAt=0;
  let mobileInjectBusy=false;

  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const today=()=>{try{return window.localDateISO?.()||new Date().toISOString().slice(0,10);}catch{return new Date().toISOString().slice(0,10);}};
  const isPast=date=>String(date||'')<today();
  const backend=()=>window.backendV28||{};
  const appState=()=>window.state||{};
  const clientFor=job=>(appState().clients||[]).find(c=>String(c.id)===String(job?.clientId))||null;
  const teamFor=id=>(appState().teams||[]).find(t=>String(t.id)===String(id))||null;
  const kindOf=a=>String(a?.payload?.kindV6010||a?.payload?.kindV6005||a?.payload?.kindV59694||a?.kindV6010||a?.kindV6005||a?.kindV59694||'').trim();
  const activeTeams=()=> (appState().teams||[]).filter(t=>t&&t.active!==false);

  function normaliseAction(row){
    const p=row?.payload||{};
    return {
      ...p,
      id:String(row?.id||p.id||''),
      title:String(row?.title||p.title||''),
      detail:String(row?.detail||p.detail||''),
      status:String(row?.status||p.status||'scheduled'),
      assignedType:String(row?.assigned_type||p.assignedType||'team'),
      assignedId:String(row?.assigned_id||p.assignedId||''),
      calendarDate:String(row?.calendar_date||p.calendarDate||'').slice(0,10),
      calendarTime:String(row?.calendar_time||p.calendarTime||'').slice(0,5),
      payload:p,
      kindV6010:String(p.kindV6010||p.kindV6005||p.kindV59694||row?.kindV6010||row?.kindV6005||row?.kindV59694||'')
    };
  }

  function actionsFor(teamId,date){
    return actions
      .filter(a=>String(a.status||'').toLowerCase()!=='cancelled'&&String(a.assignedId)===String(teamId)&&String(a.calendarDate)===String(date))
      .sort((a,b)=>{
        const ak=kindOf(a)==='team_note'?0:1,bk=kindOf(b)==='team_note'?0:1;
        if(ak!==bk)return ak-bk;
        return String(a.calendarTime||'').localeCompare(String(b.calendarTime||''));
      });
  }

  async function loadActions(force=false){
    const b=backend();
    if(!b?.client||!b?.businessId||b.mode!=='supabase')return false;
    const now=Date.now();
    if(!force&&actionsBusiness===String(b.businessId)&&now-actionsLoadedAt<15000)return true;
    if(actionsPromise)return actionsPromise;
    actionsPromise=(async()=>{
      try{
        const {data,error}=await b.client.from('operational_actions_v59674').select('*').eq('business_id',b.businessId).order('calendar_date',{ascending:true});
        if(error)throw error;
        actions=(data||[]).map(normaliseAction).filter(a=>a.assignedType==='team'&&['team_note','internal_event'].includes(kindOf(a)));
        actionsBusiness=String(b.businessId);actionsLoadedAt=Date.now();
        injectDesktopActions();injectMobileActions();
        return true;
      }catch(error){
        console.warn('[TuinBooks v60.0.11] action load failed',error);
        return false;
      }finally{actionsPromise=null;}
    })();
    return actionsPromise;
  }

  async function persistAction(action){
    const b=backend();
    if(!b?.client||!b?.businessId||b.mode!=='supabase')throw new Error('Open the live business workspace before saving this calendar item.');
    const kind=kindOf(action)||action.kindV6010;
    const payload={...(action.payload||{}),kindV6010:kind,kindV6005:kind,kindV59694:kind,createdByFeature:'consolidated-schedule-v6010'};
    const row={...action,payload,kindV6010:kind};
    const params=new URLSearchParams(location.search);
    const supportSessionId=params.get('support')==='1'?(params.get('session')||null):null;
    let result=await b.client.rpc('tuinbooks_save_operational_action_v6011',{
      p_business_id:b.businessId,
      p_row:row,
      p_support_session_id:supportSessionId
    });
    if(result.error){
      const message=String(result.error.message||result.error);
      if(/function|rpc|schema cache|not found|PGRST202/i.test(message)){
        throw new Error('The v60.0.11 operational-action permission migration has not been installed yet.');
      }
      throw result.error;
    }
    await loadActions(true);
    return result.data;
  }

  function actionDialog(){
    let dialog=document.getElementById('scheduleActionDialogV6010');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='scheduleActionDialogV6010';dialog.className='dialog schedule-action-dialog-v6010';document.body.appendChild(dialog);
    }
    return dialog;
  }

  function openEditor(kind='team_note',teamId='',date='',existing=null){
    const note=kind==='team_note',dialog=actionDialog();
    const chosenDate=existing?.calendarDate||date||today();
    const chosenTeam=existing?.assignedId||teamId||activeTeams()[0]?.id||'';
    dialog.innerHTML=`<form class="dialog-shell">
      <div class="dialog-heading"><div><span class="eyebrow">${note?'Shown first on the team route':'Non-client calendar item'}</span><h2>${existing?'Edit ':'New '}${note?'day instruction':'ad-hoc event'}</h2></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></div>
      <div class="form-grid two">
        <label>Date *<input id="actionDateV6010" type="date" required value="${esc(chosenDate)}"></label>
        <label>Team *<select id="actionTeamV6010" required>${activeTeams().map(team=>`<option value="${esc(team.id)}">${esc(team.name||'Team')}</option>`).join('')}</select></label>
        ${note?'':`<label>Time, optional<input id="actionTimeV6010" type="time" value="${esc(existing?.calendarTime||'')}"></label><label>Event title *<input id="actionTitleV6010" maxlength="100" required value="${esc(existing?.title||'')}"></label>`}
        <label class="span-two">${note?'Instruction *':'Details'}<textarea id="actionDetailV6010" rows="4" ${note?'required':''}>${esc(existing?.detail||'')}</textarea></label>
      </div>
      <div id="actionErrorV6010" class="backend-gate-error"></div>
      <div class="dialog-actions">${existing?'<button type="button" class="button danger secondary" data-remove>Remove</button>':''}<button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button">Save</button></div>
    </form>`;
    const teamSelect=dialog.querySelector('#actionTeamV6010');if(teamSelect)teamSelect.value=chosenTeam;
    dialog.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>dialog.close()));
    dialog.querySelector('[data-remove]')?.addEventListener('click',async()=>{
      try{existing.status='cancelled';await persistAction(existing);dialog.close();rerenderAfterAction();window.toast?.(note?'Day instruction removed.':'Ad-hoc event removed.');}
      catch(error){dialog.querySelector('#actionErrorV6010').textContent=String(error?.message||error);}
    });
    dialog.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();
      const detail=dialog.querySelector('#actionDetailV6010').value.trim();
      const title=note?'Day instruction':dialog.querySelector('#actionTitleV6010').value.trim();
      if(note&&!detail)return;
      const action=existing||{id:typeof window.uid==='function'?window.uid('action'):(crypto.randomUUID?.()||`action-${Date.now()}`),createdAt:new Date().toISOString()};
      Object.assign(action,{
        kindV6010:kind,title,detail,status:'scheduled',assignedType:'team',assignedId:dialog.querySelector('#actionTeamV6010').value,
        calendarDate:dialog.querySelector('#actionDateV6010').value,calendarTime:note?'':(dialog.querySelector('#actionTimeV6010')?.value||''),
        payload:{...(action.payload||{}),kindV6010:kind,kindV6005:kind,kindV59694:kind}
      });
      try{
        await persistAction(action);dialog.close();rerenderAfterAction();window.toast?.(note?'Day instruction saved.':'Ad-hoc event saved.');
      }catch(error){dialog.querySelector('#actionErrorV6010').textContent=String(error?.message||error);}
    });
    try{dialog.showModal();}catch{dialog.setAttribute('open','');}
  }
  window.openCalendarActionV6010=(kind,teamId,date)=>openEditor(kind,teamId,date,null);

  function actionItemHtml(a,past=false){
    const note=kindOf(a)==='team_note';
    const label=note?'DAY INSTRUCTION':'AD-HOC EVENT';
    const main=note?(a.detail||'Day instruction'):(a.title||'Ad-hoc event');
    const body=!note&&a.detail?`<small>${esc(a.detail)}</small>`:'';
    const time=a.calendarTime?`<time>${esc(a.calendarTime)}</time>`:'';
    if(past)return `<article class="schedule-action-v6010 ${note?'instruction':'event'}"><span>${label}</span><div><strong>${esc(main)}</strong>${body}</div>${time}</article>`;
    return `<button type="button" class="schedule-action-v6010 ${note?'instruction':'event'}" data-action-id="${esc(a.id)}"><span>${label}</span><div><strong>${esc(main)}</strong>${body}</div>${time}</button>`;
  }

  function injectDesktopActions(){
    document.querySelectorAll('#weeklyScheduleBoard .schedule-day-lane[data-team-id][data-date]').forEach(lane=>{
      const teamId=lane.dataset.teamId||'',date=lane.dataset.date||'',past=isPast(date);
      lane.querySelector(':scope > .schedule-actions-v6010')?.remove();
      const rows=actionsFor(teamId,date);
      if(!rows.length)return;
      const host=document.createElement('div');host.className='schedule-actions-v6010';host.innerHTML=rows.map(a=>actionItemHtml(a,past)).join('');
      const jobs=lane.querySelector(':scope > .v6006-jobs, :scope > .schedule-lane-cards');
      if(jobs)lane.insertBefore(host,jobs);else lane.appendChild(host);
    });
  }

  function patchCalendarButtons(){
    document.querySelectorAll('#weeklyScheduleBoard .schedule-day-lane[data-team-id][data-date]').forEach(lane=>{
      const date=lane.dataset.date||'',teamId=lane.dataset.teamId||'';
      lane.querySelector(':scope > .v6010-calendar-actions')?.remove();
      lane.querySelector(':scope > .v6007-day-add')?.remove();
      lane.querySelector('.schedule-lane-head > .v6009-calendar-actions')?.remove();
      if(isPast(date))return;
      const wrap=document.createElement('div');wrap.className='v6010-calendar-actions';
      wrap.innerHTML=`<button type="button" data-calendar-kind="team_note">+ Note</button><button type="button" data-calendar-kind="internal_event">+ Event</button>`;
      wrap.dataset.teamId=teamId;wrap.dataset.date=date;
      wrap.querySelectorAll('button[data-calendar-kind]').forEach(button=>{
        button.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          openEditor(button.dataset.calendarKind,teamId,date,null);
        });
      });
      const header=lane.querySelector(':scope > header, :scope > .schedule-lane-head');
      if(header)header.insertAdjacentElement('afterend',wrap);else lane.prepend(wrap);
    });
  }

  function selectedMobileTeam(){
    const select=document.getElementById('mobileTeamSelect');if(select?.value)return select.value;
    const todays=(appState().schedules||[]).filter(j=>String(j.date||'')===today()&&String(j.status||'').toLowerCase()!=='cancelled');
    const ids=[...new Set(todays.map(j=>String(j.teamId||'')).filter(Boolean))];
    if(ids.length===1)return ids[0];
    return activeTeams()[0]?.id||'';
  }

  function injectMobileActions(){
    const host=document.getElementById('mobileScheduleList');if(!host)return;
    const teamId=selectedMobileTeam();if(!teamId)return;
    const rows=actionsFor(teamId,today());
    const signature=rows.map(a=>`${a.id}|${a.status}|${a.calendarTime}|${a.title}|${a.detail}`).join('~');
    let section=host.querySelector(':scope > .mobile-actions-v6010');
    if(section?.dataset.signature===signature&&host.firstElementChild===section)return;
    section?.remove();
    if(!rows.length)return;
    section=document.createElement('section');section.className='mobile-actions-v6010';section.dataset.signature=signature;
    section.innerHTML=rows.map(a=>{
      const note=kindOf(a)==='team_note';
      return `<article class="mobile-action-v6010 ${note?'instruction':'event'}"><span>${note?'TODAY’S INSTRUCTION':'AD-HOC EVENT'}</span><strong>${esc(note?(a.detail||'Day instruction'):(a.title||'Ad-hoc event'))}</strong>${!note&&a.detail?`<p>${esc(a.detail)}</p>`:''}${a.calendarTime?`<time>${esc(a.calendarTime)}</time>`:''}</article>`;
    }).join('');
    // Critical rule: operational instructions are the FIRST route item, before area groups/client jobs.
    host.prepend(section);
  }

  function installMobileObserver(){
    const host=document.getElementById('mobileScheduleList');if(!host||host.__v6010Observer)return;
    const observer=new MutationObserver(()=>{
      if(mobileInjectBusy)return;mobileInjectBusy=true;
      queueMicrotask(()=>{try{injectMobileActions();}finally{mobileInjectBusy=false;}});
    });
    observer.observe(host,{childList:true,subtree:false});host.__v6010Observer=observer;
    document.getElementById('mobileTeamSelect')?.addEventListener('change',()=>setTimeout(()=>{loadActions(true);injectMobileActions();},0));
  }

  function recurring(job){
    if(!job)return false;
    try{if(typeof window.workMarkerForJobV5546==='function'&&window.workMarkerForJobV5546(job)==='R')return true;}catch{}
    const c=clientFor(job)||{};
    const text=`${job.revenueType||''} ${job.workKind||''} ${c.recordKindV58951||''} ${c.frequency||''}`.toLowerCase();
    return /recurring|weekly|fortnight|biweekly|bi weekly|monthly|every 2 week|every week|routine/.test(text);
  }
  function dayName(date){try{if(typeof window.dayName==='function')return window.dayName(date);}catch{}return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(`${date}T12:00:00`).getDay()];}
  function weekStart(date){try{return window.startOfWeek?.(date)||date;}catch{return date;}}
  function addDays(date,n){try{return window.dateAdd?.(date,n)||date;}catch{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}}
  function workdayIndex(date){const d=new Date(`${date}T12:00:00`).getDay();return d===0?6:d-1;}
  function saveState(){try{window.save?.();return true;}catch(error){console.error('[v6010] save failed',error);return false;}}
  function applyFuturePattern(job){
    const state=appState(),client=clientFor(job),team=teamFor(job.teamId);if(!client||!team)return {updated:0};
    const anchor=String(job.date||''),day=dayName(anchor),idx=workdayIndex(anchor);
    client.preferredDay=day;client.preferredTeamId=team.id;client.teamId=team.id;client.recurrenceAnchorDate=anchor;
    if(client.autoScheduleEnabled!==false)client.autoScheduleEnabled=true;
    if(client.scheduleSource!=='diary')client.scheduleSource=client.scheduleSource||'confirmed-recurring';
    (state.serviceAgreements||[]).filter(a=>String(a.clientId)===String(client.id)&&String(a.status||'').toLowerCase()==='active').forEach(a=>{
      a.preferredDays=[day];a.defaultTeamId=team.id;a.updatedAt=new Date().toISOString();(a.lines||[]).filter(line=>line.active!==false).forEach(line=>{line.anchorDate=anchor;});
    });
    let updated=0;
    (state.schedules||[]).forEach(future=>{
      if(String(future.id)===String(job.id)||String(future.clientId)!==String(job.clientId)||String(future.date||'')<=anchor)return;
      if(terminal.has(String(future.status||'scheduled').toLowerCase())||!recurring(future)||future.manualOverride===true)return;
      future.date=addDays(weekStart(future.date),idx);future.teamId=team.id;future.autoAssigned=true;future.updatedAt=new Date().toISOString();updated++;
    });
    saveState();try{window.scheduleRollingRefreshV58929?.('recurring-pattern-updated',120);}catch{}try{window.renderSchedule?.();}catch{}
    return {updated,day,team:team.name||'Team'};
  }
  function showRecurringScope(job,before){
    if(!job||!recurring(job))return;
    const changed=String(before?.date||'')!==String(job.date||'')||String(before?.teamId||'')!==String(job.teamId||'');
    if(!changed)return;
    const scope=typeof window.getScheduleDragScopeV6059==='function'?window.getScheduleDragScopeV6059():'once';
    if(scope==='future'){
      const result=applyFuturePattern(job);
      window.toast?.(`Recurring pattern updated to ${result.day} · ${result.team}.${result.updated?` ${result.updated} future visit${result.updated===1?'':'s'} moved.`:''}`);
    }else{
      window.toast?.('This visit moved. Future recurring visits are unchanged.');
    }
  }
  function readDragJob(event){try{const raw=event?.dataTransfer?.getData?.('application/json');if(!raw)return null;const data=JSON.parse(raw);if(data?.type!=='job'||!data.id)return null;return (appState().schedules||[]).find(j=>String(j.id)===String(data.id))||null;}catch{return null;}}

  const baseRender=(typeof window.renderScheduleConsolidatedV6002==='function')?window.renderScheduleConsolidatedV6002:window.renderSchedule;
  function renderV6010(){
    // Exact approved canary visual: keep the original labelled schedule board.
    // Earlier compact experiments changed this class to v6006/v6007; that is
    // what removed the route/area labels and service/status detail the user approved.
    const board=document.getElementById('weeklyScheduleBoard');
    if(board)board.className='schedule-board';
    const result=baseRender?.();
    if(board)board.className='schedule-board';
    document.getElementById('v6008ScheduleOps')?.remove();document.querySelector('.v6007-ops')?.remove();document.getElementById('scheduleOperationsToolbarV6005')?.remove();document.getElementById('scheduleToolbarV6006')?.remove();document.getElementById('scheduleOperationalToolbarV59697')?.remove();
    patchCalendarButtons();injectDesktopActions();loadActions(false);document.documentElement.dataset.scheduleRenderer='v6011-production';return result;
  }
  window.renderSchedule=renderV6010;

  function rerenderAfterAction(){
    if(document.body?.dataset?.app==='mobile'){injectMobileActions();return;}
    try{renderV6010();}catch{injectDesktopActions();}
  }

  const closeBasketBase=window.closeScheduleQueue;
  if(typeof closeBasketBase==='function')window.closeScheduleQueue=function closeBasketV6010(){const r=closeBasketBase();try{window.renderScheduleQueue?.();}catch{}return r;};
  const dropBase=window.scheduleDropAtPositionV58930;
  if(typeof dropBase==='function')window.scheduleDropAtPositionV58930=function dropAtPositionV6010(event,teamId,date,index){
    const moving=readDragJob(event),before=moving?{date:String(moving.date||''),teamId:String(moving.teamId||'')}:null;
    const result=dropBase(event,teamId,date,index);if(moving&&before)setTimeout(()=>showRecurringScope(moving,before),120);return result;
  };
  window.scheduleDrop=function scheduleDropV6010(event,teamId,date){const count=(appState().schedules||[]).filter(j=>String(j.teamId)===String(teamId)&&String(j.date)===String(date)&&String(j.status||'').toLowerCase()!=='cancelled').length;return window.scheduleDropAtPositionV58930(event,teamId,date,count);};
  const saveMoveBase=window.saveMoveJobV20;
  if(typeof saveMoveBase==='function')window.saveMoveJobV20=function saveMoveV6010(event){const id=document.getElementById('moveScheduleJobId')?.value,job=(appState().schedules||[]).find(j=>String(j.id)===String(id)),before=job?{date:String(job.date||''),teamId:String(job.teamId||'')}:null;const result=saveMoveBase(event);if(job&&before)setTimeout(()=>showRecurringScope(job,before),120);return result;};

  function delegatedClicks(event){
    const actionButton=event.target?.closest?.('.v6010-calendar-actions button[data-calendar-kind]');
    if(actionButton){event.preventDefault();event.stopPropagation();const wrap=actionButton.closest('.v6010-calendar-actions');openEditor(actionButton.dataset.calendarKind,wrap?.dataset.teamId||'',wrap?.dataset.date||'',null);return;}
    const saved=event.target?.closest?.('.schedule-action-v6010[data-action-id]');
    if(saved){event.preventDefault();event.stopPropagation();const action=actions.find(a=>String(a.id)===String(saved.dataset.actionId));if(action)openEditor(kindOf(action),action.assignedId,action.calendarDate,action);}
  }

  /* ---------- production hydration + rolling 8-week maintenance ---------- */
  let rollingRestoredV6035=false;
  let lastActivationSignatureV6035='';
  let activationTimerV6035=null;

  function managementRouteV6035(){
    const p=new URLSearchParams(location.search);
    return p.get('support')==='1'&&!!p.get('business');
  }
  function managementOperationalReadyV6035(){
    const b=backend();
    return !!(b.managementOperationalReadyV5950||b.managementOperationalReadyV59371);
  }
  function workspaceReadyV6035(){
    const b=backend();
    if(!b?.businessId)return false;
    if(managementRouteV6035())return !!b.managementCoreReadyV5950&&managementOperationalReadyV6035();
    const st=appState();
    return Array.isArray(st.teams)&&Array.isArray(st.schedules);
  }
  function scheduleVisibleV6035(){
    return !!document.querySelector('#view-schedule.app-view.active')||
      !!document.querySelector('.nav-tab.active[data-view="schedule"]')||
      String(window.activeView||'')==='schedule';
  }
  function requestManagementOperationalV6035(){
    const b=backend();
    if(!managementRouteV6035()||!b.managementCoreReadyV5950||managementOperationalReadyV6035())return;
    try{
      if(window.__tuinbooksFastManagementNavigationV59669?.preload)window.__tuinbooksFastManagementNavigationV59669.preload();
      else if(typeof window.loadManagementOperationalV5950==='function')window.loadManagementOperationalV5950();
    }catch(error){console.warn('[v60.3.5] management schedule hydration request',error);}
  }
  function restoreCanonicalRollingV6035(){
    if(rollingRestoredV6035)return true;
    const canonical=window.__tuinbooksCanonicalRollingV6010;
    if(!canonical?.ensure||!canonical?.refresh||!canonical?.generate)return false;
    window.ensureRollingScheduleV58929=canonical.ensure;
    window.scheduleRollingRefreshV58929=canonical.refresh;
    window.generateRecurringWeek=canonical.generate;
    rollingRestoredV6035=true;
    return true;
  }
  function scheduleRollingMaintenanceV6035(reason='schedule-open',delay=180){
    if(!workspaceReadyV6035()||!rollingRestoredV6035)return false;
    try{window.scheduleRollingRefreshV58929?.(reason,delay);return true;}
    catch(error){console.warn('[v60.3.5] rolling refresh',error);return false;}
  }
  function applyProductionBuildMarkerV6035(){
    window.__tuinbooksScheduleBuild=BUILD;
    document.documentElement.dataset.tuinbooksSchedule='v6035-exact-v6011-production';
  }
  function activateScheduleV6035(reason='poll'){
    if(document.body?.dataset?.app==='mobile')return false;
    if(!scheduleVisibleV6035())return false;
    if(!workspaceReadyV6035()){
      requestManagementOperationalV6035();
      return false;
    }
    restoreCanonicalRollingV6035();
    const st=appState(),b=backend();
    const signature=[b.businessId,(st.teams||[]).length,(st.schedules||[]).length,String(window.activeView||''),reason].join('|');
    try{
      renderV6010();
      if(reason!=='poll'||signature!==lastActivationSignatureV6035){
        loadActions(reason!=='poll').then(()=>{try{renderV6010();}catch{}}).catch(()=>{});
        scheduleRollingMaintenanceV6035(reason,reason==='schedule-open'?160:240);
        lastActivationSignatureV6035=signature;
      }
      return true;
    }catch(error){console.error('[v60.3.5] exact canary Schedule render failed',error);return false;}
  }
  function boot(){
    applyProductionBuildMarkerV6035();
    document.addEventListener('click',delegatedClicks,true);
    if(document.body?.dataset?.app==='mobile'){
      installMobileObserver();loadActions(true).then(injectMobileActions);setInterval(()=>{loadActions(false);injectMobileActions();},5000);
    }else{
      // Normal basket state: don't force it open or permanently hide its launcher.
      try{window.closeScheduleQueue?.();window.renderScheduleQueue?.();}catch{}
      document.addEventListener('click',event=>{
        if(event.target?.closest?.('.nav-tab[data-view="schedule"]'))setTimeout(()=>activateScheduleV6035('schedule-open'),60);
      },true);
      window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>activateScheduleV6035('workspace-ready'),0));
      activateScheduleV6035('initial');
      activationTimerV6035=setInterval(()=>activateScheduleV6035('poll'),650);
      setTimeout(()=>{if(activationTimerV6035){clearInterval(activationTimerV6035);activationTimerV6035=null;}},30000);
    }
    console.info('[TuinBooks v60.3.5 exact v6011 Schedule]',{build:BUILD,labelledBoard:true,calendarActions:true,mobileInstructionFirst:true,rollingAfterHydration:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
