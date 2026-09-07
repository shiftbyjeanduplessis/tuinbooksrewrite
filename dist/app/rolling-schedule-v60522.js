/* TuinBooks v60.5.22 — authoritative 8-week rolling schedule repair
   ------------------------------------------------------------------
   This module fixes ONE thing: established recurring clients must stay
   scheduled across the current week + seven future weeks.

   Design rules:
   - Runs on desktop only, after the real workspace is hydrated.
   - Does not use service/task completeness to decide whether a visit exists.
   - Does not use the old hours/capacity allocator. Existing client day/team wins.
   - NEW R remains manual until its first real placement exists.
   - Ad hoc clients are never auto-repeated.
   - Existing, moved, cancelled, missed, completed or queued occurrences are
     preserved and never duplicated.
   - Supabase is checked before every write. Only genuinely missing rows are
     inserted through the existing operational-delta RPC.
   - No view changes, reloads, navigation changes or global realtime teardown.
*/
(()=>{
  'use strict';
  const BUILD='60.5.22-authoritative-rolling';
  if(window.__tuinbooksRollingV60522?.build===BUILD)return;

  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const HIDDEN=new Set(['cancelled','canceled','cancelled_before_visit','canceled_before_visit','returned_to_queue','removed_from_calendar','deleted','archived']);
  const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
  const parse=v=>new Date(`${v}T12:00:00`);
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const add=(v,n)=>{const d=parse(v);d.setDate(d.getDate()+n);return iso(d);};
  const monday=v=>{const d=parse(v);d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);};
  const diff=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
  const today=()=>{try{return window.localDateISO();}catch(_){return iso(new Date());}};
  const state=()=>window.state||{clients:[],teams:[],schedules:[]};
  const backend=()=>window.backendV28||{};
  const status=v=>String(v||'scheduled').trim().toLowerCase().replace(/[-\s]+/g,'_');
  const activeClient=c=>String(c?.status||'active').toLowerCase()==='active'&&String(c?.serviceState||'active').toLowerCase()!=='archived';
  const frequency=v=>{
    const f=String(v||'').trim().toLowerCase();
    if(!f||/ad\s*hoc|once[- ]?off/.test(f))return '';
    if(/fortnight|biweekly|bi weekly|every\s*2\s*week|two\s*week/.test(f))return 'fortnightly';
    if(/weekly|every\s*week|once\s*a\s*week/.test(f)&&!/fortnight/.test(f))return 'weekly';
    if(/monthly|once\s*a\s*month|every\s*month/.test(f))return 'monthly';
    return '';
  };
  const marker=job=>{
    const m=String(job?.workMarker||'').toUpperCase();if(m)return m;
    try{return String(window.workMarkerForJobV5546?.(job)||'').toUpperCase();}catch(_){return ''}
  };
  const isRoutine=(job,client)=>{
    if(!job||String(job.clientId||'')!==String(client?.id||'')||!valid(job.date))return false;
    if(job.quoteId||marker(job)==='O')return false;
    const text=`${job.workKind||''} ${job.revenueType||''}`.toLowerCase();
    if(/once[- ]?off|additional|quote/.test(text))return false;
    if(marker(job)==='R'||job.recurrenceKey||job.rollingWeekStartV58929||job.initialRecurringPlacementV6036)return true;
    return !!frequency(client?.frequency)||String(client?.recordKindV58951||'').toLowerCase().includes('recurring');
  };
  const dayName=v=>{const n=parse(v).getDay();return n===0?'Sunday':DAYS[n-1]||'';};
  const dayIndex=name=>DAYS.indexOf(String(name||''));
  const mode=values=>{
    const m=new Map();values.filter(Boolean).forEach(v=>m.set(v,(m.get(v)||0)+1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])))[0]?.[0]||'';
  };
  const median=nums=>{const a=[...nums].sort((x,y)=>x-y);if(!a.length)return 0;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
  function inferredFrequency(client,jobs){
    const explicit=frequency(client?.frequency);if(explicit)return explicit;
    const dates=[...new Set(jobs.map(j=>j.date).filter(valid))].sort();
    const gaps=[];for(let i=1;i<dates.length;i++){const g=diff(dates[i-1],dates[i]);if(g>=5&&g<=40)gaps.push(g);}
    const g=median(gaps.slice(-6));
    if(g>=5&&g<=10)return 'weekly';
    if(g>=11&&g<=20)return 'fortnightly';
    if(g>=21&&g<=40)return 'monthly';
    return '';
  }
  function clientPattern(client){
    const jobs=(state().schedules||[]).filter(j=>isRoutine(j,client)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const usable=jobs.filter(j=>!HIDDEN.has(status(j.status)));
    const recent=usable.slice(-12), template=recent.at(-1)||jobs.at(-1)||null;
    const cadence=inferredFrequency(client,usable.length?usable:jobs);
    // For an ESTABLISHED client, the live diary is the authority for day/team.
    // Older imported client records can contain stale preferred-day/team values;
    // changing those would move real routes. A first manual NEW R placement also
    // becomes the authority here, exactly as the product rule requires.
    const historyDay=mode(recent.map(j=>dayName(j.date)).filter(d=>DAYS.includes(d)));
    const preferredDay=historyDay||(DAYS.includes(String(client.preferredDay||''))?String(client.preferredDay):'');
    const historyTeam=mode(recent.map(j=>String(j.teamId||'')).filter(Boolean));
    const teamId=historyTeam||String(client.preferredTeamId||client.teamId||'');
    // The recurrence anchor must be an ACTUAL occurrence on the recurring day.
    const actual=recent.find(j=>valid(j.date)&&dayName(j.date)===preferredDay)?.date||'';
    const configured=[client.recurrenceAnchorDate,client.serviceStartDate].find(v=>valid(v)&&dayName(v)===preferredDay)||'';
    const anchor=actual||configured||'';
    const existingPlacement=jobs.some(j=>valid(j.date));
    const newR=client.awaitingInitialRecurringPlacementV6036===true&&!existingPlacement;
    return {client,jobs,usable,template,cadence,preferredDay,teamId,anchor,newR,ready:!newR&&!!template&&!!cadence&&DAYS.includes(preferredDay)&&!!teamId&&valid(anchor)};
  }
  function nthWeekday(yearMonth,preferredDay,anchor){
    const [y,m]=yearMonth.split('-').map(Number),idx=dayIndex(preferredDay);if(idx<0)return '';
    const js=idx+1,ord=Math.min(5,Math.ceil(Number(String(anchor).slice(8,10))/7));
    const first=new Date(y,m-1,1,12),offset=(js-first.getDay()+7)%7,last=new Date(y,m,0,12).getDate();
    let day=1+offset+(ord-1)*7;while(day>last)day-=7;
    return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function dueDate(pattern,weekStart){
    if(!pattern.ready)return '';
    const idx=dayIndex(pattern.preferredDay);if(idx<0)return '';
    const target=add(weekStart,idx);if(target<pattern.anchor)return '';
    if(pattern.cadence==='weekly')return target;
    if(pattern.cadence==='fortnightly'){
      const weeks=Math.floor(diff(monday(pattern.anchor),weekStart)/7);
      return weeks>=0&&weeks%2===0?target:'';
    }
    if(pattern.cadence==='monthly')return target===nthWeekday(target.slice(0,7),pattern.preferredDay,pattern.anchor)?target:'';
    return '';
  }
  function recurrenceKey(clientId,weekStart){return `${clientId}:${weekStart}`;}
  function basketBlocks(clientId,weekStart){
    const rows=[...(state().scheduleBasket||[]),...(state().scheduleOverflowQueue||[])];
    return rows.some(item=>{
      const cid=String(item.clientId||item.jobPayload?.clientId||'');if(cid!==String(clientId))return false;
      const m=String(item.workMarker||item.jobPayload?.workMarker||(item.quoteId||item.jobPayload?.quoteId?'O':'R')).toUpperCase();if(m!=='R')return false;
      const d=String(item.originalDate||item.jobPayload?.date||'');const w=String(item.weekStart||item.originalWeekStart||(valid(d)?monday(d):''));
      return w===weekStart;
    });
  }
  function localBlocks(clientId,weekStart){
    const end=add(weekStart,6),client=(state().clients||[]).find(c=>String(c.id)===String(clientId));
    return (state().schedules||[]).some(job=>String(job.clientId)===String(clientId)&&isRoutine(job,client)&&((String(job.recurrenceKey||'')===recurrenceKey(clientId,weekStart))||(valid(job.date)&&job.date>=weekStart&&job.date<=end)||(String(job.movedFromWeekStartV58930||'')===weekStart)));
  }
  function cloudRowRoutine(row){
    const p=row?.payload||{},m=String(p.workMarker||'').toUpperCase();
    if(p.quoteId||m==='O')return false;
    const text=`${p.workKind||''} ${p.revenueType||''}`.toLowerCase();
    return m==='R'||!!p.recurrenceKey||!!p.rollingWeekStartV58929||!!p.initialRecurringPlacementV6036||/recurring|routine/.test(text);
  }
  async function cloudRows(){
    const b=backend();if(String(b.mode||'').toLowerCase()!=='supabase'||!b.client||!b.businessId)return [];
    const {data,error}=await b.client.from('schedule_jobs').select('id,visit_date,client_id,team_id,status,estimated_hours,sort_order,billing_profile_id,payload,updated_at').eq('business_id',b.businessId);
    if(error)throw error;return Array.isArray(data)?data:[];
  }
  function cloudIndex(rows){
    const byKey=new Map(),byWeek=new Map(),byId=new Map();
    for(const row of rows||[]){
      byId.set(String(row.id),row);if(!cloudRowRoutine(row))continue;
      const p=row.payload||{},cid=String(row.client_id||p.clientId||''),date=String(row.visit_date||p.date||'').slice(0,10),key=String(p.recurrenceKey||'');
      if(key&&!byKey.has(key))byKey.set(key,row);
      if(cid&&valid(date)){const wk=recurrenceKey(cid,monday(date));if(!byWeek.has(wk))byWeek.set(wk,row);}
      const moved=String(p.movedFromWeekStartV58930||'');if(cid&&valid(moved)){const wk=recurrenceKey(cid,moved);if(!byWeek.has(wk))byWeek.set(wk,row);}
    }
    return {byKey,byWeek,byId};
  }
  function cloudBlocks(index,clientId,weekStart){const key=recurrenceKey(clientId,weekStart);return index.byKey.has(key)||index.byWeek.has(key);}
  function rowToJob(row){const p=row?.payload||{};return {...p,id:row.id,date:String(row.visit_date||p.date||'').slice(0,10),clientId:row.client_id||p.clientId||'',teamId:row.team_id||p.teamId||'',status:row.status||p.status||'scheduled',billingProfileIdV59396:row.billing_profile_id||p.billingProfileIdV59396||'',estimatedHours:Number(row.estimated_hours??p.estimatedHours??0),sort:Number(row.sort_order||p.sort||99),revenueType:p.revenueType||'Recurring contract'};}
  function visibleStatus(row){return !HIDDEN.has(status(row?.status));}
  function mergeCloudVisible(rows){
    const st=state(),map=new Map((st.schedules||[]).map(j=>[String(j.id),j]));let changed=0;
    for(const row of rows||[]){if(!visibleStatus(row)||!cloudRowRoutine(row))continue;const job=rowToJob(row),id=String(job.id);const before=map.get(id);if(before){Object.assign(before,job);}else{st.schedules.push(job);map.set(id,job);changed++;}}
    return changed;
  }
  function newId(){try{return window.uid('sch');}catch(_){return `sch-${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;}}
  function clientTasks(client,template){
    const explicit=[];
    try{if(typeof window.workTypeLabelsV9==='function')explicit.push(...window.workTypeLabelsV9(client.workTypeIds||[]));}catch(_){ }
    try{if(typeof window.customTaskLinesV9==='function')explicit.push(...window.customTaskLinesV9(client.customTasks||''));}catch(_){String(client.customTasks||'').split(/\n+/).forEach(x=>explicit.push(x));}
    const clean=[...new Set(explicit.map(v=>String(v||'').trim()).filter(Boolean))];
    return clean.length?clean:[...(template?.visitTasks||[])];
  }
  function makeJob(pattern,weekStart,date){
    const c=pattern.client,t=pattern.template||{},now=new Date().toISOString();
    return {...t,id:newId(),date,clientId:c.id,teamId:pattern.teamId,status:'scheduled',sort:Number(t.sort||99),revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',recurrenceKey:recurrenceKey(c.id,weekStart),sourceOccurrenceKey:`rolling:${recurrenceKey(c.id,weekStart)}`,rollingWeekStartV58929:weekStart,rollingGeneratedV58929:true,autoGenerated:true,autoAssigned:true,manualOverride:false,clusterId:c.clusterId||t.clusterId||'',estimatedHours:Number.isFinite(Number(c.estimatedHours))?Number(c.estimatedHours):Number(t.estimatedHours||0),serviceIds:[...(c.serviceIds||t.serviceIds||[])],workTypeIds:[...(c.workTypeIds||t.workTypeIds||[])],customTasks:String(c.customTasks||t.customTasks||''),visitTasks:clientTasks(c,t),billingProfileIdV59396:c.billingProfileIdV59396||t.billingProfileIdV59396||'',createdAt:now,updatedAt:now};
  }
  function cloudPayload(job){return {id:job.id,visit_date:job.date,client_id:job.clientId,team_id:job.teamId,status:'scheduled',estimated_hours:Number.isFinite(Number(job.estimatedHours))?Number(job.estimatedHours):0,sort_order:Number(job.sort||99),billing_profile_id:job.billingProfileIdV59396||null,payload:{...job}};}
  function managementRoute(){const p=new URLSearchParams(location.search);return p.get('support')==='1'&&!!p.get('business');}
  function ready(){
    const b=backend(),st=state();if(document.body?.dataset?.app==='mobile')return false;
    if(!b.businessId||!Array.isArray(st.clients)||!Array.isArray(st.schedules)||!st.clients.length)return false;
    if(b.operationalHydrating||b.operationalSyncing||b.operationalConflict)return false;
    if(managementRoute()&&(!b.managementCoreReadyV5950||!(b.managementOperationalReadyV5950||b.managementOperationalReadyV59371)))return false;
    try{const d=window.operationalDeltaV59394?.();if(d?.hasChanges)return false;}catch(_){if(b.operationalDirty)return false;}
    return true;
  }
  async function latestRevision(){
    const b=backend();if(String(b.mode||'').toLowerCase()!=='supabase')return Number(b.operationalRevision||0);
    const {data,error}=await b.client.from('operational_meta').select('revision').eq('business_id',b.businessId).maybeSingle();if(error)throw error;
    const r=Number(data?.revision??b.operationalRevision??0);b.operationalRevision=r;return r;
  }
  function rpcInfo(){const p=new URLSearchParams(location.search),session=p.get('support')==='1'?String(p.get('session')||''):'';return {name:session?'tuinbooks_management_save_operational_delta_v5968':'tuinbooks_save_operational_delta_v59394',session};}
  function isConflict(error){return /OPERATIONS_CONFLICT|40001|reload_required|expected .* current/i.test([error?.message,error?.details,error?.code].map(String).join(' '));}
  function isDuplicate(error){return /23505|schedule_jobs_recurrence_unique_v53|duplicate key|recurrenceKey/i.test([error?.message,error?.details,error?.hint,error?.code].map(String).join(' '));}
  async function saveBatch(batch){
    if(!batch.length)return {saved:[],revision:Number(backend().operationalRevision||0)};
    const b=backend();if(String(b.mode||'').toLowerCase()!=='supabase')return {saved:batch,revision:Number(b.operationalRevision||0)};
    let pending=[...batch],saved=[];
    for(let attempt=0;attempt<5&&pending.length;attempt++){
      const rows=await cloudRows(),index=cloudIndex(rows);
      pending=pending.filter(job=>!cloudBlocks(index,job.clientId,monday(job.date)));
      if(!pending.length)break;
      const revision=await latestRevision(),rpc=rpcInfo(),payload={p_business_id:b.businessId,p_expected_revision:revision,p_schedules:pending.map(cloudPayload),p_work_records:[],p_opportunities:[],p_quotes:[],p_invoices:[],p_meta:null,p_deleted_schedule_ids:[],p_deleted_quote_ids:[],p_deleted_invoice_ids:[]};
      if(rpc.session)payload.p_session_id=rpc.session;
      const {data,error}=await b.client.rpc(rpc.name,payload);
      if(error){if(isConflict(error)||isDuplicate(error))continue;throw error;}
      if(data?.conflict===true||data?.reload_required===true){b.operationalRevision=Number(data?.current_revision??data?.revision??revision);continue;}
      b.operationalRevision=Number(data?.revision??revision+1);saved=pending;pending=[];
    }
    return {saved,revision:Number(b.operationalRevision||0)};
  }
  async function reconcileAfterSave(){
    // Use TuinBooks' existing targeted cloud refresh so state AND its operational
    // comparison baseline move forward together. This avoids a later safety
    // reload undoing the freshly-created horizon.
    try{
      if(typeof window.incrementalOperationalRefreshV59460==='function'){
        await window.incrementalOperationalRefreshV59460();
        return true;
      }
    }catch(error){console.warn('[TuinBooks v60.5.22] incremental reconcile',error);}
    return false;
  }

  let running=false,timer=null,lastRun=0;
  async function ensure({reason='automatic',showFeedback=false}={}){
    if(running)return window.__tuinbooksRollingV60522?.last||{busy:true};
    if(!ready())return {ready:false};
    running=true;
    try{
      const st=state(),now=today(),first=monday(now),weeks=Array.from({length:8},(_,i)=>add(first,i*7));
      let rows=await cloudRows(),index=cloudIndex(rows);
      const candidates=[];let expected=0,blocked=0,noPattern=0,newR=0;
      for(const client of (st.clients||[]).filter(activeClient)){
        if(/ad\s*hoc|once[- ]?off/i.test(String(client.frequency||'')))continue;
        const p=clientPattern(client);
        if(p.newR){newR++;continue;}
        if(!p.ready){noPattern++;continue;}
        for(const wk of weeks){
          const date=dueDate(p,wk);if(!date||date<now)continue;expected++;
          if(localBlocks(client.id,wk)||basketBlocks(client.id,wk)||cloudBlocks(index,client.id,wk)){blocked++;continue;}
          const job=makeJob(p,wk,date);candidates.push(job);index.byKey.set(job.recurrenceKey,{payload:{recurrenceKey:job.recurrenceKey}});index.byWeek.set(job.recurrenceKey,{payload:{recurrenceKey:job.recurrenceKey}});
        }
      }
      let saved=[];
      // Save in modest batches so a large established business does not hold a
      // single Management revision open for hundreds of rows.
      for(let i=0;i<candidates.length;i+=20){
        const result=await saveBatch(candidates.slice(i,i+20));saved.push(...result.saved);
      }
      // Reconcile through TuinBooks' own targeted cloud refresh.
      if(saved.length)await reconcileAfterSave();
      lastRun=Date.now();
      const result={reason,expected,alreadyPresent:blocked,created:saved.length,noPattern,newR,at:new Date().toISOString()};
      window.__tuinbooksRollingV60522.last=result;
      if(String(window.activeView||'')==='schedule'){try{window.renderSchedule?.();}catch(_){ }}
      if(showFeedback){try{window.toast?.(`Rolling schedule checked: ${saved.length} missing visit${saved.length===1?'':'s'} added.`);}catch(_){ }}
      return result;
    }catch(error){
      const result={reason,error:String(error?.message||error),created:0,at:new Date().toISOString()};window.__tuinbooksRollingV60522.last=result;
      console.error('[TuinBooks v60.5.22] rolling schedule',error);return result;
    }finally{running=false;}
  }
  function refresh(reason='automatic',delay=300){clearTimeout(timer);timer=setTimeout(()=>ensure({reason}),delay);return timer;}
  function installAuthority(){
    try{
      const generate=()=>ensure({reason:'manual',showFeedback:true});
      // schedule-exact-canary-v6035 restores this canonical object after cloud
      // hydration. Point the canonical object at this engine BEFORE DOMContentLoaded
      // so that restoration cannot resurrect a second writer.
      window.__tuinbooksCanonicalRollingV6010={ensure,refresh,generate};
      window.ensureRollingScheduleV58929=ensure;
      window.scheduleRollingRefreshV58929=refresh;
      window.generateRecurringWeek=generate;
    }catch(_){ }
  }
  function waitForReady(){
    installAuthority();let tries=0,started=false;
    const poll=setInterval(()=>{
      tries++;installAuthority();
      if(!started&&ready()){started=true;refresh('workspace-ready',120);}
      // The exact-canary activation poll stops after 30 seconds. Keep the same
      // authority pinned slightly longer, then stop polling entirely.
      if(tries>75)clearInterval(poll);
    },500);
  }
  window.__tuinbooksRollingV60522={build:BUILD,ensure,refresh,clientPattern,dueDate,frequency,cloudIndex,last:null};
  installAuthority();
  window.addEventListener('tuinbooks:runtime-ready',()=>refresh('runtime-ready',120));
  document.addEventListener('click',e=>{if(e.target?.closest?.('.nav-tab[data-view="schedule"]'))refresh('schedule-open',160);},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForReady,{once:true});else waitForReady();
})();
