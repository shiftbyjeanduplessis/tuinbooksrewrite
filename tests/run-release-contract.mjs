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
  has(schedulePage,'chooseMoveScope(visit,series)','Recurring drag moves must ask This visit / This + future at drop time');
  not(schedulePage,'data-drag-scope="one"','Drag scope must not remain as a confusing global mode');
  has(schedulePage,'schedule-basket-toggle','Schedule must expose the Basket directly');
  has(calendar,'visit-route','Schedule cards must show route order');
  has(calendar,'visit-info-hover','Schedule cards must expose the information affordance');
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
  has(visitDialog,'Do not service is active for this visit','Visit dialog must distinguish visit-level DNS');
  has(visitDialog,'Do not service is active for this client','Visit dialog must preserve client-level DNS separately');
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


// R9 Schedule layout contract: desktop uses page scroll and dense cards instead of nested scrollers / towers.
{
  const calendar=await read('src/features/schedule/calendar.ts');
  const styles=await read('src/styles.css');
  has(styles,'R9 — full-viewport Schedule layout + dense busy-day cards','R9 Schedule layout styles must be active');
  has(styles,'.calendar-scroll{max-height:none!important;overflow:visible!important','Desktop Schedule must not use a nested calendar scroller');
  has(styles,'.calendar-grid{width:100%!important;min-width:0!important','Desktop calendar must fill available width');
  has(styles,'.basket-list{max-height:none!important;overflow:visible!important','Basket must use page scroll rather than an internal vertical scroller');
  has(styles,'.schedule-cell.dense .visit-card','Busy days must auto-compact');
  has(styles,'.schedule-cell.very-dense .visit-card','Very busy days must auto-compact further');
  has(calendar,"visibleRows.length>14?' very-dense':visibleRows.length>8?' dense':''",'Calendar must classify busy cells by visit count');
  has(calendar,'visit-suburb-inline','Compact cards must retain suburb beside street address');
  has(calendar,'ID ${esc(shortId(visit.id))}','R9 must preserve the visible drag ID');
  has(styles,'.calendar-grid.drag-mode-active .visit-card{min-height:var(--visit-height,48px)!important}','Drag mode must retain modest resize feedback');
}
console.log('TUINBOOKS R9 SCHEDULE LAYOUT CONTRACT: PASS');


// R10 Schedule floating Basket + Additional Visit dialog-close contract.
{
  const schedulePage=await read('src/features/schedule/schedulePage.ts');
  const additional=await read('src/features/schedule/additionalVisitDialog.ts');
  const styles=await read('src/styles.css');
  has(styles,'floating Basket + reliable Additional Visit dialog close','R10 floating Basket styles must be active');
  has(schedulePage,'floating-basket','Basket must be a floating utility window');
  has(schedulePage,'basket-drag-handle','Floating Basket must have a drag handle');
  has(schedulePage,"type BasketWindowState='open'|'minimized'|'tucked'",'Basket must support open, minimized and tucked states');
  has(schedulePage,"tuinbooks.schedule.basket.position",'Basket position must persist locally');
  has(schedulePage,"tuinbooks.schedule.basket.state",'Basket state must persist locally');
  has(schedulePage,'basket-moving','Basket must expose active move state');
  has(styles,'.basket-launcher{position:fixed!important','Tucked Basket must reopen from a fixed edge strip');
  has(styles,'.floating-basket.minimized .basket-body{display:none!important}','Minimized Basket must collapse to its header');
  has(additional,'data-close','Additional Visit dialog must expose explicit close controls');
  has(additional,"dialog.addEventListener('cancel'",'Escape must close Additional Visit dialog');
  has(additional,"dialog.addEventListener('pointerdown'",'Backdrop click must close Additional Visit dialog');
  has(additional,"dialog.close('cancel')",'Cancel and close controls must close without submitting');
}
console.log('TUINBOOKS R10 FLOATING BASKET CONTRACT: PASS');

// R11 Schedule: team colours + dedicated rearrange mode + Basket idempotency.
{
  const [styles,calendar,schedulePage,basket,sql]=await Promise.all([
    read('src/styles.css'),read('src/features/schedule/calendar.ts'),read('src/features/schedule/schedulePage.ts'),read('src/features/schedule/basket.ts'),read('supabase/APPLY-R11-BASKET-IDEMPOTENT-PLACEMENT.sql')
  ]);
  has(calendar,'TEAM_COLOURS','R11 must provide distinct team colours');
  has(calendar,'applyTeamColour(cell,teamTheme)','Team colour must flow through each team/day row');
  has(schedulePage,'REARRANGE WEEK','Drag mode must become an explicit rearrangement workspace');
  not(schedulePage,'data-drag-scope="one"','Global drag scope controls must be removed');
  has(schedulePage,'chooseMoveScope(visit,series)','Recurring moves must ask scope at drop time');
  has(basket,'basket-locked','Basket must be non-draggable in normal mode');
  has(basket,'basket-draggable','Basket must be draggable in rearrange mode');
  has(styles,'.rearrange-mode .schedule-week-navigation','Rearrange mode must be visually distinct');
  has(sql,'reused_existing_job','Basket placement must be idempotent when source job still exists');
  has(sql,'update public.schedule_jobs','R11 must reuse/update an existing schedule job instead of duplicate insert failure');
  has(calendar,'ID ${esc(shortId(visit.id))}','Visible drag ID must remain protected');
  has(calendar,"location?.address||'Address not linked'",'Street address must remain on schedule cards');
}
console.log('TUINBOOKS R11 REARRANGE/BASKET CONTRACT: PASS');

