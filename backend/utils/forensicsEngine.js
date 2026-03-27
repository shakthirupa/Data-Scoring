// ─────────────────────────────────────────────────────────────────────────────
// Instant Data Forensics Engine
// Produces: column profiles, anomaly timeline, root cause chains, explanations
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_VALUES = new Set(['', 'null', 'none', 'n/a', 'na', 'undefined', '-', '--', 'nil', 'missing', 'nan']);
const isEmpty = v => v === null || v === undefined || EMPTY_VALUES.has(String(v).trim().toLowerCase());

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferType(values) {
  const nonEmpty = values.filter(v => !isEmpty(v));
  if (!nonEmpty.length) return 'empty';
  const numRatio = nonEmpty.filter(v => !isNaN(Number(v))).length / nonEmpty.length;
  if (numRatio >= 0.9) return 'numeric';
  const dateRe = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
  if (nonEmpty.filter(v => dateRe.test(String(v).trim())).length / nonEmpty.length >= 0.8) return 'date';
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (nonEmpty.filter(v => emailRe.test(String(v).trim())).length / nonEmpty.length >= 0.8) return 'email';
  const boolRe = /^(true|false|yes|no|1|0)$/i;
  if (nonEmpty.filter(v => boolRe.test(String(v).trim())).length / nonEmpty.length >= 0.9) return 'boolean';
  return 'string';
}

function numStats(nums) {
  if (!nums.length) return {};
  const sorted = [...nums].sort((a, b) => a - b);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  const stddev = Math.sqrt(variance);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return { mean: +mean.toFixed(3), stddev: +stddev.toFixed(3), min: sorted[0], max: sorted[sorted.length - 1], q1, median, q3, iqr: +iqr.toFixed(3) };
}

