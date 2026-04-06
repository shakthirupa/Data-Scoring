const { Op } = require('sequelize');
const Analysis = require('../models/Analysis');
const DatasetRelationship = require('../models/DatasetRelationship');

// Normalise a column name for comparison
const normCol = s => String(s).toLowerCase().replace(/[\s_\-]+/g, '');

// Detect if a column name looks like a joinable key
const KEY_HINTS = ['id', 'no', 'number', 'code', 'roll', 'reg', 'student', 'patient', 'employee', 'emp', 'account', 'acct', 'ref', 'uid', 'aadhaar', 'aadhar', 'pan'];
const isKeyCol = col => KEY_HINTS.some(h => normCol(col).includes(h));

exports.findRelationships = async (req, res) => {
  try {
    const analyses = await Analysis.findAll({
      where: { userId: req.userId },
      attributes: ['id', 'fileName', 'rawData'],
      order: [['createdAt', 'DESC']],
      limit: 30,
    });

    const discovered = [];

    for (let i = 0; i < analyses.length; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const a = analyses[i];
        const b = analyses[j];
        const rowsA = a.rawData || [];
        const rowsB = b.rawData || [];
        if (!rowsA.length || !rowsB.length) continue;

        const colsA = Object.keys(rowsA[0]);
        const colsB = Object.keys(rowsB[0]);
        const matches = [];

        for (const colA of colsA) {
          for (const colB of colsB) {
            const sameNorm = normCol(colA) === normCol(colB);
            const bothKeys = isKeyCol(colA) && isKeyCol(colB);
            if (!sameNorm && !bothKeys) continue;

            const valsA = new Set(rowsA.map(r => String(r[colA] ?? '').trim().toLowerCase()).filter(Boolean));
            const valsB = new Set(rowsB.map(r => String(r[colB] ?? '').trim().toLowerCase()).filter(Boolean));
            if (!valsA.size || !valsB.size) continue;

            const overlap = [...valsA].filter(v => valsB.has(v)).length;
            const overlapPct = Math.round((overlap / Math.min(valsA.size, valsB.size)) * 100);
            if (overlapPct < 10) continue;

            matches.push({ colA, colB, overlapPct });
          }
        }

        if (!matches.length) continue;
        matches.sort((x, y) => y.overlapPct - x.overlapPct);
        const best = matches[0].overlapPct;
        const confidence = best >= 80 ? 'High' : best >= 40 ? 'Medium' : 'Low';
        const suggestedJoin = best === 100 ? 'INNER JOIN' : 'LEFT JOIN';

        // Save — update if pair already exists, else create
        const existing = await DatasetRelationship.findOne({
          where: { userId: req.userId, datasetAId: a.id, datasetBId: b.id },
        });
        if (existing) {
          await existing.update({ matches, confidence, suggestedJoin });
        } else {
          await DatasetRelationship.create({
            userId: req.userId, datasetAId: a.id, datasetBId: b.id,
            matches, confidence, suggestedJoin,
          });
        }

        discovered.push({ datasetAId: a.id, datasetBId: b.id });
      }
    }

    // Load all saved relationships for this user (including ones from previous scans)
    const saved = await DatasetRelationship.findAll({
      where: { userId: req.userId },
      include: [
        { model: Analysis, as: 'datasetA', attributes: ['id', 'fileName'] },
        { model: Analysis, as: 'datasetB', attributes: ['id', 'fileName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const relationships = saved.map(r => ({
      id: r.id,
      datasetA: { id: r.datasetA.id, fileName: r.datasetA.fileName },
      datasetB: { id: r.datasetB.id, fileName: r.datasetB.fileName },
      matches: r.matches,
      confidence: r.confidence,
      suggestedJoin: r.suggestedJoin,
    }));

    res.json({ relationships, discovered: discovered.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRelationship = async (req, res) => {
  try {
    const deleted = await DatasetRelationship.destroy({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!deleted) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSavedRelationships = async (req, res) => {
  try {
    const saved = await DatasetRelationship.findAll({
      where: { userId: req.userId },
      include: [
        { model: Analysis, as: 'datasetA', attributes: ['id', 'fileName'] },
        { model: Analysis, as: 'datasetB', attributes: ['id', 'fileName'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(saved.map(r => ({
      id: r.id,
      datasetA: { id: r.datasetA.id, fileName: r.datasetA.fileName },
      datasetB: { id: r.datasetB.id, fileName: r.datasetB.fileName },
      matches: r.matches,
      confidence: r.confidence,
      suggestedJoin: r.suggestedJoin,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
