/* TuinBooks v60.6.0 — late schedule-card layout repair
   Loaded after visit-controls so the compact card layout wins over legacy
   three-column card CSS that reserves a marker column. */
(()=>{
  const BUILD='60.6.0-schedule-card-clean-late-fix';
  function install(){
    if(document.getElementById('scheduleCardCleanStylesV6060'))return;
    const style=document.createElement('style');
    style.id='scheduleCardCleanStylesV6060';
    style.textContent=`
      /* v60.5.9 removed the R/O marker from the card DOM. Legacy styles still
         reserve a 17px first grid column for that marker, which crushed the
         client name into a narrow vertical strip. Use a true two-column card. */
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 18px!important;
        grid-template-rows:auto!important;
        min-height:48px!important;
        height:auto!important;
        padding:7px 7px 7px 10px!important;
        column-gap:7px!important;
        row-gap:0!important;
        align-items:center!important;
        overflow:hidden!important;
        box-sizing:border-box!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-copy.v6059-card-copy{
        grid-column:1!important;
        grid-row:1!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:stretch!important;
        justify-content:center!important;
        width:auto!important;
        min-width:0!important;
        overflow:hidden!important;
        gap:3px!important;
        padding:0!important;
        margin:0!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-copy strong{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        margin:0!important;
        padding:0!important;
        font-size:.72rem!important;
        line-height:1.16!important;
        font-weight:850!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        overflow-wrap:normal!important;
        word-break:normal!important;
        -webkit-line-clamp:unset!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-suburb{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        margin:0!important;
        padding:0!important;
        font-size:.61rem!important;
        line-height:1.12!important;
        font-weight:650!important;
        color:#65776e!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        overflow-wrap:normal!important;
        word-break:normal!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-info-v58931{
        grid-column:2!important;
        grid-row:1!important;
        position:static!important;
        align-self:start!important;
        justify-self:end!important;
        margin:0!important;
        width:16px!important;
        height:16px!important;
        min-width:16px!important;
        line-height:14px!important;
        font-size:.58rem!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .v59320-select-tick{
        position:absolute!important;
      }
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-work-marker,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-meta,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-duration,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .v59384-card-meta-right,
      #view-schedule .schedule-card-clean.v59384-card.v6059-minimal-card .schedule-card-resize{
        display:none!important;
      }
      /* Keep the week chrome intentionally quiet. */
      #view-schedule .rolling-plan-panel{padding-top:4px!important}
      #view-schedule .v6059-schedule-nav{margin-bottom:6px!important}
    `;
    document.head.appendChild(style);
  }
  install();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  window.__tuinbooksScheduleCardCleanBuild=BUILD;
})();
