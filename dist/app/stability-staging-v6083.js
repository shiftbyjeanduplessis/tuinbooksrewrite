/* TuinBooks staging diagnostics + non-invasive visual repairs — v60.8.3 */
(()=>{'use strict';
const BUILD='60.8.3-stability-diagnostics';
const errors=[];
function record(kind,value){const msg=String(value?.message||value?.reason?.message||value?.reason||value||'Unknown error');errors.push({at:new Date().toISOString(),kind,message:msg,stack:String(value?.error?.stack||value?.reason?.stack||'')});if(errors.length>100)errors.shift();}
window.addEventListener('error',e=>record('error',e));window.addEventListener('unhandledrejection',e=>record('unhandledrejection',e));
function repairLogo(){document.querySelectorAll('img.admin-product-logo').forEach(img=>{img.hidden=false;img.style.removeProperty('display');if(!img.getAttribute('src'))img.src='tuinbooks-logo.png';img.addEventListener('error',()=>{img.style.display='none';const brand=img.parentElement?.querySelector('.brand-title');if(brand)brand.style.display='inline-block';},{once:true});});}
function diagnostics(){const rt=window.__tuinbooksOnboardingRuntimeV60423;const s=rt?.getState?.();return {build:BUILD,release:window.__TUINBOOKS_RELEASE__||'',staging:window.__TUINBOOKS_STAGING_RELEASE__||'',scheduleRenderer:document.documentElement.dataset.scheduleRenderer||'',stateReady:!!s,clients:s?.clients?.length||0,teams:s?.teams?.length||0,schedules:s?.schedules?.length||0,basket:s?.scheduleBasket?.length||0,errors:[...errors],knownErrorHits:errors.filter(x=>/currentMonday|scheduleCell|Invalid Date/i.test(x.message))};}
window.__tuinbooksStagingDiagnosticsV6083={build:BUILD,errors,getReport:diagnostics,repairLogo};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repairLogo,{once:true});else repairLogo();
console.info(`[TuinBooks ${BUILD}] loaded`);
})();
