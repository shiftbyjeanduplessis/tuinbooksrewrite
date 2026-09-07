(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const params = new URLSearchParams(location.search);
  const token = params.get('invite') || '';
  const preflightMode = params.get('preflight') === '1';
  let client = null;
  let preview = null;

  function config() {
    const c = window.TUINBOOKS_SUPABASE_CONFIG || window.TUINBOOKS_CONFIG || window.SUPABASE_CONFIG || {};
    const url = c.url || c.supabaseUrl || c.projectUrl;
    const key = c.key || c.anonKey || c.publishableKey || c.supabaseAnonKey;
    return url && key ? { url, key } : null;
  }

  function first(value) {
    return Array.isArray(value) ? value[0] || null : value || null;
  }

  function show(id) {
    ['loadingState', 'errorState', 'activationState', 'successState'].forEach(name => {
      const el = $(name);
      if (el) el.hidden = name !== id;
    });
  }

  function fail(message, loginBusinessId = '') {
    $('errorMessage').textContent = message || 'The client access link could not be opened.';
    const link = document.querySelector('#errorState a');
    if (link && uuid.test(loginBusinessId)) {
      link.textContent = 'Open TuinBooks login';
      link.href = `client-login.html?business=${encodeURIComponent(loginBusinessId)}`;
    }
    show('errorState');
  }

  function edgeMessage(error) {
    const raw=[error?.message,error?.error_description,error?.details,error?.hint,error?.code].filter(Boolean).join(' ');
    console.error('TuinBooks office access support detail',error);
    if(/network|failed to fetch|timeout|503|service unavailable|schema cache|pgrst/i.test(raw)) return 'TuinBooks is temporarily unavailable. Please try again shortly.';
    if(/invite|token|revoked|expired|not found/i.test(raw)) return 'This access link is no longer available. Ask the office to send a fresh link.';
    if(/supabase|database|rpc|edge function|sql|function .* does not exist/i.test(raw)) return 'The office account could not be opened right now. Please contact the business for help.';
    return raw || 'The office account could not be activated.';
  }

  async function init() {
    try {
      if (!uuid.test(token)) return fail('This TuinBooks client access link is incomplete. Ask for the full link.');
      const c = config();
      if (!c || !window.supabase?.createClient) return fail('The secure TuinBooks connection could not load.');

      client = window.supabase.createClient(c.url, c.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });

      const result = await client.rpc('tuinbooks_office_invite_preview_v59376', { p_token: token });
      if (result.error) throw result.error;
      preview = first(result.data);
      if (!preview) return fail('This client access link does not exist or is no longer available.');

      $('businessName').textContent = preview.business_name || 'Your business';
      $('inviteEmail').textContent = preview.invite_email || '';
      $('displayName').value = preview.display_name || '';

      if (preview.invite_status === 'accepted') {
        return fail('This client access link has already been used. Sign in with the password already created.', preview.business_id);
      }
      if (preview.invite_status === 'revoked') {
        return fail('This client access link was replaced or revoked. Use the newest TuinBooks link.');
      }
      if (preview.invite_status !== 'pending') {
        return fail('This client access link is no longer available.');
      }

      const intro = $('activationIntro');
      if (preflightMode) {
        $('activationTitle').textContent = 'Client access link test passed';
        if (intro) intro.textContent = 'This is the exact page the client will receive. The business and recipient details match. This private test does not activate the account.';
        const form = $('passwordForm');
        if (form) form.hidden = true;
        const note = document.querySelector('.security-note');
        if (note) note.textContent = 'Private test only. Close this tab and return to Management to send the verified link.';
        show('activationState');
        try {
          window.opener?.postMessage({
            type: 'tuinbooks-office-preflight-v59378',
            status: 'pass',
            businessId: preview.business_id,
            email: preview.invite_email,
            token
          }, location.origin);
        } catch (_) {}
        return;
      }
      if (intro) {
        intro.textContent = preview.invite_purpose === 'password_setup'
          ? 'Choose a new password to open the business workspace already prepared for you.'
          : 'Create your password to open the business workspace already prepared for you.';
      }
      show('activationState');
    } catch (error) {
      console.error('Office invitation preview failed', error);
      fail(edgeMessage(error));
    }
  }

  async function activate(event) {
    event.preventDefault();
    const name = $('displayName').value.trim();
    const password = $('password').value;
    const confirm = $('passwordConfirm').value;
    const message = $('formMessage');
    message.textContent = '';

    if (name.length < 2) return void (message.textContent = 'Enter your full name.');
    if (password.length < 8 || password.length > 128) return void (message.textContent = 'Use a password containing 8 to 128 characters.');
    if (password !== confirm) return void (message.textContent = 'The passwords do not match.');

    const button = $('activateButton');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Creating secure office access…';

    try {
      const completed = await client.functions.invoke('complete-office-invitation', {
        body: { invite: token, displayName: name, password }
      });
      if (completed.error) throw completed.error;
      if (!completed.data?.success) throw new Error(completed.data?.error || 'The office account could not be activated.');

      const email = String(completed.data.email || preview?.invite_email || '').trim().toLowerCase();
      const businessId = String(completed.data.businessId || preview?.business_id || '');
      if (!email || !uuid.test(businessId)) throw new Error('The activated business account could not be identified.');

      const current = await client.auth.getSession();
      const currentEmail = String(current.data?.session?.user?.email || '').toLowerCase();
      if (currentEmail && currentEmail !== email) await client.auth.signOut({ scope: 'local' });

      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;

      try {
        const handover = await client.rpc('tuinbooks_complete_office_handover_v59326', { p_business_id: businessId });
        if (handover.error) console.warn('Prepared handover confirmation failed', handover.error);
      } catch (error) {
        console.warn('Prepared handover confirmation failed', error);
      }

      show('successState');
      setTimeout(() => {
        location.replace(`index.html?business=${encodeURIComponent(businessId)}&handover=1&welcome=1`);
      }, 500);
    } catch (error) {
      console.error('Office invitation activation failed', error);
      let text = edgeMessage(error);
      const context = error?.context;
      if (context && typeof context.clone === 'function') {
        try {
          const response = context.clone();
          const payload = await response.json();
          if (payload?.error) text = String(payload.error);
        } catch (_) {}
      }
      message.textContent = text;
      button.disabled = false;
      button.textContent = original;
    }
  }

  $('passwordForm').addEventListener('submit', activate);
  init();
})();
