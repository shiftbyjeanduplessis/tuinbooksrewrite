window.__TUINBOOKS_MANAGEMENT_BUILD='59.6.87-management-quiet-start';
(() => {
  'use strict';

  const state = {
    client: null,
    session: null,
    accounts: [],
    trash: [],
    subscription: null,
    currentAccountId: null,
    currentAccount: null,
    sessionMode: 'read_only',
    mfaFactorId: null,
    searchTimer: null,
    createdAccountId: null,
    officeAccess: null,
    deletionStatus: null,
    accountSetup: null,
    accountsPromise: null,
    activityPromise: null,
    lastAccountsLoadedAt: 0,
    lastActivityLoadedAt: 0,
    dataApiCooldownUntil: 0,
    sessionOpenPromise: null
  };

  const $ = id => document.getElementById(id);
  const screens = ['loadingScreen','connectionError','signInScreen','mfaScreen','accessDeniedScreen','managementApp'];

  function setManagementBootStatusV59687(message='Checking secure session…') {
    const text=$('managementBootStatusTextV59687');
    if(text)text.textContent=message;
  }

  function startQuietManagementBootV59687(message='Checking secure session…') {
    document.body.classList.add('management-booting-v59687');
    const app=$('managementApp');
    if(app){app.hidden=false;app.setAttribute('aria-busy','true');}
    const oldLoader=$('loadingScreen');
    if(oldLoader)oldLoader.hidden=true;
    $('managementNav').hidden=true;
    $('signOutButton').hidden=true;
    setManagementBootStatusV59687(message);
  }

  function finishQuietManagementBootV59687() {
    document.body.classList.remove('management-booting-v59687');
    const app=$('managementApp');
    if(app)app.setAttribute('aria-busy','false');
  }

  function showOnly(id) {
    screens.forEach(name => { const el=$(name); if (el) el.hidden=name!==id; });
    $('managementNav').hidden=id!=='managementApp';
    $('signOutButton').hidden=!state.session;
    if(id==='managementApp')finishQuietManagementBootV59687();
    else document.body.classList.remove('management-booting-v59687');
  }

  function esc(value='') {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function fmtDate(value, withTime=true) {
    if (!value) return '—';
    const d=new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-ZA', withTime ? {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'} : {day:'2-digit',month:'short',year:'numeric'});
  }

  function rawErrorTextV5943(error) {
    return [error?.message,error?.error_description,error?.details,error?.hint,error?.code].filter(Boolean).join(' · ') || String(error || '');
  }

  function errorText(error) {
    const raw=rawErrorTextV5943(error);
    console.error('TuinBooks Management support detail',error);
    if (/TUINBOOKS_MANAGEMENT_TIMEOUT|PGRST002|schema cache|503|service unavailable|failed to fetch|gateway|timeout/i.test(raw)) return 'The secure Management data request did not respond. Your sign-in may already be valid; retry the Management connection instead of entering more PINs or changing client data.';
    if (/edge function|supabase|database|rpc|sqlstate|function .* does not exist/i.test(raw)) return 'This action could not be completed. Review the setup in Support details before trying again.';
    if (/token|invite|invitation/i.test(raw)) return 'The client access link could not be verified. Create and test a fresh link before sending it.';
    return raw || 'Something went wrong';
  }

  function dataApiUnavailable(error) {
    const value=[error?.code,error?.message,error?.details,error?.hint].filter(Boolean).join(' ');
    return /PGRST002|schema cache|503|service unavailable|failed to fetch|gateway|timeout/i.test(value);
  }

  function pauseDataApi(error) {
    if (dataApiUnavailable(error)) state.dataApiCooldownUntil=Date.now()+60000;
  }

  function dataApiCoolingDown() {
    return Date.now()<Number(state.dataApiCooldownUntil||0);
  }

  /* v59.6.57 — bounded Management authentication / RPC startup.
     A successful password sign-in must never leave Management sitting on
     "Signing in…" while a following PostgREST request waits forever. */
  const TUINBOOKS_MANAGEMENT_AUTH_V59657='59.6.57-management-auth-bounded';

  function timeoutErrorV59657(label,timeoutMs) {
    const error=new Error(`${label} did not respond within ${Math.round(timeoutMs/1000)} seconds.`);
    error.code='TUINBOOKS_MANAGEMENT_TIMEOUT';
    return error;
  }

  async function boundedPromiseV59657(promise,timeoutMs,label) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutErrorV59657(label,timeoutMs)),timeoutMs);})
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function boundedRpcV59657(name,args={},timeoutMs=12000) {
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    let timer;
    try {
      let request=state.client.rpc(name,args);
      if(controller&&typeof request?.abortSignal==='function') {
        timer=setTimeout(()=>controller.abort(),timeoutMs);
        const result=await request.abortSignal(controller.signal);
        if(result?.error && /abort|aborted/i.test(rawErrorTextV5943(result.error))) {
          return {data:null,error:timeoutErrorV59657(name,timeoutMs)};
        }
        return result;
      }
      return await boundedPromiseV59657(request,timeoutMs,name);
    } catch(error) {
      if(error?.name==='AbortError'||error?.code==='ABORT_ERR') return {data:null,error:timeoutErrorV59657(name,timeoutMs)};
      return {data:null,error};
    } finally {
      clearTimeout(timer);
    }
  }

  async function boundedGetSessionV59657(timeoutMs=10000) {
    return boundedPromiseV59657(state.client.auth.getSession(),timeoutMs,'Secure session restore');
  }

  async function boundedPasswordSignInV59657(credentials,timeoutMs=12000) {
    return boundedPromiseV59657(state.client.auth.signInWithPassword(credentials),timeoutMs,'Password sign-in');
  }

  function toast(message, type='success') {
    const el=document.createElement('div');
    el.className=`toast ${type==='error'?'error':''}`;
    el.textContent=message;
    $('toastRegion').appendChild(el);
    setTimeout(()=>el.remove(),4200);
  }

  function getConfig() {
    const candidates=[
      window.TUINBOOKS_SUPABASE_CONFIG,
      window.TUINBOOKS_CONFIG,
      window.SUPABASE_CONFIG,
      window.supabaseConfig,
      window.__SUPABASE_CONFIG__
    ].filter(Boolean);
    for (const c of candidates) {
      const url=c.url || c.supabaseUrl || c.projectUrl || c.SUPABASE_URL;
      const key=c.key || c.anonKey || c.publishableKey || c.supabasePublishableKey || c.supabaseAnonKey || c.supabaseKey || c.publishable_key || c.SUPABASE_ANON_KEY;
      if (/^https:\/\//i.test(String(url||'')) && String(key||'').length>20) return {url:String(url).replace(/\/$/,''),key:String(key)};
    }
    const url=window.TUINBOOKS_SUPABASE_URL || window.SUPABASE_URL;
    const key=window.TUINBOOKS_SUPABASE_KEY || window.SUPABASE_ANON_KEY || window.SUPABASE_PUBLISHABLE_KEY;
    return /^https:\/\//i.test(String(url||'')) && String(key||'').length>20 ? {url:String(url).replace(/\/$/,''),key:String(key)} : null;
  }

  async function ensureSupabaseLibrary() {
    if (window.supabase?.createClient) return;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
      script.onload=resolve;
      script.onerror=()=>reject(new Error('The Supabase browser library could not be loaded'));
      document.head.appendChild(script);
    });
  }

  async function initialise() {
    startQuietManagementBootV59687('Checking secure session…');
    bindEvents();
    try {
      await ensureSupabaseLibrary();
      const config=getConfig();
      if (!config) throw new Error('The shared /app/supabase-config.js file did not expose a recognised public URL and publishable key. No secret key should be added here.');
      state.client=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      state.client.auth.onAuthStateChange((event,session)=>setTimeout(()=>{
        state.session=session||null;
        if (event==='SIGNED_OUT') showSignedOut();
      },0));
      const {data,error}=await boundedGetSessionV59657();
      if (error) throw error;
      state.session=data.session||null;
      if (!state.session) return showSignedOut();
      await routeAuthenticated();
    } catch (error) {
      $('connectionErrorText').textContent=errorText(error);
      showOnly('connectionError');
    }
  }

  function showSignedOut(message='') {
    state.session=null;
    state.accounts=[];
    $('signedInIdentity').textContent='Not signed in';
    $('signInMessage').textContent=message;
    showOnly('signInScreen');
  }

  async function routeAuthenticated() {
    $('signedInIdentity').textContent=state.session?.user?.email || 'Signed in';
    setManagementBootStatusV59687('Verifying Management access…');
    await enterManagement();
  }

  async function prepareMfa() {
    showOnly('mfaScreen');
    $('mfaMessage').textContent='';
    $('mfaEnrollPanel').hidden=true;
    const {data,error}=await state.client.auth.mfa.listFactors();
    if (error) throw error;
    const verified=(data?.totp||[]).find(f=>f.status==='verified');
    if (verified) {
      state.mfaFactorId=verified.id;
      $('mfaExplanation').textContent='Enter the six-digit code from your authenticator app.';
      return;
    }
    const unverified=(data?.all||[]).find(f=>f.factor_type==='totp' && f.status==='unverified');
    if (unverified) {
      try { await state.client.auth.mfa.unenroll({factorId:unverified.id}); } catch (_) {}
    }
    const enrolled=await state.client.auth.mfa.enroll({factorType:'totp',friendlyName:'TuinBooks Management'});
    if (enrolled.error) throw enrolled.error;
    state.mfaFactorId=enrolled.data.id;
    $('mfaQrCode').src=enrolled.data.totp.qr_code;
    $('mfaSecret').textContent=enrolled.data.totp.secret;
    $('mfaEnrollPanel').hidden=false;
    $('mfaExplanation').textContent='Set up multi-factor authentication before opening client accounts.';
  }

  async function enterManagement() {
    const userId=state.session?.user?.id;
    if(!userId) return showSignedOut('Your secure session ended. Please sign in again.');

    // Pass the UUID explicitly instead of relying on the RPC's default argument.
    // This removes an unnecessary PostgREST function-resolution edge case.
    let result=await boundedRpcV59657('tuinbooks_is_platform_admin_v59',{p_user_id:userId},10000);
    if(result.error && (dataApiUnavailable(result.error)||result.error?.code==='TUINBOOKS_MANAGEMENT_TIMEOUT')) {
      await new Promise(resolve=>setTimeout(resolve,650));
      result=await boundedRpcV59657('tuinbooks_is_platform_admin_v59',{p_user_id:userId},10000);
    }
    if (result.error) throw result.error;
    if (!result.data) return showOnly('accessDeniedScreen');

    $('signInMessage').textContent='';
    showOnly('managementApp');
    await loadAccounts(true);
  }


  async function loadAccounts(force=false) {
    if(state.accountsPromise)return state.accountsPromise;
    if(dataApiCoolingDown()&&!force){
      $('accountsLoading').hidden=true;
      return;
    }
    state.accountsPromise=(async()=>{
      $('accountsLoading').hidden=false;
      $('accountsEmpty').hidden=true;
      const args={
        p_search:$('accountSearch').value.trim(),
        p_status:$('accountStatusFilter').value,
        p_limit:100,
        p_offset:0
      };
      const {data,error}=await boundedRpcV59657('tuinbooks_management_list_accounts_v59675',{p_search:args.p_search,p_stage:args.p_status,p_limit:args.p_limit,p_offset:args.p_offset},15000);
      $('accountsLoading').hidden=true;
      if (error) {
        pauseDataApi(error);
        toast(dataApiUnavailable(error)?'TuinBooks is temporarily busy. Automatic requests are paused for one minute.':errorText(error),'error');
        return;
      }
      state.lastAccountsLoadedAt=Date.now();
      state.accounts=Array.isArray(data)?data:[];
      renderAccounts();
      loadTrashCountV59675();
    })().finally(()=>{state.accountsPromise=null;});
    return state.accountsPromise;
  }


  function randMoneyV59675(value){return `R ${Number(value||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
  function shortProgramAgeV59675(days){
    const n=Math.max(0,Number(days||0));
    if(n<31)return `${n} day${n===1?'':'s'}`;
    const months=Math.floor(n/30.4375);if(months<12)return `${months} month${months===1?'':'s'}`;
    const years=Math.floor(months/12),rem=months%12;return `${years}y${rem?` ${rem}m`:''}`;
  }
  function localDateV59675(){const d=new Date(),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10);}
  function renderAccounts() {
    const rows=state.accounts;
    $('accountCount').textContent=rows[0]?.total_count ?? rows.length;
    $('accountsEmpty').hidden=rows.length!==0;
    $('accountsTableBody').innerHTML=rows.map(row=>{
      const stage=String(row.account_stage||'trial').toLowerCase();
      const stageClass=stage==='paying'?'green':stage==='suspended'?'red':'gold';
      const stageLabel=row.is_demo?'Demo':stage==='paying'?'Paying':stage==='suspended'?'Suspended':'Trial';
      const subscription=stage==='paying'
        ? `<strong>${esc(randMoneyV59675(row.expected_monthly_amount))}/mo</strong><small>${row.paying_since?`Since ${esc(fmtDate(row.paying_since,false))} · ${esc(shortProgramAgeV59675(row.days_on_program))}`:'Paying account'}</small>`
        : `<strong>${esc(stageLabel)}</strong><small>${stage==='trial'?'Not yet converted to paying':'Billing paused'}</small>`;
      const due=row.next_payment_due
        ? `<span class="${String(row.next_payment_due)<localDateV59675()&&stage==='paying'?'payment-overdue':''}">${esc(fmtDate(row.next_payment_due,false))}</span>${String(row.next_payment_due)<localDateV59675()&&stage==='paying'?'<small class="payment-overdue">Overdue</small>':''}`
        : '<span>—</span><small>No payment date</small>';
      const mobileAlert=!!row.mobile_review_required;
      const mobiles=`<strong>${Number(row.active_mobile_users||0)} active</strong><small class="${mobileAlert?'mobile-warning':''}">${mobileAlert?`⚠ Billed for ${Number(row.approved_mobile_users||0)} — review required`:`${Number(row.approved_mobile_users||0)} currently billed`}</small>`;
      return `<tr>
        <td class="business-cell"><strong>${esc(row.business_name||'Unnamed business')}</strong><small>${esc(row.business_id)}</small></td>
        <td class="contact-cell"><strong>${esc(row.contact_name||'—')}</strong><small>${esc(row.contact_email||row.contact_phone||'No contact')}</small></td>
        <td class="account-stage-cell"><span class="chip ${stageClass}">${esc(stageLabel)}</span>${mobileAlert?'<small class="mobile-warning">Subscription review</small>':''}</td>
        <td class="subscription-cell">${subscription}</td>
        <td class="payment-cell">${due}</td>
        <td class="mobile-cell">${mobiles}</td>
        <td>${Number(row.active_teams||0)}</td><td>${Number(row.customer_count||0)}</td>
        <td>${esc(fmtDate(row.last_activity_at))}</td>
        <td><button class="row-action" type="button" data-open-account="${esc(row.business_id)}">Open</button></td>
      </tr>`;
    }).join('');
  }

  async function openAccount(businessId,options={}) {
    state.currentAccountId=businessId;
    state.currentAccount=null;
    state.accountSetup=null;
    $('accountDialogTitle').textContent='Loading account…';
    $('accountDialogMeta').textContent=businessId;
    $('accountDialogLoading').hidden=false;
    $('accountDialogContent').hidden=true;
    $('openReadOnlyButton').disabled=true;
    $('openFullSupportButton').disabled=true;
    $('accountDialog').showModal();
    const [accountResult,notesResult,deletionResult,setupResult,subscriptionResult]=await Promise.all([
      state.client.rpc('tuinbooks_management_get_account_v59',{p_business_id:businessId}),
      state.client.rpc('tuinbooks_management_list_notes_v59',{p_business_id:businessId,p_limit:100}),
      state.client.rpc('tuinbooks_management_trash_status_v59675',{p_business_id:businessId}),
      state.client.rpc('tuinbooks_management_get_setup_v5961',{p_business_id:businessId}),
      state.client.rpc('tuinbooks_management_get_subscription_v59675',{p_business_id:businessId})
    ]);
    if (accountResult.error) {
      $('accountDialogLoading').textContent=errorText(accountResult.error);
      return;
    }
    state.currentAccount=accountResult.data;
    state.officeAccess=null;
    state.deletionStatus=deletionResult.error?null:(Array.isArray(deletionResult.data)?deletionResult.data[0]:deletionResult.data);
    state.accountSetup=setupResult.error?null:(Array.isArray(setupResult.data)?setupResult.data[0]:setupResult.data);
    state.subscription=subscriptionResult.error?null:(Array.isArray(subscriptionResult.data)?subscriptionResult.data[0]:subscriptionResult.data);
    $('accountDialogLoading').hidden=true;
    $('accountDialogContent').hidden=false;
    renderAccount(accountResult.data,notesResult.error?[]:notesResult.data||[]);
    renderManagementSetup(state.accountSetup,setupResult.error);
    renderSubscriptionV59675(state.subscription,subscriptionResult.error);
    renderOfficeAccess(null,null);
    renderDeletionStatus(state.deletionStatus,deletionResult.error);
    if(options.focusSetup){
      requestAnimationFrame(()=>{
        const section=$('managementSetupSection');
        section?.scrollIntoView({behavior:'smooth',block:'start'});
        section?.classList.add('setup-focus-pulse');
        setTimeout(()=>section?.classList.remove('setup-focus-pulse'),1300);
        $('setupBusinessName')?.focus({preventScroll:true});
      });
    }
  }

  function renderAccount(data,notes) {
    const b=data.business||{},counts=data.counts||{},grant=data.grant||null;
    $('accountDialogTitle').textContent=b.name||'Client account';
    $('accountDialogMeta').textContent=[b.email,b.phone,state.subscription?.account_stage?String(state.subscription.account_stage).replace(/^./,c=>c.toUpperCase()):''].filter(Boolean).join(' · ');
    const cards=[
      ['teams','Teams',counts.teams],
      ['customers','Clients',counts.customers],
      ['mobile-users','Mobile users',state.subscription?.active_mobile_users??'—'],
      ['account','Account',state.subscription?.account_stage?String(state.subscription.account_stage).replace(/^./,c=>c.toUpperCase()):'Live']
    ];
    $('accountSummaryCards').innerHTML=cards.map(([key,label,value])=>`<div class="summary-card" data-summary-card="${esc(key)}"><strong>${esc(value??0)}</strong><span>${esc(label)}</span></div>`).join('');
    $('accountMembers').innerHTML='';
    renderNotes(notes);
    $('recentActivityList').innerHTML='';
    if (grant) {
      $('openReadOnlyButton').disabled=!(grant.operational_read||grant.financial_read);
      $('openFullSupportButton').disabled=!(grant.operational_edit||grant.financial_edit);
    } else {
      $('openReadOnlyButton').disabled=false;
      $('openFullSupportButton').disabled=false;
    }
    $('supportGrantSummary').textContent='';
    $('openFullSupportButton').textContent='Open workspace';
  }

  function setupTeamHtmlV5961(team={},index=0){
    const id=String(team.id||'');
    const active=team.active!==false;
    return `<div class="management-setup-team ${active?'':'inactive'}" data-setup-team-id="${esc(id)}">
      <div class="setup-team-number">${index+1}</div>
      <label>Team name<input data-setup-team-field="name" maxlength="120" value="${esc(team.name||'')}" placeholder="Team ${index+1}" required></label>
      <label>Team leader<input data-setup-team-field="leaderName" maxlength="160" value="${esc(team.leader_name||team.leaderName||'')}" placeholder="Optional"></label>
      <label>Planning hours<input data-setup-team-field="capacityHours" type="number" min="1" step="0.5" value="${Number(team.capacity_hours??team.capacityHours??8)||8}"></label>
      <label>Buffer hours<input data-setup-team-field="bufferHours" type="number" min="0" step="0.5" value="${Number(team.buffer_hours??team.bufferHours??1)||0}"></label>
      <label class="setup-team-active"><input data-setup-team-field="active" type="checkbox" ${active?'checked':''}> Active</label>
      <button class="setup-team-remove" type="button" data-remove-setup-team aria-label="${id?'Deactivate':'Remove'} team">×</button>
    </div>`;
  }

  function renderManagementSetupTeamsV5961(teams=[]){
    const host=$('managementSetupTeams');
    if(!host)return;
    const rows=Array.isArray(teams)?teams:[];
    host.innerHTML=(rows.length?rows:[{id:'',name:'Team 1',active:true,capacity_hours:8,buffer_hours:1}]).map(setupTeamHtmlV5961).join('');
  }

  function renderManagementSetup(data,error=null){
    const section=$('managementSetupSection');
    if(!section)return;
    const message=$('managementSetupMessage');
    if(error){
      state.accountSetup=null;

      if(message)message.textContent=`Management setup tools are not installed yet: ${errorText(error)}`;
      $('saveManagementSetupButton').disabled=true;
      $('addSetupTeamButton').disabled=true;
      return;
    }
    const row=data||{};
    const business=row.business||state.currentAccount?.business||{};
    const teams=Array.isArray(row.teams)?row.teams:[];
    state.accountSetup=row;
    $('setupBusinessName').value=business.name||'';
    $('setupBusinessPhone').value=business.phone||'';
    $('setupBusinessEmail').value=business.email||'';
    $('setupBusinessAddress').value=business.address||'';
    const counts=state.currentAccount?.counts||{};
    $('managementSetupOperationalSummary').textContent=`${Number(counts.customers||0)} clients · ${Number(counts.teams||teams.filter(team=>team.active!==false).length)} active teams. Use the operational workspace for the client list and schedule.`;
    renderManagementSetupTeamsV5961(teams);
    if(message)message.textContent='';
    $('saveManagementSetupButton').disabled=false;
    $('addSetupTeamButton').disabled=false;
  }

  function addManagementSetupTeamV5961(){
    const host=$('managementSetupTeams');
    if(!host)return;
    const index=host.querySelectorAll('[data-setup-team-id]').length;
    host.insertAdjacentHTML('beforeend',setupTeamHtmlV5961({id:'',name:`Team ${index+1}`,active:true,capacity_hours:8,buffer_hours:1},index));
    host.lastElementChild?.querySelector('[data-setup-team-field="name"]')?.focus();
  }

  function removeManagementSetupTeamV5961(button){
    const row=button?.closest?.('[data-setup-team-id]');
    if(!row)return;
    const id=row.dataset.setupTeamId||'';
    if(!id){row.remove();return;}
    const active=row.querySelector('[data-setup-team-field="active"]');
    if(active)active.checked=false;
    row.classList.add('inactive');
    button.title='Team will be made inactive when you save';
  }

  function collectManagementSetupTeamsV5961(){
    return [...document.querySelectorAll('#managementSetupTeams [data-setup-team-id]')].map(row=>{
      const field=name=>row.querySelector(`[data-setup-team-field="${name}"]`);
      return {
        id:row.dataset.setupTeamId||'',
        name:String(field('name')?.value||'').trim(),
        leader_name:String(field('leaderName')?.value||'').trim(),
        capacity_hours:Math.max(1,Number(field('capacityHours')?.value||8)),
        buffer_hours:Math.max(0,Number(field('bufferHours')?.value||0)),
        active:!!field('active')?.checked
      };
    }).filter(team=>team.id||team.name);
  }

  async function saveManagementSetupV5961(event){
    event?.preventDefault?.();
    if(!state.currentAccountId)return;
    const name=$('setupBusinessName').value.trim();
    const email=$('setupBusinessEmail').value.trim();
    const teams=collectManagementSetupTeamsV5961();
    if(!name){$('managementSetupMessage').textContent='Enter the business name.';$('setupBusinessName').focus();return;}
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('managementSetupMessage').textContent='Enter a valid business email address.';$('setupBusinessEmail').focus();return;}
    if(!teams.length||teams.some(team=>!team.name)){$('managementSetupMessage').textContent='Every team needs a name.';return;}
    if(!teams.some(team=>team.active)){$('managementSetupMessage').textContent='Keep at least one active team.';return;}
    const button=$('saveManagementSetupButton');
    const original=button.textContent;
    button.disabled=true;button.textContent='Saving…';
    $('managementSetupMessage').textContent='Saving the prepared account…';
    try{
      const {data,error}=await state.client.rpc('tuinbooks_management_save_setup_v5961',{
        p_business_id:state.currentAccountId,
        p_business_name:name,
        p_phone:$('setupBusinessPhone').value.trim(),
        p_email:email,
        p_address:$('setupBusinessAddress').value.trim(),
        p_account_status:state.subscription?.account_stage==='trial'?'trial':'active',
        p_setup_complete:true,
        p_teams:teams
      });
      if(error)throw error;
      const saved=Array.isArray(data)?data[0]:data;
      state.accountSetup=saved;
      if(state.currentAccount?.business&&saved?.business)Object.assign(state.currentAccount.business,saved.business);
      if(state.currentAccount?.counts)state.currentAccount.counts.teams=(saved?.teams||[]).filter(team=>team.active!==false).length;
      renderManagementSetup(saved,null);
      const business=saved?.business||{};
      $('accountDialogTitle').textContent=business.name||state.currentAccount?.business?.name||'Client account';
      $('accountDialogMeta').textContent=[business.email,business.phone,state.subscription?.account_stage?String(state.subscription.account_stage).replace(/^./,c=>c.toUpperCase()):''].filter(Boolean).join(' · ');
      const teamCard=$('accountSummaryCards')?.querySelector('[data-summary-card="teams"] strong');
      if(teamCard)teamCard.textContent=String((saved?.teams||[]).filter(team=>team.active!==false).length);
      await loadAccounts(true);
      $('managementSetupMessage').textContent='Business and teams saved.';
      toast('Business and teams saved');
    }catch(error){
      $('managementSetupMessage').textContent=errorText(error);
    }finally{
      button.disabled=false;button.textContent=original;
    }
  }

  const TUINBOOKS_UNIFIED_ADMIN_ACCESS_V59676='59.6.76-unified-admin-access';

  function adminMembersV59676(){
    return (state.currentAccount?.members||[])
      .filter(row=>row&&row.active!==false&&['owner','admin'].includes(String(row.role||'').toLowerCase()))
      .sort((a,b)=>String(a.role)==='owner'?-1:String(b.role)==='owner'?1:String(a.display_name||a.email||'').localeCompare(String(b.display_name||b.email||'')));
  }

  function officeLoginUrl(){return state.currentAccountId?`https://www.tuinbooks.garden/app/client-login.html?business=${encodeURIComponent(state.currentAccountId)}`:'https://www.tuinbooks.garden/app/client-login.html';}

  function validatedOfficeSetupLink(value){
    const raw=String(value||'').trim();
    let url;
    try{url=new URL(raw);}catch(_){throw new Error('The server returned an invalid admin setup link.');}
    const supabaseHost=/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname);
    const type=String(url.searchParams.get('type')||'').toLowerCase();
    const token=String(url.searchParams.get('token')||url.searchParams.get('token_hash')||'');
    const redirectRaw=url.searchParams.get('redirect_to')||url.searchParams.get('redirectTo')||'';
    let redirect=null;
    try{redirect=redirectRaw?new URL(redirectRaw):null;}catch(_){redirect=null;}
    const redirectOk=redirect&&redirect.protocol==='https:'&&redirect.hostname==='www.tuinbooks.garden'&&redirect.pathname==='/app/office-activate.html'&&redirect.searchParams.get('mode')==='admin'&&String(redirect.searchParams.get('business')||'')===String(state.currentAccountId||'');
    if(url.protocol!=='https:'||!supabaseHost||url.pathname!=='/auth/v1/verify'||!['invite','magiclink','recovery'].includes(type)||token.length<20||!redirectOk){
      throw new Error('The server did not return a valid authenticated TuinBooks admin setup link. Nothing was copied or sent.');
    }
    return url.href;
  }

  async function copyText(value){
    const text=String(value||'').trim();
    if(!text)throw new Error('No link was returned.');
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
    const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const copied=document.execCommand('copy');area.remove();if(!copied)throw new Error('The browser could not copy the link.');
  }

  async function copyOfficeLoginLink(){
    $('officeAccessMessage').textContent='';
    try{await copyText(officeLoginUrl());$('officeAccessMessage').textContent='Login page copied.';toast('Login page copied');}
    catch(error){$('officeAccessMessage').textContent=errorText(error);}
  }

  async function edgeFunctionErrorText(error){
    try{
      const response=error?.context;
      if(response&&typeof response.clone==='function'){
        const copy=response.clone(),type=String(copy.headers?.get?.('content-type')||'');
        if(type.includes('application/json')){const payload=await copy.json();if(payload?.error)return String(payload.error);if(payload?.message)return String(payload.message);}
        else{const text=await copy.text();if(text)return text;}
      }
    }catch(_){ }
    return errorText(error);
  }

  function renderOfficeAccess(){
    const admins=adminMembersV59676();
    const chip=$('officeAccessStatus');
    chip.textContent=`${admins.length} admin${admins.length===1?'':'s'}`;
    chip.className='chip green';
    const detail=$('officeAccessDetail');
    detail.innerHTML=admins.length?admins.map(member=>{
      const role=String(member.role||'admin').toLowerCase();
      const email=String(member.email||'').trim();
      const name=member.display_name||email||'Admin';
      const safeEmail=encodeURIComponent(email),safeName=encodeURIComponent(name);
      return `<div class="admin-access-row"><div class="admin-access-identity"><strong>${esc(name)}</strong><small>${esc(email||'No email')}</small></div><span class="chip ${role==='owner'?'blue':'green'}">${role==='owner'?'Owner':'Admin'}</span>${email?`<div class="admin-access-row-actions"><button class="row-action" type="button" data-admin-copy="${esc(safeEmail)}" data-admin-name="${esc(safeName)}">Copy setup link</button><button class="row-action" type="button" data-admin-send="${esc(safeEmail)}" data-admin-name="${esc(safeName)}">Send setup email</button>${role==='admin'?`<button class="row-action danger-lite" type="button" data-admin-disable="${esc(safeEmail)}" data-admin-name="${esc(safeName)}">Disable</button>`:''}</div>`:''}</div>`;
    }).join(''):'<div class="empty-state compact">No owner or admin access found.</div>';
    detail.querySelectorAll('[data-admin-copy]').forEach(button=>button.addEventListener('click',()=>adminSetupActionV59676({email:decodeURIComponent(button.dataset.adminCopy||''),displayName:decodeURIComponent(button.dataset.adminName||''),send:false})));
    detail.querySelectorAll('[data-admin-send]').forEach(button=>button.addEventListener('click',()=>adminSetupActionV59676({email:decodeURIComponent(button.dataset.adminSend||''),displayName:decodeURIComponent(button.dataset.adminName||''),send:true})));
    detail.querySelectorAll('[data-admin-disable]').forEach(button=>button.addEventListener('click',()=>disableAdminV59676(decodeURIComponent(button.dataset.adminDisable||''),decodeURIComponent(button.dataset.adminName||''))));
    $('copyOfficeLoginButton').hidden=true;
    $('copyPasswordResetLinkButton').hidden=true;
    $('testOfficeInvitationButton').hidden=true;
    $('cancelOfficeInvitationButton').hidden=true;
    $('copyOfficeSetupLinkButton').hidden=false;
    $('sendOfficeInvitationButton').hidden=false;
    $('copyOfficeSetupLinkButton').disabled=false;
    $('sendOfficeInvitationButton').disabled=false;
    $('copyOfficeSetupLinkButton').textContent='Add admin & copy setup link';
    $('sendOfficeInvitationButton').textContent='Add admin & send setup email';
  }

  async function refreshAdminAccessV59676(){
    if(!state.currentAccountId||!state.client)return;
    const {data,error}=await state.client.rpc('tuinbooks_management_get_account_v59',{p_business_id:state.currentAccountId});
    if(error)throw error;
    state.currentAccount=data;
    renderOfficeAccess();
  }

  async function adminSetupActionV59676({email,displayName,send}){
    email=String(email||'').trim().toLowerCase();displayName=String(displayName||'').trim();
    if(!state.currentAccountId||!state.client)return;
    if(displayName.length<2){$('officeAccessMessage').textContent='Enter the admin name.';return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('officeAccessMessage').textContent='Enter a valid admin email address.';return;}
    const button=send?$('sendOfficeInvitationButton'):$('copyOfficeSetupLinkButton');
    const original=button?.textContent||'';
    if(button){button.disabled=true;button.textContent=send?'Creating access…':'Creating secure link…';}
    $('officeAccessMessage').textContent=send?'Creating admin access and submitting the setup email…':'Creating admin access and secure setup link…';
    try{
      const {data,error}=await state.client.functions.invoke('send-office-invitation',{body:{businessId:state.currentAccountId,email,displayName,action:send?'send_admin_invite':'admin_access_link'}});
      if(error)throw error;
      if(!data?.success||!data?.actionLink)throw new Error(data?.error||'The secure admin setup link could not be created.');
      const verified=validatedOfficeSetupLink(data.actionLink);
      await copyText(verified);
      if(send&&data.emailed===true){
        $('officeAccessMessage').textContent=`Admin access is active for ${email}. The setup email was submitted to the email provider and the same secure link is copied to your clipboard for WhatsApp.`;
        toast('Admin added · email submitted · link copied');
      }else if(send){
        $('officeAccessMessage').textContent=`Admin access is active for ${email}. The email could not be submitted${data.emailError?`: ${data.emailError}`:'.'} The secure setup link is copied — send it by WhatsApp.`;
        toast('Admin added · setup link copied','error');
      }else{
        $('officeAccessMessage').textContent=`Admin access is active for ${email}. The secure setup link is copied to your clipboard.`;
        toast('Admin added · setup link copied');
      }
      await refreshAdminAccessV59676();
      $('officeAccessName').value='';$('officeAccessEmail').value='';
      await loadAccounts(true);
    }catch(error){
      $('officeAccessMessage').textContent=await edgeFunctionErrorText(error);
    }finally{
      if(button){button.disabled=false;button.textContent=original;}
      renderOfficeAccess();
    }
  }

  async function disableAdminV59676(email,displayName){
    if(!window.confirm(`Disable TuinBooks admin access for ${email}?`))return;
    $('officeAccessMessage').textContent=`Disabling ${email}…`;
    try{
      const {data,error}=await state.client.functions.invoke('send-office-invitation',{body:{businessId:state.currentAccountId,email,displayName:displayName||email,action:'disable_admin'}});
      if(error)throw error;if(!data?.success)throw new Error(data?.error||'Admin access could not be disabled.');
      await refreshAdminAccessV59676();await loadAccounts(true);$('officeAccessMessage').textContent=`Admin access disabled for ${email}.`;toast('Admin access disabled');
    }catch(error){$('officeAccessMessage').textContent=await edgeFunctionErrorText(error);}
  }

  async function generateOfficeAccessLink(){
    return adminSetupActionV59676({email:$('officeAccessEmail').value,displayName:$('officeAccessName').value,send:false});
  }

  function refreshOfficeInviteAction(){renderOfficeAccess();}
  async function loadOfficeAccess(){return refreshAdminAccessV59676();}
  async function sendOfficeInvitation(){return adminSetupActionV59676({email:$('officeAccessEmail').value,displayName:$('officeAccessName').value,send:true});}
  async function cancelOfficeInvitation(){return;}

  function renderDeletionStatus(row,error=null){
    const detail=$('accountDeletionDetail'),chip=$('accountDeletionStatus'),del=$('deleteAccountButton'),restore=$('restoreAccountButton');
    const deleted=Boolean(row?.trashed);
    if(error){chip.textContent='Unavailable';chip.className='chip red';detail.textContent=errorText(error);del.hidden=false;restore.hidden=true;return;}
    if(deleted){
      chip.textContent='In Trash';chip.className='chip red';
      detail.innerHTML=`<strong>Recoverable for ${Number(row.days_remaining||0)} more day${Number(row.days_remaining||0)===1?'':'s'}</strong><br>Deleted ${esc(fmtDate(row.deleted_at))}. Recovery window ends ${esc(fmtDate(row.delete_after))}.`;
      del.hidden=true;restore.hidden=false;
      $('openReadOnlyButton').disabled=true;$('openFullSupportButton').disabled=true;
      return;
    }
    chip.textContent='Live';chip.className='chip green';detail.textContent='This account is live. Moving it to Trash removes it from the account directory immediately and suspends office/field access for a 30-day recovery window.';del.hidden=false;restore.hidden=true;
  }

  function deleteAccountConfirmationMatches(){
    const expected=String(state.currentAccount?.business?.name||'').trim();
    const actual=String($('deleteAccountConfirmation')?.value||'').trim();
    const matches=Boolean(expected)&&actual===expected;
    const button=$('confirmDeleteAccountButton');
    if(button)button.disabled=!matches;
    if(matches&&$('deleteAccountMessage'))$('deleteAccountMessage').textContent='';
    return matches;
  }

  function openDeleteAccountDialog(){
    if(!state.currentAccountId||state.deletionStatus?.trashed)return;
    const name=state.currentAccount?.business?.name||'Client account';
    $('deleteAccountBusinessName').textContent=name;
    $('deleteAccountConfirmation').value='';
    $('deleteAccountMessage').textContent='';
    $('confirmDeleteAccountButton').disabled=true;
    $('deleteAccountDialog').showModal();
    requestAnimationFrame(()=>$('deleteAccountConfirmation').focus());
  }

  async function scheduleAccountDeletion(event){
    event.preventDefault();
    if(!state.currentAccountId)return;
    if(!deleteAccountConfirmationMatches()){
      $('deleteAccountMessage').textContent='Type the full business name exactly to confirm deletion.';
      return;
    }
    const button=$('confirmDeleteAccountButton');
    const original=button.textContent;
    button.disabled=true;button.textContent='Deleting…';
    $('deleteAccountMessage').textContent='Suspending access and moving the account into 30-day Trash…';
    try{
      const {data,error}=await state.client.rpc('tuinbooks_management_trash_account_v59675',{
        p_business_id:state.currentAccountId,
        p_confirmation:$('deleteAccountConfirmation').value.trim()
      });
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      $('deleteAccountDialog').close();
      $('accountDialog').close();
      $('accountStatusFilter').value='all';
      await loadAccounts();
      toast(`Account moved to Trash. Recoverable until ${fmtDate(row?.delete_after)}.`);
      await loadTrashV59675(true);
    }catch(error){
      $('deleteAccountMessage').textContent=errorText(error);
    }finally{
      button.disabled=false;button.textContent=original;
    }
  }

  async function restoreDeletedAccount(){
    if(!state.currentAccountId)return;
    const button=$('restoreAccountButton');
    const original=button.textContent;
    button.disabled=true;button.textContent='Restoring…';
    try{
      const {error}=await state.client.rpc('tuinbooks_management_restore_account_v59675',{p_business_id:state.currentAccountId});
      if(error)throw error;
      toast('Account restored');
      $('accountDialog').close();
      await Promise.all([loadAccounts(true),loadTrashV59675(true)]);
      switchView('accounts');
    }catch(error){
      toast(errorText(error),'error');
      button.disabled=false;button.textContent=original;
    }
  }

  function renderNotes(notes) {
    $('supportNotesList').innerHTML=notes.length ? notes.map(n=>`<div class="note-row"><strong>${esc(n.admin_name||'TuinBooks Management')}</strong><p>${esc(n.note)}</p><small>${esc(fmtDate(n.created_at))}</small></div>`).join('') : '<div class="empty-state">No internal support notes.</div>';
  }

  function openSessionDialog(mode) {
    if (!state.currentAccount) return;
    state.sessionMode=mode;
    $('sessionDialogTitle').textContent=mode==='full_support'?'Enter Full Support Mode':'Open Read-Only Support';
    $('sessionReason').value='';
    $('sessionNote').value='';
    $('sessionMessage').textContent='';
    const g=state.currentAccount.grant||null;
    const scopes=g
      ? (mode==='full_support'
        ? [g.operational_edit?'Operations edit':'',g.financial_edit?'Financial edit':''].filter(Boolean)
        : [g.operational_read?'Operations read':'',g.financial_read?'Financial read':''].filter(Boolean))
      : (mode==='full_support'
        ? ['Operations edit','Financial edit']
        : ['Operations read','Financial read']);
    $('sessionScopeSummary').innerHTML=`<strong>${esc(state.currentAccount.business?.name||'Client')}</strong><br>${esc(scopes.join(' · ')||'No permitted scope')}<br>Your real management identity remains attached to every audited action.`;
    $('sessionDialog').showModal();
  }

  async function requestManagementSession(args) {
    // v59.6.46: only one start-session RPC may be in flight from this Management tab.
    // This prevents double-clicks / duplicate UI events from racing the database.
    if (state.sessionOpenPromise) return state.sessionOpenPromise;
    state.sessionOpenPromise=(async()=>{
      let result=await state.client.rpc('tuinbooks_management_start_session_v59',args);
      // If an older server function still races once, retry after the competing
      // transaction has had a moment to finish. The v59.6.46 SQL makes the RPC
      // itself serialised/idempotent, so this is only a defensive bridge.
      if (result?.error?.code==='23505') {
        await new Promise(resolve=>setTimeout(resolve,180));
        result=await state.client.rpc('tuinbooks_management_start_session_v59',args);
      }
      return result;
    })();
    try {
      return await state.sessionOpenPromise;
    } finally {
      state.sessionOpenPromise=null;
    }
  }

  async function startSession(event) {
    event.preventDefault();
    const reason=$('sessionReason').value;
    const note=$('sessionNote').value.trim();
    const button=$('startSessionButton');
    button.disabled=true;
    $('sessionMessage').textContent='Starting secure session…';
    const {data,error}=await requestManagementSession({
      p_business_id:state.currentAccountId,
      p_reason:reason,
      p_access_mode:state.sessionMode,
      p_duration_minutes:Number($('sessionDuration').value||60),
      p_client_context:{management_note:note,path:location.pathname,user_agent:navigator.userAgent}
    });
    button.disabled=false;
    if (error) { $('sessionMessage').textContent=errorText(error); return; }
    const row=Array.isArray(data)?data[0]:data;
    if (!row?.session_id) { $('sessionMessage').textContent='The server did not return a support session.'; return; }
    try { sessionStorage.setItem('tuinbooks_management_return','/management/'); } catch (_) {}
    window.location.href=`../app/index.html?support=1&business=${encodeURIComponent(state.currentAccountId)}&session=${encodeURIComponent(row.session_id)}&v=59.3.19&cb=${Date.now()}`;
  }


  async function openAccountDirectly(mode='full_support') {
    if (!state.currentAccount || !state.currentAccountId) return;
    const button=mode==='full_support' ? $('openFullSupportButton') : $('openReadOnlyButton');
    const original=button.textContent;
    button.disabled=true;
    button.textContent='Opening…';
    const business=state.currentAccount.business||{};
    const reason=business.account_status==='setup' ? 'Account setup' : 'Client support';
    const note=business.account_status==='setup'
      ? 'Platform manager opened the operational workspace to load clients, schedule and setup data.'
      : 'Platform manager opened the account for direct support.';
    const {data,error}=await requestManagementSession({
      p_business_id:state.currentAccountId,
      p_reason:reason,
      p_access_mode:mode,
      p_duration_minutes:480,
      p_client_context:{management_note:note,path:location.pathname,user_agent:navigator.userAgent,direct_open:true}
    });
    if (error) {
      button.disabled=false;
      button.textContent=original;
      toast(errorText(error),'error');
      return;
    }
    const row=Array.isArray(data)?data[0]:data;
    if (!row?.session_id) {
      button.disabled=false;
      button.textContent=original;
      toast('The client account could not be opened. Return to Accounts and try again.','error');
      return;
    }
    try { sessionStorage.setItem('tuinbooks_management_return','/management/'); } catch (_) {}
    window.location.href=`../app/index.html?support=1&business=${encodeURIComponent(state.currentAccountId)}&session=${encodeURIComponent(row.session_id)}&v=59.3.19&cb=${Date.now()}`;
  }


  function openCreateAccountDialog() {
    const form=$('createAccountForm');
    form.reset();
    $('newTeamName').value='Team 1';
    $('newAccountStatus').value='trial';
    $('createAccountMessage').textContent='';
    $('createAccountDialog').showModal();
    requestAnimationFrame(()=>$('newBusinessName').focus());
  }

  async function createAccount(event) {
    event.preventDefault();
    const button=$('saveNewAccountButton');
    const original=button.textContent;
    button.disabled=true;
    button.textContent='Creating…';
    $('createAccountMessage').textContent='Creating the business workspace…';
    try {
      const start=$('newTrialStart').value||null;
      const end=$('newTrialEnd').value||null;
      if (start && end && end<start) throw new Error('Trial end date cannot be before the start date.');
      const {data,error}=await state.client.rpc('tuinbooks_management_create_account_v592',{
        p_business_name:$('newBusinessName').value.trim(),
        p_contact_name:$('newContactName').value.trim(),
        p_office_email:$('newOfficeEmail').value.trim(),
        p_phone:$('newPhone').value.trim(),
        p_account_status:$('newAccountStatus').value,
        p_team_name:$('newTeamName').value.trim(),
        p_trial_start:start,
        p_trial_end:end
      });
      if (error) throw error;
      const row=Array.isArray(data)?data[0]:data;
      if (!row?.business_id) throw new Error('The server did not return the new account details.');
      state.createdAccountId=row.business_id;
      $('createAccountDialog').close();
      $('createdAccountBusiness').textContent=row.business_name||$('newBusinessName').value.trim();
      $('createdAccountMeta').textContent=[row.office_email,row.account_status,row.team_name].filter(Boolean).join(' · ');
      $('createdAccountDialog').showModal();
      await loadAccounts();
      toast('Client account created');
    } catch (error) {
      $('createAccountMessage').textContent=errorText(error);
    } finally {
      button.disabled=false;
      button.textContent=original;
    }
  }

  async function loadActivity(force=false) {
    if(state.activityPromise)return state.activityPromise;
    if(dataApiCoolingDown()&&!force)return;
    state.activityPromise=(async()=>{
      $('activityLoading').hidden=false;
      const {data,error}=await state.client.rpc('tuinbooks_management_support_activity_v59',{p_limit:100,p_business_id:null});
      $('activityLoading').hidden=true;
      if (error) {
        pauseDataApi(error);
        toast(dataApiUnavailable(error)?'TuinBooks is temporarily busy. Activity loading is paused for one minute.':errorText(error),'error');
        return;
      }
      state.lastActivityLoadedAt=Date.now();
      const rows=Array.isArray(data)?data:[];
      $('activityEmpty').hidden=rows.length!==0;
      $('activityTableBody').innerHTML=rows.map(row=>{
        const access=row.operational_edit||row.financial_edit?'Full support':'Read-only';
        const until=row.ended_at?fmtDate(row.ended_at):fmtDate(row.expires_at);
        return `<tr><td><strong>${esc(row.business_name)}</strong></td><td>${esc(row.support_name||row.support_user_id)}</td><td>${esc(row.reason)}</td><td><span class="chip ${access==='Full support'?'gold':'blue'}">${esc(access)}</span></td><td>${esc(fmtDate(row.started_at))}</td><td>${esc(until)}</td><td><span class="chip ${row.status==='active'?'green':''}">${esc(row.status)}</span></td><td>${Number(row.activity_count||0)}</td></tr>`;
      }).join('');
    })().finally(()=>{state.activityPromise=null;});
    return state.activityPromise;
  }

  async function addNote(event) {
    event.preventDefault();
    const note=$('supportNoteText').value.trim();
    if (!note || !state.currentAccountId) return;
    $('supportNoteMessage').textContent='Saving note…';
    const {error}=await state.client.rpc('tuinbooks_management_add_note_v59',{p_business_id:state.currentAccountId,p_note:note});
    if (error) { $('supportNoteMessage').textContent=errorText(error); return; }
    $('supportNoteText').value='';
    $('supportNoteMessage').textContent='';
    const result=await state.client.rpc('tuinbooks_management_list_notes_v59',{p_business_id:state.currentAccountId,p_limit:100});
    renderNotes(result.error?[]:result.data||[]);
    toast('Support note added');
  }

  async function signOut() {
    if (!state.client) return showSignedOut();
    try {
      const ctx=await state.client.rpc('tuinbooks_current_support_context');
      const row=Array.isArray(ctx.data)?ctx.data[0]:ctx.data;
      if (row?.session_id) await state.client.rpc('tuinbooks_end_support_session',{p_session_id:row.session_id});
    } catch (_) {}
    await state.client.auth.signOut();
    showSignedOut('Signed out.');
  }

  function switchView(view) {
    document.querySelectorAll('.nav-button').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`${view}View`));
    if(view==='activity'){
      $('viewTitle').textContent='Support activity';$('viewSubtitle').textContent='Audited client support sessions across TuinBooks.';
      if(Date.now()-Number(state.lastActivityLoadedAt||0)>300000)loadActivity();
    }else if(view==='trash'){
      $('viewTitle').textContent='Trash';$('viewSubtitle').textContent='Deleted accounts remain recoverable for 30 days.';loadTrashV59675();
    }else{
      $('viewTitle').textContent='Client accounts';$('viewSubtitle').textContent='Trials, paying customers, subscriptions and mobile-user alerts.';
    }
  }

  async function retryManagementConnectionV59657() {
    const button=$('retryManagementConnectionButton');
    if(button){button.disabled=true;button.textContent='Retrying…';}
    startQuietManagementBootV59687('Retrying secure connection…');
    try {
      if(!state.session) {
        const {data,error}=await boundedGetSessionV59657();
        if(error)throw error;
        state.session=data.session||null;
      }
      if(!state.session)return showSignedOut('Please sign in again.');
      await routeAuthenticated();
    } catch(error) {
      $('connectionErrorText').textContent=errorText(error);
      showOnly('connectionError');
    } finally {
      if(button){button.disabled=false;button.textContent='Retry management connection';}
    }
  }

  function bindEvents() {
    $('signInForm').addEventListener('submit',async event=>{
      event.preventDefault();
      const submit=event.currentTarget.querySelector('button[type="submit"]');
      if(submit)submit.disabled=true;
      $('signInMessage').textContent='Signing in…';
      try {
        const {data,error}=await boundedPasswordSignInV59657({email:$('signInEmail').value.trim(),password:$('signInPassword').value});
        if (error) { $('signInMessage').textContent=errorText(error); return; }
        state.session=data.session;
        $('signInPassword').value='';
        $('signInMessage').textContent='Signed in. Opening Management…';
        await routeAuthenticated();
      } catch(error) {
        $('connectionErrorText').textContent=errorText(error);
        showOnly('connectionError');
      } finally {
        if(submit)submit.disabled=false;
      }
    });
    $('retryManagementConnectionButton')?.addEventListener('click',retryManagementConnectionV59657);
    $('signOutButton').addEventListener('click',signOut);
    $('deniedSignOutButton').addEventListener('click',signOut);
    $('createAccountButton').addEventListener('click',openCreateAccountDialog);
    $('createAccountForm').addEventListener('submit',createAccount);
    $('sendOfficeInvitationButton').addEventListener('click',sendOfficeInvitation);
    $('copyOfficeLoginButton').addEventListener('click',copyOfficeLoginLink);
    $('copyOfficeSetupLinkButton').addEventListener('click',generateOfficeAccessLink);
    $('copyPasswordResetLinkButton').addEventListener('click',generateOfficeAccessLink);
    $('cancelOfficeInvitationButton').addEventListener('click',cancelOfficeInvitation);
    $('officeAccessEmail').addEventListener('input',()=>{$('officeAccessMessage').textContent='';});
    $('officeAccessName').addEventListener('input',()=>{$('officeAccessMessage').textContent='';});
    $('deleteAccountButton').addEventListener('click',openDeleteAccountDialog);
    $('deleteAccountConfirmation').addEventListener('input',deleteAccountConfirmationMatches);
    $('deleteAccountForm').addEventListener('submit',scheduleAccountDeletion);
    $('restoreAccountButton').addEventListener('click',restoreDeletedAccount);
    $('openCreatedAccountButton').addEventListener('click',()=>{if(!state.createdAccountId)return;$('createdAccountDialog').close();openAccount(state.createdAccountId,{focusSetup:true});});
    $('refreshButton').addEventListener('click',()=>document.getElementById('activityView')?.classList.contains('active')?loadActivity(true):loadAccounts(true));
    $('accountSearch').addEventListener('input',()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>loadAccounts(false),700);});
    $('accountStatusFilter').addEventListener('change',()=>loadAccounts(true));
    $('trashSearch')?.addEventListener('input',()=>{clearTimeout(state.trashSearchTimer);state.trashSearchTimer=setTimeout(()=>loadTrashV59675(true),500);});
    $('subscriptionForm')?.addEventListener('submit',saveSubscriptionV59675);
    $('subscriptionStage')?.addEventListener('change',syncSubscriptionFormV59675);
    $('subscriptionBaseAmount')?.addEventListener('input',updateSubscriptionPreviewV59675);
    $('subscriptionIncludedMobiles')?.addEventListener('input',updateSubscriptionPreviewV59675);
    $('subscriptionExtraMobileRate')?.addEventListener('input',updateSubscriptionPreviewV59675);
    $('convertPayingButton')?.addEventListener('click',convertToPayingV59675);
    $('applyMobileChargeButton')?.addEventListener('click',applyMobileChargeV59675);
    $('recordSubscriptionPaymentButton')?.addEventListener('click',recordSubscriptionPaymentV59675);
    $('managementSetupForm').addEventListener('submit',saveManagementSetupV5961);
    $('addSetupTeamButton').addEventListener('click',addManagementSetupTeamV5961);
    $('managementSetupTeams').addEventListener('click',event=>{const button=event.target.closest('[data-remove-setup-team]');if(button)removeManagementSetupTeamV5961(button);});
    $('managementSetupTeams').addEventListener('change',event=>{if(event.target.matches('[data-setup-team-field="active"]'))event.target.closest('[data-setup-team-id]')?.classList.toggle('inactive',!event.target.checked);});
    $('openSetupWorkspaceButton').addEventListener('click',()=>openAccountDirectly('full_support'));
    $('accountsTableBody').addEventListener('click',event=>{const btn=event.target.closest('[data-open-account]');if(btn)openAccount(btn.dataset.openAccount);});
    $('trashTableBody')?.addEventListener('click',event=>{const btn=event.target.closest('[data-open-trash-account]');if(btn)openAccount(btn.dataset.openTrashAccount);});
    $('supportNoteForm').addEventListener('submit',addNote);
    $('openReadOnlyButton').addEventListener('click',()=>openAccountDirectly('read_only'));
    $('openFullSupportButton').addEventListener('click',()=>openAccountDirectly('full_support'));
    $('sessionForm').addEventListener('submit',startSession);
    document.addEventListener('click',event=>{
      const closer=event.target.closest('[data-close-dialog]');
      if (closer) $(closer.dataset.closeDialog)?.close();
      const nav=event.target.closest('[data-view]');
      if (nav) switchView(nav.dataset.view);
    });
  }



  /* =========================================================
     v59.6.75 — subscriptions, mobile-user billing alerts, 30-day Trash
     ========================================================= */
  async function loadTrashCountV59675(){
    if(!state.client)return;
    const {data,error}=await state.client.rpc('tuinbooks_management_list_trash_v59675',{p_search:'',p_limit:500,p_offset:0});
    if(error)return;
    const rows=Array.isArray(data)?data:[],count=Number(rows[0]?.total_count??rows.length),badge=$('trashCountBadge');
    if(badge){badge.textContent=String(count);badge.hidden=count===0;}
  }
  async function loadTrashV59675(force=false){
    if(!state.client)return;
    $('trashLoading').hidden=false;$('trashEmpty').hidden=true;
    const {data,error}=await state.client.rpc('tuinbooks_management_list_trash_v59675',{p_search:$('trashSearch')?.value?.trim()||'',p_limit:100,p_offset:0});
    $('trashLoading').hidden=true;
    if(error){toast(errorText(error),'error');return;}
    state.trash=Array.isArray(data)?data:[];
    const count=Number(state.trash[0]?.total_count??state.trash.length);$('trashCount').textContent=String(count);$('trashEmpty').hidden=state.trash.length!==0;
    $('trashTableBody').innerHTML=state.trash.map(row=>`<tr><td class="business-cell"><strong>${esc(row.business_name||'Unnamed business')}</strong><small>${esc(row.business_id)}</small></td><td>${esc(row.contact_email||'—')}</td><td>${esc(fmtDate(row.deleted_at))}</td><td><strong class="${Number(row.days_remaining||0)<=0?'trash-expired':''}">${Number(row.days_remaining||0)} day${Number(row.days_remaining||0)===1?'':'s'}</strong><small>${esc(fmtDate(row.delete_after))}</small></td><td><button class="row-action" type="button" data-open-trash-account="${esc(row.business_id)}">Review / restore</button></td></tr>`).join('');
    loadTrashCountV59675();
  }
  function subscriptionStageLabelV59675(stage){return stage==='paying'?'Paying':stage==='suspended'?'Suspended':'Trial';}
  function updateSubscriptionPreviewV59675(){
    const s=state.subscription||{},included=Math.max(0,Number($('subscriptionIncludedMobiles')?.value||0)),rate=Math.max(0,Number($('subscriptionExtraMobileRate')?.value||0)),base=Math.max(0,Number($('subscriptionBaseAmount')?.value||0));
    const approved=Math.max(Number(s.approved_mobile_users??included),included);$('subscriptionMonthlyTotal').textContent=randMoneyV59675(base+Math.max(approved-included,0)*rate);
  }
  function syncSubscriptionFormV59675(){
    const stage=$('subscriptionStage').value,paying=stage==='paying';
    ['subscriptionPayingSince','subscriptionBaseAmount','subscriptionIncludedMobiles','subscriptionExtraMobileRate','subscriptionNextDue'].forEach(id=>{$(id).disabled=!paying;});
    $('subscriptionPaymentPanel').hidden=!paying;
    $('convertPayingButton').hidden=paying;
    updateSubscriptionPreviewV59675();
  }
  function renderSubscriptionV59675(row,error=null){
    const msg=$('subscriptionMessage');if(error||!row){if(msg)msg.textContent=error?errorText(error):'Subscription details are unavailable.';return;}
    state.subscription=row;const stage=String(row.account_stage||'trial'),chip=$('subscriptionStageChip');chip.textContent=subscriptionStageLabelV59675(stage);chip.className=`chip ${stage==='paying'?'green':stage==='suspended'?'red':'gold'}`;
    $('subscriptionStage').value=stage;$('subscriptionPayingSince').value=String(row.paying_since||'').slice(0,10);$('subscriptionBaseAmount').value=Number(row.base_monthly_amount||0).toFixed(2);$('subscriptionIncludedMobiles').value=Number(row.included_mobile_users??1);$('subscriptionExtraMobileRate').value=Number(row.additional_mobile_user_rate||0).toFixed(2);$('subscriptionNextDue').value=String(row.next_payment_due||'').slice(0,10);$('subscriptionNotes').value=row.notes||'';
    $('subscriptionMonthlyTotal').textContent=randMoneyV59675(row.expected_monthly_amount);$('subscriptionActiveMobiles').textContent=String(Number(row.active_mobile_users||0));$('subscriptionApprovedMobiles').textContent=String(Number(row.approved_mobile_users||0));$('subscriptionAge').textContent=stage==='paying'?shortProgramAgeV59675(row.days_on_program):subscriptionStageLabelV59675(stage);
    const alert=$('subscriptionAlert'),apply=$('applyMobileChargeButton');
    if(row.mobile_review_required){const extras=Number(row.unapproved_mobile_users||0);alert.hidden=false;alert.innerHTML=`<strong>⚠ Additional mobile user${extras===1?'':'s'} detected</strong>${Number(row.active_mobile_users||0)} active mobile users are now connected, but the subscription is currently billed for ${Number(row.approved_mobile_users||0)}. Applying the charge will add ${extras} × ${esc(randMoneyV59675(row.additional_mobile_user_rate))}/month.`;apply.hidden=false;}else{alert.hidden=true;alert.textContent='';apply.hidden=true;}
    const last=row.last_payment;$('lastSubscriptionPayment').textContent=last?.paid_on?`Last payment ${randMoneyV59675(last.amount)} on ${fmtDate(last.paid_on,false)}.`:'No payment recorded yet.';
    $('subscriptionPaymentAmount').value=Number(row.expected_monthly_amount||0).toFixed(2);$('subscriptionPaymentDate').value=localDateV59675();
    if(row.payment_overdue){alert.hidden=false;alert.innerHTML=(alert.innerHTML?alert.innerHTML+'<br>':'')+`<strong>Payment overdue</strong>${Number(row.days_overdue||0)} day${Number(row.days_overdue||0)===1?'':'s'} overdue. Payment was due ${esc(fmtDate(row.next_payment_due,false))}.`;}
    if(msg)msg.textContent='';syncSubscriptionFormV59675();
    const mobileCard=$('accountSummaryCards')?.querySelector('[data-summary-card="mobile-users"] strong');if(mobileCard)mobileCard.textContent=String(Number(row.active_mobile_users||0));
    const b=state.currentAccount?.business||{};$('accountDialogMeta').textContent=[b.email,b.phone,subscriptionStageLabelV59675(stage)].filter(Boolean).join(' · ');
  }
  function convertToPayingV59675(){
    $('subscriptionStage').value='paying';if(!$('subscriptionPayingSince').value)$('subscriptionPayingSince').value=localDateV59675();if(!$('subscriptionNextDue').value)$('subscriptionNextDue').value=localDateV59675();syncSubscriptionFormV59675();$('subscriptionBaseAmount').focus();
  }
  async function saveSubscriptionV59675(event){
    event?.preventDefault?.();if(!state.currentAccountId)return;const stage=$('subscriptionStage').value,button=$('saveSubscriptionButton'),original=button.textContent;button.disabled=true;button.textContent='Saving…';$('subscriptionMessage').textContent='Saving subscription…';
    try{const included=Math.max(0,Number($('subscriptionIncludedMobiles').value||0)),approved=Math.max(Number(state.subscription?.approved_mobile_users??included),included);const {data,error}=await state.client.rpc('tuinbooks_management_save_subscription_v59675',{p_business_id:state.currentAccountId,p_account_stage:stage,p_paying_since:$('subscriptionPayingSince').value||null,p_base_monthly_amount:Number($('subscriptionBaseAmount').value||0),p_included_mobile_users:included,p_additional_mobile_user_rate:Number($('subscriptionExtraMobileRate').value||0),p_approved_mobile_users:approved,p_next_payment_due:$('subscriptionNextDue').value||null,p_notes:$('subscriptionNotes').value.trim()});if(error)throw error;renderSubscriptionV59675(Array.isArray(data)?data[0]:data);await loadAccounts(true);toast(stage==='paying'?'Paying subscription saved':'Account status saved');}
    catch(error){$('subscriptionMessage').textContent=errorText(error);}finally{button.disabled=false;button.textContent=original;}
  }
  async function applyMobileChargeV59675(){
    if(!state.currentAccountId||!state.subscription?.mobile_review_required)return;const extras=Number(state.subscription.unapproved_mobile_users||0),newTotal=Number(state.subscription.expected_monthly_amount||0)+extras*Number(state.subscription.additional_mobile_user_rate||0);if(!window.confirm(`Apply ${extras} additional mobile user${extras===1?'':'s'} to this subscription? The new monthly amount will be ${randMoneyV59675(newTotal)}.`))return;
    const button=$('applyMobileChargeButton'),original=button.textContent;button.disabled=true;button.textContent='Applying…';try{const {data,error}=await state.client.rpc('tuinbooks_management_apply_mobile_count_v59675',{p_business_id:state.currentAccountId});if(error)throw error;renderSubscriptionV59675(Array.isArray(data)?data[0]:data);await loadAccounts(true);toast('Additional mobile charge applied');}catch(error){toast(errorText(error),'error');}finally{button.disabled=false;button.textContent=original;}
  }
  async function recordSubscriptionPaymentV59675(){
    if(!state.currentAccountId)return;const button=$('recordSubscriptionPaymentButton'),original=button.textContent,amount=Number($('subscriptionPaymentAmount').value||0),date=$('subscriptionPaymentDate').value||localDateV59675();if(amount<0)return toast('Enter a valid payment amount.','error');if(!window.confirm(`Record subscription payment of ${randMoneyV59675(amount)} on ${fmtDate(date,false)}?`))return;button.disabled=true;button.textContent='Recording…';try{const {data,error}=await state.client.rpc('tuinbooks_management_record_subscription_payment_v59675',{p_business_id:state.currentAccountId,p_amount:amount,p_paid_on:date,p_note:''});if(error)throw error;renderSubscriptionV59675(Array.isArray(data)?data[0]:data);await loadAccounts(true);toast('Subscription payment recorded');}catch(error){toast(errorText(error),'error');}finally{button.disabled=false;button.textContent=original;}
  }

  document.addEventListener('DOMContentLoaded',initialise,{once:true});

  window.__tuinbooksAdminAccessBuild=TUINBOOKS_UNIFIED_ADMIN_ACCESS_V59676;

  window.__tuinbooksFreeTierManagementBuild='59.3.83-free-tier-stability';
  window.__tuinbooksManagementNativeSetupBuild='59.6.1-management-native-setup';
  window.__tuinbooksManagementAuthBuild=TUINBOOKS_MANAGEMENT_AUTH_V59657;
  window.__tuinbooksManagementAdminRepair='59.6.76';

  window.__tuinbooksManagementQuietStartV59687={
    build:'59.6.87-management-quiet-start',
    booting:()=>document.body.classList.contains('management-booting-v59687'),
    oldLoadingVisible:()=>!$('loadingScreen')?.hidden
  };

})();