// R12 Schedule: status key is informative, while visit actions are discoverable and missed visits regain the three-way resolution flow.
{
  const [schedulePage,calendar,visitDialog,repository,sql,styles]=await Promise.all([
    read('src/features/schedule/schedulePage.ts'),read('src/features/schedule/calendar.ts'),read('src/features/schedule/visitActionDialog.ts'),read('src/features/schedule/scheduleRepository.ts'),read('supabase/APPLY-R12-MISSED-VISIT-RESOLUTION.sql'),read('src/styles.css')
  ]);
  has(schedulePage,'Schedule status key','R12 must identify the legend as a status key');
  has(calendar,"onAction();});",'Normal-mode card click must open visit actions');
  has(calendar,'data-visit-info-hover','Information affordance must remain hover/focus only while the card is the action surface');
  has(visitDialog,'Do not service this visit','Visit-specific DNS must be prominent in the visit dialog');
  has(visitDialog,'It was completed','Missed resolution must restore completed-by-office choice');
  has(visitDialog,'Reschedule / catch-up','Missed resolution must restore catch-up choice');
  has(visitDialog,'No catch-up / no charge','Missed resolution must restore no-return/no-charge choice');
  has(visitDialog,'missed-resolution-grid','Missed resolution must be a dedicated three-choice UI');
  has(repository,'tuinbooks_v2_resolve_missed_visit_r12','Missed final outcomes must persist through the R12 RPC');
  has(sql,"p_decision not in ('complete','no-return')",'R12 RPC must constrain final missed outcomes');
  has(sql,"'v2_missed_resolved_complete'",'Completed missed resolution must be audited');
  has(sql,"'v2_missed_resolved_no_return'",'No-return missed resolution must be audited');
  has(calendar,"visit.visitType==='quoted'?'<span class=\"visit-badge quoted\">Q</span>'",'Quoted work marker Q must remain state-driven');
  has(styles,'R12 — actionable visit controls + restored missed-visit resolution','R12 styles must be active');
}
console.log('TUINBOOKS R12 MISSED-VISIT/ACTION CONTRACT: PASS');

// R13 Schedule: one card action surface + hover info + atomic multi-select group rearrangement.
{
  const [schedulePage,calendar,repository,sql,styles]=await Promise.all([
    read('src/features/schedule/schedulePage.ts'),read('src/features/schedule/calendar.ts'),read('src/features/schedule/scheduleRepository.ts'),read('supabase/APPLY-R13-GROUP-DRAG.sql'),read('src/styles.css')
  ]);
  has(calendar,'data-select-visit','R13 Drag mode must put selection checkboxes on movable visit cards');
  has(calendar,'multi-selected','Selected cards must receive a clear selected state');
  has(calendar,'visits selected','Group drag ghost must show how many visits are moving');
  has(schedulePage,'dragSelectionCount','Rearrange mode must show the current selection count');
  has(schedulePage,'onMoveGroup:moveVisitGroup','Calendar must route multi-card drops through the group move path');
  has(schedulePage,'onQueueGroup:queueVisitGroup','Calendar must route multi-card Basket drops through the group queue path');
  has(schedulePage,"scope:'one'",'Multi-selected group moves must be occurrence-only and never silently rewrite recurrence');
  has(repository,'tuinbooks_v2_move_visits_group_r13','Group calendar moves must use the atomic R13 RPC');
  has(repository,'tuinbooks_v2_move_visits_to_basket_r13','Group Basket moves must use the atomic R13 RPC');
  has(sql,'tuinbooks_v2_move_visits_group_r13','R13 SQL must define atomic group calendar moves');
  has(sql,'tuinbooks_v2_move_visits_to_basket_r13','R13 SQL must define atomic group Basket moves');
  has(calendar,'visit-info-hover','Visit information must be hover/focus information instead of a second action button');
  has(calendar,'visit-hover-card','Hover info must expose the quick-information card');
  not(calendar,'data-visit-action','The confusing separate three-dot visit action control must be removed');
  not(calendar,'>•••<','The three-dot action affordance must be removed from Schedule cards');
  has(styles,'R13 — one card action surface + hover-only info + multi-select rearrange','R13 interaction styles must be active');
}
console.log('TUINBOOKS R13 MULTI-SELECT/ONE-ACTION CONTRACT: PASS');

