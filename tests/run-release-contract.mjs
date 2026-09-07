import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');
let checks=0;
const has=(s,v,label)=>{assert.ok(s.includes(v),label);checks++;};
const not=(s,v,label)=>{assert.ok(!s.includes(v),label);checks++;};

const [
  app,auth,login,mobile,settings,settingsRepo,work,moneyPage,businessOverview,
  schedulePage,calendar,basket,visitDialog,scheduleRepo,importExport,management,
  publicDoc,releaseSql,coreSql,r24Sql,r25Sql,styles,buildScript,pkg,copy
]=await Promise.all([
  read('src/app.ts'),
  read('src/lib/auth.ts'),
  read('src/features/auth/login.ts'),
  read('src/mobileApp.ts'),
  read('src/features/business/businessPage.ts'),
  read('src/features/business/businessRepository.ts'),
  read('src/features/work/workPage.ts'),
  read('src/features/billing/moneyPage.ts'),
  read('src/features/business/businessOverviewPage.ts'),
  read('src/features/schedule/schedulePage.ts'),
  read('src/features/schedule/calendar.ts'),
  read('src/features/schedule/basket.ts'),
  read('src/features/schedule/visitActionDialog.ts'),
  read('src/features/schedule/scheduleRepository.ts'),
  read('src/features/importExport/importExportDialog.ts'),
  read('original-ui/management/management.js'),
  read('src/publicDocumentApp.ts'),
  read('supabase/migration-v2-release-completion.sql'),
  read('supabase/INSTALL-V2-CORE.sql'),
  read('supabase/APPLY-R24-MINI-STRESS-BLOCKERS.sql'),
  read('supabase/APPLY-R25-SCHEDULE-BASKET.sql'),
  read('src/styles.css'),
  read('scripts/build-release-ui-restored.mjs'),
  read('package.json'),
  read('scripts/copy-static.mjs'),
]);

// Identity, routing and product naming.
has(app,"params.get('support')==='1'",'Support mode must use support=1');
has(app,"params.get('business')",'Support workspace must take the business UUID from business=');
has(app,"params.get('session')",'Support workspace must preserve the audited session ID');
not(app,"supportBusiness=params.get('support')",'support=1 must never be treated as a business UUID');
has(auth,'tuinbooks_management_open_context_v5938','Support workspace must verify the management session');
has(auth,'p_session_id:sessionId','Support verification must send the exact session ID');
not(login,'TuinBooks v2','Customer sign-in must remain TuinBooks, not rewrite branding');
not(mobile,'TuinBooks Mobile v2','Mobile product label must remain TuinBooks Mobile');

// Current Settings contract. Recent Activity is deliberately retired from Settings.
for(const label of ['Services','Teams & capacity','Mobile access','Business details','Billing defaults','Import / Export'])has(settings,label,`Settings missing ${label}`);
not(settings,'Recent activity','Settings must not expose the retired Recent activity panel or tab');
not(settings,'loadAuditLog','Settings must not execute the retired Settings audit reader');
has(settings,'Field phone PINs','Settings must expose permanent field PINs');
has(settings,'Permanent team PINs remain visible until deliberately replaced or revoked.','Settings must explain permanent PIN behaviour');
has(settings,'Mobile PINs are not available.','Settings must distinguish backend unavailability from No PIN issued');
has(settingsRepo,'PIN creation did not persist','PIN creation must verify persistence');
has(settingsRepo,'PIN revoke did not persist','PIN revoke must verify persistence');

// Field and owner-mobile foundations.
has(mobile,'signInAnonymously','A fresh field phone must establish an anonymous authenticated browser session');
has(mobile,'tuinbooks_v2_claim_field_pin','Field pairing must use permanent PIN authority');
not(mobile,'claim_mobile_access_code','Legacy mobile access-code claim must stay removed');
has(releaseSql,'mobile_team_pins_v2','Release SQL must own permanent team PINs');
has(releaseSql,'tuinbooks_v2_list_field_pins','Release SQL must list permanent PINs for admins');
has(releaseSql,'tuinbooks_v2_generate_field_pin','Release SQL must create/replace permanent PINs');
has(releaseSql,'tuinbooks_v2_claim_field_pin','Release SQL must pair a field phone by permanent PIN');

// Schedule: calm normal mode, explicit rearrange mode and durable operational actions.
has(schedulePage,'rolling-week-strip-v2','Schedule must retain rolling week navigation');
has(schedulePage,'↔ Drag mode','Schedule must retain explicit Drag mode');
has(schedulePage,'chooseMoveScope(visit,series)','A recurring single-card move must ask This visit / This + future');
not(schedulePage,'data-drag-scope="one"','Recurring scope must not be a confusing global mode');
has(calendar,'visit-location','Schedule cards must show street address');
has(calendar,'visit-suburb-inline','Schedule cards must show suburb');
has(calendar,'data-new-additional','Each team/day must expose direct Additional Visit');
has(calendar,'data-new-note','Each team/day must expose Note');
has(calendar,'data-new-event','Each team/day must expose Event');
has(calendar,'ID ${esc(shortId(visit.id))}','Drag ghost must keep the visible visit ID');
has(calendar,'setPointerCapture','Resize must retain pointer ownership');
has(calendar,"handle.style.height='16px'",'Resize handle must have a usable hit target');
has(visitDialog,'data-op="mark-missed"','Scheduled visits must expose Mark missed');
has(visitDialog,'callbacks.onMissed','Mark missed must use the durable missed callback');
has(visitDialog,'Do not service is active for this visit','Visit-level Do not service must remain explicit');
has(visitDialog,'Do not service is active for this client','Client-level Do not service must remain distinct');
has(visitDialog,'It was completed','Missed visit resolution must allow completed-by-office');
has(visitDialog,'Reschedule / catch-up','Missed visit resolution must allow catch-up');
has(visitDialog,'No catch-up / no charge','Missed visit resolution must allow no-return/no-charge');
has(schedulePage,'async function syncWeekSilently()','Saved schedule changes must re-read authoritative state without blanking the calendar');
has(schedulePage,'await syncWeekSilently();','Schedule mutations must verify persisted state after save');

