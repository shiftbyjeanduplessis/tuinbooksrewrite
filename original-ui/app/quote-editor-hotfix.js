/* TuinBooks v58.9.36 — quote editor emergency hotfix
   Loaded after app.js so it can take control of only the quote editor.
*/
(function installQuoteEditorHotfixV58936(){
  'use strict';

  const VERSION='58.9.36-quote-editor-hotfix';
  let sending=false;
  let installed=false;

  const byId=id=>document.getElementById(id);
  const parseNumber=value=>{
    const cleaned=String(value??'').trim().replace(/\s+/g,'').replace(',','.');
    if(cleaned==='')return 0;
    const parsed=Number(cleaned);
    return Number.isFinite(parsed)?parsed:0;
  };
  const escapeAttribute=value=>String(value??'')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function showStatus(message='',kind=''){
    const host=byId('quoteEditorStatusV58934');
    if(!host)return;
    host.textContent=message;
    host.className=`quote-editor-status-v58934${kind?` ${kind}`:''}`;
  }

  function quoteLines(){
    return Array.isArray(quoteDraftLines)?quoteDraftLines:[];
  }

  function total(){
    return quoteLines().reduce((sum,line)=>sum+lineTotal(line),0);
  }

  function refreshTotals(row=null,index=null){
    if(row&&Number.isInteger(index)){
      const lineAmount=row.querySelector('.line-total');
      if(lineAmount)lineAmount.textContent=money(lineTotal(quoteLines()[index]||{}));
    }
    const totalNode=byId('quoteEditorTotal');
    if(totalNode)totalNode.textContent=money(total());
  }

  function bindRow(row,index){
    row.querySelectorAll('[data-q-field]').forEach(input=>{
      input.oninput=()=>{
        const line=quoteLines()[index];
        if(!line)return;
        const field=input.dataset.qField;
        line[field]=field==='description'?input.value:parseNumber(input.value);
        refreshTotals(row,index);
      };
      input.onchange=input.oninput;
    });
    const remove=row.querySelector('[data-q-remove]');
    if(remove)remove.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      quoteDraftLines.splice(index,1);
      if(!quoteDraftLines.length)quoteDraftLines.push({id:uid('ql'),description:'',qty:1,unitPrice:0});
      renderRows();
    };
  }

  function renderRows(){
    const host=byId('quoteLineEditor');
    if(!host)return;
    if(!quoteLines().length)quoteDraftLines.push({id:uid('ql'),description:'',qty:1,unitPrice:0});
    host.innerHTML=quoteLines().map((line,index)=>`<div class="invoice-line" data-q-row="${index}">
      <input aria-label="Quantity" type="text" inputmode="decimal" autocomplete="off" data-q-field="qty" value="${escapeAttribute(line.qty??1)}">
      <input aria-label="Description" type="text" autocomplete="off" data-q-field="description" value="${escapeAttribute(line.description||'')}">
      <input aria-label="Unit price" type="text" inputmode="decimal" autocomplete="off" data-q-field="unitPrice" value="${escapeAttribute(line.unitPrice??0)}">
      <span class="status-badge neutral">Quote</span>
      <span class="line-total">${money(lineTotal(line))}</span>
      <button type="button" class="remove-line" data-q-remove aria-label="Remove quote line">×</button>
    </div>`).join('');
    host.querySelectorAll('[data-q-row]').forEach((row,index)=>bindRow(row,index));
    refreshTotals();
  }

  function syncRowsFromScreen(){
    const host=byId('quoteLineEditor');
    if(!host)return;
    const rows=[...host.querySelectorAll('[data-q-row]')];
    if(!rows.length)return;
    quoteDraftLines=rows.map((row,index)=>({
      id:quoteLines()[index]?.id||uid('ql'),
      qty:parseNumber(row.querySelector('[data-q-field="qty"]')?.value),
      description:String(row.querySelector('[data-q-field="description"]')?.value||''),
      unitPrice:parseNumber(row.querySelector('[data-q-field="unitPrice"]')?.value)
    }));
    refreshTotals();
  }

  function validate(){
    syncRowsFromScreen();
    if(!byId('quoteClient')?.value)throw new Error('Select a client for this quote.');
    if(!byId('quoteDate')?.value)throw new Error('Choose the quote date.');
    const usable=quoteLines().filter(line=>String(line.description||'').trim()&&Number(line.qty)>0);
    if(!usable.length)throw new Error('Add at least one quote line with a description and quantity.');
    if(usable.some(line=>Number(line.unitPrice)<0))throw new Error('Quote prices cannot be negative.');
    quoteDraftLines=usable;
    return usable;
  }

  function commit(){
    validate();
    return commitQuoteEditorV58934();
  }

  function preview(){
    try{
      validate();
      const temp={number:'QUOTE',month:byId('quoteDate').value.slice(0,7),sentAt:null,lineItems:JSON.parse(JSON.stringify(quoteDraftLines)),notes:byId('quoteNotes').value};
      const client=clientById(byId('quoteClient').value)||{};
      byId('invoicePreviewTitle').textContent=`Quote — ${client.name||'Client'}`;
      byId('invoicePreviewContent').innerHTML=invoicePaperHtml(temp,client);
      byId('invoicePreviewDialog').showModal();
      showStatus('');
    }catch(error){
      showStatus(String(error?.message||error),'error');
    }
  }

  async function saveOnly(){
    try{
      const quote=commit();
      showStatus('Saving quote…');
      if(backendV28.mode==='supabase'&&typeof syncOperationalSnapshotV41==='function'){
        const persisted=await syncOperationalSnapshotV41(true);
        if(!persisted)throw new Error('The quote was saved on this device, but the online save did not complete.');
      }
      showStatus('Quote saved.','success');
      byId('quoteEditorDialog')?.close();
      renderQuotes();
      toast(`${quote.number&&quote.number!=='Draft'?quote.number:'Quote'} saved.`);
    }catch(error){
      showStatus(String(error?.message||error),'error');
      toast(String(error?.message||error),'error');
    }
  }

  async function saveAndSend(){
    if(sending)return;
    const button=byId('quoteSaveSendBtnV58934');
    const dialog=byId('quoteEditorDialog');
    sending=true;
    if(button){button.disabled=true;button.textContent='Saving…';}
    showStatus('Saving the quote…');
    try{
      const quote=commit();
      const client=clientById(quote.clientId)||{};
      const recipient=String(client.email||'').trim();
      if(!recipient)throw new Error('Add an email address to this client before sending the quote.');
      if(quoteTotal(quote)<=0)throw new Error('Enter a unit price so the quote has a value before sending it.');
      if(typeof backendIsAdminV30==='function'&&!backendIsAdminV30())throw new Error('Only an owner or administrator can send quotes.');

      if(backendV28.mode==='supabase'&&typeof syncOperationalSnapshotV41==='function'){
        showStatus('Saving the quote online…');
        const persisted=await syncOperationalSnapshotV41(true);
        if(!persisted)throw new Error('The quote could not be saved online. Nothing was sent.');
      }

      if(button)button.textContent='Numbering…';
      showStatus('Reserving the quote number…');
      if(!await reserveQuoteNumberV5890(quote))throw new Error('The quote number could not be reserved.');

      const resend=Boolean(quote.sentAt||quote.lastEmailSentAt||quote.status==='Waiting for approval'||quote.status==='Sent');
      if(button)button.textContent='Securing…';
      showStatus('Creating the secure acceptance button…');
      const acceptance=await createQuoteAcceptanceForEmailV58934(quote);

      if(button)button.textContent='Sending…';
      showStatus(`Sending ${quoteNumberV5609(quote)} to ${recipient}…`);
      const data=await invokeTuinBooksEmailV5609({
        action:'send-quote',
        documentId:quote.id,
        subject:defaultQuoteEmailSubjectV5609(quote),
        message:defaultQuoteEmailMessageV5609(quote,client,resend),
        acceptanceUrl:acceptance.url,
        sendKind:resend?'resend':'initial',
        requestId:globalThis.crypto?.randomUUID?.()||uid('email')
      });

      quote.acceptanceLinkCreatedAt=new Date().toISOString();
      quote.acceptanceExpiresAt=acceptance.expiresAt;
      const persisted=await persistQuoteEmailResultV5609(quote,data,resend);
      showStatus(`Sent to ${data.recipient||recipient}.`,'success');
      renderQuotes();
      setTimeout(()=>dialog?.close(),350);
      toast(persisted?`${quoteNumberV5609(quote)} ${resend?'resent':'sent'} to ${data.recipient||recipient}.`:'The quote was sent, but its online status still needs saving.',persisted?'':'error');
    }catch(error){
      const message=typeof emailFunctionErrorV5609==='function'?await emailFunctionErrorV5609(error):String(error?.message||error);
      showStatus(message,'error');
      toast(message,'error');
    }finally{
      sending=false;
      if(button){button.disabled=false;button.textContent='Save & send quote';}
    }
  }

  function addLine(){
    syncRowsFromScreen();
    quoteDraftLines.push({id:uid('ql'),description:'',qty:1,unitPrice:0});
    renderRows();
    requestAnimationFrame(()=>{
      const descriptions=byId('quoteLineEditor')?.querySelectorAll('[data-q-field="description"]');
      descriptions?.[descriptions.length-1]?.focus();
    });
  }

  function install(){
    if(installed||document.body?.dataset?.app!=='desktop')return;
    const dialog=byId('quoteEditorDialog');
    const form=byId('quoteEditorForm');
    if(!dialog||!form)return;
    installed=true;

    // Take control in capture phase before older quote listeners can run.
    dialog.addEventListener('click',event=>{
      const target=event.target;
      if(!(target instanceof Element))return;
      const button=target.closest('button');
      if(!button)return;
      if(button.id==='addQuoteLineBtn'){
        event.preventDefault();event.stopImmediatePropagation();addLine();
      }else if(button.id==='previewQuoteBtn'){
        event.preventDefault();event.stopImmediatePropagation();preview();
      }else if(button.id==='quoteSaveSendBtnV58934'){
        event.preventDefault();event.stopImmediatePropagation();void saveAndSend();
      }
    },true);

    form.addEventListener('submit',event=>{
      event.preventDefault();event.stopImmediatePropagation();void saveOnly();
    },true);

    const originalOpen=window.openQuoteEditor;
    if(typeof originalOpen==='function'&&!originalOpen.__v58936){
      const wrapped=function(id=''){
        showStatus('');
        const result=originalOpen(id);
        renderRows();
        return result;
      };
      wrapped.__v58936=true;
      window.openQuoteEditor=wrapped;
    }

    // Re-render any editor that is already open when this hotfix loads.
    if(dialog.open)renderRows();
    window.__tuinbooksQuoteHotfixV58936={VERSION,renderRows,syncRowsFromScreen,total};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
