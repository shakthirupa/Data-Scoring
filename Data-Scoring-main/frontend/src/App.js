import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './ThemeContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Dashboard from './pages/Dashboard';
import AnalysisHistory from './pages/AnalysisHistory';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import QualityScore from './pages/QualityScore';
import Issues from './pages/Issues';
import Reports from './pages/Reports';
import Comparison from './pages/Comparison';
import Notifications from './pages/Notifications';
import Help from './pages/Help';
import ForensicsPage from './pages/Forensics';
import PredictivePage from './pages/Predictive';
import FingerprintPage from './pages/FingerprintPage';
import ConsistencyPage from './pages/ConsistencyPage';
import DigiLockerPage from './pages/DigiLockerPage';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OtpVerify from './pages/OtpVerify';

function ProtectedLayout() {
  const token = localStorage.getItem('auth_token');
  const { dark } = useTheme();
  if (!token) return <Navigate to="/login" replace />;

  const bg = dark
    ? 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 40%, #0a1628 70%, #0f1a1a 100%)'
    : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0f9ff 70%, #fefce8 100%)';

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: bg }}>
      <Navbar />
      <Sidebar />
      <main className="ml-56 mt-20 p-8">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/history"      element={<AnalysisHistory />} />
            <Route path="/profile"      element={<Profile />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="/quality-score" element={<QualityScore />} />
            <Route path="/issues"       element={<Issues />} />
            <Route path="/reports"      element={<Reports />} />
            <Route path="/comparison"   element={<Comparison />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/help"         element={<Help />} />
            <Route path="/forensics"     element={<ForensicsPage />} />
            <Route path="/predictive"    element={<PredictivePage />} />
            <Route path="/fingerprint"   element={<FingerprintPage />} />
            <Route path="/consistency"   element={<ConsistencyPage />} />
            <Route path="/digilocker"    element={<DigiLockerPage />} />
            <Route path="*"             element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/"       element={<LandingPage />} />
          <Route path="/login"      element={<Login />} />
          <Route path="/signup"     element={<Signup />} />
          <Route path="/verify-otp" element={<OtpVerify />} />
          <Route path="/*"      element={<ProtectedLayout />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
