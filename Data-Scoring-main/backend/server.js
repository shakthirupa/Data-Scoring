require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./db');

// Import models so Sequelize registers them before sync
require('./models/User');
require('./models/Analysis');
require('./models/DataIssue');
require('./models/Recommendation');
require('./models/Settings');
require('./models/Fingerprint');
require('./models/ConsistencyModels');
require('./models/IntegrityModels');
require('./models/ForensicsReport');
require('./models/DigiLockerModels');
require('./models/OtpVerification');
require('./models/NotificationLog');

const analysisRoutes      = require('./routes/analysisRoutes');
const userRoutes          = require('./routes/userRoutes');
const settingsRoutes      = require('./routes/settingsRoutes');
const dashboardRoutes     = require('./routes/dashboardRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const exportRoutes        = require('./routes/exportRoutes');
const comparisonRoutes    = require('./routes/comparisonRoutes');
const fingerprintRoutes   = require('./routes/fingerprintRoutes');
const consistencyRoutes   = require('./routes/consistencyRoutes');
const integrityRoutes     = require('./routes/integrityRoutes');
const forensicsRoutes     = require('./routes/forensicsRoutes');
const digilockerRoutes    = require('./routes/digilockerRoutes');
const notificationRoutes  = require('./routes/notificationRoutes');
const sheetsRoutes        = require('./routes/sheetsRoutes');
const { loadCustomRules } = require('./controllers/consistencyController');
const { seedMockData }    = require('./utils/digilockerSeed');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/analysis',       analysisRoutes);
app.use('/api/user',           userRoutes);
app.use('/api/settings',       settingsRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/export',         exportRoutes);
app.use('/api/comparison',     comparisonRoutes);
app.use('/api/fingerprint',    fingerprintRoutes);
app.use('/api/consistency',       consistencyRoutes);
app.use('/api/predict-integrity', integrityRoutes);
app.use('/api/forensics',         forensicsRoutes);
app.use('/api',                   digilockerRoutes);
app.use('/api/notifications',     notificationRoutes);
app.use('/api/sheets',            sheetsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'Server is running' }));

async function startServer() {
  try {
    // Disable FK checks so ALTER/DROP won't fail on SQLite foreign key constraints
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    await sequelize.sync({ alter: { drop: false } });
    await sequelize.query('PRAGMA foreign_keys = ON;');

    console.log('SQLite connected and tables synced');
    await loadCustomRules();
    await seedMockData();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Startup error:', err.message);
    process.exit(1);
  }
}

startServer();
