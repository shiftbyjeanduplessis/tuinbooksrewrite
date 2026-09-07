const CACHE='tuinbooks-r19-business-control-repair';
const VERSION='R19-business-control-repair';
const SHELL=[
  './styles.css?v=59.6.89-support-route-restore',
  './tuinbooks-icon.png?v=60.8.11-t50-assets',
  './manifest.webmanifest',
  './support-management-ui.css?v=59.6.9-quote-status-acceptance-cleanup',
  './stability-repair-v59694.css?v=60.3.5-exact-v6011-calendar-production',
  './work-consolidated-v6021.css?v=60.3.5-exact-v6011-calendar-production',
  './billing-completed-work-v6031.css?v=60.3.5-exact-v6011-calendar-production',
  './demo-showroom-v60417.css?v=60.4.18-demo-direct-workspace',
  './mobile-profiles-v60430.css?v=60.4.30',
  './assets/ocr/tesseract.min.js',
  './vendor/supabase.js',
  './supabase-config.js',
  './app.js?v=60.8.17-cancellation-billing-scope-audit-fix',
  './demo-billing-profile-repair-v6047.js?v=60.4.7-demo-billing-profile-repair',
  './ui-hotfix-58949.js?v=59.6.9-quote-status-acceptance-cleanup',
  './ui-refine-58953.js?v=59.6.9-quote-status-acceptance-cleanup',
  './billing-controls-58954.js?v=59.6.9-quote-status-acceptance-cleanup',
  './fictitious-test-data-58958.js?v=59.6.9-quote-status-acceptance-cleanup',
  './stability-repair-v59694.js?v=60.3.5-exact-v6011-calendar-production',
  './management-view-authority-v6034.js?v=60.3.5-exact-v6011-calendar-production',
  './work-consolidated-v6021.js?v=60.3.5-exact-v6011-calendar-production',
  './billing-completed-work-v6031.js?v=60.3.5-exact-v6011-calendar-production',
  './ui-client-work-v6038.js?v=60.3.8-client-work-polish',
  './ui-client-lifecycle-v6048.js?v=60.4.8-client-lifecycle',
  './ui-client-list-modal-v6048.js?v=60.4.8-client-lifecycle',
  './demo-showroom-v60417.js?v=60.4.18-demo-direct-workspace',
  './demo-live-work-v60422.js?v=60.4.22-demo-live-work-embedded-photos',
  './onboarding-master-import-v60423.js?v=60.4.24-onboarding-import-self-closing-cell-fix',
  './business-needs-attention-v6052.js?v=R19-business-control-repair',
  './mobile-profiles-v60430.js?v=60.4.30',
  './visit-controls-v60521.js?v=60.8.6-stage2-direct-source',
  './schedule-drag-mode-v6061.js?v=60.7.45-drag-toggle-single-owner',
  './schedule-drag-basket-v6066.js?v=60.7.46-long-sticky-basket',
  './business-data-export-v6072.js?v=60.7.5-cumulative-export-schedule-fix',
  './r18-ui-parity-bridge.js?v=R18-true-office-ui-recovery',
  './ui-basket-cleanup-v6039.js?v=60.8.0-schedule-v2-guard',
  './schedule-v2/schedule-v2.css?v=60.8.0',
  './schedule-v2/schedule-v2.js?v=60.8.0',
  './schedule-v2/index.html?v=60.8.0',
  './schedule-v2-bridge.js?v=60.8.0-direct-state',
  './release-marker.js?v=60.8.0',
  './',
  './index.html',
  './mobile.html?v=60.8.11-t50-assets',
  './client-login.html',
  './office-activate.html',
  './accept.html',
  './document.html',
  './tuinbooks-logo.png?v=60.8.11-t50-assets'
];
async function cacheShell(){
  const cache=await caches.open(CACHE);
  await Promise.allSettled(SHELL.map(async request=>{
    const response=await fetch(request,{cache:'reload'});
    if(response.ok)await cache.put(request,response);
  }));
}
self.addEventListener('install',event=>event.waitUntil(cacheShell().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const protectedBrandImage=['/app/logo.png','/app/tuinbooks-logo.png','/app/tuinbooks-icon.png'].includes(url.pathname);
  if(protectedBrandImage){
    event.respondWith(
      fetch(event.request,{cache:'no-store'}).then(response=>{
        const contentType=(response.headers.get('content-type')||'').toLowerCase();
        if(!response.ok||!contentType.startsWith('image/')){
          throw new Error('Invalid branding image response: '+response.status+' '+contentType);
        }
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        return response;
      }).catch(async()=>{
        const cached=await caches.match(event.request);
        if(cached){
          const contentType=(cached.headers.get('content-type')||'').toLowerCase();
          if(cached.ok&&contentType.startsWith('image/')) return cached;
        }
        return Response.error();
      })
    );
    return;
  }
  const codeOrPage=event.request.mode==='navigate'||/\.(?:html|js|css)$/.test(url.pathname);
  if(codeOrPage){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request).then(found=>found||caches.match(event.request,{ignoreSearch:true})||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(found=>found||caches.match(event.request,{ignoreSearch:true})||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
