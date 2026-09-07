/* TuinBooks R18 — true office UI recovery parity bridge.
   Loaded last on top of the established office product. It restores only the
   newer usability improvements that were explicitly protected during the rewrite:
   street address on schedule cards, visible drag ID, literal Service normally /
   Do not service control, service icons, Sunday support, and mobile DNS visibility.
*/
(()=>{
  'use strict';
  const BUILD='R18-true-office-ui-recovery';
  if(window.__TUINBOOKS_R18_UI_PARITY_BRIDGE__===BUILD)return;
  window.__TUINBOOKS_R18_UI_PARITY_BRIDGE__=BUILD;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stateNow=()=>window.state||{clients:[],schedules:[]};
  const jobById=id=>(stateNow().schedules||[]).find(row=>String(row?.id)===String(id));
  const clientById=id=>{try{return typeof window.clientById==='function'?window.clientById(id):(stateNow().clients||[]).find(c=>String(c?.id)===String(id));}catch(_){return (stateNow().clients||[]).find(c=>String(c?.id)===String(id));}};
  const clientHeld=c=>c?.doNotServiceV6053===true;
  const visitHeld=j=>j?.doNotServiceVisitR18===true||j?.doNotServiceVisitV2===true||j?.payload?.doNotServiceVisitR18===true||j?.payload?.doNotServiceVisitV2===true;

  const iconPaths={
    maintenance:'<path d="M4 20c5-1 8-4 10-9"/><path d="M9 15C5 14 3 11 3 7c4 0 7 2 8 6M14 11c0-4 2-7 7-8 0 5-2 8-7 8Z"/>',
    lawn:'<path d="M3 19h18M5 19c1-4 1-7 0-11M9 19c0-5 1-9 3-13M14 19c0-4 2-8 5-11M18 19c0-3 1-5 3-7"/>',
    edging:'<path d="M4 18h16M8 18V8l8-4v14M8 9h8"/><path d="M5 21h14"/>',
    hedge:'<path d="M4 7h16M7 4l10 6M17 4 7 10"/><path d="M6 15c3-3 9-3 12 0v5H6v-5Z"/>',
    pruning:'<circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/><path d="m9 15 8-11M15 15 7 4"/>',
    irrigation:'<path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10Z"/><path d="M9.5 14.5c.6 1 1.4 1.5 2.5 1.5"/>',
    repair:'<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-3 3-3-3 3-3Z"/>',
    tree:'<path d="M12 21v-6M8 21h8"/><path d="M12 3c-4 0-7 3-7 7 0 3 2 5 5 5h4c3 0 5-2 5-5 0-4-3-7-7-7Z"/>',
    treatment:'<path d="M9 3h6M10 3v4l-4 7v6h12v-6l-4-7V3"/><path d="M8 14h8M10 17h.01M14 17h.01"/>',
    cleanup:'<path d="m7 3 4 9M4 13h10l-2 8H6l-2-8ZM14 5h6M17 2v6"/>',
    waste:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    landscaping:'<path d="m4 20 7-7M8 16l-3-3 8-8 3 3-8 8ZM14 18h7M17 15v6"/>',
    other:'<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    blocked:'<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>'
  };
  const icon=(name,cls='')=>`<svg class="r18-service-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.other}</svg>`;
  function iconName(label=''){
    const t=String(label).toLowerCase();
    if(/irrig|water|sprink/.test(t))return 'irrigation';
    if(/tree/.test(t))return 'tree';
    if(/hedge/.test(t))return 'hedge';
    if(/prun/.test(t))return 'pruning';
    if(/edge/.test(t))return 'edging';
    if(/grass|lawn|mow/.test(t))return 'lawn';
    if(/treat|fertili|feed/.test(t))return 'treatment';
    if(/waste|refuse/.test(t))return 'waste';
    if(/clean|tidy/.test(t))return 'cleanup';
    if(/landscap|install|upgrade/.test(t))return 'landscaping';
    if(/repair/.test(t))return 'repair';
    if(/mainten|garden service/.test(t))return 'maintenance';
    return 'other';
  }

  function persist(message=''){
    try{window.save?.();}catch(error){console.warn('[R18] save warning',error);}
    try{window.queueOperationalSyncV41?.();}catch(_){}
    try{window.renderSchedule?.();}catch(_){}
    try{if(window.activeView==='clients')window.renderClients?.();}catch(_){}
    setTimeout(decorateScheduleCards,0);
    if(message)try{window.toast?.(message);}catch(_){}
  }
  function audit(entity,id,action,details={}){try{window.auditV56?.(entity,id,action,details);}catch(_){} }

  window.r18ServiceNormally=function(jobId){
    const job=jobById(jobId),client=clientById(job?.clientId);if(!job||!client)return;
    const hadVisit=visitHeld(job),hadClient=clientHeld(client);
    delete job.doNotServiceVisitR18;delete job.doNotServiceVisitV2;
    if(job.payload&&typeof job.payload==='object'){delete job.payload.doNotServiceVisitR18;delete job.payload.doNotServiceVisitV2;delete job.payload.doNotServiceVisitReasonR18;delete job.payload.doNotServiceVisitNoteR18;}
    if(hadClient){delete client.doNotServiceV6053;delete client.doNotServiceReasonV6053;delete client.doNotServiceNoteV6053;delete client.doNotServiceSinceV6053;client.updatedAt=new Date().toISOString();}
    job.updatedAt=new Date().toISOString();
    audit('schedule_job',job.id,'service_normally_restored_r18',{clientId:client.id,clearedVisitHold:hadVisit,clearedClientHold:hadClient});
    persist('Service normally restored. Do not service is cleared for this visit.');
    try{window.openScheduleJobV55?.(job.id);}catch(_){}
  };

  function visitDnsDialog(job){
    const old=document.getElementById('r18VisitDnsDialog');old?.remove();
    const d=document.createElement('dialog');d.id='r18VisitDnsDialog';d.className='dialog';
    d.innerHTML=`<div class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">This visit only</span><h2>Do not service</h2><p>The booking stays visible and future recurring visits are unchanged.</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></div><label>Reason<input data-reason value="${esc(job?.doNotServiceVisitReasonR18||'Do not service this visit')}"></label><label>Note <span class="muted-copy">optional</span><textarea data-note maxlength="250"></textarea></label><div class="dialog-actions"><button type="button" class="button secondary" data-close>Back</button><button type="button" class="button danger" data-save>Do not service this visit</button></div></div>`;
    document.body.appendChild(d);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
    d.querySelector('[data-save]').onclick=()=>{const reason=d.querySelector('[data-reason]')?.value?.trim()||'Do not service this visit',note=d.querySelector('[data-note]')?.value?.trim()||'';job.doNotServiceVisitR18=true;job.doNotServiceVisitReasonR18=reason;job.doNotServiceVisitNoteR18=note;job.updatedAt=new Date().toISOString();audit('schedule_job',job.id,'do_not_service_visit_r18',{clientId:job.clientId,reason,note});d.close();persist('This visit is marked DO NOT SERVICE.');try{window.openScheduleJobV55?.(job.id);}catch(_){}};
    d.addEventListener('close',()=>setTimeout(()=>d.remove(),0),{once:true});d.showModal();
  }
  window.r18ChooseDoNotService=function(jobId){
    const job=jobById(jobId),client=clientById(job?.clientId);if(!job||!client)return;
    const old=document.getElementById('r18DnsScopeDialog');old?.remove();
    const d=document.createElement('dialog');d.id='r18DnsScopeDialog';d.className='dialog';
    d.innerHTML=`<div class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">Do not service</span><h2>Where should it apply?</h2><p>Choose this visit only, or block servicing for the client until the office clears it.</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></div><div class="r18-dns-scope-grid"><button type="button" data-visit>${icon('blocked')}<span><b>This visit only</b><small>Future recurring visits stay normal</small></span></button><button type="button" data-client>${icon('blocked')}<span><b>Entire client</b><small>Warn office and field team on all visits</small></span></button></div><div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button></div></div>`;
    document.body.appendChild(d);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
    d.querySelector('[data-visit]').onclick=()=>{d.close();setTimeout(()=>visitDnsDialog(job),0);};
    d.querySelector('[data-client]').onclick=()=>{d.close();setTimeout(()=>window.openDoNotServiceV6053?.(client.id),0);};
    d.addEventListener('close',()=>setTimeout(()=>d.remove(),0),{once:true});d.showModal();
  };

  function serviceStatusHtml(job){
    const client=clientById(job?.clientId);if(!client)return '';
    const v=visitHeld(job),c=clientHeld(client),any=v||c;
    const note=v?(job.doNotServiceVisitNoteR18||job.doNotServiceVisitReasonR18||'This visit'):(c?(client.doNotServiceNoteV6053||client.doNotServiceReasonV6053||'Client hold'):'');
    return `<section class="r18-service-status"><div class="r18-section-heading"><strong>Service status</strong><span>Choose the normal operating state for this visit</span></div><div class="r18-service-toggle" role="group" aria-label="Service status"><button type="button" class="${any?'':'active'}" onclick="event.stopPropagation();r18ServiceNormally('${esc(job.id)}')">${icon('check')}<span><b>Service normally</b><small>${any?'Clear Do not service':'Service as planned'}</small></span></button><button type="button" class="dns ${any?'active':''}" onclick="event.stopPropagation();r18ChooseDoNotService('${esc(job.id)}')">${icon('blocked')}<span><b>Do not service</b><small>${any?esc(note):'Choose visit or client scope'}</small></span></button></div></section>`;
  }

  function decorateDetailHtml(html,job){
    try{
      const box=document.createElement('div');box.innerHTML=html;
      // The R18 two-state control owns the normal/DNS choice. Remove the older one-way action button.
      box.querySelectorAll('.dns-hold-button-v60511').forEach(n=>n.remove());
      const status=document.createElement('div');status.innerHTML=serviceStatusHtml(job);if(status.firstElementChild)box.prepend(status.firstElementChild);
      box.querySelectorAll('.confirmed-service-strip-v60512 span').forEach(chip=>{if(chip.querySelector('svg'))return;const label=chip.textContent?.trim()||'Service';chip.innerHTML=`${icon(iconName(label))}<b>${esc(label)}</b>`;chip.classList.add('r18-service-chip');});
      const client=clientById(job?.clientId);const specific=String(job?.customTasks||client?.customTasks||'').trim();
      if(specific&&!box.querySelector('.r18-specific-instructions')){
        const section=document.createElement('section');section.className='r18-specific-instructions';section.innerHTML=`<div class="r18-section-heading"><strong>Specific instructions</strong><span>For this client / visit</span></div><p>${esc(specific).replace(/\n/g,'<br>')}</p>`;
        const work=box.querySelector('.confirmed-task-card-v60512')||box.querySelector('.confirmed-service-strip-v60512');(work?.parentElement||box).appendChild(section);
      }
      return box.innerHTML;
    }catch(_){return serviceStatusHtml(job)+html;}
  }

  function wrapVisitDetail(){
    if(window.__r18VisitDetailWrapped)return true;
    const base=window.scheduleDetailJobV55;if(typeof base!=='function')return false;
    window.scheduleDetailJobV55=function(job){return decorateDetailHtml(base.apply(this,arguments),job);};
    window.__r18VisitDetailWrapped=true;return true;
  }

  function auditActionLabel(action=''){
    return String(action||'Activity').replace(/^v2_/,'').replace(/_r18$/,'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }
  function auditDate(value=''){
    try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch(_){return String(value||'');}
  }
  async function loadRecentActivityR18(force=false){
    const host=document.getElementById('r18RecentActivityRows');if(!host)return;
    if(host.dataset.loading==='1'||(host.dataset.loaded==='1'&&!force))return;
    const backend=window.backendV28,businessId=backend?.businessId,client=backend?.client;
    if(!client||!businessId){host.innerHTML='<div class="r18-audit-note"><strong>Activity becomes available after the business workspace finishes loading.</strong></div>';return;}
    host.dataset.loading='1';host.innerHTML='<div class="r18-audit-note">Loading recent activity…</div>';
    try{
      const {data,error}=await client.rpc('tuinbooks_v2_list_audit_log_r17',{p_business_id:businessId,p_limit:80});
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      host.innerHTML=rows.map(row=>`<article class="r18-audit-row"><div><strong>${esc(auditActionLabel(row.action))}</strong><span>${esc(row.entity_type||'activity')}${row.entity_id?` · ${esc(String(row.entity_id).slice(0,18))}`:''}</span></div><div class="r18-audit-meta"><span>${esc(row.actor_label||'System')}</span><time>${esc(auditDate(row.created_at))}</time></div>${row.details&&Object.keys(row.details).length?`<details><summary>Details</summary><pre>${esc(JSON.stringify(row.details,null,2))}</pre></details>`:''}</article>`).join('')||'<div class="r18-audit-note">No recorded activity yet.</div>';
      host.dataset.loaded='1';
    }catch(error){
      console.warn('[R18] Recent activity reader unavailable',error);
      host.innerHTML='<div class="r18-audit-unavailable"><strong>Recent activity database bridge is not installed yet.</strong><span>Apply <code>supabase/APPLY-R17-AUDIT-LOG.sql</code>. All other Settings functions remain available.</span></div>';
      delete host.dataset.loaded;
    }finally{delete host.dataset.loading;}
  }
  function ensureRecentActivityPanel(){
    const settings=document.getElementById('view-settings');if(!settings||document.getElementById('r18RecentActivityPanel'))return;
    const grid=settings.querySelector('.settings-grid')||settings;
    const section=document.createElement('section');section.id='r18RecentActivityPanel';section.className='panel span-two-panel r18-audit-panel';
    section.innerHTML=`<div class="section-title-row"><div><span class="eyebrow">History</span><h2>Recent activity</h2><p>Administrative and operational changes recorded by TuinBooks.</p></div><div class="dialog-actions"><button type="button" class="button secondary compact" id="r18RefreshAudit">Refresh</button></div></div><div id="r18RecentActivityRows" class="r18-audit-rows"></div>`;
    grid.appendChild(section);
    document.getElementById('r18RefreshAudit').onclick=()=>loadRecentActivityR18(true);
    if(window.activeView==='settings')loadRecentActivityR18(false);
  }

  function decorateScheduleCards(){
    try{
      document.querySelectorAll('#view-schedule [data-job-id]').forEach(card=>{
        const job=jobById(card.getAttribute('data-job-id')),client=clientById(job?.clientId);if(!job||!client)return;
        const copy=card.querySelector('.schedule-card-copy.v6059-card-copy');
        if(copy){let addr=copy.querySelector('.schedule-card-address-r18');if(!addr){addr=document.createElement('span');addr.className='schedule-card-address-r18';copy.appendChild(addr);}addr.textContent=String(client.address||'').trim()||String(client.suburb||'').trim()||'Address not set';}
        card.classList.toggle('r18-visit-dns',visitHeld(job));
        let badge=card.querySelector('.r18-visit-dns-badge');if(visitHeld(job)&&!badge){badge=document.createElement('span');badge.className='r18-visit-dns-badge';badge.textContent='DNS';card.appendChild(badge);}else if(!visitHeld(job)&&badge)badge.remove();
      });
    }catch(_){}
  }

  let dragGhost=null,dragLive=null;
  document.addEventListener('dragstart',event=>{
    const card=event.target?.closest?.('#view-schedule [data-job-id]');if(!card)return;
    const id=card.getAttribute('data-job-id')||'',job=jobById(id),client=clientById(job?.clientId),label=client?.name||'Visit';
    dragGhost=document.createElement('div');dragGhost.className='r18-drag-ghost';dragGhost.textContent=`${label} · ID ${id}`;document.body.appendChild(dragGhost);
    dragLive=document.createElement('div');dragLive.className='r18-drag-live';dragLive.innerHTML=`<strong>${esc(label)}</strong><span>Dragging visit ID ${esc(id)}</span>`;document.body.appendChild(dragLive);
    try{event.dataTransfer?.setDragImage(dragGhost,16,16);}catch(_){}
  },true);
  document.addEventListener('dragend',()=>{dragGhost?.remove();dragLive?.remove();dragGhost=null;dragLive=null;},true);
  document.addEventListener('drop',()=>setTimeout(()=>{dragGhost?.remove();dragLive?.remove();dragGhost=null;dragLive=null;},0),true);

  function installStyles(){if(document.getElementById('r18UiParityStyles'))return;const s=document.createElement('style');s.id='r18UiParityStyles';s.textContent=`
    #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card{min-height:61px!important}
    #view-schedule .schedule-card-copy.v6059-card-copy{gap:2px!important}
    #view-schedule .schedule-card-address-r18{display:block;max-width:100%;font-size:.57rem;line-height:1.12;font-weight:650;color:#435f52;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #view-schedule .r18-visit-dns{outline:2px solid #a63d32!important;outline-offset:-2px}
    .r18-visit-dns-badge{position:absolute;left:5px;bottom:3px;background:#8d2c24;color:#fff;border-radius:999px;padding:2px 5px;font-size:8px;font-weight:900;z-index:4}
    .r18-service-status{margin:0 0 14px;padding:14px;border:1px solid #d8e5de;border-radius:14px;background:#f8fbfa}
    .r18-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:9px}.r18-section-heading>strong{color:#153f31}.r18-section-heading>span{font-size:.76rem;color:#6b7d74}
    .r18-service-toggle,.r18-dns-scope-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .r18-service-toggle>button,.r18-dns-scope-grid>button{display:flex;align-items:center;gap:10px;min-height:64px;padding:10px 12px;border:1px solid #d5e3dc;border-radius:12px;background:#fff;color:#244b3b;text-align:left;cursor:pointer}
    .r18-service-toggle>button.active{border-color:#247354;background:#edf7f2;box-shadow:0 0 0 2px rgba(36,115,84,.08)}.r18-service-toggle>button.dns.active,.r18-service-toggle>button.dns:hover,.r18-dns-scope-grid>button:hover{border-color:#a84a40;background:#fff5f3}
    .r18-service-toggle b,.r18-dns-scope-grid b{display:block;font-size:.84rem}.r18-service-toggle small,.r18-dns-scope-grid small{display:block;margin-top:2px;color:#6c7c75;font-size:.7rem;line-height:1.25}
    .r18-service-icon{width:21px;height:21px;flex:0 0 21px}.confirmed-service-strip-v60512 .r18-service-chip{display:inline-flex!important;align-items:center;gap:6px;padding:7px 9px!important;border-radius:10px!important}.confirmed-service-strip-v60512 .r18-service-chip .r18-service-icon{width:17px;height:17px;flex-basis:17px}.confirmed-service-strip-v60512 .r18-service-chip b{font-size:.76rem}
    .r18-specific-instructions{margin-top:10px;padding:12px 13px;border:1px solid #dde7e2;border-radius:12px;background:#fff}.r18-specific-instructions p{margin:0;color:#395649;font-size:.82rem;line-height:1.45}
    .r18-drag-ghost{position:fixed;left:-10000px;top:-10000px;z-index:999999;padding:9px 12px;border:2px solid #1f6f54;border-radius:10px;background:#fff;color:#143f31;font-weight:850;box-shadow:0 8px 22px rgba(0,0,0,.18)}
    .r18-drag-live{position:fixed;right:18px;bottom:18px;z-index:999999;display:grid;gap:2px;max-width:min(420px,calc(100vw - 36px));padding:10px 13px;border:1px solid #2c7a5d;border-radius:11px;background:#f0faf5;color:#143f31;box-shadow:0 8px 24px rgba(20,63,49,.2);pointer-events:none}.r18-drag-live strong{font-size:.84rem}.r18-drag-live span{font-size:.72rem;color:#527066;overflow-wrap:anywhere}
    .r18-audit-panel{align-self:start}.r18-audit-rows{display:grid;gap:7px;margin-top:10px}.r18-audit-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 14px;border:1px solid #e0e7e3;border-radius:10px;padding:10px 11px;background:#fcfdfc}.r18-audit-row>div:first-child{display:grid;gap:2px;min-width:0}.r18-audit-row strong{font-size:.78rem;color:#304238}.r18-audit-row span,.r18-audit-row time{font-size:.68rem;color:#6d7b73}.r18-audit-meta{display:grid;justify-items:end;gap:2px;text-align:right}.r18-audit-row details{grid-column:1/-1}.r18-audit-row summary{cursor:pointer;font-size:.68rem;color:#617269}.r18-audit-row pre{max-height:180px;overflow:auto;margin:6px 0 0;padding:8px;border-radius:7px;background:#f2f5f3;font-size:.62rem;white-space:pre-wrap;word-break:break-word}.r18-audit-note,.r18-audit-unavailable{border:1px solid #e0e7e3;border-radius:9px;padding:10px;color:#5c7066;font-size:.76rem;background:#fff}.r18-audit-unavailable{display:grid;gap:4px;border-color:#ead9a5;background:#fff9e8}.r18-audit-unavailable strong{color:#6f560f}.r18-audit-unavailable span{color:#786b47}
    @media(max-width:680px){.r18-service-toggle,.r18-dns-scope-grid,.r18-audit-row{grid-template-columns:1fr}.r18-section-heading{display:grid;gap:2px}.r18-audit-meta{justify-items:start;text-align:left}}
  `;document.head.appendChild(s);}

  installStyles();
  const install=()=>{wrapVisitDetail();decorateScheduleCards();ensureRecentActivityPanel();if(window.activeView==='settings')loadRecentActivityR18(false);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  let observerQueued=false;
  const observer=new MutationObserver(()=>{if(observerQueued)return;observerQueued=true;requestAnimationFrame(()=>{observerQueued=false;wrapVisitDetail();decorateScheduleCards();ensureRecentActivityPanel();if(window.activeView==='settings')loadRecentActivityR18(false);});});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.__TUINBOOKS_RELEASE_R18__=BUILD;
})();
