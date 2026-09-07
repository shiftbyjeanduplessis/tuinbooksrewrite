import type { BusinessService, BusinessTeamInput, BusinessWorkspace, FieldPin } from '../../domain/business.js';
import { stableId } from '../../domain/business.js';
import type { WorkspaceIdentity, WorkspaceNavigation } from '../shell/chrome.js';
import { mountWorkspace } from '../shell/chrome.js';
import { demoBusinessWorkspace } from './demoBusiness.js';
import { generateFieldPin, loadBusinessWorkspace, loadFieldPins, revokeFieldPin, saveBusinessService, saveBusinessSettings, saveBusinessTeam } from './businessRepository.js';

export async function renderBusinessPage(root:HTMLElement,identity:WorkspaceIdentity,navigation:WorkspaceNavigation){
 const page=mountWorkspace(root,identity,'settings',navigation,'business-page settings-page old-settings-restored');
 page.innerHTML='<div class="loading-state">Loading business settings…</div>';
 try{
  const ws=identity.demo?structuredClone(demoBusinessWorkspace):await loadBusinessWorkspace(identity.businessId);
  let pins:FieldPin[]=[],pinLoadError='';
  if(identity.demo){
   pins=ws.teams.map((t,i)=>({teamId:t.id,teamName:t.name,pin:String(1234+i).padStart(4,'0'),active:true,updatedAt:null}));
  }else{
   try{pins=await loadFieldPins(identity.businessId);}catch(pinError){pinLoadError=msg(pinError);console.warn('Field PIN list unavailable in this session',pinError);}
  }
  paint(page,identity,ws,pins,pinLoadError);
 }catch(e){page.innerHTML=`<div class="error-box">${esc(msg(e))}</div>`;}
}

