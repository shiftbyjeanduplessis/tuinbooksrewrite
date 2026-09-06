export function mountWorkspace(root, identity, active, navigation, pageClass) {
    root.innerHTML = `<div class="app-shell"><header class="topbar"><div class="brand"><img src="./tuinbooks-logo.png" alt=""><div><strong>TuinBooks</strong><span>${esc(identity.businessName)}</span></div></div><nav class="main-nav"><button data-nav="schedule">Schedule</button><button data-nav="work">Work</button><button data-nav="clients">Clients</button><button data-nav="quotes">Quotes</button><button data-nav="money">Money</button><button data-nav="business">Business</button></nav><button class="text-button" id="signOut">${identity.demo ? 'Exit demo' : 'Sign out'}</button></header><main id="workspacePage" class="${pageClass}"></main></div>`;
    root.querySelectorAll('[data-nav]').forEach(button => { const page = button.dataset.nav; button.classList.toggle('active', page === active); button.onclick = () => navigation.go(page); });
    root.querySelector('#signOut').onclick = () => void navigation.logout();
    return root.querySelector('#workspacePage');
}
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=chrome.js.map