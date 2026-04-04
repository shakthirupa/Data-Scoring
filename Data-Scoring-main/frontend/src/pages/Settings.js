import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Sliders, Moon, Sun, CheckCircle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

function useCard() {
  const { dark } = useTheme();
  return dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
}

function Toggle({ checked, onChange }) {
  const { dark } = useTheme();
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="relative w-11 h-6 rounded-full flex-shrink-0 focus:outline-none"
      style={{
        background: checked ? '#10b981' : (dark ? '#374151' : '#d1d5db'),
        transition: 'background 0.2s ease',
      }}>
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
        style={{
          transform: checked ? 'translateX(20px)' : 'translateX(0px)',
          transition: 'transform 0.2s ease',
        }}
      />
    </button>
  );
}

export default function Settings() {
  const { dark, toggle } = useTheme();
  const card = useCard();
  const [notifications, setNotifications] = useState({ email: true, analysisCompletion: true, weeklySummary: false, criticalAlerts: true });
  const [thresholds, setThresholds] = useState({ minAcceptableScore: 60, alertThreshold: 70 });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const headingColor = dark ? '#f9fafb' : '#111827';
  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const inputStyle = { background: dark ? '#1f2937' : '#f3f4f6', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, color: dark ? '#d1d5db' : '#374151', borderRadius: '10px', padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' };

  useEffect(() => {
    api.getSettings().then(data => {
      if (data.notifications) setNotifications(n => ({ ...n, ...data.notifications }));
      if (data.thresholds) setThresholds(t => ({ ...t, ...data.thresholds }));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await api.updateSettings({ notifications, thresholds });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Settings</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>Configure your preferences</p>
      </div>

      {/* Appearance */}
      <div className="p-6 rounded-2xl" style={card}>
        <div className="flex items-center gap-2 mb-5">
          {dark ? <Moon size={15} style={{ color: '#6366f1' }} /> : <Sun size={15} style={{ color: '#f59e0b' }} />}
          <p className="text-sm font-bold" style={{ color: headingColor }}>Appearance</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: headingColor }}>Dark Mode</p>
            <p className="text-xs mt-0.5" style={{ color: labelColor }}>Switch between light and dark theme</p>
          </div>
          <Toggle checked={dark} onChange={() => toggle()} dark={dark} />
        </div>
      </div>

      {/* Notifications */}
      <div className="p-6 rounded-2xl" style={card}>
        <div className="flex items-center gap-2 mb-5">
          <Bell size={15} style={{ color: '#10b981' }} />
          <p className="text-sm font-bold" style={{ color: headingColor }}>Notification Preferences</p>
        </div>
        <div className="space-y-4">
          {[
            ['Email notifications',        'email',              'Receive analysis results via email'],
            ['Analysis completion alerts',  'analysisCompletion', 'Notify when an analysis finishes'],
            ['Critical issue alerts',       'criticalAlerts',     'Alert immediately on Critical severity issues'],
            ['Weekly summary reports',      'weeklySummary',      'Get a weekly digest of your data quality'],
          ].map(([label, key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: headingColor }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: labelColor }}>{desc}</p>
              </div>
              <Toggle checked={!!notifications[key]} onChange={v => setNotifications(n => ({ ...n, [key]: v }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Score thresholds */}
      <div className="p-6 rounded-2xl" style={card}>
        <div className="flex items-center gap-2 mb-5">
          <Sliders size={15} style={{ color: '#f59e0b' }} />
          <p className="text-sm font-bold" style={{ color: headingColor }}>Quality Score Thresholds</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ['Minimum Acceptable Score', 'minAcceptableScore', 'Scores below this are flagged as Poor'],
            ['Alert Threshold',          'alertThreshold',     'Trigger alerts when score drops below this'],
          ].map(([label, key, desc]) => (
            <div key={key}>
              <label className="block text-xs font-semibold mb-1" style={{ color: labelColor }}>{label}</label>
              <p className="text-xs mb-2" style={{ color: dark ? '#4b5563' : '#d1d5db' }}>{desc}</p>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} value={thresholds[key]}
                  onChange={e => setThresholds(t => ({ ...t, [key]: Number(e.target.value) }))}
                  className="flex-1 accent-indigo-500" />
                <input type="number" min={0} max={100} value={thresholds[key]}
                  onChange={e => setThresholds(t => ({ ...t, [key]: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 64, textAlign: 'center' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: saved ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
          {saved ? <><CheckCircle size={14} />Saved!</> : 'Save Settings'}
        </motion.button>
      </div>
    </motion.div>
  );
}
