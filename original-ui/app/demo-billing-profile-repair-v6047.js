/* TuinBooks v60.4.7 — Demo / cloud Billing Profile repair
   Front-end only. No SQL required.

   Fixes the red "browser-only Billing Profile ID" save errors caused when old
   local-preview IDs survive inside nested client/site payloads after the real
   Supabase Billing Profile has loaded.

   This patch deliberately does NOT alter Schedule, Work, recurrence, quote,
   invoice or navigation behaviour. It only normalises current Billing Profile
   references immediately before cloud persistence. Historical document
   snapshots are left untouched. */
(()=>{
  'use strict';
  const BUILD='60.4.7-demo-billing-profile-repair';
  const LOCAL_PROFILE=/^local-profile-/i;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const profileRows=()=>Array.isArray(state?.billingProfilesV59396)?state.billingProfilesV59396:[];
  const cloudRows=()=>profileRows().filter(row=>UUID.test(String(row?.id||'')));
  const cloudProfileById=id=>cloudRows().find(row=>String(row.id)===String(id))||null;
  const defaultCloudProfile=()=>{
    const rows=cloudRows();
    return rows.find(row=>row?.isDefault&&row?.isActive!==false)
      ||rows.find(row=>row?.isActive!==false)
      ||rows[0]
      ||null;
  };
  const isCloudMode=()=>backendV28?.mode==='supabase'&&!!backendV28?.businessId;
  const isProfileKey=key=>/^(?:billingProfileIdV59396|billingProfileId|billing_profile_id)$/i.test(String(key||''));
  const isHistoricalSnapshotKey=key=>/snapshot/i.test(String(key||''));
  const objectClientId=(value,inherited='')=>String(value?.clientId||value?.client_id||value?.customerId||value?.customer_id||inherited||'');

  function clientCloudProfileId(clientId=''){
    if(!clientId)return '';
    try{
      const client=typeof clientById==='function'?clientById(clientId):(state?.clients||[]).find(row=>String(row?.id)===String(clientId));
      const id=String(client?.billingProfileIdV59396||'');
      return cloudProfileById(id)?.id||'';
    }catch(_){return '';}
  }

  function resolvedCloudProfileId(current='',clientId=''){
    const id=String(current||'').trim();
    if(!isCloudMode())return id;
    if(id&&cloudProfileById(id))return id;
    return clientCloudProfileId(clientId)||String(defaultCloudProfile()?.id||'')||id;
  }

  function normaliseCurrentProfileRefs(value,inheritedClientId='',seen=new WeakSet()){
    if(value==null||typeof value!=='object')return false;
    if(seen.has(value))return false;
    seen.add(value);
    let changed=false;
    const contextClientId=objectClientId(value,inheritedClientId);

    if(Array.isArray(value)){
      value.forEach(item=>{if(normaliseCurrentProfileRefs(item,contextClientId,seen))changed=true;});
      return changed;
    }

    for(const [key,item] of Object.entries(value)){
      if(isHistoricalSnapshotKey(key))continue;
      if(isProfileKey(key)){
        const current=String(item||'').trim();
        // Blank references are allowed to be filled by the normal TuinBooks
        // assignment logic. This repair is specifically for stale/invalid IDs.
        if(!current)continue;
        if(!isCloudMode()||cloudProfileById(current))continue;
        const replacement=resolvedCloudProfileId(current,contextClientId);
        if(replacement&&replacement!==current){
          value[key]=replacement;
          changed=true;
        }
        continue;
      }
      if(item&&typeof item==='object'&&normaliseCurrentProfileRefs(item,contextClientId,seen))changed=true;
    }
    return changed;
  }

  function currentProfileViolations(value,path=[],out=[],seen=new WeakSet()){
    if(value==null||typeof value!=='object')return out;
    if(seen.has(value))return out;
    seen.add(value);
    if(Array.isArray(value)){
      value.forEach((item,index)=>currentProfileViolations(item,path.concat(index),out,seen));
      return out;
    }
    for(const [key,item] of Object.entries(value)){
      const next=path.concat(key);
      if(isHistoricalSnapshotKey(key))continue;
      if(isProfileKey(key)&&LOCAL_PROFILE.test(String(item||''))){out.push(next.join('.'));continue;}
      if(item&&typeof item==='object')currentProfileViolations(item,next,out,seen);
    }
    return out;
  }

  function normaliseWorkspaceState(){
    if(!isCloudMode())return false;
    const real=cloudRows();
    if(!real.length)return false;
    // Once real server profiles exist, an old browser-only placeholder is no
    // longer a legitimate member of the profile list.
    if(real.length!==profileRows().length)state.billingProfilesV59396=real;

    let changed=false;
    const collections=[
      state?.clients,state?.serviceAgreements,state?.serviceCommitments,
      state?.schedules,state?.visits,state?.quotes,state?.invoices,
      state?.scheduleBasket,state?.adminLifecycleV56?.payments,
      state?.adminLifecycleV56?.statements,backendV28?.preservedServiceSitesV54
    ];
    collections.forEach(rows=>{if(Array.isArray(rows)&&normaliseCurrentProfileRefs(rows))changed=true;});
    try{if(typeof repairBillingAssignmentsV59420==='function'&&repairBillingAssignmentsV59420())changed=true;}catch(_){ }
    if(changed){try{if(typeof saveLocalBaseV28==='function')saveLocalBaseV28();}catch(_){ }}
    return changed;
  }

  function sanitiseCloudSnapshot(snapshot){
    if(!snapshot||!isCloudMode())return snapshot;
    normaliseWorkspaceState();
    normaliseCurrentProfileRefs(snapshot);
    return snapshot;
  }

  // The existing v59.4.2 repair handled top-level customer/job/document rows,
  // but old IDs can also live inside nested serviceSitesV56/site payload copies.
  // Sanitising the complete current snapshot closes that hole.
  if(typeof makeCoreSnapshotV28==='function'){
    const base=makeCoreSnapshotV28;
    const wrapped=function makeCoreSnapshotV6047(){return sanitiseCloudSnapshot(base());};
    try{makeCoreSnapshotV28=wrapped;}catch(_){ }
    window.makeCoreSnapshotV28=wrapped;
  }
  if(typeof makeOperationalSnapshotV41==='function'){
    const base=makeOperationalSnapshotV41;
    const wrapped=function makeOperationalSnapshotV6047(){return sanitiseCloudSnapshot(base());};
    try{makeOperationalSnapshotV41=wrapped;}catch(_){ }
    window.makeOperationalSnapshotV41=wrapped;
  }

  // Replace the old JSON-string guard. That guard rejected any occurrence of
  // "local-profile-", including harmless historical snapshots. We now repair
  // live references first and only block an actual CURRENT profile field.
  const safeAssert=function assertCloudBillingProfilePayloadV6047(payload,label='cloud save'){
    if(!isCloudMode())return true;
    normaliseWorkspaceState();
    normaliseCurrentProfileRefs(payload);
    const violations=currentProfileViolations(payload||{});
    if(!violations.length)return true;
    const error=new Error('This workspace is still loading its billing setup. Please wait a moment and try again.');
    error.code='BILLING_PROFILE_NOT_READY_V6047';
    error.profilePaths=violations.slice(0,12);
    throw error;
  };
  try{assertCloudBillingProfilePayloadV59658=safeAssert;}catch(_){ }
  window.assertCloudBillingProfilePayloadV59658=safeAssert;

  // Re-run the nested repair as soon as the real server Billing Profiles have
  // loaded. This also repairs stale browser state left by older demo sessions.
  if(typeof loadBillingProfilesV59396==='function'){
    const base=loadBillingProfilesV59396;
    const wrapped=async function loadBillingProfilesV6047(businessId){
      const result=await base(businessId);
      normaliseWorkspaceState();
      return result;
    };
    try{loadBillingProfilesV59396=wrapped;}catch(_){ }
    window.loadBillingProfilesV59396=wrapped;
  }

  const repairSoon=()=>setTimeout(()=>{try{normaliseWorkspaceState();}catch(error){console.warn('Billing Profile repair deferred',error);}},80);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repairSoon,{once:true});else repairSoon();
  window.addEventListener('focus',repairSoon);

  window.__tuinbooksDemoBillingProfileRepair={
    build:BUILD,
    repair:normaliseWorkspaceState,
    sanitise:sanitiseCloudSnapshot,
    violations:currentProfileViolations
  };
})();
