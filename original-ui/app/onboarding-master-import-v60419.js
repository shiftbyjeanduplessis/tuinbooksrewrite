/* ========================================================================== 
   TuinBooks v60.4.19 — Onboarding Master Workbook Import
   --------------------------------------------------------------------------
   Imports the linked TuinBooks onboarding .xlsx as one business snapshot:
   START + CLIENTS + SCHEDULE + TEAMS, plus BILLING + ITEM CODES when the
   selected trial is Planning + Financial.

   The workbook is parsed locally in the browser. No CDN or third-party XLSX
   dependency is used. Nothing is written until the office reviews the preview
   and explicitly confirms Import.
   ========================================================================== */
(()=>{
  const BUILD='60.4.19-onboarding-master-import';
  const REQUIRED_CORE_SHEETS=['START','CLIENTS','SCHEDULE','TEAMS'];
  const FINANCIAL_SHEETS=['BILLING','ITEM CODES'];
  const IMPORT_HORIZON_WEEKS=8;
  const decoder=new TextDecoder('utf-8');

  /* ---------- tiny XLSX reader (ZIP + worksheet XML) ---------- */
  function u16V60419(v,o){return v[o]|(v[o+1]<<8);}
  function u32V60419(v,o){return (v[o]|(v[o+1]<<8)|(v[o+2]<<16)|(v[o+3]<<24))>>>0;}
  async function unzipV60419(buffer){
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
    let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-66000);i--){if(u32V60419(bytes,i)===0x06054b50){eocd=i;break;}}
    if(eocd<0)throw new Error('This is not a readable .xlsx workbook.');
    const total=u16V60419(bytes,eocd+10),centralOffset=u32V60419(bytes,eocd+16),files=new Map();
    let pointer=centralOffset;
    for(let index=0;index<total;index++){
      if(u32V60419(bytes,pointer)!==0x02014b50)throw new Error('The workbook ZIP directory is damaged.');
      const method=u16V60419(bytes,pointer+10),compressedSize=u32V60419(bytes,pointer+20),nameLength=u16V60419(bytes,pointer+28),extraLength=u16V60419(bytes,pointer+30),commentLength=u16V60419(bytes,pointer+32),localOffset=u32V60419(bytes,pointer+42);
      const name=decoder.decode(bytes.slice(pointer+46,pointer+46+nameLength)).replace(/^\//,'');
      if(u32V60419(bytes,localOffset)!==0x04034b50)throw new Error(`The workbook entry ${name} is damaged.`);
      const localNameLength=u16V60419(bytes,localOffset+26),localExtraLength=u16V60419(bytes,localOffset+28),dataStart=localOffset+30+localNameLength+localExtraLength;
      const compressed=bytes.slice(dataStart,dataStart+compressedSize);
      let unpacked;
      if(method===0)unpacked=compressed;
      else if(method===8){
        if(typeof DecompressionStream!=='function')throw new Error('This browser cannot read .xlsx files directly. Open TuinBooks in a current version of Edge or Chrome.');
        const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        unpacked=new Uint8Array(await new Response(stream).arrayBuffer());
      }else throw new Error(`Unsupported workbook compression method (${method}).`);
      files.set(name,unpacked);
      pointer+=46+nameLength+extraLength+commentLength;
    }
    return files;
  }
  function xmlV60419(bytes){return decoder.decode(bytes||new Uint8Array());}
  function decodeXmlV60419(text=''){
    return String(text).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')
      .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)));
  }
  function xmlAttrV60419(attrs,name){const match=String(attrs).match(new RegExp('(?:^|\\s)'+name.replace(':','\\:')+'="([^"]*)"'));return match?decodeXmlV60419(match[1]):'';}
  function sharedStringsV60419(source){
    const rows=[];
    for(const match of String(source).matchAll(/<(?:[A-Za-z0-9_]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?si>/g)){
      let text='';for(const part of match[1].matchAll(/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g))text+=decodeXmlV60419(part[1]);rows.push(text);
    }
    return rows;
  }
  function columnIndexV60419(ref){const match=String(ref||'').match(/^([A-Z]+)/i);if(!match)return 0;let out=0;for(const char of match[1].toUpperCase())out=out*26+char.charCodeAt(0)-64;return out-1;}
  function worksheetRowsV60419(source,shared){
    const rows=[];
    for(const rowMatch of String(source).matchAll(/<(?:[A-Za-z0-9_]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?row>/g)){
      const rowNumber=Number(xmlAttrV60419(rowMatch[1],'r'))||rows.length+1,row=[];
      for(const cellMatch of rowMatch[2].matchAll(/<(?:[A-Za-z0-9_]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?c>/g)){
        const ref=xmlAttrV60419(cellMatch[1],'r'),type=xmlAttrV60419(cellMatch[1],'t'),col=columnIndexV60419(ref),body=cellMatch[2];let value='';
        if(type==='inlineStr'){
          for(const part of body.matchAll(/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g))value+=decodeXmlV60419(part[1]);
        }else{
          const valueMatch=body.match(/<(?:[A-Za-z0-9_]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?v>/),raw=valueMatch?decodeXmlV60419(valueMatch[1]):'';
          if(type==='s')value=shared[Number(raw)]??'';else if(type==='b')value=raw==='1';else if(type==='str')value=raw;else value=raw!==''&&!Number.isNaN(Number(raw))?Number(raw):raw;
        }
        row[col]=value;
      }
      row._row=rowNumber;rows[rowNumber-1]=row;
    }
    return rows;
  }
  async function parseXlsxV60419(fileOrBuffer){
    const buffer=fileOrBuffer instanceof ArrayBuffer?fileOrBuffer:await fileOrBuffer.arrayBuffer(),files=await unzipV60419(buffer);
    if(!files.has('xl/workbook.xml'))throw new Error('The selected file is not an Excel .xlsx workbook.');
    const workbookXml=xmlV60419(files.get('xl/workbook.xml')),relsXml=xmlV60419(files.get('xl/_rels/workbook.xml.rels'));
    const shared=files.has('xl/sharedStrings.xml')?sharedStringsV60419(xmlV60419(files.get('xl/sharedStrings.xml'))):[],relationships={};
    for(const match of relsXml.matchAll(/<(?:[A-Za-z0-9_]+:)?Relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?Relationship>)/g))relationships[xmlAttrV60419(match[1],'Id')]=xmlAttrV60419(match[1],'Target');
    const sheets={};
    for(const match of workbookXml.matchAll(/<(?:[A-Za-z0-9_]+:)?sheet\b([^>]*?)\/?\s*>/g)){
      const name=xmlAttrV60419(match[1],'name'),relationship=xmlAttrV60419(match[1],'r:id'),target=relationships[relationship];if(!name||!target)continue;
      let path=target.replace(/^\//,'');if(!path.startsWith('xl/'))path=`xl/${path.replace(/^\.\//,'')}`;
      if(files.has(path))sheets[name]=worksheetRowsV60419(xmlV60419(files.get(path)),shared);
    }
    return {sheets,fileName:fileOrBuffer?.name||''};
  }

  const publicParser={build:BUILD,parseXlsxV60419,worksheetRowsV60419};

  /* ---------- workbook model + validation ---------- */
  const cleanV60419=value=>String(value??'').trim();
  const keyV60419=value=>cleanV60419(value).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
  const htmlV60419=value=>cleanV60419(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function yesNoV60419(value){const text=keyV60419(value);if(['yes','y','true','1','active'].includes(text))return true;if(['no','n','false','0','inactive'].includes(text))return false;return null;}
  function excelDateV60419(value){
    if(typeof value==='number'&&value>1000&&value<100000){const date=new Date(Date.UTC(1899,11,30)+Math.round(value*86400000));return date.toISOString().slice(0,10);}
    const text=cleanV60419(value);if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
    if(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(text)){const [d,m,y]=text.split(/[\/-]/).map(Number);const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d)return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
    return '';
  }
  function headerObjectsV60419(rows){
    const header=(rows||[]).find(row=>Array.isArray(row)&&row.some(cell=>cleanV60419(cell)))||[],headerIndex=(rows||[]).indexOf(header),names=header.map(cleanV60419);
    return (rows||[]).slice(headerIndex+1).map((row,index)=>{const object={_row:Number(row?._row)||headerIndex+index+2};names.forEach((name,col)=>{if(name)object[name]=row?.[col]??'';});return object;});
  }
  function rowGetV60419(row,...names){for(const name of names){if(Object.prototype.hasOwnProperty.call(row,name))return row[name];const wanted=keyV60419(name),found=Object.keys(row).find(key=>keyV60419(key)===wanted);if(found)return row[found];}return '';}
  function startMapV60419(rows){const out={};(rows||[]).forEach(row=>{const key=keyV60419(row?.[0]);if(key)out[key]=row?.[1]??'';});return out;}
  function startValueV60419(start,label){return start[keyV60419(label)]??'';}
  function meaningfulClientV60419(row){return [rowGetV60419(row,'Client / Site Name'),rowGetV60419(row,'Contact Name'),rowGetV60419(row,'Mobile'),rowGetV60419(row,'Street Address')].some(value=>cleanV60419(value));}
  function meaningfulTeamV60419(row){return [rowGetV60419(row,'Team Name'),rowGetV60419(row,'Team Lead'),rowGetV60419(row,'Mobile / Device User'),rowGetV60419(row,'Access Type')].some(value=>cleanV60419(value));}
  function meaningfulScheduleV60419(row){return [rowGetV60419(row,'Client ID'),rowGetV60419(row,'Team ID'),rowGetV60419(row,'Frequency'),rowGetV60419(row,'Recurrence Anchor / Next Service Date')].some(value=>cleanV60419(value));}
  function meaningfulBillingV60419(row){return cleanV60419(rowGetV60419(row,'Client ID'))!=='';}
  function meaningfulItemV60419(row){const code=cleanV60419(rowGetV60419(row,'Item / Service Code'));return code!==''&&keyV60419(code)!=='not required';}
  function dayV60419(value,date=''){
    const text=cleanV60419(value),match=(typeof DAYS!=='undefined'?DAYS:[]).find(day=>keyV60419(day)===keyV60419(text));
    if(match)return match;
    if(date&&typeof dayName==='function'){const derived=dayName(date);return (typeof DAYS!=='undefined'&&DAYS.includes(derived))?derived:'';}
    return '';
  }
  function trialTypeV60419(value){const text=keyV60419(value);if(text==='planning only')return 'Planning only';if(text.includes('planning')&&text.includes('financial'))return 'Planning + Financial';return '';}
  function clientKindV60419(value){const text=keyV60419(value);if(text==='routine')return 'Routine';if(text.includes('once'))return 'Once-off';if(text==='both')return 'Both';return '';}
  function frequencyV60419(value){const text=keyV60419(value);if(text.includes('fortnight'))return 'Fortnightly';if(text==='weekly'||text.includes('every week'))return 'Weekly';if(text.includes('month'))return 'Monthly';if(text.includes('ad hoc'))return 'Ad hoc';if(text.includes('season'))return 'Seasonal';if(text.includes('custom'))return 'Custom';return cleanV60419(value);}
  function scopeTasksV60419(value){return cleanV60419(value).split(/\n|;|\u2022/g).map(text=>text.trim()).filter(Boolean);}
  function moneyNumberV60419(value){if(typeof value==='number')return Number.isFinite(value)?value:NaN;const text=cleanV60419(value).replace(/\s/g,'').replace(/^R/i,'').replace(/,/g,'');return text===''?NaN:Number(text);}
  function currentProfileMatchV60419(value){
    const text=keyV60419(value);if(!text)return null;
    const profiles=typeof billingProfileRowsV59396==='function'?billingProfileRowsV59396():(typeof state!=='undefined'&&Array.isArray(state.billingProfilesV59396)?state.billingProfilesV59396:[]);
    if(['default','main','business default','default profile'].includes(text))return typeof defaultBillingProfileV59396==='function'?defaultBillingProfileV59396():profiles.find(profile=>profile.isDefault)||profiles[0]||null;
    return profiles.find(profile=>[profile.displayName,profile.legalName,profile.tradingName,...(profile.aliases||[])].some(name=>keyV60419(name)===text))||null;
  }
  function businessNameCompatibleV60419(workbookName,currentName){
    const a=keyV60419(workbookName),b=keyV60419(currentName);if(!a||!b||a===b||a.includes(b)||b.includes(a))return true;
    const A=new Set(a.split(' ').filter(x=>x.length>2)),B=new Set(b.split(' ').filter(x=>x.length>2)),intersection=[...A].filter(x=>B.has(x)).length,denominator=Math.max(1,Math.min(A.size,B.size));return intersection/denominator>=0.6;
  }
  function modelV60419(parsed){
    const sheetLookup={};Object.entries(parsed.sheets||{}).forEach(([name,rows])=>sheetLookup[keyV60419(name).toUpperCase()]=rows);
    const sheet=name=>sheetLookup[keyV60419(name).toUpperCase()]||null;
    const issues=[],warnings=[];
    REQUIRED_CORE_SHEETS.forEach(name=>{if(!sheet(name))issues.push(`Missing required worksheet: ${name}.`);});
    if(issues.length)return {issues,warnings,counts:{},parsed};
    const start=startMapV60419(sheet('START')),trial=trialTypeV60419(startValueV60419(start,'Trial type')),financial=trial==='Planning + Financial',businessName=cleanV60419(startValueV60419(start,'Business name'));
    if(!trial)issues.push('START: choose Trial type as Planning only or Planning + Financial.');
    if(!businessName)issues.push('START: Business name is required.');
    const currentName=cleanV60419(typeof state!=='undefined'?state?.business?.name:'');if(businessName&&currentName&&!businessNameCompatibleV60419(businessName,currentName))issues.push(`This workbook is for “${businessName}”, but the open TuinBooks account is “${currentName}”. Open the correct account or correct START → Business name.`);
    if(financial)FINANCIAL_SHEETS.forEach(name=>{if(!sheet(name))issues.push(`Planning + Financial requires worksheet: ${name}.`);});

    const clients=(sheet('CLIENTS')?headerObjectsV60419(sheet('CLIENTS')):[]).filter(meaningfulClientV60419);
    const teams=(sheet('TEAMS')?headerObjectsV60419(sheet('TEAMS')):[]).filter(meaningfulTeamV60419);
    const schedules=(sheet('SCHEDULE')?headerObjectsV60419(sheet('SCHEDULE')):[]).filter(meaningfulScheduleV60419);
    const billing=(sheet('BILLING')?headerObjectsV60419(sheet('BILLING')):[]).filter(meaningfulBillingV60419);
    const items=(sheet('ITEM CODES')?headerObjectsV60419(sheet('ITEM CODES')):[]).filter(meaningfulItemV60419);
    if(!clients.length)issues.push('CLIENTS: no client rows are completed.');
    if(!teams.length)issues.push('TEAMS: no team rows are completed.');
    if(!schedules.length)issues.push('SCHEDULE: no routine schedule rows are completed.');

    const clientIds=new Map(),teamIds=new Map(),scheduleByClient=new Map(),billingByClient=new Map(),itemCodes=new Map();
    clients.forEach(row=>{
      const id=cleanV60419(rowGetV60419(row,'Client ID')),name=cleanV60419(rowGetV60419(row,'Client / Site Name')),mobile=cleanV60419(rowGetV60419(row,'Mobile')),address=cleanV60419(rowGetV60419(row,'Street Address')),suburb=cleanV60419(rowGetV60419(row,'Suburb / Area')),type=clientKindV60419(rowGetV60419(row,'Client Type')),active=yesNoV60419(rowGetV60419(row,'Active'));
      const prefix=`CLIENTS row ${row._row}`;
      if(!id)issues.push(`${prefix}: Client ID is required.`);else if(clientIds.has(keyV60419(id)))issues.push(`${prefix}: duplicate Client ID ${id}.`);else clientIds.set(keyV60419(id),row);
      if(!name)issues.push(`${prefix}: Client / Site Name is required.`);
      if(!mobile)issues.push(`${prefix}: Mobile is required.`);
      if(!address||!suburb)issues.push(`${prefix}: Street Address and Suburb / Area are required.`);
      if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
      if(!type)issues.push(`${prefix}: Client Type must be Routine, Once-off or Both.`);
      if(!cleanV60419(rowGetV60419(row,'Email')))warnings.push(`${prefix}: no email address.`);
    });
    teams.forEach(row=>{
      const id=cleanV60419(rowGetV60419(row,'Team ID')),name=cleanV60419(rowGetV60419(row,'Team Name')),deviceUser=cleanV60419(rowGetV60419(row,'Mobile / Device User')),access=cleanV60419(rowGetV60419(row,'Access Type')),active=yesNoV60419(rowGetV60419(row,'Active')),prefix=`TEAMS row ${row._row}`;
      if(!id)issues.push(`${prefix}: Team ID is required.`);else if(teamIds.has(keyV60419(id)))issues.push(`${prefix}: duplicate Team ID ${id}.`);else teamIds.set(keyV60419(id),row);
      if(!name)issues.push(`${prefix}: Team Name is required.`);
      if(!deviceUser)issues.push(`${prefix}: Mobile / Device User is required.`);
      if(!access)issues.push(`${prefix}: Access Type is required.`);
      if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
    });
    schedules.forEach(row=>{
      const id=cleanV60419(rowGetV60419(row,'Schedule ID')),clientId=cleanV60419(rowGetV60419(row,'Client ID')),teamId=cleanV60419(rowGetV60419(row,'Team ID')),frequency=frequencyV60419(rowGetV60419(row,'Frequency')),anchor=excelDateV60419(rowGetV60419(row,'Recurrence Anchor / Next Service Date')),preferred=dayV60419(rowGetV60419(row,'Preferred Day'),anchor),scope=cleanV60419(rowGetV60419(row,'Service Scope / Tasks')),active=yesNoV60419(rowGetV60419(row,'Active')),prefix=`SCHEDULE row ${row._row}`;
      if(!id)issues.push(`${prefix}: Schedule ID is required.`);
      if(!clientId||!clientIds.has(keyV60419(clientId)))issues.push(`${prefix}: Client ID ${clientId||'(blank)'} does not link to CLIENTS.`);
      if(!teamId||!teamIds.has(keyV60419(teamId)))issues.push(`${prefix}: Team ID ${teamId||'(blank)'} does not link to TEAMS.`);
      if(!['Weekly','Fortnightly','Monthly'].includes(frequency))issues.push(`${prefix}: Frequency must be Weekly, Fortnightly or Monthly for routine scheduling.`);
      if(!anchor)issues.push(`${prefix}: Recurrence Anchor / Next Service Date must be a valid date.`);
      if(!preferred)issues.push(`${prefix}: Preferred Day must be Monday to Saturday.`);
      if(!scope)issues.push(`${prefix}: Service Scope / Tasks is required so the field team knows what to do.`);
      if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
      if(clientId){const key=keyV60419(clientId),existing=scheduleByClient.get(key)||[];existing.push(row);scheduleByClient.set(key,existing);}
      const clientRow=clientIds.get(keyV60419(clientId));if(clientRow&&clientKindV60419(rowGetV60419(clientRow,'Client Type'))==='Once-off')issues.push(`${prefix}: ${clientId} is marked Once-off in CLIENTS and cannot have a routine schedule.`);if(active===true&&clientRow&&yesNoV60419(rowGetV60419(clientRow,'Active'))===false)issues.push(`${prefix}: ${clientId} is inactive but has an active schedule.`);
      const teamRow=teamIds.get(keyV60419(teamId));if(active===true&&teamRow&&yesNoV60419(rowGetV60419(teamRow,'Active'))===false)issues.push(`${prefix}: ${teamId} is inactive but has an active schedule.`);
    });
    clients.forEach(row=>{
      const id=cleanV60419(rowGetV60419(row,'Client ID')),type=clientKindV60419(rowGetV60419(row,'Client Type')),active=yesNoV60419(rowGetV60419(row,'Active')),rows=(scheduleByClient.get(keyV60419(id))||[]).filter(schedule=>yesNoV60419(rowGetV60419(schedule,'Active'))!==false);
      if(active===true&&type!=='Once-off'&&!rows.length)issues.push(`CLIENTS row ${row._row}: ${id} is ${type||'routine'} but has no active linked SCHEDULE row.`);
      if(rows.length>1)issues.push(`CLIENTS row ${row._row}: ${id} has ${rows.length} active routine schedule rows. This importer supports one recurring pattern per client; combine or correct the schedule rows first.`);
    });

    if(financial&&sheet('BILLING')){
      billing.forEach(row=>{
        const clientId=cleanV60419(rowGetV60419(row,'Client ID')),profileName=cleanV60419(rowGetV60419(row,'Billing Profile / Entity')),fee=moneyNumberV60419(rowGetV60419(row,'Routine Fee')),basis=cleanV60419(rowGetV60419(row,'Fee Basis')),cycle=cleanV60419(rowGetV60419(row,'Invoice Cycle')),sendDay=cleanV60419(rowGetV60419(row,'Invoice Send Day')),vat=cleanV60419(rowGetV60419(row,'VAT Treatment')),prefix=`BILLING row ${row._row}`;
        if(!clientId||!clientIds.has(keyV60419(clientId)))issues.push(`${prefix}: Client ID ${clientId||'(blank)'} does not link to CLIENTS.`);else if(billingByClient.has(keyV60419(clientId)))issues.push(`${prefix}: duplicate billing row for ${clientId}.`);else billingByClient.set(keyV60419(clientId),row);
        if(!profileName)issues.push(`${prefix}: Billing Profile / Entity is required.`);else if(!currentProfileMatchV60419(profileName))issues.push(`${prefix}: Billing Profile / Entity “${profileName}” does not exist in this TuinBooks account.`);
        if(!Number.isFinite(fee)||fee<0)issues.push(`${prefix}: Routine Fee must be a valid amount.`);
        if(!['per visit','weekly','fortnightly','monthly fixed'].includes(keyV60419(basis)))issues.push(`${prefix}: Fee Basis must be Per Visit, Weekly, Fortnightly or Monthly Fixed.`);
        if(!cycle)issues.push(`${prefix}: Invoice Cycle is required.`);
        if(!sendDay)issues.push(`${prefix}: Invoice Send Day is required.`);
        if(!['no vat','vat inclusive','vat exclusive'].includes(keyV60419(vat)))issues.push(`${prefix}: VAT Treatment is required.`);
      });
      clients.forEach(row=>{
        const id=cleanV60419(rowGetV60419(row,'Client ID')),type=clientKindV60419(rowGetV60419(row,'Client Type')),active=yesNoV60419(rowGetV60419(row,'Active'));
        if(active===true&&type!=='Once-off'&&!billingByClient.has(keyV60419(id)))issues.push(`BILLING: active routine client ${id} has no billing row.`);
      });
      const usesCodes=yesNoV60419(startValueV60419(start,'Uses item/service codes in accounting system'));
      if(usesCodes===true&&!items.length)issues.push('ITEM CODES: START says the business uses accounting item/service codes, but no item codes were entered.');
      items.forEach(row=>{
        const code=cleanV60419(rowGetV60419(row,'Item / Service Code')),description=cleanV60419(rowGetV60419(row,'Description')),unit=cleanV60419(rowGetV60419(row,'Unit')),price=moneyNumberV60419(rowGetV60419(row,'Default Selling Price')),vat=cleanV60419(rowGetV60419(row,'VAT Treatment')),active=yesNoV60419(rowGetV60419(row,'Active')),prefix=`ITEM CODES row ${row._row}`;
        if(!code)issues.push(`${prefix}: Item / Service Code is required.`);else if(itemCodes.has(keyV60419(code)))issues.push(`${prefix}: duplicate code ${code}.`);else itemCodes.set(keyV60419(code),row);
        if(!description)issues.push(`${prefix}: Description is required.`);if(!unit)issues.push(`${prefix}: Unit is required.`);if(!Number.isFinite(price)||price<0)issues.push(`${prefix}: Default Selling Price must be a valid amount.`);if(!vat)issues.push(`${prefix}: VAT Treatment is required.`);if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
      });
    }
    const expectedTeams=Number(startValueV60419(start,'Number of active teams')),actualActiveTeams=teams.filter(row=>yesNoV60419(rowGetV60419(row,'Active'))===true).length;
    if(Number.isFinite(expectedTeams)&&expectedTeams>0&&expectedTeams!==actualActiveTeams)warnings.push(`START says ${expectedTeams} active team${expectedTeams===1?'':'s'}, while TEAMS contains ${actualActiveTeams}.`);
    if(yesNoV60419(startValueV60419(start,'VAT registered'))===true&&!cleanV60419(startValueV60419(start,'VAT number')))warnings.push('START: VAT registered is Yes but VAT number is blank.');
    if(!financial)warnings.push('Planning-only trial: BILLING and ITEM CODES will not be imported or changed.');
    if(financial&&!items.length&&yesNoV60419(startValueV60419(start,'Uses item/service codes in accounting system'))!==true)warnings.push('No item codes entered; that is allowed because the business is not marked as using accounting item/service codes.');
    warnings.push('Existing TuinBooks records that are not in this workbook are kept; this import updates/matches records rather than deleting history.');
    warnings.push('Team mobile/device users are captured as setup information; this import does not create authentication logins.');
    return {parsed,start,trial,financial,businessName,clients,teams,schedules,billing,items,issues:[...new Set(issues)],warnings:[...new Set(warnings)],counts:{clients:clients.length,teams:teams.length,schedules:schedules.filter(row=>yesNoV60419(rowGetV60419(row,'Active'))!==false).length,billing:financial?billing.length:0,items:financial?items.length:0}};
  }

  if(typeof window==='undefined'||typeof document==='undefined'){
    globalThis.__tuinbooksOnboardingMasterImportV60419={...publicParser,modelV60419};
    return;
  }

  /* ---------- merge into TuinBooks state ---------- */
  function workspaceWriteReadyV60419(){
    try{
      if(typeof backendV28==='undefined')return true;
      const params=new URLSearchParams(location.search),management=params.get('support')==='1'&&!!params.get('business');
      if(management){
        if(backendV28.managementCoreReadyV5950===false)return false;
        const operationalRequired=backendV28.managementOperationalLoadRequiredV59371===true;
        const operationalReady=backendV28.managementOperationalReadyV5950===true||backendV28.managementOperationalReadyV59371===true;
        if(operationalRequired&&!operationalReady)return false;
      }
      if(backendV28.coreConflict||backendV28.operationalConflict)return false;
      return true;
    }catch(_){return true;}
  }
  function workspaceWriteIssueV60419(){
    try{if(typeof backendV28!=='undefined'&&(backendV28.coreConflict||backendV28.operationalConflict))return 'This workspace has a cloud-save conflict. Reload the account before importing.';}catch(_){ }
    return 'This Management workspace is still loading its current clients, schedule or work history. Wait for it to finish loading before importing.';
  }
  function safeImportIdV60419(value,prefix){const text=cleanV60419(value).replace(/[^A-Za-z0-9._:-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');return text||`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}
  function disposablePlaceholderTeamV60419(team){if(!team||!/^team\s*1$/i.test(cleanV60419(team.name)))return false;return !(state.schedules||[]).some(job=>job.teamId===team.id)&&!(state.visits||[]).some(visit=>visit.teamId===team.id);}
  function teamMatchV60419(row,index,claimed){
    const workbookId=cleanV60419(rowGetV60419(row,'Team ID')),name=cleanV60419(rowGetV60419(row,'Team Name'));
    let team=(state.teams||[]).find(item=>String(item.id)===workbookId&&!claimed.has(item.id));
    if(!team)team=(state.teams||[]).find(item=>keyV60419(item.name)===keyV60419(name)&&!claimed.has(item.id));
    if(!team&&index===0){const candidates=(state.teams||[]).filter(item=>!claimed.has(item.id)&&disposablePlaceholderTeamV60419(item));if(candidates.length===1)team=candidates[0];}
    return team||null;
  }
  function clientMatchV60419(row,claimed){
    const workbookId=cleanV60419(rowGetV60419(row,'Client ID')),name=keyV60419(rowGetV60419(row,'Client / Site Name')),address=keyV60419(rowGetV60419(row,'Street Address'));
    let client=(state.clients||[]).find(item=>String(item.id)===workbookId&&!claimed.has(item.id));
    if(!client)client=(state.clients||[]).find(item=>!claimed.has(item.id)&&[item.accountReference,item.customerReference,item.onboardingClientIdV60419].some(ref=>cleanV60419(ref)===workbookId));
    if(!client&&name&&address)client=(state.clients||[]).find(item=>!claimed.has(item.id)&&keyV60419(item.name)===name&&keyV60419(item.address)===address);
    return client||null;
  }
  function invoiceCycleFromMasterV60419(cycle,sendDay,basis){
    const b=keyV60419(basis),c=keyV60419(cycle),day=Number(String(sendDay||'').match(/\d{1,2}/)?.[0]||0);
    if(['per visit','weekly','fortnightly'].includes(b))return {mode:'on_completion',day:'',raw:cleanV60419(cycle),sendDay:cleanV60419(sendDay)};
    if(b==='monthly fixed'&&c.includes('month')&&day>=1&&day<=31)return {mode:'custom_monthly',day:String(day),raw:cleanV60419(cycle),sendDay:cleanV60419(sendDay)};
    return {mode:'business_default',day:'',raw:cleanV60419(cycle),sendDay:cleanV60419(sendDay)};
  }
  function applyBusinessV60419(model,fileName){
    state.business=state.business||{};state.onboarding=state.onboarding||{};
    const value=label=>cleanV60419(startValueV60419(model.start,label));
    state.business.name=model.businessName||state.business.name;
    state.business.phone=value('Phone')||state.business.phone||'';state.business.email=value('Email')||state.business.email||'';
    state.business.ownerMainContactV60419=value('Owner / main contact');state.business.townAreaV60419=value('Town / area');state.business.accountingSystemV60419=value('Current accounting system');state.business.usesItemServiceCodesV60419=yesNoV60419(value('Uses item/service codes in accounting system'))===true;state.business.onboardingNotesV60419=value('Notes');
    const vat=yesNoV60419(value('VAT registered'));if(vat!==null)state.business.vatRegistered=vat?'yes':'no';if(value('VAT number'))state.business.vatNumber=value('VAT number');
    state.onboarding={...state.onboarding,trialTypeV60419:model.trial,businessNameV60419:model.businessName,ownerMainContactV60419:value('Owner / main contact'),phoneV60419:value('Phone'),emailV60419:value('Email'),townAreaV60419:value('Town / area'),activeTeamCountV60419:Number(value('Number of active teams'))||model.teams.filter(row=>yesNoV60419(rowGetV60419(row,'Active'))===true).length,accountingSystemV60419:value('Current accounting system'),usesItemServiceCodesV60419:yesNoV60419(value('Uses item/service codes in accounting system'))===true,notesV60419:value('Notes')};
    state.business.onboardingMasterImportV60419={build:BUILD,fileName:fileName||model.parsed?.fileName||'',trialType:model.trial,importedAt:new Date().toISOString(),clients:model.counts.clients,teams:model.counts.teams,schedules:model.counts.schedules,billing:model.counts.billing,items:model.counts.items};
  }
  function applyTeamsV60419(model){
    state.teams=Array.isArray(state.teams)?state.teams:[];const map=new Map(),claimed=new Set(),now=new Date().toISOString();
    model.teams.forEach((row,index)=>{
      const workbookId=cleanV60419(rowGetV60419(row,'Team ID')),name=cleanV60419(rowGetV60419(row,'Team Name')),active=yesNoV60419(rowGetV60419(row,'Active'))===true;
      let team=teamMatchV60419(row,index,claimed);
      if(!team){let id=safeImportIdV60419(workbookId,'team');if(state.teams.some(item=>item.id===id))id=typeof uid==='function'?uid('team'):`team-${Date.now()}-${index}`;team={id,capacityHours:8,bufferHours:0,dailySiteCapacity:0,createdAt:now};state.teams.push(team);}
      Object.assign(team,{name,leaderName:cleanV60419(rowGetV60419(row,'Team Lead')),mobileDeviceUserV60419:cleanV60419(rowGetV60419(row,'Mobile / Device User')),mobileNumberV60419:cleanV60419(rowGetV60419(row,'Mobile Number')),accessTypeV60419:cleanV60419(rowGetV60419(row,'Access Type')),vehicleIdentifierV60419:cleanV60419(rowGetV60419(row,'Vehicle / Identifier')),notes:cleanV60419(rowGetV60419(row,'Notes')),active,onboardingTeamIdV60419:workbookId,updatedAt:now});
      claimed.add(team.id);map.set(keyV60419(workbookId),team.id);
    });
    return map;
  }
  function applyClientsV60419(model){
    state.clients=Array.isArray(state.clients)?state.clients:[];const map=new Map(),claimed=new Set(),now=new Date().toISOString();
    model.clients.forEach((row,index)=>{
      const workbookId=cleanV60419(rowGetV60419(row,'Client ID')),name=cleanV60419(rowGetV60419(row,'Client / Site Name')),type=clientKindV60419(rowGetV60419(row,'Client Type')),active=yesNoV60419(rowGetV60419(row,'Active'))===true;
      let client=clientMatchV60419(row,claimed);
      if(!client){let id=safeImportIdV60419(workbookId,'client');if(state.clients.some(item=>item.id===id))id=typeof uid==='function'?uid('client'):`client-${Date.now()}-${index}`;client={id,siteId:`site-${id}`,createdAt:now,customerType:'Not classified',clientTypeId:'Not classified',monthlyFee:0,rateAmount:0,estimatedHours:0,workTypeIds:[],serviceIds:[],customTasks:'',serviceDescription:'',gardenNotes:'',billingNotes:'',communicationPreference:'WhatsApp',completionReport:'yes',marketingAllowed:false};state.clients.push(client);}
      const onceOff=type==='Once-off';
      Object.assign(client,{name,contact:cleanV60419(rowGetV60419(row,'Contact Name')),whatsapp:cleanV60419(rowGetV60419(row,'Mobile')),email:cleanV60419(rowGetV60419(row,'Email')),address:cleanV60419(rowGetV60419(row,'Street Address')),billingAddress:client.billingAddress||cleanV60419(rowGetV60419(row,'Street Address')),suburb:cleanV60419(rowGetV60419(row,'Suburb / Area')),accessNotes:cleanV60419(rowGetV60419(row,'Site / Access Notes')),gardenNotes:cleanV60419(rowGetV60419(row,'Site / Access Notes')),accountReference:client.accountReference||workbookId,customerReference:client.customerReference||workbookId,onboardingClientIdV60419:workbookId,onboardingClientTypeV60419:type,masterActiveV60419:active,updatedAt:now,incomplete:false});
      if(!client.siteId)client.siteId=`site-${client.id}`;
      if(onceOff){client.recordKindV58951='once-off-customer';client.frequency='Ad hoc';client.fixedDay=false;client.status='archived';client.serviceState='once-off';client.teamId='';client.preferredTeamId='';client.autoScheduleEnabled=false;client.scheduleSource='onboarding-master';}
      else{client.recordKindV58951='recurring-client';client.status=active?'active':'archived';client.serviceState=active?'active':'archived';client.activationConfirmedV58961=active;client.awaitingInitialRecurringPlacementV6036=false;client.autoScheduleEnabled=active;client.scheduleSource='onboarding-master';client.schedulingPolicyV58951='onboarding-master';client.fixedDay=true;}
      claimed.add(client.id);map.set(keyV60419(workbookId),client.id);
    });
    return map;
  }
  function applyScheduleDefinitionsV60419(model,clientMap,teamMap){
    const definitions=[],now=new Date().toISOString();
    model.schedules.forEach(row=>{
      if(yesNoV60419(rowGetV60419(row,'Active'))===false)return;
      const workbookClient=cleanV60419(rowGetV60419(row,'Client ID')),workbookTeam=cleanV60419(rowGetV60419(row,'Team ID')),clientId=clientMap.get(keyV60419(workbookClient)),teamId=teamMap.get(keyV60419(workbookTeam)),client=(state.clients||[]).find(item=>item.id===clientId);if(!client||!teamId)return;
      const anchor=excelDateV60419(rowGetV60419(row,'Recurrence Anchor / Next Service Date')),preferred=dayV60419(rowGetV60419(row,'Preferred Day'),anchor),frequency=frequencyV60419(rowGetV60419(row,'Frequency')),scope=cleanV60419(rowGetV60419(row,'Service Scope / Tasks')),tasks=scopeTasksV60419(scope),services=typeof serviceIdsFromWorkV55==='function'?serviceIdsFromWorkV55([],scope):[];
      Object.assign(client,{frequency,preferredDay:preferred,fixedDay:true,recurrenceAnchorDate:anchor,serviceStartDate:anchor,teamId,preferredTeamId:teamId,serviceDescription:scope,customTasks:tasks.join('\n'),serviceIds:services,workTypeIds:typeof inferWorkTypeIdsV9==='function'?inferWorkTypeIdsV9(scope):client.workTypeIds||[],scheduleSource:'onboarding-master',schedulingPolicyV58951:'onboarding-master',autoScheduleEnabled:client.status==='active',awaitingInitialRecurringPlacementV6036:false,onboardingScheduleIdV60419:cleanV60419(rowGetV60419(row,'Schedule ID')),routeOrderV60419:Number(rowGetV60419(row,'Route Order'))||0,scheduleNotesV60419:cleanV60419(rowGetV60419(row,'Schedule Notes')),updatedAt:now});
      definitions.push({row,client,clientId,teamId,anchor,preferred,frequency,scope,tasks,services,scheduleId:cleanV60419(rowGetV60419(row,'Schedule ID')),routeOrder:Number(rowGetV60419(row,'Route Order'))||99,notes:cleanV60419(rowGetV60419(row,'Schedule Notes'))});
    });
    return definitions;
  }
  function dueForWeekV60419(def,weekStart,dates){
    if(typeof recurringFrequencyDueV5608==='function')return recurringFrequencyDueV5608(def.frequency,def.anchor,def.preferred,weekStart,dates);
    const target=dates[Math.max(0,DAYS.indexOf(def.preferred))]||dates[0];if(target<def.anchor)return false;if(def.frequency==='Weekly')return true;if(def.frequency==='Fortnightly'){const weeks=Math.floor((new Date(`${weekStart}T12:00:00`)-new Date(`${startOfWeek(def.anchor)}T12:00:00`))/(7*86400000));return weeks>=0&&weeks%2===0;}return target.slice(0,7)===def.anchor.slice(0,7);
  }
  function seedScheduleHorizonV60419(definitions){
    state.schedules=Array.isArray(state.schedules)?state.schedules:[];const today=localDateISO(),first=startOfWeek(today),horizonEnd=dateAdd(first,IMPORT_HORIZON_WEEKS*7-1),stats={created:0,updated:0,preserved:0};
    definitions.forEach(def=>{
      for(let weekIndex=0;weekIndex<IMPORT_HORIZON_WEEKS;weekIndex++){
        const weekStart=dateAdd(first,weekIndex*7),dates=weekDates(weekStart);if(!dueForWeekV60419(def,weekStart,dates))continue;
        const date=dates[Math.max(0,DAYS.indexOf(def.preferred))]||dates[0];if(date<today||date>horizonEnd)continue;
        const recurrenceKey=`${def.clientId}:${weekStart}`,protectedStatuses=new Set(['completed','cancelled','canceled','rescheduled','deferred','no-charge','access-failed']);
        let job=(state.schedules||[]).find(item=>item.clientId===def.clientId&&startOfWeek(item.date||today)===weekStart&&((item.recurrenceKey&&item.recurrenceKey===recurrenceKey)||(typeof workMarkerForJobV5546==='function'?workMarkerForJobV5546(item)==='R':item.workKind==='recurring')));
        if(job&&(job.manualOverride===true||protectedStatuses.has(keyV60419(job.status)))){stats.preserved++;continue;}
        const values={recurrenceKey,sourceOccurrenceKey:`rolling:${recurrenceKey}`,rollingWeekStartV58929:weekStart,rollingGeneratedV58929:true,date,clientId:def.clientId,teamId:def.teamId,status:'scheduled',estimatedHours:0,estimatedMinutes:0,durationUnknownV59320:true,sort:def.routeOrder,revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',serviceIds:[...def.services],workTypeIds:[...(def.client.workTypeIds||[])],customTasks:def.client.customTasks||'',visitTasks:[...def.tasks],officeNotes:def.notes,autoGenerated:true,autoAssigned:false,manualOverride:false,agreementSourceV5608:'onboarding-master',onboardingMasterV60419:true,onboardingScheduleIdV60419:def.scheduleId,billingProfileIdV59396:def.client.billingProfileIdV59396||'',updatedAt:new Date().toISOString()};
        if(job){const id=job.id,createdAt=job.createdAt,audit=job.audit;Object.assign(job,values,{id,createdAt:createdAt||new Date().toISOString(),audit});stats.updated++;}
        else{job={id:typeof uid==='function'?uid('sch'):`sch-${Date.now()}-${stats.created}`,createdAt:new Date().toISOString(),...values};state.schedules.push(job);stats.created++;}
      }
    });
    try{for(let weekIndex=0;weekIndex<IMPORT_HORIZON_WEEKS;weekIndex++)typeof normaliseRouteOrderV14==='function'&&normaliseRouteOrderV14(weekDates(dateAdd(first,weekIndex*7)));}catch(_){ }
    return stats;
  }
  function applyBillingV60419(model,clientMap){
    if(!model.financial)return;
    model.billing.forEach(row=>{
      const clientId=clientMap.get(keyV60419(rowGetV60419(row,'Client ID'))),client=(state.clients||[]).find(item=>item.id===clientId);if(!client)return;
      const fee=moneyNumberV60419(rowGetV60419(row,'Routine Fee')),basis=cleanV60419(rowGetV60419(row,'Fee Basis')),basisKey=keyV60419(basis),profile=currentProfileMatchV60419(rowGetV60419(row,'Billing Profile / Entity')),cycle=invoiceCycleFromMasterV60419(rowGetV60419(row,'Invoice Cycle'),rowGetV60419(row,'Invoice Send Day'),basis),code=cleanV60419(rowGetV60419(row,'Account / Customer Code'));
      client.billingProfileIdV59396=profile?.id||client.billingProfileIdV59396||'';client.rateAmount=fee;client.routineFeeBasisV60419=basis;client.vatTreatmentV60419=cleanV60419(rowGetV60419(row,'VAT Treatment'));client.billingNotes=cleanV60419(rowGetV60419(row,'Notes'));client.invoiceCycleLabelV60419=cycle.raw;client.invoiceSendDayV60419=cycle.sendDay;client.invoiceCycleModeV58963=cycle.mode;client.invoiceCycleMode=cycle.mode;client.invoiceTiming=cycle.mode==='on_completion'?'on_completion':'business_default';client.customInvoiceDayV58963=cycle.day;
      if(basisKey==='monthly fixed'){client.monthlyFee=fee;client.priceBasis='Monthly fixed';client.billingArrangement='Monthly fixed fee';}
      else{client.monthlyFee=0;client.priceBasis='Per visit';client.billingArrangement='Per visit';}
      if(code){client.accountReference=code;client.customerReference=code;}client.onboardingClientIdV60419=cleanV60419(rowGetV60419(row,'Client ID'));client.billingSetupIncompleteV59376=false;client.billingHoldV59376=false;
      if(typeof applyBillingClassificationV59376==='function')applyBillingClassificationV59376(client);
    });
  }
  function applyItemsV60419(model){
    if(!model.financial)return;state.business=state.business||{};
    const existing=Array.isArray(state.business.quoteItemCatalogV60419)?state.business.quoteItemCatalogV60419:[],map=new Map(existing.map(item=>[keyV60419(item.code||item.id),item]));
    model.items.forEach(row=>{const code=cleanV60419(rowGetV60419(row,'Item / Service Code')),entry=map.get(keyV60419(code))||{id:safeImportIdV60419(code,'item'),code,createdAt:new Date().toISOString()};Object.assign(entry,{code,description:cleanV60419(rowGetV60419(row,'Description')),category:cleanV60419(rowGetV60419(row,'Category')),unit:cleanV60419(rowGetV60419(row,'Unit')),defaultSellingPrice:moneyNumberV60419(rowGetV60419(row,'Default Selling Price'))||0,vatTreatment:cleanV60419(rowGetV60419(row,'VAT Treatment')),accountingCode:cleanV60419(rowGetV60419(row,'Accounting / Pastel / Sage Code')),active:yesNoV60419(rowGetV60419(row,'Active'))===true,source:'onboarding-master',updatedAt:new Date().toISOString()});map.set(keyV60419(code),entry);});
    state.business.quoteItemCatalogV60419=[...map.values()];
  }
  async function commitV60419(model,fileName){
    if(model.issues.length)throw new Error('Fix the workbook issues shown before importing.');
    if(!workspaceWriteReadyV60419())throw new Error(workspaceWriteIssueV60419());
    const backup=JSON.parse(JSON.stringify(state));let teamMap,clientMap,definitions,scheduleStats;
    try{
      applyBusinessV60419(model,fileName);teamMap=applyTeamsV60419(model);clientMap=applyClientsV60419(model);definitions=applyScheduleDefinitionsV60419(model,clientMap,teamMap);applyBillingV60419(model,clientMap);applyItemsV60419(model);scheduleStats=seedScheduleHorizonV60419(definitions);
      if(typeof ensureV55State==='function')ensureV55State();if(typeof ensureV56State==='function')ensureV56State();if(typeof ensureBillingProfileStateV59396==='function')ensureBillingProfileStateV59396();
    }catch(error){state=backup;window.state=state;throw error;}
    save();
    try{typeof renderClients==='function'&&renderClients();}catch(error){console.warn('[v60.4.19] clients render',error);}try{typeof renderSchedule==='function'&&renderSchedule();}catch(error){console.warn('[v60.4.19] schedule render',error);}try{typeof renderSettings==='function'&&renderSettings();}catch(_){ }
    return {teamCount:teamMap.size,clientCount:clientMap.size,scheduleDefinitions:definitions.length,...scheduleStats};
  }

  /* ---------- plain review UI ---------- */
  let currentModelV60419=null,currentFileV60419=null;
  function injectStyleV60419(){if(document.getElementById('onboardingMasterStyleV60419'))return;const style=document.createElement('style');style.id='onboardingMasterStyleV60419';style.textContent=`
    #onboardingMasterDialogV60419 .dialog-shell{max-width:880px}
    .master-import-v60419{display:grid;gap:14px}.master-import-drop-v60419{border:1px solid #cfd8d3;border-radius:8px;padding:18px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.master-import-drop-v60419.dragging{outline:2px solid #1c684d;outline-offset:2px}.master-import-drop-v60419 strong{display:block}.master-import-drop-v60419 small{display:block;margin-top:4px;color:#64736b}.master-import-summary-v60419{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid #d9e0dc;border-radius:8px;overflow:hidden}.master-import-summary-v60419 div{padding:10px 12px;border-right:1px solid #e4e9e6}.master-import-summary-v60419 div:last-child{border-right:0}.master-import-summary-v60419 small{display:block;color:#68766f}.master-import-summary-v60419 strong{display:block;margin-top:2px;font-size:1.05rem}.master-import-status-v60419{padding:10px 12px;border:1px solid #d9e0dc;border-radius:8px;background:#f7f9f8}.master-import-status-v60419.ready{border-color:#79a993;background:#f1f8f4}.master-import-status-v60419.blocked{border-color:#d98b82;background:#fff5f3}.master-import-list-v60419{max-height:230px;overflow:auto;border:1px solid #d9e0dc;border-radius:8px;background:#fff}.master-import-list-v60419 ul{margin:0;padding:10px 12px 10px 30px}.master-import-list-v60419 li{margin:5px 0}.master-import-list-v60419 .warning{color:#6c5717}.master-import-empty-v60419{padding:14px;color:#64736b}.master-import-note-v60419{font-size:.84rem;color:#64736b}.master-import-actions-v60419{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}@media(max-width:800px){.master-import-summary-v60419{grid-template-columns:1fr 1fr}.master-import-summary-v60419 div{border-bottom:1px solid #e4e9e6}}
  `;document.head.appendChild(style);}
  function ensureUiV60419(){
    injectStyleV60419();const actions=document.querySelector('#view-clients .heading-actions');
    if(actions&&!document.getElementById('openOnboardingMasterImportV60419')){const button=document.createElement('button');button.type='button';button.id='openOnboardingMasterImportV60419';button.className='button';button.textContent='Import onboarding workbook';const old=document.getElementById('openSpreadsheetImporterBtn');actions.insertBefore(button,old||null);button.addEventListener('click',openV60419);}
    const scheduleHead=document.querySelector('#rollingScheduleOverview .rolling-plan-head');
    if(scheduleHead&&!document.getElementById('openScheduleOnboardingMasterImportV60419')){const button=document.createElement('button');button.type='button';button.id='openScheduleOnboardingMasterImportV60419';button.className='button secondary compact';button.textContent='Import onboarding workbook';button.addEventListener('click',openV60419);scheduleHead.appendChild(button);}
    if(!document.getElementById('onboardingMasterDialogV60419')){const dialog=document.createElement('dialog');dialog.id='onboardingMasterDialogV60419';dialog.className='dialog large-dialog';dialog.innerHTML=`<div class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">Business setup import</span><h2>Import TuinBooks onboarding workbook</h2><p>Imports the linked business snapshot. Nothing changes until you review the preview and click Import.</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></div><div class="master-import-v60419"><div id="masterImportDropV60419" class="master-import-drop-v60419"><div><strong id="masterImportFileNameV60419">Choose the completed onboarding workbook</strong><small>.xlsx · START, CLIENTS, SCHEDULE and TEAMS; financial sheets when selected</small></div><div><input id="masterImportFileV60419" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden><button type="button" class="button secondary" id="chooseMasterImportV60419">Choose workbook</button></div></div><div id="masterImportPreviewV60419" class="master-import-empty-v60419">No workbook selected.</div><p class="master-import-note-v60419">Import updates matching records and keeps existing history. It never deletes old jobs, completed work, quotes or invoices.</p><div class="master-import-actions-v60419"><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button" id="commitMasterImportV60419" disabled>Import business snapshot</button></div></div></div>`;document.body.appendChild(dialog);
      dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));document.getElementById('chooseMasterImportV60419').addEventListener('click',()=>document.getElementById('masterImportFileV60419').click());document.getElementById('masterImportFileV60419').addEventListener('change',event=>readFileV60419(event.target.files?.[0]));document.getElementById('commitMasterImportV60419').addEventListener('click',commitFromUiV60419);
      const drop=document.getElementById('masterImportDropV60419');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragging');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragging');}));drop.addEventListener('drop',event=>readFileV60419(event.dataTransfer?.files?.[0]));
    }
  }
  function openV60419(){ensureUiV60419();if(!workspaceWriteReadyV60419()){toast(workspaceWriteIssueV60419(),'error');return;}currentModelV60419=null;currentFileV60419=null;document.getElementById('masterImportFileV60419').value='';document.getElementById('masterImportFileNameV60419').textContent='Choose the completed onboarding workbook';document.getElementById('masterImportPreviewV60419').className='master-import-empty-v60419';document.getElementById('masterImportPreviewV60419').innerHTML='No workbook selected.';document.getElementById('commitMasterImportV60419').disabled=true;document.getElementById('onboardingMasterDialogV60419').showModal();}
  function renderPreviewV60419(model){
    const host=document.getElementById('masterImportPreviewV60419'),ready=!model.issues.length,financial=model.financial;
    const summary=[['Clients',model.counts.clients||0],['Teams',model.counts.teams||0],['Schedules',model.counts.schedules||0],['Billing',financial?model.counts.billing||0:'Not required'],['Item codes',financial?model.counts.items||0:'Not required']];
    host.className='';host.innerHTML=`<div class="master-import-status-v60419 ${ready?'ready':'blocked'}"><strong>${ready?'READY TO IMPORT':'IMPORT BLOCKED'}</strong><div>${htmlV60419(model.businessName||'Business name missing')} · ${htmlV60419(model.trial||'Trial type missing')}</div></div><div class="master-import-summary-v60419">${summary.map(([label,value])=>`<div><small>${htmlV60419(label)}</small><strong>${htmlV60419(value)}</strong></div>`).join('')}</div>${model.issues.length?`<div><strong>Fix before import (${model.issues.length})</strong><div class="master-import-list-v60419"><ul>${model.issues.map(issue=>`<li>${htmlV60419(issue)}</li>`).join('')}</ul></div></div>`:''}${model.warnings.length?`<div><strong>Notes</strong><div class="master-import-list-v60419"><ul>${model.warnings.map(warning=>`<li class="warning">${htmlV60419(warning)}</li>`).join('')}</ul></div></div>`:''}`;
    document.getElementById('commitMasterImportV60419').disabled=!ready;
  }
  async function readFileV60419(file){
    if(!file)return;if(!/\.xlsx$/i.test(file.name)){toast('Choose the .xlsx TuinBooks onboarding workbook.','error');return;}currentFileV60419=file;document.getElementById('masterImportFileNameV60419').textContent=file.name;const host=document.getElementById('masterImportPreviewV60419');host.className='master-import-status-v60419';host.innerHTML='<strong>Reading workbook…</strong>';document.getElementById('commitMasterImportV60419').disabled=true;
    try{const parsed=await parseXlsxV60419(file);parsed.fileName=file.name;currentModelV60419=modelV60419(parsed);renderPreviewV60419(currentModelV60419);}catch(error){console.error('[v60.4.19] workbook read',error);currentModelV60419=null;host.className='master-import-status-v60419 blocked';host.innerHTML=`<strong>Could not read workbook</strong><div>${htmlV60419(error?.message||error)}</div>`;toast(error?.message||'Could not read workbook.','error');}
  }
  async function commitFromUiV60419(){
    if(!currentModelV60419||currentModelV60419.issues.length)return;const button=document.getElementById('commitMasterImportV60419');button.disabled=true;button.textContent='Importing…';
    try{const result=await commitV60419(currentModelV60419,currentFileV60419?.name||'');document.getElementById('onboardingMasterDialogV60419').close();toast(`Onboarding imported: ${result.clientCount} clients, ${result.teamCount} teams, ${result.scheduleDefinitions} routine patterns. ${result.created} upcoming visits created.`);}
    catch(error){console.error('[v60.4.19] onboarding import',error);toast(error?.message||'The onboarding import failed.','error');button.disabled=false;}
    finally{button.textContent='Import business snapshot';}
  }

  function installV60419(){ensureUiV60419();const scheduleHost=document.getElementById('rollingScheduleOverview');if(scheduleHost&&!scheduleHost.dataset.masterImportObserverV60419){scheduleHost.dataset.masterImportObserverV60419='1';new MutationObserver(()=>ensureUiV60419()).observe(scheduleHost,{childList:true,subtree:true});}window.__tuinbooksOnboardingMasterImportV60419={...publicParser,modelV60419,commitV60419,build:BUILD};document.documentElement.dataset.onboardingMasterImport='v60419';}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV60419,{once:true});else installV60419();
})();
