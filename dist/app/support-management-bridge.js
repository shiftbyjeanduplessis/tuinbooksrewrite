/* TuinBooks v59.3.72 — exact-session bridge with live loading progress.
 *
 * The old bridge called tuinbooks_current_support_context and ignored the
 * business= and session= values in the Management link. That allowed an older
 * or unrelated support context to take over and caused the false:
 * "No active management session was found."
 *
 * This bridge delegates all account opening to app.js's native v59.3.38+
 * exact-session loader:
 *   openManagementWorkspaceV5936(session)
 *
 * That loader verifies:
 *   tuinbooks_management_open_context_v5938(
 *     p_business_id,
 *     p_session_id
 *   )
 *
 * The bridge now only provides:
 *   - deterministic startup;
 *   - tab-resume protection;
 *   - a clear retry screen on a real failure.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('support') !== '1') return;

  if (window.__TUINBOOKS_SUPPORT_ROUTER_59340__) return;
  window.__TUINBOOKS_SUPPORT_ROUTER_59340__ = true;

  const requestedBusiness = params.get('business') || '';
  const requestedSession = params.get('session') || '';

  let openingPromise = null;
  let progressTimer = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const esc = value => String(value ?? '').replace(
    /[&<>'"]/g,
    ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch])
  );

  function exactWorkspaceAlreadyOpen(session = null) {
    const backend = window.backendV28;
    const ctx = backend?.supportContext;
    const userId = session?.user?.id || backend?.user?.id || '';

    return Boolean(
      backend?.businessId &&
      ctx?.business_id &&
      String(backend.businessId) === String(requestedBusiness) &&
      String(ctx.business_id) === String(requestedBusiness) &&
      String(ctx.session_id || '') === String(requestedSession) &&
      backend?.managementOperationalReadyV59371 === true &&
      (
        !userId ||
        !backend?.handlingUserId ||
        String(backend.handlingUserId) === String(userId)
      )
    );
  }

  function resumeExactWorkspace(session = null) {
    if (!exactWorkspaceAlreadyOpen(session)) return false;

    const backend = window.backendV28;
    if (session?.user) {
      backend.session = session;
      backend.user = session.user;
      backend.handlingUserId = session.user.id;
    }

    backend.mode = 'supabase';

    try {
      window.hideBackendGateV28?.();
    } catch (_) {}

    hideOpening();
    return true;
  }

  function showOpening(message = 'Verifying the selected management session…') {
    let host = document.getElementById('tuinbooksSupportOpening59340');

    // Remove the legacy bridge overlay if it was inserted before this file ran.
    document.getElementById('tuinbooksSupportOpening5934')?.remove();

    if (!host) {
      host = document.createElement('div');
      host.id = 'tuinbooksSupportOpening59340';
      host.style.cssText =
        'position:fixed;inset:0;z-index:2147483646;display:grid;' +
        'place-items:center;background:#f4f8f4;font-family:system-ui,sans-serif;' +
        'color:#123c26';

      host.innerHTML =
        '<div style="max-width:520px;padding:28px 32px;border:1px solid #cfe0d2;' +
        'border-radius:18px;background:#fff;box-shadow:0 18px 50px ' +
        'rgba(18,60,38,.14);text-align:center">' +
        '<strong style="display:block;font-size:22px;margin-bottom:8px">' +
        'TuinBooks Management</strong>' +
        '<span id="tuinbooksSupportOpeningText59340"></span></div>';

      document.body.appendChild(host);
    }

    const text = document.getElementById('tuinbooksSupportOpeningText59340');
    if (text) text.textContent = message;
  }

  function hideOpening() {
    if(progressTimer){clearInterval(progressTimer);progressTimer=null;}
    document.getElementById('tuinbooksSupportOpening59340')?.remove();
    document.getElementById('tuinbooksSupportOpening5934')?.remove();
  }

  function showFatal(error) {
    hideOpening();
    console.error('TuinBooks exact-session support routing failed', error);

    const message = error?.message || String(error || 'Unknown management error');

    document.body.innerHTML = `
      <section style="
        max-width:640px;
        margin:12vh auto;
        padding:30px;
        border:1px solid #efc5c0;
        border-radius:18px;
        background:#fff;
        font-family:system-ui,sans-serif;
        text-align:center
      ">
        <h1 style="color:#8f1d16">Client account could not open</h1>
        <p>${esc(message)}</p>
        <p style="color:#52645a">No client data was changed.</p>
        <div style="
          display:flex;
          justify-content:center;
          flex-wrap:wrap;
          gap:10px;
          margin-top:14px
        ">
          <button
            type="button"
            id="retrySupportOpen59340"
            style="
              border:0;
              border-radius:9px;
              background:#157235;
              color:#fff;
              padding:11px 16px;
              font-weight:800;
              cursor:pointer
            "
          >Retry opening</button>
          <a
            href="/management/"
            style="
              display:inline-block;
              border:1px solid #157235;
              border-radius:9px;
              color:#157235;
              padding:10px 16px;
              text-decoration:none;
              font-weight:800
            "
          >Return to Management</a>
        </div>
      </section>
    `;

    document
      .getElementById('retrySupportOpen59340')
      ?.addEventListener('click', () => location.reload(), { once: true });
  }

  function mirrorNativeLoadingProgress() {
    if(progressTimer) return;
    progressTimer=setInterval(()=>{
      const nativeMessage=document.getElementById('backendLoadingMessage')?.textContent?.trim();
      if(nativeMessage)showOpening(nativeMessage);
    },500);
  }

  async function waitForNativeManagementRuntime() {
    // v59.4.6: bounded, low-frequency startup wait. This is UI startup only;
    // it must never create a rapid polling loop while the database is loading.
    for (let i = 0; i < 40; i += 1) {
      if (
        window.backendV28?.client &&
        typeof window.openManagementWorkspaceV5936 === 'function'
      ) {
        return;
      }
      await sleep(250);
    }

    throw new Error(
      'The TuinBooks management runtime did not finish starting. ' +
      'Return to Management and open the account again.'
    );
  }

  async function currentAuthSession(sessionOverride = null) {
    if (sessionOverride?.user) return sessionOverride;

    const result = await window.backendV28.client.auth.getSession();
    if (result?.error) throw result.error;

    const session = result?.data?.session;
    if (!session?.user) {
      throw new Error(
        'Your Management login is not available in this tab. ' +
        'Return to Management and sign in again.'
      );
    }

    return session;
  }

  async function openSelectedWorkspace(sessionOverride = null) {
    if (resumeExactWorkspace(sessionOverride)) {
      return window.backendV28?.supportContext || null;
    }

    if (openingPromise) return openingPromise;

    openingPromise = (async () => {
      if (!requestedBusiness) {
        throw new Error(
          'The Management link is missing the client business ID.'
        );
      }

      if (!requestedSession) {
        throw new Error(
          'The Management link is missing its exact session ID. ' +
          'Return to Management and open the client again.'
        );
      }

      showOpening('Starting the TuinBooks management runtime…');
      await waitForNativeManagementRuntime();

      const session = await currentAuthSession(sessionOverride);

      showOpening('Verifying the exact management session…');

      // app.js owns the authoritative routing. It validates both URL values
      // using tuinbooks_management_open_context_v5938 and then loads the
      // selected tenant workspace.
      const context = await window.openManagementWorkspaceV5936(session);

      if (!context?.business_id) {
        throw new Error(
          'The selected management session could not be verified. ' +
          'Return to Management and open the client again.'
        );
      }

      if (String(context.business_id) !== String(requestedBusiness)) {
        throw new Error(
          'The verified management session belongs to a different client.'
        );
      }

      if (
        context.session_id &&
        String(context.session_id) !== String(requestedSession)
      ) {
        throw new Error(
          'The verified management session does not match this link.'
        );
      }

      hideOpening();
      return context;
    })()
      .catch(error => {
        showFatal(error);
        throw error;
      })
      .finally(() => {
        openingPromise = null;
      });

    return openingPromise;
  }

  function installHandlerOverride() {
    if (typeof window.handleAuthenticatedV28 !== 'function') return false;
    if (window.handleAuthenticatedV28.__support59340) return true;

    const base = window.handleAuthenticatedV28;

    const wrapped = async function(session, force = false) {
      const liveParams = new URLSearchParams(location.search);

      if (liveParams.get('support') !== '1') {
        return base(session, force);
      }

      if (!session?.user) {
        return base(session, force);
      }

      if (resumeExactWorkspace(session)) {
        return window.backendV28?.supportContext || null;
      }

      return openSelectedWorkspace(session);
    };

    wrapped.__support59340 = true;
    window.handleAuthenticatedV28 = wrapped;
    return true;
  }

  function installResumeGuards() {
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      resumeExactWorkspace();
    };

    document.addEventListener('visibilitychange', resume, { passive: true });
    window.addEventListener('pageshow', resume, { passive: true });
    window.addEventListener('focus', resume, { passive: true });
  }

  async function boot() {
    installResumeGuards();
    showOpening();
    mirrorNativeLoadingProgress();

    for (let i = 0; i < 600; i += 1) {
      if (installHandlerOverride()) break;
      await sleep(20);
    }

    try {
      await openSelectedWorkspace();
    } catch (_) {
      // showFatal already rendered the real error.
    }
  }

  window.__TUINBOOKS_SUPPORT_BRIDGE_BUILD__ =
    '59.3.72-native-exact-session-progress';

  boot();
})();
