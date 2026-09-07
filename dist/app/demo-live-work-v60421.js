/* TuinBooks v60.4.20 — demo-only live Work state.
   Uses the real Work UI. Does not alter normal client workspaces. */
(()=>{
  'use strict';
  const BUILD='60.4.21-demo-live-work-safe';
  const PHOTO_FILES=['showroom-work-01.jpg','showroom-work-02.jpg','showroom-work-03.jpg','showroom-work-04.jpg'];
  let hooked=false;

  const today=()=>typeof window.localDateISO==='function'?window.localDateISO():(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})();
  const demo=()=>/TuinBooks Training Garden Services/i.test(String(window.state?.business?.name||document.getElementById('businessNameHeader')?.textContent||''));
  const photoUrl=index=>new URL(`/app/demo-work-photos-v60421/${PHOTO_FILES[index%PHOTO_FILES.length]}`,location.origin).href;
  const cleanStatus=value=>String(value||'').toLowerCase();
  const usableJob=job=>String(job?.date||'').slice(0,10)===today()&&!['cancelled','canceled','rescheduled','deferred','archived','deleted'].includes(cleanStatus(job?.status));

  function clientFor(job){return (window.state?.clients||[]).find(c=>String(c.id)===String(job.clientId))||{};}
  function tasksFor(job){
    const client=clientFor(job);
    const direct=Array.isArray(job.visitTasks)?job.visitTasks.filter(Boolean):[];
    if(direct.length)return direct.slice(0,5);
    const service=String(client.serviceDescription||'').split(';').map(v=>v.trim()).filter(Boolean);
    if(service.length)return service.slice(0,5);
    return ['Mow lawns','Edge lawns and paths','Weed and tidy beds','Blow or clean paving'];
  }
  function completionTime(index){
    const mins=8*60+25+index*23;
    const h=Math.min(12,Math.floor(mins/60)),m=mins%60;
    return `${today()}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
  }
  function ensureVisit(job,index){
    window.state.visits=Array.isArray(window.state.visits)?window.state.visits:[];
    let visit=window.state.visits.find(v=>String(v.scheduledJobId||'')===String(job.id));
    const tasks=tasksFor(job),src=photoUrl(index);
    if(!visit){
      visit={
        id:`demo-livefix-${String(job.id||index)}`,
        clientId:job.clientId,
        date:today(),
        teamId:job.teamId,
        scheduled:true,
        scheduledJobId:job.id,
        workDone:[...tasks],
        taskOutcomesV56:tasks.map(task=>({task,outcome:'Done',note:''})),
        extraDescription:index===2?'Client asked the office to quote a hedge reduction for the next visit.':'',
        outcome:'Completed',
        outcomeNote:'',
        processed:true,
        resolutionStatusV56:'processed',
        photos:[src],
        photoPaths:[],
        photoCategories:['After'],
        startedAt:completionTime(Math.max(0,index-2)),
        completedAt:completionTime(index),
        createdAt:completionTime(index),
        createdBy:'demo-showroom'
      };
      window.state.visits.push(visit);
    }else{
      visit.outcome='Completed';visit.processed=true;visit.resolutionStatusV56='processed';
      visit.workDone=Array.isArray(visit.workDone)&&visit.workDone.length?visit.workDone:[...tasks];
      visit.taskOutcomesV56=Array.isArray(visit.taskOutcomesV56)&&visit.taskOutcomesV56.length?visit.taskOutcomesV56:tasks.map(task=>({task,outcome:'Done',note:''}));
      visit.photos=[src];visit.photoPaths=Array.isArray(visit.photoPaths)?visit.photoPaths:[];visit.photoCategories=['After'];
      visit.completedAt=visit.completedAt||completionTime(index);visit.createdAt=visit.createdAt||completionTime(index);
    }
    job.status='completed';
    return visit;
  }
  function ensurePhotosOnCompleted(){
    let n=0;
    (window.state?.visits||[]).filter(v=>String(v.date||'').slice(0,10)===today()&&/^completed/i.test(String(v.outcome||''))).forEach(v=>{
      v.photos=[photoUrl(n++)];v.photoPaths=Array.isArray(v.photoPaths)?v.photoPaths:[];v.photoCategories=['After'];
    });
  }
  function apply(){
    if(!demo()||!window.state)return false;
    const jobs=(window.state.schedules||[]).filter(usableJob);
    if(!jobs.length)return false;
    const teams=new Map();
    jobs.forEach(job=>{const key=String(job.teamId||'');if(!teams.has(key))teams.set(key,[]);teams.get(key).push(job);});
    const ratios=[0.67,0.40,0.34,0.60];
    let photoIndex=0,teamIndex=0;
    for(const group of teams.values()){
      group.sort((a,b)=>Number(a.sort||99)-Number(b.sort||99));
      const existing=group.filter(job=>cleanStatus(job.status)==='completed'||(window.state.visits||[]).some(v=>String(v.scheduledJobId||'')===String(job.id)&&/^completed/i.test(String(v.outcome||''))));
      const target=Math.min(group.length-1,Math.max(1,Math.round(group.length*(ratios[teamIndex%ratios.length]))));
      const need=Math.max(0,target-existing.length);
      group.filter(job=>!existing.includes(job)).slice(0,need).forEach(job=>ensureVisit(job,photoIndex++));
      existing.forEach(job=>{const v=(window.state.visits||[]).find(row=>String(row.scheduledJobId||'')===String(job.id));if(v){v.photos=[photoUrl(photoIndex++)];v.photoCategories=['After'];}});
      teamIndex++;
    }
    ensurePhotosOnCompleted();
    // Keep this demo staging session-only. Do not create a cloud/core delta.
    try{
      if(window.backendV28&&typeof window.makeOperationalSnapshotV41==='function'&&typeof window.operationalSnapshotJsonV41==='function'){
        window.backendV28.lastOperationalJson=window.operationalSnapshotJsonV41(window.makeOperationalSnapshotV41());
        window.backendV28.operationalDirty=false;
        window.backendV28.operationalQueued=false;
        window.backendV28.operationalConflict=false;
        window.backendV28.lastOperationalErrorV5604=null;
        clearTimeout(window.backendV28.operationalSyncTimer);window.backendV28.operationalSyncTimer=null;
      }
      if(window.backendV28){
        window.backendV28.coreDirty=false;
        window.backendV28.coreConflict=false;
        window.backendV28.lastCoreErrorV59395=null;
        clearTimeout(window.backendV28.syncTimer);window.backendV28.syncTimer=null;
      }
      window.renderOperationalSaveIssueV5604?.();
      window.setBackendSyncStateV28?.('Demo ready','saved');
    }catch(_){ }
    return true;
  }
  function refresh(){
    if(!apply())return;
    try{window.renderRecords?.();}catch(_){ }
  }
  function hookRenderer(){
    if(hooked||typeof window.renderRecords!=='function')return;
    const original=window.renderRecords;
    window.renderRecords=function(...args){apply();return original.apply(this,args);};
    hooked=true;
  }
  function install(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(demo()&&window.state?.schedules){clearInterval(timer);apply();hookRenderer();setTimeout(()=>{try{window.renderRecords?.();}catch(_){ }},100);}
      else if(tries>120)clearInterval(timer);
    },250);
  }
  document.addEventListener('click',event=>{if(event.target.closest?.('.nav-tab[data-view="records"]')&&demo())setTimeout(refresh,120);});
  window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>{apply();hookRenderer();},160));
  window.__tuinbooksDemoLiveWorkV60420={build:BUILD,apply,refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
