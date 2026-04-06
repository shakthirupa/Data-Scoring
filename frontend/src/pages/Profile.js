import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Building, Briefcase, Lock, CheckCircle, BarChart2, TrendingUp, Calendar } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

function useCard() {
  const { dark } = useTheme();
  return dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
}

function Field({ icon: Icon, label, value, onChange, type = 'text', readOnly = false, dark }) {
  const inputStyle = {
    background: readOnly ? (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)') : (dark ? '#1f2937' : '#f3f4f6'),
    border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
    color: dark ? '#d1d5db' : '#374151',
    borderRadius: '10px', padding: '9px 12px 9px 36px',
    fontSize: 13, outline: 'none', width: '100%',
  };
  return (
    <div className="relative">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>{label}</label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: dark ? '#4b5563' : '#d1d5db' }} />
        <input type={type} value={value} onChange={onChange} readOnly={readOnly} style={inputStyle} />
      </div>
    </div>
  );
}

export default function Profile() {
  const { dark } = useTheme();
  const card = useCard();
  const [form, setForm] = useState({ name: '', email: '', organization: '', role: '' });
  const [stats, setStats] = useState({ totalAnalyses: 0, avgQualityScore: 0, daysActive: 0 });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [profileStatus, setProfileStatus] = useState(null);
  const [pwdStatus, setPwdStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const headingColor = dark ? '#f9fafb' : '#111827';
  const labelColor = dark ? '#9ca3af' : '#6b7280';

  useEffect(() => {
    api.getProfile().then(data => {
      setForm({ name: data.name || '', email: data.email || '', organization: data.organization || '', role: data.role || '' });
      setStats({ totalAnalyses: data.totalAnalyses || 0, avgQualityScore: data.avgQualityScore || 0, daysActive: data.daysActive || 0 });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setProfileStatus('saving');
    const res = await api.updateProfile(form);
    setProfileStatus(res.success ? 'saved' : 'error');
    setTimeout(() => setProfileStatus(null), 2500);
  };

  const savePassword = async () => {
    if (pwd.next !== pwd.confirm) { setPwdStatus('mismatch'); return; }
    if (pwd.next.length < 6) { setPwdStatus('short'); return; }
    setPwdStatus('saving');
    const res = await api.changePassword({ currentPassword: pwd.current, newPassword: pwd.next });
    if (res.error) { setPwdStatus('error:' + res.error); return; }
    setPwdStatus('saved');
    setPwd({ current: '', next: '', confirm: '' });
    setTimeout(() => setPwdStatus(null), 2500);
  };

  const initials = form.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Profile</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>Manage your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Avatar + stats */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl flex flex-col items-center gap-4" style={card}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg,#6366f1,#10b981)' }}>
              {initials}
            </div>
            <div className="text-center">
              <p className="font-bold" style={{ color: headingColor }}>{form.name || 'Your Name'}</p>
              <p className="text-xs mt-0.5" style={{ color: labelColor }}>{form.email}</p>
              {form.role && <p className="text-xs mt-1 px-2 py-0.5 rounded-full inline-block"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{form.role}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="p-5 rounded-2xl space-y-3" style={card}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: labelColor }}>Your Activity</p>
            {[
              { icon: BarChart2, label: 'Total Analyses', value: stats.totalAnalyses, color: '#10b981' },
              { icon: TrendingUp, label: 'Avg Quality Score', value: `${stats.avgQualityScore}%`, color: '#6366f1' },
              { icon: Calendar, label: 'Days Active', value: stats.daysActive, color: '#f59e0b' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15` }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs" style={{ color: labelColor }}>{label}</p>
                  <p className="text-sm font-bold" style={{ color }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Forms */}
        <div className="lg:col-span-2 space-y-4">

          {/* Account info */}
          <div className="p-6 rounded-2xl space-y-4" style={card}>
            <p className="text-sm font-bold" style={{ color: headingColor }}>Account Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={User}      label="Full Name"     value={form.name}         onChange={e => setForm(f => ({ ...f, name: e.target.value }))}         dark={dark} />
              <Field icon={Mail}      label="Email"         value={form.email}        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}        dark={dark} />
              <Field icon={Building}  label="Organization"  value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} dark={dark} />
              <Field icon={Briefcase} label="Role"          value={form.role}         onChange={e => setForm(f => ({ ...f, role: e.target.value }))}         dark={dark} />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={saveProfile}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: profileStatus === 'saved' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              {profileStatus === 'saving' ? 'Saving…' : profileStatus === 'saved' ? <><CheckCircle size={14} />Saved!</> : profileStatus === 'error' ? 'Error — try again' : 'Save Changes'}
            </motion.button>
          </div>

          {/* Change password */}
          <div className="p-6 rounded-2xl space-y-4" style={card}>
            <p className="text-sm font-bold" style={{ color: headingColor }}>Change Password</p>
            {[
              ['Current Password', 'current'],
              ['New Password', 'next'],
              ['Confirm New Password', 'confirm'],
            ].map(([label, key]) => (
              <div key={key} className="relative">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>{label}</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: dark ? '#4b5563' : '#d1d5db' }} />
                  <input type="password" value={pwd[key]} onChange={e => setPwd(p => ({ ...p, [key]: e.target.value }))}
                    style={{ background: dark ? '#1f2937' : '#f3f4f6', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, color: dark ? '#d1d5db' : '#374151', borderRadius: '10px', padding: '9px 12px 9px 36px', fontSize: 13, outline: 'none', width: '100%' }} />
                </div>
              </div>
            ))}
            {pwdStatus && pwdStatus !== 'saving' && pwdStatus !== 'saved' && (
              <p className="text-xs text-red-500">
                {pwdStatus === 'mismatch' ? 'Passwords do not match' : pwdStatus === 'short' ? 'Password must be at least 6 characters' : pwdStatus.replace('error:', '')}
              </p>
            )}
            <motion.button whileTap={{ scale: 0.97 }} onClick={savePassword}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: pwdStatus === 'saved' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              {pwdStatus === 'saving' ? 'Updating…' : pwdStatus === 'saved' ? <><CheckCircle size={14} />Password Updated!</> : 'Update Password'}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
