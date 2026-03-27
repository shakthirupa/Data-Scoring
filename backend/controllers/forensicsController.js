const Analysis = require('../models/Analysis');
const ForensicsReport = require('../models/ForensicsReport');
const { runForensics } = require('../utils/forensicsEngine');

// ── Internal: run forensics and upsert report ─────────────────────────────────
async function computeAndSave(analysis) {
  const result = runForensics(analysis.toJSON ? analysis.toJSON() : analysis);
  if (!result) return null;
  await ForensicsReport.destroy({ where: { analysisId: analysis.id } });
  const report = await ForensicsReport.create({
    analysisId:            analysis.id,
    summary:               result.summary,
    eventChain:            result.eventChain,
    timeline:              result.timeline.slice(0, 1000),
    topIssues:             result.topIssues,
    columnProfiles:        result.columnProfiles,
    severityBreakdown:     result.severityBreakdown,
    totalAnomalies:        result.totalAnomalies,
    totalCrossFieldIssues: result.totalCrossFieldIssues,
    computedAt:            new Date(),
  });
  return report;
}

// ── GET /api/forensics/:analysisId ────────────────────────────────────────────
// Returns cached report or computes on demand.

exports.getReport = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    let report = await ForensicsReport.findOne({ where: { analysisId: analysis.id } });
    if (!report) report = await computeAndSave(analysis);
    if (!report) return res.status(400).json({ error: 'Analysis has no raw data to forensicate' });

    res.json({
      analysisId: analysis.id,
      fileName: analysis.fileName,
      rowCount: analysis.rowCount,
      overallScore: analysis.overallScore,
      ...report.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/forensics/:analysisId/recompute ─────────────────────────────────
// Force recompute even if cached.

exports.recompute = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    const report = await computeAndSave(analysis);
    if (!report) return res.status(400).json({ error: 'No raw data available' });
    res.json({ success: true, analysisId: analysis.id, computedAt: report.computedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/forensics/:analysisId/timeline ───────────────────────────────────
// Returns only the anomaly timeline (lighter payload).

exports.getTimeline = async (req, res) => {
  try {
    const report = await ForensicsReport.findOne({ where: { analysisId: req.params.analysisId } });
    if (!report) return res.status(404).json({ error: 'No forensics report — call GET /forensics/:id first' });
    const limit = parseInt(req.query.limit) || 200;
    res.json({ analysisId: req.params.analysisId, timeline: report.timeline.slice(0, limit), total: report.timeline.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/forensics/:analysisId/column/:column ─────────────────────────────
// Returns the profile + anomalies for a single column.

exports.getColumnReport = async (req, res) => {
  try {
    const report = await ForensicsReport.findOne({ where: { analysisId: req.params.analysisId } });
    if (!report) return res.status(404).json({ error: 'No forensics report found' });
    const profile = (report.columnProfiles || []).find(p => p.column === req.params.column);
    if (!profile) return res.status(404).json({ error: `Column "${req.params.column}" not found in report` });
    const colTimeline = report.timeline.filter(t => t.events.some(e => e.column === req.params.column));
    res.json({ column: req.params.column, profile, timeline: colTimeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/forensics/inline ────────────────────────────────────────────────
// Run forensics on raw rows without storing (for quick ad-hoc analysis).

exports.inlineForensics = (req, res) => {
  const { rows, fileName } = req.body;
  if (!Array.isArray(rows) || !rows.length)
    return res.status(400).json({ error: 'rows array is required' });
  try {
    const mockAnalysis = { id: 0, fileName: fileName || 'inline', rowCount: rows.length, overallScore: 0, rawData: rows };
    const result = runForensics(mockAnalysis);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.computeAndSave = computeAndSave;
