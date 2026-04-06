const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

const ForensicsReport = sequelize.define('ForensicsReport', {
  id:                    { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  analysisId:            { type: DataTypes.INTEGER, unique: true, references: { model: Analysis, key: 'id' }, onDelete: 'CASCADE' },
  summary:               { type: DataTypes.TEXT },
  eventChain:            { type: DataTypes.JSONB, defaultValue: [] },
  timeline:              { type: DataTypes.JSONB, defaultValue: [] },
  topIssues:             { type: DataTypes.JSONB, defaultValue: [] },
  columnProfiles:        { type: DataTypes.JSONB, defaultValue: [] },
  severityBreakdown:     { type: DataTypes.JSONB, defaultValue: {} },
  totalAnomalies:        { type: DataTypes.INTEGER, defaultValue: 0 },
  totalCrossFieldIssues: { type: DataTypes.INTEGER, defaultValue: 0 },
  computedAt:            { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'forensics_reports',
  timestamps: false,
  indexes: [{ fields: ['analysisId'] }],
});

Analysis.hasOne(ForensicsReport, { foreignKey: 'analysisId', onDelete: 'CASCADE' });
ForensicsReport.belongsTo(Analysis, { foreignKey: 'analysisId' });

module.exports = ForensicsReport;
