const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const OtpVerification = sequelize.define('OtpVerification', {
  id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email:     { type: DataTypes.STRING, allowNull: false },
  otp:       { type: DataTypes.STRING, allowNull: false },
  name:      { type: DataTypes.STRING },
  password:  { type: DataTypes.STRING },
  organisation: { type: DataTypes.STRING },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'otp_verifications', timestamps: false });

module.exports = OtpVerification;
