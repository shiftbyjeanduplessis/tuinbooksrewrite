(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const token=new URLSearchParams(location.search).get('invite')||'';
  let client=null,preview=null,session=null;

  function show(id){['loadingState','errorState','activationState','successState'].forEach(name=>$(name).hidden=name!==id)}
  function fail(message){$('errorMessage').textContent=message||'The invitation could not be opened.';show('errorState')}
  function config(){
    const c=window.TUINBOOKS_SUPABASE_CONFIG||window.TUINBOOKS_CONFIG||window.SUPABASE_CONFIG||{};
    const url=c.url||c.supabaseUrl||c.projectUrl;
    const key=c.key||c.anonKey||c.publishableKey||c.supabaseAnonKey;
    return url&&key?{url,key}:null;
  }
  function first(value){return Array.isArray(value)?value[0]||null:value||null}
  async function waitForSession(){
    const now=await client.auth.getSession();
    if(now.error)throw now.error;
    if(now.data.session)return now.data.session;
    return await new Promise(resolve=>{
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);sub?.data?.subscription?.unsubscribe();resolve(value)};
      const {data:sub}=client.auth.onAuthStateChange((_event,current)=>{if(current)finish(current)});
      const timer=setTimeout(()=>finish(null),4500);
    });
  }
  async function init(){
    try{
      if(!uuid.test(token))return fail('This TuinBooks invitation link is incomplete. Ask for a fresh office invitation.');
      const c=config();
      if(!c||!window.supabase?.createClient)return fail('The secure TuinBooks connection could not load.');
      client=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const result=await client.rpc('tuinbooks_office_invite_preview_v59319',{p_token:token});
      if(result.error)throw result.error;
      preview=first(result.data);
      if(!preview)return fail('This invitation does not exist or is no longer available.');
      if(preview.invite_status==='expired')return fail('This invitation has expired. Ask TuinBooks to resend it.');
      if(preview.invite_status==='revoked')return fail('This invitation was replaced. Use the most recent TuinBooks email.');
      $('businessName').textContent=preview.business_name||'Your business';
      $('inviteEmail').textContent=preview.invite_email||'';
      $('displayName').value=preview.display_name||'';
      session=await waitForSession();
      if(preview.invite_status==='accepted'){
        if(session){show('successState');setTimeout(()=>location.replace('index.html?welcome=1'),700);return;}
        return fail('This invitation has already been used. Sign in from the normal TuinBooks login page.');
      }
      if(!session)return fail('The secure email sign-in did not complete. Open the latest TuinBooks invitation email and tap the button again.');
      const signedEmail=String(session.user?.email||'').toLowerCase();
      if(signedEmail!==String(preview.invite_email||'').toLowerCase()){
        await client.auth.signOut({scope:'local'});
        return fail('This browser is signed in with a different email address. Open the invitation in a private browser window.');
      }
      show('activationState');
    }catch(error){console.error(error);fail(error?.message||'The invitation could not be opened.')}
  }
  async function activate(event){
    event.preventDefault();
    const name=$('displayName').value.trim(),password=$('password').value,confirm=$('passwordConfirm').value;
    $('formMessage').textContent='';
    if(name.length<2){$('formMessage').textContent='Enter your full name.';return}
    if(password.length<8){$('formMessage').textContent='Use a password with at least eight characters.';return}
    if(password!==confirm){$('formMessage').textContent='The passwords do not match.';return}
    const button=$('activateButton'),original=button.textContent;button.disabled=true;button.textContent='Activating…';
    try{
      const update=await client.auth.updateUser({password,data:{display_name:name}});
      if(update.error)throw update.error;
      const accepted=await client.rpc('accept_business_invite',{p_token:token});
      if(accepted.error)throw accepted.error;
      show('successState');
      setTimeout(()=>location.replace('index.html?welcome=1'),900);
    }catch(error){$('formMessage').textContent=error?.message||'The account could not be activated.';button.disabled=false;button.textContent=original}
  }
  $('passwordForm').addEventListener('submit',activate);
  init();
})();