function topValues(values, n = 5) {
  const freq = {};
  values.forEach(v => { const k = String(v).trim(); freq[k] = (freq[k] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
}

// ── Column profiler ───────────────────────────────────────────────────────────

function profileColumns(rows) {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const total = rows.length;

  return columns.map(col => {
    const values = rows.map(r => r[col]);
    const nonEmpty = values.filter(v => !isEmpty(v));
    const nullCount = total - nonEmpty.length;
    const nullPct = +(nullCount / total * 100).toFixed(1);
    const type = inferType(values);
    const uniqueCount = new Set(nonEmpty.map(v => String(v).trim().toLowerCase())).size;
    const uniquenessRatio = +(uniqueCount / Math.max(nonEmpty.length, 1) * 100).toFixed(1);
    const top = topValues(nonEmpty);

    let stats = {};
    let outliers = [];
    let patternIssues = [];

    if (type === 'numeric') {
      const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
      stats = numStats(nums);
      // IQR-based outlier detection
      const lo = stats.q1 - 1.5 * stats.iqr;
      const hi = stats.q3 + 1.5 * stats.iqr;
      outliers = nums.filter(n => n < lo || n > hi);
    }

    if (type === 'email') {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalid = nonEmpty.filter(v => !emailRe.test(String(v).trim()));
      if (invalid.length) patternIssues.push({ pattern: 'invalid_email', count: invalid.length, examples: invalid.slice(0, 3) });
    }

    if (type === 'date') {
      const dateRe = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
      const invalid = nonEmpty.filter(v => !dateRe.test(String(v).trim()));
      if (invalid.length) patternIssues.push({ pattern: 'invalid_date_format', count: invalid.length, examples: invalid.slice(0, 3) });
      // Future dates
      const future = nonEmpty.filter(v => { const d = new Date(v); return !isNaN(d) && d > new Date(); });
      if (future.length) patternIssues.push({ pattern: 'future_date', count: future.length, examples: future.slice(0, 3) });
    }

    // Mixed type detection
    if (type === 'string') {
      const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
      if (numCount > 0 && numCount < nonEmpty.length * 0.9)
        patternIssues.push({ pattern: 'mixed_types', count: numCount, examples: nonEmpty.filter(v => !isNaN(Number(v))).slice(0, 3) });
    }

    // Whitespace / casing inconsistency
    const hasLeadingTrailing = nonEmpty.filter(v => String(v) !== String(v).trim()).length;
    if (hasLeadingTrailing) patternIssues.push({ pattern: 'whitespace_padding', count: hasLeadingTrailing });

    const casings = new Set(nonEmpty.map(v => {
      const s = String(v).trim();
      if (s === s.toUpperCase()) return 'upper';
      if (s === s.toLowerCase()) return 'lower';
      return 'mixed';
    }));
    if (casings.size > 1 && type === 'string')
      patternIssues.push({ pattern: 'inconsistent_casing', count: casings.size });

    return {
      column: col, type, total, nullCount, nullPct, uniqueCount, uniquenessRatio,
      top, stats, outlierCount: outliers.length, outlierExamples: outliers.slice(0, 5),
      patternIssues,
    };
  });
}

// ── Anomaly detector ──────────────────────────────────────────────────────────
// Scans every row and every column for cell-level anomalies.
// Returns a flat list of anomaly events sorted by severity.

function detectAnomalies(rows, profiles) {
  const events = [];
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.column] = p; });

  // Pre-compute IQR bounds for numeric columns
  const bounds = {};
  profiles.forEach(p => {
    if (p.type === 'numeric' && p.stats.iqr !== undefined) {
      bounds[p.column] = { lo: p.stats.q1 - 1.5 * p.stats.iqr, hi: p.stats.q3 + 1.5 * p.stats.iqr };
    }
  });

  // Duplicate detection
  const seen = new Map();
  rows.forEach((row, idx) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      events.push({
        type: 'duplicate_row', severity: 'High', rowIndex: idx + 1,
        column: null, value: null,
        description: `Row ${idx + 1} is an exact duplicate of row ${seen.get(key) + 1}`,
        rootCause: 'Data was likely inserted or imported multiple times without deduplication.',
      });
    } else {
      seen.set(key, idx);
    }
  });

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    Object.entries(row).forEach(([col, rawVal]) => {
      const p = profileMap[col];
      if (!p) return;
      const val = String(rawVal ?? '').trim();

      // Missing value
      if (isEmpty(rawVal)) {
        events.push({
          type: 'missing_value', severity: p.nullPct > 30 ? 'Critical' : p.nullPct > 10 ? 'High' : 'Medium',
          rowIndex: rowNum, column: col, value: rawVal,
          description: `Missing value in column "${col}" at row ${rowNum}`,
          rootCause: rootCauseMissing(col, p),
        });
        return;
      }

      // Numeric outlier
      if (p.type === 'numeric' && bounds[col]) {
        const n = Number(val);
        if (!isNaN(n) && (n < bounds[col].lo || n > bounds[col].hi)) {
          events.push({
            type: 'outlier', severity: 'Medium', rowIndex: rowNum, column: col, value: n,
            description: `Outlier in "${col}": ${n} (expected ${bounds[col].lo.toFixed(1)}–${bounds[col].hi.toFixed(1)})`,
            rootCause: rootCauseOutlier(col, n, p.stats),
          });
        }
      }

      // Invalid email
      if (p.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        events.push({
          type: 'invalid_format', severity: 'Medium', rowIndex: rowNum, column: col, value: val,
          description: `Invalid email format in "${col}" at row ${rowNum}: "${val}"`,
          rootCause: 'Email was likely entered manually without validation or copied from a non-email field.',
        });
      }

      // Invalid date
      if (p.type === 'date') {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          events.push({
            type: 'invalid_format', severity: 'Medium', rowIndex: rowNum, column: col, value: val,
            description: `Invalid date in "${col}" at row ${rowNum}: "${val}"`,
            rootCause: 'Date format is inconsistent with the rest of the column. Possible manual entry or system migration issue.',
          });
        } else if (d > new Date()) {
          events.push({
            type: 'future_date', severity: 'High', rowIndex: rowNum, column: col, value: val,
            description: `Future date in "${col}" at row ${rowNum}: "${val}"`,
            rootCause: 'Date is set in the future. Likely a data entry error, placeholder value, or incorrect year.',
          });
        }
      }

      // Whitespace padding
      if (String(rawVal) !== val && val.length > 0) {
        events.push({
          type: 'whitespace', severity: 'Low', rowIndex: rowNum, column: col, value: rawVal,
          description: `Leading/trailing whitespace in "${col}" at row ${rowNum}`,
          rootCause: 'Value was likely copy-pasted or exported from a system that does not trim strings.',
        });
      }
    });
  });

  const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return events.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

// ── Root cause inference ──────────────────────────────────────────────────────

function rootCauseMissing(col, profile) {
  const colL = col.toLowerCase();
  if (profile.nullPct > 50) return `Over half of "${col}" is empty — this column may be optional, deprecated, or was added after initial data collection.`;
  if (colL.includes('phone') || colL.includes('mobile')) return `Phone numbers are often voluntarily withheld by users. Consider making this field optional in your data model.`;
  if (colL.includes('email')) return `Missing emails may indicate records imported from a system that did not require email registration.`;
  if (colL.includes('date') || colL.includes('dob')) return `Missing dates often result from manual data entry skipping optional fields or legacy records predating the field.`;
  if (colL.includes('address') || colL.includes('zip') || colL.includes('city')) return `Address fields are frequently incomplete in datasets sourced from multiple intake forms with different required fields.`;
  return `Missing values in "${col}" may result from optional fields, failed ETL transformations, or records from an older schema version.`;
}

