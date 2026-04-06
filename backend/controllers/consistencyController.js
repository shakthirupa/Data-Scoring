const Analysis = require('../models/Analysis');
const { CustomRule, ConsistencyResult } = require('../models/ConsistencyModels');
const { registry, runRules } = require('../utils/ruleEngine');

// ── Boot: load persisted custom rules into the in-memory registry ─────────────
// Called once from server.js after DB sync.
async function loadCustomRules() {
  try {
    const rules = await CustomRule.findAll({ where: { enabled: true } });
    rules.forEach(r => {
      try {
        // Build a real check function from the stored expression
        // eslint-disable-next-line no-new-func
        const checkFn = new Function('row', `
          try {
            const result = (${r.expression});
            return result ? \`${r.message}\` : null;
          } catch(e) { return null; }
        `);
        registry.add({
          id: r.ruleId,
          name: r.name,
          severity: r.severity,
          category: r.category,
          requiredFields: r.requiredFields || [],
          check: checkFn,
        });
      } catch (_) { /* skip malformed rules */ }
    });
    console.log(`Loaded ${rules.length} custom consistency rules`);
  } catch (_) {}
}

// ── POST /api/consistency/validate/:analysisId ────────────────────────────────
// Runs all (or selected) rules against a stored analysis and saves results.

exports.validate = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const rows = analysis.rawData || [];
    if (rows.length === 0) return res.status(400).json({ error: 'Analysis has no raw data' });

    const ruleIds = req.body.ruleIds || null; // null = run all
    const result = runRules(rows, ruleIds);

    // Upsert result
    await ConsistencyResult.destroy({ where: { analysisId: analysis.id } });
    await ConsistencyResult.create({
      analysisId: analysis.id,
      totalRows: result.totalRows,
      flaggedCount: result.flaggedCount,
      consistencyScore: result.consistencyScore,
      ruleSummary: result.ruleSummary,
      flaggedRows: result.flaggedRows.slice(0, 500),
    });
    await Analysis.update({ consistency: result.consistencyScore }, { where: { id: analysis.id } });

    res.json({
      analysisId: analysis.id,
      fileName: analysis.fileName,
      ...result,
      flaggedRows: result.flaggedRows.slice(0, 100), // cap API response
      truncated: result.flaggedRows.length > 100,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/consistency/result/:analysisId ───────────────────────────────────

exports.getResult = async (req, res) => {
  try {
    const result = await ConsistencyResult.findOne({ where: { analysisId: req.params.analysisId } });
    if (!result) return res.status(404).json({ error: 'No consistency result found — run /validate first' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/consistency/rules ────────────────────────────────────────────────

exports.listRules = (req, res) => {
  res.json({
    total: registry.list().length,
    byCategory: registry.listByCategory(),
    rules: registry.list().map(r => ({
      id: r.id, name: r.name, severity: r.severity,
      category: r.category, builtin: r.builtin,
      requiredFields: r.requiredFields,
    })),
  });
};

// ── POST /api/consistency/rules ───────────────────────────────────────────────
// Body: { ruleId, name, severity, category, expression, message, requiredFields }
// expression: JS boolean expression using `row` object, e.g.:
//   "Number(row.age) < 16 && /bachelor/i.test(row.degree || '')"

exports.addRule = async (req, res) => {
  const { ruleId, name, severity, category, expression, message, requiredFields } = req.body;
  if (!ruleId || !name || !expression || !message)
    return res.status(400).json({ error: 'ruleId, name, expression, and message are required' });

  // Validate expression compiles
  try {
    // eslint-disable-next-line no-new-func
    new Function('row', `return (${expression})`);
  } catch (e) {
    return res.status(400).json({ error: `Invalid expression: ${e.message}` });
  }

  try {
    // eslint-disable-next-line no-new-func
    const checkFn = new Function('row', `
      try {
        const result = (${expression});
        return result ? \`${message}\` : null;
      } catch(e) { return null; }
    `);

    registry.add({ id: ruleId, name, severity: severity || 'Medium', category: category || 'Custom', requiredFields: requiredFields || [], check: checkFn });

    await CustomRule.create({ ruleId, name, severity: severity || 'Medium', category: category || 'Custom', expression, message, requiredFields: requiredFields || [] });

    res.status(201).json({ success: true, ruleId, message: `Rule "${name}" added successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── DELETE /api/consistency/rules/:ruleId ─────────────────────────────────────

exports.removeRule = async (req, res) => {
  try {
    registry.remove(req.params.ruleId);
    await CustomRule.destroy({ where: { ruleId: req.params.ruleId } });
    res.json({ success: true, message: `Rule "${req.params.ruleId}" removed` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── PUT /api/consistency/rules/:ruleId/toggle ─────────────────────────────────

exports.toggleRule = async (req, res) => {
  try {
    const rule = await CustomRule.findOne({ where: { ruleId: req.params.ruleId } });
    if (!rule) return res.status(404).json({ error: 'Custom rule not found' });
    rule.enabled = !rule.enabled;
    await rule.save();

    if (rule.enabled) {
      // eslint-disable-next-line no-new-func
      const checkFn = new Function('row', `
        try { const result = (${rule.expression}); return result ? \`${rule.message}\` : null; }
        catch(e) { return null; }
      `);
      try { registry.add({ id: rule.ruleId, name: rule.name, severity: rule.severity, category: rule.category, requiredFields: rule.requiredFields, check: checkFn }); } catch (_) {}
    } else {
      try { registry.remove(rule.ruleId); } catch (_) {}
    }

    res.json({ success: true, ruleId: rule.ruleId, enabled: rule.enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/consistency/validate-inline ────────────────────────────────────
// Validate raw rows posted directly (no stored analysis needed).
// Body: { rows: [...], ruleIds?: [...] }

exports.validateInline = (req, res) => {
  const { rows, ruleIds } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'rows array is required' });
  try {
    const result = runRules(rows, ruleIds || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.loadCustomRules = loadCustomRules;
