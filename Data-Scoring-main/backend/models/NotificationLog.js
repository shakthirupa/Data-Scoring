const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

const NotificationLog = sequelize.define('NotificationLog', {
  id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  analysisId:   { type: DataTypes.INTEGER, allowNull: false, references: { model: Analysis, key: 'id' }, onDelete: 'CASCADE' },
  recordIndex:  { type: DataTypes.INTEGER, allowNull: false }, // row index in rawData
  phone:        { type: DataTypes.STRING },
  email:        { type: DataTypes.STRING },
  name:         { type: DataTypes.STRING },
  isVerified:   { type: DataTypes.BOOLEAN, defaultValue: false },
  smsSent:      { type: DataTypes.BOOLEAN, defaultValue: false },
  smsError:     { type: DataTypes.STRING },
  failReasons:  { type: DataTypes.TEXT }, // JSON array of validation failure reasons
}, {
  tableName: 'notification_logs',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [{ unique: true, fields: ['analysisId', 'recordIndex'] }],
});

Analysis.hasMany(NotificationLog, { foreignKey: 'analysisId', onDelete: 'CASCADE' });
NotificationLog.belongsTo(Analysis, { foreignKey: 'analysisId' });

module.exports = NotificationLog;
