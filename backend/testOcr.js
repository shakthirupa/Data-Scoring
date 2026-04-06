const fs = require('fs');
const pdfParse = require('pdf-parse');
const { ocrPdf } = require('./utils/pdfOcr');

const PDF_PATH = 'E:\\test data scoring\\Mtech CSE data\\727723EUCI001-AFSHAAN NABEEHA K-20260330T045810Z-1-001\\727723EUCI001-AFSHAAN NABEEHA K\\DOC-20241001-WA0006(1).pdf';

// Aadhaar: 12 consecutive digits (may be space-separated in groups of 4)
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;

async function run() {
  console.log('Reading PDF:', PDF_PATH);

  let text = '';

  // Try text extraction first
  try {
    const d = await pdfParse(fs.readFileSync(PDF_PATH));
    text = d.text.trim();
    console.log(`[pdf-parse] extracted ${text.length} chars`);
  } catch (e) {
    console.log('[pdf-parse] failed:', e.message);
  }

  // Fall back to OCR if text is too short
  if (text.length <= 30) {
    console.log('[OCR] text too short, running OCR...');
    text = await ocrPdf(PDF_PATH);
    console.log(`[OCR] extracted ${text.length} chars`);
  }

  console.log('\n--- Extracted Text (first 1000 chars) ---');
  console.log(text.slice(0, 1000));
  console.log('---');

  // Search for Aadhaar
  const matches = text.match(AADHAAR_REGEX);
  if (matches && matches.length > 0) {
    console.log('\n✅ AADHAAR VERIFIED — found:', matches[0]);
  } else {
    // Try stripping all spaces and searching for 12-digit number
    const stripped = text.replace(/\s/g, '');
    const rawMatch = stripped.match(/\d{12}/);
    if (rawMatch) {
      console.log('\n✅ AADHAAR VERIFIED (raw) — found:', rawMatch[0]);
    } else {
      console.log('\n❌ Aadhaar number NOT found in document');
    }
  }
}

run().catch(console.error);
