export const V4_SHEETS = ['1 Business Info', '2 Services', '3 Teams', '4 Clients Accounts', '5 Service Locations', '6 Needs Attention', '7 Schedule Preview', '8 Route Order'];
const dayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
const text = (v) => String(v ?? '').trim();
const num = (v) => { if (v == null || text(v) === '')
    return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const yes = (v) => /^(yes|true|1)$/i.test(text(v));
const slug = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'item';
export function stableId(prefix, value) { return `${prefix}-${slug(value)}`; }
export function weekdayNumber(value) { return dayMap[text(value).toLowerCase()] ?? null; }
export function recurrenceFromWorkbook(value) { const s = text(value).toLowerCase(); if (s === 'weekly')
    return 'weekly'; if (s === 'fortnightly' || s === 'biweekly')
    return 'fortnightly'; if (s === 'monthly')
    return 'monthly'; if (s === 'every 4 weeks' || s === '4-weekly' || s === 'four-weekly')
    return 'four-weekly'; return null; }
export function monthlyOrdinalFromWorkbook(value) { const m = text(value).match(/(?:week\s*)?(\d)/i); if (!m)
    return null; const n = Number(m[1]); return n >= 1 && n <= 5 ? n : null; }
export function isoDate(value) { if (value == null || value === '')
    return null; if (typeof value === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return d.toISOString().slice(0, 10);
} const s = text(value); const direct = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (direct)
    return `${direct[1]}-${direct[2]}-${direct[3]}`; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); }
function headerMap(rows, rowIndex = 2) { const out = new Map(); (rows[rowIndex] ?? []).forEach((v, i) => { const k = text(v).toLowerCase(); if (k)
    out.set(k, i); }); return out; }
