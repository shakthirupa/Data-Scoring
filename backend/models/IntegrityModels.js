const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

// One snapshot per analysis upload — the historical record used for prediction.
// For recurring datasets (same fileName), multiple snapshots accumulate over time.
const IntegritySnapshot = sequelize.define('IntegritySnapshot', {
  id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  analysisId:    { type: DataTypes.INTEGER, references: { model: Analysis, key: 'id' }, onDelete: 'CASCADE' },

  // Dataset identity — group snapshots for the same recurring file
  fileName:      { type: DataTypes.STRING, allowNull: false },
  fileGroup:     { type: DataTypes.STRING, allowNull: false }, // normalised filename key

  // Core quality dimensions
  overallScore:  { type: DataTypes.FLOAT, allowNull: false },
  completeness:  { type: DataTypes.FLOAT },
  uniqueness:    { type: DataTypes.FLOAT },
  validity:      { type: DataTypes.FLOAT },
  consistency:   { type: DataTypes.FLOAT },
  problemRowPct: { type: DataTypes.FLOAT, defaultValue: 0 },
  rowCount:      { type: DataTypes.INTEGER },

  // Derived signals stored at snapshot time
  velocityScore: { type: DataTypes.FLOAT, defaultValue: 0 }, // delta from previous snapshot
  anomalyFlag:   { type: DataTypes.BOOLEAN, defaultValue: false },
  anomalyReason: { type: DataTypes.STRING },

  snapshotAt:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'integrity_snapshots',
  timestamps: false,
  indexes: [
    { fields: ['fileGroup'] },
    { fields: ['snapshotAt'] },
    { fields: ['analysisId'] },
  ],
});

// Stores computed prediction results — one per fileGroup per prediction run
const IntegrityPrediction = sequelize.define('IntegrityPrediction', {
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  fileGroup:       { type: DataTypes.STRING, allowNull: false },
  fileName:        { type: DataTypes.STRING },

  // Prediction outputs
  futureRiskScore: { type: DataTypes.FLOAT },   // 0–100, higher = more risk
  riskLevel:       { type: DataTypes.STRING },   // Low / Medium / High / Critical
  predictedScore:  { type: DataTypes.FLOAT },    // predicted overallScore N steps ahead
  confidenceScore: { type: DataTypes.FLOAT },    // 0–100, model confidence

  // Trend signals
  trend:           { type: DataTypes.STRING },   // improving / stable / degrading / volatile
  trendSlope:      { type: DataTypes.FLOAT },    // regression slope per snapshot
  volatility:      { type: DataTypes.FLOAT },    // std-dev of recent scores
  momentum:        { type: DataTypes.FLOAT },    // EMA - SMA delta

  // Visualization-ready series (JSONB arrays)
  historicalSeries:  { type: DataTypes.JSONB, defaultValue: [] }, // [{date, score, ...dims}]
  forecastSeries:    { type: DataTypes.JSONB, defaultValue: [] }, // [{date, predicted, lower, upper}]
  anomalySeries:     { type: DataTypes.JSONB, defaultValue: [] }, // [{date, score, anomaly: true}]

  snapshotCount:   { type: DataTypes.INTEGER },
  computedAt:      { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'integrity_predictions',
  timestamps: false,
  indexes: [{ fields: ['fileGroup'] }, { fields: ['computedAt'] }],
});

module.exports = { IntegritySnapshot, IntegrityPrediction };
