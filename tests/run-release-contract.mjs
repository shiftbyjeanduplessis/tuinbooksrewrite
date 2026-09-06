import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
let checks=0;const has=(s,v,label)=>{assert.ok(s.includes(v),label);checks++;};const not=(s,v,label)=>{assert.ok(!s.includes(v),label);checks++;};
const [app,auth,login,mobile,business,work,money,importExport,management,publicDoc,migration,copy,coreSql,r6Bridge]=await Promise.all([
 read('src/app.ts'),read('src/lib/auth.ts'),read('src/features/auth/login.ts'),read('src/mobileApp.ts'),read('src/features/business/businessPage.ts'),read('src/features/work/workPage.ts'),read('src/features/billing/moneyPage.ts'),read('src/features/importExport/importExportDialog.ts'),read('src/managementApp.ts'),read('src/publicDocumentApp.ts'),read('supabase/migration-v2-release-completion.sql'),read('scripts/copy-static.mjs'),read('supabase/INSTALL-V2-CORE.sql'),read('supabase/APPLY-R6-NON-SCHEDULE-PAGE-READ-BRIDGE.sql')
]);
has(app,"'business'",'Business navigation must be wired');has(app,'loadSupportAuthContext','Support workspace auth must be wired');
has(app,"params.get('support')==='1'",'Management support mode must use the original support=1 contract');
has(app,"params.get('business')",'Management route must take the business UUID from business=');
has(app,"params.get('session')",'Management route must preserve the audited support session ID');
not(app,"supportBusiness=params.get('support')",'support=1 must never be treated as a business UUID');
has(auth,"tuinbooks_management_open_context_v5938",'Management route must verify the exact support session before opening the workspace');
has(auth,"p_session_id:sessionId",'Management verification must send the exact support session ID');
not(login,'TuinBooks v2','Sign-in must not expose rewrite/version branding');
not(login,'Completely separate calendar frontend','Sign-in must not expose rewrite implementation copy');

has(mobile,'tuinbooks_v2_claim_field_pin','Field pairing must use v2 permanent PIN authority');not(mobile,'claim_mobile_access_code','Legacy mobile claim RPC must not return');
has(business,'Field phone PINs','Business must expose permanent field PINs');has(business,'generateFieldPin','Business must generate PINs');has(business,'revokeFieldPin','Business must revoke PINs');
for(const label of ['Quote now','Needs site visit','Design consult','Defer','Close'])has(work,label,`Opportunity triage action missing: ${label}`);
has(money,'createPublicDocument','Money delivery must create immutable public documents');has(money,'paymentTermsDays','Invoices must use configured payment terms');has(money,'data-void-invoice','Unissued invoice void workflow must exist');
has(importExport,'Pastel CSV','Pastel export must exist');has(importExport,'Sage CSV','Sage export must exist');has(importExport,'QuickBooks CSV','QuickBooks export must exist');has(importExport,'Xero CSV','Xero export must exist');
has(management,'Open workspace','Management full-support open workspace must exist');has(publicDoc,'tuinbooks_v2_respond_public_quote','Public quote response must be durable');
for(const rpc of ['tuinbooks_v2_auth_context','tuinbooks_v2_load_schedule_week','tuinbooks_v2_claim_field_pin','tuinbooks_v2_review_opportunity','tuinbooks_v2_create_public_document','tuinbooks_v2_support_context','tuinbooks_v2_next_invoice_number','invoice_visit_links_v2'])has(migration,rpc,`Release migration missing ${rpc}`);
for(const html of ['accept.html','document.html']){await access(html);has(copy,html,`Build must copy ${html}`);}

for(const unsafe of [' end day,',' end week,',') row from public.schedule_jobs','q.row order by','q.week,q.stop'])not(coreSql,unsafe,`Unsafe SQL alias returned: ${unsafe}`);
has(coreSql,'as day_name','Core SQL must use explicit non-keyword day alias');has(coreSql,'as week_label','Core SQL must use explicit non-keyword week alias');has(coreSql,'as row_json','Core SQL must use explicit non-keyword row alias');

