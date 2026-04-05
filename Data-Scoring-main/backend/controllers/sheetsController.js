const Analysis = require('../models/Analysis');
const { fetchSheetRows } = require('../utils/googleSheets');

/**
 * Normalises a column name for comparison:
 *   1. Lowercase
 *   2. Strip all spaces, underscores, hyphens
 *   3. Strip trailing "number" suffix  (so "aadhar_number" == "AADHAR ")
 *
 * Examples:
 *   "PHONE NUMBER"  -> "phone"
 *   "phone_number"  -> "phone"
 *   "AADHAR "       -> "aadhar"
 *   "aadhar_number" -> "aadhar"
 *   "ROLL NUMBER"   -> "roll"
 *   "roll_number"   -> "roll"
 *   "Email"         -> "email"
 *   "email_address" -> "emailaddress"   (kept as-is, no "number" suffix)
 */
function norm(str) {
  return String(str)
    .toLowerCase()
    .replace(/[\s_\-]+/g, '')   // remove spaces, underscores, hyphens
    .replace(/number$/, '');    // strip trailing "number"
}

/**
 * POST /api/sheets/sync/:analysisId
 */
exports.syncFromSheet = async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = await Analysis.findByPk(analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const sheetRows = await fetchSheetRows();
    if (sheetRows.length === 0)
      return res.json({ success: true, updated: 0, message: 'No responses in sheet yet' });

    // ── Step 1: Build email → sheetRow lookup ──────────────────────────────
    const sheetMap = {};
    for (const row of sheetRows) {
      // Find whichever key normalises to "email" or "emailaddress"
      const emailEntry = Object.entries(row).find(([k]) =>
        norm(k) === 'email' || norm(k) === 'emailaddress'
      );
      if (!emailEntry) continue;
      const email = emailEntry[1].trim().toLowerCase();
      if (email) sheetMap[email] = row;
    }

    console.log('[Sheets Sync] Emails in sheet:', Object.keys(sheetMap));

    // ── Step 2: Loop db rows and merge ─────────────────────────────────────
    const rawData = Array.isArray(analysis.rawData) ? [...analysis.rawData] : [];
    let updated = 0;

    for (let i = 0; i < rawData.length; i++) {
      const dbRow = rawData[i];

      // Find email key in db row
      const dbEmailEntry = Object.entries(dbRow).find(([k]) =>
        norm(k) === 'email' || norm(k) === 'emailaddress'
      );
      if (!dbEmailEntry) continue;

      const dbEmail = dbEmailEntry[1].trim().toLowerCase();
      if (!dbEmail || !sheetMap[dbEmail]) continue;

      const sheetRow = sheetMap[dbEmail];
      const merged   = { ...dbRow };

      // Build norm → exact key map for db row (computed once per row)
      const dbNormMap = {};
      for (const k of Object.keys(dbRow)) {
        dbNormMap[norm(k)] = k;   // e.g. { 'phone': 'PHONE NUMBER', 'aadhar': 'AADHAR ', ... }
      }

      console.log(`[Sheets Sync] Row ${i} db norm map:`, dbNormMap);

      // For each sheet column find the matching db key
      for (const [sheetCol, sheetVal] of Object.entries(sheetRow)) {
        const normSheet = norm(sheetCol);

        if (normSheet === 'timestamp' || !sheetVal) continue;

        const dbKey = dbNormMap[normSheet];

        if (!dbKey) {
          console.log(`[Sheets Sync] Row ${i}: no db match for sheet col "${sheetCol}" (norm="${normSheet}")`);
          continue;
        }

        console.log(`[Sheets Sync] Row ${i}: "${sheetCol}" (norm="${normSheet}") -> db["${dbKey}"] = "${sheetVal}"`);
        merged[dbKey] = sheetVal;
      }

      rawData[i] = merged;
      updated++;
    }

    // ── Step 3: Save ───────────────────────────────────────────────────────
    if (updated > 0) {
      analysis.rawData = rawData;
      analysis.changed('rawData', true);
      await analysis.save();
    }

    console.log(`[Sheets Sync] Done — ${updated}/${rawData.length} rows updated`);
    res.json({ success: true, updated, total: sheetRows.length });

  } catch (err) {
    console.error('[Sheets Sync] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
