const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

// Stores custom rules added via the API (built-ins live only in ruleEngine.js)
const CustomRule = sequelize.define('CustomRule', {
  id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ruleId:       { type: DataTypes.STRING, allowNull: false, unique: true },
  name:         { type: DataTypes.STRING, allowNull: false },
  severity:     { type: DataTypes.ENUM('Critical', 'High', 'Medium', 'Low'), defaultValue: 'Medium' },
  category:     { type: DataTypes.STRING, defaultValue: 'Custom' },
  // Serialised JS expression: "row.age < 10 && /phd/i.test(row.degree)"
  // We eval this safely inside a sandboxed function at runtime.
  expression:   { type: DataTypes.TEXT, allowNull: false },
  // Human-readable message template, e.g. "Age {age} cannot have degree {degree}"
  message:      { type: DataTypes.TEXT, allowNull: false },
  requiredFields: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  enabled:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'custom_rules', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

// Stores per-analysis consistency results
const ConsistencyResult = sequelize.define('ConsistencyResult', {
  id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  analysisId:       { type: DataTypes.INTEGER, references: { model: Analysis, key: 'id' }, onDelete: 'CASCADE' },
  totalRows:        { type: DataTypes.INTEGER },
  flaggedCount:     { type: DataTypes.INTEGER },
  consistencyScore: { type: DataTypes.FLOAT },
  ruleSummary:      { type: DataTypes.JSONB, defaultValue: [] },
  flaggedRows:      { type: DataTypes.JSONB, defaultValue: [] },
}, { tableName: 'consistency_results', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

Analysis.hasOne(ConsistencyResult, { foreignKey: 'analysisId', onDelete: 'CASCADE' });
ConsistencyResult.belongsTo(Analysis, { foreignKey: 'analysisId' });

module.exports = { CustomRule, ConsistencyResult };
