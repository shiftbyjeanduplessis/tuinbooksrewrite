const dec = new TextDecoder(), enc = new TextEncoder();
function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0; }
async function inflateRaw(bytes) { const DS = globalThis.DecompressionStream; if (!DS)
    throw new Error('This browser cannot decompress .xlsx files. Use a current Chrome/Edge browser.'); const stream = new Blob([bytes]).stream().pipeThrough(new DS('deflate-raw')); return new Uint8Array(await new Response(stream).arrayBuffer()); }
async function unzip(bytes) { let eocd = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--)
    if (u32(bytes, i) === 0x06054b50) {
        eocd = i;
        break;
    } if (eocd < 0)
    throw new Error('Invalid .xlsx ZIP container.'); const count = u16(bytes, eocd + 10), central = u32(bytes, eocd + 16), files = new Map(); let p = central; for (let i = 0; i < count; i++) {
    if (u32(bytes, p) !== 0x02014b50)
        throw new Error('Invalid .xlsx central directory.');
    const method = u16(bytes, p + 10), compressed = u32(bytes, p + 20), nameLen = u16(bytes, p + 28), extra = u16(bytes, p + 30), comment = u16(bytes, p + 32), local = u32(bytes, p + 42), name = dec.decode(bytes.slice(p + 46, p + 46 + nameLen));
    const localName = u16(bytes, local + 26), localExtra = u16(bytes, local + 28), start = local + 30 + localName + localExtra, packed = bytes.slice(start, start + compressed);
    files.set(name, method === 0 ? packed : method === 8 ? await inflateRaw(packed) : (() => { throw new Error(`Unsupported ZIP compression method ${method}.`); })());
    p += 46 + nameLen + extra + comment;
} return files; }
function xmlText(files, path) { const raw = files.get(path); if (!raw)
    throw new Error(`Workbook part missing: ${path}`); return dec.decode(raw); }
function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
function attrs(raw) { const out = {}; for (const m of raw.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g))
    out[m[1]] = unesc(m[2]); return out; }
function tagTexts(xml, name) { const out = []; const re = new RegExp(`<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`, 'g'); for (const m of xml.matchAll(re))
    out.push(unesc(m[1].replace(/<[^>]+>/g, ''))); return out; }
function cellColumn(ref) { let n = 0; for (const ch of ref.match(/[A-Z]+/i)?.[0] ?? 'A')
    n = n * 26 + ch.toUpperCase().charCodeAt(0) - 64; return n - 1; }
export async function readXlsx(file) {
    const files = await unzip(new Uint8Array(await file.arrayBuffer())), wb = xmlText(files, 'xl/workbook.xml'), rels = xmlText(files, 'xl/_rels/workbook.xml.rels');
    const relMap = new Map();
    for (const m of rels.matchAll(/<(?:(?:\w+):)?Relationship\b([^>]*)\/?\s*>/g)) {
        const a = attrs(m[1]);
        if (a.Id && a.Target)
            relMap.set(a.Id, a.Target);
    }
    const shared = files.has('xl/sharedStrings.xml') ? [...xmlText(files, 'xl/sharedStrings.xml').matchAll(/<(?:(?:\w+):)?si\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?si>/g)].map(m => tagTexts(m[1], 't').join('')) : [];
    const out = {};
    for (const sm of wb.matchAll(/<(?:(?:\w+):)?sheet\b([^>]*)\/?\s*>/g)) {
        const a = attrs(sm[1]), name = a.name ?? '', rid = a['r:id'] ?? '';
        const target = relMap.get(rid);
        if (!target)
            continue;
        const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`.replace(/xl\/xl\//, 'xl/'), sx = xmlText(files, path), rows = [];
        for (const rm of sx.matchAll(/<(?:(?:\w+):)?row\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?row>/g)) {
            const ra = attrs(rm[1]), ri = Math.max(0, Number(ra.r ?? rows.length + 1) - 1);
            while (rows.length <= ri)
                rows.push([]);
            const body = rm[2];
            for (const cm of body.matchAll(/<(?:(?:\w+):)?c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/(?:(?:\w+):)?c>)/g)) {
                const ca = attrs(cm[1]), ci = cellColumn(ca.r ?? 'A1'), t = ca.t ?? '', inner = cm[2] ?? '', v = tagTexts(inner, 'v')[0] ?? '', inline = tagTexts(inner, 't').join('');
                let value = null;
                if (t === 's')
                    value = shared[Number(v)] ?? '';
                else if (t === 'inlineStr')
                    value = inline;
                else if (t === 'str')
                    value = v;
                else if (t === 'b')
                    value = v === '1';
                else if (v !== '')
                    value = Number.isFinite(Number(v)) ? Number(v) : v;
                while (rows[ri].length <= ci)
                    rows[ri].push(null);
                rows[ri][ci] = value;
            }
        }
        out[name] = rows;
    }
    return out;
}
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function colName(n) { let s = ''; for (n++; n; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; }
function sheetXml(rows) { const body = rows.map((row, ri) => { const cells = row.map((v, ci) => { if (v == null || v === '')
    return ''; const ref = `${colName(ci)}${ri + 1}`; if (typeof v === 'number')
    return `<c r="${ref}"><v>${v}</v></c>`; if (typeof v === 'boolean')
    return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`; return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`; }).join(''); return cells ? `<row r="${ri + 1}">${cells}</row>` : ''; }).join(''); return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`; }
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++)
        c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
} return (c ^ 0xffffffff) >>> 0; }
function set16(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; }
function set32(a, o, v) { set16(a, o, v); set16(a, o + 2, v >>> 16); }
function zipStore(files) { const localParts = [], centralParts = []; let offset = 0; for (const [name, text] of files) {
    const nb = enc.encode(name), db = enc.encode(text), crc = crc32(db), lh = new Uint8Array(30 + nb.length);
    set32(lh, 0, 0x04034b50);
    set16(lh, 4, 20);
    set16(lh, 8, 0);
    set32(lh, 14, crc);
    set32(lh, 18, db.length);
    set32(lh, 22, db.length);
    set16(lh, 26, nb.length);
    lh.set(nb, 30);
    localParts.push(lh, db);
    const ch = new Uint8Array(46 + nb.length);
    set32(ch, 0, 0x02014b50);
    set16(ch, 4, 20);
    set16(ch, 6, 20);
    set16(ch, 10, 0);
    set32(ch, 16, crc);
    set32(ch, 20, db.length);
    set32(ch, 24, db.length);
    set16(ch, 28, nb.length);
    set32(ch, 42, offset);
    ch.set(nb, 46);
    centralParts.push(ch);
    offset += lh.length + db.length;
} const centralSize = centralParts.reduce((s, x) => s + x.length, 0), end = new Uint8Array(22); set32(end, 0, 0x06054b50); set16(end, 8, files.length); set16(end, 10, files.length); set32(end, 12, centralSize); set32(end, 16, offset); return new Blob([...localParts, ...centralParts, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); }
export function createXlsx(sheets) { const overrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join(''), sheetDefs = sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join(''), rels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join(''); const files = [['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`], ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'], ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetDefs}</sheets></workbook>`], ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`]]; sheets.forEach((s, i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)])); return zipStore(files); }
export function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
//# sourceMappingURL=xlsx.js.map