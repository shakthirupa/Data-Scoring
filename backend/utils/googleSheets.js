const { google } = require('googleapis');
const path = require('path');

/**
 * Fetches all rows from Google Sheet and returns them as objects.
 * Headers are mapped dynamically — column order does NOT matter.
 *
 * Example output:
 * [
 *   { timestamp: '...', email: '...', name: 'Sanjana', phone_number: '7200824875', ... },
 * ]
 */
async function fetchSheetRows() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetRange    = process.env.GOOGLE_SHEET_RANGE || 'Sheet1';
  const keyPath       = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID not set in .env');
  if (!keyPath)       throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH not set in .env');

  const credentials = require(path.resolve(__dirname, '..', keyPath));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets   = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetRange });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    console.log('[Sheets] Sheet is empty or has no data rows');
    return [];
  }

  // Step 1 — Read raw headers exactly as they appear in the sheet
  const rawHeaders = rows[0];
  console.log('[Sheets] Raw headers from sheet:', rawHeaders);

  // Step 2 — Normalise: lowercase + replace spaces/special chars with underscore
  const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  console.log('[Sheets] Normalised headers:', headers);

  // Step 3 — Build index map: { normalised_header: columnIndex }
  const headerIndex = {};
  headers.forEach((h, i) => { headerIndex[h] = i; });

  // Step 4 — Convert each data row into an object using the index map
  const dataRows = rows.slice(1).map((row, rowNum) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '').toString().trim();
    });
    console.log(`[Sheets] Row ${rowNum + 1}:`, obj);
    return obj;
  });

  return dataRows;
}

module.exports = { fetchSheetRows };
