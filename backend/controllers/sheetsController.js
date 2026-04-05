const Analysis = require('../models/Analysis');
const { fetchSheetRows } = require('../utils/googleSheets');

function norm(str) {
  return String(str)
    .toLowerCase()
    .replace(/[\s_\-]+/g, '')
    .replace(/number$/, '');
}

async function syncAnalysis(analysisId) {
  const analysis = await Analysis.findByPk(analysisId);
  if (!analysis) return { success: false, error: 'Analysis not found' };

  const sheetRows = await fetchSheetRows();
  if (sheetRows.length === 0) return { success: true, updated: 0 };

  const sheetMap = {};
  for (const row of sheetRows) {
    const emailEntry = Object.entries(row).find(([k]) => norm(k) === 'email' || norm(k) === 'emailaddress');
    if (!emailEntry) continue;
    const email = emailEntry[1].trim().toLowerCase();
    if (email) sheetMap[email] = row;
  }

  const rawData = Array.isArray(analysis.rawData) ? [...analysis.rawData] : [];
  let updated = 0;

  for (let i = 0; i < rawData.length; i++) {
    const dbRow = rawData[i];
    const dbEmailEntry = Object.entries(dbRow).find(([k]) => norm(k) === 'email' || norm(k) === 'emailaddress');
    if (!dbEmailEntry) continue;
    const dbEmail = dbEmailEntry[1].trim().toLowerCase();
    if (!dbEmail || !sheetMap[dbEmail]) continue;

    const sheetRow = sheetMap[dbEmail];
    const merged = { ...dbRow };
    const dbNormMap = {};
    for (const k of Object.keys(dbRow)) dbNormMap[norm(k)] = k;

    for (const [sheetCol, sheetVal] of Object.entries(sheetRow)) {
      const normSheet = norm(sheetCol);
      if (normSheet === 'timestamp' || !sheetVal) continue;
      const dbKey = dbNormMap[normSheet];
      if (dbKey) merged[dbKey] = sheetVal;
    }
    rawData[i] = merged;
    updated++;
  }

  if (updated > 0) {
    analysis.rawData = rawData;
    analysis.changed('rawData', true);
    await analysis.save();
  }

  console.log(`[Sheets Sync] analysisId=${analysisId} — ${updated}/${rawData.length} rows updated`);
  return { success: true, updated, total: sheetRows.length };
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
exports.syncAll = async () => {
  try {
    const analyses = await Analysis.findAll({ attributes: ['id'] });
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
