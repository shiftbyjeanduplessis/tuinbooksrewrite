import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const supabase=path.join(root,'supabase');

const order=[
  'migration-v2-schedule-mutations.sql',
  'migration-v2-recurrence-authority.sql',
  'migration-v2-operational-states.sql',
  'migration-v2-client-authority.sql',
  'migration-v2-work-mobile.sql',
  'migration-v2-money-quotes.sql',
  'migration-v2-business-import-management.sql',
  'migration-v2-release-completion.sql',
  'APPLY-R12-MISSED-VISIT-RESOLUTION.sql',
  'APPLY-R13-GROUP-DRAG.sql',
  'APPLY-R14-VISIT-DETAIL.sql',
  'APPLY-R24-MINI-STRESS-BLOCKERS.sql',
  // Intentional final R27 finance re-run: R24 replaces some finance RPCs.
  'migration-v2-money-quotes.sql',
  'APPLY-R25-SCHEDULE-BASKET.sql',
  // Final recovery authority proven against the 7 Sep QA stress failures.
  'APPLY-R31-RECOVERY-AUTH-DOCUMENTS.sql',
  // Conditional: preserve repaired R29/R30 behavior when that newer live
  // quote-prepayment layer is present; otherwise leave R27 unchanged.
  'APPLY-R31-LIVE-R30-FINANCE-REPAIR.sql',
  'APPLY-R31-LIVE-R30-BILLING-READ.sql',
];

for(const name of order){
  const file=path.join(supabase,name);
  if(!fs.existsSync(file))throw new Error(`Missing canonical migration: ${name}`);
}

const header=`-- TUINBOOKS CURRENT DATABASE INSTALLER\n-- GENERATED FILE — DO NOT EDIT BY HAND\n-- Source: canonical files listed in supabase/APPLY-ORDER.txt\n-- Generated: ${new Date().toISOString()}\n-- Apply to QA/staging first and stop on the first SQL error.\n-- IMPORTANT: a live database with R29/R30 quote-prepayment features is newer than the R27 base; R31 preserves repaired R30 behavior but does not authorize downgrading a newer database with older base SQL.\n\n`;
const body=order.map((name,index)=>{
  const sql=fs.readFileSync(path.join(supabase,name),'utf8').replace(/^\uFEFF/,'').trim();
  return `-- ============================================================================\n-- STEP ${index+1}: ${name}\n-- ============================================================================\n${sql}\n`;
}).join('\n');
const output=path.join(supabase,'INSTALL-CURRENT.sql');
fs.writeFileSync(output,header+body+'\n','utf8');
console.log(`TUINBOOKS DATABASE INSTALLER: ${order.length} steps -> ${path.relative(root,output)}`);