function paint(page:HTMLElement,identity:WorkspaceIdentity,ws:BusinessWorkspace,pins:FieldPin[],pinLoadError:string){
 page.innerHTML=`<header class="page-heading workspace-heading legacy-page-heading-r27 old-settings-heading">
  <div><p class="eyebrow">Business setup</p><h1>Settings</h1><p>Configure services, teams, mobile access, business details and billing defaults.</p></div>
  <div class="heading-actions"><button class="button secondary" id="openImportExport">Import / Export</button><button class="button" id="saveBusiness">Save business</button></div>
 </header>
 <nav class="settings-quick-nav panel settings-quick-nav-r27 old-settings-nav" aria-label="Settings sections">
  <a href="#serviceSettingsR27">Services</a>
  <a href="#teamSettingsR27">Teams & capacity</a>
  <a href="#fieldPinsSettingsR27">Mobile access</a>
  <a href="#businessDetailSettingsR27">Business details</a>
  <a href="#billingDefaultsSettingsR27">Billing defaults</a>
  <a href="#importExportSettingsR27">Import / Export</a>
 </nav>
 <section class="settings-grid settings-grid-r27 old-settings-grid">
  <article id="serviceSettingsR27" class="settings-card span-two old-settings-panel">
   <header class="settings-card-head"><div><h2>Services</h2><p>One shared service list used by clients, Schedule and Billing.</p></div><button id="addService">+ Service</button></header>
   <div id="serviceRows" class="settings-rows"></div>
  </article>
  <article id="teamSettingsR27" class="settings-card span-two old-settings-panel">
   <header class="settings-card-head"><div><h2>Teams & capacity</h2><p>Set each team’s working hours and scheduling buffer.</p></div><button id="addTeam">+ Team</button></header>
   <div id="teamRows" class="settings-rows"></div>
  </article>
  <article id="fieldPinsSettingsR27" class="settings-card span-two old-settings-panel">
   <header class="settings-card-head"><div><p class="eyebrow">Mobile access</p><h2>Field phone PINs</h2><p>Permanent team PINs remain visible until deliberately replaced or revoked.</p></div></header>
   ${pinLoadError?`<div class="error-box mobile-pin-contract-error"><strong>Mobile PINs are not available.</strong><span>${esc(pinLoadError)}</span></div>`:''}
   <div id="pinRows" class="settings-rows"></div>
  </article>
  <article id="businessDetailSettingsR27" class="settings-card old-settings-panel">
   <h2>Business details</h2>
   <div class="form-grid two">
    <label>Name<input id="bizName" value="${esc(ws.settings.name)}"></label>
    <label>Phone<input id="bizPhone" value="${esc(ws.settings.phone)}"></label>
    <label>Email<input id="bizEmail" type="email" value="${esc(ws.settings.email)}"></label>
    <label>Address<input id="bizAddress" value="${esc(ws.settings.address)}"></label>
    <label>Suburb / Town<input id="bizSuburb" value="${esc(ws.settings.suburb)}"></label>
    <label>Province<input id="bizProvince" value="${esc(ws.settings.province)}"></label>
    <label>Mode<select id="bizMode"><option value="financials" ${ws.settings.mode==='financials'?'selected':''}>Planning + Financials</option><option value="planning" ${ws.settings.mode==='planning'?'selected':''}>Planning only</option></select></label>
    <label>Week A starts on<input id="weekA" type="date" value="${esc(ws.settings.weekAStartsOn??'')}"></label>
   </div>
  </article>
  <article id="billingDefaultsSettingsR27" class="settings-card old-settings-panel">
   <h2>Billing defaults</h2>
   <div class="form-grid two">
    <label>VAT registered<select id="vatRegistered"><option value="no" ${!ws.settings.vatRegistered?'selected':''}>No</option><option value="yes" ${ws.settings.vatRegistered?'selected':''}>Yes</option></select></label>
    <label>VAT number<input id="vatNumber" value="${esc(ws.settings.vatNumber)}"></label>
    <label>Invoice day<input id="invoiceDay" type="number" min="1" max="31" value="${ws.settings.invoiceDay}"></label>
    <label>Payment terms (days)<input id="paymentTerms" type="number" min="0" max="120" value="${ws.settings.paymentTermsDays}"></label>
    <label>Invoice prefix<input id="invoicePrefix" value="${esc(ws.settings.invoicePrefix)}"></label>
    <label>Email sender name<input id="emailFrom" value="${esc(ws.settings.emailFromName)}"></label>
    <label class="span-two">Statement message<textarea id="statementMessage">${esc(ws.settings.statementMessage)}</textarea></label>
    <label class="span-two">WhatsApp message<textarea id="whatsappMessage">${esc(ws.settings.whatsappMessage)}</textarea></label>
   </div>
  </article>
  <article id="importExportSettingsR27" class="settings-card span-two old-settings-panel old-settings-import-panel">
   <div class="settings-card-head"><div><p class="eyebrow">Business data</p><h2>Import / Export</h2><p>Open the TuinBooks workbook tools for setup, updates and review.</p></div><button class="button" id="openImportExportInline">Open Import / Export</button></div>
  </article>
 </section>`;

 const renderTeams=()=>{
  const host=page.querySelector('#teamRows')!;
  host.innerHTML=ws.teams.map(t=>`<div class="settings-row" data-team="${esc(t.id)}"><input data-k="name" value="${esc(t.name)}"><label>Hours<input data-k="capacity" type="number" min="1" max="24" step=".25" value="${t.capacityHours}"></label><label>Buffer<input data-k="buffer" type="number" min="0" max="8" step=".25" value="${t.bufferHours}"></label><label class="check"><input data-k="active" type="checkbox" ${t.active?'checked':''}> Active</label><button data-save-team>Save</button></div>`).join('');
  host.querySelectorAll<HTMLButtonElement>('[data-save-team]').forEach(b=>b.onclick=async()=>{
   const row=b.closest<HTMLElement>('[data-team]')!,id=row.dataset.team!,input:BusinessTeamInput={id,name:(row.querySelector('[data-k=name]') as HTMLInputElement).value,capacityHours:Number((row.querySelector('[data-k=capacity]') as HTMLInputElement).value),bufferHours:Number((row.querySelector('[data-k=buffer]') as HTMLInputElement).value),active:(row.querySelector('[data-k=active]') as HTMLInputElement).checked};
   await run(page,async()=>{if(!identity.demo)await saveBusinessTeam(identity.businessId,input);Object.assign(ws.teams.find(x=>x.id===id)!,input);});
  });
 };

 const renderServices=()=>{
  const host=page.querySelector('#serviceRows')!;
  host.innerHTML=ws.services.map(s=>`<div class="settings-row service-setting-row" data-service="${esc(s.id)}"><input data-k="name" value="${esc(s.name)}"><input data-k="notes" value="${esc(s.notes)}" placeholder="Notes"><label class="check"><input data-k="active" type="checkbox" ${s.active?'checked':''}> Active</label><button data-save-service>Save</button></div>`).join('');
  host.querySelectorAll<HTMLButtonElement>('[data-save-service]').forEach(b=>b.onclick=async()=>{
   const row=b.closest<HTMLElement>('[data-service]')!,id=row.dataset.service!,input:BusinessService={id,name:(row.querySelector('[data-k=name]') as HTMLInputElement).value,notes:(row.querySelector('[data-k=notes]') as HTMLInputElement).value,active:(row.querySelector('[data-k=active]') as HTMLInputElement).checked};
   await run(page,async()=>{if(!identity.demo)await saveBusinessService(identity.businessId,input);Object.assign(ws.services.find(x=>x.id===id)!,input);});
  });
 };

 const renderPins=()=>{
  const host=page.querySelector<HTMLElement>('#pinRows')!;
  if(pinLoadError){host.innerHTML='<div class="agreement-empty">PIN controls are disabled until the database contract is repaired.</div>';return;}
  host.innerHTML=ws.teams.filter(t=>t.active).map(t=>{
   const pin=pins.find(p=>p.teamId===t.id&&p.active);
   return `<div class="settings-row field-pin-row old-field-pin-row" data-pin-team="${esc(t.id)}"><strong>${esc(t.name)}</strong><code>${pin?.pin?esc(pin.pin):'—'}</code><span>${pin?.pin?'Active permanent PIN':'No PIN issued'}</span><button data-generate-pin>${pin?.pin?'Replace PIN':'Create PIN'}</button>${pin?.pin?'<button data-revoke-pin>Revoke</button>':''}</div>`;
  }).join('')||'<div class="agreement-empty">No active teams.</div>';
  host.querySelectorAll<HTMLButtonElement>('[data-generate-pin]').forEach(b=>b.onclick=async()=>{
   const row=b.closest<HTMLElement>('[data-pin-team]')!,teamId=row.dataset.pinTeam!;
   await run(page,async()=>{
    if(identity.demo){const team=ws.teams.find(t=>t.id===teamId)!;const next={teamId,teamName:team.name,pin:String(Math.floor(1000+Math.random()*9000)),active:true,updatedAt:new Date().toISOString()};const i=pins.findIndex(p=>p.teamId===teamId);if(i>=0)pins[i]=next;else pins.push(next);}else{const next=await generateFieldPin(identity.businessId,teamId);const i=pins.findIndex(p=>p.teamId===teamId);if(i>=0)pins[i]=next;else pins.push(next);}renderPins();
   });
  });
  host.querySelectorAll<HTMLButtonElement>('[data-revoke-pin]').forEach(b=>b.onclick=async()=>{
   const row=b.closest<HTMLElement>('[data-pin-team]')!,teamId=row.dataset.pinTeam!;
   await run(page,async()=>{if(!identity.demo)await revokeFieldPin(identity.businessId,teamId);const p=pins.find(x=>x.teamId===teamId);if(p)p.active=false;renderPins();});
  });
 };

 renderTeams();renderServices();renderPins();
 page.querySelector<HTMLButtonElement>('#addTeam')!.onclick=()=>{ws.teams.push({id:stableId('team',`New Team ${Date.now()}`),name:'New team',capacityHours:8,bufferHours:1,active:true});renderTeams();};
 page.querySelector<HTMLButtonElement>('#addService')!.onclick=()=>{ws.services.push({id:stableId('svc',`New Service ${Date.now()}`),name:'New service',notes:'',active:true});renderServices();};
 page.querySelector<HTMLButtonElement>('#saveBusiness')!.onclick=()=>void run(page,async()=>{
  const s=ws.settings;s.name=value(page,'bizName');s.phone=value(page,'bizPhone');s.email=value(page,'bizEmail');s.address=value(page,'bizAddress');s.suburb=value(page,'bizSuburb');s.province=value(page,'bizProvince');s.mode=value(page,'bizMode')==='planning'?'planning':'financials';s.weekAStartsOn=(value(page,'weekA')||null) as any;s.vatRegistered=value(page,'vatRegistered')==='yes';s.vatNumber=value(page,'vatNumber');s.invoiceDay=Number(value(page,'invoiceDay'));s.paymentTermsDays=Number(value(page,'paymentTerms'));s.invoicePrefix=value(page,'invoicePrefix');s.emailFromName=value(page,'emailFrom');s.statementMessage=value(page,'statementMessage');s.whatsappMessage=value(page,'whatsappMessage');if(!identity.demo)await saveBusinessSettings(identity.businessId,s);identity.businessName=s.name||identity.businessName;identity.planningOnly=s.mode==='planning';
 });
 const openImport=()=>import('../importExport/importExportDialog.js').then(m=>m.openImportExportDialog(identity));
 page.querySelector<HTMLButtonElement>('#openImportExport')!.onclick=()=>void openImport();
 page.querySelector<HTMLButtonElement>('#openImportExportInline')!.onclick=()=>void openImport();
}

function value(page:HTMLElement,id:string){return(page.querySelector(`#${id}`) as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement).value;}
async function run(page:HTMLElement,fn:()=>Promise<void>){const old=document.querySelector('.save-indicator');old?.remove();const n=document.createElement('div');n.className='save-indicator';n.textContent='Saving…';document.body.appendChild(n);try{await fn();n.textContent='Saved';setTimeout(()=>n.remove(),900);}catch(e){n.textContent=msg(e);n.classList.add('error-box');setTimeout(()=>n.remove(),5000);}}
function msg(e:unknown){return e instanceof Error?e.message:(e&&typeof e==='object'&&'message' in e?String((e as any).message):String(e));}
function esc(v:string){return String(v).replace(/[&<>'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]??ch));}