function rootCauseOutlier(col, value, stats) {
  const colL = col.toLowerCase();
  const zScore = stats.stddev > 0 ? Math.abs((value - stats.mean) / stats.stddev) : 0;
  if (colL.includes('age') && value > 100) return `Age value ${value} exceeds realistic human lifespan. Likely a data entry error (e.g., birth year entered instead of age) or a placeholder.`;
  if (colL.includes('salary') || colL.includes('income')) return `Salary ${value} is ${zScore.toFixed(1)}σ from the mean ($${stats.mean.toFixed(0)}). Could be a test record, executive compensation, or a unit mismatch (monthly vs annual).`;
  if (colL.includes('price') || colL.includes('amount')) return `Value ${value} is ${zScore.toFixed(1)}σ from the mean. Possible causes: unit error (cents vs dollars), bulk order, or manual override.`;
  if (colL.includes('quantity') || colL.includes('qty')) return `Quantity ${value} is unusually ${value > stats.mean ? 'high' : 'low'}. May indicate a bulk transaction, data entry error, or inventory adjustment.`;
  return `Value ${value} is ${zScore.toFixed(1)} standard deviations from the column mean (${stats.mean.toFixed(2)}). Investigate for data entry errors or legitimate edge cases.`;
}

// ── Cross-field inconsistency detector ───────────────────────────────────────

function detectCrossFieldIssues(rows) {
  const issues = [];
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const get = field => {
      const key = Object.keys(row).find(k => k.toLowerCase().includes(field));
      return key ? String(row[key] ?? '').trim() : null;
    };
    const getNum = field => { const v = get(field); return v && !isNaN(Number(v)) ? Number(v) : null; };

    const age = getNum('age');
    const exp = getNum('experience') ?? getNum('exp');
    const salary = getNum('salary') ?? getNum('income') ?? getNum('wage');
    const job = get('job') ?? get('title') ?? get('role') ?? get('position');
    const dob = get('dob') ?? get('birth');
    const city = get('city') ?? get('town');
    const country = get('country');
    const degree = get('degree') ?? get('education') ?? get('qualification');

    if (age !== null && exp !== null && exp >= age - 14)
      issues.push({ rowIndex: rowNum, type: 'cross_field', severity: 'High', fields: ['age', 'experience'], description: `Row ${rowNum}: ${exp} years experience is impossible for age ${age}`, rootCause: 'Experience field likely contains total career years from a different record, or age was entered incorrectly.' });

    if (age !== null && degree && age < 22 && /phd|doctorate/i.test(degree))
      issues.push({ rowIndex: rowNum, type: 'cross_field', severity: 'High', fields: ['age', 'degree'], description: `Row ${rowNum}: Age ${age} cannot hold a PhD`, rootCause: 'Degree field may have been copied from another record, or age was entered as birth year.' });

    if (salary !== null && job && /intern|trainee/i.test(job) && salary > 80000)
      issues.push({ rowIndex: rowNum, type: 'cross_field', severity: 'Medium', fields: ['salary', 'job'], description: `Row ${rowNum}: Intern salary $${salary.toLocaleString()} is unusually high`, rootCause: 'Salary may belong to a different role, or job title was not updated after a promotion.' });

    if (dob && age !== null) {
      const birth = new Date(dob);
      if (!isNaN(birth.getTime())) {
        const computed = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
        if (Math.abs(computed - age) > 1)
          issues.push({ rowIndex: rowNum, type: 'cross_field', severity: 'High', fields: ['dob', 'age'], description: `Row ${rowNum}: DOB ${dob} implies age ${computed}, but age field says ${age}`, rootCause: 'Age was likely calculated at a different point in time and not updated, or one of the fields was manually overridden.' });
      }
    }
  });
  return issues;
}

// ── Event chain builder ───────────────────────────────────────────────────────
// Groups anomalies into a causal chain: what likely happened, in what order.

