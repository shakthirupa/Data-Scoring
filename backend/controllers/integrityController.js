const { Op } = require('sequelize');
const Analysis = require('../models/Analysis');
const { IntegritySnapshot, IntegrityPrediction } = require('../models/IntegrityModels');
const { computePrediction } = require('../utils/predictionEngine');

// Normalise a filename into a stable group key
// e.g. "Sales_Data_2024-01.csv" → "sales_data"
function toFileGroup(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')           // strip extension
    .replace(/[-_\s]+\d{4}[-_\s\d]*/g, '') // strip trailing date patterns
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ── Called internally after every analysis upload ─────────────────────────────
async function recordSnapshot(analysis) {
  try {
    const prev = await IntegritySnapshot.findOne({
      where: { fileGroup: toFileGroup(analysis.fileName) },
      order: [['snapshotAt', 'DESC']],
    });

    const velocityScore = prev ? +(analysis.overallScore - prev.overallScore).toFixed(2) : 0;

    // Simple anomaly flag: drop > 15 points from previous snapshot
    const anomalyFlag = prev ? (analysis.overallScore - prev.overallScore) < -15 : false;
    const anomalyReason = anomalyFlag
      ? `Score dropped ${Math.abs(velocityScore).toFixed(1)} points from previous upload`
      : null;

    await IntegritySnapshot.create({
      analysisId:    analysis.id,
      fileName:      analysis.fileName,
      fileGroup:     toFileGroup(analysis.fileName),
      overallScore:  analysis.overallScore,
      completeness:  analysis.completeness,
      uniqueness:    analysis.uniqueness,
      validity:      analysis.validity,
      consistency:   analysis.consistency,
      problemRowPct: analysis.problemRowPct ?? 0,
      rowCount:      analysis.rowCount,
      velocityScore,
      anomalyFlag,
      anomalyReason,
      snapshotAt:    analysis.createdAt || new Date(),
    });
  } catch (err) {
    console.error('recordSnapshot error:', err.message);
  }
}

// ── GET /api/predict-integrity ────────────────────────────────────────────────
// Returns predictions for ALL file groups (dashboard overview).

exports.predictAll = async (req, res) => {
  try {
    const groups = await IntegritySnapshot.findAll({
      attributes: ['fileGroup'],
      group: ['fileGroup'],
    });

    const predictions = await Promise.all(
      groups.map(g => computeAndSave(g.fileGroup, parseInt(req.query.steps) || 6))
    );

    res.json({
      computedAt: new Date().toISOString(),
      totalGroups: predictions.length,
      predictions: predictions.filter(Boolean).sort((a, b) => b.futureRiskScore - a.futureRiskScore),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/predict-integrity/:fileGroup ─────────────────────────────────────
// Returns prediction for a specific file group.

exports.predictGroup = async (req, res) => {
  try {
    const result = await computeAndSave(req.params.fileGroup, parseInt(req.query.steps) || 6);
    if (!result) return res.status(404).json({ error: 'No snapshots found for this file group' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/predict-integrity/by-analysis/:analysisId ───────────────────────
// Predict using the file group of a specific analysis.

exports.predictByAnalysis = async (req, res) => {
  try {
    const snap = await IntegritySnapshot.findOne({ where: { analysisId: req.params.analysisId } });
    if (!snap) return res.status(404).json({ error: 'No snapshot for this analysis — upload may not have been recorded' });
    const result = await computeAndSave(snap.fileGroup, parseInt(req.query.steps) || 6);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/predict-integrity/snapshots/:fileGroup ───────────────────────────
// Raw snapshot history for a file group.

exports.getSnapshots = async (req, res) => {
  try {
    const snaps = await IntegritySnapshot.findAll({
      where: { fileGroup: req.params.fileGroup },
      order: [['snapshotAt', 'ASC']],
    });
    res.json({ fileGroup: req.params.fileGroup, count: snaps.length, snapshots: snaps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/predict-integrity/groups ─────────────────────────────────────────
// List all tracked file groups with their latest snapshot.

exports.listGroups = async (req, res) => {
  try {
    const snaps = await IntegritySnapshot.findAll({
      attributes: ['fileGroup', 'fileName', 'overallScore', 'snapshotAt'],
      order: [['snapshotAt', 'DESC']],
    });

    const seen = new Set();
    const groups = [];
    for (const s of snaps) {
      if (!seen.has(s.fileGroup)) {
        seen.add(s.fileGroup);
        const count = await IntegritySnapshot.count({ where: { fileGroup: s.fileGroup } });
        groups.push({ fileGroup: s.fileGroup, fileName: s.fileName, latestScore: s.overallScore, lastUpdated: s.snapshotAt, snapshotCount: count });
      }
    }
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/predict-integrity/alerts ─────────────────────────────────────────
// Returns all file groups with High or Critical risk.

exports.getAlerts = async (req, res) => {
  try {
    const predictions = await IntegrityPrediction.findAll({
      where: { riskLevel: { [Op.in]: ['High', 'Critical'] } },
      order: [['futureRiskScore', 'DESC']],
    });
    res.json({ count: predictions.length, alerts: predictions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Internal: compute prediction and upsert to DB ─────────────────────────────

async function computeAndSave(fileGroup, steps = 6) {
  const snapshots = await IntegritySnapshot.findAll({
    where: { fileGroup },
    order: [['snapshotAt', 'ASC']],
  });

  if (snapshots.length === 0) return null;

  // Need at least 2 points for meaningful prediction; with 1 we still return basic info
  const result = computePrediction(snapshots.map(s => s.toJSON()), steps);

  // Upsert prediction record
  await IntegrityPrediction.destroy({ where: { fileGroup } });
  await IntegrityPrediction.create({
    fileGroup,
    fileName: snapshots[snapshots.length - 1].fileName,
    futureRiskScore: result.futureRiskScore,
    riskLevel: result.riskLevel,
    predictedScore: result.predictedScore,
    confidenceScore: result.confidenceScore,
    trend: result.trend,
    trendSlope: result.trendSlope,
    volatility: result.volatility,
    momentum: result.momentum,
    historicalSeries: result.historicalSeries,
    forecastSeries: result.forecastSeries,
    anomalySeries: result.anomalySeries,
    snapshotCount: result.snapshotCount,
    computedAt: new Date(),
  });

  return { fileGroup, ...result };
}

exports.recordSnapshot = recordSnapshot;
exports.toFileGroup = toFileGroup;
