const Recommendation = require('../models/Recommendation');
const Analysis = require('../models/Analysis');

exports.generateRecommendations = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const items = [];
    if (analysis.completeness < 80) {
      items.push({ type: 'Implement data validation at entry point', priority: 'High', category: 'Completeness' });
      items.push({ type: 'Add required field constraints in database', priority: 'High', category: 'Completeness' });
    }
    if (analysis.uniqueness < 75) {
      items.push({ type: 'Create unique indexes on key columns', priority: 'High', category: 'Uniqueness' });
      items.push({ type: 'Implement deduplication process', priority: 'Medium', category: 'Uniqueness' });
    }
    if (analysis.validity < 85) {
      items.push({ type: 'Add data type validation rules', priority: 'Medium', category: 'Validity' });
      items.push({ type: 'Implement format checking for dates and emails', priority: 'Medium', category: 'Validity' });
    }
    if (analysis.consistency < 80) {
      items.push({ type: 'Standardize data formats across systems', priority: 'Medium', category: 'Consistency' });
      items.push({ type: 'Create data quality monitoring dashboard', priority: 'Low', category: 'Consistency' });
    }

    const rec = await Recommendation.create({ analysisId: analysis.id, items });
    res.json({ success: true, recommendations: rec.items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const rec = await Recommendation.findOne({ where: { analysisId: req.params.analysisId }, include: [Analysis] });
    res.json(rec);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
