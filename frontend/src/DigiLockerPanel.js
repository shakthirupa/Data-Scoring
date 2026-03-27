import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Settings, Eye, EyeOff, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown } from 'lucide-react';
import { useTheme } from './ThemeContext';
import api from './api';

// ── Small pieces ──────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange, dark }) {
  const base = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer select-none';
  const active = { background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' };
  const inactive = { background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: dark ? '#6b7280' : '#9ca3af', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` };

  return (
    <div className="flex gap-2">
      {[['mock', ShieldCheck, 'Mock DigiLocker'], ['live', ShieldAlert, 'Live DigiLocker']].map(([m, Icon, label]) => (
        <button key={m} onClick={() => onChange(m)} className={base} style={mode === m ? active : inactive}>
          <Icon size={15} />{label}
          {mode === m && <span className="w-1.5 h-1.5 rounded-full bg-white/70 ml-1" />}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = status === 'Verified'
    ? { color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle }
    : { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={14} />{status}
    </span>
  );
}

function ScoreRing({ score, label, color, dark }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
        <text x={36} y={40} textAnchor="middle" fontSize={14} fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.7)' : '#6b7280' }}>{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}

export default function DigiLockerPanel({ orgId = 1 }) {
  const { dark } = useTheme();
  const [tab, setTab] = useState('verify');
  const [mode, setMode] = useState('mock');
  const [form, setForm] = useState({ clientId: '', clientSecret: '', apiUrl: 'https://api.digitallocker.gov.in', redirectUri: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSecret, setShowSecret] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [liveConfigured, setLiveConfigured] = useState(false); // true once saved with valid creds
  const [verifyValue, setVerifyValue] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const card = dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
  const inputStyle = { background: dark ? '#1f2937' : '#f3f4f6', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, color: dark ? '#d1d5db' : '#374151', borderRadius: '10px', padding: '10px 14px', fontSize: 13, outline: 'none', width: '100%' };
  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';

  // Load existing integration
  useEffect(() => {
    api.getIntegration(orgId).then(data => {
      if (data.integration) {
        setMode(data.integration.mode || 'mock');
        setForm(f => ({ ...f, clientId: data.integration.clientId || '', apiUrl: data.integration.apiUrl || f.apiUrl, redirectUri: data.integration.redirectUri || '' }));
        setLiveConfigured(data.integration.mode === 'live' && !!data.integration.clientId && data.integration.hasSecret);
      }
    }).catch(() => {});
  }, [orgId]);

  const validate = () => {
    if (mode !== 'live') return true;
    const errs = {};
    if (!form.clientId.trim()) errs.clientId = 'Required';
    if (!form.apiUrl.trim()) errs.apiUrl = 'Required';
    else if (!isValidUrl(form.apiUrl.trim())) errs.apiUrl = 'Must be a valid URL (e.g. https://api.digitallocker.gov.in)';
    if (!form.clientSecret.trim() && !liveConfigured) errs.clientSecret = 'Required for first-time setup';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaveStatus('saving');
    try {
      await api.saveIntegration({ orgId, clientId: form.clientId.trim(), clientSecret: form.clientSecret || undefined, apiUrl: form.apiUrl.trim(), redirectUri: form.redirectUri.trim(), mode });
      setSaveStatus('saved');
      setLiveConfigured(mode === 'live');
      setFieldErrors({});
      setTimeout(() => setSaveStatus(null), 2500);
    } catch { setSaveStatus('error'); }
  };

  const handleVerify = async () => {
    if (!verifyValue.trim()) return;
    setVerifying(true); setVerifyResult(null);
    try {
      const v = verifyValue.trim().replace(/\s/g, '');
      const isAadhaar = /^\d{12}$/.test(v);
      const isPan     = /^[A-Z]{5}\d{4}[A-Z]$/i.test(v);
      if (!isAadhaar && !isPan) {
        setVerifyResult({ status: 'Error', source: 'Invalid format', errorMsg: 'Enter a 12-digit Aadhaar or 10-character PAN (e.g. ABCDE1234F)' });
        setVerifying(false);
        return;
      }
      const payload = { orgId, ...(isAadhaar ? { aadhaar: v } : { pan: v.toUpperCase() }) };
      const result = mode === 'mock' ? await api.verifyMock(payload) : await api.verifyLive(payload);
      // If live URL was unreachable, backend silently returns Simulated — surface it
      if (result.source === 'DigiLocker (Simulated)') {
        setVerifyResult({ ...result, status: 'Error', errorMsg: 'Live API unreachable — check your API URL in Integration Settings' });
      } else {
        setVerifyResult(result);
      }
    } catch (e) { setVerifyResult({ status: 'Error', source: 'System', errorMsg: e.message }); }
    setVerifying(false);
  };

  const loadHistory = async () => {
    const data = await api.getVerificationHistory(orgId);
    setHistory(Array.isArray(data) ? data : []);
    setHistoryOpen(true);
  };

  const TABS = [
    { id: 'verify', label: 'Verify' },
    { id: 'settings', label: 'Integration Settings' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(99,102,241,0.2))', border: '1px solid rgba(16,185,129,0.3)' }}>
          <ShieldCheck size={18} style={{ color: '#10b981' }} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: headingColor }}>DigiLocker Verification</h3>
          <p className="text-xs" style={{ color: labelColor }}>Verify Aadhaar & PAN documents</p>
        </div>
        <div className="ml-auto">
          <ModeToggle mode={mode} onChange={setMode} dark={dark} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.id ? { background: dark ? '#1f2937' : '#fff', color: '#6366f1', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } : { color: labelColor }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Verify tab ── */}
        {tab === 'verify' && (
          <motion.div key="verify" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Live mode warning if not configured */}
            <AnimatePresence>
              {mode === 'live' && !liveConfigured && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <ShieldAlert size={15} style={{ color: '#f59e0b' }} className="flex-shrink-0" />
                  <p className="text-xs flex-1" style={{ color: '#f59e0b' }}>
                    <span className="font-semibold">Live DigiLocker not configured.</span> Go to Integration Settings and enter your Client ID, API URL, and Client Secret.
                  </p>
                  <button onClick={() => setTab('settings')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Configure Now
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-5 rounded-2xl space-y-4" style={card}>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: labelColor }}>
                  Aadhaar (12 digits) or PAN (ABCDE1234F)
                </label>
                <div className="flex gap-2">
                  <input value={verifyValue} onChange={e => setVerifyValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    placeholder="Enter Aadhaar or PAN number…"
                    style={inputStyle} />
                  <motion.button whileTap={{ scale: 0.96 }} onClick={handleVerify} disabled={verifying || !verifyValue.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
                    {verifying ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    {verifying ? 'Verifying…' : 'Verify via DigiLocker'}
                  </motion.button>
                </div>
                <p className="text-xs mt-1.5" style={{ color: labelColor }}>
                  Mode: <span className="font-semibold" style={{ color: mode === 'mock' ? '#10b981' : '#6366f1' }}>{mode === 'mock' ? 'Mock DigiLocker' : 'Live DigiLocker'}</span>
                  {mode === 'mock' && <span className="ml-2 opacity-60">· Try: 123456789012 or ABCDE1234F</span>}
                </p>
              </div>

              {/* Result */}
              <AnimatePresence>
                {verifyResult && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-4 rounded-xl space-y-3"
                    style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${verifyResult.status === 'Verified' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <StatusBadge status={verifyResult.status} />
                      <span className="text-xs" style={{ color: labelColor }}>{verifyResult.source}</span>
                    </div>

                    {verifyResult.status === 'Verified' && (
                      <>
                        {/* Score rings */}
                        <div className="flex gap-4 justify-center py-2">
                          <ScoreRing score={verifyResult.confidenceScore || 85} label="Confidence" color="#10b981" dark={dark} />
                          <ScoreRing score={verifyResult.authenticityScore || 100} label="Authenticity" color="#6366f1" dark={dark} />
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {verifyResult.name && (
                            <div className="p-2.5 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                              <p style={{ color: labelColor }}>Name</p>
                              <p className="font-semibold mt-0.5" style={{ color: headingColor }}>{verifyResult.name}</p>
                            </div>
                          )}
                          {verifyResult.maskedValue && (
                            <div className="p-2.5 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                              <p style={{ color: labelColor }}>Document</p>
                              <p className="font-semibold font-mono mt-0.5" style={{ color: headingColor }}>{verifyResult.maskedValue}</p>
                            </div>
                          )}
                          {verifyResult.dob && (
                            <div className="p-2.5 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                              <p style={{ color: labelColor }}>Date of Birth</p>
                              <p className="font-semibold mt-0.5" style={{ color: headingColor }}>{verifyResult.dob}</p>
                            </div>
                          )}
                          {verifyResult.gender && (
                            <div className="p-2.5 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                              <p style={{ color: labelColor }}>Gender</p>
                              <p className="font-semibold mt-0.5" style={{ color: headingColor }}>{verifyResult.gender}</p>
                            </div>
                          )}
                        </div>

                        {/* Certificates */}
                        {verifyResult.certificates?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: labelColor }}>Linked Documents</p>
                            <div className="space-y-1.5">
                              {verifyResult.certificates.map((cert, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-xs"
                                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                  <ShieldCheck size={11} style={{ color: '#6366f1' }} />
                                  <span style={{ color: headingColor }}>{cert.type}</span>
                                  <span className="font-mono ml-auto" style={{ color: labelColor }}>{cert.number}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {verifyResult.status === 'Not Verified' && (
                      <p className="text-xs" style={{ color: labelColor }}>No matching record found in {verifyResult.source}.</p>
                    )}
                    {verifyResult.status === 'Error' && (
                      <p className="text-xs" style={{ color: '#ef4444' }}>{verifyResult.errorMsg || 'Verification failed. Check the value and try again.'}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* History */}
            <div className="rounded-2xl overflow-hidden" style={card}>
              <button onClick={historyOpen ? () => setHistoryOpen(false) : loadHistory}
                className="w-full flex items-center gap-2 p-4 text-sm font-semibold"
                style={{ color: headingColor }}>
                <Clock size={14} style={{ color: '#6366f1' }} />
                Verification History
                <ChevronDown size={13} className={`ml-auto transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {historyOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      {history.length === 0
                        ? <p className="text-xs text-center py-6" style={{ color: labelColor }}>No verifications yet</p>
                        : history.map((log, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-3 text-xs"
                            style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                            <span className="font-mono" style={{ color: labelColor }}>{log.maskedValue}</span>
                            <span className="px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: log.status === 'Verified' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: log.status === 'Verified' ? '#10b981' : '#ef4444' }}>
                              {log.status}
                            </span>
                            <span style={{ color: labelColor }}>{log.source}</span>
                            <span className="ml-auto" style={{ color: labelColor }}>{new Date(log.verifiedAt).toLocaleString()}</span>
                          </div>
                        ))
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── Settings tab ── */}
        {tab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="p-5 rounded-2xl space-y-4" style={card}>
              <div className="flex items-center gap-2 mb-2">
                <Settings size={15} style={{ color: '#6366f1' }} />
                <h4 className="text-sm font-bold" style={{ color: headingColor }}>Integration Configuration</h4>
              </div>

              {/* Mode toggle */}
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: labelColor }}>Verification Mode</label>
                <ModeToggle mode={mode} onChange={setMode} dark={dark} />
                {mode === 'mock' && (
                  <p className="text-xs mt-2 p-2.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.15)' }}>
                    Mock mode uses sample data — no real credentials needed. Perfect for testing and demos.
                  </p>
                )}
                {mode === 'live' && (
                  <p className="text-xs mt-2 p-2.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.15)' }}>
                    Live mode uses your DigiLocker API credentials. Falls back to simulated response if API is unreachable.
                  </p>
                )}
              </div>

              {/* Credentials (only shown in live mode) */}
              <AnimatePresence>
                {mode === 'live' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3">
                    {[
                      { key: 'clientId',   label: 'Client ID',   placeholder: 'Your DigiLocker client ID',              required: true },
                      { key: 'apiUrl',     label: 'API URL',     placeholder: 'https://api.digitallocker.gov.in',        required: true },
                      { key: 'redirectUri',label: 'Redirect URI',placeholder: 'https://yourapp.com/oauth/callback',     required: false },
                    ].map(({ key, label, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>
                          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>
                        <input value={form[key]} onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setFieldErrors(fe => ({ ...fe, [key]: '' })); }}
                          placeholder={placeholder}
                          style={{ ...inputStyle, borderColor: fieldErrors[key] ? '#ef4444' : (dark ? '#374151' : '#e5e7eb') }} />
                        {fieldErrors[key] && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{fieldErrors[key]}</p>}
                      </div>
                    ))}

                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>
                        Client Secret {!liveConfigured && <span style={{ color: '#ef4444' }}>*</span>}
                        {liveConfigured && <span className="ml-1 font-normal" style={{ color: '#10b981' }}>· saved</span>}
                      </label>
                      <div className="relative">
                        <input type={showSecret ? 'text' : 'password'}
                          value={form.clientSecret} onChange={e => { setForm(f => ({ ...f, clientSecret: e.target.value })); setFieldErrors(fe => ({ ...fe, clientSecret: '' })); }}
                          placeholder={liveConfigured ? 'Leave blank to keep existing secret' : 'Enter your DigiLocker client secret'}
                          style={{ ...inputStyle, paddingRight: 40, borderColor: fieldErrors.clientSecret ? '#ef4444' : (dark ? '#374151' : '#e5e7eb') }} />
                        <button onClick={() => setShowSecret(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }}>
                          {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {fieldErrors.clientSecret
                        ? <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{fieldErrors.clientSecret}</p>
                        : <p className="text-xs mt-1" style={{ color: labelColor }}>Encrypted with AES-256-GCM before storage. Never logged.</p>
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: saveStatus === 'saved' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved!' : saveStatus === 'error' ? 'Error — try again' : 'Save Integration Settings'}
              </motion.button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}
