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
require('./models/DriveConnection');
require('./models/Student');

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
const googleDriveRoutes   = require('./routes/googleDriveRoutes');
const studentRoutes       = require('./routes/studentRoutes');
const sheetsRoutes        = require('./routes/sheetsRoutes');
const notificationRoutes  = require('./routes/notificationRoutes');
const updateRoutes        = require('./routes/updateRoutes');
const { syncAll }         = require('./controllers/sheetsController');
const { loadCustomRules } = require('./controllers/consistencyController');
const { seedMockData }    = require('./utils/digilockerSeed');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/drive',             googleDriveRoutes);
app.use('/api/students',          studentRoutes);
app.use('/api/sheets',            sheetsRoutes);
app.use('/api/notifications',     notificationRoutes);
app.use('/api/update',            updateRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'Server is running' }));

sequelize.sync({ alter: true })
  .then(async () => {
    console.log('PostgreSQL connected and tables synced');
    await loadCustomRules();
    await seedMockData();
    // Auto-sync Google Sheet responses into PostgreSQL every 30 seconds
    setInterval(syncAll, 30 * 1000);
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => console.error('Database connection error:', err));
