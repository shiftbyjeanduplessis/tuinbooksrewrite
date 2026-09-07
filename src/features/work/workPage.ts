import { addDays, todayIso } from '../../domain/dates.js';
import { visitDoNotService } from '../../domain/operations.js';
import type { Visit, WorkDay } from '../../domain/types.js';
import { accountForWork, holdForWork, locationForWork, opportunitiesForVisit, recordsForVisit, tasksForVisit, teamProgress, workDayProgress } from '../../domain/work.js';
import { mountWorkspace, type WorkspaceIdentity, type WorkspaceNavigation } from '../shell/chrome.js';
import { demoWorkDay } from './demoWork.js';
import { loadWorkDay, reviewOpportunity, signedPhotoUrl } from './workRepository.js';
import { loadMoneyWorkspace, saveQuote } from '../billing/moneyRepository.js';

type WorkTab='recent'|'review'|'all';

export function renderWorkPage(root:HTMLElement,identity:WorkspaceIdentity,navigation:WorkspaceNavigation):void{
  const page=mountWorkspace(root,identity,'work',navigation,'work-page work-legacy-r27');
  let date=todayIso(),day:WorkDay|null=null,activeTab:WorkTab='recent';
  page.innerHTML=`
    <section class="page-heading work-toolbar legacy-page-heading-r27">
      <div>
        <p class="eyebrow">Daily operations</p>
        <h1>Work</h1>
        <p>Control today first, then open earlier workdays when their full operational evidence is needed.</p>
      </div>
      <div class="heading-actions month-navigation work-date-controls-r27">
        <button class="button secondary compact" id="workPrev" aria-label="Previous day">←</button>
        <button class="button secondary" id="workToday">Today</button>
        <span id="workDateLabel" class="work-date-label-r27"></span>
        <button class="button secondary compact" id="workNext" aria-label="Next day">→</button>
        <button class="button secondary" id="workRefresh">Refresh</button>
      </div>
    </section>
    <nav class="page-subtabs work-subtabs-r27" aria-label="Work sections">
      <button type="button" class="page-subtab active" data-work-tab="recent">Today &amp; recent</button>
      <button type="button" class="page-subtab" data-work-tab="review">Needs Review <span id="workReviewCount" class="subtab-count">0</span></button>
      <button type="button" class="page-subtab" data-work-tab="all">All Work</button>
    </nav>
    <div id="workError" class="error-box hidden"></div>
    <section id="workSummary"></section>
    <section id="workAttention"></section>
    <section id="workTeams"><div class="loading-state">Loading work…</div></section>`;

  const error=page.querySelector<HTMLElement>('#workError')!;
  const summary=page.querySelector<HTMLElement>('#workSummary')!;
  const teamsHost=page.querySelector<HTMLElement>('#workTeams')!;
  const attention=page.querySelector<HTMLElement>('#workAttention')!;
  const label=page.querySelector<HTMLElement>('#workDateLabel')!;
  const reviewCount=page.querySelector<HTMLElement>('#workReviewCount')!;

  async function load(){
    error.classList.add('hidden');
    teamsHost.innerHTML='<div class="loading-state">Loading work…</div>';
    label.textContent=formatDate(date);
    try{
      day=identity.demo?demoWorkDay(date):await loadWorkDay(identity.businessId,date);
      render();
    }catch(e){
      error.textContent=msg(e);
      error.classList.remove('hidden');
      teamsHost.innerHTML='<div class="panel legacy-empty-r27">Work could not be loaded.</div>';
      summary.innerHTML='';attention.innerHTML='';
    }
  }

  function render(){
    if(!day)return;
    const p=workDayProgress(day);
    const newOpps=day.opportunities.filter(o=>o.status==='new');
    reviewCount.textContent=String(newOpps.length);
    renderProgress(p.total,p.completed,p.percent,newOpps.length);
    renderAttention();
    renderRoutes();
    applyTab();
  }

  function renderProgress(total:number,completed:number,percent:number,opportunities:number){
    if(!day)return;
    const rows=day.teams.map(team=>({team,progress:teamProgress(day!.visits,team.id)})).filter(row=>row.progress.total>0);
    summary.innerHTML=`<section class="work-team-progress-r27 panel" aria-label="Today's team progress">
      <div class="work-progress-head-r27">
        <div><p class="eyebrow">Today by team</p><h2>Route completion</h2></div>
        <div class="work-compact-kpis-r27"><span><strong>${completed}</strong> of ${total} completed</span><span><strong>${percent}%</strong> overall</span>${opportunities?`<span class="attention"><strong>${opportunities}</strong> needs review</span>`:''}</div>
      </div>
      <div class="work-team-progress-grid-r27">
        ${rows.map(({team,progress})=>`<article class="work-team-meter-r27 ${progress.percent===100?'complete':''}">
          <div class="work-team-meter-top-r27"><div><strong>${esc(team.name)}</strong><span>${progress.completed} of ${progress.total} completed</span></div><b>${progress.percent}%</b></div>
          <div class="work-team-meter-track-r27"><i style="width:${progress.percent}%"></i></div>
          <small>${progress.total-progress.completed?`${progress.total-progress.completed} remaining`:'Route complete'}</small>
        </article>`).join('')||'<div class="legacy-empty-r27">No scheduled route for this day.</div>'}
      </div>
    </section>`;
  }

  function renderRoutes(){
    if(!day)return;
    teamsHost.innerHTML=`<section class="panel work-routes-panel-r27">
      <div class="section-title-row work-routes-title-r27"><div><p class="eyebrow">${activeTab==='all'?'Work records':'Today\'s route'}</p><h2>${activeTab==='all'?formatDate(date):'Visits by team'}</h2><p>${activeTab==='all'?'Use the day controls above to open another workday.':'Compact route view. Open field evidence and exceptions from the relevant record.'}</p></div></div>
      <div id="workRouteGroups" class="work-route-groups-r27"></div>
    </section>`;
    const groups=teamsHost.querySelector<HTMLElement>('#workRouteGroups')!;
    for(const team of day.teams){
      const visits=day.visits.filter(v=>v.teamId===team.id).sort((a,b)=>a.sortOrder-b.sortOrder);
      const actions=day.dayActions.filter(a=>a.teamId===team.id);
      if(!visits.length&&!actions.length)continue;
      const tp=teamProgress(day.visits,team.id);
      const section=document.createElement('details');
      section.className='work-team-section-r27';
      section.open=true;
      section.innerHTML=`<summary><div><strong>${esc(team.name)}</strong><small>${tp.completed} of ${tp.total} completed · ${Math.max(0,tp.total-tp.completed)} remaining</small></div><b>${tp.percent}%</b></summary><div class="work-team-route-r27"></div>`;
      const host=section.querySelector<HTMLElement>('.work-team-route-r27')!;
      for(const action of actions){
        const note=document.createElement('div');
        note.className='work-day-action';
        note.innerHTML=`<b>${action.kind==='team_note'?'INSTRUCTION':'EVENT'}</b><span>${esc(action.detail||action.title)}${action.time?` · ${esc(action.time)}`:''}</span>`;
        host.append(note);
      }
      if(!visits.length){host.insertAdjacentHTML('beforeend','<div class="agreement-empty">No visits.</div>');}
      visits.forEach((visit,index)=>{
        const stop=document.createElement('div');
        stop.className='work-route-stop-r27';
        stop.innerHTML=`<span class="work-route-number-r27">${index+1}</span>`;
        stop.append(renderVisit(day!,visit));
        host.append(stop);
      });
      groups.append(section);
    }
    if(!groups.children.length)groups.innerHTML='<div class="legacy-empty-r27">No work for this day.</div>';
  }

  function renderAttention(){
    if(!day)return;
    const rows=day.opportunities.filter(o=>o.status==='new');
    attention.innerHTML=`<section class="panel work-attention work-attention-r27">
      <header><div><p class="eyebrow">Office exceptions</p><h2>Needs Review · ${rows.length}</h2><p>Review field observations, then decide whether to quote, inspect, defer or close them.</p></div></header>
      <div id="workOpportunityRows"></div>
    </section>`;
    const host=attention.querySelector<HTMLElement>('#workOpportunityRows')!;
    if(!rows.length){host.innerHTML='<div class="legacy-empty-r27">No field opportunities need an office decision.</div>';return;}
    for(const opp of rows){
      const account=accountForWork(day,opp.accountId),visit=opp.scheduleJobId?day.visits.find(v=>v.id===opp.scheduleJobId):undefined,location=visit?locationForWork(day,visit.serviceLocationId):undefined,row=document.createElement('article');
      row.className='work-opportunity-row';
      row.innerHTML=`<span><strong>${esc(opp.category)} · ${esc(account?.name||'Client')}</strong><small>${esc(location?.address||'')}${location?.suburb?` · ${esc(location.suburb)}`:''}</small></span><p>${esc(opp.note)}</p><div class="row-actions opportunity-actions">${opp.photoPaths.length?`<button data-photos>${opp.photoPaths.length} photo${opp.photoPaths.length===1?'':'s'}</button>`:''}<button data-opp="quote">Quote now</button><button data-opp="site">Needs site visit</button><button data-opp="design">Design consult</button><button data-opp="defer">Defer</button><button data-opp="close">Close</button></div>`;
      row.querySelector<HTMLButtonElement>('[data-photos]')?.addEventListener('click',()=>void openPhotos(opp.photoPaths));
      row.querySelector<HTMLButtonElement>('[data-opp=quote]')!.onclick=()=>void quoteOpportunity(opp);
      row.querySelector<HTMLButtonElement>('[data-opp=site]')!.onclick=()=>void decideOpportunity(opp.id,'site-visit');
      row.querySelector<HTMLButtonElement>('[data-opp=design]')!.onclick=()=>void decideOpportunity(opp.id,'design-consult');
      row.querySelector<HTMLButtonElement>('[data-opp=defer]')!.onclick=()=>void decideOpportunity(opp.id,'defer');
      row.querySelector<HTMLButtonElement>('[data-opp=close]')!.onclick=()=>void decideOpportunity(opp.id,'closed');
      host.append(row);
    }
  }

  function applyTab(){
    page.querySelectorAll<HTMLButtonElement>('[data-work-tab]').forEach(button=>button.classList.toggle('active',button.dataset.workTab===activeTab));
    const showReview=activeTab==='review';
    attention.classList.toggle('hidden',!showReview);
    summary.classList.toggle('hidden',showReview||activeTab==='all');
    teamsHost.classList.toggle('hidden',showReview);
  }

  async function decideOpportunity(id:string,decision:'site-visit'|'design-consult'|'defer'|'closed'){
    if(identity.demo){if(day){const o=day.opportunities.find(x=>x.id===id);if(o){o.status=decision==='defer'?'deferred':decision==='closed'?'closed':'reviewed';o.reviewDecision=decision;}render();}return;}
    try{await reviewOpportunity(identity.businessId,id,decision);await load();}catch(e){error.textContent=msg(e);error.classList.remove('hidden');}
  }

  async function quoteOpportunity(opp:WorkDay['opportunities'][number]){
    if(identity.demo){navigation.go('quotes');return;}
    try{
      const money=await loadMoneyWorkspace(identity.businessId),quoteId=`quote-v2-${crypto.randomUUID()}`,quoteDate=todayIso();
      await saveQuote(identity.businessId,{id:quoteId,accountId:opp.accountId,date:quoteDate,validUntil:addDays(quoteDate,7),status:'Draft',number:quoteId,lines:[{id:`line-${crypto.randomUUID()}`,description:`${opp.category}: ${opp.note}`.trim(),quantity:1,unitPrice:0,vatRate:money.defaultVatRate,sourceVisitId:opp.scheduleJobId,sourceQuoteId:null,category:'manual'}],notes:`Created from field opportunity ${opp.id}`});
      await reviewOpportunity(identity.businessId,opp.id,'quote-created',quoteId);navigation.go('quotes');
    }catch(e){error.textContent=msg(e);error.classList.remove('hidden');}
  }

  async function openPhotos(paths:string[]){
    const dialog=document.createElement('dialog');dialog.className='mobile-dialog';dialog.innerHTML='<div class="dialog-shell"><header><div><p class="eyebrow">Field photos</p><h2>Visit photos</h2></div><button class="icon-button" data-close>×</button></header><div class="photo-grid" id="photoGrid"><div class="loading-state">Loading photos…</div></div></div>';document.body.append(dialog);dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();const urls=await Promise.all(paths.map(signedPhotoUrl));const host=dialog.querySelector<HTMLElement>('#photoGrid')!;host.innerHTML=urls.map((url,i)=>url?`<img src="${esc(url)}" alt="Field photo ${i+1}">`:'').join('')||'<div class="mobile-empty">Photos could not be opened.</div>';
  }

  page.querySelectorAll<HTMLButtonElement>('[data-work-tab]').forEach(button=>button.onclick=()=>{activeTab=(button.dataset.workTab as WorkTab)||'recent';if(day)render();});
  page.querySelector<HTMLButtonElement>('#workPrev')!.onclick=()=>{date=addDays(date,-1);void load();};
  page.querySelector<HTMLButtonElement>('#workToday')!.onclick=()=>{date=todayIso();void load();};
  page.querySelector<HTMLButtonElement>('#workNext')!.onclick=()=>{date=addDays(date,1);void load();};
  page.querySelector<HTMLButtonElement>('#workRefresh')!.onclick=()=>void load();
  void load();
}

