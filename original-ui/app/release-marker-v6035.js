/* TuinBooks v60.3.4 release marker */
(()=>{
 const BUILD='60.3.5-exact-v6011-calendar-production';
 function mark(){
   window.__tuinbooksBuild=BUILD;
   const marker=document.querySelector('[id^="tuinbooksBuildV"]');
   if(marker){marker.id='tuinbooksBuildV6035';marker.textContent='v60.3.4';marker.title='Exact approved Schedule canary + Management navigation authority';}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mark,0),{once:true});else setTimeout(mark,0);
 window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(mark,0));
 setTimeout(mark,1200);setTimeout(mark,4000);
})();
