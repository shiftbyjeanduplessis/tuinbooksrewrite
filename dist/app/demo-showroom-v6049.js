/* TuinBooks v60.4.9 — permanent training showroom + demo-only guided tour
   - Only activates for TuinBooks Training Garden Services / demoMode.
   - Preserves the live app's Schedule/Work/Clients/Quotes/Billing logic.
   - Uses the existing Supabase business, Billing Profile and field membership.
   - Restores a deterministic showroom baseline after the demo-only reset RPC clears old operational history. */
(()=>{
  'use strict';
  const BUILD='60.4.10-demo-showroom-photos';
  const DEMO_NAME='TuinBooks Training Garden Services';
  const DEMO_FIELD_PIN='5065';
  const DEMO_MOBILE_PATH='mobile.html';
  const DEMO_PHOTO_DIR='demo-showroom-photos';
  const DEMO_WORK_PHOTOS=['showroom-work-01.png','showroom-work-02.png','showroom-work-03.png','showroom-work-04.png'];
  const TOUR_STORAGE_PREFIX='tuinbooks-demo-tour-v60410:';
  let tourIndex=-1;
  let highlighted=null;
  let targetBubble=null;

  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const isoLocal=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return isoLocal(d);};
  const mondayOf=iso=>{const d=new Date(`${iso}T12:00:00`);let n=d.getDay();if(n===0)n=7;d.setDate(d.getDate()-(n-1));return isoLocal(d);};
  const monthOf=iso=>String(iso).slice(0,7);
  const uid=(prefix,index)=>`${prefix}-${String(index).padStart(2,'0')}`;
  const deep=value=>JSON.parse(JSON.stringify(value));
  const demoPhotoUrl=name=>new URL(`${DEMO_PHOTO_DIR}/${name}`,location.href).href;
  const backend=()=>window.backendV28||null;
  const currentState=()=>window.state||null;
  const isDemo=()=>{
    const s=currentState(),name=String(s?.business?.name||$('businessNameHeader')?.textContent||'');
    return Boolean(s?.business?.demoMode||s?.business?.demo_mode||/TuinBooks Training Garden Services/i.test(name));
  };
  const adminReady=()=>isDemo()&&backend()?.mode==='supabase'&&backend()?.businessId&&backend()?.client&&['owner','admin'].includes(String(backend()?.role||'owner'));
  const defaultBillingProfile=()=>{
    const rows=Array.isArray(currentState()?.billingProfilesV59396)?currentState().billingProfilesV59396:[];
    return rows.find(row=>row?.isDefault&&row?.isActive!==false)||rows.find(row=>row?.isActive!==false)||rows[0]||null;
  };

  const CLIENT_BLUEPRINTS=[
    ['Botha Residence','Jan Botha','12 Protea Street','Hartenbos','Residential','Weekly',850,1.5,['general-maintenance','lawn-mowing','lawn-edging'],'Gate code 1842. Small dog stays inside.'],
    ['Jacobs Residence','Marlene Jacobs','8 Koraal Avenue','Hartenbos','Residential','Weekly',780,1.4,['general-maintenance','lawn-mowing'],'Side gate next to garage.'],
    ['Nel Residence','Johan Nel','41 Seemeeu Road','Island View','Residential','Fortnightly',650,1.7,['general-maintenance','hedge-trimming'],'Phone before arrival if gate is closed.'],
    ['Smit Residence','Elsabe Smit','16 Nautilus Crescent','Diaz Beach','Residential','Weekly',920,1.6,['general-maintenance','lawn-mowing','hedge-trimming'],'Use back entrance. Do not trim bougainvillea unless requested.'],
    ['Du Toit Residence','Pierre du Toit','22 Fynbos Road','Dana Bay','Residential','Fortnightly',720,1.8,['general-maintenance','pruning'],'Steep driveway. Keep garden waste behind side wall.'],
    ['Van Wyk Residence','Annelie van Wyk','5 Mossel Street','Dana Bay','Residential','Monthly',560,1.6,['general-maintenance','seasonal-cleanup'],'Key with neighbour if owner is away.'],
    ['Daniels Residence','Graham Daniels','73 Cape Road','Heiderand','Residential','Weekly',890,1.5,['general-maintenance','lawn-mowing','lawn-edging'],'Park in driveway, not on verge.'],
    ['Fourie Residence','Retha Fourie','19 Gouritz Street','Heiderand','Residential','Fortnightly',690,1.6,['general-maintenance','hedge-trimming'],'Two green bins for clippings.'],
    ['Marais Residence','Theo Marais','11 Beacon Road','Mossel Bay Central','Residential','Weekly',950,1.7,['general-maintenance','lawn-mowing','irrigation-inspection'],'Check irrigation pressure at end of visit.'],
    ['Scholtz Residence','Adele Scholtz','6 Milkwood Close','Island View','Residential','Fortnightly',740,1.6,['general-maintenance','pruning'],'Please keep front path clear before 11:00.'],
    ['Ocean Breeze Body Corporate','Nadia Adams','1 Beach Boulevard','Diaz Beach','Body corporate','Weekly',2850,2.2,['general-maintenance','lawn-mowing','hedge-trimming','waste-removal'],'Report any irrigation leaks to the caretaker.'],
    ['Seaview Guesthouse','Michael Venter','24 High Street','Mossel Bay Central','Business','Weekly',2450,2.0,['general-maintenance','lawn-mowing','pruning'],'Quiet work around breakfast area before 09:30.'],
    ['Pinnacle Office Park','Leanne Meyer','14 Commerce Lane','Voorbaai','Business','Weekly',3200,2.1,['general-maintenance','lawn-mowing','waste-removal'],'Security signs team in at main gate.'],
    ['Harbour View Apartments','Ruan Bothma','9 Harbour Road','Mossel Bay Central','Body corporate','Weekly',2600,2.0,['general-maintenance','hedge-trimming','waste-removal'],'Caretaker opens refuse yard.'],
    ['Garden Route Veterinary Clinic','Dr Mia Smith','18 Industry Road','Voorbaai','Business','Fortnightly',1350,1.5,['general-maintenance','lawn-mowing'],'Avoid blower near kennels when animals are outside.'],
    ['Bayview Retirement Village','Susan Louw','33 Bayview Drive','Heiderand','Estate','Weekly',3800,2.3,['general-maintenance','lawn-mowing','hedge-trimming','pruning'],'Keep walkways open. Residents may ask questions while team works.'],
    ['Hartenbos Boutique Hotel','Karien le Roux','7 Saffier Street','Hartenbos','Business','Weekly',2950,2.0,['general-maintenance','lawn-mowing','pruning'],'Reception will point out event areas needing priority.'],
    ['Dune Ridge Estate Gatehouse','Francois Rossouw','2 Dune Ridge Drive','Dana Bay','Estate','Weekly',2100,1.8,['general-maintenance','lawn-mowing','irrigation-inspection'],'Sign in with estate security.'],
    ['Voorbaai Storage Park','Lerato Mokoena','25 Foundry Road','Voorbaai','Business','Fortnightly',1450,1.6,['general-maintenance','lawn-mowing','waste-removal'],'Keep loading bays clear.'],
    ['Mossel Bay Community Church','Andre Ferreira','10 Church Street','Mossel Bay Central','School or institution','Weekly',1800,1.8,['general-maintenance','lawn-mowing','hedge-trimming'],'No mowing during Wednesday morning service.'],
    ['Steyn Residence','Carla Steyn','4 Aloe Close','Dana Bay','Residential','Monthly',590,1.5,['general-maintenance','pruning'],'Water-sensitive succulents; do not overwater.'],
    ['Williams Residence','Trevor Williams','29 Coral Road','Hartenbos','Residential','Fortnightly',710,1.5,['general-maintenance','lawn-mowing'],'Side gate unlocked from 08:00.'],
    ['Petersen Residence','Shireen Petersen','17 Hilltop Avenue','Heiderand','Residential','Weekly',830,1.4,['general-maintenance','lawn-mowing','lawn-edging'],'Please close gate securely after visit.'],
    ['Van der Merwe Residence','Henk van der Merwe','52 Fynbos Lane','Dana Bay','Residential','Fortnightly',760,1.7,['general-maintenance','hedge-trimming'],'Large hedge on street side only.'],
    ['Naidoo Residence','Priya Naidoo','31 Ocean View Drive','Island View','Residential','Weekly',980,1.8,['general-maintenance','lawn-mowing','irrigation-inspection'],'Owner prefers WhatsApp report after each visit.'],
    ['Meyer Residence','Louis Meyer','15 Karveel Crescent','Diaz Beach','Residential','Monthly',620,1.5,['general-maintenance','seasonal-cleanup'],'Pool service is separate; keep clippings out of pool.'],
    ['Khumalo Residence','Thandi Khumalo','20 Protea Crescent','Heiderand','Residential','Fortnightly',730,1.6,['general-maintenance','lawn-mowing'],'Front garden first; owner works from home.'],
    ['Bosman Residence','Hester Bosman','3 Sandpiper Close','Hartenbos','Residential','Weekly',860,1.5,['general-maintenance','lawn-mowing','hedge-trimming'],'Small front hedge must stay below window level.'],
    ['Bluewater Café','Monique Jacobs','5 Marina Walk','Mossel Bay Central','Business','Weekly',1650,1.5,['general-maintenance','pruning'],'Finish entrance beds before 10:00 opening rush.'],
    ['Van Rensburg Residence','Kobus van Rensburg','44 Aloe Ridge','Dana Bay','Residential','Fortnightly',790,1.7,['general-maintenance','lawn-mowing','hedge-trimming'],'NEW recurring client. Office still needs to place the first visit.']
  ];

  function buildShowroomState(){
    const existing=currentState()||{};
    const today=isoLocal();
    const weekStart=mondayOf(today);
    const todayDate=new Date(`${today}T12:00:00`);
    const todayIndex=Math.max(0,Math.min(4,(todayDate.getDay()||7)-1));
    const nextWeek=addDays(weekStart,7);
    const profile=defaultBillingProfile();
    const profileId=String(profile?.id||'');
    const oldTeams=Array.isArray(existing.teams)?existing.teams.filter(t=>t&&t.active!==false):[];
    const proteaId=String(oldTeams[0]?.id||'demo-team-protea');
    const aloeId=String(oldTeams[1]?.id||'demo-team-aloe');
    const teams=[
      {id:proteaId,name:'Protea Team',leaderName:'Daniel',visualColor:'#2e8b68',capacityHours:8,bufferHours:1,dailySiteCapacity:4,serviceArea:'Coastal Route',primaryClusterIds:['demo-cluster-coastal'],active:true},
      {id:aloeId,name:'Aloe Team',leaderName:'Sipho',visualColor:'#3378b5',capacityHours:8,bufferHours:1,dailySiteCapacity:4,serviceArea:'Bay Route',primaryClusterIds:['demo-cluster-bay'],active:true}
    ];
    const clusters=[
      {id:'demo-cluster-coastal',name:'Coastal Route',color:'#2e8b68',suburbs:['Hartenbos','Diaz Beach','Island View'],neighborIds:['demo-cluster-bay'],active:true},
      {id:'demo-cluster-bay',name:'Bay Route',color:'#3378b5',suburbs:['Mossel Bay Central','Heiderand','Voorbaai'],neighborIds:['demo-cluster-south'],active:true},
      {id:'demo-cluster-south',name:'Dana Bay Route',color:'#9b6a42',suburbs:['Dana Bay'],neighborIds:['demo-cluster-bay'],active:true}
    ];
    const clusterFor=suburb=>suburb==='Dana Bay'?'demo-cluster-south':['Mossel Bay Central','Heiderand','Voorbaai'].includes(suburb)?'demo-cluster-bay':'demo-cluster-coastal';
    const dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const clients=CLIENT_BLUEPRINTS.map((row,index)=>{
      const [name,contact,address,suburb,customerType,frequency,monthlyFee,estimatedHours,serviceIds,accessNotes]=row;
      const id=uid('demo-client',index+1),teamId=index%2===0?proteaId:aloeId;
      const preferredDay=dayNames[Math.floor(index/6)%5]||dayNames[index%5];
      return {
        id,siteId:`site-${id}`,name,contact,address,suburb,customerType,clientTypeId:customerType,
        whatsapp:`+27 82 55${String(10000+index).slice(-5)}`,email:`demo${index+1}@example.com`,monthlyFee,rateAmount:monthlyFee,
        priceBasis:'Monthly',billingArrangement:'Monthly contract',frequency,preferredDay,fixedDay:true,estimatedHours,teamId,preferredTeamId:teamId,
        clusterId:clusterFor(suburb),status:'active',serviceState:'active',serviceStartDate:addDays(weekStart,-35),recurrenceAnchorDate:addDays(weekStart,-35),
        serviceDescription:serviceIds.includes('lawn-mowing')?'General garden maintenance; Cut grass; Edge lawns and paths; Weed and tidy beds; Blow or clean paving':'General garden maintenance; Weed and tidy beds; Prune agreed plants; General garden tidy',
        serviceIds:[...serviceIds],workTypeIds:[],customTasks:'',accessNotes,gardenNotes:index%7===0?'Please photograph anything unusual and note it for the office.':'',
        communicationPreference:'WhatsApp',completionReport:'yes',invoiceTiming:'business_default',firstBillingRule:'full_cycle',recordKindV58951:'recurring-client',
        schedulingPolicyV58951:'manual-schedule-import',scheduleSource:'diary',autoScheduleEnabled:false,serviceStartIsEarliestV58951:false,
        billingProfileIdV59396:profileId,createdAt:addDays(weekStart,-60),activatedAt:addDays(weekStart,-60),activationConfirmedV58961:true,
        awaitingInitialRecurringPlacementV6036:index===CLIENT_BLUEPRINTS.length-1
      };
    });
    const activeScheduledClients=clients.slice(0,29);
    const schedules=[];
    const visits=[];
    let scheduleCounter=1,visitCounter=1;
    for(let day=0;day<5;day+=1){
      const date=addDays(weekStart,day);
      const dayClients=activeScheduledClients.slice(day*6,Math.min(day*6+6,activeScheduledClients.length));
      dayClients.forEach((client,rowIndex)=>{
        const teamId=rowIndex<3?proteaId:aloeId;
        const routeSort=(rowIndex%3)+1;
        const id=uid('demo-job',scheduleCounter++);
        let status='scheduled';
        if(day<todayIndex)status='completed';
        if(day===todayIndex&&routeSort===1)status='completed';
        const missed=(day===Math.max(0,todayIndex-1)&&teamId===aloeId&&routeSort===3);
        if(missed)status='scheduled';
        const job={
          id,date,clientId:client.id,teamId,clusterId:client.clusterId,status,estimatedHours:client.estimatedHours,sort:routeSort,locked:false,
          revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',serviceIds:[...client.serviceIds],workTypeIds:[],visitTasks:client.serviceDescription.split(';').map(v=>v.trim()).filter(Boolean),
          manualOverride:true,autoGenerated:false,autoAssigned:false,billingProfileIdV59396:profileId,createdAt:`${date}T06:30:00.000Z`
        };
        schedules.push(job);
        if(status==='completed'){
          const extra=(day===Math.max(0,todayIndex-2)&&teamId===proteaId&&routeSort===2)?'Client asked for the large front hedge to be reduced next visit. Office quote requested.':'';
          const demoPhoto=demoPhotoUrl(DEMO_WORK_PHOTOS[(visitCounter-1)%DEMO_WORK_PHOTOS.length]);
          const visit={
            id:uid('demo-visit',visitCounter++),clientId:client.id,date,teamId,scheduled:true,scheduledJobId:id,
            workDone:client.serviceIds.includes('lawn-mowing')?['Cut grass','Edge lawns and paths','Weed and tidy beds','General garden tidy']:['Weed and tidy beds','Prune agreed plants','General garden tidy'],
            extraDescription:extra,outcome:'Completed',photoPaths:[],photos:[demoPhoto],billingProfileIdV59396:profileId,completedAt:`${date}T10:15:00.000Z`,createdAt:`${date}T10:15:00.000Z`
          };
          visits.push(visit);
        }
      });
    }
    // A few future visits make the rolling schedule feel alive even late in the week.
    clients.filter(c=>c.frequency==='Weekly').slice(0,8).forEach((client,index)=>{
      const date=addDays(nextWeek,index<4?0:1),teamId=index%2===0?proteaId:aloeId;
      schedules.push({id:uid('demo-job-next',index+1),date,clientId:client.id,teamId,clusterId:client.clusterId,status:'scheduled',estimatedHours:client.estimatedHours,sort:Math.floor(index/2)+1,revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',serviceIds:[...client.serviceIds],manualOverride:false,autoGenerated:true,autoAssigned:false,billingProfileIdV59396:profileId,createdAt:`${today}T07:00:00.000Z`});
    });

    const missedJob=schedules.find(j=>j.status==='scheduled'&&j.date<today&&j.teamId===aloeId)||null;
    if(missedJob){missedJob.officeNotes='Client could not provide access. Office still needs to resolve this visit.';missedJob.demoMissed=true;}
    const extraVisit=visits.find(v=>v.extraDescription)||visits[0];
    const opportunities=extraVisit?[{
      id:'demo-opportunity-01',clientId:extraVisit.clientId,scheduleId:extraVisit.scheduledJobId,visitId:extraVisit.id,teamId:extraVisit.teamId,
      category:'Upgrade',note:'Large front hedge reduction requested. Measure and quote before next routine visit.',status:'new',reviewDecision:'new',photoPaths:[],photos:[...(extraVisit.photos||[])],billingProfileIdV59396:profileId,createdAt:`${extraVisit.date}T10:20:00.000Z`
    }]:[];

    const q1Client=clients[11],q2Client=clients[7],q3Client=clients[10],q4Client=clients[12];
    const quoteLine=(id,description,qty,unitPrice)=>({id,description,qty,unitPrice});
    const quotes=[
      {id:'demo-quote-draft',number:'Draft',clientId:q1Client.id,billingProfileIdV59396:profileId,date:addDays(today,-2),status:'Draft',commercialStateV59400:'draft',scheduled:false,notes:'Refresh the entrance beds before spring.',lineItems:[quoteLine('qdl1','Compost and bed preparation',1,1450),quoteLine('qdl2','Seasonal colour planting',1,1850)],createdAt:`${addDays(today,-2)}T08:30:00.000Z`,history:[{date:`${addDays(today,-2)}T08:30:00.000Z`,action:'Draft quote created'}]},
      {id:'demo-quote-sent',number:'QUO-0107',clientId:q2Client.id,billingProfileIdV59396:profileId,date:addDays(today,-4),status:'Sent',commercialStateV59400:'sent',scheduled:false,sentAt:`${addDays(today,-3)}T09:00:00.000Z`,validityDaysV59400:7,notes:'Shape and reduce perimeter hedge.',lineItems:[quoteLine('qsl1','Hedge shaping and reduction',1,1850)],createdAt:`${addDays(today,-4)}T14:00:00.000Z`,history:[{date:`${addDays(today,-3)}T09:00:00.000Z`,action:'Quote emailed to client'}]},
      {id:'demo-quote-accepted',number:'QUO-0106',clientId:q3Client.id,billingProfileIdV59396:profileId,date:addDays(today,-5),status:'Approved',commercialStateV59400:'accepted',scheduled:false,acceptedAt:`${addDays(today,-1)}T11:05:00.000Z`,notes:'Repair leaking irrigation zone and replace damaged heads.',lineItems:[quoteLine('qal1','Irrigation fault finding and repair',1,3200),quoteLine('qal2','Replacement irrigation heads',4,400)],createdAt:`${addDays(today,-5)}T10:00:00.000Z`,history:[{date:`${addDays(today,-1)}T11:05:00.000Z`,action:'Quote accepted by client'}]},
      {id:'demo-quote-completed',number:'QUO-0105',clientId:q4Client.id,billingProfileIdV59396:profileId,date:addDays(today,-8),status:'Approved',commercialStateV59400:'completed',scheduled:true,acceptedAt:`${addDays(today,-7)}T09:30:00.000Z`,completedAt:`${addDays(today,-2)}T15:20:00.000Z`,notes:'Once-off seasonal cleanup behind warehouse units.',lineItems:[quoteLine('qcl1','Seasonal cleanup',1,4800),quoteLine('qcl2','Garden waste removal',1,1400)],createdAt:`${addDays(today,-8)}T09:00:00.000Z`,history:[{date:`${addDays(today,-7)}T09:30:00.000Z`,action:'Quote accepted'},{date:`${addDays(today,-2)}T15:20:00.000Z`,action:'Quoted work completed'}]}
    ];
    const quoteJob={id:'demo-job-quote-completed',date:addDays(today,-2),clientId:q4Client.id,teamId:proteaId,clusterId:q4Client.clusterId,status:'completed',estimatedHours:3,sort:4,quoteId:'demo-quote-completed',revenueType:'Existing-client add-on',workKind:'once-off',workMarker:'O',serviceIds:['seasonal-cleanup','waste-removal'],billingProfileIdV59396:profileId,manualOverride:true,autoGenerated:false,createdAt:`${addDays(today,-3)}T08:00:00.000Z`};
    schedules.push(quoteJob);
    const quoteVisit={id:'demo-visit-quote-completed',clientId:q4Client.id,date:quoteJob.date,teamId:proteaId,scheduled:true,scheduledJobId:quoteJob.id,workDone:['Seasonal cleanup','Remove agreed garden waste'],extraDescription:'',outcome:'Completed',photoPaths:[],photos:[demoPhotoUrl(DEMO_WORK_PHOTOS[1])],billingProfileIdV59396:profileId,completedAt:`${quoteJob.date}T15:20:00.000Z`,createdAt:`${quoteJob.date}T15:20:00.000Z`};
    visits.push(quoteVisit);

    const currentMonth=monthOf(today),previousMonth=monthOf(addDays(weekStart,-12));
    const invoices=[
      {id:'demo-invoice-draft-01',number:'Draft',clientId:clients[0].id,billingProfileIdV59396:profileId,month:currentMonth,status:'Draft',deliveryStatus:'Not sent',paymentStatus:'Unpaid',vatRate:0,lineItems:[{id:'idl1',description:`Garden service — ${currentMonth}`,qty:1,unitPrice:clients[0].monthlyFee,extra:false,approved:true}],notes:'Routine monthly service draft.',createdAt:`${today}T07:30:00.000Z`},
      {id:'demo-invoice-ready-01',number:'Draft',clientId:q4Client.id,billingProfileIdV59396:profileId,month:currentMonth,status:'Ready',deliveryStatus:'Not sent',paymentStatus:'Unpaid',vatRate:0,sourceQuoteIdV5895:'demo-quote-completed',sourceQuoteIdV59392:'demo-quote-completed',lineItems:[{id:'irl1',description:'Seasonal cleanup',qty:1,unitPrice:4800,extra:false,approved:true,sourceQuoteId:'demo-quote-completed'},{id:'irl2',description:'Garden waste removal',qty:1,unitPrice:1400,extra:false,approved:true,sourceQuoteId:'demo-quote-completed'}],notes:'Quoted work completed and ready to invoice.',createdAt:`${addDays(today,-2)}T15:30:00.000Z`},
      {id:'demo-invoice-sent-01',number:'INV-0103',clientId:clients[15].id,billingProfileIdV59396:profileId,month:previousMonth,status:'Sent',deliveryStatus:'Sent',paymentStatus:'Unpaid',vatRate:0,lineItems:[{id:'isl1',description:`Garden service — ${previousMonth}`,qty:1,unitPrice:clients[15].monthlyFee,extra:false,approved:true}],sentAt:`${addDays(weekStart,-8)}T08:15:00.000Z`,createdAt:`${addDays(weekStart,-9)}T14:00:00.000Z`},
      {id:'demo-invoice-paid-01',number:'INV-0102',clientId:clients[16].id,billingProfileIdV59396:profileId,month:previousMonth,status:'Paid',deliveryStatus:'Sent',paymentStatus:'Paid',vatRate:0,lineItems:[{id:'ipl1',description:`Garden service — ${previousMonth}`,qty:1,unitPrice:clients[16].monthlyFee,extra:false,approved:true}],sentAt:`${addDays(weekStart,-12)}T08:20:00.000Z`,paidAt:`${addDays(weekStart,-6)}T13:10:00.000Z`,createdAt:`${addDays(weekStart,-13)}T14:00:00.000Z`}
    ];

    const newClient=clients.at(-1),newBasketJob='demo-new-r-job-01';
    const scheduleBasket=[
      {id:'demo-basket-new-r',sourceJobId:newBasketJob,clientId:newClient.id,originalDate:today,originalTeamId:'',weekStart,estimatedHours:newClient.estimatedHours,serviceIds:[...newClient.serviceIds],workTypeIds:[],clusterId:newClient.clusterId,quoteId:'',workKind:'recurring',revenueType:'Recurring contract',workMarker:'R',reason:'New recurring client — place the first visit manually on the correct team and day.',newRecurringV6036:true,createdAt:`${today}T08:00:00.000Z`,updatedAt:`${today}T08:00:00.000Z`,jobPayload:{id:newBasketJob,clientId:newClient.id,date:'',teamId:'',status:'unscheduled',sort:99,estimatedHours:newClient.estimatedHours,clusterId:newClient.clusterId,revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',serviceIds:[...newClient.serviceIds],workTypeIds:[],autoGenerated:false,autoAssigned:false,manualOverride:true,createdAt:`${today}T08:00:00.000Z`}}
    ];

    const payments=[{id:'demo-payment-01',invoiceId:'demo-invoice-paid-01',clientId:clients[16].id,billingProfileIdV59396:profileId,amount:clients[16].monthlyFee,date:addDays(weekStart,-6),method:'EFT',reference:'Demo payment',createdAt:`${addDays(weekStart,-6)}T13:10:00.000Z`}];
    const business={...(existing.business||{}),name:DEMO_NAME,phone:'+27 60 000 0000',email:'demo@tuinbooks.garden',address:'Mossel Bay, Western Cape',demoMode:true,demo_mode:true,demoDisableOutbound:true,demo_disable_outbound:true,demoShowroomVersion:BUILD,demoShowroomInstalledAt:new Date().toISOString(),vatRegistered:'no',invoicePrefix:'INV',quotePrefix:'QUO',paymentTerms:'Payment due within 7 days by EFT.',invoiceNote:'Thank you for your business. This is training data only.'};
    const next={...existing,version:28,onboardingComplete:true,onboarding:{...(existing.onboarding||{}),completedAt:new Date().toISOString(),clientSetupChoice:'prepared',nextSetupTask:'none'},business,teams,clusters,clients,schedules,visits,quotes,invoices,opportunities,closures:{},catchUps:[],visitActions:[],clientReportStatus:{},clientReports:[],teamDayPlans:{[today]:{[proteaId]:'Take the long ladder and two bags of compost.',[aloeId]:'Check irrigation fittings before leaving the yard.'}},scheduleVersions:[],scheduleBasket,serviceAgreements:[],serviceCommitments:[],teamCapacityProfiles:existing.teamCapacityProfiles||[],capacityExceptions:[],capacityOverrides:[],fulfilmentPeriods:[],adminLifecycleV56:{...(existing.adminLifecycleV56||{}),payments,statements:[]},stockOrdersV58940:[],billingProfilesV59396:existing.billingProfilesV59396||[]};
    return next;
  }

  function coreSnapshotFrom(next){
    const b=backend(),validClusters=new Set((next.clusters||[]).map(c=>c.id));
    return {
      p_business_id:b.businessId,p_expected_revision:Number(b.coreRevision||0),
      p_business:{name:next.business.name,phone:next.business.phone||'',email:next.business.email||'',address:next.business.address||'',onboarding_complete:true,settings:{...(next.business||{}),onboarding:next.onboarding||{}}},
      p_teams:(next.teams||[]).map(team=>({id:team.id,name:team.name,leader_name:team.leaderName||'',capacity_hours:Number(team.capacityHours||8),buffer_hours:Number(team.bufferHours||1),active:team.active!==false,payload:deep(team)})),
      p_clusters:(next.clusters||[]).map(cluster=>({id:cluster.id,name:cluster.name,color:cluster.color||'#2e8b68',suburbs:cluster.suburbs||[],active:cluster.active!==false,payload:deep(cluster)})),
      p_customers:(next.clients||[]).map(client=>({id:client.id,name:client.name,customer_type:client.customerType||'Private homeowner',contact_name:client.contact||'',email:client.email||'',phone:client.whatsapp||'',billing_address:client.billingAddress||'',status:['active','paused','archived'].includes(client.status)?client.status:'active',payload:deep(client)})),
      p_sites:(next.clients||[]).map(client=>({id:client.siteId||`site-${client.id}`,customer_id:client.id,site_name:client.name,address:client.address||'',suburb:client.suburb||'',cluster_id:validClusters.has(client.clusterId)?client.clusterId:null,access_notes:client.accessNotes||'',pet_notes:client.gardenNotes||'',instructions:client.serviceDescription||'',active:client.status!=='archived',payload:deep({...client,siteId:client.siteId||`site-${client.id}`})}))
    };
  }

  const invoiceTotal=inv=>(inv.lineItems||[]).reduce((sum,line)=>sum+(Number(line.qty)||0)*(Number(line.unitPrice)||0),0)*(1+(Number(inv.vatRate)||0)/100);
  function operationalSnapshotFrom(next){
    const b=backend();
    return {
      p_business_id:b.businessId,p_expected_revision:0,
      p_schedules:(next.schedules||[]).filter(j=>j.date).map(job=>({id:job.id,visit_date:job.date,client_id:job.clientId,team_id:job.teamId,status:job.status||'scheduled',estimated_hours:Number(job.estimatedHours||0),sort_order:Number(job.sort||99),payload:deep(job)})),
      p_work_records:(next.visits||[]).map(visit=>({id:visit.id,schedule_job_id:visit.scheduledJobId||null,client_id:visit.clientId,team_id:visit.teamId,work_date:visit.date,work_done:visit.workDone||[],extra_description:visit.extraDescription||'',photo_paths:visit.photoPaths||[],outcome:visit.outcome||'Completed',payload:deep(visit)})),
      p_opportunities:(next.opportunities||[]).map(item=>({id:item.id,client_id:item.clientId,schedule_job_id:item.scheduleId||null,work_record_id:item.visitId||null,team_id:item.teamId,category:item.category||'Other',note:item.note||'',photo_paths:item.photoPaths||[],status:item.status||'new',review_decision:item.reviewDecision||'new',payload:deep(item)})),
      p_quotes:(next.quotes||[]).map(q=>({id:q.id,client_id:q.clientId,quote_date:q.date||null,status:q.status||'Draft',payload:deep(q)})),
      p_invoices:(next.invoices||[]).map(inv=>({id:inv.id,client_id:inv.clientId,invoice_month:inv.month||'',invoice_number:inv.number||'Draft',status:inv.status||'Draft',total:Math.round(invoiceTotal(inv)*100)/100,payload:deep(inv)})),
      p_client_reports:[],
      p_meta:{closures:next.closures||{},catchUps:next.catchUps||[],visitActions:next.visitActions||[],clientReportStatus:next.clientReportStatus||{},clientReports:next.clientReports||[],teamDayPlans:next.teamDayPlans||{},scheduleVersions:next.scheduleVersions||[],scheduleBasket:next.scheduleBasket||[],serviceAgreements:next.serviceAgreements||[],serviceCommitments:next.serviceCommitments||[],teamCapacityProfiles:next.teamCapacityProfiles||[],capacityExceptions:next.capacityExceptions||[],capacityOverrides:next.capacityOverrides||[],fulfilmentPeriods:next.fulfilmentPeriods||[],adminLifecycleV56:next.adminLifecycleV56||{},stockOrdersV58940:next.stockOrdersV58940||[]}
    };
  }

  async function restoreShowroom(){
    if(!adminReady())return window.toast?.('Open the connected TuinBooks training demo as an owner or admin first.','error');
    if(!defaultBillingProfile())return window.toast?.('The demo Billing Profile has not finished loading yet. Wait a moment and try again.','error');
    if(!confirm('Restore the TuinBooks showroom demo?\n\nThis removes changes made inside the TRAINING DEMO only and restores the polished sample business.'))return;
    const b=backend(),button=$('resetDemoBtn');
    const original=button?.textContent||'';if(button){button.disabled=true;button.textContent='Restoring showroom…';}
    try{
      window.toast?.('Restoring the showroom demo…');
      const cleared=await b.client.rpc('reset_tuinbooks_training_demo',{p_business_id:b.businessId});
      if(cleared.error)throw cleared.error;
      b.operationalRevision=0;b.operationalDirty=false;b.operationalConflict=false;b.operationalPendingSnapshot=null;b.lastOperationalJson='';
      const next=buildShowroomState();
      const core=coreSnapshotFrom(next);
      const coreSaved=await b.client.rpc('save_core_snapshot_v53',core);
      if(coreSaved.error)throw coreSaved.error;
      b.coreRevision=Number(coreSaved.data?.revision??b.coreRevision);
      const operational=operationalSnapshotFrom(next);
      let opSaved=await b.client.rpc('save_operational_snapshot_v5604',operational);
      if(opSaved.error&&/Could not find the function|schema cache|PGRST202/i.test(String(opSaved.error?.message||opSaved.error)))opSaved=await b.client.rpc('save_operational_snapshot_v53',operational);
      if(opSaved.error)throw opSaved.error;
      try{localStorage.setItem('tuinbooks_garden_mvp_v28_supabase',JSON.stringify(next));}catch(_){ }
      localStorage.removeItem(`${TOUR_STORAGE_PREFIX}${b.businessId}`);
      window.toast?.('Showroom restored. Reloading the clean demo…');
      setTimeout(()=>location.reload(),600);
    }catch(error){
      console.error('[TuinBooks demo showroom] restore failed',error);
      window.toast?.(`Demo restore failed: ${String(error?.message||error)}`,'error');
      if(button){button.disabled=false;button.textContent=original||'Restore showroom demo';}
    }
  }

  function installResetButton(){
    const old=$('resetDemoBtn');if(!old||old.dataset.demoShowroomV6049==='1'||!isDemo())return;
    const fresh=old.cloneNode(true);fresh.dataset.demoShowroomV6049='1';fresh.textContent='Restore showroom demo';fresh.hidden=false;fresh.disabled=false;fresh.classList.remove('danger');fresh.title='Restore the populated TuinBooks training showroom';old.replaceWith(fresh);fresh.addEventListener('click',restoreShowroom);
    const note=document.createElement('div');note.className='tb-demo-restore-note-v6049';note.textContent='Training demo only: restores the polished sample clients, schedule, work, quotes and billing.';fresh.parentElement?.appendChild(note);
  }

  function bubbleTitle(step){return step?.overlayTitle||step?.title||'Next area';}
  function clearTargetBubble(){if(targetBubble){targetBubble.remove();targetBubble=null;}}
  function showTargetBubble(step,target){
    clearTargetBubble();
    if(!target)return;
    const rect=target.getBoundingClientRect();
    const bubble=document.createElement('div');
    bubble.className='tb-demo-target-bubble-v60410';
    bubble.innerHTML=`<button type="button" class="tb-demo-close-icon-v60410" aria-label="Close tip">×</button><span>Now opening</span><strong>${esc(bubbleTitle(step))}</strong><p>${esc(step.overlayCopy||'You can close this tip and keep exploring freely at any time.')}</p>`;
    document.body.appendChild(bubble);
    const width=Math.min(320,window.innerWidth-24);
    bubble.style.width=`${width}px`;
    const margin=12;
    let top=rect.top+window.scrollY-margin-bubble.offsetHeight;
    if(top<window.scrollY+12)top=rect.bottom+window.scrollY+margin;
    let left=rect.left+window.scrollX;
    left=Math.max(12,Math.min(left,window.scrollX+window.innerWidth-width-12));
    bubble.style.top=`${top}px`;
    bubble.style.left=`${left}px`;
    bubble.querySelector('.tb-demo-close-icon-v60410')?.addEventListener('click',()=>bubble.remove());
    targetBubble=bubble;
  }
  function applyDemoPhotosToState(){
    if(!isDemo()||!currentState())return;
    const visitPhotos=(currentState().visits||[]).filter(item=>String(item.outcome||'').toLowerCase()==='completed');
    visitPhotos.forEach((visit,index)=>{
      const fallback=demoPhotoUrl(DEMO_WORK_PHOTOS[index%DEMO_WORK_PHOTOS.length]);
      if(!Array.isArray(visit.photos)||!visit.photos.length)visit.photos=[fallback];
      if(!Array.isArray(visit.photoPaths))visit.photoPaths=[];
    });
    (currentState().opportunities||[]).forEach((item,index)=>{
      const linked=(currentState().visits||[]).find(row=>row.id===item.visitId);
      const fallback=(linked?.photos&&linked.photos[0])||demoPhotoUrl(DEMO_WORK_PHOTOS[(index+1)%DEMO_WORK_PHOTOS.length]);
      if(!Array.isArray(item.photos)||!item.photos.length)item.photos=[fallback];
      if(!Array.isArray(item.photoPaths))item.photoPaths=[];
    });
    try{window.saveLocalBaseV28?.();}catch(_){ }
  }

  function clearHighlight(){if(highlighted){highlighted.classList.remove('tb-demo-tour-highlight-v6049');highlighted=null;}clearTargetBubble();}
  function showView(name){try{window.showView?.(name);}catch(_){document.querySelector(`.nav-tab[data-view="${name}"]`)?.click();}}
  const steps=[
    {view:'schedule',target:()=>$('#view-schedule')||document.querySelector('.nav-tab[data-view="schedule"]'),title:'Run the week from Schedule',overlayTitle:'Schedule',overlayCopy:'This is the planning view. Close this tip anytime and keep exploring.',copy:'Two teams are already planned. Open a day to see route order, services and site instructions. Completed work stays visible, and the Schedule Basket contains both a NEW recurring client and accepted once-off work.'},
    {view:'clients',target:()=>$('#clientList')||document.querySelector('.nav-tab[data-view="clients"]'),title:'Every client in one place',overlayTitle:'Clients',overlayCopy:'This is where customer details, services and billing settings live.',copy:'This showroom has residential, body corporate, estate and commercial clients with realistic service frequencies, values, instructions and service scopes.'},
    {view:'records',target:()=>$('#workRecordCards')||document.querySelector('.nav-tab[data-view="records"]'),title:'Field work comes back to the office',overlayTitle:'Work',overlayCopy:'The office sees completed visits, notes, extras and photos here.',copy:'Completed visits appear here with the work done, team, date and extras. Demo photos are attached to the sample records so you can see the field-to-office flow. One sample visit also created an opportunity for the office to quote.'},
    {view:'quotes',target:()=>$('#quoteList')||document.querySelector('.nav-tab[data-view="quotes"]'),title:'Quotes become work',overlayTitle:'Quotes',overlayCopy:'This is where estimates are created and tracked through acceptance.',copy:'You can see a draft, a sent quote, an accepted quote waiting to be scheduled, and a completed quoted job. Open any quote to see the detail.'},
    {view:'invoices',target:()=>$('#invoiceDraftQueue')||document.querySelector('.nav-tab[data-view="invoices"]'),title:'Review before invoicing',overlayTitle:'Billing',overlayCopy:'This is where work is reviewed and turned into invoices.',copy:'Billing includes routine drafts, completed quoted work ready to invoice, and examples of previously sent and paid invoices.'},
    {view:null,target:()=>document.querySelector('.admin-header'),title:'Now see the bakkie view',overlayTitle:'Field phone',overlayCopy:'Open the mobile demo next. This tip can be closed while you continue exploring.',copy:'The field phone shows only the team’s work for the day. Open a job, tick off the work, add a note or extra and complete the visit.',mobile:true}
  ];

  function tourCard(){
    let card=$('tbDemoTourCardV6049');if(card)return card;
    card=document.createElement('aside');card.id='tbDemoTourCardV6049';card.className='tb-demo-tour-card-v6049';document.body.appendChild(card);return card;
  }
  async function renderTourStep(index){
    clearHighlight();tourIndex=Math.max(0,Math.min(steps.length-1,index));const step=steps[tourIndex];
    if(step.view){showView(step.view);await sleep(180);}
    const target=step.target?.();if(target){highlighted=target;target.classList.add('tb-demo-tour-highlight-v6049');try{target.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){}showTargetBubble(step,target);}
    const card=tourCard(),last=tourIndex===steps.length-1;
    const mobileUrl=new URL(DEMO_MOBILE_PATH,location.href).href;
    card.innerHTML=`<button type="button" class="tb-demo-close-icon-v60410" aria-label="Close tour" data-demo-exit-top>×</button><span class="tb-demo-step-v6049">Step ${tourIndex+1} of ${steps.length}</span><h3>${esc(step.title)}</h3><p>${esc(step.copy)}</p>${step.mobile?`<div class="tb-demo-mobile-box-v6049"><span>Field demo PIN</span><strong>${esc(DEMO_FIELD_PIN)}</strong><small>${esc(mobileUrl)}</small></div>`:''}<div class="tb-demo-tour-progress-v6049"><i style="width:${((tourIndex+1)/steps.length)*100}%"></i></div><div class="tb-demo-tour-nav-v6049"><button type="button" class="button secondary compact" data-demo-exit>Exit tour</button><div>${tourIndex?'<button type="button" class="button secondary compact" data-demo-back>Back</button>':''}${step.mobile?'<button type="button" class="button secondary compact" data-demo-mobile>Open field phone</button>':''}<button type="button" class="button compact" data-demo-next>${last?'Finish':'Next'}</button></div></div>`;
    card.querySelector('[data-demo-exit]').onclick=endTour;card.querySelector('[data-demo-exit-top]')?.addEventListener('click',endTour);card.querySelector('[data-demo-back]')?.addEventListener('click',()=>renderTourStep(tourIndex-1));
    card.querySelector('[data-demo-mobile]')?.addEventListener('click',()=>window.open(mobileUrl,'_blank','noopener'));
    card.querySelector('[data-demo-next]').onclick=()=>last?endTour(true):renderTourStep(tourIndex+1);
  }
  function endTour(done=false){clearHighlight();$('tbDemoTourCardV6049')?.remove();tourIndex=-1;if(done){try{localStorage.setItem(`${TOUR_STORAGE_PREFIX}${backend()?.businessId||'demo'}`,'done');}catch(_){ }window.toast?.('Tour complete. You can now explore the demo freely.');}}
  function startTour(){document.querySelector('.tb-demo-welcome-backdrop-v6049')?.remove();renderTourStep(0);}

  function showWelcome(force=false){
    if(!isDemo()||!currentState()?.business?.demoShowroomVersion)return;
    const key=`${TOUR_STORAGE_PREFIX}${backend()?.businessId||'demo'}`;
    if(!force){try{if(localStorage.getItem(key)==='done')return;}catch(_){ }}
    if(document.querySelector('.tb-demo-welcome-backdrop-v6049'))return;
    const backdrop=document.createElement('div');backdrop.className='tb-demo-welcome-backdrop-v6049';
    backdrop.innerHTML=`<section class="tb-demo-welcome-v6049"><button type="button" class="tb-demo-close-icon-v60410" aria-label="Close welcome" data-demo-close>×</button><img class="tb-demo-logo-v6049" src="tuinbooks-logo.png" alt="TuinBooks"><span class="tb-demo-badge-v6049">Training showroom</span><h2>Welcome to the TuinBooks demo</h2><p>This is a populated garden-service business built for you to explore. Nothing here is real client information, so click around and try things.</p><div class="tb-demo-welcome-points-v6049"><div><strong>2 teams</strong><span>Realistic weekly schedule</span></div><div><strong>30 clients</strong><span>Routine + commercial mix</span></div><div><strong>Live flow</strong><span>Work → quotes → billing</span></div></div><div class="tb-demo-actions-v6049"><button type="button" class="button secondary" data-demo-explore>Explore myself</button><button type="button" class="button" data-demo-start>Start 3-minute tour</button></div></section>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-demo-start]').onclick=startTour;
    backdrop.querySelector('[data-demo-explore]').onclick=()=>{try{localStorage.setItem(key,'done');}catch(_){ }backdrop.remove();};
    backdrop.querySelector('[data-demo-close]')?.addEventListener('click',()=>backdrop.remove());
  }

  function installHeaderControls(){
    if(!isDemo()||document.querySelector('.tb-demo-tour-btn-v6049'))return;
    const host=document.querySelector('.header-actions');if(!host)return;
    const badge=document.createElement('span');badge.className='tb-demo-badge-v6049';badge.textContent='Demo';
    const button=document.createElement('button');button.type='button';button.className='button secondary compact tb-demo-tour-btn-v6049';button.textContent='Guided tour';button.addEventListener('click',()=>showWelcome(true));
    host.prepend(button);host.prepend(badge);
  }

  function installWhenReady(){
    let tries=0;const timer=setInterval(()=>{
      tries+=1;
      if(isDemo()&&backend()?.businessId){
        clearInterval(timer);installResetButton();installHeaderControls();applyDemoPhotosToState();setTimeout(()=>showWelcome(false),500);
      }else if(tries>80)clearInterval(timer);
    },250);
  }

  window.installTuinBooksDemoShowroomV6049=restoreShowroom;
  window.__tuinbooksDemoShowroomV6049={build:BUILD,restore:restoreShowroom,startTour,buildState:buildShowroomState,isDemo};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installWhenReady,{once:true});else installWhenReady();
  window.addEventListener('tuinbooks:runtime-ready',()=>setTimeout(()=>{installResetButton();installHeaderControls();applyDemoPhotosToState();showWelcome(false);},120));
})();
