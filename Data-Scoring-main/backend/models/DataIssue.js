const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

const DataIssue = sequelize.define('DataIssue', {
  id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  analysisId:  { type: DataTypes.INTEGER, references: { model: Analysis, key: 'id' }, onDelete: 'CASCADE' },
  issueType:   { type: DataTypes.ENUM('Missing', 'Duplicate', 'Invalid', 'Inconsistent') },
  severity:    { type: DataTypes.ENUM('Critical', 'High', 'Medium', 'Low') },
  description: { type: DataTypes.TEXT },
  affectedRows:{ type: DataTypes.INTEGER },
  column:      { type: DataTypes.STRING },
  resolved:    { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'data_issues', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

Analysis.hasMany(DataIssue, { foreignKey: 'analysisId', onDelete: 'CASCADE' });
DataIssue.belongsTo(Analysis, { foreignKey: 'analysisId', onDelete: 'CASCADE' });

module.exports = DataIssue;