// R14 Schedule: card click restores the actual work expected at the client before admin actions.
{
  const [schedulePage,visitDialog,repository,sql,styles]=await Promise.all([
    read('src/features/schedule/schedulePage.ts'),read('src/features/schedule/visitActionDialog.ts'),read('src/features/schedule/scheduleRepository.ts'),read('supabase/APPLY-R14-VISIT-DETAIL.sql'),read('src/styles.css')
  ]);
  has(visitDialog,'Work for this visit','R14 visit dialog must lead with the work expected at the client');
  has(visitDialog,'Site instructions','R14 visit detail must show site instructions when present');
  has(visitDialog,'Access','R14 visit detail must show access notes when present');
  has(visitDialog,'Routine notes','R14 visit detail must preserve agreement-specific notes');
  has(visitDialog,'workItemsForVisitDetail','R14/R16 must derive visit-specific service and task detail');
  has(visitDialog,'data-op="dns-choice"','Do not service must be one simple top-level action that then asks scope');
  has(visitDialog,'data-op="cancel-choice"','Cancel must be one simple top-level action that then asks billing choice');
  not(visitDialog,'<b>Suspend visit</b>','Suspend must not compete in the primary visit action menu');
  has(schedulePage,'data.agreements','Schedule must resolve the active service agreement for the clicked visit');
  has(schedulePage,'data.services','Schedule must pass service labels into visit detail');
  has(repository,'const services:BusinessService[]','Week normalisation must include service catalogue labels');
  has(repository,'const agreements:ServiceAgreement[]','Week normalisation must include active service agreement detail');
  has(sql,"'services'",'R14 schedule week RPC must return business service labels');
  has(sql,"'agreements'",'R14 schedule week RPC must return active service agreements');
  has(styles,'R14 — restore visit detail as the primary card-click experience','R14 visit detail styles must be active');
}
console.log('TUINBOOKS R14 VISIT-DETAIL CONTRACT: PASS');

// R16 Schedule: Do Not Service is a literal reversible state, and visit work uses the original icon language.
{
  const [visitDialog,styles]=await Promise.all([read('src/features/schedule/visitActionDialog.ts'),read('src/styles.css')]);
  has(visitDialog,'Service normally','R16 must expose the normal-service state beside Do not service');
  has(visitDialog,'data-op="service-normal"','R16 normal service must be a real control, not explanatory copy');
  has(visitDialog,"onVisitDoNotService(visit.id,false",'R16 normal service must clear visit-level DNS');
  has(visitDialog,"onClientHold(visit.accountId,false",'R16 normal service must clear client-level DNS affecting the visit');
  has(visitDialog,'visit-service-chip-r16','R16 visit work must render compact service chips');
  has(visitDialog,'serviceIcon(','R16 service display must choose distinct icons by service');
  has(visitDialog,'workIconSvg(','R16 must render the original-style visual service language');
  not(visitDialog,'visit-task-r14','R16 must not render generic tick-circle task tiles');
  has(styles,'R16 — literal service/DNS toggle + original-style service icon language','R16 styles must be active');
}
console.log('TUINBOOKS R16 SERVICE-DETAIL/DNS-TOGGLE CONTRACT: PASS');



// R17 parity audit: Sunday remains supported and the existing audit_events history is office-readable.
{
  const [clientDialogs,businessPage,businessRepository,sql,styles]=await Promise.all([
    read('src/features/clients/clientDialogs.ts'),read('src/features/business/businessPage.ts'),read('src/features/business/businessRepository.ts'),read('supabase/APPLY-R17-AUDIT-LOG.sql'),read('src/styles.css')
  ]);
  has(clientDialogs,"['Sun',7]",'R17 must preserve Sunday as a real routine service day');
  has(businessPage,'Recent activity','R17 Settings must expose recent audit activity');
  has(businessPage,'auditAvailable','R17 audit UI must fail gracefully before the SQL bridge is installed');
  has(businessRepository,'tuinbooks_v2_list_audit_log_r17','R17 must read audit history through the admin RPC');
  has(sql,'from public.audit_events a','R17 SQL must read the established audit_events history');
  has(sql,'public.is_business_admin(p_business_id)','R17 audit reader must be restricted to business admins/support authority');
  has(styles,'R17 — admin-visible audit/activity history','R17 audit history styles must be active');
}
console.log('TUINBOOKS R17 PARITY/AUDIT-LOG CONTRACT: PASS');

