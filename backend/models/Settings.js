const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Settings = sequelize.define('Settings', {
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId:          { type: DataTypes.INTEGER, allowNull: true },
  notifications:   { type: DataTypes.JSONB, defaultValue: { email: true, analysisCompletion: true, weeklySummary: false, criticalAlerts: true } },
  thresholds:      { type: DataTypes.JSONB, defaultValue: { minAcceptableScore: 60, alertThreshold: 70 } },
  nullableColumns: { type: DataTypes.JSONB, defaultValue: [] },
  apiKey:          { type: DataTypes.STRING },
}, { tableName: 'settings', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

module.exports = Settings;
