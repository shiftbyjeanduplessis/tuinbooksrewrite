/* TuinBooks v58.9.57 — controlled fictitious test dataset
   Loads only when the URL includes ?testdata=1. Existing business data is preserved.
*/
(function(){
  'use strict';
  const BUILD='58.9.58-fictitious-test-data';
  const PREFIX='test58958-';
  const PANEL_ID='testDataPanelV58958';

  const q=new URLSearchParams(location.search);
  if(q.get('testdata')!=='1')return;

  const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const isoNow=()=>new Date().toISOString();
  const dateTime=(iso,hour,minute=0)=>`${iso}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
  const startMonday=iso=>{const d=new Date(`${iso}T12:00:00`);let day=d.getDay();if(day===0)day=7;d.setDate(d.getDate()-(day-1));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const moneyLine=(id,description,qty,unitPrice,extra=false)=>({id,description,qty,unitPrice,extra,approved:true});
  const arr=value=>Array.isArray(value)?value:[];
  const merge=(list,rows)=>{const map=new Map(arr(list).map(row=>[row.id,row]));rows.forEach(row=>{if(map.has(row.id))Object.assign(map.get(row.id),row);else list.push(row);});};
  const removePrefixed=list=>arr(list).filter(row=>!String(row?.id||'').startsWith(PREFIX));

  function ready(){return window.state&&typeof window.save==='function'&&typeof window.localDateISO==='function';}
  function renderCurrent(){
    try{
      const view=window.activeView;
      if(view==='schedule'&&typeof window.renderSchedule==='function')window.renderSchedule();
      else if(view==='clients'&&typeof window.renderClients==='function')window.renderClients();
      else if(view==='quotes'&&typeof window.renderQuotes==='function')window.renderQuotes();
      else if(view==='invoices'&&typeof window.renderInvoiceCentre==='function')window.renderInvoiceCentre();
      else if(view==='records'&&typeof window.renderRecords==='function')window.renderRecords();
    }catch(error){console.warn('Test dataset refresh',error);}
  }

  function populate(){
    if(!ready())return alert('TuinBooks is still loading. Wait a few seconds and try again.');
    if(!confirm('Populate this business with clearly labelled fictitious TEST records? Existing records will not be deleted.'))return;

    const s=window.state;
    const today=window.localDateISO();
    const yesterday=addDays(today,-1), tomorrow=addDays(today,1), nextDay=addDays(today,2), weekStart=startMonday(today), month=today.slice(0,7), now=isoNow();
    s.teams=arr(s.teams);s.clusters=arr(s.clusters);s.clients=arr(s.clients);s.schedules=arr(s.schedules);s.visits=arr(s.visits);s.quotes=arr(s.quotes);s.invoices=arr(s.invoices);s.opportunities=arr(s.opportunities);s.scheduleBasket=arr(s.scheduleBasket);s.stockOrdersV58940=arr(s.stockOrdersV58940);s.clientReports=arr(s.clientReports);
    s.adminLifecycleV56=s.adminLifecycleV56||{};s.adminLifecycleV56.payments=arr(s.adminLifecycleV56.payments);s.adminLifecycleV56.statements=arr(s.adminLifecycleV56.statements);

    let primaryTeam=s.teams.find(team=>team.active!==false)?.id;
    let secondTeam=s.teams.filter(team=>team.active!==false)[1]?.id;
    const newTeams=[];
    if(!primaryTeam){primaryTeam=`${PREFIX}team-mobile`;newTeams.push({id:primaryTeam,name:'Test Mobile Team',leaderName:'Daniel',capacityHours:8,bufferHours:.5,active:true,color:'#2f7d5c'});}
    if(!secondTeam){secondTeam=`${PREFIX}team-second`;newTeams.push({id:secondTeam,name:'Test Second Team',leaderName:'Office Test',capacityHours:8,bufferHours:.5,active:true,color:'#6d7c75'});}
    merge(s.teams,newTeams);

    let clusterA=s.clusters.find(row=>row.active!==false)?.id;
    let clusterB=s.clusters.filter(row=>row.active!==false)[1]?.id;
    const newClusters=[];
    if(!clusterA){clusterA=`${PREFIX}cluster-central`;newClusters.push({id:clusterA,name:'Test Central',color:'#5a8f72',suburbs:['Test Central','Test Park'],active:true});}
    if(!clusterB){clusterB=`${PREFIX}cluster-coast`;newClusters.push({id:clusterB,name:'Test Coast',color:'#7b9f92',suburbs:['Test Coast','Test Bay'],active:true});}
    merge(s.clusters,newClusters);

    const clientBase={customerType:'Private homeowner',billingArrangement:'Monthly fixed fee',status:'active',serviceState:'active',fixedDay:false,preferredTeamId:'',teamId:'',schedulingPolicyV58951:'cluster-capacity',serviceStartIsEarliestV58951:true,incomplete:false,marketingAllowed:false};
    const clients=[
      {...clientBase,id:`${PREFIX}client-weekly`,siteId:`site-${PREFIX}client-weekly`,name:'TEST — Smith Residence',contact:'Alex Smith',address:'10 Test Avenue',suburb:'Test Central',whatsapp:'+27820000001',email:'test.smith@example.com',clusterId:clusterA,frequency:'Weekly',serviceStartDate:weekStart,recurrenceAnchorDate:weekStart,estimatedHours:1,monthlyFee:1450,workTypeIds:['Cut grass','Edging','General tidy'],serviceDescription:'Weekly lawn and general garden service.',accessNotes:'Side gate unlocked. Small dog in back garden.',gardenNotes:'Test mobile completion test.',createdAt:now},
      {...clientBase,id:`${PREFIX}client-fortnightly`,siteId:`site-${PREFIX}client-fortnightly`,name:'TEST — Jacobs Residence',contact:'M Jacobs',address:'22 Sample Street',suburb:'Test Central',whatsapp:'+27820000002',email:'test.jacobs@example.com',clusterId:clusterA,frequency:'Fortnightly',serviceStartDate:addDays(today,-7),recurrenceAnchorDate:addDays(today,-7),estimatedHours:1.5,monthlyFee:980,workTypeIds:['Cut grass','Weeding','Trim hedge'],serviceDescription:'Fortnightly garden maintenance.',accessNotes:'Call at gate if closed.',gardenNotes:'Use for notes and opportunity test.',createdAt:now},
      {...clientBase,id:`${PREFIX}client-monthly`,siteId:`site-${PREFIX}client-monthly`,name:'TEST — Ocean View Complex',customerType:'Business / complex',contact:'Site Manager',address:'5 Demo Close',suburb:'Test Coast',whatsapp:'+27820000003',email:'test.ocean@example.com',clusterId:clusterB,frequency:'Monthly',serviceStartDate:addDays(today,-14),recurrenceAnchorDate:addDays(today,-14),estimatedHours:2.5,monthlyFee:2600,workTypeIds:['General tidy','Trim hedge','Remove refuse'],serviceDescription:'Monthly common-area service.',accessNotes:'Reception opens at 08:00.',gardenNotes:'Confirms starting date is earliest date, not a fixed weekday.',createdAt:now},
      {...clientBase,id:`${PREFIX}client-paused`,siteId:`site-${PREFIX}client-paused`,name:'TEST — Paused Client',contact:'Paused Test',address:'7 Pause Lane',suburb:'Test Coast',whatsapp:'+27820000004',email:'test.paused@example.com',clusterId:clusterB,frequency:'Weekly',serviceStartDate:today,recurrenceAnchorDate:today,estimatedHours:1,monthlyFee:900,status:'paused',serviceState:'paused',workTypeIds:['General tidy'],createdAt:now},
      {...clientBase,id:`${PREFIX}client-setup`,siteId:`site-${PREFIX}client-setup`,name:'TEST — Activation Test Client',contact:'Activation Test',address:'8 Setup Road',suburb:'Test Central',whatsapp:'+27820000005',email:'test.activation@example.com',clusterId:clusterA,frequency:'Monthly',serviceStartDate:addDays(today,7),recurrenceAnchorDate:addDays(today,7),estimatedHours:1.25,monthlyFee:1100,status:'setup',serviceState:'setup',workTypeIds:['Cut grass','General tidy'],createdAt:now},
      {id:`${PREFIX}contact-service`,siteId:`site-${PREFIX}contact-service`,recordKindV58951:'quote-contact',status:'archived',serviceState:'quote-only',name:'TEST — Green Projects Contact',companyNameV58951:'TEST — Green Projects Contact',contact:'Sam Green',whatsapp:'+27820000006',email:'test.green@example.com',address:'44 Quote Road',suburb:'Test Central',clusterId:clusterA,frequency:'Ad hoc',monthlyFee:0,estimatedHours:1,fixedDay:false,preferredTeamId:'',teamId:'',workTypeIds:[],serviceIds:[],incomplete:false,createdAt:now},
      {id:`${PREFIX}contact-stock`,siteId:`site-${PREFIX}contact-stock`,recordKindV58951:'once-off-customer',status:'archived',serviceState:'once-off',name:'TEST — Plant Buyer',companyNameV58951:'TEST — Plant Buyer',contact:'N Buyer',whatsapp:'+27820000007',email:'test.stock@example.com',address:'',suburb:'Test Coast',clusterId:clusterB,frequency:'Ad hoc',monthlyFee:0,estimatedHours:1,fixedDay:false,preferredTeamId:'',teamId:'',workTypeIds:[],serviceIds:[],incomplete:false,createdAt:now}
    ];
    merge(s.clients,clients);

    const schedules=[
      {id:`${PREFIX}job-mobile-1`,date:today,clientId:`${PREFIX}client-weekly`,teamId:primaryTeam,clusterId:clusterA,status:'scheduled',estimatedHours:1,sort:10,revenueType:'Recurring contract',workTypeIds:['Cut grass','Edging','General tidy'],createdAt:now,fictitiousTestV58958:true},
      {id:`${PREFIX}job-mobile-2`,date:today,clientId:`${PREFIX}client-fortnightly`,teamId:primaryTeam,clusterId:clusterA,status:'scheduled',estimatedHours:1.5,sort:20,revenueType:'Recurring contract',workTypeIds:['Cut grass','Weeding','Trim hedge'],createdAt:now,fictitiousTestV58958:true},
      {id:`${PREFIX}job-mobile-3`,date:today,clientId:`${PREFIX}client-monthly`,teamId:primaryTeam,clusterId:clusterB,status:'scheduled',estimatedHours:2.5,sort:30,revenueType:'Recurring contract',workTypeIds:['General tidy','Trim hedge','Remove refuse'],createdAt:now,fictitiousTestV58958:true},
      {id:`${PREFIX}job-tomorrow-1`,date:tomorrow,clientId:`${PREFIX}client-weekly`,teamId:secondTeam,clusterId:clusterA,status:'scheduled',estimatedHours:1,sort:10,revenueType:'Recurring contract',workTypeIds:['Cut grass','Edging'],createdAt:now,fictitiousTestV58958:true},
      {id:`${PREFIX}job-tomorrow-2`,date:tomorrow,clientId:`${PREFIX}client-monthly`,teamId:secondTeam,clusterId:clusterB,status:'scheduled',estimatedHours:2.5,sort:20,revenueType:'Recurring contract',workTypeIds:['General tidy'],createdAt:now,fictitiousTestV58958:true},
      {id:`${PREFIX}job-completed-history`,date:yesterday,clientId:`${PREFIX}client-weekly`,teamId:primaryTeam,clusterId:clusterA,status:'completed',estimatedHours:1,sort:10,revenueType:'Recurring contract',workTypeIds:['Cut grass','Edging'],completedAt:dateTime(yesterday,15,10),createdAt:dateTime(yesterday,8,0),fictitiousTestV58958:true},
      {id:`${PREFIX}job-issue-history`,date:yesterday,clientId:`${PREFIX}client-fortnightly`,teamId:primaryTeam,clusterId:clusterA,status:'missed',estimatedHours:1.5,sort:20,revenueType:'Recurring contract',workTypeIds:['General tidy'],createdAt:dateTime(yesterday,8,15),fictitiousTestV58958:true},
      {id:`${PREFIX}job-accepted-postpaid`,date:'',clientId:`${PREFIX}contact-service`,teamId:'',clusterId:clusterA,status:'unscheduled',estimatedHours:2,sort:99,revenueType:'Accepted quote',workKind:'once-off',workMarker:'O',quoteId:`${PREFIX}quote-converted`,workTypeIds:[],createdAt:dateTime(today,7,30),fictitiousTestV58958:true}
    ];
    merge(s.schedules,schedules);

    const visits=[
      {id:`${PREFIX}visit-completed`,scheduledJobId:`${PREFIX}job-completed-history`,clientId:`${PREFIX}client-weekly`,teamId:primaryTeam,date:yesterday,outcome:'Completed',processed:true,resolutionStatusV56:'processed',workDone:['Cut grass','Edging','General tidy'],extraDescription:'',photos:[{name:'test-before.jpg'},{name:'test-after.jpg'}],photoPaths:[],completedAt:dateTime(yesterday,15,10),createdAt:dateTime(yesterday,15,10),clientReportActivityV58950:{at:dateTime(yesterday,15,15),label:'WhatsApp report opened'},fictitiousTestV58958:true},
      {id:`${PREFIX}visit-issue`,scheduledJobId:`${PREFIX}job-issue-history`,clientId:`${PREFIX}client-fortnightly`,teamId:primaryTeam,date:yesterday,outcome:'Access failed',processed:false,resolutionStatusV56:'needs-resolution',outcomeNote:'Gate locked and client did not answer.',workDone:[],photos:[],completedAt:dateTime(yesterday,11,20),createdAt:dateTime(yesterday,11,20),fictitiousTestV58958:true}
    ];
    merge(s.visits,visits);

    const opportunities=[
      {id:`${PREFIX}opportunity-new`,clientId:`${PREFIX}client-weekly`,scheduleId:`${PREFIX}job-completed-history`,visitId:`${PREFIX}visit-completed`,teamId:primaryTeam,date:yesterday,category:'Irrigation',note:'Possible leaking irrigation valve near the back lawn.',status:'new',reviewDecision:'new',photos:[{name:'test-opportunity.jpg'}],createdAt:dateTime(yesterday,15,12),fictitiousTestV58958:true}
    ];
    merge(s.opportunities,opportunities);

    const quotes=[
      {id:`${PREFIX}quote-draft`,number:'Draft',clientId:`${PREFIX}client-weekly`,date:today,status:'Draft',quoteTypeV58940:'service',paymentTermsV58940:'after-completion',billingRouteV5895:'after-completion',workTimingV58943:'next-visit',lineItems:[moneyLine(`${PREFIX}ql-draft`,'Seasonal fertiliser application',1,450)],notes:'Test draft quote.',createdAt:now,updatedAt:now,fictitiousTestV58958:true},
      {id:`${PREFIX}quote-sent`,number:'TEST-QUO-001',clientId:`${PREFIX}contact-service`,date:today,status:'Sent',quoteTypeV58940:'service',paymentTermsV58940:'after-completion',billingRouteV5895:'after-completion',workTimingV58943:'schedule-separately',lineItems:[moneyLine(`${PREFIX}ql-sent`,'Tree trimming and refuse removal',1,1800)],notes:'Test quote awaiting client response.',sentAt:dateTime(today,8,5),expiresAt:addDays(today,7),createdAt:dateTime(today,8,0),updatedAt:dateTime(today,8,5),history:[{date:dateTime(today,8,5),action:'Sent via email',note:'test.green@example.com'}],fictitiousTestV58958:true},
      {id:`${PREFIX}quote-deposit-sent`,number:'TEST-QUO-002',clientId:`${PREFIX}client-monthly`,date:today,status:'Sent',quoteTypeV58940:'service-materials',paymentTermsV58940:'part-payment',billingRouteV5895:'part-payment',depositModeV58940:'percent',depositValueV58940:50,workTimingV58943:'schedule-separately',lineItems:[moneyLine(`${PREFIX}ql-deposit`,'New planting bed with plants and compost',1,5200)],notes:'Test deposit quote awaiting response.',sentAt:dateTime(today,8,10),expiresAt:addDays(today,7),createdAt:dateTime(today,8,0),updatedAt:dateTime(today,8,10),history:[{date:dateTime(today,8,10),action:'Sent via email',note:'test.ocean@example.com'}],fictitiousTestV58958:true},
      {id:`${PREFIX}quote-awaiting-payment`,number:'TEST-QUO-003',clientId:`${PREFIX}contact-service`,date:yesterday,status:'Accepted',quoteTypeV58940:'service',paymentTermsV58940:'full-prepayment',billingRouteV5895:'full-prepayment',workTimingV58943:'schedule-separately',lineItems:[moneyLine(`${PREFIX}ql-await`,'Once-off garden clean-up',1,2400)],notes:'Full payment required before scheduling.',acceptedAt:dateTime(today,7,45),acceptedByName:'Test Customer',expiresAt:addDays(today,7),paymentRequestV5895:{status:'Awaiting payment',amountDue:2400,amountPaid:0,balance:2400,createdAt:dateTime(today,7,45)},createdAt:dateTime(yesterday,10,0),updatedAt:dateTime(today,7,45),fictitiousTestV58958:true},
      {id:`${PREFIX}quote-converted`,number:'TEST-QUO-004',clientId:`${PREFIX}contact-service`,date:yesterday,status:'Converted',quoteTypeV58940:'service',paymentTermsV58940:'after-completion',billingRouteV5895:'after-completion',workTimingV58943:'schedule-separately',lineItems:[moneyLine(`${PREFIX}ql-converted`,'Hedge reduction and clean-up',1,1600)],notes:'Converted post-payment quote.',acceptedAt:dateTime(today,7,25),acceptedByName:'Test Customer',convertedAtV58940:dateTime(today,7,26),archivedAtV58940:dateTime(today,7,26),convertedToV58940:'job',convertedRecordIdV58940:`${PREFIX}job-accepted-postpaid`,workflowStateV58940:'converted',createdAt:dateTime(yesterday,9,0),updatedAt:dateTime(today,7,26),fictitiousTestV58958:true},
      {id:`${PREFIX}quote-rejected`,number:'TEST-QUO-005',clientId:`${PREFIX}client-fortnightly`,date:addDays(today,-5),status:'Rejected',quoteTypeV58940:'service',paymentTermsV58940:'after-completion',billingRouteV5895:'after-completion',workTimingV58943:'next-visit',lineItems:[moneyLine(`${PREFIX}ql-rejected`,'Replace damaged lawn section',1,950)],notes:'Test rejected quote.',sentAt:addDays(today,-5)+'T09:00:00',rejectedAt:addDays(today,-2)+'T12:00:00',archivedAtV58940:addDays(today,-2)+'T12:00:00',createdAt:addDays(today,-5)+'T08:30:00',updatedAt:addDays(today,-2)+'T12:00:00',history:[{date:addDays(today,-2)+'T12:00:00',action:'Quote marked rejected and archived'}],fictitiousTestV58958:true},
      {id:`${PREFIX}quote-stock`,number:'TEST-QUO-006',clientId:`${PREFIX}contact-stock`,date:yesterday,status:'Converted',quoteTypeV58940:'stock',fulfilmentV58940:'collection',paymentTermsV58940:'full-prepayment',billingRouteV5895:'full-prepayment',lineItems:[moneyLine(`${PREFIX}ql-stock`,'20 bags compost',20,85)],notes:'Stock-only collection order.',acceptedAt:dateTime(yesterday,14,0),convertedAtV58940:dateTime(yesterday,14,5),archivedAtV58940:dateTime(yesterday,14,5),convertedToV58940:'order',convertedRecordIdV58940:`${PREFIX}order-stock`,createdAt:dateTime(yesterday,13,0),updatedAt:dateTime(yesterday,14,5),fictitiousTestV58958:true}
    ];
    merge(s.quotes,quotes);

    const invoices=[
      {id:`${PREFIX}invoice-draft`,number:'Draft',clientId:`${PREFIX}client-weekly`,month,status:'Draft',deliveryStatus:'Not sent',paymentStatus:'Unpaid',vatRate:0,lineItems:[moneyLine(`${PREFIX}il-draft`,'Weekly garden service',1,1450)],notes:'Test draft invoice.',createdAt:dateTime(today,7,0),updatedAt:dateTime(today,7,0),fictitiousTestV58958:true},
      {id:`${PREFIX}invoice-unpaid`,number:'TEST-INV-001',clientId:`${PREFIX}client-fortnightly`,month,status:'Sent',deliveryStatus:'Sent',paymentStatus:'Unpaid',sentAt:addDays(today,-2)+'T09:00:00',issueDate:addDays(today,-2),dueDate:addDays(today,5),vatRate:0,lineItems:[moneyLine(`${PREFIX}il-unpaid`,'Fortnightly garden service',1,980)],notes:'Test unpaid invoice.',createdAt:addDays(today,-2)+'T08:30:00',history:[{date:addDays(today,-2)+'T09:00:00',action:'Sent via email',note:'test.jacobs@example.com'}],fictitiousTestV58958:true},
      {id:`${PREFIX}invoice-overdue`,number:'TEST-INV-002',clientId:`${PREFIX}client-monthly`,month,status:'Sent',deliveryStatus:'Sent',paymentStatus:'Unpaid',sentAt:addDays(today,-18)+'T09:00:00',issueDate:addDays(today,-18),dueDate:addDays(today,-10),vatRate:0,lineItems:[moneyLine(`${PREFIX}il-overdue`,'Monthly common-area service',1,2600)],notes:'Test overdue invoice.',createdAt:addDays(today,-18)+'T08:30:00',history:[{date:addDays(today,-18)+'T09:00:00',action:'Sent via email',note:'test.ocean@example.com'}],fictitiousTestV58958:true},
      {id:`${PREFIX}invoice-partial`,number:'TEST-INV-003',clientId:`${PREFIX}contact-service`,month,status:'Sent',deliveryStatus:'Sent',paymentStatus:'Partially paid',sentAt:addDays(today,-6)+'T09:00:00',issueDate:addDays(today,-6),dueDate:addDays(today,1),vatRate:0,lineItems:[moneyLine(`${PREFIX}il-partial`,'Once-off clean-up',1,1600)],notes:'Test partial-payment invoice.',createdAt:addDays(today,-6)+'T08:30:00',fictitiousTestV58958:true},
      {id:`${PREFIX}invoice-paid`,number:'TEST-INV-004',clientId:`${PREFIX}client-weekly`,month,status:'Sent',deliveryStatus:'Sent',paymentStatus:'Paid',sentAt:addDays(today,-8)+'T09:00:00',issueDate:addDays(today,-8),dueDate:addDays(today,-1),paidAt:addDays(today,-3)+'T10:00:00',vatRate:0,lineItems:[moneyLine(`${PREFIX}il-paid`,'Additional hedge trimming',1,750)],notes:'Test paid invoice.',createdAt:addDays(today,-8)+'T08:30:00',fictitiousTestV58958:true},
      {id:`${PREFIX}credit-note`,number:'TEST-CN-001',clientId:`${PREFIX}client-monthly`,month,status:'Credited',transactionType:'Credit Note',deliveryStatus:'Not sent',paymentStatus:'Credited',creditedInvoiceId:`${PREFIX}invoice-overdue`,vatRate:0,lineItems:[moneyLine(`${PREFIX}cl-credit`,'Credit for missed section',1,150)],notes:'Work not completed.',createdAt:addDays(today,-1)+'T10:00:00',fictitiousTestV58958:true}
    ];
    merge(s.invoices,invoices);

    const payments=[
      {id:`${PREFIX}payment-partial`,paymentGroupId:`${PREFIX}payment-group-partial`,invoiceId:`${PREFIX}invoice-partial`,clientId:`${PREFIX}contact-service`,amount:600,date:addDays(today,-2),method:'EFT',reference:'TEST PART',createdAt:addDays(today,-2)+'T11:00:00',fictitiousTestV58958:true},
      {id:`${PREFIX}payment-paid`,paymentGroupId:`${PREFIX}payment-group-paid`,invoiceId:`${PREFIX}invoice-paid`,clientId:`${PREFIX}client-weekly`,amount:750,date:addDays(today,-3),method:'EFT',reference:'TEST PAID',createdAt:addDays(today,-3)+'T10:00:00',fictitiousTestV58958:true}
    ];
    merge(s.adminLifecycleV56.payments,payments);

    const statements=[
      {id:`${PREFIX}statement`,number:'TEST-STM-001',clientId:`${PREFIX}client-weekly`,start:addDays(today,-30),end:today,createdDate:today,opening:0,closing:1450,rows:[{date:addDays(today,-8),reference:'TEST-INV-004',description:'Additional hedge trimming',debit:750,credit:0,balance:750},{date:addDays(today,-3),reference:'TEST PAID',description:'EFT payment',debit:0,credit:750,balance:0},{date:today,reference:'Draft',description:'Weekly garden service draft',debit:1450,credit:0,balance:1450}],createdAt:now,fictitiousTestV58958:true}
    ];
    merge(s.adminLifecycleV56.statements,statements);

    const orders=[
      {id:`${PREFIX}order-stock`,number:'TEST-ORD-001',quoteId:`${PREFIX}quote-stock`,clientId:`${PREFIX}contact-stock`,fulfilment:'collection',total:1700,status:'Ready to prepare',lineItems:[moneyLine(`${PREFIX}ol-stock`,'20 bags compost',20,85)],createdAt:dateTime(yesterday,14,5),updatedAt:dateTime(yesterday,14,5),fictitiousTestV58958:true}
    ];
    merge(s.stockOrdersV58940,orders);

    const reports=[
      {id:`${PREFIX}report-${PREFIX}client-weekly-${yesterday}`,status:'Sent',sentAt:dateTime(yesterday,15,15),note:'Test completion report sent.',fictitiousTestV58958:true}
    ];
    merge(s.clientReports,reports);

    s.business=s.business||{};
    s.business.fictitiousDatasetV58958={installedAt:now,today,primaryTeamId:primaryTeam,secondTeamId:secondTeam,build:BUILD};
    window.save();
    renderCurrent();
    updatePanel();
    window.toast?.('Fictitious test data added.');
  }

  function remove(){
    if(!ready())return alert('TuinBooks is still loading.');
    if(!confirm('Clear all fictitious TEST records? Real business records will remain.'))return;
    const s=window.state;
    ['clients','schedules','visits','quotes','invoices','opportunities','scheduleBasket','stockOrdersV58940','clientReports'].forEach(key=>{s[key]=removePrefixed(s[key]);});
    s.adminLifecycleV56=s.adminLifecycleV56||{};
    s.adminLifecycleV56.payments=removePrefixed(s.adminLifecycleV56.payments);
    s.adminLifecycleV56.statements=removePrefixed(s.adminLifecycleV56.statements);
    /* Only remove test-created teams/clusters; existing business teams/clusters were reused. */
    s.teams=removePrefixed(s.teams);s.clusters=removePrefixed(s.clusters);
    if(s.business)delete s.business.fictitiousDatasetV58958;
    window.save();renderCurrent();updatePanel();window.toast?.('Fictitious test data cleared.');
  }

  function datasetCounts(){
    const s=window.state||{};
    const count=key=>arr(s[key]).filter(row=>String(row?.id||'').startsWith(PREFIX)).length;
    return {clients:count('clients'),jobs:count('schedules'),visits:count('visits'),quotes:count('quotes'),invoices:count('invoices'),orders:count('stockOrdersV58940')};
  }

  function updatePanel(){
    const panel=document.getElementById(PANEL_ID);if(!panel||!ready())return;
    const c=datasetCounts(),installed=!!window.state?.business?.fictitiousDatasetV58958;
    const primaryId=window.state?.business?.fictitiousDatasetV58958?.primaryTeamId;
    const primary=arr(window.state?.teams).find(team=>team.id===primaryId)?.name||arr(window.state?.teams).find(team=>team.active!==false)?.name||'first active team';
    panel.querySelector('[data-test-status]').innerHTML=installed
      ?`<strong>Fictitious data installed</strong><span>${c.clients} contacts/clients · ${c.jobs} jobs · ${c.quotes} quotes · ${c.invoices} invoices</span><span>Primary test team: <b>${primary}</b></span>`
      :'<strong>Fictitious data not installed</strong><span>Existing business records will be preserved.</span>';
    panel.querySelector('[data-test-populate]').textContent=installed?'Refresh fictitious data':'Populate fictitious data';
  }

  function installPanel(){
    if(document.getElementById(PANEL_ID))return updatePanel();
    const panel=document.createElement('aside');panel.id=PANEL_ID;panel.innerHTML=`
      <div class="test-head-v58957"><div><small>TEST DATA</small><strong>Fictitious business data</strong></div><button type="button" data-test-close aria-label="Hide">×</button></div>
      <div class="test-status-v58957" data-test-status></div>
      <div class="test-actions-v58957"><button type="button" data-test-populate>Populate fictitious data</button><button type="button" data-test-remove>Clear fictitious data</button></div>
      <small class="test-note-v58957">This panel appears only when the URL contains <b>?testdata=1</b>.</small>`;
    const style=document.createElement('style');style.id='testStylesV58958';style.textContent=`
      #${PANEL_ID}{position:fixed;right:18px;bottom:18px;z-index:100000;width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid #cfe0d7;border-radius:16px;box-shadow:0 18px 55px rgba(17,58,44,.22);padding:14px;color:#173c31;font:14px/1.35 system-ui,sans-serif}
      .test-head-v58957{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.test-head-v58957>div{display:grid;gap:2px}.test-head-v58957 small{font-weight:800;letter-spacing:.08em;color:#267052}.test-head-v58957>div>strong{font-size:17px}.test-head-v58957>button{border:0;background:#edf5f1;border-radius:9px;width:32px;height:32px;cursor:pointer;font-size:18px}
      .test-status-v58957{display:grid;gap:4px;margin:12px 0;padding:10px 12px;background:#f4f8f6;border-radius:10px}.test-status-v58957 span{font-size:12px;color:#5f746a}.test-actions-v58957{display:flex;gap:8px}.test-actions-v58957 button{flex:1;border:1px solid #2a7657;border-radius:10px;padding:9px 10px;font-weight:800;cursor:pointer;background:#1f6f54;color:#fff}.test-actions-v58957 button+button{background:#fff;color:#1f6f54}.test-note-v58957{display:block;margin-top:9px;color:#71847b}
    `;document.head.appendChild(style);document.body.appendChild(panel);
    panel.querySelector('[data-test-populate]').onclick=populate;
    panel.querySelector('[data-test-remove]').onclick=remove;
    panel.querySelector('[data-test-close]').onclick=()=>panel.remove();
    updatePanel();
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(ready()){clearInterval(timer);installPanel();window.__tuinbooksTestDataV58958={populate,remove,counts:datasetCounts,build:BUILD};}else if(tries>80)clearInterval(timer);},125);
})();
