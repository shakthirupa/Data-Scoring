const crypto = require('crypto');
const fs = require('fs');

// ── File hash ────────────────────────────────────────────────────────────────

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Hash raw string content (for non-file sources like Google Sheets)
function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ── Column type inference ────────────────────────────────────────────────────

function inferType(values) {
  const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return 'empty';
  if (nonEmpty.filter(v => !isNaN(Number(v))).length / nonEmpty.length >= 0.9) return 'numeric';
  const dateRe = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
  if (nonEmpty.filter(v => dateRe.test(String(v).trim())).length / nonEmpty.length >= 0.8) return 'date';
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (nonEmpty.filter(v => emailRe.test(String(v).trim())).length / nonEmpty.length >= 0.8) return 'email';
  return 'string';
}

// ── Per-column statistics ────────────────────────────────────────────────────

function columnStats(rows) {
  if (!rows.length) return {};
  const columns = Object.keys(rows[0]);
  const stats = {};

  columns.forEach(col => {
    const values = rows.map(r => r[col]);
    const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
    const nullCount = values.length - nonEmpty.length;
    const type = inferType(values);
    const uniqueCount = new Set(nonEmpty.map(v => String(v).trim().toLowerCase())).size;

    let mean = null, min = null, max = null, stddev = null;

    if (type === 'numeric' && nonEmpty.length > 0) {
      const nums = nonEmpty.map(Number);
      mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      min = Math.min(...nums);
      max = Math.max(...nums);
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
      stddev = +Math.sqrt(variance).toFixed(4);
      mean = +mean.toFixed(4);
    }

    stats[col] = { type, nullCount, uniqueCount, mean, min, max, stddev };
  });

  return stats;
}

// ── Schema signature (sorted col:type pairs) ─────────────────────────────────

function schemaSignature(stats) {
  return Object.entries(stats)
    .map(([col, s]) => `${col}:${s.type}`)
    .sort()
    .join('|');
}

// ── Composite fingerprint hash ────────────────────────────────────────────────
// Combines fileHash + rowCount + schema + rounded stats into one SHA-256 hex.
// Two datasets with the same composite hash are considered identical regardless
// of filename.

function compositeHash(fileHash, rowCount, stats) {
  const schema = schemaSignature(stats);
  const statSummary = Object.entries(stats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([col, s]) => `${col}:nc=${s.nullCount},mean=${s.mean !== null ? s.mean.toFixed(1) : 'null'},uc=${s.uniqueCount}`)
    .join(';');
  const raw = `${fileHash}|rows=${rowCount}|schema=${schema}|stats=${statSummary}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── Similarity score between two stored fingerprint records (0–100) ───────────
// 100  = byte-for-byte identical file
// ≥80  = very likely same dataset (minor edits / renames)
// 50–79 = structurally similar (same schema, different data)
// <50  = different datasets

function similarityScore(fpA, fpB) {
  if (fpA.fileHash === fpB.fileHash) return 100;

  let score = 0;

  // Row count similarity — 20 pts
  const rowDiff = Math.abs(fpA.rowCount - fpB.rowCount) / Math.max(fpA.rowCount, fpB.rowCount, 1);
  score += (1 - rowDiff) * 20;

  // Schema overlap — 40 pts (Jaccard on col:type tokens)
  const schemaA = new Set(fpA.schemaSignature.split('|'));
  const schemaB = new Set(fpB.schemaSignature.split('|'));
  const intersection = [...schemaA].filter(x => schemaB.has(x)).length;
  const union = new Set([...schemaA, ...schemaB]).size;
  score += (intersection / Math.max(union, 1)) * 40;

  // Column-level stat similarity — 40 pts
  const statsA = fpA.columnStats;
  const statsB = fpB.columnStats;
  const sharedCols = Object.keys(statsA).filter(c => statsB[c]);
  if (sharedCols.length > 0) {
    let statScore = 0;
    sharedCols.forEach(col => {
      const a = statsA[col];
      const b = statsB[col];
      const nullRateDiff = Math.abs(
        a.nullCount / Math.max(fpA.rowCount, 1) - b.nullCount / Math.max(fpB.rowCount, 1)
      );
      statScore += (1 - Math.min(nullRateDiff, 1));
      if (a.mean !== null && b.mean !== null) {
        const maxMean = Math.max(Math.abs(a.mean), Math.abs(b.mean), 1);
        statScore += (1 - Math.min(Math.abs(a.mean - b.mean) / maxMean, 1));
      }
    });
    score += (statScore / (sharedCols.length * 2)) * 40;
  }

  return Math.min(100, Math.round(score));
}

module.exports = { hashFile, hashContent, columnStats, schemaSignature, compositeHash, similarityScore };
