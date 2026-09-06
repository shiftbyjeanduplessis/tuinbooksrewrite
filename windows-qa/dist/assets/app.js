import { loadAuthContext } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import { renderLogin } from './features/auth/login.js';
import { renderSchedulePage } from './features/schedule/schedulePage.js';
import { renderClientsPage } from './features/clients/clientsPage.js';
import { renderWorkPage } from './features/work/workPage.js';
import { renderMoneyPage } from './features/billing/moneyPage.js';
import { renderBusinessPage } from './features/business/businessPage.js';
const root = document.getElementById('root');
if (!root)
    throw new Error('TuinBooks root element is missing.');
const demo = new URLSearchParams(location.search).get('demo') === '1';
let identity = null, currentPage = 'schedule';
const navigation = { go(page) { if (!['schedule', 'clients', 'work', 'quotes', 'money'].includes(page))
        return; currentPage = page; renderCurrent(); }, async logout() { if (demo) {
        location.href = location.pathname;
        return;
    } await supabase.auth.signOut(); identity = null; await boot(); } };
function renderCurrent() { if (!identity)
    return; if (currentPage === 'clients')
    renderClientsPage(root, identity, navigation);
else if (currentPage === 'work')
    renderWorkPage(root, identity, navigation);
else if (currentPage === 'quotes')
    renderMoneyPage(root, identity, navigation, 'quotes');
else if (currentPage === 'money')
    renderMoneyPage(root, identity, navigation, 'money');
else if (currentPage === 'business')
    void renderBusinessPage(root, identity, navigation);
else
    renderSchedulePage(root, identity, navigation); }
async function boot() {
    if (demo) {
        identity = { businessId: 'demo', userId: 'demo', businessName: 'TuinBooks Demo', demo: true };
        renderCurrent();
        return;
    }
    root.innerHTML = '<main class="boot-screen"><div class="spinner"></div><strong>Opening TuinBooks…</strong></main>';
    try {
        const context = await loadAuthContext();
        if (!context) {
            renderLogin(root, boot);
            return;
        }
        identity = { businessId: context.business.id, userId: context.userId, businessName: context.business.name };
        renderCurrent();
    }
    catch (error) {
        renderLogin(root, boot, error instanceof Error ? error.message : String(error));
    }
}
void boot();
//# sourceMappingURL=app.js.map