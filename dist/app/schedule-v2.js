(()=>{
  'use strict';
  const bridge=()=>window.parent?.TuinBooksScheduleV2Bridge;
  const $=id=>document.getElementById(id);
  const state={weekStart:'',snapshot:null,rearrange:false,scope:'once',basketOpen:false,selectedJob:null,drag:null,search:'',loading:false};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plus=(iso,n)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  const monday=iso=>{const d=new Date(`${iso}T12:00:00`),x=(d.getDay()+6)%7;d.setDate(d.getDate()-x);return d.toISOString().slice(0,10);};
  const fmt=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString('en-ZA',{day:'2-digit',month:'short'});
  const dayShort=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString('en-ZA',{weekday:'short'}).toUpperCase();
  const clientMap=()=>new Map((state.snapshot?.clients||[]).map(c=>[String(c.id),c]));
  const teamMap=()=>new Map((state.snapshot?.teams||[]).map(t=>[String(t.id),t]));
  const setSave=(text,error=false)=>{const el=$('saveState');if(el){el.textContent=text;el.classList.toggle('error',!!error);}};

  async function refresh(forceWeek=''){
    if(state.loading)return;state.loading=true;$('loading')?.classList.remove('hidden');
    try{
      const b=bridge();if(!b)throw new Error('Schedule V2 bridge is not available. Reload TuinBooks.');
      const wanted=forceWeek||state.weekStart||monday(new Date().toISOString().slice(0,10));
      const snap=await b.getSnapshot(wanted);if(!snap?.ready)throw new Error('TuinBooks is still loading the business workspace.');
      state.snapshot=snap;state.weekStart=snap.weekStart;render();setSave('Ready');
    }catch(error){console.error(error);setSave('Error',true);$('calendar').innerHTML=`<div class="empty">${esc(error.message||error)}</div>`;}
    finally{state.loading=false;$('loading')?.classList.add('hidden');}
  }

  function render(){
    const s=state.snapshot;if(!s)return;
    document.body.classList.toggle('rearrange',state.rearrange);
    $('weekLabel').textContent=`${fmt(s.dates[0])}–${fmt(s.dates.at(-1))}`;
    $('scopeOnce').classList.toggle('active',state.scope==='once');$('scopeFuture').classList.toggle('active',state.scope==='future');
    $('finishBtn').textContent=state.rearrange?'Finish moving':'Rearrange';$('finishBtn').classList.toggle('primary',state.rearrange);
    renderHorizon();renderBasket();renderCalendar();renderDetail();
  }

  function renderHorizon(){
    $('horizon').innerHTML=(state.snapshot.weeks||[]).map(w=>`<button data-week="${esc(w.weekStart)}" class="${w.weekStart===state.weekStart?'active':''}"><b>${esc(fmt(w.weekStart))}</b><small>${w.count} visits · ${Number(w.hours||0).toFixed(1)}h</small></button>`).join('');
  }

  function filteredBasket(){
    const term=state.search.trim().toLowerCase();return (state.snapshot?.basket||[]).filter(x=>!term||`${x.name} ${x.label} ${x.meta} ${x.group}`.toLowerCase().includes(term));
  }
  function basketGroups(){
    const m=new Map();for(const item of filteredBasket()){const g=item.group||item.label||'Basket';if(!m.has(g))m.set(g,[]);m.get(g).push(item);}return [...m.entries()];
  }
  function basketContent(){
    const rows=filteredBasket();if(!rows.length)return '<div class="empty">The basket is empty.</div>';
    return basketGroups().map(([g,items])=>`<div class="basket-group-title">${esc(g)} · ${items.length}</div>${items.map(item=>`<div class="basket-card" draggable="${state.rearrange?'true':'false'}" data-queue-key="${esc(item.queueKey)}"><span class="marker">${esc(item.marker||'•')}</span><div><strong>${esc(item.name)}</strong><small>${esc([item.label,item.meta].filter(Boolean).join(' · '))}</small></div></div>`).join('')}`).join('');
  }
  function renderBasket(){
    const count=state.snapshot?.basket?.length||0;$('basketCount').textContent=count;$('basketTitleCount').textContent=count;
    $('basketList').innerHTML=basketContent();$('drawerBasketList').innerHTML=basketContent();
    $('basketSearch').value=state.search;$('drawerSearch').value=state.search;
    $('drawerBackdrop').classList.toggle('open',state.basketOpen&&!state.rearrange);
  }

  function actionsFor(teamId,date){return (state.snapshot?.actions||[]).filter(a=>String(a.teamId)===String(teamId)&&a.date===date);}
  function jobsFor(teamId,date){return (state.snapshot?.jobs||[]).filter(j=>String(j.teamId)===String(teamId)&&j.date===date).sort((a,b)=>a.sort-b.sort);}
  function jobHtml(job){
    const c=clientMap().get(String(job.clientId))||{},status=String(job.status||'scheduled').toLowerCase();
    return `<div class="job ${status==='completed'?'completed':''} ${status.includes('miss')?'missed':''}" data-job-id="${esc(job.id)}" draggable="${state.rearrange?'true':'false'}" title="${esc(c.name||'Visit')}"><strong>${esc(c.name||'Unknown client')}</strong>${c.suburb?`<small>${esc(c.suburb)}</small>`:''}</div>`;
  }
  function dropZone(teamId,date,index){return state.rearrange?`<div class="drop-zone" data-drop-team="${esc(teamId)}" data-drop-date="${esc(date)}" data-drop-index="${index}"></div>`:'';}
  function renderCalendar(){
    const s=state.snapshot,today=s.today;
    let html=`<div class="board"><div class="cell corner">Team</div>${s.dates.map(d=>`<div class="cell day-head ${d===today?'today':''}">${esc(dayShort(d))}<span>${esc(fmt(d).split(' ')[0])}</span></div>`).join('')}`;
    for(const team of s.teams){
      html+=`<div class="cell team-head" style="--team:${esc(team.colour)}">${esc(team.name)}${team.leaderName?`<small>${esc(team.leaderName)}</small>`:''}</div>`;
      for(const date of s.dates){
        const jobs=jobsFor(team.id,date),actions=actionsFor(team.id,date),past=date<today;
        html+=`<div class="cell day-cell ${past?'past':''}" data-day-team="${esc(team.id)}" data-day-date="${esc(date)}">${actions.map(a=>`<div class="action ${a.kind==='internal_event'?'event':''}" title="${esc(a.detail||'')}">${a.kind==='team_note'?'NOTE':'EVENT'} · ${esc(a.title||a.detail||'')}</div>`).join('')}${dropZone(team.id,date,0)}${jobs.map((j,i)=>jobHtml(j)+dropZone(team.id,date,i+1)).join('')}</div>`;
      }
    }
    html+='</div>';$('calendar').innerHTML=html;
  }

  function renderDetail(){
    const panel=$('sidePanel');if(!state.selectedJob){panel.classList.remove('open');return;}
    const j=state.snapshot?.jobs?.find(x=>String(x.id)===String(state.selectedJob));if(!j){state.selectedJob=null;panel.classList.remove('open');return;}
    const c=clientMap().get(String(j.clientId))||{},t=teamMap().get(String(j.teamId))||{};
    $('detailTitle').textContent=c.name||'Visit';$('detailBody').innerHTML=`<div class="detail-grid"><div><span>Date</span><strong>${esc(j.date)}</strong></div><div><span>Team</span><strong>${esc(t.name||'—')}</strong></div><div><span>Status</span><strong>${esc(j.status)}</strong></div><div><span>Type</span><strong>${j.workMarker==='R'?'Recurring':'Once-off'}</strong></div><div class="full"><span>Area / address</span><strong>${esc(c.address||c.suburb||'Not recorded')}</strong></div><div><span>Duration</span><strong>${Number(j.estimatedHours||0).toFixed(1)}h</strong></div><div><span>Frequency</span><strong>${esc(c.frequency||'—')}</strong></div></div>${state.rearrange?`<div class="detail-actions"><button class="btn" id="moveToBasket">Move to basket</button></div>`:''}`;
    panel.classList.add('open');$('moveToBasket')?.addEventListener('click',async()=>{setSave('Saving…');const r=await bridge().moveJobToBasket(j.id);if(!r.ok){setSave(r.error||'Failed',true);return;}state.selectedJob=null;await refresh(state.weekStart);});
  }

  async function moveDrag(target){
    if(!state.drag)return;setSave('Saving…');
    let result;
    if(state.drag.type==='job')result=await bridge().moveJob({jobId:state.drag.id,teamId:target.teamId,date:target.date,index:target.index,scope:state.scope});
    else result=await bridge().placeBasket({queueKey:state.drag.queueKey,teamId:target.teamId,date:target.date,index:target.index});
    state.drag=null;if(!result?.ok){setSave(result?.error||'Move failed',true);return;}await refresh(state.weekStart);
  }

  function bind(){
    $('prevBtn').onclick=()=>refresh(plus(state.weekStart,-7));$('todayBtn').onclick=()=>refresh(monday(state.snapshot?.today||new Date().toISOString().slice(0,10)));$('nextBtn').onclick=()=>refresh(plus(state.weekStart,7));
    $('scopeOnce').onclick=()=>{state.scope='once';render();};$('scopeFuture').onclick=()=>{state.scope='future';render();};
    $('finishBtn').onclick=()=>{state.rearrange=!state.rearrange;state.basketOpen=false;render();};
    $('basketStrip').onclick=()=>{state.basketOpen=true;renderBasket();};$('drawerClose').onclick=()=>{state.basketOpen=false;renderBasket();};$('drawerBackdrop').onclick=e=>{if(e.target===e.currentTarget){state.basketOpen=false;renderBasket();}};
    const search=e=>{state.search=e.target.value||'';renderBasket();};$('basketSearch').oninput=search;$('drawerSearch').oninput=search;
    $('closeDetail').onclick=()=>{state.selectedJob=null;renderDetail();};
    $('refreshRolling').onclick=async()=>{setSave('Refreshing…');const r=await bridge().refreshRolling();if(!r.ok){setSave(r.error||'Refresh failed',true);return;}await refresh(state.weekStart);};
    $('addNote').onclick=()=>openActionModal('team_note');$('addEvent').onclick=()=>openActionModal('internal_event');$('actionCancel').onclick=closeActionModal;
    $('actionForm').onsubmit=submitAction;
    $('horizon').addEventListener('click',e=>{const b=e.target.closest('[data-week]');if(b)refresh(b.dataset.week);});
    $('calendar').addEventListener('click',e=>{const j=e.target.closest('[data-job-id]');if(j&&!state.rearrange){state.selectedJob=j.dataset.jobId;renderDetail();}});
    $('calendar').addEventListener('dragstart',e=>{const j=e.target.closest('[data-job-id]');if(j&&state.rearrange){state.drag={type:'job',id:j.dataset.jobId};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',j.dataset.jobId);}});
    document.addEventListener('dragstart',e=>{const b=e.target.closest?.('[data-queue-key]');if(b&&state.rearrange){state.drag={type:'basket',queueKey:b.dataset.queueKey};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',b.dataset.queueKey);}});
    $('calendar').addEventListener('dragover',e=>{if(!state.rearrange||!state.drag)return;const z=e.target.closest('[data-drop-team]'),cell=e.target.closest('[data-day-team]');if(z||cell){e.preventDefault();const el=z||cell;document.querySelectorAll('.drop-zone.active').forEach(n=>n.classList.remove('active'));if(z)z.classList.add('active');cell?.classList.add('drop-target');}});
    $('calendar').addEventListener('dragleave',e=>{const cell=e.target.closest?.('[data-day-team]');if(cell&&!cell.contains(e.relatedTarget))cell.classList.remove('drop-target');});
    $('calendar').addEventListener('drop',async e=>{if(!state.rearrange||!state.drag)return;const z=e.target.closest('[data-drop-team]'),cell=e.target.closest('[data-day-team]');if(!z&&!cell)return;e.preventDefault();const teamId=(z||cell).dataset.dropTeam||(z||cell).dataset.dayTeam,date=(z||cell).dataset.dropDate||(z||cell).dataset.dayDate,index=z?Number(z.dataset.dropIndex):jobsFor(teamId,date).length;document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));await moveDrag({teamId,date,index});});
    $('basketPanel').addEventListener('dragover',e=>{if(state.rearrange&&state.drag?.type==='job'){e.preventDefault();}});
    $('basketPanel').addEventListener('drop',async e=>{if(!state.rearrange||state.drag?.type!=='job')return;e.preventDefault();setSave('Saving…');const r=await bridge().moveJobToBasket(state.drag.id);state.drag=null;if(!r.ok){setSave(r.error||'Move failed',true);return;}await refresh(state.weekStart);});
    window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data?.type==='tuinbooks-schedule-v2-refresh')refresh(state.weekStart);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){state.basketOpen=false;state.selectedJob=null;closeActionModal();renderBasket();renderDetail();}});
  }

  function openActionModal(kind){
    const s=state.snapshot;state.actionKind=kind;$('actionTitle').textContent=kind==='team_note'?'Add day instruction':'Add ad-hoc event';$('actionTeam').innerHTML=s.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');$('actionDate').value=s.dates[0];$('actionTimeWrap').style.display=kind==='internal_event'?'block':'none';$('actionName').value='';$('actionDetail').value='';$('actionTime').value='';$('actionModal').classList.add('open');
  }
  function closeActionModal(){$('actionModal').classList.remove('open');}
  async function submitAction(e){e.preventDefault();setSave('Saving…');const r=await bridge().addAction({kind:state.actionKind,teamId:$('actionTeam').value,date:$('actionDate').value,time:$('actionTime').value,title:$('actionName').value,detail:$('actionDetail').value});if(!r.ok){setSave(r.error||'Save failed',true);return;}closeActionModal();await refresh(state.weekStart);}

  bind();refresh();
})();