for(const unsafeGrant of ['g.operational_read','g.operational_edit','g.financial_read','g.financial_edit',',operational_read=coalesce(p_operational_read'])not(coreSql,unsafeGrant,`Legacy support-grant column returned: ${unsafeGrant}`);
for(const liveGrant of ['g.allow_operational_read','g.allow_operational_edit','g.allow_financial_read','g.allow_financial_edit','reason,starts_at,expires_at,allow_operational_read'])has(coreSql,liveGrant,`Core SQL must match live support-grant schema: ${liveGrant}`);
for(const forbidden of ['schedule-exact-canary','schedule-drag-mode-v6061','schedule-drag-basket-v6066','serviceSitesV56']){not((await Promise.all(['src/app.ts','src/mobileApp.ts','src/features/schedule/schedulePage.ts'].map(read))).join('\n'),forbidden,`Legacy pattern returned: ${forbidden}`);}
console.log(`TUINBOOKS V2 RELEASE CONTRACT: PASS · ${checks} checks`);


// R6 Management-session page display contract.
for(const marker of ['tuinbooks_v2_can_operational_read','tuinbooks_v2_can_financial_read','tuinbooks_v2_load_client_workspace','tuinbooks_v2_load_work_day','tuinbooks_v2_load_money_workspace','tuinbooks_v2_load_business_workspace'])has(r6Bridge,marker,`R6 read bridge missing ${marker}`);
has(r6Bridge,"v_is_admin:=true",'Management operational support must see all teams in Work');
has(business,"Field PIN list unavailable in this session",'Settings must still render when PIN listing is unavailable');
console.log('TUINBOOKS R6 WORKSPACE DISPLAY CONTRACT: PASS');

// UI preservation contract: rewrite must preserve TuinBooks product UI rather than redesign it.
{
  const mgmt=await read('original-ui/management/index.html');
  has(mgmt,'Support activity','original Management support activity navigation preserved');
  has(mgmt,'Trash','original Management Trash navigation preserved');
  has(mgmt,'Create account','original Management create-account workflow preserved');
  has(mgmt,'Business &amp; teams','original Management setup workflow preserved');
  const chrome=await read('src/features/shell/chrome.ts');
  has(chrome,"['money','Billing']",'office nav keeps original Billing terminology');
  has(chrome,'admin-header','original office header structure preserved');
  has(chrome,'admin-product-logo','original office logo treatment preserved');
  has(chrome,'header-settings-button','original office Settings control preserved');
}

{
  const appHtml=await read('index.html');
  const mobileApp=await read('src/mobileApp.ts');
  not(appHtml,'TuinBooks v2','customer-facing app title must remain TuinBooks');
  not(mobileApp,'TuinBooks Mobile v2','mobile product label must remain TuinBooks Mobile');
  has(app,"currentPage==='settings'",'Settings must remain separate from Business navigation');
  has(app,'renderBusinessOverviewPage','Business nav must open business overview rather than settings');
}

console.log(`TUINBOOKS UI PRESERVATION CONTRACT: PASS`);

// Schedule usability/parity contract: preserve the fast engine while restoring the TuinBooks controls the user relies on.
{
  const schedulePage=await read('src/features/schedule/schedulePage.ts');
  const calendar=await read('src/features/schedule/calendar.ts');
  const basket=await read('src/features/schedule/basket.ts');
  const styles=await read('src/styles.css');
  has(schedulePage,'rolling-week-strip-v2','Schedule must restore rolling week cards at the top');
  has(schedulePage,'↔ Drag mode','Schedule must restore explicit Drag Mode');
  has(schedulePage,'THIS VISIT','Drag Mode must expose this-visit scope');
  has(schedulePage,'THIS + FUTURE','Drag Mode must expose this + future scope');
  has(schedulePage,'schedule-basket-toggle','Schedule must expose the Basket directly');
  has(calendar,'visit-route','Schedule cards must show route order');
  has(calendar,'visit-info-button','Schedule cards must expose the information affordance');
  has(calendar,'visit-location','Schedule cards must show street address before opening details');
  has(calendar,'visit-suburb','Schedule cards must show suburb before opening details');
  has(calendar,'data-new-note','Each team/day must retain the compact Note action');
  has(calendar,'data-new-event','Each team/day must retain the compact Event action');
  has(calendar,'data-new-additional','Each team/day must expose direct Additional Visit');
  has(calendar,'ID ${esc(shortId(visit.id))}','Drag ghost must retain the visible visit ID');
  has(calendar,'Access notes','Visit information must include access notes');
  has(calendar,'Site instructions','Visit information must include site instructions');
  has(calendar,'DO NOT SERVICE','Visit information must surface client service holds');
  not(calendar,'capacity-meter','Schedule renderer must not reintroduce capacity meters');
  not(calendar,'safeHoursForTeam','Schedule renderer must not calculate visible capacity context');
  has(basket,'basket-card-compact','Basket must use compact cards');
  not(basket,'Accepted quoted work','Basket cards must not waste space on work-type copy');
  not(basket,'estimatedMinutes','Basket cards must not show duration');
  has(styles,'Schedule usability restoration R7','R7 Schedule usability styles must be active');
  has(styles,'street address + suburb','R7 must explicitly preserve the newer street-address improvement');
  has(styles,'visible ID','R7 must explicitly preserve the newer drag-ID improvement');
}
console.log(`TUINBOOKS SCHEDULE USABILITY CONTRACT: PASS`);

