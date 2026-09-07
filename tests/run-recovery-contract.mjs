import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const [settings,settingsRepo,business,calendar,visitDialog,moneySql,applyOrder,dbBuilder,mobile,r31Auth,r31Finance,r31BillingRead]=await Promise.all([
  read('src/features/business/businessPage.ts'),
  read('src/features/business/businessRepository.ts'),
  read('src/features/business/businessOverviewPage.ts'),
  read('src/features/schedule/calendar.ts'),
  read('src/features/schedule/visitActionDialog.ts'),
  read('supabase/migration-v2-money-quotes.sql'),
  read('supabase/APPLY-ORDER.txt'),
  read('scripts/build-current-database-installer.mjs'),
  read('src/mobileApp.ts'),
  read('supabase/APPLY-R31-RECOVERY-AUTH-DOCUMENTS.sql'),
  read('supabase/APPLY-R31-LIVE-R30-FINANCE-REPAIR.sql'),
  read('supabase/APPLY-R31-LIVE-R30-BILLING-READ.sql'),
]);
let checks=0;
const has=(s,v,label)=>{assert.ok(s.includes(v),label);checks++;};
const not=(s,v,label)=>{assert.ok(!s.includes(v),label);checks++;};

not(settings,'Recent activity','Settings must not restore the removed Recent activity feature');
not(settings,'loadAuditLog','Settings must not execute the removed audit reader');
not(settingsRepo,'loadAuditLog','Settings repository must not retain the retired audit RPC reader');
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

has(applyOrder,'[RE-RUN — final R27 finance authority]','Install order must explicitly restore final R27 finance authority after R24');
has(applyOrder,'APPLY-R25-SCHEDULE-BASKET.sql','Current install order must include durable R25 Basket RPCs');
has(applyOrder,'APPLY-R31-RECOVERY-AUTH-DOCUMENTS.sql','Install order must finish the PIN/public-document repair');
has(applyOrder,'APPLY-R31-LIVE-R30-FINANCE-REPAIR.sql','Install order must preserve repaired live R30 finance when present');
has(applyOrder,'APPLY-R31-LIVE-R30-BILLING-READ.sql','Install order must preserve repaired live R30 Billing review when present');
has(dbBuilder,"'APPLY-R31-RECOVERY-AUTH-DOCUMENTS.sql'",'Generated installer must include R31 PIN/public-document authority');
has(dbBuilder,"'APPLY-R31-LIVE-R30-FINANCE-REPAIR.sql'",'Generated installer must include conditional R30 repair authority');
has(dbBuilder,"'APPLY-R31-LIVE-R30-BILLING-READ.sql'",'Generated installer must include conditional R30 Billing read authority');

has(r31Auth,'on conflict on constraint mobile_team_pins_v2_pkey','PIN generation must use an unambiguous conflict target');
not(r31Auth,'on conflict(business_id,team_id)','R31 PIN generation must not reintroduce the ambiguous team_id target');
has(r31Auth,'extensions.gen_random_bytes','Public document tokens must use Supabase pgcrypto schema explicitly');
has(r31Auth,'extensions.digest','Public document hashing must use Supabase pgcrypto schema explicitly');
has(r31Finance,'v_qp record','R30 prepayment reconciler must not collide with the quote-payments table alias');
not(r31Finance,'declare qp record','R30 must not reintroduce the unassigned qp record collision');
has(r31Finance,"c.payload->>'monthlyFee'",'R30 repair must understand imported legacy monthly fees');
has(r31Finance,"lower(j.status)='cancelled'",'R30 repair must count chargeable routine cancellations as billable occurrences');
has(r31BillingRead,"'routine_monthly_fee'",'R30 Billing review must expose routine monthly fee');
has(r31BillingRead,"c.payload->>'monthlyFee'",'R30 Billing review must understand imported legacy monthly fees');
has(r31BillingRead,"'billing_disposition'",'R30 Billing review must retain explicit charge/no-charge state');
has(r31BillingRead,"lower(e.status)='cancelled'",'R30 Billing review count must include chargeable routine cancellations');

has(mobile,'signInAnonymously','Field PIN pairing must create a mobile browser auth session');
has(mobile,'tuinbooks_v2_claim_field_pin','Field PIN pairing must claim against permanent PIN authority');

console.log(`TUINBOOKS RECOVERY CONTRACT: PASS · ${checks} checks`);
