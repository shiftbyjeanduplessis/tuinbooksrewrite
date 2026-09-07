/* =========================================================
   TuinBooks v59.6.60 — Calendar one-month history
   ---------------------------------------------------------
   Purpose
   - Keep the existing 8-week FUTURE rolling-generation horizon unchanged.
   - Expose the previous 4 schedule weeks for historical navigation.
   - Add Previous week / Today / Next week controls to the visible Schedule UI.
   - Historical weeks are views of existing records only. This patch never
     generates, rewrites, or deletes past appointments.
   ========================================================= */
const TUINBOOKS_CALENDAR_HISTORY_V59660='59.6.60-calendar-one-month-history';

function calendarCurrentWeekV59660(){
  return startOfWeek(localDateISO());
}
function calendarMinWeekV59660(){
  return dateAdd(calendarCurrentWeekV59660(),-28);
}
function calendarMaxWeekV59660(){
  return dateAdd(calendarCurrentWeekV59660(),49);
}
function calendarSelectedWeekV59660(){
  return startOfWeek($('scheduleWeekPicker')?.value||localDateISO());
}
function calendarClampWeekV59660(value){
  const target=startOfWeek(value||localDateISO());
  const min=calendarMinWeekV59660(),max=calendarMaxWeekV59660();
  if(target<min)return min;
  if(target>max)return max;
  return target;
}
function calendarSetWeekV59660(value){
  const picker=$('scheduleWeekPicker');
  if(!picker)return;
  picker.value=calendarClampWeekV59660(value);
  renderSchedule();
}
window.shiftScheduleWeekV59660=function shiftScheduleWeekV59660(delta){
  const selected=calendarSelectedWeekV59660();
  calendarSetWeekV59660(dateAdd(selected,Number(delta||0)*7));
};
window.goToCurrentScheduleWeekV59660=function goToCurrentScheduleWeekV59660(){
  calendarSetWeekV59660(calendarCurrentWeekV59660());
};

function calendarHistoricalWeekStartsV59660(){
  const current=calendarCurrentWeekV59660();
  return [-28,-21,-14,-7].map(days=>dateAdd(current,days));
}
function calendarJobVisibleV59660(job){
  if(!job)return false;
  if(typeof scheduleRowIsOperationalV59330==='function'){
    try{return !!scheduleRowIsOperationalV59330(job);}catch(error){}
  }
  return String(job.status||'').toLowerCase()!=='cancelled';
}
function calendarHistoryWeekDataV59660(weekStart){
  const dates=weekDates(weekStart),dateSet=new Set(dates);
  const jobs=(state.schedules||[]).filter(
    job=>dateSet.has(String(job.date||'').slice(0,10))&&calendarJobVisibleV59660(job)
  );
  const missed=jobs.filter(
    job=>typeof scheduleJobNeedsOfficeActionV58928==='function'
      && scheduleJobNeedsOfficeActionV58928(job)
  ).length;
  const completed=jobs.filter(job=>{
    const status=String(job.status||'').toLowerCase();
    if(status==='completed')return true;
    if(typeof linkedVisitForScheduleJobV58928==='function'){
      try{return !!linkedVisitForScheduleJobV58928(job);}catch(error){}
    }
    return false;
  }).length;
  const activeDays=new Set(jobs.map(job=>String(job.date||'').slice(0,10))).size;
  return {weekStart,jobs:jobs.length,missed,completed,activeDays};
}
function calendarHistoryCardV59660(row,selected){
  return `<button
    type="button"
    class="rolling-week-card calendar-history-card-v59660 ${
      row.weekStart===selected?'active':''
    } ${row.missed?'attention':''}"
    onclick="openRollingWeekV58929('${row.weekStart}')"
    title="Historical schedule week"
  >
    <span>${fmtShortDate(row.weekStart)}–${fmtShortDate(dateAdd(row.weekStart,5))}</span>
    <strong>${row.jobs} job${row.jobs===1?'':'s'}</strong>
    <small>${row.completed} done · ${row.activeDays} work day${row.activeDays===1?'':'s'}${
      row.missed?` · ${row.missed} missed`:''
    }</small>
  </button>`;
}

