/* TuinBooks v60.2.0 PRODUCTION — consolidated Work
   One authoritative Work renderer:
   - one Today-by-team percentage summary at the top of Work
   - Today jobs grouped by team, without duplicate summary blocks
   - previous workdays grouped date -> team
   - past team metrics: scheduled / completed / unresolved / % complete
   - current-day unfinished work remains Scheduled, never prematurely "Unreported"
   - earlier imported/reference history respects the operational tracking start
*/
(()=>{
  'use strict';

  const BUILD='60.2.0-work-consolidated-production';
  const $=id=>document.getElementById(id);
  const state=()=>window.state||{};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const today=()=>{
    if(typeof window.localDateISO==='function')return window.localDateISO();
    const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const currentMonth=()=>today().slice(0,7);
  const fmtDate=value=>{
    if(typeof window.fmtDate==='function')return window.fmtDate(value);
    const d=new Date(`${String(value||'').slice(0,10)}T12:00:00`);
    return Number.isNaN(d.getTime())?String(value||''):d.toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  };
  const dayName=value=>{
    if(typeof window.dayName==='function')return window.dayName(value);
    const d=new Date(`${String(value||'').slice(0,10)}T12:00:00`);
    return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-ZA',{weekday:'long'});
  };
  const teamFor=id=>(state().teams||[]).find(team=>String(team.id)===String(id))||null;
  const clientFor=id=>(state().clients||[]).find(client=>String(client.id)===String(id))||null;
  const trackingStart=()=>String(state().business?.operationalTrackingStartDateV59694||'').slice(0,10);
  const teamIdFor=item=>String(item?.visit?.teamId||item?.job?.teamId||'__none__');
  const teamLabelFor=item=>teamFor(teamIdFor(item))?.name||'No team';
  const activeTab=()=>String(window.workTabV58930||'recent');

  function linkedVisitMap(){
    const map=new Map();
    for(const visit of state().visits||[]){if(visit?.scheduledJobId)map.set(String(visit.scheduledJobId),visit);}
    return map;
  }

  function completedVisit(visit){
    if(!visit)return false;
    const outcome=String(visit.outcome||visit.status||'').toLowerCase();
    return outcome==='completed'||/^completed\b/.test(outcome)||/catch[\s_-]*up[\s_-]*completed/.test(outcome);
  }

  function visitNeedsAttention(visit){
    if(!visit)return false;
    if(visit.resolutionStatusV56==='needs-resolution'||visit.processed===false)return true;
    const value=String(visit.outcome||visit.status||'').toLowerCase();
    if(!value||completedVisit(visit))return false;
    return !/cancel|no[\s_/-]*charge|resched|defer/.test(value);
  }

  function terminalJob(job){
    return ['cancelled','canceled','rescheduled','deferred','no-charge','archived','deleted'].includes(String(job?.status||'').toLowerCase());
  }

  function todayTeamProgressRows(){
    const date=today(),linked=linkedVisitMap(),filter=$('recordTeamFilter')?.value||'all';
    const rows=[];
    const teamIds=[...new Set((state().schedules||[])
      .filter(job=>String(job?.date||'').slice(0,10)===date&&!terminalJob(job))
      .map(job=>String(job.teamId||'__none__'))
      .concat((state().visits||[]).filter(visit=>String(visit?.date||'').slice(0,10)===date).map(visit=>String(visit.teamId||'__none__'))))];

    for(const teamId of teamIds){
      if(filter!=='all'&&String(filter)!==String(teamId))continue;
      const jobs=(state().schedules||[]).filter(job=>String(job?.date||'').slice(0,10)===date&&String(job.teamId||'__none__')===teamId&&!terminalJob(job));
      let completed=0,exceptions=0;
      for(const job of jobs){
        const visit=linked.get(String(job.id))||null;
        if(completedVisit(visit)||String(job.status||'').toLowerCase()==='completed')completed++;
        else if(visitNeedsAttention(visit)||['missed','attention','access-failed'].includes(String(job.status||'').toLowerCase()))exceptions++;
      }
      const scheduled=jobs.length;
      const remaining=Math.max(0,scheduled-completed-exceptions);
      const pct=scheduled?Math.max(0,Math.min(100,Math.round(completed/scheduled*100))):0;
      const team=teamFor(teamId)||{id:teamId,name:'No team'};
      if(scheduled||exceptions)rows.push({team,scheduled,completed,remaining,exceptions,pct});
    }
    return rows.sort((a,b)=>String(a.team.name||'').localeCompare(String(b.team.name||'')));
  }

  function ensureTopSummary(){
    const view=$('view-records'),heading=view?.querySelector('.page-heading');
    if(!view||!heading)return null;
    let host=$('workProgressSummaryV6020');
    if(!host){
      host=document.createElement('section');
      host.id='workProgressSummaryV6020';
      host.className='work-progress-summary-v6020';
      heading.insertAdjacentElement('afterend',host);
    }else if(host.previousElementSibling!==heading){
      heading.insertAdjacentElement('afterend',host);
    }
    return host;
  }

  function renderTopSummary(show=true){
    const host=ensureTopSummary();if(!host)return;
    if(!show){host.classList.add('hidden');host.innerHTML='';return;}
    host.classList.remove('hidden');
    const rows=todayTeamProgressRows();
    host.innerHTML=`<div class="work-progress-summary-head-v6020"><div><span class="eyebrow">Today by team</span><strong>${esc(dayName(today()))}, ${esc(fmtDate(today()))}</strong></div><small>Live route progress</small></div>
      <div class="work-progress-grid-v6020">${rows.map(row=>`<article class="work-progress-card-v6020 ${row.pct===100?'complete':''}">
        <div class="work-progress-card-top-v6020"><div><strong>${esc(row.team.name||'Team')}</strong><span>${row.completed} of ${row.scheduled} completed</span></div><b>${row.pct}%</b></div>
        <div class="work-progress-track-v6020" role="progressbar" aria-valuemin="0" aria-valuemax="${row.scheduled}" aria-valuenow="${row.completed}" aria-label="${esc(row.team.name||'Team')}: ${row.pct}% complete"><i style="width:${row.pct}%"></i></div>
        <div class="work-progress-metrics-v6020"><span><b>${row.scheduled}</b><small>Scheduled</small></span><span><b>${row.completed}</b><small>Completed</small></span><span><b>${row.remaining}</b><small>Remaining</small></span></div>
        ${row.exceptions?`<small class="work-progress-exception-v6020">${row.exceptions} exception${row.exceptions===1?'':'s'} needs attention</small>`:''}
      </article>`).join('')||'<div class="work-progress-empty-v6020">No work is scheduled for today.</div>'}</div>`;
  }

  function removeLegacyWorkLayers(){
    // These are older post-render summaries/history layers. The consolidated renderer is the only visible Work owner.
    $('workTeamHistoryV59694')?.remove();
    $('needsResolutionV56')?.remove();
    document.querySelectorAll('.work-team-progress-v59692').forEach(node=>node.remove());
  }

  function workItems({all=false}={}){
    if(typeof window.workItemsV59386==='function')return window.workItemsV59386({all});
    // Minimal fallback if an older bundle is ever missing the v59.3 Work helper.
    const dateToday=today(),month=$('recordsMonth')?.value||currentMonth(),term=String($('recordSearch')?.value||'').trim().toLowerCase(),team=$('recordTeamFilter')?.value||'all',filter=$('recordStatusFilter')?.value||'all';
    const clients=new Map((state().clients||[]).map(c=>[String(c.id),c]));
    const visits=(state().visits||[]).filter(v=>String(v.date||'')<=dateToday&&(all||String(v.date||'').startsWith(month)));
    const byJob=new Map(visits.filter(v=>v.scheduledJobId).map(v=>[String(v.scheduledJobId),v]));
    const linked=new Set(),items=[];
    const matches=item=>{
      const c=item.client||{},v=item.visit||{},j=item.job||{};
      const text=`${c.name||''} ${c.address||''} ${c.suburb||''} ${(v.workDone||[]).join(' ')} ${v.extraDescription||''} ${v.outcomeNote||''}`.toLowerCase();
      if(term&&!text.includes(term))return false;
      if(team!=='all'&&String(v.teamId||j.teamId||'')!==String(team))return false;
      if(filter==='extra'&&!String(v.extraDescription||'').trim())return false;
      if(filter==='photos'&&!((v.photos||[]).length||(v.photoPaths||[]).length))return false;
      if(filter==='scheduled'&&!(j||v.scheduled))return false;
      return true;
    };
    for(const job of state().schedules||[]){
      if(String(job.date||'')>dateToday||(!all&&!String(job.date||'').startsWith(month))||terminalJob(job))continue;
      const visit=byJob.get(String(job.id))||null;if(visit)linked.add(String(visit.id));
      const item={date:String(visit?.date||job.date||'').slice(0,10),job,visit,client:clients.get(String(job.clientId))||{}};
      if(matches(item))items.push(item);
    }
    for(const visit of visits){
      if(linked.has(String(visit.id)))continue;
      const item={date:String(visit.date||'').slice(0,10),job:null,visit,client:clients.get(String(visit.clientId))||{}};
      if(matches(item))items.push(item);
    }
    return items.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  }

  function normalStatus(item){
    if(typeof window.workItemStatusV59386==='function')return window.workItemStatusV59386(item);
    if(item.visit){if(completedVisit(item.visit))return {key:'completed',label:'Completed'};return {key:visitNeedsAttention(item.visit)?'attention':'neutral',label:String(item.visit.outcome||'Recorded')};}
    if(item.date===today())return {key:'scheduled',label:'Scheduled'};
    return {key:'missed',label:'Unresolved'};
  }

  function itemStatus(item){
    const start=trackingStart();
    if(start&&item.date<start&&!item.visit)return {key:'reference',label:'Reference history'};
    return normalStatus(item);
  }

  function statsFor(items,{past=false}={}){
    let scheduled=0,completed=0,remaining=0,unresolved=0,exceptions=0;
    for(const item of items){
      const status=itemStatus(item);
      if(item.job||item.visit?.scheduled)scheduled++;
      if(status.key==='completed')completed++;
      if(!past&&status.key==='scheduled')remaining++;
      if(past&&status.key==='missed')unresolved++;
      if(status.key==='attention')exceptions++;
    }
    return {scheduled,completed,remaining,unresolved,exceptions,pct:scheduled?Math.max(0,Math.min(100,Math.round(completed/scheduled*100))):(completed?100:0)};
  }

  function referenceCard(item){
    const client=item.client||clientFor(item.job?.clientId)||{},team=teamFor(item.job?.teamId||item.visit?.teamId);
    return `<details class="work-job-card-v59386 reference-v6020"><summary><span class="work-marker-v59386 marker-r">R</span><div class="work-job-main-v59386"><strong>${esc(client.name||client.address||'Unknown client')}</strong><small>${esc(client.address||client.suburb||'No site address')} · ${esc(team?.name||'No team')}</small></div><div class="work-job-summary-v59386"><span class="work-chip-v59386 reference-v6020">Reference history</span></div><span class="work-chevron-v59386" aria-hidden="true"></span></summary><div class="work-job-detail-v59386"><p class="work-empty-detail-v59386">This scheduled row is earlier than the confirmed TuinBooks operational tracking start, so it is kept as reference history and is not treated as unresolved work.</p></div></details>`;
  }

  function itemCard(item){
    if(itemStatus(item).key==='reference')return referenceCard(item);
    if(typeof window.workItemCardV59386==='function')return window.workItemCardV59386(item);
    const client=item.client||{},status=itemStatus(item),team=teamFor(item.visit?.teamId||item.job?.teamId);
    return `<article class="work-simple-job-v6020"><div><strong>${esc(client.name||'Unknown client')}</strong><small>${esc(client.address||client.suburb||'No site address')} · ${esc(team?.name||'No team')}</small></div><span class="work-chip-v59386 ${esc(status.key)}">${esc(status.label)}</span></article>`;
  }

  function groupedByTeam(items){
    const groups=new Map();
    for(const item of items){const id=teamIdFor(item);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(item);}
    return [...groups.entries()].sort((a,b)=>String(teamFor(a[0])?.name||'No team').localeCompare(String(teamFor(b[0])?.name||'No team')));
  }

  function todayTeamSections(items){
    if(!items.length)return '<div class="ui-empty compact">No work matches the current filters for today.</div>';
    return groupedByTeam(items).map(([,rows])=>`<section class="work-today-team-v6020"><header><strong>${esc(teamLabelFor(rows[0]))}</strong></header><div class="work-team-job-list-v6020">${rows.map(itemCard).join('')}</div></section>`).join('');
  }

  function pastTeamSections(items,date){
    return groupedByTeam(items).map(([,rows])=>{
      const stats=statsFor(rows,{past:true});
      const unresolved=stats.unresolved+stats.exceptions;
      return `<section class="work-past-team-v6020"><header><div><strong>${esc(teamLabelFor(rows[0]))}</strong><small>${stats.pct}% complete</small></div><div class="work-past-team-metrics-v6020"><span><b>${stats.scheduled}</b><small>Scheduled</small></span><span><b>${stats.completed}</b><small>Completed</small></span><span class="${unresolved?'attention':''}"><b>${unresolved}</b><small>Unresolved</small></span><span><b>${stats.pct}%</b><small>Complete</small></span></div></header><div class="work-team-job-list-v6020">${rows.map(itemCard).join('')}</div></section>`;
    }).join('');
  }

  function pastDay(date,items,index){
    const start=trackingStart(),reference=Boolean(start&&date<start);
    const teams=groupedByTeam(items).length;
    return `<details class="work-day-v6020 ${reference?'reference':''}" ${index===0?'open':''}><summary><div><span class="eyebrow">${reference?'Reference history':'Previous workday'}</span><strong>${esc(dayName(date))}, ${esc(fmtDate(date))}</strong></div><span class="work-day-meta-v6020">${teams} team${teams===1?'':'s'}</span><span class="work-chevron-v59386" aria-hidden="true"></span></summary><div class="work-day-body-v6020">${pastTeamSections(items,date)}</div></details>`;
  }

  function renderHistory(items,{all=false}={}){
    const groups=new Map();
    for(const item of items){if(item.date===today())continue;if(!groups.has(item.date))groups.set(item.date,[]);groups.get(item.date).push(item);}
    const days=[...groups.entries()].sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
    if(!days.length)return '<div class="ui-empty compact">No previous workdays match the current filters.</div>';
    return `<section class="work-history-v6020"><div class="work-section-head-v6020"><div><span class="eyebrow">${all?'All work':'Previous workdays'}</span><strong>${all?'Work history by day and team':'Open a day to review each team'}</strong></div></div><div class="work-history-days-v6020">${days.map(([date,rows],index)=>pastDay(date,rows,index)).join('')}</div></section>`;
  }

  function renderRecentWork(){
    removeLegacyWorkLayers();
    renderTopSummary(true);
    const host=$('workRecordCards');if(!host)return;
    const items=workItems({all:false});
    const todayItems=items.filter(item=>item.date===today());
    const month=$('recordsMonth')?.value||currentMonth();
    const showToday=month===currentMonth();
    const todayHtml=showToday?`<section class="work-today-v6020"><div class="work-section-head-v6020"><div><span class="eyebrow">Today’s jobs</span><strong>Jobs by team</strong></div><small>Scheduled jobs stay neutral until completed or an exception is recorded.</small></div>${todayTeamSections(todayItems)}</section>`:'';
    host.innerHTML=`${todayHtml}${renderHistory(items,{all:false})}`;
    removeLegacyWorkLayers();
    document.body.dataset.workConsolidated='v6020';
  }

  function renderAllWorkConsolidated(){
    removeLegacyWorkLayers();
    renderTopSummary(false);
    const host=$('workRecordCards');if(!host)return;
    const items=workItems({all:true});
    host.innerHTML=renderHistory(items,{all:true});
    removeLegacyWorkLayers();
  }

  function renderNeedsReview(){
    removeLegacyWorkLayers();renderTopSummary(false);
    const inline=$('needsReviewInlineV58930');if(!inline)return;
    if(typeof window.workNeedsResolutionHtmlV59386==='function')inline.innerHTML=window.workNeedsResolutionHtmlV59386();
    else inline.innerHTML='<div class="ui-empty">No work needs an office decision.</div>';
  }

  function setActiveSubtab(tab){
    document.querySelectorAll('[data-work-tab-v58930]').forEach(button=>button.classList.toggle('active',button.getAttribute('data-work-tab-v58930')===tab));
  }

  function applyWorkTab(tab){
    const target=tab||'recent';
    try{window.workTabV58930=target;}catch(_){}
    setActiveSubtab(target);
    const inline=$('needsReviewInlineV58930'),toolbar=$('view-records')?.querySelector('.toolbar'),host=$('workRecordCards');
    if(target==='needs-review'){
      host?.classList.add('hidden');toolbar?.classList.add('hidden');inline?.classList.remove('hidden');renderNeedsReview();return;
    }
    if(target==='orders'){
      renderTopSummary(false);inline?.classList.add('hidden');toolbar?.classList.add('hidden');host?.classList.remove('hidden');window.renderOrdersV58940?.();return;
    }
    inline?.classList.add('hidden');toolbar?.classList.remove('hidden');host?.classList.remove('hidden');
    if(target==='all')renderAllWorkConsolidated();else renderRecentWork();
  }

  const priorOrders=window.renderOrdersV58940;
  if(typeof priorOrders==='function'&&!priorOrders.__v6020){
    const wrapped=function(...args){renderTopSummary(false);removeLegacyWorkLayers();return priorOrders.apply(this,args);};
    wrapped.__v6020=true;window.renderOrdersV58940=wrapped;
  }

  // Final authority: these assignments intentionally come after every legacy Work wrapper.
  window.renderRecords=renderRecentWork;
  window.renderAllWorkV58930=renderAllWorkConsolidated;
  window.applyWorkTabV58930=applyWorkTab;
  try{renderRecords=renderRecentWork;}catch(_){}
  try{renderAllWorkV58930=renderAllWorkConsolidated;}catch(_){}
  try{applyWorkTabV58930=applyWorkTab;}catch(_){}

  function install(){
    if(document.body?.dataset?.app!=='desktop')return;
    removeLegacyWorkLayers();
    // The old stability listener paints its historical panel on a zero-delay timer.
    // Re-render one tick later so the consolidated Work renderer always remains final owner.
    const view=$('view-records');
    view?.addEventListener('change',event=>{
      if(['recordsMonth','recordTeamFilter','recordStatusFilter'].includes(event.target?.id||''))setTimeout(()=>{
        if(activeTab()==='recent')renderRecentWork();else if(activeTab()==='all')renderAllWorkConsolidated();
      },20);
    });
    $('recordSearch')?.addEventListener('input',()=>setTimeout(()=>{
      if(activeTab()==='recent')renderRecentWork();else if(activeTab()==='all')renderAllWorkConsolidated();
    },0));

    const marker=document.getElementById('tuinbooksBuildV59698')||document.querySelector('[id^="tuinbooksBuildV"]');
    if(marker){marker.id='tuinbooksBuildV6020';marker.textContent='v60.2.0';marker.title='TuinBooks consolidated Work';}

    if(String(window.activeView||'')==='records')applyWorkTab(activeTab());
    window.__tuinbooksWorkConsolidatedV6020={build:BUILD,render:renderRecentWork,today:todayTeamProgressRows};
    window.__tuinbooksBuild=BUILD;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
  else setTimeout(install,0);
})();
