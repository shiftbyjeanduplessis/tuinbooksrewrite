/* TuinBooks v60.4.1 — Clients list + separate record modal
   - Clients page is browse/search only; the client record never shares the page layout.
   - Full-width responsive client grid with operational status detail.
   - Opening / creating a client uses a separate modal box over the client list.
   - Closing returns to the same search results and scroll position.
   - v60.3.5 frozen Schedule, NEW R and Basket cleanup are untouched.
*/
(()=>{
  'use strict';
  const BUILD='60.4.1-client-list-modal';
  const $=id=>document.getElementById(id);
  let listScrollY=0;
  let modalOpen=false;
  let decorateFrame=0;
  let installed=false;

  function view(){return $('view-clients');}
  function form(){return $('clientForm');}
  function list(){return $('clientList');}
  function listPanel(){return view()?.querySelector('.clients-layout>.list-panel');}

  function escText(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function todayISO(){
    const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function shortDate(value){
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return String(value||'');
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${Number(match[3])} ${months[Number(match[2])-1]||''}`.trim();
  }
  function moneyShort(value){
    const number=Number(value||0);if(!(number>0))return 'Fee not set';
    return `R ${number.toLocaleString('en-ZA',{maximumFractionDigits:number%1?2:0})}/mo`;
  }
  function clientByIdLocal(id){return (window.state?.clients||[]).find(client=>String(client.id)===String(id));}
  function clientIdFromCard(card){
    if(card?.dataset?.clientId)return card.dataset.clientId;
    const source=[card?.getAttribute?.('onclick')||'',card?.querySelector?.('[onclick*="editClient"]')?.getAttribute?.('onclick')||''].join(' ');
    return (source.match(/editClient\(['"]([^'"]+)/)||[])[1]||'';
  }
  function billingProfile(client){
    const id=String(client?.billingProfileIdV59396||client?.billingProfileId||'');
    return (window.state?.billingProfilesV59396||[]).find(profile=>String(profile.id)===id)||null;
  }
  function teamName(teamId){return (window.state?.teams||[]).find(team=>String(team.id)===String(teamId))?.name||'';}
  function nextVisit(client){
    const today=todayISO();
    return (window.state?.schedules||[])
      .filter(job=>String(job.clientId)===String(client?.id)&&String(job.date||'')>=today&&String(job.status||'scheduled').toLowerCase()==='scheduled')
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0]||null;
  }
  function waitingNewR(client){
    if(client?.awaitingInitialRecurringPlacementV6036===true)return true;
    return (window.state?.scheduleBasket||[]).some(item=>{
      const id=String(item?.clientId||item?.jobPayload?.clientId||'');
      return id===String(client?.id)&&item?.newRecurringV6036===true;
    });
  }
  function isRecurring(client){return /^(weekly|fortnightly|monthly)$/i.test(String(client?.frequency||''));}
  function statusInfo(client){
    const raw=String(client?.status||'active').toLowerCase();
    if(client?.incomplete===true)return {label:'Incomplete',kind:'attention'};
    if(raw==='paused')return {label:'Paused',kind:'paused'};
    if(['archived','closed','inactive','cancelled','canceled'].includes(raw))return {label:'Archived',kind:'archived'};
    return {label:'Active',kind:'active'};
  }
  function scheduleInfo(client){
    if(waitingNewR(client))return {label:'NEW R · waiting for placement',kind:'newr'};
    const next=nextVisit(client);
    if(next){const team=teamName(next.teamId);return {label:`Next ${shortDate(next.date)}${team?` · ${team}`:''}`,kind:'scheduled'};}
    const raw=String(client?.status||'active').toLowerCase();
    if(raw==='active'&&isRecurring(client))return {label:'No future visit',kind:'attention'};
    return {label:'No active schedule',kind:'neutral'};
  }

  function installStyles(){
    if($('clientListModalStylesV6041'))return;
    const style=document.createElement('style');style.id='clientListModalStylesV6041';
    style.textContent=`
      /* CLIENTS IS A LIST PAGE — never a split editor. */
      #view-clients .clients-layout{
        display:block!important;grid-template-columns:1fr!important;gap:0!important;
        height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;
      }
      #view-clients .clients-layout>.list-panel{
        display:block!important;width:100%!important;max-width:none!important;box-sizing:border-box!important;
        height:auto!important;max-height:none!important;overflow:visible!important;padding:14px!important;
      }
      #view-clients #clientForm.form-panel{display:none!important}
      #view-clients #clientList.client-admin-list{
        display:grid!important;grid-template-columns:repeat(auto-fill,minmax(330px,1fr))!important;
        gap:12px!important;height:auto!important;max-height:none!important;overflow:visible!important;
        padding:0!important;margin-top:12px!important;
      }
      #view-clients #clientList>.client-card-v55,
      #view-clients #clientList>.client-row{
        display:grid!important;grid-template-columns:40px minmax(0,1fr) auto!important;
        grid-template-rows:auto auto!important;align-items:start!important;gap:8px 10px!important;
        min-width:0!important;height:auto!important;margin:0!important;padding:12px!important;
        border:1px solid rgba(27,83,60,.13)!important;border-radius:12px!important;background:#fff!important;
        box-shadow:0 1px 2px rgba(20,61,45,.025)!important;
      }
      #view-clients #clientList>.client-card-v55:hover,
      #view-clients #clientList>.client-row:hover{border-color:rgba(25,113,78,.32)!important;box-shadow:0 3px 10px rgba(20,61,45,.07)!important}
      #view-clients #clientList .client-page-hidden-v6038{display:grid!important}
      #view-clients #clientListPagerV6038{display:none!important}
      #view-clients #clientList .client-type-icon-v55{grid-column:1;grid-row:1/3}
      #view-clients #clientList .client-actions-v55{grid-column:3;grid-row:1;align-self:start!important}
      #view-clients #clientList .client-status-detail-v6041{
        grid-column:2/4;grid-row:2;display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;
        padding-top:8px;margin-top:2px;border-top:1px solid rgba(27,83,60,.08);font-size:11px;color:#52675e;
      }
      #view-clients #clientList .client-status-detail-v6041 .client-detail-pill-v6041{
        display:inline-flex;align-items:center;min-height:23px;padding:3px 7px;border-radius:999px;
        border:1px solid rgba(40,82,66,.12);background:#f5f8f6;font-weight:700;line-height:1.15;
      }
      #view-clients #clientList .client-detail-pill-v6041.active{background:#eaf7ef;color:#176540;border-color:#b9e3ca}
      #view-clients #clientList .client-detail-pill-v6041.paused{background:#fff5d7;color:#765600;border-color:#ead493}
      #view-clients #clientList .client-detail-pill-v6041.archived{background:#f1f3f2;color:#617068;border-color:#dce2df}
      #view-clients #clientList .client-detail-pill-v6041.attention{background:#fff0ed;color:#9d3f30;border-color:#f0c3bb}
      #view-clients #clientList .client-detail-pill-v6041.newr{background:#fff0aa;color:#684900;border-color:#d8aa12;font-weight:900}
      #view-clients #clientList .client-detail-pill-v6041.scheduled{background:#eef7ff;color:#315b78;border-color:#c9deed}
      #view-clients #clientList .client-detail-pill-v6041.billing{background:#f4f1ff;color:#57457a;border-color:#d9d0ef}
      #view-clients #clientList .client-detail-pill-v6041.fee{background:#f7f7f3;color:#4f5b52}
      #view-clients .client-filter-toolbar{
        display:grid!important;grid-template-columns:minmax(340px,2fr) repeat(4,minmax(145px,1fr))!important;
        gap:8px!important;align-items:center!important;position:static!important;
      }
      #view-clients .client-filter-toolbar>*{width:100%!important;min-width:0!important}
      #view-clients .new-client-v6041{order:-20}

      /* Separate client record box. The list remains a single full-width page behind it. */
      #clientModalBackdropV6041{
        display:none;position:fixed;inset:0;z-index:9000;background:rgba(9,30,22,.48);backdrop-filter:blur(1.5px);
      }
      body.client-record-modal-open-v6041 #clientModalBackdropV6041{display:block}
      body.client-record-modal-open-v6041{overflow:hidden!important}
      body.client-record-modal-open-v6041 #view-clients #clientForm.form-panel{
        display:block!important;position:fixed!important;z-index:9001!important;
        top:24px!important;left:50%!important;transform:translateX(-50%)!important;
        width:min(1180px,calc(100vw - 48px))!important;max-width:1180px!important;
        height:auto!important;max-height:calc(100vh - 48px)!important;overflow:auto!important;overscroll-behavior:contain!important;
        margin:0!important;padding:20px 22px 22px!important;border:1px solid rgba(20,73,51,.18)!important;
        border-radius:16px!important;background:#fff!important;box-shadow:0 24px 80px rgba(0,0,0,.28)!important;
      }
      body.client-record-modal-open-v6041 #view-clients #clientForm .form-heading{
        position:sticky!important;top:-20px!important;z-index:5!important;background:#fff!important;
        margin:-20px -22px 12px!important;padding:16px 22px 12px!important;border-bottom:1px solid rgba(27,83,60,.11)!important;
        border-radius:16px 16px 0 0!important;
      }
      body.client-record-modal-open-v6041 #view-clients #clientForm .form-actions{
        position:sticky!important;bottom:-22px!important;z-index:4!important;background:#fff!important;
        margin:18px -22px -22px!important;padding:12px 22px 16px!important;border-top:1px solid rgba(27,83,60,.11)!important;
      }
      body.client-record-modal-open-v6041 #view-clients #clientForm .client-form-grid-v58930{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px 16px!important;
      }
      #view-clients .modal-record-note-v6041{font-size:11px;color:#687b72;margin-top:2px}

      @media(max-width:1150px){
        #view-clients .client-filter-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        #view-clients .client-filter-toolbar #clientSearch{grid-column:1/-1!important}
        #view-clients #clientList.client-admin-list{grid-template-columns:repeat(auto-fill,minmax(290px,1fr))!important}
      }
      @media(max-width:720px){
        #view-clients .client-filter-toolbar{grid-template-columns:1fr!important}
        #view-clients .client-filter-toolbar #clientSearch{grid-column:auto!important}
        #view-clients #clientList.client-admin-list{grid-template-columns:1fr!important}
        body.client-record-modal-open-v6041 #view-clients #clientForm.form-panel{
          top:8px!important;width:calc(100vw - 16px)!important;max-height:calc(100vh - 16px)!important;padding:16px!important;border-radius:12px!important;
        }
        body.client-record-modal-open-v6041 #view-clients #clientForm .form-heading{top:-16px!important;margin:-16px -16px 10px!important;padding:14px 16px 10px!important}
        body.client-record-modal-open-v6041 #view-clients #clientForm .form-actions{bottom:-16px!important;margin:16px -16px -16px!important;padding:10px 16px 14px!important}
        body.client-record-modal-open-v6041 #view-clients #clientForm .client-form-grid-v58930{grid-template-columns:1fr!important}
        body.client-record-modal-open-v6041 #view-clients #clientForm .span-two{grid-column:auto!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBackdrop(){
    let backdrop=$('clientModalBackdropV6041');
    if(backdrop)return backdrop;
    backdrop=document.createElement('div');backdrop.id='clientModalBackdropV6041';backdrop.setAttribute('aria-hidden','true');
    document.body.appendChild(backdrop);
    // Deliberately do not close on backdrop click; client forms can contain unsaved changes.
    return backdrop;
  }

  function removeLegacyPagination(){
    list()?.querySelectorAll('.client-page-hidden-v6038').forEach(row=>row.classList.remove('client-page-hidden-v6038'));
    $('clientListPagerV6038')?.remove();
  }

  function decorateCards(){
    decorateFrame=0;removeLegacyPagination();
    const host=list();if(!host)return;
    [...host.children].forEach(card=>{
      if(!card.matches?.('.client-card-v55,.client-row'))return;
      const id=clientIdFromCard(card),client=clientByIdLocal(id);if(!id||!client)return;
      card.dataset.clientId=id;
      card.querySelector('.client-status-detail-v6041')?.remove();
      const status=statusInfo(client),schedule=scheduleInfo(client),profile=billingProfile(client);
      const profileName=profile?.displayName||profile?.legalName||'Invoice company not set';
      const detail=document.createElement('div');detail.className='client-status-detail-v6041';
      detail.innerHTML=`
        <span class="client-detail-pill-v6041 ${escText(status.kind)}">${escText(status.label)}</span>
        <span class="client-detail-pill-v6041 ${escText(schedule.kind)}">${escText(schedule.label)}</span>
        <span class="client-detail-pill-v6041 billing" title="Invoice from">${escText(profileName)}</span>
        <span class="client-detail-pill-v6041 fee">${escText(moneyShort(client.monthlyFee))}</span>`;
      card.appendChild(detail);
    });
  }
  function queueDecorate(){if(decorateFrame)return;decorateFrame=requestAnimationFrame(decorateCards);}

  function openModal(){
    const clientForm=form();if(!clientForm)return;
    if(!modalOpen)listScrollY=window.scrollY;
    modalOpen=true;
    ensureBackdrop();
    document.body.classList.add('client-record-modal-open-v6041');
    clientForm.setAttribute('role','dialog');clientForm.setAttribute('aria-modal','true');
    requestAnimationFrame(()=>{clientForm.scrollTop=0;($('clientName')||clientForm.querySelector('input,select,textarea'))?.focus?.({preventScroll:true});});
  }
  function closeModal({restore=true}={}){
    if(!modalOpen&&!document.body.classList.contains('client-record-modal-open-v6041'))return;
    modalOpen=false;document.body.classList.remove('client-record-modal-open-v6041');
    form()?.removeAttribute('aria-modal');
    queueDecorate();
    if(restore)requestAnimationFrame(()=>window.scrollTo({top:listScrollY,behavior:'auto'}));
  }

  function addNewClientButton(){
    const actions=view()?.querySelector('.page-heading .heading-actions');if(!actions||$('newClientBtnV6041'))return;
    const button=document.createElement('button');button.type='button';button.id='newClientBtnV6041';button.className='button new-client-v6041';button.textContent='+ New client';
    button.addEventListener('click',()=>{
      listScrollY=window.scrollY;
      try{
        if(typeof window.clearClientForm==='function')window.clearClientForm();
        else {form()?.reset();if($('clientId'))$('clientId').value='';if($('clientFormTitle'))$('clientFormTitle').textContent='New client';}
      }catch(error){console.warn('[v60.4.1] clear new client form',error);}
      openModal();
    });
    actions.prepend(button);
  }

  function wrapEditClient(){
    if(typeof window.editClient!=='function'||window.editClient.__v6041Wrapped)return;
    const base=window.editClient;
    const wrapped=function(...args){listScrollY=window.scrollY;const result=base.apply(this,args);openModal();return result;};
    wrapped.__v6041Wrapped=true;wrapped.__v6041Base=base;window.editClient=wrapped;
  }
  function wrapRenderClients(){
    if(typeof window.renderClients!=='function'||window.renderClients.__v6041Wrapped)return;
    const base=window.renderClients;
    const wrapped=function(...args){const result=base.apply(this,args);queueDecorate();return result;};
    wrapped.__v6041Wrapped=true;window.renderClients=wrapped;
  }

  function bindClose(){
    const close=$('clearClientFormBtn');if(!close||close.dataset.modalV6041==='1')return;
    close.dataset.modalV6041='1';close.title='Close client record';close.setAttribute('aria-label','Close client record');
    close.addEventListener('click',()=>closeModal(),{capture:true});
  }
  function bindArchiveClose(){
    const button=$('archiveClientBtn');if(!button||button.dataset.modalV6041==='1')return;
    button.dataset.modalV6041='1';button.addEventListener('click',()=>setTimeout(()=>{
      const id=$('clientId')?.value,client=clientByIdLocal(id),status=String(client?.status||'').toLowerCase();
      if(!client||['archived','closed','inactive','deleted'].includes(status))closeModal();
    },120));
  }
  function bindEscape(){
    if(document.body.dataset.clientModalEscapeV6041==='1')return;
    document.body.dataset.clientModalEscapeV6041='1';
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modalOpen){event.preventDefault();closeModal();}},true);
  }
  function bindClientNav(){
    document.querySelectorAll('.nav-tab[data-view="clients"]').forEach(tab=>{
      if(tab.dataset.modalV6041==='1')return;tab.dataset.modalV6041='1';
      tab.addEventListener('click',()=>{closeModal({restore:false});setTimeout(queueDecorate,0);});
    });
  }
  function observeList(){
    const host=list();if(!host||host.dataset.modalObserverV6041==='1')return;
    host.dataset.modalObserverV6041='1';new MutationObserver(queueDecorate).observe(host,{childList:true,subtree:true});
  }

  function addModalHint(){
    const heading=form()?.querySelector('.form-heading>div');if(!heading||heading.querySelector('.modal-record-note-v6041'))return;
    const note=document.createElement('div');note.className='modal-record-note-v6041';note.textContent='Client record · close to return to the client list';heading.appendChild(note);
  }

  function markBuild(){
    window.__tuinbooksBuild=BUILD;
    const marker=document.querySelector('[id^="tuinbooksBuildV"]');
    if(marker){marker.id='tuinbooksBuildV6041';marker.textContent='v60.4.1';marker.title='Full-width Client list + separate record box · frozen Schedule remains v60.3.5';}
  }

  function install(){
    if(!view()||!form()||!list())return;
    installStyles();ensureBackdrop();addNewClientButton();addModalHint();bindClose();bindArchiveClose();bindEscape();bindClientNav();observeList();
    wrapEditClient();wrapRenderClients();removeLegacyPagination();queueDecorate();markBuild();installed=true;
    // Older release markers and wrappers settle after startup. Re-assert only this Clients shell.
    setTimeout(()=>{wrapEditClient();wrapRenderClients();addNewClientButton();bindClose();observeList();removeLegacyPagination();queueDecorate();markBuild();},900);
    setTimeout(()=>{removeLegacyPagination();queueDecorate();markBuild();},3500);
    window.__tuinbooksClientListModalV6041={build:BUILD,listOnlyPage:true,recordSeparateModal:true,paginationRemoved:true,statusDetail:true,frozenScheduleUntouched:true};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