// Basket: only in rearrange mode, idempotent and group-capable.
not(schedulePage,'id="basketToggle"','Normal Schedule mode must not expose a Basket toolbar button');
has(schedulePage,'if(dragMode){\n      basketController=renderBasket','Basket content must render only in rearrange mode');
has(basket,'data-select-queue','Basket cards must support selection');
has(basket,'data-select-all-queue','Basket must support Select all');
has(basket,'onPlaceGroup','Basket must support group placement');
has(scheduleRepo,'tuinbooks_v2_schedule_queue_items_group_r25','Basket group placement must use the atomic RPC');
has(r25Sql,'tuinbooks_v2_schedule_queue_items_group_r25','Current SQL must define atomic Basket group placement');
has(r25Sql,"lower(coalesce(v_item.status,'open'))<>'open'",'Basket placement must reject/recover duplicate retries safely');
has(r25Sql,"'v2QueueItemId',p_queue_item_id",'Placed Basket visits must carry the queue identity for idempotence');

// Work and opportunity flow.
for(const label of ['Quote now','Needs site visit','Design consult','Defer','Close'])has(work,label,`Opportunity triage missing ${label}`);
has(work,'visitDoNotService(visit)','Desktop Work must surface visit-specific Do not service');
has(mobile,'visitDoNotService(visit)','Mobile Work must surface visit-specific Do not service');
has(mobile,'&&!dns&&','Mobile must not offer completion while Do not service is active');

// Billing, quotes and business totals.
has(app,"identity?.planningOnly&&page==='money'",'Planning-only navigation must block Billing');
has(moneyPage,'Billing is disabled','Billing page must block Planning-only mode');
has(r24Sql,'tuinbooks_v2_financials_enabled','Database must enforce Planning-only financial guard');
has(r24Sql,'Billing is disabled in Planning-only mode','Database must reject financial writes in Planning-only mode');
has(businessOverview,"!['Draft','Void','Credited'].includes",'Business totals must use issued-invoice authority rather than drafts');
has(moneyPage,'createPublicDocument','Invoice/quote delivery must use immutable public documents');
has(moneyPage,'paymentTermsDays','Invoices must use configured payment terms');
has(moneyPage,'data-void-invoice','Unissued invoice void workflow must exist');
for(const rpc of ['tuinbooks_v2_next_invoice_number','invoice_visit_links_v2','tuinbooks_v2_create_public_document'])has(releaseSql,rpc,`Release SQL missing ${rpc}`);
has(publicDoc,'tuinbooks_v2_respond_public_quote','Public quote responses must persist');

// Import/export and management surface.
for(const label of ['Pastel CSV','Sage CSV','QuickBooks CSV','Xero CSV'])has(importExport,label,`Import/Export missing ${label}`);
has(management,'window.location.href=`/app/index.html?support=1&business=','Management support handoff must use an absolute /app URL');
not(management,'window.location.href=`../app/index.html?support=1&business=','Trailing-slash-sensitive management handoff must stay removed');
for(const html of ['accept.html','document.html']){await access(html);has(copy,html,`Build must copy ${html}`);}

// SQL safety and support authority.
for(const unsafe of [' end day,',' end week,',') row from public.schedule_jobs','q.row order by','q.week,q.stop'])not(coreSql,unsafe,`Unsafe SQL alias returned: ${unsafe}`);
for(const liveGrant of ['g.allow_operational_read','g.allow_operational_edit','g.allow_financial_read','g.allow_financial_edit'])has(coreSql,liveGrant,`Support authority schema missing ${liveGrant}`);
has(r24Sql,'tuinbooks_v2_can_operational_read','Current support SQL must install operational read authority');
has(r24Sql,'tuinbooks_v2_can_operational_edit','Current support SQL must install operational edit authority');
has(r24Sql,'tuinbooks_v2_can_financial_edit','Current support SQL must install financial edit authority');

// Production build identity and restored office hierarchy.
has(buildScript,"copyAppTree('dist/app', 'index.html')",'Rewrite runtime must publish to /app');
not(buildScript,"cp('original-ui/app', 'dist/app'",'Legacy office engine must never be republished as /app');
has(buildScript,'TUINBOOKS RELEASE R27','Build proof must identify current R27');
has(pkg,'2.0.0-parity-r27','Package version must identify R27');
has(styles,'R27 — LEGACY OFFICE PAGE RESTORATION','Restored office hierarchy styles must remain active');
has(styles,'R23 — card-level quick info: remove repeated i circles from Schedule.','Whole-card quick info must remain active');
not(calendar,'data-visit-info-hover','A separate repeated information-circle control must stay removed');

console.log(`TUINBOOKS CURRENT RELEASE CONTRACT: PASS · ${checks} checks`);