function buildEventChain(anomalies, crossFieldIssues, profiles) {
  const allEvents = [...anomalies, ...crossFieldIssues];
  const chain = [];

  // Group by type to find systemic patterns
  const byType = {};
  allEvents.forEach(e => { (byType[e.type] = byType[e.type] || []).push(e); });

  // Step 1: Data ingestion issues (missing values, whitespace)
  const missing = byType['missing_value'] || [];
  const whitespace = byType['whitespace'] || [];
  if (missing.length || whitespace.length) {
    const affectedCols = [...new Set(missing.map(e => e.column))];
    chain.push({
      step: 1, phase: 'Data Ingestion',
      event: `${missing.length} missing values and ${whitespace.length} whitespace issues detected`,
      affectedColumns: affectedCols,
      explanation: missing.length > 0
        ? `The dataset appears to have been collected from multiple sources or intake forms with different required fields. Columns ${affectedCols.slice(0, 3).map(c => `"${c}"`).join(', ')} show the highest null rates, suggesting they were optional or added after initial data collection began.`
        : `Whitespace padding in ${whitespace.length} cells suggests data was copy-pasted or exported from a system without string trimming.`,
      severity: missing.some(e => e.severity === 'Critical') ? 'Critical' : 'High',
    });
  }

  // Step 2: Format / validation failures
  const formatIssues = [...(byType['invalid_format'] || []), ...(byType['future_date'] || [])];
  if (formatIssues.length) {
    const affectedCols = [...new Set(formatIssues.map(e => e.column))];
    chain.push({
      step: 2, phase: 'Data Validation',
      event: `${formatIssues.length} format violations across ${affectedCols.length} column(s)`,
      affectedColumns: affectedCols,
      explanation: `Format errors in ${affectedCols.map(c => `"${c}"`).join(', ')} indicate that input validation was not enforced at the point of data entry. This commonly occurs when data is imported from spreadsheets, legacy systems, or third-party APIs without schema enforcement.`,
      severity: 'Medium',
    });
  }

  // Step 3: Duplicate records
  const dupes = byType['duplicate_row'] || [];
  if (dupes.length) {
    chain.push({
      step: 3, phase: 'Data Deduplication',
      event: `${dupes.length} duplicate rows found`,
      affectedColumns: ['all'],
      explanation: `${dupes.length} exact duplicate rows were detected. This typically results from: (1) multiple imports of the same source file, (2) ETL pipeline retries without idempotency checks, or (3) manual data entry of the same record by different operators.`,
      severity: dupes.length > 10 ? 'Critical' : 'High',
    });
  }

  // Step 4: Statistical outliers
  const outliers = byType['outlier'] || [];
  if (outliers.length) {
    const affectedCols = [...new Set(outliers.map(e => e.column))];
    chain.push({
      step: 4, phase: 'Statistical Integrity',
      event: `${outliers.length} statistical outliers in ${affectedCols.length} numeric column(s)`,
      affectedColumns: affectedCols,
      explanation: `Outliers in ${affectedCols.map(c => `"${c}"`).join(', ')} suggest either legitimate edge cases (e.g., executive salaries, bulk orders) or data entry errors. Columns with high outlier rates relative to their IQR range are most likely to contain errors rather than genuine extremes.`,
      severity: 'Medium',
    });
  }

  // Step 5: Cross-field logical inconsistencies
  const crossField = byType['cross_field'] || [];
  if (crossField.length) {
    const affectedPairs = [...new Set(crossField.map(e => (e.fields || []).join(' ↔ ')))];
    chain.push({
      step: 5, phase: 'Logical Consistency',
      event: `${crossField.length} cross-field logical inconsistencies`,
      affectedColumns: affectedPairs,
      explanation: `Logical conflicts between related fields (${affectedPairs.slice(0, 3).join(', ')}) indicate that fields were updated independently without referential checks. This is a common symptom of manual data corrections applied to one field without updating dependent fields.`,
      severity: 'High',
    });
  }

  return chain;
}

// ── Summary explanation generator ────────────────────────────────────────────
// Produces a single human-readable paragraph summarising the dataset's health.

