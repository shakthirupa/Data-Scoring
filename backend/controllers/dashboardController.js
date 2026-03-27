const { Op } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('../models/Analysis');
const DataIssue = require('../models/DataIssue');

function timeSince(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString();
}

exports.resolveIssue = async (req, res) => {
  try {
    await DataIssue.update({ resolved: true }, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalAnalyses = await Analysis.count();
    const recentAnalyses = await Analysis.findAll({ order: [['createdAt', 'DESC']], limit: 5 });
    const allAnalyses = await Analysis.findAll({ attributes: ['overallScore'] });
    const avgScore = allAnalyses.length > 0
      ? Math.round(allAnalyses.reduce((s, a) => s + a.overallScore, 0) / allAnalyses.length) : 0;
    const criticalIssues = await DataIssue.count({ where: { severity: 'Critical', resolved: false } });

    const scoreDistribution = {
      excellent: await Analysis.count({ where: { overallScore: { [Op.gte]: 90 } } }),
      good:      await Analysis.count({ where: { overallScore: { [Op.gte]: 80, [Op.lt]: 90 } } }),
      fair:      await Analysis.count({ where: { overallScore: { [Op.gte]: 60, [Op.lt]: 80 } } }),
      poor:      await Analysis.count({ where: { overallScore: { [Op.lt]: 60 } } }),
    };

    res.json({
      totalAnalyses, avgScore, criticalIssues,
      recentAnalyses: recentAnalyses.map(a => ({
        ...a.toJSON(),
        scores: { completeness: a.completeness, uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, overallScore: a.overallScore }
      })),
      scoreDistribution,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTrends = async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const analyses = await Analysis.findAll({ where: { createdAt: { [Op.gte]: last30Days } }, order: [['createdAt', 'ASC']] });
    res.json(analyses.map(a => ({
      date: a.createdAt.toISOString().split('T')[0],
      score: a.overallScore, completeness: a.completeness,
      uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getIssuesSummary = async (req, res) => {
  try {
    const [critical, high, medium, low] = await Promise.all([
      DataIssue.count({ where: { severity: 'Critical', resolved: false } }),
      DataIssue.count({ where: { severity: 'High',     resolved: false } }),
      DataIssue.count({ where: { severity: 'Medium',   resolved: false } }),
      DataIssue.count({ where: { severity: 'Low',      resolved: false } }),
    ]);

    const rawIssues = await DataIssue.findAll({
      where: { resolved: false },
      order: [
        [sequelize.literal(`CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END`), 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit: 50,
      include: [{ model: Analysis, attributes: ['fileName', 'rowCount'] }],
    });

    const issues = rawIssues.map(i => ({
      id:           i.id,
      issueType:    i.issueType,
      severity:     i.severity,
      description:  i.description,
      affectedRows: i.affectedRows,
      column:       i.column,
      resolved:     i.resolved,
      fileName:     i.Analysis?.fileName || 'Unknown',
      analysisId:   i.analysisId,
      createdAt:    i.createdAt,
    }));

    const analyses = await Analysis.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [{ model: DataIssue, where: { resolved: false }, required: false }],
    });

    const recentIssues = analyses
      .filter(a => a.DataIssues?.length > 0)
      .map(a => ({
        fileName:      a.fileName,
        analysisId:    a.id,
        problemRowPct: a.problemRowPct ?? 0,
        rowCount:      a.rowCount,
        problemRows:   Math.round(((a.problemRowPct ?? 0) / 100) * a.rowCount),
        issueCount:    a.DataIssues.length,
        topSeverity:   ['Critical', 'High', 'Medium', 'Low'].find(s => a.DataIssues.some(i => i.severity === s)) || 'Low',
        types:         [...new Set(a.DataIssues.map(i => i.issueType))],
      }));

    res.json({
      bySeverity: { critical, high, medium, low },
      criticalIssues: critical,
      recentIssues,
      issues,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = [];

    const recentAnalyses = await Analysis.findAll({ order: [['createdAt', 'DESC']], limit: 10 });
    recentAnalyses.forEach(a => {
      const score = a.overallScore;
      const timeAgo = timeSince(a.createdAt);
      if (score >= 80)
        notifications.push({ id: `analysis-${a.id}`, type: 'success', title: 'Analysis Complete',   message: `${a.fileName} scored ${score}% overall quality.`,                          time: timeAgo, createdAt: a.createdAt });
      else if (score >= 60)
        notifications.push({ id: `analysis-${a.id}`, type: 'warning', title: 'Low Quality Score',   message: `${a.fileName} scored only ${score}%. Review issues for improvement.`,       time: timeAgo, createdAt: a.createdAt });
      else
        notifications.push({ id: `analysis-${a.id}`, type: 'alert',   title: 'Poor Data Quality',   message: `${a.fileName} scored ${score}% — immediate attention required.`,            time: timeAgo, createdAt: a.createdAt });
    });

    const criticalIssues = await DataIssue.findAll({
      where: { severity: 'Critical', resolved: false },
      include: [{ model: Analysis, attributes: ['fileName'] }],
      order: [['createdAt', 'DESC']], limit: 5,
    });
    criticalIssues.forEach(i => {
      notifications.push({ id: `issue-${i.id}`, type: 'alert', title: 'Critical Issue Detected', message: `${i.Analysis?.fileName || 'A dataset'}: ${i.description}`, time: timeSince(i.createdAt), createdAt: i.createdAt });
    });

    const resolvedIssues = await DataIssue.findAll({
      where: { resolved: true },
      include: [{ model: Analysis, attributes: ['fileName'] }],
      order: [['updatedAt', 'DESC']], limit: 5,
    });
    resolvedIssues.forEach(i => {
      notifications.push({ id: `resolved-${i.id}`, type: 'success', title: 'Issue Resolved', message: `${i.issueType} issue in ${i.Analysis?.fileName || 'a dataset'} has been resolved.`, time: timeSince(i.updatedAt), createdAt: i.updatedAt });
    });

    const allAnalyses = await Analysis.findAll({ order: [['fileName', 'ASC'], ['createdAt', 'DESC']] });
    const byFile = {};
    allAnalyses.forEach(a => { if (!byFile[a.fileName]) byFile[a.fileName] = []; byFile[a.fileName].push(a); });
    Object.values(byFile).forEach(group => {
      if (group.length >= 2) {
        const drop = group[1].overallScore - group[0].overallScore;
        if (drop < -10)
          notifications.push({ id: `drop-${group[0].id}`, type: 'warning', title: 'Score Dropped', message: `${group[0].fileName} dropped ${Math.abs(drop).toFixed(0)} points to ${group[0].overallScore}%.`, time: timeSince(group[0].createdAt), createdAt: group[0].createdAt });
      }
    });

    const seen = new Set();
    const unique = notifications
      .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 30)
      .map((n, idx) => ({ ...n, read: idx > 4 }));

    res.json(unique);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
