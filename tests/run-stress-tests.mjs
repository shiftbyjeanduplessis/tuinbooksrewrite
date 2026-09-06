import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseV4Sheets, v4RowsForExport, V4_SHEETS } from '../.domain-test/domain/business.js';
import { seriesDueDates } from '../.domain-test/domain/recurrence.js';
import { moneySummary } from '../.domain-test/domain/billing.js';
const fixture=JSON.parse(await readFile(new URL('./v4-stress-fixture.json',import.meta.url),'utf8'));
const parsed=parseV4Sheets(fixture);
assert.equal(parsed.ok,true,parsed.errors.join('\n'));
assert.deepEqual(parsed.counts,{accounts:100,locations:110,teams:5,services:1,routes:165});
assert.ok(parsed.snapshot);
const rows=v4RowsForExport(parsed.snapshot);
assert.deepEqual(Object.keys(rows),[...V4_SHEETS]);
assert.equal(rows['4 Clients Accounts'].length,103);
assert.equal(rows['5 Service Locations'].length,113);
// 200-client synthetic recurrence/load exercise: 220 locations, mixed recurrence, 8-week horizon.
let due=0;for(let i=0;i<220;i++){const frequency=i%13===0?'monthly':i%5===0?'fortnightly':i%11===0?'four-weekly':'weekly';const weekday=i%5+1;const series={id:`s${i}`,businessId:'b',accountId:`c${i%200}`,serviceLocationId:`site${i}`,status:'active',frequency,anchorDate:'2026-08-31',slots:[{id:`slot${i}`,seriesId:`s${i}`,weekday,monthlyOrdinal:frequency==='monthly'?2:null,defaultTeamId:`t${i%5}`,estimatedMinutes:60,serviceIds:['svc'],payload:{}}],payload:{}};due+=seriesDueDates(series,'2026-08-31','2026-10-25').length;}
assert.ok(due>1200&&due<1900,`unexpected generated visit count ${due}`);
// 10,000 invoice/payment records should aggregate deterministically without mutation.
const invoices=[],payments=[];for(let i=0;i<10000;i++){invoices.push({id:`i${i}`,businessId:'b',accountId:`c${i%200}`,month:'2026-09',number:`INV-${i}`,issueDate:'2026-09-01',dueDate:'2026-09-07',status:'Sent',lines:[{id:`l${i}`,description:'Routine',quantity:1,unitPrice:450,vatRate:0,sourceVisitId:`v${i}`,sourceQuoteId:null,category:'routine'}],notes:'',createdAt:null,updatedAt:null});if(i%2===0)payments.push({id:`p${i}`,businessId:'b',accountId:`c${i%200}`,invoiceId:`i${i}`,date:'2026-09-03',amount:450,method:'EFT',reference:'',note:'',reversedAt:null,createdAt:null});}
const summary=moneySummary(invoices,payments,'2026-09-10');assert.equal(summary.invoiced,4500000);assert.equal(summary.received,2250000);assert.equal(summary.outstanding,2250000);assert.equal(summary.overdue,2250000);
console.log(`TUINBOOKS V2 STRESS: PASS · v4=${parsed.counts.accounts} accounts/${parsed.counts.locations} locations · 200-client recurrence=${due} visits · 10,000 invoices`);
