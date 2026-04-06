const { Op } = require('sequelize');
const Fingerprint = require('../models/Fingerprint');
const Analysis = require('../models/Analysis');
const { hashFile, hashContent, columnStats, schemaSignature, compositeHash, similarityScore } = require('../utils/fingerprint');

// ── Generate & store fingerprint for an already-parsed dataset ───────────────
// Called internally from analysisController after parsing.
// filePath may be null for URL-sourced datasets (Google Sheets).

async function generateFingerprint(analysisId, fileName, rows, filePath = null) {
  const stats = columnStats(rows);
  const schema = schemaSignature(stats);
  const rowCount = rows.length;
  const columnCount = Object.keys(stats).length;

  // File hash: SHA-256 of raw file bytes if available, else hash of serialised rows
  const fileHash = filePath
    ? await hashFile(filePath)
    : hashContent(JSON.stringify(rows));

  const composite = compositeHash(fileHash, rowCount, stats);

  const fp = await Fingerprint.create({
    analysisId,
    fileName,
    fileHash,
    compositeHash: composite,
    rowCount,
    columnCount,
    schemaSignature: schema,
    columnStats: stats,
  });

  return fp;
}

// ── GET /api/fingerprint/:analysisId ─────────────────────────────────────────

exports.getFingerprint = async (req, res) => {
  try {
    const fp = await Fingerprint.findOne({
      where: { analysisId: req.params.analysisId },
      include: [{ model: Analysis, where: { userId: req.userId }, attributes: [] }],
    });
    if (!fp) return res.status(404).json({ error: 'Fingerprint not found for this analysis' });
    res.json(fp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/fingerprint/compare ────────────────────────────────────────────
// Body: { analysisIdA, analysisIdB }
// Returns a detailed diff report between two fingerprints.

exports.compare = async (req, res) => {
  const { analysisIdA, analysisIdB } = req.body;
  if (!analysisIdA || !analysisIdB)
    return res.status(400).json({ error: 'analysisIdA and analysisIdB are required' });

  try {
    const userWhere = { userId: req.userId };
    const [fpA, fpB] = await Promise.all([
      Fingerprint.findOne({ where: { analysisId: analysisIdA }, include: [{ model: Analysis, where: userWhere, attributes: [] }] }),
      Fingerprint.findOne({ where: { analysisId: analysisIdB }, include: [{ model: Analysis, where: userWhere, attributes: [] }] }),
    ]);

    if (!fpA) return res.status(404).json({ error: `No fingerprint for analysisId ${analysisIdA}` });
    if (!fpB) return res.status(404).json({ error: `No fingerprint for analysisId ${analysisIdB}` });

    const similarity = similarityScore(fpA, fpB);

    // Determine relationship
    let relationship;
    if (fpA.compositeHash === fpB.compositeHash) relationship = 'exact_duplicate';
    else if (fpA.fileHash === fpB.fileHash)       relationship = 'same_file_different_name';
    else if (similarity >= 80)                    relationship = 'near_duplicate';
    else if (similarity >= 50)                    relationship = 'structurally_similar';
    else                                          relationship = 'different';

    // Schema diff
    const colsA = new Set(fpA.schemaSignature.split('|'));
    const colsB = new Set(fpB.schemaSignature.split('|'));
    const addedCols   = [...colsB].filter(c => !colsA.has(c));
    const removedCols = [...colsA].filter(c => !colsB.has(c));
    const sharedCols  = [...colsA].filter(c => colsB.has(c));

    // Per-column stat deltas for shared columns
    const statDeltas = {};
    sharedCols.forEach(token => {
      const col = token.split(':')[0];
      const a = fpA.columnStats[col];
      const b = fpB.columnStats[col];
      if (!a || !b) return;
      statDeltas[col] = {
        nullCountDelta: b.nullCount - a.nullCount,
        uniqueCountDelta: b.uniqueCount - a.uniqueCount,
        meanDelta: (a.mean !== null && b.mean !== null) ? +(b.mean - a.mean).toFixed(4) : null,
        typeChanged: a.type !== b.type,
        typeA: a.type,
        typeB: b.type,
      };
    });

    res.json({
      analysisIdA,
      analysisIdB,
      fileNameA: fpA.fileName,
      fileNameB: fpB.fileName,
      similarity,
      relationship,
      isExactDuplicate: relationship === 'exact_duplicate' || relationship === 'same_file_different_name',
      summary: {
        rowCountA: fpA.rowCount,
        rowCountB: fpB.rowCount,
        rowCountDelta: fpB.rowCount - fpA.rowCount,
        columnCountA: fpA.columnCount,
        columnCountB: fpB.columnCount,
        addedColumns: addedCols.map(c => c.split(':')[0]),
        removedColumns: removedCols.map(c => c.split(':')[0]),
        sharedColumnCount: sharedCols.length,
      },
      statDeltas,
      hashes: {
        fileHashMatch: fpA.fileHash === fpB.fileHash,
        compositeHashMatch: fpA.compositeHash === fpB.compositeHash,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/fingerprint/duplicates ──────────────────────────────────────────
// Returns groups of analyses that share the same compositeHash (exact duplicates).

exports.getDuplicates = async (req, res) => {
  try {
    const all = await Fingerprint.findAll({
      attributes: ['analysisId', 'fileName', 'compositeHash', 'fileHash', 'rowCount', 'createdAt'],
      include: [{ model: Analysis, where: { userId: req.userId }, attributes: [] }],
      order: [['createdAt', 'ASC']],
    });

    // Group by compositeHash
    const groups = {};
    all.forEach(fp => {
      const key = fp.compositeHash;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ analysisId: fp.analysisId, fileName: fp.fileName, rowCount: fp.rowCount, uploadedAt: fp.createdAt });
    });

    const duplicateGroups = Object.entries(groups)
      .filter(([, members]) => members.length > 1)
      .map(([hash, members]) => ({ compositeHash: hash, count: members.length, datasets: members }));

    res.json({ totalDuplicateGroups: duplicateGroups.length, groups: duplicateGroups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/fingerprint/similar/:analysisId?threshold=80 ────────────────────
// Returns all datasets with similarity >= threshold against the given analysis.

exports.getSimilar = async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 80;
  try {
    const target = await Fingerprint.findOne({
      where: { analysisId: req.params.analysisId },
      include: [{ model: Analysis, where: { userId: req.userId }, attributes: [] }],
    });
    if (!target) return res.status(404).json({ error: 'Fingerprint not found' });

    const others = await Fingerprint.findAll({
      where: { analysisId: { [Op.ne]: req.params.analysisId } },
      include: [{ model: Analysis, where: { userId: req.userId }, attributes: [] }],
    });

    const results = others
      .map(fp => ({ analysisId: fp.analysisId, fileName: fp.fileName, rowCount: fp.rowCount, similarity: similarityScore(target, fp) }))
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    res.json({ analysisId: req.params.analysisId, threshold, matches: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/fingerprint/all ──────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const fps = await Fingerprint.findAll({
      attributes: ['id', 'analysisId', 'fileName', 'fileHash', 'compositeHash', 'rowCount', 'columnCount', 'schemaSignature', 'createdAt'],
      include: [{ model: Analysis, where: { userId: req.userId }, attributes: [] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(fps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Export generateFingerprint so analysisController can call it
exports.generateFingerprint = generateFingerprint;
