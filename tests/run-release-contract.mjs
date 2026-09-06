import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
let checks=0;const has=(s,v,label)=>{assert.ok(s.includes(v),label);checks++;};const not=(s,v,label)=>{assert.ok(!s.includes(v),label);checks++;};
const [app,mobile,business,work,money,importExport,management,publicDoc,migration,copy]=await Promise.all([
 read('src/app.ts'),read('src/mobileApp.ts'),read('src/features/business/businessPage.ts'),read('src/features/work/workPage.ts'),read('src/features/billing/moneyPage.ts'),read('src/features/importExport/importExportDialog.ts'),read('src/managementApp.ts'),read('src/publicDocumentApp.ts'),read('supabase/migration-v2-release-completion.sql'),read('scripts/copy-static.mjs')
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
for(const forbidden of ['schedule-exact-canary','schedule-drag-mode-v6061','schedule-drag-basket-v6066','serviceSitesV56']){not((await Promise.all(['src/app.ts','src/mobileApp.ts','src/features/schedule/schedulePage.ts'].map(read))).join('\n'),forbidden,`Legacy pattern returned: ${forbidden}`);}
console.log(`TUINBOOKS V2 RELEASE CONTRACT: PASS · ${checks} checks`);
