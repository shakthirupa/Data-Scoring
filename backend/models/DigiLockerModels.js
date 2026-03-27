const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const Analysis = require('./Analysis');

// ── Organization ──────────────────────────────────────────────────────────────
const Organization = sequelize.define('Organization', {
  id:   { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true }, // url-safe key
}, { tableName: 'organizations', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

// ── DigiLocker Integration (per-org credentials) ──────────────────────────────
const DigiLockerIntegration = sequelize.define('DigiLockerIntegration', {
  id:             { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orgId:          { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: Organization, key: 'id' }, onDelete: 'CASCADE' },
  clientId:       { type: DataTypes.STRING },
  // AES-256-GCM encrypted: "iv:authTag:ciphertext" (all hex)
  clientSecretEnc:{ type: DataTypes.TEXT },
  apiUrl:         { type: DataTypes.STRING, defaultValue: 'https://api.digitallocker.gov.in' },
  redirectUri:    { type: DataTypes.STRING },
  // 'mock' | 'live'
  mode:           { type: DataTypes.ENUM('mock', 'live'), defaultValue: 'mock' },
  enabled:        { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'digilocker_integrations', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' });

Organization.hasOne(DigiLockerIntegration, { foreignKey: 'orgId', onDelete: 'CASCADE' });
DigiLockerIntegration.belongsTo(Organization, { foreignKey: 'orgId' });

// ── Mock DigiLocker data store ────────────────────────────────────────────────
const DigiLockerMock = sequelize.define('DigiLockerMock', {
  id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name:        { type: DataTypes.STRING, allowNull: false },
  aadhaar:     { type: DataTypes.STRING(12), unique: true },   // 12-digit, stored plain in mock
  pan:         { type: DataTypes.STRING(10), unique: true },   // ABCDE1234F format
  dob:         { type: DataTypes.STRING },
  gender:      { type: DataTypes.STRING },
  address:     { type: DataTypes.TEXT },
  // JSON array of certificate objects: [{type, number, issuer, issuedOn}]
  certificates:{ type: DataTypes.JSONB, defaultValue: [] },
}, { tableName: 'digilocker_mock', timestamps: false });

// ── Verification log ──────────────────────────────────────────────────────────
const VerificationLog = sequelize.define('VerificationLog', {
  id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orgId:            { type: DataTypes.INTEGER, allowNull: true, references: { model: Organization, key: 'id' }, onDelete: 'SET NULL' },
  analysisId:       { type: DataTypes.INTEGER, references: { model: Analysis, key: 'id' }, allowNull: true },
  docType:          { type: DataTypes.STRING },          // 'aadhaar' | 'pan' | 'certificate'
  maskedValue:      { type: DataTypes.STRING },          // XXXX XXXX 1234
  status:           { type: DataTypes.STRING },          // 'Verified' | 'Not Verified' | 'Error'
  source:           { type: DataTypes.STRING },          // 'Mock DigiLocker' | 'DigiLocker (Live)' | 'DigiLocker (Simulated)'
  confidenceScore:  { type: DataTypes.INTEGER },         // 0–100
  authenticityScore:{ type: DataTypes.INTEGER },         // 100 | 30
  mode:             { type: DataTypes.STRING },          // 'mock' | 'live'
  verifiedAt:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'verification_logs', timestamps: false });

module.exports = { Organization, DigiLockerIntegration, DigiLockerMock, VerificationLog };