function installCalendarHistoryStylesV59660(){
  if($('tuinbooksCalendarHistoryStylesV59660'))return;
  const style=document.createElement('style');
  style.id='tuinbooksCalendarHistoryStylesV59660';
  style.textContent=`
    .schedule-history-nav-v59660{
      display:flex;align-items:center;gap:8px;flex-wrap:wrap;
      margin:10px 0 12px;padding:8px 0;
    }
    .schedule-history-nav-v59660 .button{
      min-height:36px;
    }
    .schedule-history-viewing-v59660{
      margin-left:auto;font-size:.82rem;opacity:.72;
    }
    .calendar-history-card-v59660{
      border-style:dashed;
    }
    .calendar-history-card-v59660::after{
      content:'History';
      display:block;
      margin-top:5px;
      font-size:.66rem;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
      opacity:.58;
    }
    @media(max-width:720px){
      .schedule-history-viewing-v59660{
        width:100%;margin-left:0;
      }
    }
  `;
  document.head.appendChild(style);
}

const renderRollingScheduleOverviewBaseV59660=renderRollingScheduleOverviewV58929;
renderRollingScheduleOverviewV58929=function renderRollingScheduleOverviewV59660(){
  const result=renderRollingScheduleOverviewBaseV59660();
  installCalendarHistoryStylesV59660();

  const host=$('rollingScheduleOverview'),picker=$('scheduleWeekPicker');
  if(!host||!picker)return result;

  const min=calendarMinWeekV59660(),max=calendarMaxWeekV59660();
  picker.min=min;
  picker.max=max;

  /* Clamp stale values only when they fall outside the supported UI window. */
  const selected=calendarClampWeekV59660(picker.value||calendarCurrentWeekV59660());
  if(picker.value!==selected)picker.value=selected;

  const strip=host.querySelector('.rolling-week-strip');
  if(strip){
    const history=calendarHistoricalWeekStartsV59660()
      .map(week=>calendarHistoryWeekDataV59660(week))
      .map(row=>calendarHistoryCardV59660(row,selected))
      .join('');
    strip.insertAdjacentHTML('afterbegin',history);
  }

  host.querySelector('.schedule-history-nav-v59660')?.remove();
  const head=host.querySelector('.rolling-plan-head');
  const controls=document.createElement('div');
  controls.className='schedule-history-nav-v59660';

  const atMin=selected<=min,atMax=selected>=max;
  controls.innerHTML=`
    <button type="button" class="button secondary compact" ${
      atMin?'disabled':''} onclick="shiftScheduleWeekV59660(-1)">‹ Previous week</button>
    <button type="button" class="button secondary compact" onclick="goToCurrentScheduleWeekV59660()">Today</button>
    <button type="button" class="button secondary compact" ${
      atMax?'disabled':''} onclick="shiftScheduleWeekV59660(1)">Next week ›</button>
    <span class="schedule-history-viewing-v59660">
      Viewing ${fmtShortDate(selected)}–${fmtShortDate(dateAdd(selected,5))}
      · history available back to ${fmtShortDate(min)}
    </span>
  `;
  if(head)head.insertAdjacentElement('afterend',controls);
  else host.prepend(controls);

  /* The original rolling header describes the generation horizon.
     Make the extra historical visibility explicit without changing it. */
  const description=host.querySelector('.rolling-plan-head small');
  if(description&&!/previous month/i.test(description.textContent||'')){
    description.textContent=`${description.textContent||''} View the previous month here without changing schedule history.`.trim();
  }

  return result;
};

/* Existing function already sets the selected detailed week. Wrap it only so
   historical clicks are kept inside the supported one-month view window. */
const openRollingWeekBaseV59660=window.openRollingWeekV58929;
window.openRollingWeekV58929=function openRollingWeekV59660(weekStart){
  const target=calendarClampWeekV59660(weekStart);
  if($('scheduleWeekPicker'))$('scheduleWeekPicker').value=target;
  if(typeof openRollingWeekBaseV59660==='function'&&target===weekStart){
    return openRollingWeekBaseV59660(target);
  }
  return renderSchedule();
};

function initialiseCalendarHistoryV59660(){
  installCalendarHistoryStylesV59660();
  const picker=$('scheduleWeekPicker');
  if(picker){
    picker.min=calendarMinWeekV59660();
    picker.max=calendarMaxWeekV59660();
  }
  if(activeView==='schedule')renderRollingScheduleOverviewV58929();
  window.__tuinbooksCalendarHistoryBuild=TUINBOOKS_CALENDAR_HISTORY_V59660;
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initialiseCalendarHistoryV59660,0));
}else{
  setTimeout(initialiseCalendarHistoryV59660,0);
}
