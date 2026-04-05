const pdfParse = require('pdf-parse');
const fs = require('fs');
const { ocrPdf } = require('./utils/pdfOcr');

const f = 'E:/test data scoring/Mtech CSE data/727723EUCI020-GUNATHMIKA CHANDRALEKA C N-20260330T045912Z-1-001/727723EUCI020-GUNATHMIKA CHANDRALEKA C N/GUNATHMIKA CHANDRALEKA C N - SKCET - Student Profile.xlsx.pdf';

(async () => {
  let text = '';
  try {
    const d = await pdfParse(fs.readFileSync(f));
    text = d.text.trim();
    console.log('pdf-parse chars:', text.length);
    if (text.length <= 30) text = await ocrPdf(f);
    else console.log(text.slice(0, 800));
  } catch(e) {
    console.log('pdf-parse failed:', e.message);
    text = await ocrPdf(f);
  }
  if (text.length <= 30) console.log('OCR also empty');
  else console.log(text.slice(0, 800));
  process.exit(0);
})();
