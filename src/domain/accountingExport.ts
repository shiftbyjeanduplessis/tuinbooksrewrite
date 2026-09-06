import { lineSubtotal, lineVat, lineTotal } from './billing.js';
import type { Account, Invoice } from './types.js';

export type AccountingTarget='pastel'|'sage'|'quickbooks'|'xero';
export interface AccountingExportRow{[key:string]:string|number;}

export function accountingExportRows(target:AccountingTarget,invoices:Invoice[],accounts:Account[],from:string,to:string):AccountingExportRow[]{
 const accountMap=new Map(accounts.map(a=>[a.id,a]));
 const issued=invoices.filter(i=>!['Draft','Void','Credited'].includes(i.status)&&!!i.issueDate&&i.issueDate!>=from&&i.issueDate!<=to);
 const rows:AccountingExportRow[]=[];
 for(const inv of issued){const account=accountMap.get(inv.accountId);for(const line of inv.lines){const excl=lineSubtotal(line),vat=lineVat(line),incl=lineTotal(line),discount=Math.max(0,Math.min(100,Number(line.discountPercent||0)));
   if(target==='xero')rows.push({ContactName:account?.name??inv.accountId,EmailAddress:account?.email??'',InvoiceNumber:inv.number,InvoiceDate:inv.issueDate??'',DueDate:inv.dueDate??'',Description:line.description,Quantity:line.quantity,UnitAmount:line.unitPrice,Discount:discount,AccountCode:'200',TaxType:Number(line.vatRate||0)>0?'OUTPUT':'NONE',TaxAmount:vat,LineAmount:incl});
   else if(target==='quickbooks')rows.push({Customer:account?.name??inv.accountId,Email:account?.email??'',InvoiceNo:inv.number,InvoiceDate:inv.issueDate??'',DueDate:inv.dueDate??'',ItemDescription:line.description,Quantity:line.quantity,Rate:line.unitPrice,DiscountPercent:discount,TaxPercent:line.vatRate,Subtotal:excl,TaxAmount:vat,Amount:incl});
   else if(target==='sage')rows.push({CustomerName:account?.name??inv.accountId,CustomerEmail:account?.email??'',DocumentNumber:inv.number,DocumentDate:inv.issueDate??'',DueDate:inv.dueDate??'',Description:line.description,Quantity:line.quantity,UnitPrice:line.unitPrice,DiscountPercent:discount,VATRate:line.vatRate,Exclusive:excl,VAT:vat,Inclusive:incl});
   else rows.push({CustomerCode:inv.accountId,CustomerName:account?.name??inv.accountId,DocumentNumber:inv.number,DocumentDate:inv.issueDate??'',DueDate:inv.dueDate??'',Description:line.description,Quantity:line.quantity,UnitPriceExclVAT:line.unitPrice,DiscountPercent:discount,VATRate:line.vatRate,Exclusive:excl,VATAmount:vat,TotalInclVAT:incl});
 }}return rows;
}
export function csvFromRows(rows:AccountingExportRow[]):string{if(!rows.length)return'';const headers=Object.keys(rows[0]);const cell=(v:unknown)=>{const s=String(v??'');return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};return [headers.map(cell).join(','),...rows.map(r=>headers.map(h=>cell(r[h])).join(','))].join('\r\n')+'\r\n';}
export function accountingFileName(target:AccountingTarget,from:string,to:string):string{return`TuinBooks-${target}-${from}-to-${to}.csv`;}
