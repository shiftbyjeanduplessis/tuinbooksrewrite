import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const [settings,settingsRepo,business,calendar,visitDialog,moneySql,applyOrder,dbBuilder,mobile]=await Promise.all([
  read('src/features/business/businessPage.ts'),
  read('src/features/business/businessRepository.ts'),
  read('src/features/business/businessOverviewPage.ts'),
  read('src/features/schedule/calendar.ts'),
  read('src/features/schedule/visitActionDialog.ts'),
  read('supabase/migration-v2-money-quotes.sql'),
  read('supabase/APPLY-ORDER.txt'),
  read('scripts/build-current-database-installer.mjs'),
  read('src/mobileApp.ts'),
]);
let checks=0;
const has=(s,v,label)=>{assert.ok(s.includes(v),label);checks++;};
const not=(s,v,label)=>{assert.ok(!s.includes(v),label);checks++;};

not(settings,'Recent activity','Settings must not restore the removed Recent activity feature');
not(settings,'loadAuditLog','Settings must not execute the removed audit reader');
for(const label of ['Services','Teams & capacity','Mobile access','Business details','Billing defaults','Import / Export'])has(settings,label,`Restored Settings missing ${label}`);
has(settings,'Mobile PINs are not available.','Settings must distinguish a missing PIN contract from No PIN issued');
has(settingsRepo,'PIN creation did not persist','PIN creation must verify persistence before reporting success');
has(settingsRepo,'PIN revoke did not persist','PIN revoke must verify persistence before reporting success');

has(visitDialog,'data-op="mark-missed"','Scheduled visit actions must expose Mark missed');
has(visitDialog,'callbacks.onMissed','Mark missed must use the durable missed callback');
has(calendar,'setPointerCapture','Resize must retain pointer ownership while dragging');
has(calendar,"handle.style.height='16px'",'Resize must have a usable hit target');

has(business,"!['Draft','Void','Credited'].includes",'Business totals must exclude draft/void/credited invoices like Billing');

for(const marker of [
  'discount_percent',
  'invoice_visit_links_v2',
  'visit_id text not null',
  'tuinbooks_v2_visit_default_amount',
  'tuinbooks_v2_client_monthly_billing',
  'tuinbooks_v2_visit_already_invoiced',
  'ql.discount_percent',
  "sourceQuoteId',source_quote",
  "'Chargeable cancellation'",
  'tuinbooks_v2_can_financial_edit',
  'tuinbooks_v2_financials_enabled',
])has(moneySql,marker,`Canonical finance migration missing ${marker}`);
not(moneySql,'source_visit_id text not null,\n invoice_id text not null','Invoice visit authority must not invent a competing source_visit_id schema');
has(applyOrder,'[RE-RUN — final finance authority]','Install order must explicitly restore final finance authority after R24');
has(applyOrder,'APPLY-R25-SCHEDULE-BASKET.sql','Current install order must include durable R25 Basket RPCs');
has(dbBuilder,"'migration-v2-money-quotes.sql',\n  'APPLY-R25-SCHEDULE-BASKET.sql'",'Generated current installer must end with final finance authority then R25');
has(mobile,'signInAnonymously','Field PIN pairing must create a mobile browser auth session');
has(mobile,'tuinbooks_v2_claim_field_pin','Field PIN pairing must claim against permanent PIN authority');

console.log(`TUINBOOKS RECOVERY CONTRACT: PASS · ${checks} checks`);
