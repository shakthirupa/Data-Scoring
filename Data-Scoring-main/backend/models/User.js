const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const User = sequelize.define('User', {
  id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name:         { type: DataTypes.STRING, allowNull: false },
  email:        { type: DataTypes.STRING, allowNull: false, unique: true },
  password:     { type: DataTypes.STRING, allowNull: false },
  organization: { type: DataTypes.STRING, defaultValue: '' },
  role:         { type: DataTypes.STRING, defaultValue: 'Data Analyst' },
  totalAnalyses:    { type: DataTypes.INTEGER, defaultValue: 0 },
  avgQualityScore:  { type: DataTypes.FLOAT,   defaultValue: 0 },
  daysActive:       { type: DataTypes.INTEGER, defaultValue: 0 },
  isVerified:       { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'users', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

module.exports = User;
