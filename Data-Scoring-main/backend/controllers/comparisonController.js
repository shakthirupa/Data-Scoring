const { Op } = require('sequelize');
const Analysis = require('../models/Analysis');

exports.compareAnalyses = async (req, res) => {
  try {
    const { analysisIds } = req.body;
    if (!analysisIds || analysisIds.length < 2)
      return res.status(400).json({ error: 'At least 2 analysis IDs required' });

    const analyses = await Analysis.findAll({ where: { id: { [Op.in]: analysisIds } } });
    const comparison = analyses.map(a => ({
      id: a.id, fileName: a.fileName, date: a.createdAt,
      scores: { completeness: a.completeness, uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, overallScore: a.overallScore }
    }));
    const avgScores = {
      completeness: Math.round(analyses.reduce((s, a) => s + a.completeness, 0) / analyses.length),
      uniqueness:   Math.round(analyses.reduce((s, a) => s + a.uniqueness,   0) / analyses.length),
      validity:     Math.round(analyses.reduce((s, a) => s + a.validity,     0) / analyses.length),
      consistency:  Math.round(analyses.reduce((s, a) => s + a.consistency,  0) / analyses.length),
      overallScore: Math.round(analyses.reduce((s, a) => s + a.overallScore, 0) / analyses.length),
    };
    res.json({ comparison, avgScores });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.searchAnalyses = async (req, res) => {
  try {
    const { query, minScore, maxScore, startDate, endDate } = req.query;
    const where = {};
    if (query) where.fileName = { [Op.iLike]: `%${query}%` };
    if (minScore || maxScore) {
      where.overallScore = {};
      if (minScore) where.overallScore[Op.gte] = parseInt(minScore);
      if (maxScore) where.overallScore[Op.lte] = parseInt(maxScore);
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate)   where.createdAt[Op.lte] = new Date(endDate);
    }
    const results = await Analysis.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(results.map(a => ({ ...a.toJSON(), scores: { completeness: a.completeness, uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, overallScore: a.overallScore } })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
