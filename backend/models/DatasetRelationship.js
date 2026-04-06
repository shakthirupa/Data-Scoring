const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

const DatasetRelationship = sequelize.define('DatasetRelationship', {
  id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId:       { type: DataTypes.INTEGER, allowNull: false },
  datasetAId:   { type: DataTypes.INTEGER, allowNull: false },
  datasetBId:   { type: DataTypes.INTEGER, allowNull: false },
  matches:      { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  confidence:   { type: DataTypes.STRING },
  suggestedJoin:{ type: DataTypes.STRING },
}, {
  tableName: 'dataset_relationships',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

DatasetRelationship.belongsTo(Analysis, { as: 'datasetA', foreignKey: 'datasetAId' });
DatasetRelationship.belongsTo(Analysis, { as: 'datasetB', foreignKey: 'datasetBId' });

module.exports = DatasetRelationship;
