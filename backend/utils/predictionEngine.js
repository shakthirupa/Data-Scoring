// ─────────────────────────────────────────────────────────────────────────────
// Predictive Integrity Index — Statistical Engine
// No external ML dependencies. Uses:
//   • Simple Moving Average (SMA)
//   • Exponential Moving Average (EMA)
//   • Ordinary Least Squares linear regression
//   • Z-score anomaly detection
//   • Weighted composite risk scoring
// ─────────────────────────────────────────────────────────────────────────────

// ── Moving Averages ───────────────────────────────────────────────────────────

function sma(values, window) {
  if (values.length < window) return values.reduce((a, b) => a + b, 0) / values.length;
  const slice = values.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function emaAll(values, alpha = 0.3) {
  if (values.length === 0) return [];
  const result = [values[0]];
  for (let i = 1; i < values.length; i++)
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  return result;
}

// ── Ordinary Least Squares regression ────────────────────────────────────────
// Returns { slope, intercept, r2 }

function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };

  const xs = ys.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - xMean) * (ys[i] - yMean);
    ssXX += (xs[i] - xMean) ** 2;
    ssYY += (ys[i] - yMean) ** 2;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const r2 = ssYY === 0 ? 1 : Math.min(1, Math.max(0, (ssXY ** 2) / (ssXX * ssYY)));

  return { slope: +slope.toFixed(4), intercept: +intercept.toFixed(4), r2: +r2.toFixed(4) };
}

// ── Weighted regression (recent points count more) ────────────────────────────

function weightedRegression(ys) {
  const n = ys.length;
  if (n < 2) return linearRegression(ys);

  // Weights: linear ramp 1..n
  const ws = ys.map((_, i) => i + 1);
  const wSum = ws.reduce((a, b) => a + b, 0);

  const xMean = ws.reduce((a, w, i) => a + w * i, 0) / wSum;
  const yMean = ws.reduce((a, w, i) => a + w * ys[i], 0) / wSum;

  let ssXY = 0, ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += ws[i] * (i - xMean) * (ys[i] - yMean);
    ssXX += ws[i] * (i - xMean) ** 2;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const { r2 } = linearRegression(ys); // reuse r2 from OLS

  return { slope: +slope.toFixed(4), intercept: +intercept.toFixed(4), r2 };
}

// ── Standard deviation & Z-score ─────────────────────────────────────────────

function stddev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

function zScores(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = stddev(values);
  if (sd === 0) return values.map(() => 0);
  return values.map(v => (v - mean) / sd);
}

// ── Anomaly detection ─────────────────────────────────────────────────────────
// A point is anomalous if |z| > threshold (default 2.0)

function detectAnomalies(values, threshold = 2.0) {
  const zs = zScores(values);
  return values.map((v, i) => ({ index: i, value: v, z: +zs[i].toFixed(3), anomaly: Math.abs(zs[i]) > threshold }));
}

// ── Confidence score ──────────────────────────────────────────────────────────
// Based on: number of data points, R², and volatility

function confidenceScore(n, r2, volatility) {
  // More data → higher confidence (caps at 20 points)
  const dataPts = Math.min(n / 20, 1) * 40;
  // Higher R² → higher confidence
  const fitScore = r2 * 40;
  // Lower volatility → higher confidence (volatility 0–30 range)
  const volScore = Math.max(0, 1 - volatility / 30) * 20;
  return Math.min(100, Math.round(dataPts + fitScore + volScore));
}

// ── Forecast series ───────────────────────────────────────────────────────────
// Projects N steps ahead using weighted regression + EMA blend.
// Returns [{step, predicted, lower, upper}]

function forecast(values, steps = 5) {
  const n = values.length;
  const { slope, intercept } = weightedRegression(values);
  const emas = emaAll(values, 0.3);
  const lastEma = emas[emas.length - 1];
  const sd = stddev(values);
  const results = [];

  for (let s = 1; s <= steps; s++) {
    const regPred = intercept + slope * (n - 1 + s);
    // Blend: 60% regression, 40% EMA extrapolation
    const emaPred = lastEma + slope * s;
    const blended = 0.6 * regPred + 0.4 * emaPred;
    const predicted = Math.min(100, Math.max(0, +blended.toFixed(2)));
    // Confidence interval widens with each step
    const margin = sd * (1 + s * 0.15);
    results.push({
      step: s,
      predicted,
      lower: +Math.max(0, predicted - margin).toFixed(2),
      upper: +Math.min(100, predicted + margin).toFixed(2),
    });
  }
  return results;
}

// ── Future risk score (0–100, higher = more risk) ─────────────────────────────
// Composite of: trend direction, volatility, anomaly rate, predicted score drop

