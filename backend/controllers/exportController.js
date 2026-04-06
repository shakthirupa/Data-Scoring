const Analysis = require('../models/Analysis');
const DataIssue = require('../models/DataIssue');

exports.exportAnalysisReport = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const issues = await DataIssue.findAll({ where: { analysisId: analysis.id } });
    res.json({
      fileName: analysis.fileName, analysisDate: analysis.createdAt, rowCount: analysis.rowCount,
      scores: { completeness: analysis.completeness, uniqueness: analysis.uniqueness, validity: analysis.validity, consistency: analysis.consistency, overallScore: analysis.overallScore },
      issues: issues.map(i => ({ type: i.issueType, severity: i.severity, description: i.description, affectedRows: i.affectedRows })),
      summary: {
        totalIssues: issues.length,
        criticalIssues: issues.filter(i => i.severity === 'Critical').length,
        overallQuality: analysis.overallScore >= 80 ? 'Good' : analysis.overallScore >= 60 ? 'Fair' : 'Poor'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportAllHistory = async (req, res) => {
  try {
    const analyses = await Analysis.findAll({ order: [['createdAt', 'DESC']] });
    res.json(analyses.map(a => ({
      fileName: a.fileName, date: a.createdAt.toISOString().split('T')[0],
      rowCount: a.rowCount, overallScore: a.overallScore, completeness: a.completeness,
      uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, status: a.status
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
