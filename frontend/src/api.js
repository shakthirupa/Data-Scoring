const BASE_URL = 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('auth_token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

const api = {
  // Auth
  signup: async (data) => {
    const res = await fetch(`${BASE_URL}/user/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
  },
  login: async (data) => {
    const res = await fetch(`${BASE_URL}/user/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
  },

  // Analysis
  uploadFile: async (file, sheetName, tempId, fileName) => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (sheetName) formData.append('sheetName', sheetName);
    if (tempId) formData.append('tempId', tempId);
    if (fileName) formData.append('fileName', fileName);
    const res = await fetch(`${BASE_URL}/analysis/upload`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
    return res.json();
  },
  getSheets: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/analysis/sheets`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
    return res.json();
  },
  uploadFromUrl: async (url) => {
    const res = await fetch(`${BASE_URL}/analysis/upload-url`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url }) });
    return res.json();
  },
  getHistory: async () => {
    const res = await fetch(`${BASE_URL}/analysis/history`, { headers: authHeaders() });
    return res.json();
  },
  getAnalysisById: async (id) => {
    const res = await fetch(`${BASE_URL}/analysis/${id}`, { headers: authHeaders() });
    return res.json();
  },
  getInsights: async (scores) => {
    const res = await fetch(`${BASE_URL}/analysis/insights`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ scores }) });
    return res.json();
  },
  deleteAllAnalyses: async () => {
    const res = await fetch(`${BASE_URL}/analysis/all`, { method: 'DELETE', headers: authHeaders() });
    return res.json();
  },
  deleteAnalysis: async (id) => {
    const res = await fetch(`${BASE_URL}/analysis/${id}`, { method: 'DELETE', headers: authHeaders() });
    return res.json();
  },
  saveVerificationStatus: async (id, verificationStatus) => {
    const res = await fetch(`${BASE_URL}/analysis/${id}/verification`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ verificationStatus }) });
    return res.json();
  },

  // Dashboard
  getDashboardStats: async () => {
    const res = await fetch(`${BASE_URL}/dashboard/stats`, { headers: authHeaders() });
    return res.json();
  },
  getTrends: async () => {
    const res = await fetch(`${BASE_URL}/dashboard/trends`, { headers: authHeaders() });
    return res.json();
  },
  getIssuesSummary: async () => {
    const res = await fetch(`${BASE_URL}/dashboard/issues`, { headers: authHeaders() });
    return res.json();
  },
  getNotifications: async () => {
    const res = await fetch(`${BASE_URL}/dashboard/notifications`, { headers: authHeaders() });
    return res.json();
  },
  resolveIssue: async (id) => {
    const res = await fetch(`${BASE_URL}/dashboard/issues/${id}/resolve`, { method: 'PATCH', headers: authHeaders() });
    return res.json();
  },

  // User
  getProfile: async () => {
    const res = await fetch(`${BASE_URL}/user/profile`, { headers: authHeaders() });
    return res.json();
  },
  updateProfile: async (data) => {
    const res = await fetch(`${BASE_URL}/user/profile`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },
  changePassword: async (data) => {
    const res = await fetch(`${BASE_URL}/user/change-password`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },

  // Settings
  getSettings: async () => {
    const res = await fetch(`${BASE_URL}/settings`, { headers: authHeaders() });
    return res.json();
  },
  updateSettings: async (data) => {
    const res = await fetch(`${BASE_URL}/settings`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },
  regenerateApiKey: async () => {
    const res = await fetch(`${BASE_URL}/settings/regenerate-key`, { method: 'POST', headers: authHeaders() });
    return res.json();
  },

  // Recommendations
  generateRecommendations: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/recommendations/${analysisId}/generate`, { method: 'POST', headers: authHeaders() });
    return res.json();
  },

  // Export
  exportHistory: async () => {
    const res = await fetch(`${BASE_URL}/export/history`, { headers: authHeaders() });
    return res.json();
  },
  exportReport: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/export/report/${analysisId}`, { headers: authHeaders() });
    return res.json();
  },

  // Consistency Engine
  getConsistencyRules: async () => {
    const res = await fetch(`${BASE_URL}/consistency/rules`, { headers: authHeaders() });
    return res.json();
  },
  addConsistencyRule: async (rule) => {
    const res = await fetch(`${BASE_URL}/consistency/rules`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(rule) });
    return res.json();
  },
  removeConsistencyRule: async (ruleId) => {
    const res = await fetch(`${BASE_URL}/consistency/rules/${ruleId}`, { method: 'DELETE', headers: authHeaders() });
    return res.json();
  },
  toggleConsistencyRule: async (ruleId) => {
    const res = await fetch(`${BASE_URL}/consistency/rules/${ruleId}/toggle`, { method: 'PUT', headers: authHeaders() });
    return res.json();
  },
  validateConsistency: async (analysisId, ruleIds) => {
    const res = await fetch(`${BASE_URL}/consistency/validate/${analysisId}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ruleIds }) });
    return res.json();
  },
  getConsistencyResult: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/consistency/result/${analysisId}`, { headers: authHeaders() });
    return res.json();
  },
  validateInline: async (rows, ruleIds) => {
    const res = await fetch(`${BASE_URL}/consistency/validate-inline`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ rows, ruleIds }) });
    return res.json();
  },

  // Fingerprint
  getFingerprint: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/fingerprint/${analysisId}`, { headers: authHeaders() });
    return res.json();
  },
  getAllFingerprints: async () => {
    const res = await fetch(`${BASE_URL}/fingerprint/all`, { headers: authHeaders() });
    return res.json();
  },
  compareFingerprints: async (analysisIdA, analysisIdB) => {
    const res = await fetch(`${BASE_URL}/fingerprint/compare`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ analysisIdA, analysisIdB }) });
    return res.json();
  },
  getDuplicates: async () => {
    const res = await fetch(`${BASE_URL}/fingerprint/duplicates`, { headers: authHeaders() });
    return res.json();
  },
  getSimilar: async (analysisId, threshold = 80) => {
    const res = await fetch(`${BASE_URL}/fingerprint/similar/${analysisId}?threshold=${threshold}`, { headers: authHeaders() });
    return res.json();
  },

  // DigiLocker
  saveIntegration: async (data) => {
    const res = await fetch(`${BASE_URL}/integration/save`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },
  getIntegration: async (orgId) => {
    const res = await fetch(`${BASE_URL}/integration/${orgId}`, { headers: authHeaders() });
    return res.json();
  },
  listOrgs: async () => {
    const res = await fetch(`${BASE_URL}/integration/orgs`, { headers: authHeaders() });
    return res.json();
  },
  verifyMock: async (data) => {
    const res = await fetch(`${BASE_URL}/verify/mock`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },
  verifyLive: async (data) => {
    const res = await fetch(`${BASE_URL}/verify/live`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },
  verifyDataset: async (analysisId, orgId = 1) => {
    const res = await fetch(`${BASE_URL}/verify/dataset/${analysisId}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ orgId }) });
    return res.json();
  },
  getIntegrationStatus: async (orgId = 1) => {
    const res = await fetch(`${BASE_URL}/integration/status/${orgId}`, { headers: authHeaders() });
    return res.json();
  },
  verifyDocument: async (value, orgId) => {
    const res = await fetch(`${BASE_URL}/verify`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ value, orgId }) });
    return res.json();
  },
  getVerificationHistory: async (orgId) => {
    const res = await fetch(`${BASE_URL}/verify/history/${orgId}`, { headers: authHeaders() });
    return res.json();
  },

  // Data Forensics
  getForensicsReport: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/forensics/${analysisId}`, { headers: authHeaders() });
    return res.json();
  },
  recomputeForensics: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/forensics/${analysisId}/recompute`, { method: 'POST', headers: authHeaders() });
    return res.json();
  },
  getForensicsTimeline: async (analysisId, limit = 200) => {
    const res = await fetch(`${BASE_URL}/forensics/${analysisId}/timeline?limit=${limit}`, { headers: authHeaders() });
    return res.json();
  },
  getColumnForensics: async (analysisId, column) => {
    const res = await fetch(`${BASE_URL}/forensics/${analysisId}/column/${encodeURIComponent(column)}`, { headers: authHeaders() });
    return res.json();
  },
  inlineForensics: async (rows, fileName) => {
    const res = await fetch(`${BASE_URL}/forensics/inline`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ rows, fileName }) });
    return res.json();
  },

  // Predictive Integrity Index
  predictIntegrityAll: async (steps = 6) => {
    const res = await fetch(`${BASE_URL}/predict-integrity?steps=${steps}`, { headers: authHeaders() });
    return res.json();
  },
  predictIntegrityGroup: async (fileGroup, steps = 6) => {
    const res = await fetch(`${BASE_URL}/predict-integrity/${encodeURIComponent(fileGroup)}?steps=${steps}`, { headers: authHeaders() });
    return res.json();
  },
  predictIntegrityByAnalysis: async (analysisId, steps = 6) => {
    const res = await fetch(`${BASE_URL}/predict-integrity/by-analysis/${analysisId}?steps=${steps}`, { headers: authHeaders() });
    return res.json();
  },
  getIntegrityGroups: async () => {
    const res = await fetch(`${BASE_URL}/predict-integrity/groups`, { headers: authHeaders() });
    return res.json();
  },
  getIntegrityAlerts: async () => {
    const res = await fetch(`${BASE_URL}/predict-integrity/alerts`, { headers: authHeaders() });
    return res.json();
  },
  getIntegritySnapshots: async (fileGroup) => {
    const res = await fetch(`${BASE_URL}/predict-integrity/snapshots/${encodeURIComponent(fileGroup)}`, { headers: authHeaders() });
    return res.json();
  },

  // Google Drive
  getDriveServiceEmail: async () => {
    const res = await fetch(`${BASE_URL}/drive/service-email`, { headers: authHeaders() });
    return res.json();
  },
  browseDrive: async (folderId = 'root') => {
    const res = await fetch(`${BASE_URL}/drive/browse`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ folderId }) });
    return res.json();
  },
  importDriveFile: async (driveUrl) => {
    const res = await fetch(`${BASE_URL}/drive/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ driveUrl }) });
    return res.json();
  },
  importDriveFileById: async (fileId) => {
    const res = await fetch(`${BASE_URL}/drive/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ fileId }) });
    return res.json();
  },
  importDriveFolder: async (folderId) => {
    const res = await fetch(`${BASE_URL}/drive/import-folder`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ folderId }) });
    return res.json();
  },
  getDriveFolderJob: async (jobId) => {
    const res = await fetch(`${BASE_URL}/drive/job/${jobId}`, { headers: authHeaders() });
    return res.json();
  },
  saveDriveConnection: async (folderId, folderName, folderUrl) => {
    const res = await fetch(`${BASE_URL}/drive/connect`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ folderId, folderName, folderUrl }) });
    return res.json();
  },
  getDriveConnections: async () => {
    const res = await fetch(`${BASE_URL}/drive/connections`, { headers: authHeaders() });
    return res.json();
  },

  // Students
  getStudents: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/students?${q}`, { headers: authHeaders() });
    return res.json();
  },
  getStudentStats: async () => {
    const res = await fetch(`${BASE_URL}/students/stats`, { headers: authHeaders() });
    return res.json();
  },
  createStudent: async (data) => {
    const res = await fetch(`${BASE_URL}/students`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },
  updateStudent: async (id, data) => {
    const res = await fetch(`${BASE_URL}/students/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) });
    return res.json();
  },
  deleteStudent: async (id) => {
    const res = await fetch(`${BASE_URL}/students/${id}`, { method: 'DELETE', headers: authHeaders() });
    return res.json();
  },
  extractStudents: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/students/extract/${analysisId}`, { method: 'POST', headers: authHeaders() });
    return res.json();
  },
  extractStudentsBulk: async (analysisIds) => {
    const res = await fetch(`${BASE_URL}/students/extract-bulk`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ analysisIds }) });
    return res.json();
  },
  verifyStudentsAgainstDrive: async (folderId) => {
    const res = await fetch(`${BASE_URL}/students/verify-against-drive`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ folderId }) });
    return res.json();
  },
  verifyRow: async (row, folderId, signal) => {
    const res = await fetch(`${BASE_URL}/students/verify-row`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ row, folderId }), signal });
    return res.json();
  },
  getFolderStructure: async (folderId) => {
    const res = await fetch(`${BASE_URL}/students/folder-structure?folderId=${encodeURIComponent(folderId)}`, { headers: authHeaders() });
    return res.json();
  },
  sendSms: async (phone, message) => {
    const res = await fetch(`${BASE_URL}/students/send-sms`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ phone, message }) });
    return res.json();
  },

  // Notifications
  sendNotifications: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/notifications/send`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ analysisId }) });
    return res.json();
  },
  getNotificationLogs: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/notifications/${analysisId}`, { headers: authHeaders() });
    return res.json();
  },
  sendManualSms: async (phones) => {
    const res = await fetch(`${BASE_URL}/notifications/send-manual`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ phones }) });
    return res.json();
  },
  sendEmailAlerts: async (emails, analysisId, rowIndices) => {
    const res = await fetch(`${BASE_URL}/notifications/send-email-alerts`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ emails, analysisId, rowIndices }) });
    return res.json();
  },
  sendWhatsAppAlerts: async (phones) => {
    const res = await fetch(`${BASE_URL}/notifications/send-whatsapp`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ phones }) });
    return res.json();
  },

  // Sheets Sync
  syncFromSheet: async (analysisId) => {
    const res = await fetch(`${BASE_URL}/sheets/sync/${analysisId}`, { method: 'POST', headers: authHeaders() });
    return res.json();
  },

  // Comparison
  findRelationships: async () => {
    const res = await fetch(`${BASE_URL}/comparison/relationships/scan`, { method: 'POST', headers: authHeaders() });
    return res.json();
  },
  getSavedRelationships: async () => {
    const res = await fetch(`${BASE_URL}/comparison/relationships`, { headers: authHeaders() });
    return res.json();
  },
  deleteRelationship: async (id) => {
    const res = await fetch(`${BASE_URL}/comparison/relationships/${id}`, { method: 'DELETE', headers: authHeaders() });
    return res.json();
  },
  compareAnalyses: async (analysisIds) => {
    const res = await fetch(`${BASE_URL}/comparison/compare`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ analysisIds }) });
    return res.json();
  },
  searchAnalyses: async (params) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/comparison/search?${query}`, { headers: authHeaders() });
    return res.json();
  },
};

export default api;
