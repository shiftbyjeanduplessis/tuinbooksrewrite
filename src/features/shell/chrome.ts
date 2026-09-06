export type WorkspacePage='schedule'|'clients'|'work'|'quotes'|'money'|'business'|'settings';
export interface WorkspaceIdentity{businessId:string;userId:string;businessName:string;demo?:boolean;support?:boolean;}
export interface WorkspaceNavigation{go:(page:WorkspacePage)=>void;logout:()=>Promise<void>;}

const nav:[WorkspacePage,string][]=[
  ['schedule','Schedule'],['work','Work'],['clients','Clients'],['quotes','Quotes'],['money','Billing'],['business','Business']
];

export function mountWorkspace(root:HTMLElement,identity:WorkspaceIdentity,active:WorkspacePage,navigation:WorkspaceNavigation,pageClass:string):HTMLElement{
  root.innerHTML=`<div class="app-shell original-ui-shell">
    <header class="admin-header">
      <div class="admin-brand">
        <img class="admin-product-logo" src="./tuinbooks-logo.png" alt="TuinBooks">
        <strong class="brand-title">${esc(identity.businessName)}</strong>
      </div>
      <nav class="admin-nav admin-nav-final" aria-label="Admin sections">
        ${nav.map(([page,label])=>`<button data-nav="${page}" class="nav-tab${page===active?' active':''}">${label}</button>`).join('')}
      </nav>
      <div class="header-actions original-header-actions">
        <button type="button" class="icon-button header-settings-button${active==='settings'?' active':''}" data-nav="settings" aria-label="Open Settings" title="Settings">⚙</button>
        <div class="backend-account-bar">
          <span class="backend-sync-state saved">Workspace ready</span>
          <button type="button" class="button secondary compact" id="signOut">${identity.demo?'Exit demo':identity.support?'Exit support':'Sign out'}</button>
        </div>
      </div>
    </header>
    <main class="admin-main"><section id="workspacePage" class="app-view active ${pageClass}"></section></main>
  </div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(button=>{const page=button.dataset.nav as WorkspacePage;button.onclick=()=>navigation.go(page);});
  root.querySelector<HTMLButtonElement>('#signOut')!.onclick=()=>void navigation.logout();
  return root.querySelector<HTMLElement>('#workspacePage')!;
}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
