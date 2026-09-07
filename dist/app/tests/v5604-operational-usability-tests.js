'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const scheduleCss=fs.readFileSync(path.join(root,'schedule-foundation.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const sql=fs.readFileSync(path.resolve(root,'..','migration-v56-0-4-operational-sync-compatibility.sql'),'utf8');
function has(text,needle,message){assert(text.includes(needle),message);}
function lacks(text,needle,message){assert(!text.includes(needle),message);}

has(html,'56.0.5-schedule-card-format1','desktop assets must use the v56.0.4 token');
has(sw,'tuinbooks-shell-v56-0-5-schedule-card-format1','service-worker cache must use v56.0.4');
has(app,"const TUINBOOKS_VERSION_V5600='56.0.5-schedule-card-format1'",'runtime version must be v56.0.4');
lacks(html,'id="backendUserLabel"','account display name must be absent from the header');
has(css,'.desktop-body .backend-user-label{display:none!important}','stale cached account labels must be hidden');
has(css,'.desktop-body .v56-search-button{min-width:160px!important}','search control must be widened');
has(app,"client.rpc('save_operational_snapshot_v5604'",'cloud save must call the compatibility RPC');
has(app,"client.rpc('save_operational_snapshot_v53'",'cloud save must keep a legacy fallback');
has(app,'repairOperationalStateForSyncV5604','local duplicate reconciliation must run before cloud save');
has(app,'Cloud save needs attention','cloud-save failure must have a persistent recovery panel');
has(app,'retryOperationalSyncV5604','cloud-save panel must offer a retry');
has(sql,'save_operational_snapshot_v5604','compatibility migration must create the new RPC');
has(sql,'set row_security = off','security-definer snapshot writer must explicitly bypass table RLS after membership validation');
has(app,"inv.clientId===client.id&&inv.month===month&&inv.status!=='Credited'",'any existing active invoice, including R0 invoices, must suppress missing-draft creation');
has(app,'lateWorkPendingV5604','late work after invoicing must be flagged rather than creating a duplicate active invoice');
has(app,'operatingWeekStartV5604','the scheduler must calculate a current working week');
has(app,'date.getDay()===0?dateAdd(base,7):base','Sunday must open the next working week');
has(app,'pointercancel','duration resizing must recover from cancelled pointer gestures');
has(css,'.schedule-card-resize','schedule duration grip styling must remain present');
has(app,'nav-count-alert-v5604','Work must show an attention badge for unresolved visits and catch-ups');
has(app,'work-record-table-v5604','processed Work Records must render in a compact table');
has(css,'.work-record-row-v5604','compact work-row styling must exist');
has(html,'id="billingHistoryBtnV5604"','billing must expose history separately');
has(html,'Current billing','billing primary view must default to the current period');
console.log('v56.0.4 operational usability static tests passed');
