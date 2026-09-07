#!/usr/bin/env python3
"""
Apply TuinBooks v59.6.60 Calendar One-Month History.

This patch is deliberately UI/navigation only. It does NOT replace or modify
rollingWeekStartsV58929(), because that function controls the automatic future
schedule-generation horizon.
"""
from pathlib import Path
import sys, shutil, json, re

BUILD = "59.6.60-calendar-one-month-history"
MARKERS = [
    "function rollingWeekStartsV58929",
    "renderRollingScheduleOverviewV58929",
    "window.openRollingWeekV58929",
    "scheduleWeekPicker",
    "scheduleJobNeedsOfficeActionV58928",
]
RESTORE_BLOCK = r"""
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
"""

def locate_app_js(arg):
    p=Path(arg).expanduser().resolve()
    if p.is_file():
        return p
    for candidate in (p/"app"/"app.js",p/"app.js"):
        if candidate.exists():
            return candidate
    raise SystemExit(f"Could not find app/app.js under {p}")

def insert_before_iife_close(text, block):
    idx=text.rfind("})();")
    if idx<0:
        raise SystemExit("Safety stop: final app IIFE closure was not found.")
    return text[:idx]+"\n\n"+block.strip()+"\n\n"+text[idx:]

def bump_version(repo_root):
    version=repo_root/"app"/"VERSION.txt"
    if version.exists():
        version.write_text(BUILD+"\n",encoding="utf-8")

def bump_service_worker(repo_root):
    sw=repo_root/"app"/"service-worker.js"
    if not sw.exists():
        return False
    text=sw.read_text(encoding="utf-8")
    if BUILD in text:
        return False
    # Prefer replacing the immediately previous release token if present.
    for prior in (
        "59.6.59-work-team-board-restore",
        "59.6.58-dual-billing-cloud-save-fix",
    ):
        if prior in text:
            sw.write_text(text.replace(prior,BUILD,1),encoding="utf-8")
            return True
    # Generic cache token fallback.
    m=re.search(r"(['\"])([^'\"]*(?:CACHE|cache|tuinbooks)[^'\"]*)\1",text)
    if m:
        old=m.group(0)
        quote=m.group(1)
        replacement=quote+BUILD+quote
        sw.write_text(text[:m.start()]+replacement+text[m.end():],encoding="utf-8")
        return True
    return False

def main():
    if len(sys.argv)!=2:
        raise SystemExit("Usage: python apply_calendar_history_v59660.py /path/to/TUINBOOKS-main")
    app_js=locate_app_js(sys.argv[1])
    original=app_js.read_text(encoding="utf-8")

    missing=[m for m in MARKERS if m not in original]
    if missing:
        raise SystemExit("Safety stop: target source does not contain the expected current scheduler. Missing:\n- "+"\n- ".join(missing))
    if BUILD in original:
        print(json.dumps({"status":"already_patched","build":BUILD,"app_js":str(app_js)},indent=2))
        return

    # Core safety: ensure we are not altering the generator function.
    rolling_signature="function rollingWeekStartsV58929(fromDate=localDateISO())"
    if rolling_signature not in original:
        raise SystemExit("Safety stop: rollingWeekStartsV58929 signature differs from the recovered source.")

    patched=insert_before_iife_close(original,RESTORE_BLOCK)
    if patched.count(rolling_signature)!=original.count(rolling_signature):
        raise SystemExit("Safety stop: rolling schedule generator signature changed unexpectedly.")

    backup=app_js.with_suffix(".js.before-v59660.bak")
    shutil.copy2(app_js,backup)
    app_js.write_text(patched,encoding="utf-8")

    root=app_js.parent.parent if app_js.parent.name=="app" else app_js.parent
    bump_version(root)
    sw_changed=bump_service_worker(root)

    checks={
        "history_build_marker": BUILD in patched,
        "rolling_generator_untouched": patched.count(rolling_signature)==original.count(rolling_signature),
        "previous_week_control": "shiftScheduleWeekV59660(-1)" in patched,
        "today_control": "goToCurrentScheduleWeekV59660" in patched,
        "next_week_control": "shiftScheduleWeekV59660(1)" in patched,
        "four_historical_weeks": "[-28,-21,-14,-7]" in patched,
        "history_limit": "calendarMinWeekV59660" in patched,
    }
    if not all(checks.values()):
        shutil.copy2(backup,app_js)
        raise SystemExit("Static verification failed. Original app.js restored.")

    print(json.dumps({
        "status":"patched",
        "build":BUILD,
        "app_js":str(app_js),
        "backup":str(backup),
        "service_worker_cache_bumped":sw_changed,
        "checks":checks,
    },indent=2))

if __name__=="__main__":
    main()
