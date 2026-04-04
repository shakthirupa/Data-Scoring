const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const OtpVerification = sequelize.define('OtpVerification', {
  id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email:     { type: DataTypes.STRING, allowNull: false },
  otp:       { type: DataTypes.STRING(6), allowNull: false },
  type:      { type: DataTypes.STRING, allowNull: false }, // 'signup' | 'login'
  attempts:  { type: DataTypes.INTEGER, defaultValue: 0 },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'otp_verifications', timestamps: false });

module.exports = OtpVerification;
