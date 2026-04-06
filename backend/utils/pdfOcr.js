const fs        = require('fs');
const path      = require('path');
const Tesseract = require('tesseract.js');

async function ocrImage(imgPath) {
  const worker = await Tesseract.createWorker('eng');
  try {
    const { data: { text } } = await worker.recognize(imgPath);
    return text;
  } finally {
    await worker.terminate();
  }
}

async function ocrPdf(pdfPath) {
  try {
    const buf   = fs.readFileSync(pdfPath);
    const texts = [];
    const uid   = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const dir   = path.dirname(pdfPath);

    // Strategy 1: extract embedded JPEGs from PDF binary
    const images = extractJpegsFromPdf(buf);
    console.log(`[ocrPdf] ${path.basename(pdfPath)} — found ${images.length} embedded JPEG(s)`);

    if (images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imgPath = path.join(dir, `ocr_${uid()}.jpg`);
        fs.writeFileSync(imgPath, images[i]);
        try {
          if (!fs.existsSync(imgPath)) continue;
          const text = await ocrImage(imgPath);
          console.log(`[ocrPdf] JPEG ${i} OCR chars: ${text.length}`);
          texts.push(text);
        } catch (e) {
          console.warn(`[ocrPdf] JPEG ${i} skipped: ${e.message}`);
        } finally {
          try { fs.unlinkSync(imgPath); } catch {}
        }
      }
      if (texts.some(t => t.trim().length > 10)) return texts.join('\n');
    }

    // Strategy 2: pdfjs render + canvas OCR
    console.log(`[ocrPdf] falling back to pdfjs render...`);
    const pdfjsLib        = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas } = require('canvas');

    const CanvasFactory = {
      create(w, h)   { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; },
      reset(p, w, h) { p.canvas.width = w; p.canvas.height = h; },
      destroy(p)     { p.canvas = null; p.context = null; },
    };

    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buf), verbosity: 0, CanvasFactory, isEvalSupported: false,
    }).promise;

    for (let p = 1; p <= doc.numPages; p++) {
      const page     = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas   = createCanvas(viewport.width, viewport.height);
      const ctx      = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport, canvasFactory: CanvasFactory }).promise;

      const imgPath = path.join(dir, `ocr_${uid()}.png`);
      fs.writeFileSync(imgPath, canvas.toBuffer('image/png'));
      try {
        if (!fs.existsSync(imgPath)) continue;
        const text = await ocrImage(imgPath);
        console.log(`[ocrPdf] page ${p} OCR chars: ${text.length}`);
        texts.push(text);
      } catch (e) {
        console.warn(`[ocrPdf] page ${p} skipped: ${e.message}`);
      } finally {
        try { fs.unlinkSync(imgPath); } catch {}
      }
    }

    return texts.join('\n');
  } catch (e) {
    console.error('[ocrPdf] FAILED:', e.message);
    return '';
  }
}

/**
 * Scan PDF binary for embedded JPEG streams (FF D8 FF ... FF D9).
 * Returns array of Buffers, each a complete JPEG.
 */
function extractJpegsFromPdf(buf) {
  const jpegs = [];
  let i = 0;
  while (i < buf.length - 3) {
    // JPEG SOI: FF D8 FF followed by a valid marker (FF Ex, FF DB, FF C0, FF C4, FF E0..FF EF)
    if (buf[i] === 0xFF && buf[i + 1] === 0xD8 && buf[i + 2] === 0xFF) {
      const nextMarker = buf[i + 3];
      // Only accept if the byte after FF D8 FF is a real JPEG marker (not arbitrary data)
      const validStart = (nextMarker >= 0xE0 && nextMarker <= 0xEF) || // APP0-APP15
                         nextMarker === 0xDB || // DQT
                         nextMarker === 0xC0 || nextMarker === 0xC2; // SOF
      if (!validStart) { i++; continue; }

      // Find EOI marker FF D9
      let j = i + 2;
      while (j < buf.length - 1) {
        if (buf[j] === 0xFF && buf[j + 1] === 0xD9) {
          const jpeg = buf.slice(i, j + 2);
          if (jpeg.length > 10000) jpegs.push(jpeg); // skip tiny/corrupt fragments
          i = j + 2;
          break;
        }
        j++;
      }
      if (j >= buf.length - 1) break;
    } else {
      i++;
    }
  }
  return jpegs;
}

module.exports = { ocrPdf, ocrImage };
