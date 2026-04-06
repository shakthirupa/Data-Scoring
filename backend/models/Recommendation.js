const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

const Recommendation = sequelize.define('Recommendation', {
  id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  analysisId: { type: DataTypes.INTEGER, references: { model: Analysis, key: 'id' } },
  items:      { type: DataTypes.JSONB, defaultValue: [] },
}, { tableName: 'recommendations', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

Analysis.hasOne(Recommendation, { foreignKey: 'analysisId' });
Recommendation.belongsTo(Analysis, { foreignKey: 'analysisId' });

module.exports = Recommendation;
