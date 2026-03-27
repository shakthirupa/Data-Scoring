const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Analysis = sequelize.define('Analysis', {
  id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  fileName: { type: DataTypes.STRING, allowNull: false },
  fileSize: { type: DataTypes.INTEGER },
  rowCount: { type: DataTypes.INTEGER },
  completeness:  { type: DataTypes.FLOAT },
  uniqueness:    { type: DataTypes.FLOAT },
  validity:      { type: DataTypes.FLOAT },
  consistency:   { type: DataTypes.FLOAT },
  overallScore:  { type: DataTypes.FLOAT },
  problemRowPct: { type: DataTypes.FLOAT, defaultValue: 0 },
  rowQuality:    { type: DataTypes.FLOAT, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'Completed' },
  rawData: { type: DataTypes.JSONB, defaultValue: [] },
}, { tableName: 'analyses', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

module.exports = Analysis;