// R8 Schedule cleanup contract: preserve new wins, restore calm TuinBooks UI and missing operations.
{
  const schedulePage=await read('src/features/schedule/schedulePage.ts');
  const calendar=await read('src/features/schedule/calendar.ts');
  const visitDialog=await read('src/features/schedule/visitActionDialog.ts');
  const dayDialog=await read('src/features/schedule/dayActionDialog.ts');
  const repository=await read('src/features/schedule/scheduleRepository.ts');
  const operations=await read('src/domain/operations.ts');
  const styles=await read('src/styles.css');
  const mobile=await read('src/mobileApp.ts');
  const work=await read('src/features/work/workPage.ts');
  const r8Sql=await read('supabase/APPLY-R8-SCHEDULE-OPERATIONS.sql');

  has(styles,'R8 — final Schedule cleanup before deployment','R8 polished Schedule styles must be active');
  has(styles,'.calendar-grid.drag-mode-active .day-action-bar','Drag mode must suppress operational buttons');
  has(styles,'.calendar-grid:not(.drag-mode-active) .visit-card','Normal mode must have its own interaction treatment');
  has(styles,'.visit-task,.visit-card-footer{display:none!important}','Calendar cards must stay visually compact');
  has(calendar,'visit-location','Street address must remain visible on visit cards');
  has(calendar,'ID ${esc(shortId(visit.id))}','Visible drag ID must remain');
  has(calendar,'visitDoNotService(visit)','Calendar must render visit-specific DO NOT SERVICE');
  has(visitDialog,'DO NOT SERVICE — THIS VISIT','Visit dialog must distinguish visit-level DNS');
  has(visitDialog,'DO NOT SERVICE — CLIENT','Visit dialog must preserve client-level DNS separately');
  has(visitDialog,'onVisitDoNotService','Visit-specific DNS must be durable, not visual-only');
  has(schedulePage,'persistVisitDoNotService','Schedule must persist visit-specific DNS');
  has(operations,'setVisitDoNotServiceOptimistically','Visit DNS must use optimistic state with rollback');
  has(dayDialog,'Response / outcome','Event dialog must allow a response/outcome');
  has(dayDialog,'Respond & resolve','Event dialog must allow explicit resolution');
  has(repository,'tuinbooks_v2_save_day_action_r8','Event response must persist through the R8 RPC');
  has(r8Sql,'tuinbooks_v2_set_visit_do_not_service','R8 SQL must persist visit-specific DNS');
  has(r8Sql,'tuinbooks_v2_save_day_action_r8','R8 SQL must persist event response/resolution');
  has(r8Sql,"status in ('active','resolved','cancelled')",'Day actions must retain resolved history');
  has(work,'visitDoNotService(visit)','Desktop Work must surface visit-specific DNS');
  has(mobile,'visitDoNotService(visit)','Mobile must surface visit-specific DNS');
  has(mobile,'&&!dns&&','Mobile must not offer completion for a DO NOT SERVICE visit');
  not(calendar,'capacity-meter','R8 Schedule must not reintroduce capacity meters');
}
console.log('TUINBOOKS R8 SCHEDULE CLEANUP CONTRACT: PASS');
