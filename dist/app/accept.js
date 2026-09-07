(()=>{
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),token=params.get('token')||'';
  let snapshot=null,pdfUrl='',canonicalSnapshot=null;
  const money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(v||0));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateLabel=value=>{const raw=String(value||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw||'As stated on the quote';const [y,m,d]=raw.split('-').map(Number);return new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));};
  function client(){const cfg=window.TUINBOOKS_SUPABASE_CONFIG||{},url=cfg.url||window.TUINBOOKS_SUPABASE_URL||window.SUPABASE_URL,key=cfg.key||window.TUINBOOKS_SUPABASE_ANON_KEY||window.SUPABASE_ANON_KEY;if(!url||!key)throw new Error('Quote service is not configured.');return window.supabase.createClient(url,key,{auth:{persistSession:false}});}
  async function invokeDocument(api){try{return await api.functions.invoke('commercial-document-delivery-v59400',{body:{action:'public-document',acceptanceToken:token}});}catch(_){return {data:null,error:null};}}
  async function load(){
    try{
      if(!token)throw new Error('This quote link is incomplete.');
      const api=client();
      const [{data,error},pdfResult]=await Promise.all([api.rpc('tuinbooks_get_quote_acceptance_v58',{p_token:token}),invokeDocument(api)]);
      if(error)throw error;if(!data?.ok)throw new Error(data?.error==='expired'?'This quote link has expired.':data?.error==='cancelled'?'This quote link was cancelled.':'This quote link is invalid.');
      snapshot=data.snapshot||{};pdfUrl=pdfResult?.data?.pdfUrl||'';canonicalSnapshot=pdfResult?.data?.document?.snapshot||null;render(data);
    }catch(error){$('acceptLoading').classList.add('hidden');$('acceptContent').classList.remove('hidden');$('acceptContent').innerHTML=`<div class="status-banner error">${esc(error.message||error)}</div>`;}
  }
  function quoteSummaryHtml(q,canonicalDoc,total){
    const lines=Array.isArray(q.lineItems)&&q.lineItems.length?q.lineItems:Array.isArray(canonicalDoc.lineItems)?canonicalDoc.lineItems:[];
    const terms=canonicalDoc.paymentTerms||q.paymentTerms||q.terms||'';
    const customerNote=canonicalDoc.customerNote||q.notes||'';
    return `<section class="quote-summary-card">
      ${customerNote?`<div class="quote-proposed"><span>Proposed work</span><p>${esc(customerNote)}</p></div>`:''}
      <div class="quote-summary-lines">
        ${lines.length?lines.map(line=>{const qty=Number(line.qty||1),unit=Number(line.unitPrice||0),lineValue=Number(line.total||qty*unit);return `<div class="quote-summary-line"><div><strong>${esc(line.description||'Work item')}</strong><span>${qty} × ${money(unit)}</span></div><strong>${money(lineValue)}</strong></div>`;}).join(''):'<p class="muted-copy">The work and price are recorded in the attached quote.</p>'}
      </div>
      <div class="quote-summary-total"><span>Quote total</span><strong>${money(total)}</strong></div>
      ${terms?`<div class="quote-terms"><span>Terms</span><p>${esc(terms)}</p></div>`:''}
    </section>`;
  }
  function render(data){
    const s=data.snapshot||{},q=s.quote||{},canonicalDoc=canonicalSnapshot||{},customer=canonicalDoc.customer||s.customer||{},issuer=canonicalDoc.issuer||{},business={...(s.business||{}),name:issuer.tradingName||issuer.displayName||issuer.legalName||s.business?.name||''};
    const lines=Array.isArray(q.lineItems)?q.lineItems:[],total=Number(q.total||q.acceptedTotal||canonicalDoc.totals?.total||lines.reduce((sum,line)=>sum+Number(line.qty||1)*Number(line.unitPrice||0),0));
    const quoteNumber=canonicalDoc.number||q.number||q.id||'Quote',validUntil=canonicalDoc.validUntil||q.validUntilV59400||q.validUntil||q.expiryDate||'';
    $('acceptLoading').classList.add('hidden');$('acceptContent').classList.remove('hidden');
    const pdfAction=pdfUrl?`<a class="pdf-link" href="${esc(pdfUrl)}" target="_blank" rel="noopener"><span>PDF</span><div><strong>Open full quote PDF</strong><small>View or download the issued document</small></div><b>↗</b></a>`:'';
    const summary=quoteSummaryHtml(q,canonicalDoc,total);
    if(['accepted','changes_requested','declined'].includes(data.status)){
      $('acceptContent').innerHTML=`<div class="quote-heading"><span class="fine">${esc(business.name||'Garden service')}</span><h1>${esc(quoteNumber)}</h1><p>Prepared for ${esc(customer.name||'customer')}</p></div><div class="quote-meta"><div><span>Total</span><strong>${money(total)}</strong></div><div><span>Valid until</span><strong>${esc(dateLabel(validUntil))}</strong></div></div>${summary}${pdfAction}<div class="status-banner"><h2>Response recorded</h2><p>Your response is <strong>${esc(data.status.replace('_',' '))}</strong>. No further action is needed on this page.</p></div>`;
      return;
    }
    $('acceptContent').innerHTML=`<div class="quote-heading"><span class="fine">${esc(business.name||'Garden service')}</span><h1>${esc(quoteNumber)}</h1><p>Prepared for ${esc(customer.name||'customer')}</p></div><div class="quote-meta"><div><span>Total</span><strong>${money(total)}</strong></div><div><span>Valid until</span><strong>${esc(dateLabel(validUntil))}</strong></div></div>${summary}${pdfAction}<form id="responseForm" class="accept-form"><div class="response-heading"><h2>Your response</h2><p>Enter your name, add a note if needed, then choose one action.</p></div><label>Your name<input id="responseName" required autocomplete="name"></label><label>Note to ${esc(business.name||'the business')}<textarea id="responseNote" rows="4" placeholder="Optional"></textarea></label><div class="response-actions"><button type="submit" data-decision="accepted" class="accept-action">Accept quote</button><button type="submit" data-decision="changes_requested" class="change-action">Request changes</button><button type="submit" data-decision="declined" class="decline-action">Decline</button></div><p class="fine response-fine">Your response records this quote version, your name and the time submitted.</p></form>`;
    $('responseForm').onsubmit=submit;
  }
  async function submit(event){
    event.preventDefault();
    const decision=event.submitter?.dataset?.decision||'accepted',buttons=[...document.querySelectorAll('.response-actions button')],button=event.submitter;
    buttons.forEach(item=>item.disabled=true);if(button)button.textContent='Saving…';
    try{
      const {data,error}=await client().rpc('tuinbooks_respond_quote_acceptance_v58',{p_token:token,p_decision:decision,p_customer_name:$('responseName').value.trim(),p_note:$('responseNote').value.trim()});
      if(error)throw error;if(!data?.ok)throw new Error('The response could not be saved.');
      $('acceptContent').innerHTML=`<div class="status-banner response-complete"><h2>${decision==='accepted'?'Quote accepted':decision==='changes_requested'?'Changes requested':'Quote declined'}</h2><p>${decision==='accepted'?'Thank you. The business will contact you about the next step.':'Your response has been sent to the business.'}</p></div>`;
    }catch(error){buttons.forEach(item=>item.disabled=false);if(button)button.textContent=decision==='accepted'?'Accept quote':decision==='changes_requested'?'Request changes':'Decline';alert(error.message||error);}
  }
  load();
})();