function futureRiskScore({ slope, volatility, anomalyRate, predictedScore, currentScore, r2 }) {
  // Trend penalty: negative slope = degrading
  const trendRisk = Math.min(50, Math.max(0, -slope * 10));

  // Volatility risk: unpredictable data is risky
  const volRisk = Math.min(20, volatility * 0.8);

  // Anomaly risk: frequent anomalies signal instability
  const anomalyRisk = Math.min(15, anomalyRate * 100);

  // Predicted drop risk: if predicted score < current
  const dropRisk = Math.min(15, Math.max(0, (currentScore - predictedScore) * 0.5));

  const raw = trendRisk + volRisk + anomalyRisk + dropRisk;

  // Scale by inverse R² — low fit = less certainty = slightly lower risk score
  const scaled = raw * (0.7 + 0.3 * r2);

  return Math.min(100, Math.round(scaled));
}

function riskLevel(score) {
  if (score >= 70) return 'Critical';
  if (score >= 45) return 'High';
  if (score >= 20) return 'Medium';
  return 'Low';
}

function trendLabel(slope, volatility) {
  if (volatility > 15) return 'volatile';
  if (slope > 0.5)  return 'improving';
  if (slope < -0.5) return 'degrading';
  return 'stable';
}

// ── Main prediction function ──────────────────────────────────────────────────
// Input: array of snapshot objects sorted by snapshotAt ASC
// Output: full prediction payload

function computePrediction(snapshots, forecastSteps = 6) {
  const n = snapshots.length;

  // Extract score series
  const scores       = snapshots.map(s => s.overallScore);
  const completeness = snapshots.map(s => s.completeness ?? 0);
  const uniqueness   = snapshots.map(s => s.uniqueness ?? 0);
  const validity     = snapshots.map(s => s.validity ?? 0);
  const consistency  = snapshots.map(s => s.consistency ?? 0);

  // Regression on overall score
  const reg = weightedRegression(scores);
  const vol = +stddev(scores).toFixed(3);
  const emas = emaAll(scores, 0.3);
  const currentSma = sma(scores, Math.min(5, n));
  const momentum = +(emas[emas.length - 1] - currentSma).toFixed(3);

  // Anomaly detection
  const anomalyPoints = detectAnomalies(scores);
  const anomalyRate = anomalyPoints.filter(p => p.anomaly).length / n;

  // Forecast
  const forecastPts = forecast(scores, forecastSteps);
  const predictedScore = forecastPts[forecastPts.length - 1].predicted;
  const currentScore = scores[scores.length - 1];

  // Risk
  const riskScore = futureRiskScore({
    slope: reg.slope, volatility: vol, anomalyRate,
    predictedScore, currentScore, r2: reg.r2,
  });

  // Confidence
  const confidence = confidenceScore(n, reg.r2, vol);

  // Build historical series (visualization-ready)
  const historicalSeries = snapshots.map((s, i) => ({
    date: new Date(s.snapshotAt).toISOString().split('T')[0],
    score: s.overallScore,
    completeness: s.completeness,
    uniqueness: s.uniqueness,
    validity: s.validity,
    consistency: s.consistency,
    ema: +emas[i].toFixed(2),
    anomaly: anomalyPoints[i].anomaly,
    regressionLine: +(reg.intercept + reg.slope * i).toFixed(2),
  }));

  // Build forecast series — dates continue from last snapshot
  const lastDate = new Date(snapshots[n - 1].snapshotAt);
  const avgGapMs = n > 1
    ? (lastDate - new Date(snapshots[0].snapshotAt)) / (n - 1)
    : 7 * 24 * 3600 * 1000; // default 7 days

  const forecastSeries = forecastPts.map(pt => {
    const d = new Date(lastDate.getTime() + pt.step * avgGapMs);
    return {
      date: d.toISOString().split('T')[0],
      predicted: pt.predicted,
      lower: pt.lower,
      upper: pt.upper,
    };
  });

  // Anomaly series for chart markers
  const anomalySeries = anomalyPoints
    .filter(p => p.anomaly)
    .map(p => ({
      date: historicalSeries[p.index].date,
      score: p.value,
      z: p.z,
    }));

  // Per-dimension regression slopes (for breakdown)
  const dimTrends = {
    completeness: weightedRegression(completeness).slope,
    uniqueness:   weightedRegression(uniqueness).slope,
    validity:     weightedRegression(validity).slope,
    consistency:  weightedRegression(consistency).slope,
  };

  return {
    snapshotCount: n,
    currentScore,
    predictedScore,
    futureRiskScore: riskScore,
    riskLevel: riskLevel(riskScore),
    confidenceScore: confidence,
    trend: trendLabel(reg.slope, vol),
    trendSlope: reg.slope,
    volatility: vol,
    momentum,
    r2: reg.r2,
    anomalyRate: +anomalyRate.toFixed(3),
    anomalyCount: anomalySeries.length,
    dimTrends,
    historicalSeries,
    forecastSeries,
    anomalySeries,
  };
}

module.exports = { computePrediction, linearRegression, weightedRegression, sma, emaAll, stddev, detectAnomalies, forecast };