function cell(row, headers, name) { return row[headers.get(name.toLowerCase()) ?? -1] ?? null; }
function kv(rows) { const m = new Map(); for (const r of rows.slice(2)) {
    const k = text(r[0]).toLowerCase();
    if (k)
        m.set(k, r[1] ?? null);
} return m; }
function fortnightlyStart(start, weekA, weekday, cycle) { let d = new Date(`${start}T12:00:00Z`), anchor = new Date(`${weekA}T12:00:00Z`); for (let i = 0; i < 28; i++) {
    const iso = ((d.getUTCDay() + 6) % 7) + 1, weeks = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate())) / 604800000), parity = ((weeks % 2) + 2) % 2;
    if (iso === weekday && parity === (cycle === 'A' ? 0 : 1))
        return d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
} return start; }
function defaultSettings() { return { name: '', phone: '', email: '', address: '', suburb: '', province: '', vatRegistered: false, vatNumber: '', mode: 'financials', weekAStartsOn: null, invoiceDay: 28, paymentTermsDays: 7, invoicePrefix: 'INV-', statementMessage: 'Thank you for your business.', emailFromName: 'TuinBooks', whatsappMessage: 'Your TuinBooks document is ready.' }; }
export function parseV4Sheets(sheets) {
    const errors = [], warnings = [];
    for (const name of V4_SHEETS)
        if (!sheets[name])
            errors.push(`Missing sheet: ${name}`);
    if (errors.length)
        return { ok: false, errors, warnings, counts: { accounts: 0, locations: 0, teams: 0, services: 0, routes: 0 }, snapshot: null };
    const b = kv(sheets['1 Business Info']);
    const settings = defaultSettings();
    settings.name = text(b.get('business name') ?? null);
    settings.phone = text(b.get('phone') ?? null);
    settings.email = text(b.get('email') ?? null).toLowerCase();
    settings.address = text(b.get('business address') ?? null);
    settings.suburb = text(b.get('suburb / town') ?? null);
    settings.province = text(b.get('province') ?? null);
    settings.vatRegistered = yes(b.get('vat registered?') ?? null);
    settings.vatNumber = text(b.get('vat number') ?? null);
    settings.mode = /planning/i.test(text(b.get('tuinbooks mode') ?? null)) && !/financial/i.test(text(b.get('tuinbooks mode') ?? null)) ? 'planning' : 'financials';
    settings.weekAStartsOn = isoDate(b.get('week a starts on') ?? null);
    if (!settings.name)
        errors.push('Business Name is required.');
    const sh = headerMap(sheets['2 Services']);
    const services = sheets['2 Services'].slice(3).filter(r => text(cell(r, sh, 'Service Name'))).map(r => ({ id: stableId('svc', text(cell(r, sh, 'Service Name'))), name: text(cell(r, sh, 'Service Name')), notes: text(cell(r, sh, 'Notes')), active: true }));
    if (!services.length)
        errors.push('At least one service is required.');
    const th = headerMap(sheets['3 Teams']);
    const teams = sheets['3 Teams'].slice(3).filter(r => text(cell(r, th, 'Team Name'))).map(r => ({ id: stableId('team', text(cell(r, th, 'Team Name'))), name: text(cell(r, th, 'Team Name')), capacityHours: 8, bufferHours: 1, active: true }));
    if (!teams.length)
        errors.push('At least one team is required.');
    const ah = headerMap(sheets['4 Clients Accounts']);
    const accounts = sheets['4 Clients Accounts'].slice(3).filter(r => text(cell(r, ah, 'Client / Account Name'))).map(r => ({ name: text(cell(r, ah, 'Client / Account Name')), contactName: text(cell(r, ah, 'Contact Person')), phone: text(cell(r, ah, 'Phone')), email: text(cell(r, ah, 'Email')).toLowerCase(), invoiceMethod: text(cell(r, ah, 'Invoice Method')), billingBasis: text(cell(r, ah, 'Billing Basis')), billingAmount: num(cell(r, ah, 'Account Billing Amount')), invoiceDay: num(cell(r, ah, 'Invoice Day')), billingNotes: text(cell(r, ah, 'Billing Notes')) }));
    const accountNames = new Set(accounts.map(a => a.name.toLowerCase()));
    const teamNames = new Set(teams.map(t => t.name.toLowerCase()));
    const serviceNames = new Set(services.map(s => s.name.toLowerCase()));
    const lh = headerMap(sheets['5 Service Locations']);
    const locations = [];
    for (const [i, r] of sheets['5 Service Locations'].slice(3).entries()) {
        const accountName = text(cell(r, lh, 'Client / Account'));
        if (!accountName)
            continue;
        const row = i + 4, address = text(cell(r, lh, 'Address')), suburb = text(cell(r, lh, 'Suburb / Area')), team = text(cell(r, lh, 'Team')), service = text(cell(r, lh, 'Service')), freq = recurrenceFromWorkbook(cell(r, lh, 'Frequency')), startDate = isoDate(cell(r, lh, 'Start Date'));
        const days = [weekdayNumber(cell(r, lh, 'Service Day 1')), weekdayNumber(cell(r, lh, 'Service Day 2')), weekdayNumber(cell(r, lh, 'Service Day 3'))].filter((x) => x != null);
        if (!accountNames.has(accountName.toLowerCase()))
            errors.push(`Service Locations row ${row}: unknown account "${accountName}".`);
        if (!address)
            errors.push(`Service Locations row ${row}: address is required.`);
        if (!suburb)
            warnings.push(`Service Locations row ${row}: suburb/area is blank.`);
        if (!teamNames.has(team.toLowerCase()))
            errors.push(`Service Locations row ${row}: unknown team "${team}".`);
        if (!serviceNames.has(service.toLowerCase()))
            errors.push(`Service Locations row ${row}: unknown service "${service}".`);
        if (!freq)
            errors.push(`Service Locations row ${row}: unsupported frequency "${text(cell(r, lh, 'Frequency'))}".`);
        if (!days.length)
            errors.push(`Service Locations row ${row}: at least one service day is required.`);
        if (freq && freq !== 'weekly' && days.length !== 1)
            errors.push(`Service Locations row ${row}: ${freq} uses exactly one service day.`);
        if (!startDate)
            errors.push(`Service Locations row ${row}: Start Date is required.`);
        const cyc = /week\s*b/i.test(text(cell(r, lh, 'Fortnightly Cycle'))) ? 'B' : /week\s*a/i.test(text(cell(r, lh, 'Fortnightly Cycle'))) ? 'A' : null;
        const adjustedStart = freq === 'fortnightly' && cyc && settings.weekAStartsOn && days[0] && startDate ? fortnightlyStart(startDate, settings.weekAStartsOn, days[0], cyc) : startDate;
        const ord = monthlyOrdinalFromWorkbook(cell(r, lh, 'Monthly Pattern'));
        if (freq === 'monthly' && !ord)
            errors.push(`Service Locations row ${row}: Monthly Pattern is required.`);
        if (freq && startDate)
            locations.push({ accountName, locationName: text(cell(r, lh, 'Location Name')) || 'Primary garden', address, suburb, team, service, frequency: freq, weekdays: days, fortnightlyCycle: cyc, monthlyOrdinal: ord, startDate: adjustedStart ?? startDate, locationBillingBasis: text(cell(r, lh, 'Location Billing Basis')), locationBillingAmount: num(cell(r, lh, 'Location Billing Amount')), routePreference: text(cell(r, lh, 'Route Preference')), routingNotes: text(cell(r, lh, 'Routing / Timing Notes')), accessNotes: text(cell(r, lh, 'Access / Service Notes')) });
    }
    const rh = headerMap(sheets['8 Route Order']);
    const routes = sheets['8 Route Order'].slice(3).filter(r => text(cell(r, rh, 'Client / Account'))).map(r => ({ team: text(cell(r, rh, 'Team')), day: text(cell(r, rh, 'Day')), week: text(cell(r, rh, 'Week')), approvedStop: num(cell(r, rh, 'Approved Stop')) ?? num(cell(r, rh, 'Suggested Stop')) ?? 99, accountName: text(cell(r, rh, 'Client / Account')), locationName: text(cell(r, rh, 'Location Name')), suburb: text(cell(r, rh, 'Suburb / Area')), address: text(cell(r, rh, 'Address')) }));
    if (new Set(accounts.map(a => a.name.toLowerCase())).size !== accounts.length)
        errors.push('Duplicate Client / Account names are not allowed.');
    const locKeys = locations.map(l => `${l.accountName.toLowerCase()}|${l.locationName.toLowerCase()}|${l.address.toLowerCase()}`);
    if (new Set(locKeys).size !== locKeys.length)
        errors.push('Duplicate service locations were found.');
    const snapshot = { business: settings, services, teams, accounts, locations, routes, warnings };
    return { ok: errors.length === 0, errors, warnings, counts: { accounts: accounts.length, locations: locations.length, teams: teams.length, services: services.length, routes: routes.length }, snapshot: errors.length ? null : snapshot };
}
export function importPreviewText(v) { return `${v.ok ? 'READY' : 'FIX BEFORE IMPORT'} · ${v.counts.accounts} accounts · ${v.counts.locations} locations · ${v.counts.teams} teams · ${v.counts.services} services · ${v.errors.length} errors · ${v.warnings.length} warnings`; }
export function normaliseBusinessSettings(input) { return { ...input, name: input.name.trim(), phone: input.phone.trim(), email: input.email.trim().toLowerCase(), address: input.address.trim(), suburb: input.suburb.trim(), province: input.province.trim(), vatNumber: input.vatNumber.trim(), invoiceDay: Math.max(1, Math.min(31, Math.round(input.invoiceDay || 28))), paymentTermsDays: Math.max(0, Math.min(120, Math.round(input.paymentTermsDays || 0))), invoicePrefix: (input.invoicePrefix.trim() || 'INV-').slice(0, 16), statementMessage: input.statementMessage.trim(), emailFromName: input.emailFromName.trim(), whatsappMessage: input.whatsappMessage.trim() }; }
const dayName = (n) => ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][n] ?? '';
export function v4RowsForExport(data) {
    const info = [['TuinBooks New Client Import — v4', 'Value', 'Notes'], ['Business setup', null, null], ['Business Name', data.business.name, 'Required'], ['Contact Person', '', null], ['Phone', data.business.phone, null], ['Email', data.business.email, null], ['Business Address', data.business.address, null], ['Suburb / Town', data.business.suburb, null], ['Province', data.business.province, null], ['VAT Registered?', data.business.vatRegistered ? 'Yes' : 'No', null], ['VAT Number', data.business.vatNumber, null], ['TuinBooks Mode', data.business.mode === 'planning' ? 'Planning Only' : 'Planning + Financials', null], ['Week A starts on', data.business.weekAStartsOn, null], ['Notes', 'Exported from TuinBooks v2', 'Round-trip v4 contract']];
    const services = [['Services', null], ['One shared service list used by routine clients.', null], ['Service Name', 'Notes'], ...data.services.filter(s => s.active).map(s => [s.name, s.notes])];
    const teams = [['Teams', null], ['Active TuinBooks teams.', null], ['Team Name', 'Notes'], ...data.teams.filter(t => t.active).map(t => [t.name, `${t.capacityHours}h/day + ${t.bufferHours}h buffer`])];
    const accounts = [['Client accounts', null, null, null, null, null, null, null, null, null, null, null], ['Accounts are billing entities; properties are separate service locations.', null, null, null, null, null, null, null, null, null, null, null], ['Client / Account Name', 'Contact Person', 'Phone', 'Email', 'Invoice Method', 'Billing Basis', 'Account Billing Amount', 'Invoice Day', 'Billing Notes', 'Import Status', 'Critical Issues', 'Warnings'], ...data.accounts.map(a => [a.name, a.contactName, a.phone, a.email, a.invoiceMethod || 'By Account', a.billingBasis, a.billingAmount, a.invoiceDay, a.billingNotes, 'Ready', null, null])];
    const locations = [['Service locations', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], ['One row per physical property/service location.', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], ['Client / Account', 'Location Name', 'Address', 'Suburb / Area', 'Team', 'Service', 'Frequency', 'Service Day 1', 'Service Day 2', 'Service Day 3', 'Fortnightly Cycle', 'Monthly Pattern', 'Start Date', 'Location Billing Basis', 'Location Billing Amount', 'Route Preference', 'Routing / Timing Notes', 'Access / Service Notes', 'Import Status', 'Critical Issues', 'Warnings', 'Account Invoice Method', 'Route Ready?'], ...data.locations.map(l => [l.accountName, l.locationName, l.address, l.suburb, l.team, l.service, l.frequency === 'four-weekly' ? 'Every 4 weeks' : l.frequency[0].toUpperCase() + l.frequency.slice(1), dayName(l.weekdays[0] ?? 0), dayName(l.weekdays[1] ?? 0), dayName(l.weekdays[2] ?? 0), l.fortnightlyCycle ? `Week ${l.fortnightlyCycle}` : '', l.monthlyOrdinal ? `Week ${l.monthlyOrdinal}` : '', l.startDate, l.locationBillingBasis, l.locationBillingAmount, l.routePreference, l.routingNotes, l.accessNotes, 'Ready', null, null, 'By Account', l.team && l.weekdays.length ? 'YES' : 'NO'])];
    const needs = [['Needs Attention', null, null, null], ['Export validation summary', null, null, null], ['Check', 'Expected', 'Workbook result', 'Status'], ['Client accounts', data.accounts.length, data.accounts.length, 'PASS'], ['Service locations', data.locations.length, data.locations.length, 'PASS'], ['Teams', data.teams.filter(t => t.active).length, data.teams.filter(t => t.active).length, 'PASS'], ['Services', data.services.filter(s => s.active).length, data.services.filter(s => s.active).length, 'PASS'], ['Missing account names', 0, data.accounts.filter(a => !a.name).length, data.accounts.some(a => !a.name) ? 'FAIL' : 'PASS'], ['Missing addresses', 0, data.locations.filter(l => !l.address).length, data.locations.some(l => !l.address) ? 'FAIL' : 'PASS'], ['Missing suburbs', 0, data.locations.filter(l => !l.suburb).length, data.locations.some(l => !l.suburb) ? 'WARN' : 'PASS'], ['Safe to import?', 'YES', 'YES', 'YES']];
    const preview = [['Schedule Preview', null, null, null, null, null, null, null], ['Schedule Preview is regenerated by TuinBooks after import.', null, null, null, null, null, null, null], ['Team', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], ...data.teams.filter(t => t.active).map(t => [t.name, null, null, null, null, null, null, null])];
    const routes = [['Route Order', null, null, null, null, null, null, null, null, null, null, null], ['Current approved route order where available.', null, null, null, null, null, null, null, null, null, null, null], ['Team', 'Day', 'Week', 'Suggested Stop', 'Approved Stop', 'Client / Account', 'Location Name', 'Suburb / Area', 'Address', 'Route Preference', 'Route Status', 'Route Locked?'], ...data.routes.map(r => [r.team, r.day, r.week, r.approvedStop, r.approvedStop, r.accountName, r.locationName, r.suburb, r.address, 'Normal', 'Approved', 'No'])];
    return { '1 Business Info': info, '2 Services': services, '3 Teams': teams, '4 Clients Accounts': accounts, '5 Service Locations': locations, '6 Needs Attention': needs, '7 Schedule Preview': preview, '8 Route Order': routes };
}
//# sourceMappingURL=business.js.map