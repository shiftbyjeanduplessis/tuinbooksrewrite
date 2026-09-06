export type WorkspacePage='schedule'|'clients'|'work'|'quotes'|'money'|'business';
export interface WorkspaceIdentity{businessId:string;userId:string;businessName:string;demo?:boolean;support?:boolean;}
export interface WorkspaceNavigation{go:(page:WorkspacePage)=>void;logout:()=>Promise<void>;}

export function mountWorkspace(root:HTMLElement,identity:WorkspaceIdentity,active:WorkspacePage,navigation:WorkspaceNavigation,pageClass:string):HTMLElement{
  root.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand"><img src="./tuinbooks-logo.png" alt=""><div><strong>TuinBooks</strong><span>${esc(identity.businessName)}</span></div></div><nav class="main-nav"><button data-nav="schedule">Schedule</button><button data-nav="work">Work</button><button data-nav="clients">Clients</button><button data-nav="quotes">Quotes</button><button data-nav="money">Money</button><button data-nav="business">Business</button></nav><button class="text-button" id="signOut">${identity.demo?'Exit demo':identity.support?'Exit support':'Sign out'}</button></header><main id="workspacePage" class="${pageClass}"></main></div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(button=>{const page=button.dataset.nav as WorkspacePage;button.classList.toggle('active',page===active);button.onclick=()=>navigation.go(page);});
  root.querySelector<HTMLButtonElement>('#signOut')!.onclick=()=>void navigation.logout();
  return root.querySelector<HTMLElement>('#workspacePage')!;
}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
