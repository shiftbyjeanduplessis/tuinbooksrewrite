const fs=require('fs');
const path=require('path');
const os=require('os');
const base=process.argv[2]||'http://127.0.0.1:5178';
const evidence=path.resolve(process.argv[3]||path.join(process.cwd(),'evidence'));
fs.mkdirSync(evidence,{recursive:true});
function loadPlaywright(){
  const candidates=[process.env.TUINBOOKS_PLAYWRIGHT_MODULE,'C:\\TuinBooks-QA\\node_modules\\playwright',path.join(os.homedir(),'TuinBooks-QA','node_modules','playwright')].filter(Boolean);
  for(const c of candidates){try{return require(c);}catch(_){}}
  try{return require('playwright');}catch(_){throw new Error('Playwright was not found. Expected C:\\TuinBooks-QA\\node_modules\\playwright.');}
}
const {chromium}=loadPlaywright();
const results=[];let seq=0;
function record(id,status,detail){results.push({id,status,detail});console.log(`${id}: ${status} - ${detail}`);}
function fail(id,msg){record(id,'FAIL',msg);throw new Error(`${id}: ${msg}`);}
async function shot(page,id){seq++;await page.screenshot({path:path.join(evidence,`${String(seq).padStart(2,'0')}-${id}.png`),fullPage:true});}
async function expect(id,condition,detail){if(!condition)fail(id,detail);record(id,'PASS',detail);}
async function drag(page,from,to){
  await from.scrollIntoViewIfNeeded(); await to.scrollIntoViewIfNeeded();
  const a=await from.boundingBox(),b=await to.boundingBox(); if(!a||!b)throw new Error('Drag source/target not visible');
  await page.mouse.move(a.x+a.width/2,a.y+Math.min(25,a.height/2)); await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+Math.min(40,b.height/2),{steps:10}); await page.mouse.up();
}
(async()=>{
  let browser; const pageErrors=[],consoleErrors=[],requestFailures=[];
  try{
    browser=await chromium.launch({channel:'msedge',headless:process.env.TB_QA_HEADLESS==='1'}).catch(async()=>chromium.launch({headless:process.env.TB_QA_HEADLESS==='1'}));
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>pageErrors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    page.on('requestfailed',r=>requestFailures.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||'failed'}`));

    const t0=Date.now(); await page.goto(`${base}/?demo=1`,{waitUntil:'domcontentloaded',timeout:15000}); await page.locator('.calendar-grid').waitFor({state:'visible',timeout:5000}); const openMs=Date.now()-t0;
    await expect('C01',openMs<2000,`Schedule usable in ${openMs}ms (<2000ms local target)`);
    await expect('C02',await page.locator('.team-label').count()===3,'3 demo teams rendered');
    await expect('C03',await page.locator('[data-schedule-cell]').count()===21,'21 team/day cells rendered');
    await expect('C04',await page.locator('.visit-card').count()>=15,'demo visits rendered');
    await expect('C05',await page.locator('.basket-card').count()===4,'4 Basket items rendered');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    await expect('C06',overflow<=1,`no page-level horizontal overflow (${overflow}px)`);
    await shot(page,'initial-schedule');

    await page.locator('#closeBasket').click();
    await expect('C07',await page.locator('.basket-panel').evaluate(el=>el.classList.contains('hidden')),'Basket closes to launcher');
    await page.locator('#openBasket').click();
    await expect('C08',!(await page.locator('.basket-panel').evaluate(el=>el.classList.contains('hidden'))),'Basket reopens');

    const recurring=page.locator('[data-visit-id="visit-1"]');
    const targetOne=page.locator('[data-schedule-cell][data-team-id="team-1"]').nth(1);
    await recurring.scrollIntoViewIfNeeded(); const scrollBefore=await page.evaluate(()=>window.scrollY);
    await drag(page,recurring,targetOne); await page.locator('dialog.scope-dialog[open]').waitFor({timeout:2500});
    await page.locator('dialog.scope-dialog [data-scope="one"]').click(); await page.waitForTimeout(100);
    const scrollAfter=await page.evaluate(()=>window.scrollY);
    await expect('C09',Math.abs(scrollAfter-scrollBefore)<=15,`drag did not auto-scroll page (${scrollBefore}→${scrollAfter})`);
    await expect('C10',await targetOne.locator('[data-visit-id="visit-1"]').count()===1,'This visit only moved recurring visit into target cell');

    const basketBefore=await page.locator('.basket-card').count();
    await drag(page,page.locator('[data-visit-id="visit-4"]'),page.locator('[data-basket-drop]'));
    await page.waitForTimeout(100);
    await expect('C11',await page.locator('[data-queue-item-id="queue-visit-4"]').count()===1,'Calendar → Basket preserved visit as queue item');
    await expect('C12',await page.locator('.basket-card').count()===basketBefore+1,'Basket count increased exactly once');

    const basketItem=page.locator('[data-queue-item-id="queue-demo-1"]');
    const targetBasket=page.locator('[data-schedule-cell][data-team-id="team-3"]').nth(5);
    await drag(page,basketItem,targetBasket); await page.waitForTimeout(100);
    await expect('C13',await page.locator('[data-queue-item-id="queue-demo-1"]').count()===0,'Basket item removed after placement');
    await expect('C14',await targetBasket.locator('[data-visit-id="visit-queue-demo-1"]').count()===1,'Basket → Calendar created exactly one visit');

    const resizeCard=page.locator('[data-visit-id="visit-6"]'); const oldDuration=await resizeCard.locator('.visit-duration').textContent();
    const handle=resizeCard.locator('[data-resize-handle]'); const hb=await handle.boundingBox(); if(!hb)fail('C15','resize handle not visible');
    await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+20,{steps:5});await page.mouse.up();await page.waitForTimeout(100);
    const newDuration=await page.locator('[data-visit-id="visit-6"] .visit-duration').textContent();
    await expect('C15',oldDuration!==newDuration,`resize changed duration (${oldDuration} → ${newDuration})`);

    const addCell=page.locator('[data-schedule-cell][data-team-id="team-3"]').nth(6); const addBefore=await addCell.locator('.visit-additional').count();
    await addCell.locator('.additional-trigger').last().evaluate(el=>el.click()); await page.locator('#additionalVisitDialogV2[open]').waitFor({timeout:2000});
    await page.locator('#additionalClientSearchV2').fill('Garden Client 20');
    await page.locator('#additionalClientResultsV2 [data-client="client-20"]').click();
    await page.locator('#additionalTaskV2').fill('QA extra garden clean-up'); await page.locator('#additionalNotesV2').fill('Automated browser QA'); await page.locator('#additionalSaveV2').click(); await page.waitForTimeout(100);
    await expect('C16',await addCell.locator('.visit-additional').count()===addBefore+1,'Additional Visit added at exact calendar position');

    const title0=await page.locator('#weekTitle').textContent(); await page.locator('#nextWeek').click(); await page.waitForTimeout(50); const title1=await page.locator('#weekTitle').textContent();
    await expect('C17',title0!==title1,'Next week changes calendar week'); await page.locator('#todayWeek').click(); await page.waitForTimeout(50); const title2=await page.locator('#weekTitle').textContent();
    await expect('C18',title2===title0,'Today returns to current week');

    for(const [id,pageName,selector] of [['C19','work','.work-toolbar'],['C20','clients','.clients-toolbar'],['C21','quotes','.money-toolbar'],['C22','money','.money-toolbar'],['C23','business','.business-toolbar']]){
      await page.locator(`[data-nav="${pageName}"]`).click(); await page.locator(selector).waitFor({timeout:2500}); record(id,'PASS',`${pageName} workspace rendered`);
    }
    await page.locator('[data-nav="schedule"]').click(); await page.locator('.calendar-grid').waitFor({timeout:2500}); await shot(page,'final-schedule');

    const visibleError=await page.locator('.error-box:not(.hidden)').allTextContents();
    await expect('C24',visibleError.length===0,`no visible application error boxes (${visibleError.length})`);
    await expect('C25',pageErrors.length===0,`no page exceptions (${pageErrors.length})`);
    await expect('C26',consoleErrors.length===0,`no console errors (${consoleErrors.length})`);
    const relevantFailures=requestFailures.filter(x=>!x.includes('favicon'));
    await expect('C27',relevantFailures.length===0,`no failed browser requests (${relevantFailures.length})`);
    const pass=results.filter(r=>r.status==='PASS').length,failCount=results.filter(r=>r.status==='FAIL').length;
    const report={at:new Date().toISOString(),url:base,pass,fail:failCount,results,pageErrors,consoleErrors,requestFailures};
    fs.writeFileSync(path.join(evidence,'RESULTS.json'),JSON.stringify(report,null,2));
    fs.writeFileSync(path.join(evidence,'REPORT.txt'),[`TUINBOOKS V2 REAL BROWSER DEMO QA`,`PASS=${pass} FAIL=${failCount}`, ...results.map(r=>`${r.id} ${r.status}: ${r.detail}`),'',`Page errors: ${pageErrors.length}`,`Console errors: ${consoleErrors.length}`,`Request failures: ${requestFailures.length}`].join('\r\n'));
    console.log(`\nTUINBOOKS V2 DEMO QA: PASS=${pass} FAIL=${failCount}`);
    process.exitCode=failCount?1:0;
  }catch(e){console.error('\nQA STOPPED:',e?.stack||e);process.exitCode=1;}
  finally{if(browser)await browser.close().catch(()=>{});}
})();
