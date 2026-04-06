const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const DriveConnection = sequelize.define('DriveConnection', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:      { type: DataTypes.INTEGER, allowNull: true },
  folderId:    { type: DataTypes.STRING, allowNull: false },
  folderName:  { type: DataTypes.STRING, allowNull: false },
  folderUrl:   { type: DataTypes.STRING, allowNull: true },
  connectedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  textCache:   { type: DataTypes.JSONB, defaultValue: null },
  textCachedAt:{ type: DataTypes.DATE, defaultValue: null },
}, {
  timestamps: false,
});

module.exports = DriveConnection;
