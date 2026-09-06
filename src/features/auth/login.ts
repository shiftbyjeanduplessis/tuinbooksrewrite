import { supabase } from '../../lib/supabase.js';

export function renderLogin(root: HTMLElement, onSignedIn: () => Promise<void>, initialError = ''): void {
  root.innerHTML = `
    <main class="login-page">
      <form class="login-card" id="loginForm">
        <img src="./tuinbooks-logo.png" alt="TuinBooks" class="login-logo" />
        <p class="eyebrow">TuinBooks v2</p>
        <h1>Sign in</h1>
        <p class="muted">Same Supabase account. Completely separate calendar frontend.</p>
        <label>Email<input id="loginEmail" type="email" autocomplete="username" required /></label>
        <label>Password<input id="loginPassword" type="password" autocomplete="current-password" required /></label>
        <div id="loginError" class="error-box ${initialError ? '' : 'hidden'}" role="alert"></div>
        <button class="primary-button" id="loginButton">Sign in</button>
      </form>
    </main>`;
  const form = root.querySelector<HTMLFormElement>('#loginForm')!;
  const errorBox = root.querySelector<HTMLElement>('#loginError')!;
  const button = root.querySelector<HTMLButtonElement>('#loginButton')!;
  if (initialError) errorBox.textContent = initialError;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorBox.classList.add('hidden');
    button.disabled = true; button.textContent = 'Signing in…';
    const email = root.querySelector<HTMLInputElement>('#loginEmail')!.value;
    const password = root.querySelector<HTMLInputElement>('#loginPassword')!.value;
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      errorBox.textContent = result.error.message; errorBox.classList.remove('hidden');
      button.disabled = false; button.textContent = 'Sign in'; return;
    }
    try { await onSignedIn(); }
    catch (error) { errorBox.textContent = error instanceof Error ? error.message : String(error); errorBox.classList.remove('hidden'); }
    finally { button.disabled = false; button.textContent = 'Sign in'; }
  });
}
