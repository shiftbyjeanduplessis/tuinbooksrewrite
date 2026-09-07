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

  const BUILD='60.2.1-work-compact-evidence-production';
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

  function photoSources(item){
    const visit=item?.visit||{};
    const urls=(Array.isArray(visit.photos)?visit.photos:[]).filter(src=>typeof src==='string'&&/^(?:data:|https?:|blob:|\/)/i.test(src));
    const paths=(Array.isArray(visit.photoPaths)?visit.photoPaths:[]).filter(Boolean);
    return {urls,paths,count:Math.max(urls.length,paths.length)};
  }

  function taskRows(item){
    const visit=item?.visit||{},job=item?.job||{},client=item?.client||{};
    if(Array.isArray(visit.taskOutcomesV56)&&visit.taskOutcomesV56.length){
      return visit.taskOutcomesV56.map(row=>({task:String(row?.task||'Task'),outcome:String(row?.outcome||'Not recorded'),note:String(row?.note||'')}));
    }
    if(Array.isArray(visit.workDone)&&visit.workDone.length){
      return visit.workDone.map(task=>({task:String(task),outcome:'Done',note:''}));
    }
    const planned=[];
    for(const source of [job.tasks,job.workItems,job.checklist,client.customTasks,client.tasks]){
      if(Array.isArray(source))source.forEach(value=>{const text=String(value?.task||value?.name||value||'').trim();if(text&&!planned.includes(text))planned.push(text);});
    }
    if(!planned.length&&String(client.serviceDescription||'').trim())planned.push(String(client.serviceDescription).trim());
    return planned.map(task=>({task,outcome:'Pending',note:''}));
  }

  function taskClass(outcome){
    const value=String(outcome||'').toLowerCase();
    if(value==='done'||value==='completed'||value.includes('complete'))return'done';
    if(value.includes('pending')||value.includes('not recorded'))return'pending';
    if(value.includes('not required')||value.includes('n/a'))return'neutral';
    return'issue';
  }

  function completionTime(visit){
    const raw=visit?.completedAt||visit?.resolvedAt||'';
    if(!raw)return'';
    const date=new Date(raw);if(Number.isNaN(date.getTime()))return'';
    return date.toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'});
  }

  function durationLabel(visit){
    const minutes=Number(visit?.actualMinutes||visit?.durationMinutes||0);
    if(minutes>0)return`${Math.round(minutes)} min`;
    const hours=Number(visit?.actualHours||0);if(hours>0)return`${Math.round(hours*60)} min`;
    const start=visit?.startedAt?new Date(visit.startedAt):null,end=visit?.completedAt?new Date(visit.completedAt):null;
    if(start&&end&&!Number.isNaN(start.getTime())&&!Number.isNaN(end.getTime())&&end>start)return`${Math.max(1,Math.round((end-start)/60000))} min`;
    return'';
  }

  function evidenceSummary(item,rows){
    const visit=item?.visit||{},status=itemStatus(item);
    const done=rows.filter(row=>taskClass(row.outcome)==='done').map(row=>row.task).filter(Boolean);
    const issues=rows.filter(row=>taskClass(row.outcome)==='issue').map(row=>row.task).filter(Boolean);
    const shorten=list=>list.slice(0,3).join(' · ')+(list.length>3?` +${list.length-3}`:'');
    if(done.length){
      let text=`Done: ${shorten(done)}`;
      if(String(visit.extraDescription||'').trim())text+=` · Extra: ${String(visit.extraDescription).trim()}`;
      return text;
    }
    if(issues.length)return`Attention: ${shorten(issues)}`;
    if(visit&&String(visit.outcomeNote||'').trim())return String(visit.outcomeNote).trim();
    if(status.key==='scheduled'){
      const planned=rows.map(row=>row.task).filter(Boolean);return planned.length?`Planned: ${shorten(planned)}`:'Waiting for field report';
    }
    return visit?String(visit.outcome||status.label||'Work recorded'):'Waiting for field report';
  }

  function invoiceForVisit(visit){
    if(!visit)return null;
    const invoices=state().invoices||[];
    if(visit.invoiceId){const direct=invoices.find(invoice=>String(invoice?.id)===String(visit.invoiceId));if(direct)return direct;}
    const id=String(visit.id||'');
    const exact=invoices.find(invoice=>String(invoice?.sourceVisitIdV59376||invoice?.sourceVisitId||'')===id||(invoice?.lineItems||[]).some(line=>String(line?.sourceVisitId||line?.sourceVisitIdV59376||'')===id));
    if(exact)return exact;
    const date=String(visit.date||'').slice(0,10),month=date.slice(0,7);
    return invoices.find(invoice=>String(invoice?.clientId||'')===String(visit.clientId||'')&&String(invoice?.month||'')===month&&(invoice?.serviceCoverageV59383?.completedDates||[]).some(value=>String(value).slice(0,10)===date))||null;
  }

  function billingChip(item){
    const visit=item?.visit;if(!visit)return'';
    const invoice=invoiceForVisit(visit);
    if(!invoice)return '<span class="work-chip-v59386 billing-missing">Billing not linked</span>';
    const paid=String(invoice.paymentStatus||invoice.status||'').toLowerCase()==='paid';
    if(paid)return '<span class="work-chip-v59386 billing-paid">Paid</span>';
    if(invoice.sentAt||String(invoice.status||'').toLowerCase()==='sent')return '<span class="work-chip-v59386 billing-sent">Invoiced</span>';
    if(invoice.billingDueStateV59379==='needs_cycle')return '<span class="work-chip-v59386 billing-blocked">Cycle date needed</span>';
    if(invoice.needsOfficeReview===true||invoice.sendableStatusV59379==='blocked')return '<span class="work-chip-v59386 billing-blocked">Billing review</span>';
    return '<span class="work-chip-v59386 billing-ready">Draft</span>';
  }

  function photoHtml(item){
    const visit=item?.visit||{},photos=photoSources(item),categories=Array.isArray(visit.photoCategories)?visit.photoCategories:[];
    if(!photos.count)return '<p class="work-empty-detail-v59386">No internal job photos were captured.</p>';
    const visual=Array.from({length:photos.count},(_,index)=>{
      const src=photos.urls[index]||'',label=categories[index]||`Photo ${index+1}`;
      if(src)return`<button type="button" class="work-photo-thumb-v59386" data-work-photo-v6021="${esc(visit.id||'')}" data-work-photo-index-v6021="${index}"><img loading="lazy" src="${esc(src)}" alt="${esc(label)}"><span>${esc(label)}</span></button>`;
      return`<div class="work-photo-thumb-v59386 stored"><span>${esc(label)}<small>Stored securely</small></span></div>`;
    }).join('');
    return`<div class="work-photo-grid-v59386">${visual}</div>`;
  }

  function taskListHtml(rows){
    if(!rows.length)return '<p class="work-empty-detail-v59386">No task details were captured for this job.</p>';
    return`<div class="work-task-list-v59386">${rows.map(row=>{const cls=taskClass(row.outcome);return`<div class="work-task-row-v59386 ${cls}"><span aria-hidden="true">${cls==='done'?'✓':cls==='issue'?'!':'•'}</span><div><strong>${esc(row.task)}</strong><small>${esc(row.outcome)}${row.note?` · ${esc(row.note)}`:''}</small></div></div>`;}).join('')}</div>`;
  }

  function itemCard(item){
    if(itemStatus(item).key==='reference')return referenceCard(item);
    const client=item.client||{},visit=item.visit||null,job=item.job||null,status=itemStatus(item),team=teamFor(visit?.teamId||job?.teamId),rows=taskRows(item),done=rows.filter(row=>taskClass(row.outcome)==='done').length,photos=photoSources(item),completed=completionTime(visit),scheduled=String(job?.startTime||job?.time||job?.slotTime||''),duration=durationLabel(visit),address=[client.address,client.suburb].filter(Boolean).join(' · '),evidence=evidenceSummary(item,rows);
    const cardClass=status.key==='scheduled'?'pending':status.key;
    const chipClass=status.key==='scheduled'?'pending':status.key;
    const marker=(job||visit?.scheduled)?'R':'O';
    const eventLabel=status.key==='completed'?'Completed':visit?'Recorded':'Scheduled';
    const eventTime=completed||scheduled;
    return`<details class="work-job-card-v59386 work-evidence-card-v6021 ${esc(cardClass)}"><summary><span class="work-marker-v59386 marker-${marker.toLowerCase()}">${marker}</span><div class="work-job-main-v59386"><strong>${esc(client.name||client.address||'Unknown client')}</strong><small>${esc(address||'No site address')} · ${esc(team?.name||'No team')}${eventTime?` · ${eventLabel} ${esc(eventTime)}`:''}</small><small class="work-evidence-line-v6021">${esc(evidence)}</small></div><div class="work-job-summary-v59386"><span class="work-chip-v59386 ${esc(chipClass)}">${esc(status.label)}</span>${rows.length?`<span class="work-chip-v59386 tasks">${done}/${rows.length} tasks</span>`:''}${photos.count?`<span class="work-chip-v59386 photos">📷 ${photos.count}</span>`:''}${billingChip(item)}</div><span class="work-chevron-v59386" aria-hidden="true"></span></summary><div class="work-job-detail-v59386"><div class="work-detail-meta-v59386"><span><small>Service date</small><strong>${esc(fmtDate(item.date))}</strong></span><span><small>Status</small><strong>${esc(status.label)}</strong></span>${eventTime?`<span><small>${eventLabel}</small><strong>${esc(eventTime)}</strong></span>`:''}${duration?`<span><small>Actual duration</small><strong>${esc(duration)}</strong></span>`:''}</div><section><h4>Work done</h4>${taskListHtml(rows)}</section>${visit?.outcomeNote?`<section class="work-note-v59386"><h4>Field note</h4><p>${esc(visit.outcomeNote).replace(/\n/g,'<br>')}</p></section>`:''}${visit?.extraDescription?`<section class="work-extra-v59386"><h4>Additional work / extra</h4><p>${esc(visit.extraDescription)}</p></section>`:''}<section><h4>Photos</h4>${photoHtml(item)}</section>${visit?`<div class="work-card-actions-v59386"><button type="button" class="button secondary compact" data-work-correct-v6021="${esc(visit.id||'')}">Correct / reopen</button><button type="button" class="button secondary compact" data-work-history-v6021="${esc(visit.id||'')}">Connected records</button></div>`:''}</div></details>`;
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
    document.body.dataset.workConsolidated='v6021';
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
  if(typeof priorOrders==='function'&&!priorOrders.__v6021){
    const wrapped=function(...args){renderTopSummary(false);removeLegacyWorkLayers();return priorOrders.apply(this,args);};
    wrapped.__v6021=true;window.renderOrdersV58940=wrapped;
  }

  // Final authority: these assignments intentionally come after every legacy Work wrapper.
  window.renderRecords=renderRecentWork;
  window.renderAllWorkV58930=renderAllWorkConsolidated;
  window.applyWorkTabV58930=applyWorkTab;
  try{renderRecords=renderRecentWork;}catch(_){}
  try{renderAllWorkV58930=renderAllWorkConsolidated;}catch(_){}
  try{applyWorkTabV58930=applyWorkTab;}catch(_){}

  function openPhotoDialog(visitId,index){
    const visit=(state().visits||[]).find(row=>String(row?.id||'')===String(visitId||''));if(!visit)return;
    const item={visit},photos=photoSources(item),src=photos.urls[index];if(!src)return;
    let dialog=$('workPhotoDialogV6021');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='workPhotoDialogV6021';dialog.className='work-photo-dialog-v59386';document.body.appendChild(dialog);}
    dialog.innerHTML=`<div class="work-photo-dialog-head-v59386"><div><span class="eyebrow">Internal job photo</span><strong>Work photo</strong><small>${esc(fmtDate(visit.date))} · Photo ${index+1} of ${photos.count}</small></div><button type="button" class="icon-button" data-close-work-photo-v6021 aria-label="Close">×</button></div><img src="${esc(src)}" alt="Internal job photo"><p>Internal operational record.</p>`;
    dialog.querySelector('[data-close-work-photo-v6021]')?.addEventListener('click',()=>dialog.close());dialog.showModal();
  }

  function install(){
    if(document.body?.dataset?.app!=='desktop')return;
    removeLegacyWorkLayers();
    document.addEventListener('click',event=>{
      const photo=event.target.closest?.('[data-work-photo-v6021]');
      if(photo){event.preventDefault();event.stopPropagation();openPhotoDialog(photo.getAttribute('data-work-photo-v6021'),Number(photo.getAttribute('data-work-photo-index-v6021')||0));return;}
      const correct=event.target.closest?.('[data-work-correct-v6021]');
      if(correct){event.preventDefault();event.stopPropagation();window.openVisitCorrectionV56?.(correct.getAttribute('data-work-correct-v6021'));return;}
      const history=event.target.closest?.('[data-work-history-v6021]');
      if(history){event.preventDefault();event.stopPropagation();window.openRecordHistoryV58930?.('visit',history.getAttribute('data-work-history-v6021'));return;}
    });
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
    if(marker){marker.id='tuinbooksBuildV6021';marker.textContent='v60.2.1';marker.title='TuinBooks compact Work evidence';}

    if(String(window.activeView||'')==='records')applyWorkTab(activeTab());
    window.__tuinbooksWorkConsolidatedV6021={build:BUILD,render:renderRecentWork,today:todayTeamProgressRows};
    window.__tuinbooksBuild=BUILD;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
  else setTimeout(install,0);
})();
