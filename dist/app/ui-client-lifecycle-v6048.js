/* TuinBooks v60.4.8 — recurring client lifecycle safety
   - NEW R first placement persists the client as Active.
   - Existing clients use Save client after activation.
   - Saving an existing client as Paused removes future recurring work + recurring basket items.
   - Archiving removes all future schedule/basket work while preserving completed/history/billing.
*/
(()=>{
  'use strict';
  const BUILD='60.4.8-client-lifecycle';
  const $=id=>document.getElementById(id);
  const today=()=>typeof localDateISO==='function'?localDateISO():new Date().toISOString().slice(0,10);
  const clientFor=id=>{try{return typeof clientById==='function'?clientById(id):(state.clients||[]).find(c=>String(c.id)===String(id));}catch(_){return null;}};
  const isCompleted=job=>String(job?.status||'').toLowerCase()==='completed';
  const isRecurringJob=job=>{
    try{if(typeof automaticRecurringJobV58961==='function')return automaticRecurringJobV58961(job);}catch(_){ }
    try{if(typeof workMarkerForJobV5546==='function')return workMarkerForJobV5546(job)==='R';}catch(_){ }
    return String(job?.workMarker||'').toUpperCase()==='R'||String(job?.workKind||'').toLowerCase()==='recurring'||Boolean(job?.recurrenceKey||job?.rollingWeekStartV58929);
  };
  const isRecurringBasket=item=>item?.newRecurringV6036===true||String(item?.workMarker||item?.jobPayload?.workMarker||'').toUpperCase()==='R'||String(item?.workKind||item?.jobPayload?.workKind||'').toLowerCase()==='recurring';

  function clearQuoteScheduleLink(job){
    if(!job?.quoteId)return;
    try{
      const quote=typeof quoteById==='function'?quoteById(job.quoteId):null;
      if(quote){quote.scheduled=false;delete quote.scheduledDate;delete quote.scheduledTeamId;delete quote.scheduledJobId;}
    }catch(_){ }
  }

  function updateCommitmentsForRemovedJobs(clientId,removedIds,{archived=false}={}){
    try{
      (state.serviceCommitments||[]).forEach(row=>{
        if(String(row.clientId)!==String(clientId))return;
        if(row.scheduleJobId&&removedIds.has(String(row.scheduleJobId))){
          row.scheduleJobId='';row.status=archived?'Client cancelled':'Unscheduled';row.updatedAt=new Date().toISOString();
        }
      });
    }catch(_){ }
  }

  function removeFutureRecurring(clientId){
    const cutoff=today(),removedIds=new Set(),kept=[];
    try{
      (state.schedules||[]).forEach(job=>{
        const remove=String(job.clientId)===String(clientId)&&String(job.date||'')>=cutoff&&!isCompleted(job)&&isRecurringJob(job);
        if(remove){removedIds.add(String(job.id));clearQuoteScheduleLink(job);}else kept.push(job);
      });
      state.schedules=kept;
      state.scheduleBasket=(state.scheduleBasket||[]).filter(item=>!(String(item?.clientId||item?.jobPayload?.clientId||'')===String(clientId)&&isRecurringBasket(item)));
      (state.catchUps||[]).forEach(item=>{if(String(item.clientId)===String(clientId)&&['waiting','scheduled'].includes(String(item.status||'').toLowerCase())){item.status='cancelled';item.cancelReason='Client paused';}});
      updateCommitmentsForRemovedJobs(clientId,removedIds,{archived:false});
    }catch(error){console.error('[v60.4.8] pause cleanup failed',error);}
    return removedIds.size;
  }

  function removeAllFutureClientWork(clientId){
    const cutoff=today(),removedIds=new Set(),kept=[];
    try{
      (state.schedules||[]).forEach(job=>{
        const remove=String(job.clientId)===String(clientId)&&String(job.date||'')>=cutoff&&!isCompleted(job);
        if(remove){removedIds.add(String(job.id));clearQuoteScheduleLink(job);}else kept.push(job);
      });
      state.schedules=kept;
      state.scheduleBasket=(state.scheduleBasket||[]).filter(item=>String(item?.clientId||item?.jobPayload?.clientId||'')!==String(clientId));
      (state.catchUps||[]).forEach(item=>{if(String(item.clientId)===String(clientId)&&['waiting','scheduled'].includes(String(item.status||'').toLowerCase())){item.status='cancelled';item.cancelReason='Client archived';}});
      updateCommitmentsForRemovedJobs(clientId,removedIds,{archived:true});
    }catch(error){console.error('[v60.4.8] archive cleanup failed',error);}
    return removedIds.size;
  }

  async function persistLifecycle({core=true,operational=true}={}){
    try{if(typeof save==='function')save();}catch(_){ }
    const tasks=[];
    try{if(core&&typeof syncCoreDeltaV59395==='function'&&backendV28?.mode==='supabase')tasks.push(syncCoreDeltaV59395(true));}catch(_){ }
    try{if(operational&&typeof syncOperationalDeltaV59394==='function'&&backendV28?.mode==='supabase')tasks.push(syncOperationalDeltaV59394(true));}catch(_){ }
    if(tasks.length)await Promise.allSettled(tasks);
  }

  function refreshViews(){
    try{if(typeof renderClients==='function')renderClients();}catch(_){ }
    try{if(typeof renderSchedule==='function'&&typeof activeView!=='undefined'&&activeView==='schedule')renderSchedule();}catch(_){ }
    try{if(typeof renderInvoiceCentre==='function'&&typeof activeView!=='undefined'&&activeView==='invoices')renderInvoiceCentre();}catch(_){ }
  }

  // Persist Active at the exact moment NEW R receives its first real placement.
  try{
    if(typeof createScheduledJobFromRow==='function'&&!createScheduledJobFromRow.__v6048Wrapped){
      const base=createScheduledJobFromRow;
      const wrapped=function(row,teamId,date){
        const isNewR=row?.basketItem?.newRecurringV6036===true;
        const job=base.apply(this,arguments);
        if(isNewR&&job){
          const client=clientFor(job.clientId);
          if(client){
            client.status='active';client.serviceState='active';client.activatedAt=client.activatedAt||new Date().toISOString();
            client.deactivatedAtV6048='';client.archivedAt='';
            Promise.resolve().then(()=>persistLifecycle({core:true,operational:true}));
          }
        }
        return job;
      };
      wrapped.__v6048Wrapped=true;wrapped.__v6048Base=base;createScheduledJobFromRow=wrapped;
      try{window.createScheduledJobFromRow=createScheduledJobFromRow;}catch(_){ }
    }
  }catch(error){console.error('[v60.4.8] NEW R placement wrapper failed',error);}

  // Existing-client save path used by the modal shell.
  window.saveExistingClientV6048=async function(clientForm,submit){
    const id=$('clientId')?.value||'';if(!id)return false;
    const before=clientFor(id);if(!before)return false;
    const previousStatus=String(before.status||'active').toLowerCase()==='active'?'active':'paused';
    const selectedStatus=String($('clientStatus')?.value||previousStatus).toLowerCase()==='active'?'active':'paused';
    const statusField=$('clientStatus');
    if(submit){submit.disabled=true;submit.textContent='Saving…';}
    try{
      if(typeof clientStatusTransitionConfirmedV58961!=='undefined')clientStatusTransitionConfirmedV58961=selectedStatus==='paused'&&previousStatus==='active'?'pause':selectedStatus==='active'&&previousStatus!=='active'?'activate':'';
      const result=await Promise.resolve(window.saveClientForm({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){},target:clientForm,currentTarget:clientForm}));
      const saved=clientFor(id);if(!saved)throw new Error('Saved client record could not be found.');
      saved.status=selectedStatus;saved.serviceState=selectedStatus;
      let removed=0;
      if(selectedStatus==='paused'){
        saved.deactivatedAtV6048=new Date().toISOString();
        removed=removeFutureRecurring(id);
      }else{
        saved.deactivatedAtV6048='';saved.activatedAt=saved.activatedAt||new Date().toISOString();
      }
      await persistLifecycle({core:true,operational:true});
      refreshViews();
      try{if(statusField)statusField.value=selectedStatus;}catch(_){ }
      if(typeof toast==='function')toast(selectedStatus==='paused'?`Client saved as Paused.${removed?` ${removed} future recurring visit${removed===1?' was':'s were'} removed.`:''}`:'Client saved.');
      return result!==false;
    }catch(error){
      console.error('[v60.4.8] existing client save failed',error);
      if(typeof toast==='function')toast(`Client could not be saved${error?.message?`: ${error.message}`:''}.`,'error');
      return false;
    }finally{
      try{if(typeof clientStatusTransitionConfirmedV58961!=='undefined')clientStatusTransitionConfirmedV58961='';}catch(_){ }
      if(submit){submit.disabled=false;submit.textContent='Save client';}
    }
  };

  window.archiveClientV6048=async function(clientId,{confirmUser=true}={}){
    const client=clientFor(clientId);if(!client)return false;
    if(confirmUser&&!window.confirm(`Archive ${client.name||'this client'}? All future scheduled work will be removed. Completed work, invoices and history will remain.`))return false;
    const removed=removeAllFutureClientWork(client.id);
    client.status='archived';client.serviceState='archived';client.archivedAt=new Date().toISOString();client.deactivatedAtV6048=client.archivedAt;
    client.awaitingInitialRecurringPlacementV6036=false;
    try{if(typeof auditV56==='function')auditV56('customer',client.id,'archived',{futureScheduleRemoved:removed});}catch(_){ }
    try{if(typeof syncActiveRoutineDraftsV59660==='function')syncActiveRoutineDraftsV59660();}catch(_){ }
    await persistLifecycle({core:true,operational:true});
    refreshViews();
    if(typeof toast==='function')toast(`Client archived.${removed?` ${removed} future scheduled item${removed===1?' was':'s were'} removed.`:''}`);
    return true;
  };
  window.archiveClientV56=function(clientId){return window.archiveClientV6048(clientId,{confirmUser:true});};

  // Repair clients created through the temporary Paused activation bridge only
  // when there is concrete evidence that NEW R was actually placed and no real
  // pause/archive action exists.
  async function repairPlacedNewRStatus(){
    let changed=false;
    try{
      (state.clients||[]).forEach(client=>{
        if(String(client.status||'').toLowerCase()!=='paused')return;
        if(client.deactivatedAtV6048||client.pauseFrom||client.pauseReason||client.serviceEndDate||client.archivedAt)return;
        if(client.activationConfirmedV58961!==true&&client.activationConfirmedV58959!==true)return;
        const placed=(state.schedules||[]).some(job=>String(job.clientId)===String(client.id)&&job.initialRecurringPlacementV6036===true&&!['cancelled','rescheduled'].includes(String(job.status||'').toLowerCase()));
        if(!placed)return;
        client.status='active';client.serviceState='active';client.activatedAt=client.activatedAt||new Date().toISOString();changed=true;
      });
      if(changed){await persistLifecycle({core:true,operational:false});refreshViews();}
    }catch(error){console.error('[v60.4.8] placed NEW R status repair failed',error);}
  }

  try{
    if(typeof loadWorkspaceV28==='function'&&!loadWorkspaceV28.__v6048Wrapped){
      const baseLoad=loadWorkspaceV28;
      loadWorkspaceV28=async function(){const result=await baseLoad.apply(this,arguments);await repairPlacedNewRStatus();return result;};
      loadWorkspaceV28.__v6048Wrapped=true;
    }
  }catch(_){ }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repairPlacedNewRStatus,1200),{once:true});
  else setTimeout(repairPlacedNewRStatus,1200);

  window.__tuinbooksClientLifecycleV6048={build:BUILD,firstPlacementActivates:true,saveExisting:true,pauseRemovesFutureRecurring:true,archiveRemovesFutureSchedule:true,historyPreserved:true};
})();
