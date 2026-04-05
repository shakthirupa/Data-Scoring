const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Student = sequelize.define('Student', {
  id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  rollNumber:  { type: DataTypes.STRING, unique: true },
  name:        { type: DataTypes.STRING },
  aadhaar:     { type: DataTypes.STRING(12) },
  phone:       { type: DataTypes.STRING },
  email:       { type: DataTypes.STRING },
  pan:         { type: DataTypes.STRING(10) },
  dlNumber:    { type: DataTypes.STRING },
  sourceFile:  { type: DataTypes.STRING },
  analysisId:  { type: DataTypes.INTEGER },
  verified:    { type: DataTypes.BOOLEAN, defaultValue: false },
  verifyResult:{ type: DataTypes.JSONB },   // stores last verification result per field
}, { tableName: 'students', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

module.exports = Student;
