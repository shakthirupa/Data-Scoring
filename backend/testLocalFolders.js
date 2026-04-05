const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = 'E:\\test data scoring\\Mtech CSE data';

function extractAadhaarFromText(text) {
  const spaced = text.match(/(\d{4}[\s-]\d{4}[\s-]\d{4})/);
  if (spaced) return spaced[1].replace(/[\s-]/g, '');
  const allTwelve = [...text.matchAll(/(\d{12})/g)].map(m => m[1]);
  const aadhaarLike = allTwelve.filter(n => !/^[6-9]/.test(n));
  return aadhaarLike[0] || allTwelve[0] || null;
}

function aadhaarMatch(text, aadhaar) {
  if (!text || !aadhaar) return false;
  const a = aadhaar.replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(a)) return false;
  const spaced = `${a.slice(0,4)} ${a.slice(4,8)} ${a.slice(8,12)}`;
  if (text.includes(spaced)) return true;
  if (text.includes(a)) return true;
  if ([...text.matchAll(/(\d{12})/g)].some(m => m[1] === a)) return true;
  return [...text.matchAll(/(\d{8})/g)].some(m => m[1] === a.slice(4));
}

function extractExcelText(filePath) {
  const wb = XLSX.readFile(filePath, { cellText: false, cellDates: true });
  const parts = [];
  for (const s of wb.SheetNames) {
    const ws = wb.Sheets[s];
    for (const k of Object.keys(ws)) {
      if (k.startsWith('!')) continue;
      const c = ws[k];
      if (c && c.v !== undefined && c.v !== null && c.v !== '') parts.push(String(c.v));
    }
  }
  return parts.join(' ');
}

function extractFields(text) {
  const aadhaar = extractAadhaarFromText(text);
  const pan     = text.toUpperCase().match(/\b([A-Z]{5}\d{4}[A-Z])\b/)?.[1] || null;
  const phone   = text.match(/\b([6-9]\d{9})\b/)?.[1] || null;
  const name    = text.match(/Name\s*:\s*([A-Za-z][A-Za-z\s.]{2,50})(?=Roll|Reg|Date|\n)/i)?.[1]?.trim() || null;
  return { aadhaar, pan, phone, name };
}

function walk(dir) {
  const files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

async function main() {
  const pdfParse = require('pdf-parse');
  const { ocrPdf, ocrImage } = require('./utils/pdfOcr');

  const folders = fs.readdirSync(ROOT).filter(f => {
    const rollMatch = f.match(/\b(\d{6}[A-Z]{4}\d{3})\b/i);
    return rollMatch && fs.statSync(path.join(ROOT, f)).isDirectory();
  });

  console.log(`Found ${folders.length} student folder(s)\n`);
  const results = [];

  for (const folder of folders) {
    const rollMatch = folder.match(/\b(\d{6}[A-Z]{4}\d{3})\b/i);
    const roll = rollMatch[1].toUpperCase();

    const allFiles = walk(path.join(ROOT, folder));
    console.log(`[${roll}] ${allFiles.length} file(s): ${allFiles.map(f => path.basename(f)).join(', ')}`);

    let combinedText = '';
    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      try {
        if (ext === '.xlsx' || ext === '.xls') {
          const t = extractExcelText(file);
          console.log(`  xlsx: ${path.basename(file)} → ${t.length} chars`);
          combinedText += ' ' + t;
        } else if (ext === '.pdf') {
          const buf = fs.readFileSync(file);
          const d = await pdfParse(buf);
          const t = d.text.trim();
          const text = t.length > 30 ? t : await ocrPdf(file);
          console.log(`  pdf: ${path.basename(file)} → ${text.length} chars (${t.length > 30 ? 'native' : 'ocr'})`);
          combinedText += ' ' + text;
        } else if (['.jpg','.jpeg','.png','.bmp','.webp','.tiff'].includes(ext)) {
          const text = await ocrImage(file);
          console.log(`  img: ${path.basename(file)} → ${text.length} chars`);
          combinedText += ' ' + text;
        } else {
          console.log(`  skip: ${path.basename(file)} (unsupported ext: ${ext})`);
        }
      } catch (e) {
        console.error(`  ERROR processing ${path.basename(file)}: ${e.message}`);
      }
    }

    const { aadhaar, pan, phone, name } = extractFields(combinedText);
    const aadhaarVerified = aadhaar ? aadhaarMatch(combinedText, aadhaar) : null;

    results.push({
      roll,
      folder: folder.slice(0, 40),
      name:   name || '—',
      aadhaar: aadhaar || '—',
      pan:     pan    || '—',
      phone:   phone  || '—',
      aadhaarSelfMatch: aadhaarVerified,
      files: allFiles.map(f => path.basename(f)).join(', '),
    });

    process.stdout.write(`✓ ${roll}\n`);
  }

  console.log('\n=== RESULTS ===');
  for (const r of results) {
    const ok = r.aadhaar !== '—';
    console.log(`${ok ? '✅' : '❌'} ${r.roll} | ${r.name} | aadhaar:${r.aadhaar} | pan:${r.pan} | phone:${r.phone}`);
  }

  const missing = results.filter(r => r.aadhaar === '—');
  console.log(`\nTotal: ${results.length} | With Aadhaar: ${results.length - missing.length} | Missing: ${missing.length}`);
  if (missing.length) {
    console.log('\nMissing Aadhaar:');
    missing.forEach(r => console.log(`  ❌ ${r.roll} | ${r.name} | files: ${r.files}`));
  }
}

main().catch(console.error);