// R18 active production UI contract: /app must be the established full office product, not the stripped rewrite shell.
{
  const [officeHtml,officeApp,officeStyles,bridge,buildScript]=await Promise.all([
    read('original-ui/app/index.html'),read('original-ui/app/app.js'),read('original-ui/app/styles.css'),read('original-ui/app/r18-ui-parity-bridge.js'),read('scripts/build-release-ui-restored.mjs')
  ]);
  assert.ok(officeHtml.length>100000,'R18 office index must be the full established interface');checks++;
  assert.ok(officeApp.length>2000000,'R18 office app.js must be the full established office runtime');checks++;
  assert.ok(officeStyles.length>250000,'R18 office styles must be the full established stylesheet');checks++;
  for(const marker of ['id="view-schedule"','id="view-clients"','id="view-invoices"','id="view-records"'])has(officeHtml,marker,`R18 full office surface missing ${marker}`);
  has(officeHtml,'r18-ui-parity-bridge.js','R18 parity bridge must load last in established office UI');
  has(officeApp,"'Saturday','Sunday'",'R18 office schedule must include Sunday');
  has(bridge,'Service normally','R18 must retain the literal normal-service choice');
  has(bridge,'Do not service','R18 must retain the Do not service choice');
  has(bridge,'schedule-card-address-r18','R18 must keep street address visible on schedule cards');
  has(bridge,'Dragging visit ID','R18 must keep the visit ID visible while dragging');
  has(bridge,'r18-service-chip','R18 must restore distinct service-icon chips');
  has(bridge,'Recent activity','R18 must carry the R17 office-visible audit reader into the established UI');
  has(bridge,'tuinbooks_v2_list_audit_log_r17','R18 active office must use the protected admin-only R17 audit RPC');
  has(buildScript,"cp('original-ui/app', 'dist/app'",'R18 build must publish established office UI to /app');
  has(buildScript,"copyRewriteTree('dist/rewrite'",'R18 rewrite must remain isolated until parity verification');
}
console.log('TUINBOOKS R18 ACTIVE-OFFICE RECOVERY CONTRACT: PASS');


// R19: narrow repair — encoding-safe Settings control + durable Business control panel.
{
  const [officeHtml,businessControl,serviceWorker,buildScript]=await Promise.all([
    read('original-ui/app/index.html'),read('original-ui/app/business-needs-attention-v6052.js'),read('original-ui/app/service-worker.js'),read('scripts/build-release-ui-restored.mjs')
  ]);
  has(officeHtml,'id="headerSettingsBtnV58930"','R19 must retain the restored header Settings control');
  has(officeHtml,'&#9881;','R19 Settings icon must be encoding-safe');
  not(officeHtml,'>âš™</button>','R19 must remove the corrupted Settings glyph');
  has(businessControl,"const BUILD='R19-business-control-repair'",'R19 Business control repair must be active');
  has(businessControl,'runtime()?.workMarkerForJob','Business control must classify routine rows through canonical schedule logic');
  has(businessControl,'validAssignedTeam','Business control must accept either valid team assignment field');
  has(businessControl,"signature===lastRenderSignature",'Business control must not destructively rerender unchanged content');
  has(businessControl,"render(false)",'Business control background refresh must preserve open detail state');
  has(serviceWorker,"const VERSION='R19-business-control-repair'",'R19 service-worker cache must invalidate R18 UI assets');
  has(buildScript,"cp('original-ui/app', 'dist/app'",'R19/R20 build must preserve the full established office UI');
}
console.log('TUINBOOKS R19 SETTINGS/BUSINESS-CONTROL CONTRACT: PASS');


// R20: Management must work when Render serves the document at /management without a trailing slash.
{
  const [managementHtml,managementJs,buildScript]=await Promise.all([
    read('original-ui/management/index.html'),read('original-ui/management/management.js'),read('scripts/build-release-ui-restored.mjs')
  ]);
  has(managementHtml,'href="/management/management.css?v=R20-management-path-fix"','R20 Management CSS must use an absolute /management path');
  has(managementHtml,'src="/management/management.js?v=R20-management-path-fix"','R20 Management JS must use an absolute /management path');
  has(managementHtml,'src="/app/supabase-config.js"','R20 Management Supabase config must use an absolute /app path');
  has(managementHtml,'src="/app/vendor/supabase.js"','R20 Management Supabase browser client must use an absolute /app path');
  has(managementHtml,'href="/app/"','R20 Management brand return must not depend on document trailing-slash semantics');
  has(managementJs,'window.location.href=`/app/index.html?support=1&business=','R20 support-session handoff must use an absolute /app URL');
  not(managementJs,'window.location.href=`../app/index.html?support=1&business=','R20 must remove trailing-slash-sensitive Management handoff URLs');
  has(buildScript,'TUINBOOKS UI-RESTORED RELEASE R20','Render build must prove R20 packaging');
}
console.log('TUINBOOKS R20 MANAGEMENT PATH CONTRACT: PASS');
