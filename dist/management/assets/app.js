import { loadAuthContext, loadSupportAuthContext } from './lib/auth.js';
import { supabase } from './lib/supabase.js';
import { renderLogin } from './features/auth/login.js';
import { renderSchedulePage } from './features/schedule/schedulePage.js';
import { renderClientsPage } from './features/clients/clientsPage.js';
import { renderWorkPage } from './features/work/workPage.js';
import { renderMoneyPage } from './features/billing/moneyPage.js';
import { renderBusinessPage } from './features/business/businessPage.js';
import { renderBusinessOverviewPage } from './features/business/businessOverviewPage.js';
const root = document.getElementById('root');
if (!root)
    throw new Error('TuinBooks root element is missing.');
const params = new URLSearchParams(location.search), demo = params.get('demo') === '1', supportBusiness = params.get('support') ?? '';
let identity = null, currentPage = 'schedule';
const navigation = { go(page) { if (!['schedule', 'clients', 'work', 'quotes', 'money', 'business', 'settings'].includes(page))
        return; currentPage = page; renderCurrent(); }, async logout() { if (demo) {
        location.href = location.pathname;
        return;
    } if (identity?.support) {
        location.href = new URL('../management/', location.href).href;
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
    renderBusinessOverviewPage(root, identity, navigation);
else if (currentPage === 'settings')
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
        const context = supportBusiness ? await loadSupportAuthContext(supportBusiness) : await loadAuthContext();
        if (!context) {
            renderLogin(root, boot);
            return;
        }
        identity = { businessId: context.business.id, userId: context.userId, businessName: context.business.name, support: !!supportBusiness };
        renderCurrent();
    }
    catch (error) {
        renderLogin(root, boot, error instanceof Error ? error.message : String(error));
    }
}
void boot();
//# sourceMappingURL=app.js.map