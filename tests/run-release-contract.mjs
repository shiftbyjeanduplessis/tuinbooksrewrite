import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
let checks=0;const has=(s,v,label)=>{assert.ok(s.includes(v),label);checks++;};const not=(s,v,label)=>{assert.ok(!s.includes(v),label);checks++;};
const [app,mobile,business,work,money,importExport,management,publicDoc,migration,copy,coreSql]=await Promise.all([
 read('src/app.ts'),read('src/mobileApp.ts'),read('src/features/business/businessPage.ts'),read('src/features/work/workPage.ts'),read('src/features/billing/moneyPage.ts'),read('src/features/importExport/importExportDialog.ts'),read('src/managementApp.ts'),read('src/publicDocumentApp.ts'),read('supabase/migration-v2-release-completion.sql'),read('scripts/copy-static.mjs'),read('supabase/INSTALL-V2-CORE.sql')
]);
has(app,"'business'",'Business navigation must be wired');has(app,'loadSupportAuthContext','Support workspace auth must be wired');
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