function renderVisit(day:WorkDay,visit:Visit):HTMLElement{
  const account=accountForWork(day,visit.accountId),location=locationForWork(day,visit.serviceLocationId),hold=holdForWork(day,visit.accountId),visitDns=visitDoNotService(visit),dns=visitDns.active||!!hold,records=recordsForVisit(day,visit.id),opps=opportunitiesForVisit(day,visit.id),row=document.createElement('div');
  row.className=`work-visit-row status-${safe(visit.status)}${dns?' do-not-service':''}`;
  const dnsText=visitDns.active?`THIS VISIT · ${visitDns.note||visitDns.reason}`:hold?`CLIENT · ${hold.note||hold.reason}`:'';
  row.innerHTML=`<span class="work-marker ${visit.visitType}">${visit.visitType==='additional'?'A':visit.visitType==='quoted'?'Q':'R'}</span><span class="work-client"><strong>${esc(account?.name||'Unknown client')}</strong><small>${esc(location?.address||'')}${location?.suburb?` · ${esc(location.suburb)}`:''}</small>${dns?`<b>DO NOT SERVICE · ${esc(dnsText)}</b>`:''}</span><span class="work-task"><strong>${esc(tasksForVisit(visit).join(', '))}</strong><small>${records[0]?.outcome||visit.status}${opps.length?` · ${opps.length} opportunity${opps.length===1?'':'s'}`:''}</small></span><span class="work-state">${esc(visit.status)}</span>`;
  return row;
}
function formatDate(date:string):string{return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));}
function esc(v:string):string{return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]??ch));}
function safe(v:string):string{return v.replace(/[^a-z0-9-]/gi,'-').toLowerCase();}
function msg(e:unknown):string{return e instanceof Error?e.message:(e&&typeof e==='object'&&'message' in e?String((e as any).message):String(e));}
