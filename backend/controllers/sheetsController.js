const Analysis = require('../models/Analysis');
const sequelize = require('../db');
const { fetchSheetRows } = require('../utils/googleSheets');

function norm(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[\s_\-]+/g, '')
    .replace(/number$/, '')
    .replace(/address$/, '')
    .replace(/no$/, '');
}

// Map sheet keys to DB keys by comparing normalised forms
function findDbKey(dbRow, sheetColNorm) {
  for (const k of Object.keys(dbRow)) {
    if (norm(k) === sheetColNorm) return k;
  }
  // partial match fallback
  for (const k of Object.keys(dbRow)) {
    const nk = norm(k);
    if (nk.includes(sheetColNorm) || sheetColNorm.includes(nk)) return k;
  }
  return null;
}

async function syncAnalysis(analysisId) {
  const analysis = await Analysis.findByPk(analysisId);
  if (!analysis) return { success: false, error: 'Analysis not found' };

  const sheetRows = await fetchSheetRows();
  console.log(`[Sheets Sync] Fetched ${sheetRows.length} rows from sheet`);
  if (sheetRows.length === 0) return { success: true, updated: 0 };

  // Log sheet emails found
  const sheetMap = {};
  for (const row of sheetRows) {
    const emailKey = Object.keys(row).find(k => norm(k) === 'email' || norm(k) === 'emailaddress');
    if (!emailKey) continue;
    const email = String(row[emailKey] || '').trim().toLowerCase();
    // skip empty rows
    if (!email) continue;
    // if duplicate email in sheet, keep the latest (last occurrence)
    sheetMap[email] = row;
  }

  const rawData = Array.isArray(analysis.rawData) ? [...analysis.rawData] : [];
  console.log(`[Sheets Sync] DB has ${rawData.length} rows`);
  let updated = 0;
  let deleted = 0;
  const updatedIndices = [];

  // Build set of all emails present in the sheet
  const sheetEmails = new Set(Object.keys(sheetMap));

  // Only update rows that exist in the sheet — never delete rows missing from sheet
  const filteredData = [...rawData];
  const verificationStatus = { ...(analysis.verificationStatus || {}) };

  // Now apply sheet updates on filteredData
  for (let i = 0; i < filteredData.length; i++) {
    const dbRow = filteredData[i];
    const dbEmailKey = Object.keys(dbRow).find(k => norm(k) === 'email' || norm(k) === 'emailaddress');
    if (!dbEmailKey) continue;
    const dbEmail = String(dbRow[dbEmailKey] || '').trim().toLowerCase();
    if (!dbEmail || !sheetMap[dbEmail]) continue;

    const sheetRow = sheetMap[dbEmail];
    const merged = { ...dbRow };

    for (const [sheetCol, sheetVal] of Object.entries(sheetRow)) {
      const normSheet = norm(sheetCol);
      if (normSheet === 'timestamp' || sheetVal === '' || sheetVal === null || sheetVal === undefined) continue;
      const dbKey = findDbKey(dbRow, normSheet);
      if (dbKey) {
        merged[dbKey] = sheetVal;
      }
    }

    if (JSON.stringify(merged) !== JSON.stringify(dbRow)) {
      filteredData[i] = merged;
      updatedIndices.push(i);
      // Clear verification for updated rows
      delete verificationStatus[i];
      delete verificationStatus[String(i)];
      updated++;
      console.log(`[Sheets Sync] Row ${i} changed`);
    } else {
      console.log(`[Sheets Sync] Row ${i} — no changes detected`);
    }
  }

  console.log(`[Sheets Sync] ${updated} rows updated, ${deleted} rows deleted`);

  if (updated > 0 || deleted > 0) {
    await sequelize.query(
      'UPDATE analyses SET "rawData" = :rawData::jsonb, "verificationStatus" = :vs::jsonb, "rowCount" = :rowCount WHERE id = :id',
      { replacements: { rawData: JSON.stringify(filteredData), vs: JSON.stringify(verificationStatus), rowCount: filteredData.length, id: analysisId } }
    );
    console.log(`[Sheets Sync] Saved to DB — ${filteredData.length} rows remaining`);
  }

  return { success: true, updated, deleted, total: sheetRows.length };
}

/**
 * POST /api/sheets/sync/:analysisId
 */
exports.syncFromSheet = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const result = await syncAnalysis(analysisId);
    res.json(result);
  } catch (err) {
    console.error('[Sheets Sync] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/sheets/sync-all
 * Syncs all analyses against the sheet (called by background poller)
 */
exports.syncAll = async (userId) => {
  try {
    const where = userId ? { userId } : {};
    const analyses = await Analysis.findAll({ where, attributes: ['id'] });
    let totalUpdated = 0;
    for (const a of analyses) {
      const result = await syncAnalysis(a.id);
      totalUpdated += result.updated || 0;
    }
    if (totalUpdated > 0) console.log(`[Sheets Auto-Sync] Updated ${totalUpdated} rows across ${analyses.length} analyses`);
  } catch (err) {
    console.error('[Sheets Auto-Sync] Error:', err.message);
  }
};