function generateSummary(analysis, profiles, anomalies, crossFieldIssues, eventChain) {
  const totalIssues = anomalies.length + crossFieldIssues.length;
  const criticalCount = [...anomalies, ...crossFieldIssues].filter(e => e.severity === 'Critical').length;
  const highCount = [...anomalies, ...crossFieldIssues].filter(e => e.severity === 'High').length;
  const nullyColumns = profiles.filter(p => p.nullPct > 20).map(p => p.column);
  const outlierColumns = profiles.filter(p => p.outlierCount > 0).map(p => p.column);
  const score = analysis.overallScore;

  const healthLabel = score >= 85 ? 'good' : score >= 70 ? 'moderate' : score >= 50 ? 'poor' : 'critical';
  const phases = eventChain.map(e => e.phase);

  let summary = `Dataset "${analysis.fileName}" (${analysis.rowCount.toLocaleString()} rows) has ${healthLabel} overall data quality with a score of ${score}/100. `;

  if (totalIssues === 0) {
    summary += `No significant issues were detected. The dataset appears clean and consistent.`;
  } else {
    summary += `Forensic analysis identified ${totalIssues} issue${totalIssues > 1 ? 's' : ''} across ${phases.length} quality dimension${phases.length > 1 ? 's' : ''}. `;

    if (criticalCount > 0) summary += `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require immediate attention. `;
    if (highCount > 0) summary += `${highCount} high-severity finding${highCount > 1 ? 's' : ''} were flagged. `;

    if (nullyColumns.length > 0)
      summary += `Completeness is the primary concern — columns ${nullyColumns.slice(0, 3).map(c => `"${c}"`).join(', ')} have significant null rates, suggesting inconsistent data collection practices. `;

    if (outlierColumns.length > 0)
      summary += `Statistical outliers in ${outlierColumns.slice(0, 2).map(c => `"${c}"`).join(' and ')} may indicate unit mismatches or data entry errors. `;

    if (crossFieldIssues.length > 0)
      summary += `${crossFieldIssues.length} cross-field logical inconsistenc${crossFieldIssues.length > 1 ? 'ies' : 'y'} suggest fields were updated independently without referential integrity checks. `;

    summary += `The most likely root cause is ${rootCauseNarrative(eventChain, profiles)}.`;
  }

  return summary;
}

function rootCauseNarrative(eventChain, profiles) {
  if (!eventChain.length) return 'no systemic data quality issues';
  const phases = eventChain.map(e => e.phase.toLowerCase());
  if (phases.includes('data ingestion') && phases.includes('logical consistency'))
    return 'a combination of multi-source data ingestion without schema enforcement and independent field updates without referential checks';
  if (phases.includes('data deduplication'))
    return 'repeated data imports without idempotency controls, leading to duplicate records';
  if (phases.includes('data ingestion'))
    return 'inconsistent data collection across multiple intake forms or source systems';
  if (phases.includes('logical consistency'))
    return 'manual data corrections applied to individual fields without updating dependent fields';
  if (phases.includes('statistical integrity'))
    return 'unit inconsistencies or data entry errors in numeric fields';
  return 'data quality issues across multiple dimensions';
}

// ── Main forensics function ───────────────────────────────────────────────────

function runForensics(analysis) {
  const rows = analysis.rawData || [];
  if (!rows.length) return null;

  const profiles = profileColumns(rows);
  const anomalies = detectAnomalies(rows, profiles);
  const crossFieldIssues = detectCrossFieldIssues(rows);
  const eventChain = buildEventChain(anomalies, crossFieldIssues, profiles);
  const summary = generateSummary(analysis, profiles, anomalies, crossFieldIssues, eventChain);

  // Anomaly timeline: group by row index, sorted ascending
  const timeline = Object.values(
    [...anomalies, ...crossFieldIssues].reduce((acc, e) => {
      const key = e.rowIndex;
      if (!acc[key]) acc[key] = { rowIndex: key, events: [] };
      acc[key].events.push({ type: e.type, severity: e.severity, column: e.column, description: e.description, rootCause: e.rootCause });
      return acc;
    }, {})
  ).sort((a, b) => a.rowIndex - b.rowIndex);

  // Top issues by frequency
  const issueFrequency = {};
  [...anomalies, ...crossFieldIssues].forEach(e => {
    const key = `${e.type}:${e.column || 'row'}`;
    issueFrequency[key] = (issueFrequency[key] || 0) + 1;
  });
  const topIssues = Object.entries(issueFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => { const [type, column] = key.split(':'); return { type, column, count }; });

  return {
    summary,
    eventChain,
    timeline,
    topIssues,
    columnProfiles: profiles,
    totalAnomalies: anomalies.length,
    totalCrossFieldIssues: crossFieldIssues.length,
    severityBreakdown: {
      Critical: [...anomalies, ...crossFieldIssues].filter(e => e.severity === 'Critical').length,
      High:     [...anomalies, ...crossFieldIssues].filter(e => e.severity === 'High').length,
      Medium:   [...anomalies, ...crossFieldIssues].filter(e => e.severity === 'Medium').length,
      Low:      [...anomalies, ...crossFieldIssues].filter(e => e.severity === 'Low').length,
    },
  };
}

module.exports = { runForensics, profileColumns, detectAnomalies, detectCrossFieldIssues, buildEventChain };
