const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

const Fingerprint = sequelize.define('Fingerprint', {
  id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  analysisId:       { type: DataTypes.INTEGER, unique: true, references: { model: Analysis, key: 'id' }, onDelete: 'CASCADE' },

  // Raw file hash — identical value means byte-for-byte same file
  fileHash:         { type: DataTypes.STRING(64), allowNull: false },

  // Composite hash — identical value means same data regardless of filename
  compositeHash:    { type: DataTypes.STRING(64), allowNull: false },

  rowCount:         { type: DataTypes.INTEGER, allowNull: false },
  columnCount:      { type: DataTypes.INTEGER, allowNull: false },

  // Sorted "col:type|col:type" string — fast schema comparison
  schemaSignature:  { type: DataTypes.TEXT, allowNull: false },

  // Full per-column stats object { colName: { type, nullCount, uniqueCount, mean, min, max, stddev } }
  columnStats:      { type: DataTypes.JSON, allowNull: false, defaultValue: {} },

  fileName:         { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'fingerprints',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    { fields: ['fileHash'] },
    { fields: ['compositeHash'] },
  ],
});

Analysis.hasOne(Fingerprint, { foreignKey: 'analysisId', onDelete: 'CASCADE' });
Fingerprint.belongsTo(Analysis, { foreignKey: 'analysisId' });

module.exports = Fingerprint;
