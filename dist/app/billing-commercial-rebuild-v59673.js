/*
 * TuinBooks v59.6.73 — authoritative Billing + commercial-document UX
 *
 * Goals:
 * - one primary page scroll (no nested Billing scrollers)
 * - service / booking dates on invoice work evidence
 * - time when a meaningful booking/start/completion time exists
 * - keep fixed-monthly financial lines intact while showing service occurrences separately
 * - keep one canonical commercial-document path for preview/email/WhatsApp
 * - load last so legacy Billing renderers cannot re-take ownership
 */
(()=>{
  'use strict';
  const BUILD='59.6.73-billing-commercial-rebuild';
  const q=id=>document.getElementById(id);
  const escHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isoDate=value=>{const m=String(value||'').match(/\d{4}-\d{2}-\d{2}/);return m?m[0]:'';};
  const cleanTime=value=>{const raw=String(value||'').trim();const m=raw.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?/);return m?`${String(m[1]).padStart(2,'0')}:${m[2]}`:'';};
  const localClock=value=>{
    if(!value)return '';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
    try{return new Intl.DateTimeFormat('en-ZA',{hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(/^24:/,'00:');}catch(_){return '';}
  };
  const dateText=value=>{try{return value&&typeof fmtDate==='function'?fmtDate(value):value||'—';}catch(_){return value||'—';}};
  const moneyText=value=>{try{return typeof money==='function'?money(value):`R ${Number(value||0).toFixed(2)}`;}catch(_){return `R ${Number(value||0).toFixed(2)}`;}};
  const lineAmount=line=>{try{return typeof lineTotal==='function'?lineTotal(line):Number(line?.total||Number(line?.qty||1)*Number(line?.unitPrice||0));}catch(_){return Number(line?.total||0);}};

  function visitById(id){return (state?.visits||[]).find(row=>String(row?.id||'')===String(id||''))||null;}
  function jobById(id){return (state?.schedules||[]).find(row=>String(row?.id||'')===String(id||''))||null;}
  function jobForVisit(visit){return visit?jobById(visit.scheduledJobId||visit.scheduleJobId||visit.jobId):null;}
  function lineVisit(line){return visitById(line?.sourceVisitId||line?.visitId||line?.workRecordId);}
  function lineJob(line,visit=lineVisit(line)){
    const explicit=jobById(line?.sourceScheduleId||line?.scheduleJobId||line?.jobId);
    return explicit||jobForVisit(visit);
  }
  function meaningfulMoment({line=null,visit=null,job=null}={}){
    visit=visit||lineVisit(line);job=job||lineJob(line,visit);
    const date=isoDate(line?.date||line?.serviceDate||line?.serviceDateV59391||line?.bookingDate||visit?.date||visit?.workDate||job?.date||job?.visitDate);
    const direct=cleanTime(line?.time||line?.serviceTime||line?.serviceTimeV59673);
    if(direct)return {date,time:direct,timeBasis:String(line?.timeBasis||line?.serviceTimeBasisV59673||'Service')};
    const booking=cleanTime(line?.bookingTime||job?.bookingTime||job?.scheduledTime||job?.startTime||job?.time||job?.slotTime||job?.routeTime);
    if(booking)return {date,time:booking,timeBasis:'Booked'};
    const started=cleanTime(line?.startedTime)||localClock(visit?.startedAt||job?.startedAt);
    if(started)return {date,time:started,timeBasis:'Started'};
    const completed=cleanTime(line?.completedTime)||localClock(visit?.completedAt||visit?.createdAt||job?.actualCompletedAtV59377||job?.completedAt);
    if(completed)return {date,time:completed,timeBasis:'Completed'};
    return {date,time:'',timeBasis:''};
  }

  function recurringVisitEvidence(clientId,month){
    return (state?.visits||[])
      .filter(v=>String(v?.clientId||'')===String(clientId||'')&&isoDate(v?.date).startsWith(`${month}-`))
      .filter(v=>{
        const job=jobForVisit(v),text=String(`${job?.workKind||''} ${job?.revenueType||''} ${job?.workMarker||''}`).toLowerCase();
        return !/once.?off|one.?off|ad.?hoc|quoted/.test(text)&&String(job?.workMarker||'').toUpperCase()!=='O';
      });
  }

  function serviceEventsForInvoice(inv){
    if(!inv)return [];
    const events=[];const seen=new Set();
    const add=(date,time,timeBasis,status,description,sourceId='')=>{
      const d=isoDate(date);if(!d)return;
      const t=cleanTime(time);const key=`${d}|${t}|${status}|${description}|${sourceId}`;if(seen.has(key))return;seen.add(key);
      events.push({date:d,time:t,timeBasis:timeBasis||'',status:status||'Service',description:description||'Garden service',sourceId:sourceId||''});
    };
    (inv.lineItems||[]).forEach(line=>{
      const visit=lineVisit(line),job=lineJob(line,visit),moment=meaningfulMoment({line,visit,job});
      if(moment.date)add(moment.date,moment.time,moment.timeBasis,'Completed',line.description||'Service',visit?.id||line?.sourceVisitId||'');
      (line.serviceOccurrencesV59673||[]).forEach(item=>add(item.date,item.time,item.timeBasis,item.status,item.description,line.id));
    });
    const month=String(inv.month||isoDate(inv.issueDate||inv.createdAt)).slice(0,7);
    const clientId=inv.clientId;
    const monthly=(inv.lineItems||[]).some(line=>String(line?.sourceType||'')==='recurring-contract')||inv.monthlyCycleInvoiceV59376===true;
    if(monthly&&/^\d{4}-\d{2}$/.test(month)){
      recurringVisitEvidence(clientId,month).forEach(visit=>{
        const job=jobForVisit(visit),moment=meaningfulMoment({visit,job});
        add(moment.date,moment.time,moment.timeBasis,'Completed',String((visit.workDone||[]).join(', ')||'Garden service'),visit.id);
      });
      (state?.schedules||[]).filter(job=>String(job?.clientId||'')===String(clientId||'')&&isoDate(job?.date).startsWith(`${month}-`))
        .filter(job=>!['cancelled','missed','completed','no-charge'].includes(String(job?.status||'').toLowerCase()))
        .forEach(job=>{const moment=meaningfulMoment({job});add(moment.date,moment.time,moment.timeBasis||'Booked','Scheduled',String(job.serviceName||job.description||'Garden service'),job.id);});
    }
    events.sort((a,b)=>`${a.date} ${a.time||'99:99'}`.localeCompare(`${b.date} ${b.time||'99:99'}`));
    return events;
  }

  function enrichDraftInvoice(inv){
    if(!inv||typeof commercialInvoiceIssuedV59400==='function'&&commercialInvoiceIssuedV59400(inv))return false;
    let changed=false;
    (inv.lineItems||[]).forEach(line=>{
      const moment=meaningfulMoment({line});
      if(moment.date&&!line.serviceDate&&!line.date){line.serviceDate=moment.date;changed=true;}
      if(moment.time&&!line.serviceTime&&!line.time){line.serviceTime=moment.time;line.serviceTimeBasisV59673=moment.timeBasis;changed=true;}
    });
    const month=String(inv.month||'');
    if(/^\d{4}-\d{2}$/.test(month)){
      const occurrences=serviceEventsForInvoice(inv).filter(e=>e.status==='Completed'),client=clientById(inv.clientId)||{};
      (inv.lineItems||[]).filter(line=>String(line?.sourceType||'')==='recurring-contract').forEach(line=>{
        const next=occurrences.map(e=>({date:e.date,time:e.time,timeBasis:e.timeBasis,status:e.status,description:e.description}));
        if(JSON.stringify(line.serviceOccurrencesV59673||[])!==JSON.stringify(next)){line.serviceOccurrencesV59673=next;changed=true;}
        const service=typeof billingExplicitServiceV59383==='function'?billingExplicitServiceV59383(client):(line.description||'Garden service').split(' — ')[0],cleanDescription=`${service||'Garden service'} — ${typeof monthLabel==='function'?monthLabel(month):month}`;
        if(line.sourceManaged!==false&&String(line.description||'')!==cleanDescription){line.description=cleanDescription;changed=true;}
      });
    }
    return changed;
  }

  /* Enrich new billing source lines at creation time. */
  if(typeof billingSourceLines==='function'){
    const baseBillingSourceLinesV59673=billingSourceLines;
    billingSourceLines=function billingSourceLinesV59673(client,month){
      const rows=baseBillingSourceLinesV59673(client,month)||[];
      rows.forEach(line=>{
        const moment=meaningfulMoment({line});
        if(moment.date&&!line.date&&!line.serviceDate)line.serviceDate=moment.date;
        if(moment.time&&!line.time&&!line.serviceTime){line.serviceTime=moment.time;line.serviceTimeBasisV59673=moment.timeBasis;}
        if(String(line.sourceType||'')==='recurring-contract'){
          line.serviceOccurrencesV59673=recurringVisitEvidence(client?.id,month).map(visit=>{const m=meaningfulMoment({visit,job:jobForVisit(visit)});return {date:m.date,time:m.time,timeBasis:m.timeBasis,status:'Completed',description:String((visit.workDone||[]).join(', ')||'Garden service')};});
        }
      });
      return rows;
    };
  }


  /* Quick once-off invoices can record a real service time, but it is optional. */
  if(typeof window.openNewInvoiceV58952==='function'){
    const openNewInvoiceBaseV59673=window.openNewInvoiceV58952;
    window.openNewInvoiceV58952=function openNewInvoiceV59673(options={}){
      const result=openNewInvoiceBaseV59673(options);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const dialog=q('quickInvoiceDialogV59391'),form=dialog?.querySelector('#quickInvoiceFormV59391');if(!form||form.querySelector('#quickInvoiceWorkTimeV59673'))return;
        const workDate=form.querySelector('#quickInvoiceWorkDateV59391'),grid=workDate?.closest('.form-grid');if(!workDate||!grid)return;
        const label=document.createElement('label');label.className='quick-invoice-service-time-v59673';label.innerHTML='Service / booking time <span class="optional-marker-v59673">optional</span><input id="quickInvoiceWorkTimeV59673" type="time" step="300"><small>Use only when an actual or meaningful time applies.</small>';
        workDate.closest('label')?.insertAdjacentElement('afterend',label);
        const submitBase=form.onsubmit;
        form.onsubmit=function submitQuickInvoiceV59673(event){
          const before=new Set((state.invoices||[]).map(row=>row.id)),time=cleanTime(form.querySelector('#quickInvoiceWorkTimeV59673')?.value),date=isoDate(workDate.value);
          const output=submitBase?.call(form,event);
          if(time){
            const invoice=(state.invoices||[]).find(row=>!before.has(row.id));
            if(invoice){invoice.workTimeV59673=time;(invoice.lineItems||[]).forEach(line=>{if(!line.serviceDate&&!line.date)line.serviceDate=date;if(!line.serviceTime&&!line.time){line.serviceTime=time;line.serviceTimeBasisV59673='Service';}});enrichDraftInvoice(invoice);save();if(typeof renderInvoiceCentre==='function')renderInvoiceCentre();}
          }
          return output;
        };
      }));
      return result;
    };
  }

  /* Canonical snapshot: every work line has date/time evidence where available. */
  if(typeof commercialLineSnapshotV59400==='function'){
    commercialLineSnapshotV59400=function commercialLineSnapshotV59673(line){
      const moment=meaningfulMoment({line});
      return {
        id:line?.id||'',
        date:moment.date||isoDate(line?.date||line?.serviceDate),
        time:moment.time||cleanTime(line?.time||line?.serviceTime),
        timeBasis:moment.timeBasis||line?.serviceTimeBasisV59673||'',
        description:String(line?.description||'').trim()||'Service not specified',
        qty:Number(line?.qty||1),
        unitPrice:Number(line?.unitPrice||0),
        total:lineAmount(line)
      };
    };
  }

  if(typeof commercialSnapshotV59400==='function'){
    const baseCommercialSnapshotV59673=commercialSnapshotV59400;
    commercialSnapshotV59400=function commercialSnapshotV59673(type,row,extra={}){
      if(type==='invoice'||type==='credit_note')enrichDraftInvoice(row);
      const snapshot=baseCommercialSnapshotV59673(type,row,extra)||{};
      if(type==='invoice'||type==='credit_note')snapshot.serviceEvents=serviceEventsForInvoice(row);
      snapshot.documentSchemaV59673='dated-service-evidence-v1';
      return snapshot;
    };
  }

  function serviceEvidenceHtml(snapshot){
    const rows=Array.isArray(snapshot?.serviceEvents)?snapshot.serviceEvents:[];
    if(!rows.length)return '';
    return `<section class="canonical-service-evidence-v59673"><div class="canonical-section-label-v59673">Service / booking dates</div><table class="canonical-service-table-v59673"><thead><tr><th>Date</th><th>Time</th><th>Status</th><th>Service</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escHtml(dateText(row.date))}</td><td>${row.time?`${escHtml(row.time)}${row.timeBasis?`<small>${escHtml(row.timeBasis)}</small>`:''}`:'—'}</td><td>${escHtml(row.status||'Service')}</td><td>${escHtml(row.description||'Garden service')}</td></tr>`).join('')}</tbody></table></section>`;
  }

  function canonicalInvoiceHtml(snapshot){
    const issuer=snapshot.issuer||{},customer=snapshot.customer||{},totals=snapshot.totals||{},type=snapshot.documentType;
    const label=({quote:'QUOTE',invoice:'INVOICE',credit_note:'CREDIT NOTE',proforma:'PROFORMA INVOICE'})[type]||String(type||'DOCUMENT').toUpperCase();
    const brand=issuer.tradingName||issuer.displayName||issuer.legalName||state?.business?.name||'Garden service';
    const initials=brand.split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase();
    const lines=snapshot.lineItems||[];
    return `<article class="canonical-document-v59400 canonical-document-v59673">
      <header class="canonical-header-v59673">
        <div class="canonical-brand-v59400">${issuer.logoUrl?`<img src="${escHtml(issuer.logoUrl)}" alt="${escHtml(brand)} logo">`:`<span>${escHtml(initials||'TB')}</span>`}<div><h2>${escHtml(brand)}</h2>${issuer.legalName&&issuer.legalName!==brand?`<small>${escHtml(issuer.legalName)}</small>`:''}<small>${[issuer.registrationNumber?`Reg ${issuer.registrationNumber}`:'',issuer.vatRegistered&&issuer.vatNumber?`VAT ${issuer.vatNumber}`:''].filter(Boolean).map(escHtml).join(' · ')}</small></div></div>
        <div class="canonical-doc-title-v59400"><strong>${escHtml(label)}</strong><span>${escHtml(snapshot.number||'Draft')}</span></div>
      </header>
      <section class="canonical-info-grid-v59400 canonical-info-grid-v59673">
        <div><small>Bill to</small><strong>${escHtml(customer.name||'Customer')}</strong>${customer.contact?`<span>${escHtml(customer.contact)}</span>`:''}<span>${escHtml(customer.billingAddress||customer.serviceAddress||'')}</span>${customer.email?`<span>${escHtml(customer.email)}</span>`:''}</div>
        <div><small>Document</small><strong>${escHtml(snapshot.number||'Draft')}</strong><span>Issued: ${escHtml(dateText(snapshot.issueDate))}</span>${snapshot.dueDate?`<span>Payment due: ${escHtml(dateText(snapshot.dueDate))}</span>`:''}${snapshot.validUntil?`<span>Valid until: ${escHtml(dateText(snapshot.validUntil))}</span>`:''}${snapshot.service?.period?`<span>Service period: ${escHtml(snapshot.service.period)}</span>`:''}</div>
      </section>
      ${snapshot.customerNote?`<section class="canonical-note-v59400"><small>${type==='quote'?'Proposed work':'Note'}</small><p>${escHtml(snapshot.customerNote)}</p></section>`:''}
      <section class="canonical-financial-lines-v59673"><div class="canonical-section-label-v59673">${type==='invoice'||type==='credit_note'?'Invoice lines':'Items'}</div><div class="canonical-table-wrap-v59673"><table><thead><tr><th>Date</th><th>Time</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${lines.map(line=>`<tr><td>${line.date?escHtml(dateText(line.date)):'—'}</td><td>${line.time?`${escHtml(line.time)}${line.timeBasis?`<small>${escHtml(line.timeBasis)}</small>`:''}`:'—'}</td><td>${escHtml(line.description||'Service')}</td><td>${escHtml(line.qty)}</td><td>${moneyText(line.unitPrice)}</td><td>${moneyText(line.total)}</td></tr>`).join('')||'<tr><td colspan="6">No line items recorded.</td></tr>'}</tbody></table></div></section>
      ${type==='invoice'||type==='credit_note'?serviceEvidenceHtml(snapshot):''}
      <section class="canonical-bottom-v59400 canonical-bottom-v59673"><div><small>Terms</small><p>${escHtml(snapshot.paymentTerms||'')}</p></div><div class="canonical-totals-v59400"><span><i>Subtotal</i><strong>${moneyText(totals.subtotal)}</strong></span>${totals.vat||totals.vatRate?`<span><i>VAT${totals.vatRate?` (${totals.vatRate}%)`:''}</i><strong>${moneyText(totals.vat)}</strong></span>`:''}<span class="grand"><i>${type==='quote'?'Quote total':type==='credit_note'?'Credit total':'Total'}</i><strong>${moneyText(totals.total)}</strong></span>${!['quote','proforma'].includes(type)?`<span class="grand"><i>Balance due</i><strong>${moneyText(totals.balance)}</strong></span>`:''}</div></section>
      <footer><div>${[issuer.bankName,issuer.bankAccountHolder,issuer.bankAccountNumber?`Account ${issuer.bankAccountNumber}`:'',issuer.bankBranchCode?`Branch ${issuer.bankBranchCode}`:'',issuer.paymentReferenceNote].filter(Boolean).map(escHtml).join(' · ')}</div><small>${escHtml(issuer.documentFooter||'')}</small></footer>
    </article>`;
  }

  if(typeof commercialDocumentHtmlV59400==='function'){
    const baseCommercialDocumentHtmlV59673=commercialDocumentHtmlV59400;
    commercialDocumentHtmlV59400=function commercialDocumentHtmlV59673(snapshot){
      if(snapshot?.documentType==='statement')return baseCommercialDocumentHtmlV59673(snapshot);
      return canonicalInvoiceHtml(snapshot||{});
    };
  }

  function lineRowsHtml(inv){
    return `<div class="billing-line-table-wrap-v59673"><table class="billing-line-table-v59673"><thead><tr><th>Service date</th><th>Time</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${(inv.lineItems||[]).map(line=>{const m=meaningfulMoment({line});return `<tr><td>${m.date?escHtml(dateText(m.date)):'—'}</td><td>${m.time?`<strong>${escHtml(m.time)}</strong>${m.timeBasis?`<small>${escHtml(m.timeBasis)}</small>`:''}`:'—'}</td><td>${escHtml(line.description||'Service not specified')}</td><td>${escHtml(Number(line.qty||1))}</td><td>${moneyText(Number(line.unitPrice||0))}</td><td><strong>${moneyText(lineAmount(line))}</strong></td></tr>`;}).join('')||'<tr><td colspan="6">No invoice lines.</td></tr>'}</tbody></table></div>`;
  }

  function serviceEventRowsHtml(inv){
    const rows=serviceEventsForInvoice(inv);if(!rows.length)return '';
    return `<section class="billing-service-evidence-v59673"><div class="section-title-row"><div><span class="eyebrow">Service evidence</span><h3>Service / booking dates</h3><p>Times are shown only where a booking, start or completion time is actually recorded.</p></div></div><div class="billing-service-grid-v59673">${rows.map(row=>`<div><span><strong>${escHtml(dateText(row.date))}</strong>${row.time?`<small>${escHtml(row.time)} · ${escHtml(row.timeBasis||'Time')}</small>`:'<small>No meaningful time recorded</small>'}</span><span>${escHtml(row.status||'Service')}</span><em>${escHtml(row.description||'Garden service')}</em></div>`).join('')}</div></section>`;
  }

  if(typeof commercialMonthlyReconciliationV59400==='function'){
    commercialMonthlyReconciliationV59400=function commercialMonthlyReconciliationV59673(inv){
      const client=clientById(inv.clientId)||{},month=inv.month||isoDate(inv.issueDate||localDateISO()).slice(0,7);
      const monthly=(typeof effectiveBillingModeV59383==='function'?effectiveBillingModeV59383(client):'')==='monthly'||String(client.billingArrangement||'').toLowerCase().includes('monthly')||(inv.lineItems||[]).some(line=>String(line.sourceType||'')==='recurring-contract');
      if(!monthly)return '';
      const expected=typeof expectedVisitsInMonthV5545==='function'?expectedVisitsInMonthV5545(client,month):0;
      const events=serviceEventsForInvoice(inv),completed=events.filter(row=>row.status==='Completed'),scheduled=events.filter(row=>row.status==='Scheduled'),remaining=Math.max(0,expected-completed.length-scheduled.length);
      return `<section class="monthly-reconcile-v59400 monthly-reconcile-v59673"><div class="section-title-row"><div><span class="eyebrow">Monthly service check</span><h3>${expected||completed.length+scheduled.length} expected · ${completed.length} completed · ${scheduled.length} scheduled</h3><p>The monthly charge remains one financial line; service dates are shown as evidence and are not double-charged.</p></div>${remaining?`<span class="status-badge review">${remaining} not scheduled</span>`:'<span class="status-badge ready">Covered</span>'}</div></section>`;
    };
  }

  if(typeof renderCommercialInvoiceDetailV59400==='function'){
    renderCommercialInvoiceDetailV59400=function renderCommercialInvoiceDetailV59673(id){
      const inv=invoiceById(id),host=q('billingInvoiceDetailV58952');if(!inv||!host)return;
      enrichDraftInvoice(inv);
      const client=clientById(inv.clientId)||{},availability=commercialInvoiceAvailabilityV59400(inv),payment=commercialInvoicePaymentStateV59400(inv),delivery=commercialInvoiceDeliveryV59400(inv),issued=commercialInvoiceIssuedV59400(inv);
      host.classList.remove('hidden');
      host.innerHTML=`<div class="commercial-invoice-workspace-v59400 billing-workspace-v59673">
        <header><div><button class="icon-button" onclick="closeCommercialInvoiceV59400()" aria-label="Back to invoice list">←</button><div><span class="eyebrow">${issued?'Issued document':'Invoice draft'}</span><h2>${escHtml(inv.number||'Draft invoice')}</h2><p>${escHtml(client.name||'Customer')} ${commercialProfileBadgeV59400(inv)}</p></div></div><strong>${moneyText(invoiceTotal(inv))}</strong></header>
        <section class="commercial-invoice-status-grid-v59400"><div><small>Document</small><strong>${issued?'Issued':'Draft'}</strong></div><div><small>Availability</small><strong>${escHtml(availability.label)}</strong></div><div><small>Payment</small><strong>${escHtml(payment.label)}</strong></div><div><small>Delivery</small><strong>${escHtml(delivery.label)}</strong></div></section>
        ${commercialMonthlyReconciliationV59400(inv)}
        <section><div class="section-title-row"><div><span class="eyebrow">Charge detail</span><h3>Invoice lines</h3><p>Completed work carries its service / booking date and a meaningful time where one exists.</p></div></div>${lineRowsHtml(inv)}</section>
        ${serviceEventRowsHtml(inv)}
        <section><div class="section-title-row"><div><span class="eyebrow">Delivery audit</span><h3>Delivery history</h3></div></div>${commercialDeliveryTimelineHtmlV59400(inv)}</section>
        <div class="billing-action-bar-v59673"><button class="button secondary" onclick="previewInvoice('${id}')">Preview PDF</button>${!issued?`<button class="button" onclick="openCommercialSendV59400('invoice','${id}')">Issue & send</button>`:`<button class="button" onclick="openCommercialSendV59400('invoice','${id}')">Email / WhatsApp</button>`}<button class="button secondary" onclick="markInvoicePaid('${id}')">Record payment</button>${issued?`<button class="button secondary" onclick="createCreditNote('${id}')">Credit note</button>`:''}</div>
      </div>`;
    };
  }

  function summaryCards(){
    if(typeof commercialBillingSummaryV59400!=='function')return;
    const host=q('billingSummaryV58952');if(!host)return;const s=commercialBillingSummaryV59400();
    const payments=document.querySelector('[data-commercial-billing-main="payments"]')?.classList.contains('active')||(typeof commercialBillingStageV59400!=='undefined'&&commercialBillingStageV59400==='payments');
    host.innerHTML=payments?`<article class="billing-money-card-v59673 ready billing-money-card-single-v59673"><div><span>Money paid this month</span><strong>${moneyText(s.received)}</strong><small>Recorded payments</small></div></article>`:`<article class="billing-money-card-v59673 owed billing-money-card-single-v59673"><div><span>Money owed</span><strong>${moneyText(s.outstanding)}</strong><small>${s.overdue?`${moneyText(s.overdue)} overdue`:'No overdue invoices'}</small></div><div class="billing-drafts-inline-v59673"><span>Drafts ready</span><strong>${moneyText(s.ready)}</strong><small>${s.drafts?`${moneyText(s.drafts)} total draft value`:'No drafts waiting'}</small></div></article>`;
  }

  function applySingleScroll(){
    const view=q('view-invoices');if(!view)return;view.classList.add('billing-authoritative-v59673');
    summaryCards();
    q('billingInvoiceListV58952')?.removeAttribute('style');
    q('billingInvoiceDetailV58952')?.removeAttribute('style');
  }

  if(typeof renderInvoiceCentre==='function'){
    const baseRenderInvoiceCentreV59673=renderInvoiceCentre;
    renderInvoiceCentre=function renderInvoiceCentreV59673(){
      let changed=false;(state?.invoices||[]).forEach(inv=>{if(enrichDraftInvoice(inv))changed=true;});
      if(changed&&typeof save==='function')save();
      const result=baseRenderInvoiceCentreV59673();applySingleScroll();return result;
    };
  }


  /*
   * Billing draft authority.
   * Monthly fixed-fee clients may enter Billing from booked/scheduled service,
   * not only after the first completion. Per-visit invoices still require
   * completed work. This keeps the six queues honest: future-cycle monthly
   * drafts can sit in Scheduled for later instead of appearing out of nowhere
   * after the first visit.
   */
  function ensureMonthlyDraftV59673(client,month,coverage){
    if(!client||!coverage||(coverage.completed?.length||0)+(coverage.jobs?.length||0)===0)return false;
    let changed=false;
    const lines=monthlyLinesV59383(client,month,coverage),rate=clientMonthlyRateV59376(client);
    if(!lines?.length)return false;
    const cycleDate=monthlyDraftDateV59376(client,month);
    const paymentDate=cycleDate?monthlyPaymentDueDateV59376(client,month,cycleDate):'';
    const missing=typeof missingVisitStateV59383==='function'?missingVisitStateV59383(client,month,coverage):{warning:'',missingDates:[],notBooked:0};
    let invoice=monthlyOpenInvoiceV59383(client,month);
    if(!invoice){
      invoice=buildDraftForClient(client,month,{lines});
      if(!invoice)return false;
      state.invoices.push(invoice);changed=true;
    }else if(invoiceDeliveryStatus(invoice)!=='Sent'&&['Draft','Ready'].includes(String(invoice.status||''))){
      const before=JSON.stringify(invoice.lineItems||[]);
      changed=reconcileMonthlyInvoiceV59376(invoice,client,month,lines)||changed;
      if(before!==JSON.stringify(invoice.lineItems||[]))changed=true;
    }
    const set=(key,value)=>{if(JSON.stringify(invoice[key])!==JSON.stringify(value)){invoice[key]=value;changed=true;}};
    set('billingBatchId',`TB-MONTHLY-${month.replace('-','')}-${client.id}`);
    set('monthlyCycleInvoiceV59376',true);
    set('invoiceCycleModeV58963',clientInvoiceCycleModeV59376(client));
    set('invoiceCycleMode',clientInvoiceCycleModeV59376(client));
    set('workKind','recurring');set('revenueType','Recurring contract');set('billingWorkTypeV59379','repeat_monthly');
    set('invoiceByDate',cycleDate||'');set('issueDate',cycleDate||'');set('dueDate',paymentDate||'');
    set('serviceCoverageV59383',{completedDates:[...(coverage.completedDates||[])],scheduledDates:[...(coverage.scheduledDates||[])]});
    set('billingMissingVisitWarningV59383',missing.warning||'');
    set('billingMissingVisitCountV59383',(missing.missingDates||[]).length+Number(missing.notBooked||0));
    set('billingMissingVisitDatesV59383',[...(missing.missingDates||[])]);
    const hasExtra=lines.some(line=>line.extra===true);
    set('needsOfficeReview',rate<=0||hasExtra);
    set('reviewReason',rate<=0?'Enter the monthly price before sending.':hasExtra?'Price and approve the captured extra before sending.':'');
    const eligible=Boolean(cycleDate&&localDateISO()>=cycleDate),ready=eligible&&rate>0&&!hasExtra;
    if(invoiceDeliveryStatus(invoice)!=='Sent'){
      set('status',ready?'Ready':'Draft');set('sendableStatusV59379',ready?'sendable':'blocked');
      set('billingDueStateV59379',cycleDate?(eligible?'due_now':'not_due'):'needs_cycle');
    }
    const total=invoiceTotal(invoice);if(Number(invoice.total)!==Number(total)){invoice.total=total;changed=true;}
    if(enrichDraftInvoice(invoice))changed=true;
    if(changed)invoice.updatedAt=new Date().toISOString();
    return changed;
  }

  if(typeof ensureDrafts==='function'&&typeof recurringCoverageV59383==='function'){
    ensureDrafts=function ensureDraftsV59673(month){
      if(!/^\d{4}-\d{2}$/.test(String(month||''))||state.closures?.[month])return;
      if(typeof ensureBillingProfileStateV59396==='function')ensureBillingProfileStateV59396();
      let changed=false;
      changed=(typeof ensureOnceOffCompletionInvoicesV59380==='function'?ensureOnceOffCompletionInvoicesV59380(month):false)||changed;
      const clientIds=new Set((state.visits||[]).filter(visit=>isMonth(visit.date,month)&&completedVisitV59376(visit)).map(visit=>visit.clientId).filter(Boolean));
      if(String(month)>=String(currentMonth())){
        (state.schedules||[]).filter(job=>isMonth(job.date,month)&&job.clientId&&!['cancelled','rescheduled'].includes(String(job.status||'').toLowerCase())).forEach(job=>clientIds.add(job.clientId));
      }
      clientIds.forEach(clientId=>{
        const client=clientById(clientId);if(!client)return;
        const all=recurringCoverageV59383(client,month),monthly=effectiveBillingModeV59383(client)==='monthly';
        if(!all.completed.length&&(!monthly||String(month)<String(currentMonth())||!all.jobs.length))return;
        if(typeof removeObsoleteZeroShellsV59383==='function')changed=removeObsoleteZeroShellsV59383(client,month)||changed;
        const profileIds=new Set();
        (all.completed||[]).forEach(visit=>profileIds.add(billingProfileIdForSourceV59396(visit,client.id)));
        (all.jobs||[]).forEach(job=>profileIds.add(billingProfileIdForSourceV59396(job,client.id)));
        if(!profileIds.size)profileIds.add(client.billingProfileIdV59396||defaultBillingProfileV59396()?.id||'');
        profileIds.forEach(profileId=>{
          if(!profileId)return;
          const coverage=typeof profileCoverageV59396==='function'?profileCoverageV59396(client,month,profileId):all;
          if(monthly){
            if(!coverage.completed.length&&String(month)<String(currentMonth()))return;
            if(!coverage.completed.length&&!coverage.jobs.length)return;
          }else if(!coverage.completed.length)return;
          billingDraftProfileContextV59396=profileId;
          const effectiveClient=String(profileId)===String(client.billingProfileIdV59396)?client:{...client,status:'paused',billingProfileIdV59396:profileId};
          changed=(monthly?ensureMonthlyDraftV59673(effectiveClient,month,coverage):ensurePerVisitInvoicesV59383(effectiveClient,month,coverage))||changed;
          (state.invoices||[]).filter(invoice=>invoice.clientId===client.id&&invoice.month===month&&(!invoice.billingProfileIdV59396||String(invoice.billingProfileIdV59396)===String(profileId))).forEach(invoice=>{
            if(!invoice.billingProfileIdV59396){invoice.billingProfileIdV59396=profileId;changed=true;}
            if(!Number.isFinite(Number(invoice.vatRate))){invoice.vatRate=billingProfileByIdV59396(profileId)?.vatRegistered?Number(state.business?.vatRate??15):0;changed=true;}
            if(enrichDraftInvoice(invoice))changed=true;
          });
        });
      });
      billingDraftProfileContextV59396='';
      if(changed&&typeof save==='function')save();
    };
  }


  /* Delivery authority: prepare, link and confirmation all go through the same
     canonical service, including audited Management sessions. */
  if(typeof commercialPrepareAttemptV59400==='function'){
    commercialPrepareAttemptV59400=async function commercialPrepareAttemptV59673(documentId,channel,recipient,recipientName,subject,message,requestKey){
      return commercialInvokeEdgeV59400({action:'prepare-delivery',documentId,channel,recipient,recipientName:recipientName||'',subject:subject||'',message:message||'',requestKey});
    };
  }
  const publicAppBaseV59673=()=>`${location.origin}${location.pathname.includes('/app/')?'/app':''}`.replace(/\/$/,'');
  const whatsappNumberV59673=value=>{let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(digits.startsWith('0')&&digits.length>=9)digits=`27${digits.slice(1)}`;return digits;};

  window.openCommercialSendV59400=function openCommercialSendV59673(type,id){
    if(typeof requireOutboundAllowedV5960==='function'&&!requireOutboundAllowedV5960('communication'))return;
    const row=commercialRowForTypeV59400(type,id);if(!row)return;
    const client=clientById(row.clientId)||{},email=String(client.email||'').trim(),phone=whatsappNumberV59673(client.whatsapp||client.phone||''),initialChannel=email?'email':'whatsapp';
    const typeLabel=commercialTypeLabelV59400(type);
    showDialogV56('commercialSendDialogV59400',`${row.number&&row.number!=='Draft'?row.number:typeLabel} · Send`, `<form id="commercialSendFormV59400" class="commercial-send-form-v59400 commercial-send-form-v59673">
      <div class="quick-invoice-mode-v59391"><button type="button" class="${initialChannel==='email'?'active':''}" data-channel="email">Email PDF</button><button type="button" class="${initialChannel==='whatsapp'?'active':''}" data-channel="whatsapp">WhatsApp</button></div>
      <div class="email-attachment-note-v5609 canonical-delivery-note-v59673"><span>PDF</span><div><strong>One issued ${escHtml(typeLabel.toLowerCase())}</strong><small data-delivery-explain>Email attaches the exact stored PDF and includes a secure link.</small></div></div>
      <label id="commercialRecipientLabelV59400">Email recipient<input id="commercialRecipientV59400" value="${escHtml(initialChannel==='email'?email:phone)}"></label>
      <label data-subject-wrap>Subject<input id="commercialSubjectV59400" value="${escHtml(commercialDefaultSubjectV59400(type,row))}"></label>
      <label>Message<textarea id="commercialMessageV59400" rows="6">${escHtml(commercialDefaultMessageV59400(type,row))}</textarea></label>
      <div id="commercialSendStatusV59400" class="quote-editor-status-v58934"></div><div id="commercialWhatsappConfirmV59400" class="hidden"></div>
      <div class="dialog-actions"><button type="button" class="button secondary" data-cancel>Cancel</button><button type="button" class="button secondary" data-preview>Preview PDF</button><button type="submit" class="button">${initialChannel==='email'?'Send email + PDF':'Open WhatsApp'}</button></div>
    </form>`,dialog=>{
      let channel=initialChannel,attempt=null,whatsappPopup=null;
      const form=dialog.querySelector('form'),recipient=dialog.querySelector('#commercialRecipientV59400'),subject=dialog.querySelector('#commercialSubjectV59400'),message=dialog.querySelector('#commercialMessageV59400'),status=dialog.querySelector('#commercialSendStatusV59400'),submit=form.querySelector('button[type="submit"]'),explain=dialog.querySelector('[data-delivery-explain]');
      const setStatus=(value,error=false)=>{status.textContent=value||'';status.className=`quote-editor-status-v58934${error?' error':''}`;};
      const setChannel=next=>{channel=next;dialog.querySelectorAll('[data-channel]').forEach(button=>button.classList.toggle('active',button.dataset.channel===next));recipient.value=next==='email'?email:phone;dialog.querySelector('#commercialRecipientLabelV59400').firstChild.textContent=next==='email'?'Email recipient':'WhatsApp number';dialog.querySelector('[data-subject-wrap]').classList.toggle('hidden',next==='whatsapp');submit.textContent=next==='email'?'Send email + PDF':'Open WhatsApp';explain.textContent=next==='email'?'Email attaches the exact stored PDF and includes a secure link.':'WhatsApp opens a secure link to the exact same stored PDF; TuinBooks does not pretend the message is sent until you confirm it.';};
      dialog.querySelectorAll('[data-channel]').forEach(button=>button.onclick=()=>setChannel(button.dataset.channel));
      dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-preview]').onclick=()=>commercialPreviewV59400(type,row);
      form.onsubmit=async event=>{
        event.preventDefault();if(!backendIsAdminV30())return setStatus('Billing permission is required.',true);
        try{
          submit.disabled=true;const target=recipient.value.trim(),targetPhone=whatsappNumberV59673(target);
          if(channel==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target))throw new Error('Enter a valid email recipient.');
          if(channel==='whatsapp'&&!targetPhone)throw new Error('Enter a WhatsApp number.');
          if(channel==='whatsapp'){
            whatsappPopup=window.open('about:blank','_blank');if(!whatsappPopup)throw new Error('WhatsApp was blocked. Allow pop-ups for TuinBooks and try again.');
            try{whatsappPopup.document.title='Preparing WhatsApp…';whatsappPopup.document.body.innerHTML='<p style="font:16px system-ui;padding:24px">Preparing the secure PDF link…</p>';}catch(_){ }
          }
          let responseUrl='';
          if(type==='quote'){
            setStatus('Confirming the quote online…');await ensureCommercialQuoteOnlineV5954(row);const acceptance=await commercialAcceptanceV59400(row,channel,channel==='email'?target:targetPhone);responseUrl=acceptance.url;
          }
          setStatus('Issuing the canonical document…');
          const issued=await commercialIssueV59400(type,row,{acceptanceUrl:responseUrl,forceNew:false});row.number=issued.document_number||row.number;
          setStatus(channel==='email'?'Preparing PDF email…':'Preparing secure WhatsApp link…');
          const requestKey=crypto.randomUUID();attempt=await commercialPrepareAttemptV59400(issued.document_id,channel,channel==='email'?target:targetPhone,client.contact||client.name,subject.value.trim(),message.value.trim(),requestKey);
          if(channel==='email'){
            const data=await commercialInvokeEdgeV59400({action:'send-commercial-document',attemptId:attempt.id,publicBaseUrl:publicAppBaseV59673(),responseUrl});
            row.status=type==='quote'?'Waiting for approval':'Issued';row.sentAt=row.sentAt||new Date().toISOString();row.emailDeliveryStatus='Submitted to email provider';row.lastEmailSentAt=new Date().toISOString();row.history=Array.isArray(row.history)?row.history:[];row.history.push({date:new Date().toISOString(),action:`${typeLabel} submitted with PDF`,note:`To ${target}`});save();
            setStatus(`PDF email submitted to ${data.recipient||target}. Delivery confirmation is pending.`);toast('Email submitted with the canonical PDF.');setTimeout(()=>dialog.close(),850);
          }else{
            let publicUrl=responseUrl;
            if(type!=='quote'){
              const link=await commercialInvokeEdgeV59400({action:'create-document-link',documentId:issued.document_id,publicBaseUrl:publicAppBaseV59673(),expiresAt:new Date(Date.now()+30*86400000).toISOString()});publicUrl=link.publicUrl;
            }
            if(!publicUrl)throw new Error('The secure document link could not be created.');
            const profile=commercialProfileV59400(row),name=profile?.tradingName||profile?.displayName||state.business.name;
            const shortMessage=`Hi ${client.contact||client.name||'there'},\n\n${name} has prepared ${commercialTypeLowerV59400(type)} ${row.number} for ${moneyText(commercialDocumentTotalV59400(type,row))}.\n\nView or download the PDF here:\n${publicUrl}`;
            const url=(typeof isLikelyMobileDevice==='function'&&isLikelyMobileDevice())?`https://wa.me/${encodeURIComponent(targetPhone)}?text=${encodeURIComponent(shortMessage)}`:`https://web.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(shortMessage)}`;
            const popup=whatsappPopup||window.open('about:blank','_blank');if(!popup)throw new Error('WhatsApp was blocked. Allow pop-ups for TuinBooks and try again.');try{popup.location.href=url;}catch(_){window.open(url,'_blank');try{popup.close();}catch(__){ }}
            row.lastWhatsAppOpenedAt=new Date().toISOString();row.whatsappDeliveryStatusV59400='Prepared — not confirmed sent';row.whatsappAttemptIdV59400=attempt.id;row.history=Array.isArray(row.history)?row.history:[];row.history.push({date:new Date().toISOString(),action:'WhatsApp secure PDF link prepared',note:`To ${targetPhone}`});save();
            const confirm=dialog.querySelector('#commercialWhatsappConfirmV59400');confirm.classList.remove('hidden');confirm.innerHTML=`<div class="send-confirm-panel"><div><strong>WhatsApp opened.</strong><span>Press Send in WhatsApp, then confirm here. The secure link opens the same issued PDF as Preview and Email.</span></div><button type="button" class="button" data-confirm-whatsapp>Confirm sent</button></div>`;
            confirm.querySelector('[data-confirm-whatsapp]').onclick=async()=>{try{await commercialInvokeEdgeV59400({action:'confirm-whatsapp-sent',attemptId:attempt.id});row.whatsappDeliveryStatusV59400='Confirmed sent';row.history.push({date:new Date().toISOString(),action:'Organiser confirmed WhatsApp sent',note:`To ${targetPhone}`});save();setStatus('WhatsApp confirmed sent.');setTimeout(()=>dialog.close(),550);}catch(error){setStatus(String(error?.message||error),true);}};
            setStatus('WhatsApp prepared. Confirm after you press Send in WhatsApp.');
          }
          await commercialPersistV59400({operational:true});await refreshCommercialRemoteV59400(true);if(type==='quote')renderQuotes();else renderInvoiceCentre();
        }catch(error){if(whatsappPopup){try{whatsappPopup.close();}catch(_){ }}setStatus(String(error?.message||error),true);toast(String(error?.message||error),'error');}
        finally{submit.disabled=false;}
      };
      setChannel(initialChannel);
    });
  };

  /* Canonical service only. A legacy PDF fallback can create a different legal document. */
  if(typeof commercialInvokeEdgeV59400==='function'){
    commercialInvokeEdgeV59400=async function commercialInvokeEdgeV59673(payload){
      if(backendV28?.mode!=='supabase'||!backendV28?.client)throw new Error('Sign in to TuinBooks before preparing or sending a document.');
      const body={...payload,...(typeof outboundEdgeContextV5960==='function'?outboundEdgeContextV5960():{businessId:backendV28.businessId||''})};
      const {data,error}=await backendV28.client.functions.invoke('commercial-document-delivery-v59400',{body});
      if(error){let message=error.message||'The canonical document service could not be reached.';try{const detail=await error.context?.clone?.().json?.()||await error.context?.json?.();message=detail?.error||detail?.message||message;}catch(_){ }throw new Error(`${message} No legacy PDF was substituted.`);}
      if(data?.error)throw new Error(`${data.error} No legacy PDF was substituted.`);
      return data||{};
    };
  }

  /* Public document pages must also use the same canonical service. */
  window.__tuinbooksBillingCommercialBuildV59673={build:BUILD,serviceEventsForInvoice,meaningfulMoment};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applySingleScroll();if(typeof activeView!=='undefined'&&activeView==='invoices'&&typeof renderInvoiceCentre==='function')renderInvoiceCentre();},{once:true});else{applySingleScroll();}
})();
