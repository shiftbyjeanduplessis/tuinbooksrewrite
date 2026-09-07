/* ========================================================================== 
   TuinBooks v60.4.20 — Onboarding Master Workbook Import (production entry points)
   --------------------------------------------------------------------------
   Imports the linked TuinBooks onboarding .xlsx as one business snapshot:
   START + CLIENTS + SCHEDULE + TEAMS, plus BILLING + ITEM CODES when the
   selected trial is Planning + Financial.

   The workbook is parsed locally in the browser. No CDN or third-party XLSX
   dependency is used. Nothing is written until the office reviews the preview
   and explicitly confirms Import.
   ========================================================================== */
(()=>{
  const BUILD='60.4.20-onboarding-master-import';
  const REQUIRED_CORE_SHEETS=['START','CLIENTS','SCHEDULE','TEAMS'];
  const FINANCIAL_SHEETS=['BILLING','ITEM CODES'];
  const IMPORT_HORIZON_WEEKS=8;
  const decoder=new TextDecoder('utf-8');

  /* ---------- tiny XLSX reader (ZIP + worksheet XML) ---------- */
  function u16V60420(v,o){return v[o]|(v[o+1]<<8);}
  function u32V60420(v,o){return (v[o]|(v[o+1]<<8)|(v[o+2]<<16)|(v[o+3]<<24))>>>0;}
  async function unzipV60420(buffer){
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
    let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-66000);i--){if(u32V60420(bytes,i)===0x06054b50){eocd=i;break;}}
    if(eocd<0)throw new Error('This is not a readable .xlsx workbook.');
    const total=u16V60420(bytes,eocd+10),centralOffset=u32V60420(bytes,eocd+16),files=new Map();
    let pointer=centralOffset;
    for(let index=0;index<total;index++){
      if(u32V60420(bytes,pointer)!==0x02014b50)throw new Error('The workbook ZIP directory is damaged.');
      const method=u16V60420(bytes,pointer+10),compressedSize=u32V60420(bytes,pointer+20),nameLength=u16V60420(bytes,pointer+28),extraLength=u16V60420(bytes,pointer+30),commentLength=u16V60420(bytes,pointer+32),localOffset=u32V60420(bytes,pointer+42);
      const name=decoder.decode(bytes.slice(pointer+46,pointer+46+nameLength)).replace(/^\//,'');
      if(u32V60420(bytes,localOffset)!==0x04034b50)throw new Error(`The workbook entry ${name} is damaged.`);
      const localNameLength=u16V60420(bytes,localOffset+26),localExtraLength=u16V60420(bytes,localOffset+28),dataStart=localOffset+30+localNameLength+localExtraLength;
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
  function xmlV60420(bytes){return decoder.decode(bytes||new Uint8Array());}
  function decodeXmlV60420(text=''){
    return String(text).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')
      .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)));
  }
  function xmlAttrV60420(attrs,name){const match=String(attrs).match(new RegExp('(?:^|\\s)'+name.replace(':','\\:')+'="([^"]*)"'));return match?decodeXmlV60420(match[1]):'';}
  function sharedStringsV60420(source){
    const rows=[];
    for(const match of String(source).matchAll(/<(?:[A-Za-z0-9_]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?si>/g)){
      let text='';for(const part of match[1].matchAll(/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g))text+=decodeXmlV60420(part[1]);rows.push(text);
    }
    return rows;
  }
  function columnIndexV60420(ref){const match=String(ref||'').match(/^([A-Z]+)/i);if(!match)return 0;let out=0;for(const char of match[1].toUpperCase())out=out*26+char.charCodeAt(0)-64;return out-1;}
  function worksheetRowsV60420(source,shared){
    const rows=[];
    for(const rowMatch of String(source).matchAll(/<(?:[A-Za-z0-9_]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?row>/g)){
      const rowNumber=Number(xmlAttrV60420(rowMatch[1],'r'))||rows.length+1,row=[];
      for(const cellMatch of rowMatch[2].matchAll(/<(?:[A-Za-z0-9_]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?c>/g)){
        const ref=xmlAttrV60420(cellMatch[1],'r'),type=xmlAttrV60420(cellMatch[1],'t'),col=columnIndexV60420(ref),body=cellMatch[2];let value='';
        if(type==='inlineStr'){
          for(const part of body.matchAll(/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/g))value+=decodeXmlV60420(part[1]);
        }else{
          const valueMatch=body.match(/<(?:[A-Za-z0-9_]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?v>/),raw=valueMatch?decodeXmlV60420(valueMatch[1]):'';
          if(type==='s')value=shared[Number(raw)]??'';else if(type==='b')value=raw==='1';else if(type==='str')value=raw;else value=raw!==''&&!Number.isNaN(Number(raw))?Number(raw):raw;
        }
        row[col]=value;
      }
      row._row=rowNumber;rows[rowNumber-1]=row;
    }
    return rows;
  }
  async function parseXlsxV60420(fileOrBuffer){
    const buffer=fileOrBuffer instanceof ArrayBuffer?fileOrBuffer:await fileOrBuffer.arrayBuffer(),files=await unzipV60420(buffer);
    if(!files.has('xl/workbook.xml'))throw new Error('The selected file is not an Excel .xlsx workbook.');
    const workbookXml=xmlV60420(files.get('xl/workbook.xml')),relsXml=xmlV60420(files.get('xl/_rels/workbook.xml.rels'));
    const shared=files.has('xl/sharedStrings.xml')?sharedStringsV60420(xmlV60420(files.get('xl/sharedStrings.xml'))):[],relationships={};
    for(const match of relsXml.matchAll(/<(?:[A-Za-z0-9_]+:)?Relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?Relationship>)/g))relationships[xmlAttrV60420(match[1],'Id')]=xmlAttrV60420(match[1],'Target');
    const sheets={};
    for(const match of workbookXml.matchAll(/<(?:[A-Za-z0-9_]+:)?sheet\b([^>]*?)\/?\s*>/g)){
      const name=xmlAttrV60420(match[1],'name'),relationship=xmlAttrV60420(match[1],'r:id'),target=relationships[relationship];if(!name||!target)continue;
      let path=target.replace(/^\//,'');if(!path.startsWith('xl/'))path=`xl/${path.replace(/^\.\//,'')}`;
      if(files.has(path))sheets[name]=worksheetRowsV60420(xmlV60420(files.get(path)),shared);
    }
    return {sheets,fileName:fileOrBuffer?.name||''};
  }

  const publicParser={build:BUILD,parseXlsxV60420,worksheetRowsV60420};

  /* ---------- workbook model + validation ---------- */
  const cleanV60420=value=>String(value??'').trim();
  const keyV60420=value=>cleanV60420(value).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
  const htmlV60420=value=>cleanV60420(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function yesNoV60420(value){const text=keyV60420(value);if(['yes','y','true','1','active'].includes(text))return true;if(['no','n','false','0','inactive'].includes(text))return false;return null;}
  function excelDateV60420(value){
    if(typeof value==='number'&&value>1000&&value<100000){const date=new Date(Date.UTC(1899,11,30)+Math.round(value*86400000));return date.toISOString().slice(0,10);}
    const text=cleanV60420(value);if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
    if(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(text)){const [d,m,y]=text.split(/[\/-]/).map(Number);const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d)return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
    return '';
  }
  function headerObjectsV60420(rows){
    const header=(rows||[]).find(row=>Array.isArray(row)&&row.some(cell=>cleanV60420(cell)))||[],headerIndex=(rows||[]).indexOf(header),names=header.map(cleanV60420);
    return (rows||[]).slice(headerIndex+1).map((row,index)=>{const object={_row:Number(row?._row)||headerIndex+index+2};names.forEach((name,col)=>{if(name)object[name]=row?.[col]??'';});return object;});
  }
  function rowGetV60420(row,...names){for(const name of names){if(Object.prototype.hasOwnProperty.call(row,name))return row[name];const wanted=keyV60420(name),found=Object.keys(row).find(key=>keyV60420(key)===wanted);if(found)return row[found];}return '';}
  function startMapV60420(rows){const out={};(rows||[]).forEach(row=>{const key=keyV60420(row?.[0]);if(key)out[key]=row?.[1]??'';});return out;}
  function startValueV60420(start,label){return start[keyV60420(label)]??'';}
  function meaningfulClientV60420(row){return [rowGetV60420(row,'Client / Site Name'),rowGetV60420(row,'Contact Name'),rowGetV60420(row,'Mobile'),rowGetV60420(row,'Street Address')].some(value=>cleanV60420(value));}
  function meaningfulTeamV60420(row){return [rowGetV60420(row,'Team Name'),rowGetV60420(row,'Team Lead'),rowGetV60420(row,'Mobile / Device User'),rowGetV60420(row,'Access Type')].some(value=>cleanV60420(value));}
  function meaningfulScheduleV60420(row){return [rowGetV60420(row,'Client ID'),rowGetV60420(row,'Team ID'),rowGetV60420(row,'Frequency'),rowGetV60420(row,'Recurrence Anchor / Next Service Date')].some(value=>cleanV60420(value));}
  function meaningfulBillingV60420(row){return cleanV60420(rowGetV60420(row,'Client ID'))!=='';}
  function meaningfulItemV60420(row){const code=cleanV60420(rowGetV60420(row,'Item / Service Code'));return code!==''&&keyV60420(code)!=='not required';}
  function dayV60420(value,date=''){
    const text=cleanV60420(value),match=(typeof DAYS!=='undefined'?DAYS:[]).find(day=>keyV60420(day)===keyV60420(text));
    if(match)return match;
    if(date&&typeof dayName==='function'){const derived=dayName(date);return (typeof DAYS!=='undefined'&&DAYS.includes(derived))?derived:'';}
    return '';
  }
  function trialTypeV60420(value){const text=keyV60420(value);if(text==='planning only')return 'Planning only';if(text.includes('planning')&&text.includes('financial'))return 'Planning + Financial';return '';}
  function clientKindV60420(value){const text=keyV60420(value);if(text==='routine')return 'Routine';if(text.includes('once'))return 'Once-off';if(text==='both')return 'Both';return '';}
  function frequencyV60420(value){const text=keyV60420(value);if(text.includes('fortnight'))return 'Fortnightly';if(text==='weekly'||text.includes('every week'))return 'Weekly';if(text.includes('month'))return 'Monthly';if(text.includes('ad hoc'))return 'Ad hoc';if(text.includes('season'))return 'Seasonal';if(text.includes('custom'))return 'Custom';return cleanV60420(value);}
  function scopeTasksV60420(value){return cleanV60420(value).split(/\n|;|\u2022/g).map(text=>text.trim()).filter(Boolean);}
  function moneyNumberV60420(value){if(typeof value==='number')return Number.isFinite(value)?value:NaN;const text=cleanV60420(value).replace(/\s/g,'').replace(/^R/i,'').replace(/,/g,'');return text===''?NaN:Number(text);}
  function currentProfileMatchV60420(value){
    const text=keyV60420(value);if(!text)return null;
    const profiles=typeof billingProfileRowsV59396==='function'?billingProfileRowsV59396():(typeof state!=='undefined'&&Array.isArray(state.billingProfilesV59396)?state.billingProfilesV59396:[]);
    if(['default','main','business default','default profile'].includes(text))return typeof defaultBillingProfileV59396==='function'?defaultBillingProfileV59396():profiles.find(profile=>profile.isDefault)||profiles[0]||null;
    return profiles.find(profile=>[profile.displayName,profile.legalName,profile.tradingName,...(profile.aliases||[])].some(name=>keyV60420(name)===text))||null;
  }
  function businessNameCompatibleV60420(workbookName,currentName){
    const a=keyV60420(workbookName),b=keyV60420(currentName);if(!a||!b||a===b||a.includes(b)||b.includes(a))return true;
    const A=new Set(a.split(' ').filter(x=>x.length>2)),B=new Set(b.split(' ').filter(x=>x.length>2)),intersection=[...A].filter(x=>B.has(x)).length,denominator=Math.max(1,Math.min(A.size,B.size));return intersection/denominator>=0.6;
  }
  function modelV60420(parsed){
    const sheetLookup={};Object.entries(parsed.sheets||{}).forEach(([name,rows])=>sheetLookup[keyV60420(name).toUpperCase()]=rows);
    const sheet=name=>sheetLookup[keyV60420(name).toUpperCase()]||null;
    const issues=[],warnings=[];
    REQUIRED_CORE_SHEETS.forEach(name=>{if(!sheet(name))issues.push(`Missing required worksheet: ${name}.`);});
    if(issues.length)return {issues,warnings,counts:{},parsed};
    const start=startMapV60420(sheet('START')),trial=trialTypeV60420(startValueV60420(start,'Trial type')),financial=trial==='Planning + Financial',businessName=cleanV60420(startValueV60420(start,'Business name'));
    if(!trial)issues.push('START: choose Trial type as Planning only or Planning + Financial.');
    if(!businessName)issues.push('START: Business name is required.');
    const currentName=cleanV60420(typeof state!=='undefined'?state?.business?.name:'');if(businessName&&currentName&&!businessNameCompatibleV60420(businessName,currentName))issues.push(`This workbook is for “${businessName}”, but the open TuinBooks account is “${currentName}”. Open the correct account or correct START → Business name.`);
    if(financial)FINANCIAL_SHEETS.forEach(name=>{if(!sheet(name))issues.push(`Planning + Financial requires worksheet: ${name}.`);});

    const clients=(sheet('CLIENTS')?headerObjectsV60420(sheet('CLIENTS')):[]).filter(meaningfulClientV60420);
    const teams=(sheet('TEAMS')?headerObjectsV60420(sheet('TEAMS')):[]).filter(meaningfulTeamV60420);
    const schedules=(sheet('SCHEDULE')?headerObjectsV60420(sheet('SCHEDULE')):[]).filter(meaningfulScheduleV60420);
    const billing=(sheet('BILLING')?headerObjectsV60420(sheet('BILLING')):[]).filter(meaningfulBillingV60420);
    const items=(sheet('ITEM CODES')?headerObjectsV60420(sheet('ITEM CODES')):[]).filter(meaningfulItemV60420);
    if(!clients.length)issues.push('CLIENTS: no client rows are completed.');
    if(!teams.length)issues.push('TEAMS: no team rows are completed.');
    if(!schedules.length)issues.push('SCHEDULE: no routine schedule rows are completed.');

    const clientIds=new Map(),teamIds=new Map(),scheduleByClient=new Map(),billingByClient=new Map(),itemCodes=new Map();
    clients.forEach(row=>{
      const id=cleanV60420(rowGetV60420(row,'Client ID')),name=cleanV60420(rowGetV60420(row,'Client / Site Name')),mobile=cleanV60420(rowGetV60420(row,'Mobile')),address=cleanV60420(rowGetV60420(row,'Street Address')),suburb=cleanV60420(rowGetV60420(row,'Suburb / Area')),type=clientKindV60420(rowGetV60420(row,'Client Type')),active=yesNoV60420(rowGetV60420(row,'Active'));
      const prefix=`CLIENTS row ${row._row}`;
      if(!id)issues.push(`${prefix}: Client ID is required.`);else if(clientIds.has(keyV60420(id)))issues.push(`${prefix}: duplicate Client ID ${id}.`);else clientIds.set(keyV60420(id),row);
      if(!name)issues.push(`${prefix}: Client / Site Name is required.`);
      if(!mobile)issues.push(`${prefix}: Mobile is required.`);
      if(!address||!suburb)issues.push(`${prefix}: Street Address and Suburb / Area are required.`);
      if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
      if(!type)issues.push(`${prefix}: Client Type must be Routine, Once-off or Both.`);
      if(!cleanV60420(rowGetV60420(row,'Email')))warnings.push(`${prefix}: no email address.`);
    });
    teams.forEach(row=>{
      const id=cleanV60420(rowGetV60420(row,'Team ID')),name=cleanV60420(rowGetV60420(row,'Team Name')),deviceUser=cleanV60420(rowGetV60420(row,'Mobile / Device User')),access=cleanV60420(rowGetV60420(row,'Access Type')),active=yesNoV60420(rowGetV60420(row,'Active')),prefix=`TEAMS row ${row._row}`;
      if(!id)issues.push(`${prefix}: Team ID is required.`);else if(teamIds.has(keyV60420(id)))issues.push(`${prefix}: duplicate Team ID ${id}.`);else teamIds.set(keyV60420(id),row);
      if(!name)issues.push(`${prefix}: Team Name is required.`);
      if(!deviceUser)issues.push(`${prefix}: Mobile / Device User is required.`);
      if(!access)issues.push(`${prefix}: Access Type is required.`);
      if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
    });
    schedules.forEach(row=>{
      const id=cleanV60420(rowGetV60420(row,'Schedule ID')),clientId=cleanV60420(rowGetV60420(row,'Client ID')),teamId=cleanV60420(rowGetV60420(row,'Team ID')),frequency=frequencyV60420(rowGetV60420(row,'Frequency')),anchor=excelDateV60420(rowGetV60420(row,'Recurrence Anchor / Next Service Date')),preferred=dayV60420(rowGetV60420(row,'Preferred Day'),anchor),scope=cleanV60420(rowGetV60420(row,'Service Scope / Tasks')),active=yesNoV60420(rowGetV60420(row,'Active')),prefix=`SCHEDULE row ${row._row}`;
      if(!id)issues.push(`${prefix}: Schedule ID is required.`);
      if(!clientId||!clientIds.has(keyV60420(clientId)))issues.push(`${prefix}: Client ID ${clientId||'(blank)'} does not link to CLIENTS.`);
      if(!teamId||!teamIds.has(keyV60420(teamId)))issues.push(`${prefix}: Team ID ${teamId||'(blank)'} does not link to TEAMS.`);
      if(!['Weekly','Fortnightly','Monthly'].includes(frequency))issues.push(`${prefix}: Frequency must be Weekly, Fortnightly or Monthly for routine scheduling.`);
      if(!anchor)issues.push(`${prefix}: Recurrence Anchor / Next Service Date must be a valid date.`);
      if(!preferred)issues.push(`${prefix}: Preferred Day must be Monday to Saturday.`);
      if(!scope)issues.push(`${prefix}: Service Scope / Tasks is required so the field team knows what to do.`);
      if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
      if(clientId){const key=keyV60420(clientId),existing=scheduleByClient.get(key)||[];existing.push(row);scheduleByClient.set(key,existing);}
      const clientRow=clientIds.get(keyV60420(clientId));if(clientRow&&clientKindV60420(rowGetV60420(clientRow,'Client Type'))==='Once-off')issues.push(`${prefix}: ${clientId} is marked Once-off in CLIENTS and cannot have a routine schedule.`);if(active===true&&clientRow&&yesNoV60420(rowGetV60420(clientRow,'Active'))===false)issues.push(`${prefix}: ${clientId} is inactive but has an active schedule.`);
      const teamRow=teamIds.get(keyV60420(teamId));if(active===true&&teamRow&&yesNoV60420(rowGetV60420(teamRow,'Active'))===false)issues.push(`${prefix}: ${teamId} is inactive but has an active schedule.`);
    });
    clients.forEach(row=>{
      const id=cleanV60420(rowGetV60420(row,'Client ID')),type=clientKindV60420(rowGetV60420(row,'Client Type')),active=yesNoV60420(rowGetV60420(row,'Active')),rows=(scheduleByClient.get(keyV60420(id))||[]).filter(schedule=>yesNoV60420(rowGetV60420(schedule,'Active'))!==false);
      if(active===true&&type!=='Once-off'&&!rows.length)issues.push(`CLIENTS row ${row._row}: ${id} is ${type||'routine'} but has no active linked SCHEDULE row.`);
      if(rows.length>1)issues.push(`CLIENTS row ${row._row}: ${id} has ${rows.length} active routine schedule rows. This importer supports one recurring pattern per client; combine or correct the schedule rows first.`);
    });

    if(financial&&sheet('BILLING')){
      billing.forEach(row=>{
        const clientId=cleanV60420(rowGetV60420(row,'Client ID')),profileName=cleanV60420(rowGetV60420(row,'Billing Profile / Entity')),fee=moneyNumberV60420(rowGetV60420(row,'Routine Fee')),basis=cleanV60420(rowGetV60420(row,'Fee Basis')),cycle=cleanV60420(rowGetV60420(row,'Invoice Cycle')),sendDay=cleanV60420(rowGetV60420(row,'Invoice Send Day')),vat=cleanV60420(rowGetV60420(row,'VAT Treatment')),prefix=`BILLING row ${row._row}`;
        if(!clientId||!clientIds.has(keyV60420(clientId)))issues.push(`${prefix}: Client ID ${clientId||'(blank)'} does not link to CLIENTS.`);else if(billingByClient.has(keyV60420(clientId)))issues.push(`${prefix}: duplicate billing row for ${clientId}.`);else billingByClient.set(keyV60420(clientId),row);
        if(!profileName)issues.push(`${prefix}: Billing Profile / Entity is required.`);else if(!currentProfileMatchV60420(profileName))issues.push(`${prefix}: Billing Profile / Entity “${profileName}” does not exist in this TuinBooks account.`);
        if(!Number.isFinite(fee)||fee<0)issues.push(`${prefix}: Routine Fee must be a valid amount.`);
        if(!['per visit','weekly','fortnightly','monthly fixed'].includes(keyV60420(basis)))issues.push(`${prefix}: Fee Basis must be Per Visit, Weekly, Fortnightly or Monthly Fixed.`);
        if(!cycle)issues.push(`${prefix}: Invoice Cycle is required.`);
        if(!sendDay)issues.push(`${prefix}: Invoice Send Day is required.`);
        if(!['no vat','vat inclusive','vat exclusive'].includes(keyV60420(vat)))issues.push(`${prefix}: VAT Treatment is required.`);
      });
      clients.forEach(row=>{
        const id=cleanV60420(rowGetV60420(row,'Client ID')),type=clientKindV60420(rowGetV60420(row,'Client Type')),active=yesNoV60420(rowGetV60420(row,'Active'));
        if(active===true&&type!=='Once-off'&&!billingByClient.has(keyV60420(id)))issues.push(`BILLING: active routine client ${id} has no billing row.`);
      });
      const usesCodes=yesNoV60420(startValueV60420(start,'Uses item/service codes in accounting system'));
      if(usesCodes===true&&!items.length)issues.push('ITEM CODES: START says the business uses accounting item/service codes, but no item codes were entered.');
      items.forEach(row=>{
        const code=cleanV60420(rowGetV60420(row,'Item / Service Code')),description=cleanV60420(rowGetV60420(row,'Description')),unit=cleanV60420(rowGetV60420(row,'Unit')),price=moneyNumberV60420(rowGetV60420(row,'Default Selling Price')),vat=cleanV60420(rowGetV60420(row,'VAT Treatment')),active=yesNoV60420(rowGetV60420(row,'Active')),prefix=`ITEM CODES row ${row._row}`;
        if(!code)issues.push(`${prefix}: Item / Service Code is required.`);else if(itemCodes.has(keyV60420(code)))issues.push(`${prefix}: duplicate code ${code}.`);else itemCodes.set(keyV60420(code),row);
        if(!description)issues.push(`${prefix}: Description is required.`);if(!unit)issues.push(`${prefix}: Unit is required.`);if(!Number.isFinite(price)||price<0)issues.push(`${prefix}: Default Selling Price must be a valid amount.`);if(!vat)issues.push(`${prefix}: VAT Treatment is required.`);if(active===null)issues.push(`${prefix}: Active must be Yes or No.`);
      });
    }
    const expectedTeams=Number(startValueV60420(start,'Number of active teams')),actualActiveTeams=teams.filter(row=>yesNoV60420(rowGetV60420(row,'Active'))===true).length;
    if(Number.isFinite(expectedTeams)&&expectedTeams>0&&expectedTeams!==actualActiveTeams)warnings.push(`START says ${expectedTeams} active team${expectedTeams===1?'':'s'}, while TEAMS contains ${actualActiveTeams}.`);
    if(yesNoV60420(startValueV60420(start,'VAT registered'))===true&&!cleanV60420(startValueV60420(start,'VAT number')))warnings.push('START: VAT registered is Yes but VAT number is blank.');
    if(!financial)warnings.push('Planning-only trial: BILLING and ITEM CODES will not be imported or changed.');
    if(financial&&!items.length&&yesNoV60420(startValueV60420(start,'Uses item/service codes in accounting system'))!==true)warnings.push('No item codes entered; that is allowed because the business is not marked as using accounting item/service codes.');
    warnings.push('Existing TuinBooks records that are not in this workbook are kept; this import updates/matches records rather than deleting history.');
    warnings.push('Team mobile/device users are captured as setup information; this import does not create authentication logins.');
    return {parsed,start,trial,financial,businessName,clients,teams,schedules,billing,items,issues:[...new Set(issues)],warnings:[...new Set(warnings)],counts:{clients:clients.length,teams:teams.length,schedules:schedules.filter(row=>yesNoV60420(rowGetV60420(row,'Active'))!==false).length,billing:financial?billing.length:0,items:financial?items.length:0}};
  }

  if(typeof window==='undefined'||typeof document==='undefined'){
    globalThis.__tuinbooksOnboardingMasterImportV60420={...publicParser,modelV60420};
    return;
  }

  /* ---------- merge into TuinBooks state ---------- */
  function workspaceWriteReadyV60420(){
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
  function workspaceWriteIssueV60420(){
    try{if(typeof backendV28!=='undefined'&&(backendV28.coreConflict||backendV28.operationalConflict))return 'This workspace has a cloud-save conflict. Reload the account before importing.';}catch(_){ }
    return 'This Management workspace is still loading its current clients, schedule or work history. Wait for it to finish loading before importing.';
  }
  function safeImportIdV60420(value,prefix){const text=cleanV60420(value).replace(/[^A-Za-z0-9._:-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');return text||`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}
  function disposablePlaceholderTeamV60420(team){if(!team||!/^team\s*1$/i.test(cleanV60420(team.name)))return false;return !(state.schedules||[]).some(job=>job.teamId===team.id)&&!(state.visits||[]).some(visit=>visit.teamId===team.id);}
  function teamMatchV60420(row,index,claimed){
    const workbookId=cleanV60420(rowGetV60420(row,'Team ID')),name=cleanV60420(rowGetV60420(row,'Team Name'));
    let team=(state.teams||[]).find(item=>String(item.id)===workbookId&&!claimed.has(item.id));
    if(!team)team=(state.teams||[]).find(item=>keyV60420(item.name)===keyV60420(name)&&!claimed.has(item.id));
    if(!team&&index===0){const candidates=(state.teams||[]).filter(item=>!claimed.has(item.id)&&disposablePlaceholderTeamV60420(item));if(candidates.length===1)team=candidates[0];}
    return team||null;
  }
  function clientMatchV60420(row,claimed){
    const workbookId=cleanV60420(rowGetV60420(row,'Client ID')),name=keyV60420(rowGetV60420(row,'Client / Site Name')),address=keyV60420(rowGetV60420(row,'Street Address'));
    let client=(state.clients||[]).find(item=>String(item.id)===workbookId&&!claimed.has(item.id));
    if(!client)client=(state.clients||[]).find(item=>!claimed.has(item.id)&&[item.accountReference,item.customerReference,item.onboardingClientIdV60420].some(ref=>cleanV60420(ref)===workbookId));
    if(!client&&name&&address)client=(state.clients||[]).find(item=>!claimed.has(item.id)&&keyV60420(item.name)===name&&keyV60420(item.address)===address);
    return client||null;
  }
  function invoiceCycleFromMasterV60420(cycle,sendDay,basis){
    const b=keyV60420(basis),c=keyV60420(cycle),day=Number(String(sendDay||'').match(/\d{1,2}/)?.[0]||0);
    if(['per visit','weekly','fortnightly'].includes(b))return {mode:'on_completion',day:'',raw:cleanV60420(cycle),sendDay:cleanV60420(sendDay)};
    if(b==='monthly fixed'&&c.includes('month')&&day>=1&&day<=31)return {mode:'custom_monthly',day:String(day),raw:cleanV60420(cycle),sendDay:cleanV60420(sendDay)};
    return {mode:'business_default',day:'',raw:cleanV60420(cycle),sendDay:cleanV60420(sendDay)};
  }
  function applyBusinessV60420(model,fileName){
    state.business=state.business||{};state.onboarding=state.onboarding||{};
    const value=label=>cleanV60420(startValueV60420(model.start,label));
    state.business.name=model.businessName||state.business.name;
    state.business.phone=value('Phone')||state.business.phone||'';state.business.email=value('Email')||state.business.email||'';
    state.business.ownerMainContactV60420=value('Owner / main contact');state.business.townAreaV60420=value('Town / area');state.business.accountingSystemV60420=value('Current accounting system');state.business.usesItemServiceCodesV60420=yesNoV60420(value('Uses item/service codes in accounting system'))===true;state.business.onboardingNotesV60420=value('Notes');
    const vat=yesNoV60420(value('VAT registered'));if(vat!==null)state.business.vatRegistered=vat?'yes':'no';if(value('VAT number'))state.business.vatNumber=value('VAT number');
    state.onboarding={...state.onboarding,trialTypeV60420:model.trial,businessNameV60420:model.businessName,ownerMainContactV60420:value('Owner / main contact'),phoneV60420:value('Phone'),emailV60420:value('Email'),townAreaV60420:value('Town / area'),activeTeamCountV60420:Number(value('Number of active teams'))||model.teams.filter(row=>yesNoV60420(rowGetV60420(row,'Active'))===true).length,accountingSystemV60420:value('Current accounting system'),usesItemServiceCodesV60420:yesNoV60420(value('Uses item/service codes in accounting system'))===true,notesV60420:value('Notes')};
    state.business.onboardingMasterImportV60420={build:BUILD,fileName:fileName||model.parsed?.fileName||'',trialType:model.trial,importedAt:new Date().toISOString(),clients:model.counts.clients,teams:model.counts.teams,schedules:model.counts.schedules,billing:model.counts.billing,items:model.counts.items};
  }
  function applyTeamsV60420(model){
    state.teams=Array.isArray(state.teams)?state.teams:[];const map=new Map(),claimed=new Set(),now=new Date().toISOString();
    model.teams.forEach((row,index)=>{
      const workbookId=cleanV60420(rowGetV60420(row,'Team ID')),name=cleanV60420(rowGetV60420(row,'Team Name')),active=yesNoV60420(rowGetV60420(row,'Active'))===true;
      let team=teamMatchV60420(row,index,claimed);
      if(!team){let id=safeImportIdV60420(workbookId,'team');if(state.teams.some(item=>item.id===id))id=typeof uid==='function'?uid('team'):`team-${Date.now()}-${index}`;team={id,capacityHours:8,bufferHours:0,dailySiteCapacity:0,createdAt:now};state.teams.push(team);}
      Object.assign(team,{name,leaderName:cleanV60420(rowGetV60420(row,'Team Lead')),mobileDeviceUserV60420:cleanV60420(rowGetV60420(row,'Mobile / Device User')),mobileNumberV60420:cleanV60420(rowGetV60420(row,'Mobile Number')),accessTypeV60420:cleanV60420(rowGetV60420(row,'Access Type')),vehicleIdentifierV60420:cleanV60420(rowGetV60420(row,'Vehicle / Identifier')),notes:cleanV60420(rowGetV60420(row,'Notes')),active,onboardingTeamIdV60420:workbookId,updatedAt:now});
      claimed.add(team.id);map.set(keyV60420(workbookId),team.id);
    });
    return map;
  }
  function applyClientsV60420(model){
    state.clients=Array.isArray(state.clients)?state.clients:[];const map=new Map(),claimed=new Set(),now=new Date().toISOString();
    model.clients.forEach((row,index)=>{
      const workbookId=cleanV60420(rowGetV60420(row,'Client ID')),name=cleanV60420(rowGetV60420(row,'Client / Site Name')),type=clientKindV60420(rowGetV60420(row,'Client Type')),active=yesNoV60420(rowGetV60420(row,'Active'))===true;
      let client=clientMatchV60420(row,claimed);
      if(!client){let id=safeImportIdV60420(workbookId,'client');if(state.clients.some(item=>item.id===id))id=typeof uid==='function'?uid('client'):`client-${Date.now()}-${index}`;client={id,siteId:`site-${id}`,createdAt:now,customerType:'Not classified',clientTypeId:'Not classified',monthlyFee:0,rateAmount:0,estimatedHours:0,workTypeIds:[],serviceIds:[],customTasks:'',serviceDescription:'',gardenNotes:'',billingNotes:'',communicationPreference:'WhatsApp',completionReport:'yes',marketingAllowed:false};state.clients.push(client);}
      const onceOff=type==='Once-off';
      Object.assign(client,{name,contact:cleanV60420(rowGetV60420(row,'Contact Name')),whatsapp:cleanV60420(rowGetV60420(row,'Mobile')),email:cleanV60420(rowGetV60420(row,'Email')),address:cleanV60420(rowGetV60420(row,'Street Address')),billingAddress:client.billingAddress||cleanV60420(rowGetV60420(row,'Street Address')),suburb:cleanV60420(rowGetV60420(row,'Suburb / Area')),accessNotes:cleanV60420(rowGetV60420(row,'Site / Access Notes')),gardenNotes:cleanV60420(rowGetV60420(row,'Site / Access Notes')),accountReference:client.accountReference||workbookId,customerReference:client.customerReference||workbookId,onboardingClientIdV60420:workbookId,onboardingClientTypeV60420:type,masterActiveV60420:active,updatedAt:now,incomplete:false});
      if(!client.siteId)client.siteId=`site-${client.id}`;
      if(onceOff){client.recordKindV58951='once-off-customer';client.frequency='Ad hoc';client.fixedDay=false;client.status='archived';client.serviceState='once-off';client.teamId='';client.preferredTeamId='';client.autoScheduleEnabled=false;client.scheduleSource='onboarding-master';}
      else{client.recordKindV58951='recurring-client';client.status=active?'active':'archived';client.serviceState=active?'active':'archived';client.activationConfirmedV58961=active;client.awaitingInitialRecurringPlacementV6036=false;client.autoScheduleEnabled=active;client.scheduleSource='onboarding-master';client.schedulingPolicyV58951='onboarding-master';client.fixedDay=true;}
      claimed.add(client.id);map.set(keyV60420(workbookId),client.id);
    });
    return map;
  }
  function applyScheduleDefinitionsV60420(model,clientMap,teamMap){
    const definitions=[],now=new Date().toISOString();
    model.schedules.forEach(row=>{
      if(yesNoV60420(rowGetV60420(row,'Active'))===false)return;
      const workbookClient=cleanV60420(rowGetV60420(row,'Client ID')),workbookTeam=cleanV60420(rowGetV60420(row,'Team ID')),clientId=clientMap.get(keyV60420(workbookClient)),teamId=teamMap.get(keyV60420(workbookTeam)),client=(state.clients||[]).find(item=>item.id===clientId);if(!client||!teamId)return;
      const anchor=excelDateV60420(rowGetV60420(row,'Recurrence Anchor / Next Service Date')),preferred=dayV60420(rowGetV60420(row,'Preferred Day'),anchor),frequency=frequencyV60420(rowGetV60420(row,'Frequency')),scope=cleanV60420(rowGetV60420(row,'Service Scope / Tasks')),tasks=scopeTasksV60420(scope),services=typeof serviceIdsFromWorkV55==='function'?serviceIdsFromWorkV55([],scope):[];
      Object.assign(client,{frequency,preferredDay:preferred,fixedDay:true,recurrenceAnchorDate:anchor,serviceStartDate:anchor,teamId,preferredTeamId:teamId,serviceDescription:scope,customTasks:tasks.join('\n'),serviceIds:services,workTypeIds:typeof inferWorkTypeIdsV9==='function'?inferWorkTypeIdsV9(scope):client.workTypeIds||[],scheduleSource:'onboarding-master',schedulingPolicyV58951:'onboarding-master',autoScheduleEnabled:client.status==='active',awaitingInitialRecurringPlacementV6036:false,onboardingScheduleIdV60420:cleanV60420(rowGetV60420(row,'Schedule ID')),routeOrderV60420:Number(rowGetV60420(row,'Route Order'))||0,scheduleNotesV60420:cleanV60420(rowGetV60420(row,'Schedule Notes')),updatedAt:now});
      definitions.push({row,client,clientId,teamId,anchor,preferred,frequency,scope,tasks,services,scheduleId:cleanV60420(rowGetV60420(row,'Schedule ID')),routeOrder:Number(rowGetV60420(row,'Route Order'))||99,notes:cleanV60420(rowGetV60420(row,'Schedule Notes'))});
    });
    return definitions;
  }
  function dueForWeekV60420(def,weekStart,dates){
    if(typeof recurringFrequencyDueV5608==='function')return recurringFrequencyDueV5608(def.frequency,def.anchor,def.preferred,weekStart,dates);
    const target=dates[Math.max(0,DAYS.indexOf(def.preferred))]||dates[0];if(target<def.anchor)return false;if(def.frequency==='Weekly')return true;if(def.frequency==='Fortnightly'){const weeks=Math.floor((new Date(`${weekStart}T12:00:00`)-new Date(`${startOfWeek(def.anchor)}T12:00:00`))/(7*86400000));return weeks>=0&&weeks%2===0;}return target.slice(0,7)===def.anchor.slice(0,7);
  }
  function seedScheduleHorizonV60420(definitions){
    state.schedules=Array.isArray(state.schedules)?state.schedules:[];const today=localDateISO(),first=startOfWeek(today),horizonEnd=dateAdd(first,IMPORT_HORIZON_WEEKS*7-1),stats={created:0,updated:0,preserved:0};
    definitions.forEach(def=>{
      for(let weekIndex=0;weekIndex<IMPORT_HORIZON_WEEKS;weekIndex++){
        const weekStart=dateAdd(first,weekIndex*7),dates=weekDates(weekStart);if(!dueForWeekV60420(def,weekStart,dates))continue;
        const date=dates[Math.max(0,DAYS.indexOf(def.preferred))]||dates[0];if(date<today||date>horizonEnd)continue;
        const recurrenceKey=`${def.clientId}:${weekStart}`,protectedStatuses=new Set(['completed','cancelled','canceled','rescheduled','deferred','no-charge','access-failed']);
        let job=(state.schedules||[]).find(item=>item.clientId===def.clientId&&startOfWeek(item.date||today)===weekStart&&((item.recurrenceKey&&item.recurrenceKey===recurrenceKey)||(typeof workMarkerForJobV5546==='function'?workMarkerForJobV5546(item)==='R':item.workKind==='recurring')));
        if(job&&(job.manualOverride===true||protectedStatuses.has(keyV60420(job.status)))){stats.preserved++;continue;}
        const values={recurrenceKey,sourceOccurrenceKey:`rolling:${recurrenceKey}`,rollingWeekStartV58929:weekStart,rollingGeneratedV58929:true,date,clientId:def.clientId,teamId:def.teamId,status:'scheduled',estimatedHours:0,estimatedMinutes:0,durationUnknownV59320:true,sort:def.routeOrder,revenueType:'Recurring contract',workKind:'recurring',workMarker:'R',serviceIds:[...def.services],workTypeIds:[...(def.client.workTypeIds||[])],customTasks:def.client.customTasks||'',visitTasks:[...def.tasks],officeNotes:def.notes,autoGenerated:true,autoAssigned:false,manualOverride:false,agreementSourceV5608:'onboarding-master',onboardingMasterV60420:true,onboardingScheduleIdV60420:def.scheduleId,billingProfileIdV59396:def.client.billingProfileIdV59396||'',updatedAt:new Date().toISOString()};
        if(job){const id=job.id,createdAt=job.createdAt,audit=job.audit;Object.assign(job,values,{id,createdAt:createdAt||new Date().toISOString(),audit});stats.updated++;}
        else{job={id:typeof uid==='function'?uid('sch'):`sch-${Date.now()}-${stats.created}`,createdAt:new Date().toISOString(),...values};state.schedules.push(job);stats.created++;}
      }
    });
    try{for(let weekIndex=0;weekIndex<IMPORT_HORIZON_WEEKS;weekIndex++)typeof normaliseRouteOrderV14==='function'&&normaliseRouteOrderV14(weekDates(dateAdd(first,weekIndex*7)));}catch(_){ }
    return stats;
  }
  function applyBillingV60420(model,clientMap){
    if(!model.financial)return;
    model.billing.forEach(row=>{
      const clientId=clientMap.get(keyV60420(rowGetV60420(row,'Client ID'))),client=(state.clients||[]).find(item=>item.id===clientId);if(!client)return;
      const fee=moneyNumberV60420(rowGetV60420(row,'Routine Fee')),basis=cleanV60420(rowGetV60420(row,'Fee Basis')),basisKey=keyV60420(basis),profile=currentProfileMatchV60420(rowGetV60420(row,'Billing Profile / Entity')),cycle=invoiceCycleFromMasterV60420(rowGetV60420(row,'Invoice Cycle'),rowGetV60420(row,'Invoice Send Day'),basis),code=cleanV60420(rowGetV60420(row,'Account / Customer Code'));
      client.billingProfileIdV59396=profile?.id||client.billingProfileIdV59396||'';client.rateAmount=fee;client.routineFeeBasisV60420=basis;client.vatTreatmentV60420=cleanV60420(rowGetV60420(row,'VAT Treatment'));client.billingNotes=cleanV60420(rowGetV60420(row,'Notes'));client.invoiceCycleLabelV60420=cycle.raw;client.invoiceSendDayV60420=cycle.sendDay;client.invoiceCycleModeV58963=cycle.mode;client.invoiceCycleMode=cycle.mode;client.invoiceTiming=cycle.mode==='on_completion'?'on_completion':'business_default';client.customInvoiceDayV58963=cycle.day;
      if(basisKey==='monthly fixed'){client.monthlyFee=fee;client.priceBasis='Monthly fixed';client.billingArrangement='Monthly fixed fee';}
      else{client.monthlyFee=0;client.priceBasis='Per visit';client.billingArrangement='Per visit';}
      if(code){client.accountReference=code;client.customerReference=code;}client.onboardingClientIdV60420=cleanV60420(rowGetV60420(row,'Client ID'));client.billingSetupIncompleteV59376=false;client.billingHoldV59376=false;
      if(typeof applyBillingClassificationV59376==='function')applyBillingClassificationV59376(client);
    });
  }
  function applyItemsV60420(model){
    if(!model.financial)return;state.business=state.business||{};
    const existing=Array.isArray(state.business.quoteItemCatalogV60420)?state.business.quoteItemCatalogV60420:[],map=new Map(existing.map(item=>[keyV60420(item.code||item.id),item]));
    model.items.forEach(row=>{const code=cleanV60420(rowGetV60420(row,'Item / Service Code')),entry=map.get(keyV60420(code))||{id:safeImportIdV60420(code,'item'),code,createdAt:new Date().toISOString()};Object.assign(entry,{code,description:cleanV60420(rowGetV60420(row,'Description')),category:cleanV60420(rowGetV60420(row,'Category')),unit:cleanV60420(rowGetV60420(row,'Unit')),defaultSellingPrice:moneyNumberV60420(rowGetV60420(row,'Default Selling Price'))||0,vatTreatment:cleanV60420(rowGetV60420(row,'VAT Treatment')),accountingCode:cleanV60420(rowGetV60420(row,'Accounting / Pastel / Sage Code')),active:yesNoV60420(rowGetV60420(row,'Active'))===true,source:'onboarding-master',updatedAt:new Date().toISOString()});map.set(keyV60420(code),entry);});
    state.business.quoteItemCatalogV60420=[...map.values()];
  }
  async function commitV60420(model,fileName){
    if(model.issues.length)throw new Error('Fix the workbook issues shown before importing.');
    if(!workspaceWriteReadyV60420())throw new Error(workspaceWriteIssueV60420());
    const backup=JSON.parse(JSON.stringify(state));let teamMap,clientMap,definitions,scheduleStats;
    try{
      applyBusinessV60420(model,fileName);teamMap=applyTeamsV60420(model);clientMap=applyClientsV60420(model);definitions=applyScheduleDefinitionsV60420(model,clientMap,teamMap);applyBillingV60420(model,clientMap);applyItemsV60420(model);scheduleStats=seedScheduleHorizonV60420(definitions);
      if(typeof ensureV55State==='function')ensureV55State();if(typeof ensureV56State==='function')ensureV56State();if(typeof ensureBillingProfileStateV59396==='function')ensureBillingProfileStateV59396();
    }catch(error){state=backup;window.state=state;throw error;}
    save();
    try{typeof renderClients==='function'&&renderClients();}catch(error){console.warn('[v60.4.20] clients render',error);}try{typeof renderSchedule==='function'&&renderSchedule();}catch(error){console.warn('[v60.4.20] schedule render',error);}try{typeof renderSettings==='function'&&renderSettings();}catch(_){ }
    return {teamCount:teamMap.size,clientCount:clientMap.size,scheduleDefinitions:definitions.length,...scheduleStats};
  }

  /* ---------- plain review UI ---------- */
  let currentModelV60420=null,currentFileV60420=null;
  function injectStyleV60420(){if(document.getElementById('onboardingMasterStyleV60420'))return;const style=document.createElement('style');style.id='onboardingMasterStyleV60420';style.textContent=`
    #onboardingMasterDialogV60420 .dialog-shell{max-width:880px}
    .master-import-v60420{display:grid;gap:14px}.master-import-drop-v60420{border:1px solid #cfd8d3;border-radius:8px;padding:18px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.master-import-drop-v60420.dragging{outline:2px solid #1c684d;outline-offset:2px}.master-import-drop-v60420 strong{display:block}.master-import-drop-v60420 small{display:block;margin-top:4px;color:#64736b}.master-import-summary-v60420{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid #d9e0dc;border-radius:8px;overflow:hidden}.master-import-summary-v60420 div{padding:10px 12px;border-right:1px solid #e4e9e6}.master-import-summary-v60420 div:last-child{border-right:0}.master-import-summary-v60420 small{display:block;color:#68766f}.master-import-summary-v60420 strong{display:block;margin-top:2px;font-size:1.05rem}.master-import-status-v60420{padding:10px 12px;border:1px solid #d9e0dc;border-radius:8px;background:#f7f9f8}.master-import-status-v60420.ready{border-color:#79a993;background:#f1f8f4}.master-import-status-v60420.blocked{border-color:#d98b82;background:#fff5f3}.master-import-list-v60420{max-height:230px;overflow:auto;border:1px solid #d9e0dc;border-radius:8px;background:#fff}.master-import-list-v60420 ul{margin:0;padding:10px 12px 10px 30px}.master-import-list-v60420 li{margin:5px 0}.master-import-list-v60420 .warning{color:#6c5717}.master-import-empty-v60420{padding:14px;color:#64736b}.master-import-note-v60420{font-size:.84rem;color:#64736b}.master-import-actions-v60420{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}@media(max-width:800px){.master-import-summary-v60420{grid-template-columns:1fr 1fr}.master-import-summary-v60420 div{border-bottom:1px solid #e4e9e6}}
    .onboarding-import-entry-v60420{display:flex;justify-content:flex-end;margin:0 0 10px 0}
  `;document.head.appendChild(style);}
  function bindImportButtonV60420(button){
    if(!button||button.dataset.onboardingMasterBoundV60420==='1')return;
    button.dataset.onboardingMasterBoundV60420='1';
    button.addEventListener('click',openV60420);
  }
  function ensureUiV60420(){
    injectStyleV60420();

    // Production index contains these as static buttons so the importer is always visible.
    let clientButton=document.getElementById('openOnboardingMasterImportV60420');
    if(!clientButton){
      const actions=document.querySelector('#view-clients .heading-actions');
      if(actions){
        clientButton=document.createElement('button');
        clientButton.type='button';
        clientButton.id='openOnboardingMasterImportV60420';
        clientButton.className='button';
        clientButton.textContent='Import onboarding workbook';
        const old=document.getElementById('openSpreadsheetImporterBtn');
        actions.insertBefore(clientButton,old||null);
      }
    }
    bindImportButtonV60420(clientButton);

    let scheduleButton=document.getElementById('openScheduleOnboardingMasterImportV60420');
    if(!scheduleButton){
      const host=document.querySelector('#view-schedule');
      if(host){
        const bar=document.createElement('div');
        bar.className='onboarding-import-entry-v60420';
        bar.innerHTML='<button type="button" class="button secondary compact" id="openScheduleOnboardingMasterImportV60420">Import onboarding workbook</button>';
        const rolling=document.getElementById('rollingScheduleOverview');
        host.insertBefore(bar,rolling||host.firstChild);
        scheduleButton=bar.querySelector('button');
      }
    }
    bindImportButtonV60420(scheduleButton);

    if(!document.getElementById('onboardingMasterDialogV60420')){
      const dialog=document.createElement('dialog');dialog.id='onboardingMasterDialogV60420';dialog.className='dialog large-dialog';dialog.innerHTML=`<div class="dialog-shell"><div class="dialog-heading"><div><span class="eyebrow">Business setup import</span><h2>Import TuinBooks onboarding workbook</h2><p>Imports the linked business snapshot. Nothing changes until you review the preview and click Import.</p></div><button type="button" class="icon-button" data-close aria-label="Close">×</button></div><div class="master-import-v60420"><div id="masterImportDropV60420" class="master-import-drop-v60420"><div><strong id="masterImportFileNameV60420">Choose the completed onboarding workbook</strong><small>.xlsx · START, CLIENTS, SCHEDULE and TEAMS; financial sheets when selected</small></div><div><input id="masterImportFileV60420" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden><button type="button" class="button secondary" id="chooseMasterImportV60420">Choose workbook</button></div></div><div id="masterImportPreviewV60420" class="master-import-empty-v60420">No workbook selected.</div><p class="master-import-note-v60420">Import updates matching records and keeps existing history. It never deletes old jobs, completed work, quotes or invoices.</p><div class="master-import-actions-v60420"><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button" id="commitMasterImportV60420" disabled>Import business snapshot</button></div></div></div>`;document.body.appendChild(dialog);
      dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
      document.getElementById('chooseMasterImportV60420').addEventListener('click',()=>document.getElementById('masterImportFileV60420').click());
      document.getElementById('masterImportFileV60420').addEventListener('change',event=>readFileV60420(event.target.files?.[0]));
      document.getElementById('commitMasterImportV60420').addEventListener('click',commitFromUiV60420);
      const drop=document.getElementById('masterImportDropV60420');
      ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragging');}));
      ['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragging');}));
      drop.addEventListener('drop',event=>readFileV60420(event.dataTransfer?.files?.[0]));
    }
  }
  function openV60420(){ensureUiV60420();if(!workspaceWriteReadyV60420()){toast(workspaceWriteIssueV60420(),'error');return;}currentModelV60420=null;currentFileV60420=null;document.getElementById('masterImportFileV60420').value='';document.getElementById('masterImportFileNameV60420').textContent='Choose the completed onboarding workbook';document.getElementById('masterImportPreviewV60420').className='master-import-empty-v60420';document.getElementById('masterImportPreviewV60420').innerHTML='No workbook selected.';document.getElementById('commitMasterImportV60420').disabled=true;document.getElementById('onboardingMasterDialogV60420').showModal();}
  function renderPreviewV60420(model){
    const host=document.getElementById('masterImportPreviewV60420'),ready=!model.issues.length,financial=model.financial;
    const summary=[['Clients',model.counts.clients||0],['Teams',model.counts.teams||0],['Schedules',model.counts.schedules||0],['Billing',financial?model.counts.billing||0:'Not required'],['Item codes',financial?model.counts.items||0:'Not required']];
    host.className='';host.innerHTML=`<div class="master-import-status-v60420 ${ready?'ready':'blocked'}"><strong>${ready?'READY TO IMPORT':'IMPORT BLOCKED'}</strong><div>${htmlV60420(model.businessName||'Business name missing')} · ${htmlV60420(model.trial||'Trial type missing')}</div></div><div class="master-import-summary-v60420">${summary.map(([label,value])=>`<div><small>${htmlV60420(label)}</small><strong>${htmlV60420(value)}</strong></div>`).join('')}</div>${model.issues.length?`<div><strong>Fix before import (${model.issues.length})</strong><div class="master-import-list-v60420"><ul>${model.issues.map(issue=>`<li>${htmlV60420(issue)}</li>`).join('')}</ul></div></div>`:''}${model.warnings.length?`<div><strong>Notes</strong><div class="master-import-list-v60420"><ul>${model.warnings.map(warning=>`<li class="warning">${htmlV60420(warning)}</li>`).join('')}</ul></div></div>`:''}`;
    document.getElementById('commitMasterImportV60420').disabled=!ready;
  }
  async function readFileV60420(file){
    if(!file)return;if(!/\.xlsx$/i.test(file.name)){toast('Choose the .xlsx TuinBooks onboarding workbook.','error');return;}currentFileV60420=file;document.getElementById('masterImportFileNameV60420').textContent=file.name;const host=document.getElementById('masterImportPreviewV60420');host.className='master-import-status-v60420';host.innerHTML='<strong>Reading workbook…</strong>';document.getElementById('commitMasterImportV60420').disabled=true;
    try{const parsed=await parseXlsxV60420(file);parsed.fileName=file.name;currentModelV60420=modelV60420(parsed);renderPreviewV60420(currentModelV60420);}catch(error){console.error('[v60.4.20] workbook read',error);currentModelV60420=null;host.className='master-import-status-v60420 blocked';host.innerHTML=`<strong>Could not read workbook</strong><div>${htmlV60420(error?.message||error)}</div>`;toast(error?.message||'Could not read workbook.','error');}
  }
  async function commitFromUiV60420(){
    if(!currentModelV60420||currentModelV60420.issues.length)return;const button=document.getElementById('commitMasterImportV60420');button.disabled=true;button.textContent='Importing…';
    try{const result=await commitV60420(currentModelV60420,currentFileV60420?.name||'');document.getElementById('onboardingMasterDialogV60420').close();toast(`Onboarding imported: ${result.clientCount} clients, ${result.teamCount} teams, ${result.scheduleDefinitions} routine patterns. ${result.created} upcoming visits created.`);}
    catch(error){console.error('[v60.4.20] onboarding import',error);toast(error?.message||'The onboarding import failed.','error');button.disabled=false;}
    finally{button.textContent='Import business snapshot';}
  }

  function installV60420(){ensureUiV60420();const scheduleHost=document.getElementById('rollingScheduleOverview');if(scheduleHost&&!scheduleHost.dataset.masterImportObserverV60420){scheduleHost.dataset.masterImportObserverV60420='1';new MutationObserver(()=>ensureUiV60420()).observe(scheduleHost,{childList:true,subtree:true});}window.__tuinbooksOnboardingMasterImportV60420={...publicParser,modelV60420,commitV60420,build:BUILD};document.documentElement.dataset.onboardingMasterImport='v60420';}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installV60420,{once:true});else installV60420();
})();
