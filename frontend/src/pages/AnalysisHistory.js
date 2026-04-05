import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Eye, AlertTriangle, X, FileText, ShieldCheck, RefreshCw, CheckCircle, XCircle, Mail, Bell, MessageCircle } from 'lucide-react';
import api from '../api';
import { detectSensitiveCols } from '../DigiLockerVerifyModal';

const FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLScmWJJaZOKINhwpdABnBfoo5Lx-fKVwbWBtr_g1DwaE-_b5eg/viewform';
const ENTRY_MAP = { email: 'entry.541960522', rollnumber: 'entry.655531758', name: 'entry.103162702', phonenumber: 'entry.69552159', aadhar: 'entry.1203760852' };
function normCol(str) { return String(str).toLowerCase().replace(/[\s_\-]+/g, '').replace(/number$/, ''); }
function buildFormLink(row) {
  const params = new URLSearchParams({ usp: 'pp_url' });
  for (const [col, val] of Object.entries(row)) {
    const entryId = ENTRY_MAP[normCol(col)];
    if (entryId && val && String(val).trim()) params.set(entryId, String(val).trim());
  }
  return `${FORM_BASE}?${params.toString()}`;
}

function FolderTreeNode({ node, depth }) {
  const indent = depth * 12;
  const isFolder = node.type === 'folder' || node.children;
  return (
    <div style={{ marginLeft: indent }}>
      <div className="flex items-center gap-1 py-0.5">
        <span className="text-xs" style={{ color: isFolder ? '#f59e0b' : '#6b7280' }}>
          {isFolder ? '📁' : '📄'}
        </span>
        <span className="text-xs" style={{ color: isFolder ? '#374151' : '#6b7280' }}>{node.name}</span>
        {node.mimeType && !isFolder && (
          <span className="text-xs" style={{ color: '#9ca3af', fontSize: 10 }}>
            {node.mimeType.split('/').pop().replace('vnd.openxmlformats-officedocument.wordprocessingml.document','docx')}
          </span>
        )}
      </div>
      {node.children?.map((child, i) => <FolderTreeNode key={i} node={child} depth={depth + 1} />)}
    </div>
  );
}

function AnalysisHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getHistory()
      .then(data => { setHistory(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Failed to load history'); setLoading(false); });

    // Poll every 30s — picks up sheet sync updates automatically
    const interval = setInterval(() => {
      api.getHistory().then(data => {
        if (Array.isArray(data)) setHistory(data);
        // If a modal is open, refresh its data too
        if (currentAnalysisIdRef.current) {
          api.getAnalysisById(currentAnalysisIdRef.current).then(res => {
            setViewData(res);
          }).catch(() => {});
        }
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const [confirmId, setConfirmId] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewPage, setViewPage] = useState(0);

  const [sensitiveCols, setSensitiveCols] = useState({ aadhaar: [], pan: [] });
  const [rowVerify, setRowVerify]   = useState({});
  const [verifyingAll, setVerifyingAll] = useState(false);
  const abortControllersRef = React.useRef([]);
  const currentAnalysisIdRef = React.useRef(null);
  const [driveFolderId, setDriveFolderId] = useState(() => {
    const saved = localStorage.getItem('verify_folder_id') || '';
    // Extract folder ID from URL if pasted as full URL
    const m = saved.match(/\/folders\/([a-zA-Z0-9_-]{25,})/) || saved.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
    return m ? m[1] : saved;
  });
  const [folderPrompt, setFolderPrompt]       = useState(false);
  const [folderTree, setFolderTree]           = useState(null);
  const [folderTreeLoading, setFolderTreeLoading] = useState(false);
  const [showFolderTree, setShowFolderTree]   = useState(false);
  const [notifyAllDropdown, setNotifyAllDropdown] = useState(false);
  const [notifyDropdown, setNotifyDropdown] = useState(null);
  const [unverifiedModal, setUnverifiedModal] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState(null);

  const sendWhatsApp = async (phones) => {
    setWaSending(true);
    try {
      await api.sendWhatsAppAlerts(phones);
      setWaResult({ sent: phones.length });
    } catch (e) {
      setWaResult({ error: e.message });
    }
    setWaSending(false);
  };

  const sendEmailAndSync = async (emails, analysisId, rowIndicesMap) => {
    setEmailSending(true);
    try {
      const result = await api.sendEmailAlerts(emails, analysisId, rowIndicesMap);
      setEmailResult(
        result.errors?.length > 0
          ? { sent: result.emailsSent, total: emails.length, analysisId, errors: result.errors }
          : { sent: result.emailsSent, total: emails.length, analysisId }
      );
    } catch (e) {
      setEmailResult({ sent: 0, total: emails.length, analysisId, errors: [{ email: emails[0], error: e.message }] });
    }
    setEmailSending(false);
  };

  // Close dropdowns on outside click
  React.useEffect(() => {
    if (notifyDropdown === null && !notifyAllDropdown) return;
    const handler = () => { setNotifyDropdown(null); setNotifyAllDropdown(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [notifyDropdown, notifyAllDropdown]);
  const [rowFilter, setRowFilter] = useState('all'); // 'all' | 'problematic' | 'not_verified'

  const previewFolder = async () => {
    if (!driveFolderId) return;
    setFolderTreeLoading(true);
    setShowFolderTree(true);
    try {
      const res = await api.getFolderStructure(driveFolderId);
      setFolderTree(res);
    } catch (e) {
      setFolderTree({ error: e.message });
    }
    setFolderTreeLoading(false);
  };

  const hasSensitive = sensitiveCols.aadhaar.length > 0 || sensitiveCols.pan.length > 0;

  const verifyRow = async (row, rowIdx, signal) => {
    if (!driveFolderId) { setFolderPrompt(true); return; }
    setRowVerify(prev => ({ ...prev, [rowIdx]: { status: 'loading' } }));
    try {
      const res = await api.verifyRow(row, driveFolderId, signal);
      const result = res.error
        ? { status: 'error', note: res.error }
        : { status: res.verified ? 'Verified' : 'Not Verified', matchPct: res.matchPct, checks: res.checks, folderName: res.folderName, note: res.note, foundAadhaar: res.foundAadhaar, foundPan: res.foundPan, debug: res.debug };
      setRowVerify(prev => {
        const next = { ...prev, [rowIdx]: result };
        if (currentAnalysisIdRef.current) api.saveVerificationStatus(currentAnalysisIdRef.current, next);
        return next;
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        setRowVerify(prev => { const next = { ...prev }; delete next[rowIdx]; return next; });
      } else {
        setRowVerify(prev => {
          const next = { ...prev, [rowIdx]: { status: 'error', note: e.message } };
          if (currentAnalysisIdRef.current) api.saveVerificationStatus(currentAnalysisIdRef.current, next);
          return next;
        });
      }
    }
  };

  const verifyAllRows = (rows) => {
    if (!driveFolderId) { setFolderPrompt(true); return; }
    abortControllersRef.current.forEach(ac => ac.abort());
    const controllers = rows.map(() => new AbortController());
    abortControllersRef.current = controllers;
    setVerifyingAll(true);
    Promise.all(rows.map((row, i) => {
      const existing = rowVerify[i];
      if (existing && existing.status !== 'loading') return Promise.resolve();
      return verifyRow(row, i, controllers[i].signal);
    }))
      .then(() => {
        setVerifyingAll(false);
        abortControllersRef.current = [];
      });
  };

  const stopVerifyAll = () => {
    abortControllersRef.current.forEach(ac => ac.abort());
    abortControllersRef.current = [];
    setVerifyingAll(false);
    setRowVerify(prev => {
      const completed = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.status !== 'loading'));
      return completed;
    });
  };

  const handleView = async (id) => {
    setViewLoading(true);
    setViewData(null);
    setRowVerify({});
    setRowFilter('all');
    abortControllersRef.current.forEach(ac => ac.abort());
    abortControllersRef.current = [];
    setVerifyingAll(false);
    currentAnalysisIdRef.current = id;
    const res = await api.getAnalysisById(id);
    setViewData(res);
    const cols = detectSensitiveCols(res?.rawData || []);
    setSensitiveCols(cols);
    // Restore previously saved verification status (keys come back as strings from JSON)
    if (res?.verificationStatus && Object.keys(res.verificationStatus).length > 0) {
      const normalized = Object.fromEntries(
        Object.entries(res.verificationStatus).map(([k, v]) => [Number(k), v])
      );
      setRowVerify(normalized);
    }
    setViewLoading(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await api.deleteAnalysis(confirmId);
    setDeleting(false);
    setConfirmId(null);
    if (res.success) {
      setHistory(prev => prev.filter(item => item.id !== confirmId));
    } else {
      alert('Delete failed: ' + (res.error || 'Unknown error'));
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    const res = await api.deleteAllAnalyses();
    setDeleting(false);
    setConfirmAll(false);
    if (res.success) setHistory([]);
    else alert('Delete failed: ' + (res.error || 'Unknown error'));
  };

  const exportCsv = () => {
    const headers = ['File Name', 'Date', 'Rows', 'Overall Score', 'Completeness', 'Uniqueness', 'Validity', 'Consistency', 'Problem Rows %'];
    const rows = history.map(item => [
      item.fileName || item.file,
      new Date(item.createdAt || item.date).toLocaleDateString(),
      item.rowCount ?? '',
      item.scores?.overallScore ?? '',
      item.scores?.completeness ?? '',
      item.scores?.uniqueness ?? '',
      item.scores?.validity ?? '',
      item.scores?.consistency ?? '',
      item.scores?.problemRowPct ?? '',
    ].map(v => `"${v}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'analysis_history.csv'; a.click();
  };

  const scoreColor = (score) =>
    score >= 80 ? 'text-green-600 dark:text-green-400' :
    score >= 60 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400';

  return (
    <div>
      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmId(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle size={22} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1">Delete Analysis</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">This will permanently remove the record. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}>
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete All Modal */}
      <AnimatePresence>
        {confirmAll && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmAll(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle size={22} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1">Delete All Analyses</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                This will permanently delete all <strong>{history.length}</strong> analyses. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAll(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteAll} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}>
                  {deleting ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Details Modal */}
      <AnimatePresence>
        {(viewLoading || viewData) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => { stopVerifyAll(); setViewData(null); setViewPage(0); setRowVerify({}); setNotifyDropdown(null); setNotifyAllDropdown(false); }}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">

              {viewLoading ? (
                <div className="p-12 text-center text-gray-400">Loading...</div>
              ) : viewData && (() => {
                const rows = viewData.rawData || [];
                const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const EMPTY = new Set(['', 'null', 'none', 'n/a', 'na', 'undefined', '-', '--', 'nil', 'missing', 'nan']);
                const isMissing = v => v === null || v === undefined || EMPTY.has(String(v).trim().toLowerCase());
                const isValidDate = v => { const s = String(v).trim(); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return false; const dt = new Date(+m[1], +m[2]-1, +m[3]); return dt.getFullYear()===+m[1] && dt.getMonth()===+m[2]-1 && dt.getDate()===+m[3]; };
                const seen = new Map(); const dupRows = new Set();
                rows.forEach((row, idx) => { const k = JSON.stringify(row); if (seen.has(k)) { dupRows.add(idx); dupRows.add(seen.get(k)); } else seen.set(k, idx); });
                const isCellProblem = (row, col) => {
                  const val = row[col];
                  const colL = col.toLowerCase();
                  if (isMissing(val)) return true;
                  if (colL.includes('email') && !emailRegex.test(String(val).trim())) return true;
                  if ((colL.includes('date') || colL.includes('dob')) && !isValidDate(val)) return true;
                  if (colL.includes('phone') && !/^\+?[\d\s\-()]{7,15}$/.test(String(val).trim())) return true;
                  if ((colL.includes('amount') || colL.includes('price') || colL.includes('total')) && (isNaN(parseFloat(val)) || parseFloat(val) < 0)) return true;
                  return false;
                };
                const isRowProblem = (row, idx) => dupRows.has(idx) || cols.some(col => isCellProblem(row, col));
                const getContact = (row) => {
                  const phoneKey = Object.keys(row).find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile'));
                  const emailKey = Object.keys(row).find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('mail'));
                  const nameKey  = Object.keys(row).find(k => k.toLowerCase().includes('name'));
                  return {
                    phone: phoneKey ? String(row[phoneKey] || '').trim() : '',
                    email: emailKey ? String(row[emailKey] || '').trim() : '',
                    name:  nameKey  ? String(row[nameKey]  || '').trim() : 'Student',
                  };
                };
                // Use backend-stored problemRowPct for display consistency
                const problemRowPct = viewData.problemRowPct ?? Math.round((rows.filter((r,i) => isRowProblem(r,i)).length / rows.length) * 100);
                const problemRowCount = Math.round((problemRowPct / 100) * rows.length);
                const pageSize = 20;
                // Apply filter — keep original indices as globalIdx
                const indexedRows = rows.map((row, idx) => ({ row, idx }));
                const filteredRows = rowFilter === 'problematic'
                  ? indexedRows.filter(({ row, idx }) => isRowProblem(row, idx))
                  : rowFilter === 'not_verified'
                  ? indexedRows.filter(({ idx }) => rowVerify[idx]?.status === 'Not Verified' || rowVerify[idx]?.status === 'error')
                  : indexedRows;
                const totalPages = Math.ceil(filteredRows.length / pageSize);
                const pageRows = filteredRows.slice(viewPage * pageSize, (viewPage + 1) * pageSize);
                return (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                          <FileText size={16} style={{ color: '#6366f1' }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{viewData.fileName}</p>
                          <p className="text-xs text-gray-400">{viewData.rowCount} rows · {cols.length} columns</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {rows.length > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Problematic Rows</p>
                            <p className={`text-sm font-bold ${problemRowPct > 30 ? 'text-red-500' : problemRowPct > 10 ? 'text-orange-500' : 'text-green-500'}`}>
                              {problemRowCount} / {rows.length} &nbsp;({problemRowPct}%)
                            </p>
                          </div>
                        )}
                        <button onClick={() => { stopVerifyAll(); setViewData(null); setViewPage(0); setRowVerify({}); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <X size={16} className="text-gray-500" />
                        </button>
                      </div>
                    </div>

                    {/* Verify banner */}
                    <AnimatePresence>
                      {hasSensitive && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="mx-4 mt-3 flex-shrink-0 rounded-xl overflow-hidden"
                          style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
                          <div className="flex items-center gap-3 px-4 py-3"
                            style={{ background: 'rgba(16,185,129,0.07)' }}>
                            <ShieldCheck size={15} style={{ color: '#10b981' }} className="flex-shrink-0" />
                            <p className="text-xs text-gray-600 dark:text-gray-300 flex-1">
                              Aadhaar/PAN detected — verify rows against Drive documents
                              {Object.keys(rowVerify).length > 0 && (
                                <span className="ml-2">
                                  <span style={{ color: '#10b981' }}>{Object.values(rowVerify).filter(r => r.status === 'Verified').length} ✓</span>
                                  {' · '}
                                  <span style={{ color: '#ef4444' }}>{Object.values(rowVerify).filter(r => r.status === 'Not Verified').length} ✗</span>
                                  {Object.values(rowVerify).some(r => r.status === 'loading') && <span style={{ color: '#f59e0b' }}> · {Object.values(rowVerify).filter(r => r.status === 'loading').length} checking…</span>}
                                </span>
                              )}
                            </p>
                              <button onClick={() => verifyAllRows(rows)} disabled={verifyingAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white flex-shrink-0 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                                <ShieldCheck size={11} /> Verify All
                              </button>
                              {verifyingAll && (
                                <button onClick={stopVerifyAll}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white flex-shrink-0"
                                  style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                                  <X size={11} /> Stop
                                </button>
                              )}
                          </div>
                          {/* Folder input + preview */}
                          <div className="flex items-center gap-2 px-4 py-2.5"
                            style={{ background: 'rgba(16,185,129,0.03)', borderTop: '1px solid rgba(16,185,129,0.12)' }}>
                            <span className="text-xs text-gray-400 flex-shrink-0">Drive Folder:</span>
                            <input
                              value={driveFolderId}
                              onChange={e => {
                                const val = e.target.value;
                                const m = val.match(/\/folders\/([a-zA-Z0-9_-]{25,})/) || val.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
                                const id = m ? m[1] : val;
                                setDriveFolderId(id);
                                localStorage.setItem('verify_folder_id', id);
                                setFolderTree(null);
                              }}
                              placeholder="Paste folder ID or URL…"
                              className="flex-1 text-xs bg-transparent outline-none"
                              style={{ color: '#6b7280', minWidth: 0 }}
                            />
                            {driveFolderId && (
                              <button onClick={previewFolder} disabled={folderTreeLoading}
                                className="text-xs px-2 py-1 rounded-lg flex-shrink-0 flex items-center gap-1"
                                style={{ color: '#4285f4', border: '1px solid rgba(66,133,244,0.25)', background: 'rgba(66,133,244,0.06)' }}>
                                {folderTreeLoading ? <RefreshCw size={9} className="animate-spin" /> : '🗂'} Preview
                              </button>
                            )}
                          </div>
                          {/* Folder tree preview */}
                          {showFolderTree && (
                            <div className="px-4 pb-3" style={{ borderTop: '1px solid rgba(16,185,129,0.08)', background: 'rgba(0,0,0,0.02)' }}>
                              <div className="flex items-center justify-between py-2">
                                <span className="text-xs font-semibold text-gray-500">Folder Structure</span>
                                <button onClick={() => setShowFolderTree(false)} className="text-xs text-gray-400 hover:text-gray-600">hide</button>
                              </div>
                              {folderTreeLoading ? (
                                <p className="text-xs text-gray-400">Loading…</p>
                              ) : folderTree?.error ? (
                                <p className="text-xs" style={{ color: '#ef4444' }}>{folderTree.error}</p>
                              ) : folderTree ? (
                                <div className="max-h-48 overflow-y-auto">
                                  <FolderTreeNode node={folderTree} depth={0} />
                                </div>
                              ) : null}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Filter pills */}
                    {rows.length > 0 && (
                      <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.01)' }}>
                        {[
                          { key: 'all', label: 'All Rows', count: rows.length },
                          { key: 'problematic', label: 'Problematic', count: rows.filter((r,i) => isRowProblem(r,i)).length },
                          { key: 'not_verified', label: 'Not Verified', count: Object.values(rowVerify).filter(v => v.status === 'Not Verified' || v.status === 'error').length },
                        ].map(f => (
                          <button key={f.key} onClick={() => { setRowFilter(f.key); setViewPage(0); }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={rowFilter === f.key
                              ? { background: f.key === 'all' ? '#6366f1' : f.key === 'problematic' ? '#ef4444' : '#f59e0b', color: '#fff' }
                              : { background: 'rgba(0,0,0,0.04)', color: '#6b7280', border: '1px solid rgba(0,0,0,0.08)' }}>
                            {f.label}
                            <span className="px-1.5 py-0.5 rounded-full text-xs"
                              style={{ background: rowFilter === f.key ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)' }}>
                              {f.count}
                            </span>
                          </button>
                        ))}

                        {/* Notify All */}
                        {(() => {
                          const notifiableRows = rows
                            .map((row, idx) => ({ row, idx }))
                            .filter(({ row, idx }) => {
                              const vr = rowVerify[idx];
                              const isIssue = isRowProblem(row, idx) || vr?.status === 'Not Verified' || vr?.status === 'error';
                              const { phone, email } = getContact(row);
                              return isIssue && (phone || email);
                            });
                          if (notifiableRows.length === 0) return null;
                          const allEmails = [...new Set(notifiableRows.map(({ row }) => getContact(row).email).filter(Boolean))];
                          const allPhones = [...new Set(notifiableRows.map(({ row }) => getContact(row).phone).filter(Boolean))];
                          const noEmailRows = notifiableRows.filter(({ row }) => !getContact(row).email && getContact(row).phone);
                          return (
                            <div className="relative ml-auto">
                              <button
                                onClick={(e) => { e.stopPropagation(); setNotifyAllDropdown(v => !v); }}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
                                style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                <Bell size={11} /> Notify All
                                <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(245,158,11,0.2)' }}>
                                  {notifiableRows.length}
                                </span>
                              </button>
                              {notifyAllDropdown && (
                                <div className="absolute right-0 top-8 z-50 rounded-xl shadow-xl overflow-hidden"
                                  style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', minWidth: 240 }}>
                                  <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'rgba(245,158,11,0.04)' }}>
                                    <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>Notify All ({notifiableRows.length} rows)</p>
                                    {noEmailRows.length > 0 && (
                                      <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{noEmailRows.length} missing email — WhatsApp available</p>
                                    )}
                                  </div>
                                  {allPhones.length > 0 && (
                                    <button
                                      onClick={async () => {
                                        setNotifyAllDropdown(false);
                                        const payload = notifiableRows
                                          .filter(({ row }) => getContact(row).phone)
                                          .map(({ row }) => {
                                            const { phone: p, name: n } = getContact(row);
                                            const link = buildFormLink(row);
                                            return { phone: p, message: `Hi ${n}, your record has issues. Please update your details here: ${link}` };
                                          });
                                        await sendWhatsApp(payload);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-green-50 transition-colors"
                                      style={{ color: '#374151' }}>
                                      <MessageCircle size={11} style={{ color: '#25d366' }} />
                                      Send via WhatsApp
                                      <span className="ml-auto text-xs" style={{ color: '#9ca3af' }}>{allPhones.length} contacts</span>
                                    </button>
                                  )}
                                  {allEmails.length > 0 && (
                                    <button
                                      onClick={async () => {
                                        setNotifyAllDropdown(false);
                                        const rowIndicesMap = {};
                                        notifiableRows.forEach(({ row, idx }) => {
                                          const { email } = getContact(row);
                                          if (email) rowIndicesMap[email.trim()] = idx;
                                        });
                                        await sendEmailAndSync(allEmails, viewData?.id, rowIndicesMap);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
                                      style={{ color: '#374151' }}>
                                      <Mail size={11} style={{ color: '#6366f1' }} />
                                      Send via Email
                                      <span className="ml-auto text-xs" style={{ color: '#9ca3af' }}>{allEmails.length} contacts</span>
                                    </button>
                                  )}
                                  {allPhones.length > 0 && allEmails.length > 0 && (
                                    <>
                                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />
                                      <button
                                        onClick={async () => {
                                          setNotifyAllDropdown(false);
                                          const payload = notifiableRows
                                            .filter(({ row }) => getContact(row).phone)
                                            .map(({ row }) => {
                                              const { phone: p, name: n } = getContact(row);
                                              const link = buildFormLink(row);
                                              return { phone: p, message: `Hi ${n}, your record has issues. Please update your details here: ${link}` };
                                            });
                                          await sendWhatsApp(payload);
                                          const rowIndicesMap = {};
                                          notifiableRows.forEach(({ row, idx }) => {
                                            const { email } = getContact(row);
                                            if (email) rowIndicesMap[email.trim()] = idx;
                                          });
                                          await sendEmailAndSync(allEmails, viewData?.id, rowIndicesMap);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-green-50 transition-colors"
                                        style={{ color: '#25d366' }}>
                                        <MessageCircle size={11} /> WhatsApp + Email
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Table */}
                    <div className="overflow-auto flex-1">
                      {rows.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 text-sm">No raw data stored for this record. This analysis was processed before data storage was enabled.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 w-12">#</th>
                              {cols.map(col => (
                                <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{col}</th>
                              ))}
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 whitespace-nowrap">Notify</th>
                              {hasSensitive && (
                                <th className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: '#10b981' }}>DigiLocker</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {pageRows.map(({ row, idx: globalIdx }, i) => {
                              const rowHasIssue = isRowProblem(row, globalIdx);
                              const vr = rowVerify[globalIdx];
                              return (
                              <tr key={i} className={`transition-colors ${
                                vr?.status === 'Verified' ? 'bg-green-50 dark:bg-green-900/10' :
                                vr?.status === 'Not Verified' ? 'bg-red-50 dark:bg-red-900/10' :
                                rowHasIssue ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' :
                                'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                              }`}>
                                <td className="px-4 py-2.5 text-xs text-gray-400">{globalIdx + 1}</td>
                                {cols.map(col => {
                                  const val = row[col];
                                  const cellIssue = isCellProblem(row, col);
                                  return (
                                  <td key={col} className={`px-4 py-2.5 whitespace-nowrap max-w-[180px] truncate text-sm font-medium ${cellIssue ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {val ?? '—'}
                                  </td>
                                  );
                                })}
                                {/* Notify cell */}
                                {(() => {
                                  const showNotify = rowHasIssue || vr?.status === 'Not Verified' || vr?.status === 'error';
                                  const { phone, email, name } = getContact(row);
                                  const missingCols = cols.filter(col => isMissing(row[col]));
                                  const invalidCols = cols.filter(col => !isMissing(row[col]) && isCellProblem(row, col));
                                  const isVerifyFail = vr?.status === 'Not Verified' || vr?.status === 'error';

                                  let smsMsg;
                                  if (isVerifyFail) {
                                    smsMsg = `Hi ${name}, your document verification has failed. Please submit the correct documents at the earliest.`;
                                  } else {
                                    const parts = [];
                                    if (missingCols.length > 0) parts.push(`Missing: ${missingCols.join(', ')}`);
                                    if (invalidCols.length > 0) parts.push(`Invalid: ${invalidCols.join(', ')}`);
                                    smsMsg = `Hi ${name}, the following data is incomplete in your record - ${parts.join(' | ')}. Please update at the earliest.`;
                                  }

                                  const subject = isVerifyFail ? 'Document Verification Failed' : `Incomplete Record: Action Required`;
                                  const emailBody = isVerifyFail
                                    ? `Dear ${name},\n\nYour document verification has failed. Please submit the correct documents at the earliest.\n\nRegards`
                                    : `Dear ${name},\n\nThe following data is incomplete in your record:\n${missingCols.length > 0 ? `\nMissing fields: ${missingCols.join(', ')}` : ''}${invalidCols.length > 0 ? `\nInvalid fields: ${invalidCols.join(', ')}` : ''}\n\nPlease update your information at the earliest.\n\nRegards`;

                                  const formLink = buildFormLink(row);
                                  const waMsg = `${smsMsg}\n\nPlease update your details here: ${formLink}`;

                                  return (
                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                      {showNotify && (phone || email) ? (
                                        <div className="relative">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setNotifyDropdown(notifyDropdown === globalIdx ? null : globalIdx); }}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                                            style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                                            <Bell size={10} /> Notify
                                          </button>
                                          {notifyDropdown === globalIdx && (
                                            <div className="absolute left-0 top-7 z-50 rounded-xl shadow-xl overflow-hidden"
                                              style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', minWidth: 200 }}>
                                              <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'rgba(245,158,11,0.04)' }}>
                                                <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>Send Notification</p>
                                                {!email && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>No email — use WhatsApp</p>}
                                              </div>
                                              {phone && (
                                                <button
                                                  onClick={async () => {
                                                    setNotifyDropdown(null);
                                                    await sendWhatsApp([{ phone, message: waMsg }]);
                                                  }}
                                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-green-50 transition-colors"
                                                  style={{ color: '#374151' }}>
                                                  <MessageCircle size={11} style={{ color: '#25d366' }} /> Send via WhatsApp
                                                  <span className="ml-auto text-xs" style={{ color: '#9ca3af' }}>{phone}</span>
                                                </button>
                                              )}
                                              {email && (
                                                <button
                                                  onClick={async () => {
                                                    setNotifyDropdown(null);
                                                    await sendEmailAndSync([email], currentAnalysisIdRef.current, { [email.trim()]: globalIdx });
                                                  }}
                                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
                                                  style={{ color: '#374151' }}>
                                                  <Mail size={11} style={{ color: '#6366f1' }} /> Send via Email
                                                  <span className="ml-auto text-xs" style={{ color: '#9ca3af' }}>{email}</span>
                                                </button>
                                              )}
                                              {phone && email && (
                                                <>
                                                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }} />
                                                  <button
                                                    onClick={async () => {
                                                      setNotifyDropdown(null);
                                                      await sendWhatsApp([{ phone, message: waMsg }]);
                                                      await sendEmailAndSync([email], currentAnalysisIdRef.current, { [email.trim()]: globalIdx });
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-green-50 transition-colors"
                                                    style={{ color: '#25d366' }}>
                                                    <MessageCircle size={11} /> WhatsApp + Email
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ) : <span className="text-xs text-gray-300">—</span>}
                                    </td>
                                  );
                                })()}
                                {hasSensitive && (
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    {!vr ? (
                                      <button onClick={() => verifyRow(row, globalIdx)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                                        style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <ShieldCheck size={10} /> Verify
                                      </button>
                                    ) : vr.status === 'loading' ? (
                                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                                        <RefreshCw size={10} className="animate-spin" /> checking…
                                      </span>
                                    ) : vr.status === 'Verified' ? (
                                      <div>
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                                          <CheckCircle size={10} /> Verified {vr.matchPct != null && `${vr.matchPct}%`}
                                        </span>
                                        {vr.folderName && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{vr.folderName}</p>}
                                        {vr.checks && (
                                          <p className="text-xs mt-0.5">
                                            {Object.entries(vr.checks).map(([k, v]) => (
                                              <span key={k} className="mr-1" style={{ color: v ? '#10b981' : '#ef4444' }}>{k}</span>
                                            ))}
                                          </p>
                                        )}
                                      </div>
                                    ) : vr.status === 'error' ? (
                                      <button onClick={() => setUnverifiedModal({ vr, row })}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer hover:opacity-80"
                                        style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                                        <XCircle size={10} /> No folder
                                      </button>
                                    ) : (
                                      <button onClick={() => setUnverifiedModal({ vr, row })}
                                        className="text-left hover:opacity-80 cursor-pointer"
                                        style={{ background: 'none', border: 'none', padding: 0 }}>
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                                          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                                          <XCircle size={10} /> Not Verified {vr.matchPct != null && `${vr.matchPct}%`}
                                        </span>
                                        {vr.folderName && <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{vr.folderName}</p>}
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
                        <span className="text-xs text-gray-400">Page {viewPage + 1} of {totalPages} · {filteredRows.length} rows{rowFilter !== 'all' && ` (filtered from ${rows.length})`}</span>
                        <div className="flex gap-2">
                          <button disabled={viewPage === 0} onClick={() => setViewPage(p => p - 1)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Previous
                          </button>
                          <button disabled={viewPage === totalPages - 1} onClick={() => setViewPage(p => p + 1)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Unverified Reason Modal */}
      <AnimatePresence>
        {unverifiedModal && (() => {
          const { vr, row } = unverifiedModal;
          const isMissingFolder = vr.status === 'error';
          const mismatches = [];
          if (vr.checks) {
            Object.entries(vr.checks).forEach(([k, v]) => {
              if (!v) mismatches.push(k);
            });
          }
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
              onClick={() => setUnverifiedModal(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700"
                  style={{ background: isMissingFolder ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <XCircle size={18} style={{ color: isMissingFolder ? '#f59e0b' : '#ef4444' }} />
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      {isMissingFolder ? 'Document Not Found in Drive' : 'Verification Failed'}
                    </span>
                  </div>
                  <button onClick={() => setUnverifiedModal(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700">
                    <X size={14} className="text-gray-500" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {/* Reason */}
                  {isMissingFolder && (
                    <div className="rounded-xl p-3.5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>⚠ Missing in Drive</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {vr.note || 'No matching folder was found in the Drive for this student. The document may not have been uploaded yet.'}
                      </p>
                    </div>
                  )}

                  {/* Field breakdown */}
                  {!isMissingFolder && (
                    <div>
                      <div className="space-y-2">
                        {vr.checks && Object.keys(vr.checks).length > 0 ? (
                          Object.entries(vr.checks).map(([k, v]) => {
                            const driveVal = vr.debug?.[`found${k.charAt(0).toUpperCase()+k.slice(1)}`];
                            const notFound = !driveVal || driveVal === 'not found';
                            return (
                              <div key={k} className="rounded-lg px-3 py-2.5"
                                style={{ background: v ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)', border: `1px solid ${v ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize">{k}</span>
                                  {v ? <CheckCircle size={13} style={{ color: '#10b981' }} /> : <XCircle size={13} style={{ color: '#ef4444' }} />}
                                </div>
                                {!v && (
                                  <p className="text-xs mt-1.5" style={{ color: '#ef4444' }}>
                                    {notFound ? 'There is no such file to verify in the Drive.' : 'MISMATCH'}
                                  </p>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <p className="text-xs" style={{ color: '#ef4444' }}>There is no such file to verify in the Drive.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Matched folder */}
                  {vr.folderName && (
                    <p className="text-xs text-gray-400">Matched folder: <span className="font-medium text-gray-600 dark:text-gray-300">{vr.folderName}</span></p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
      {/* Email sending overlay */}
      <AnimatePresence>
        {emailSending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
              <RefreshCw size={22} className="animate-spin" style={{ color: '#6366f1' }} />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sending email…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp sending overlay */}
      <AnimatePresence>
        {waSending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
              <RefreshCw size={22} className="animate-spin" style={{ color: '#25d366' }} />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sending WhatsApp messages…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp sent confirmation */}
      <AnimatePresence>
        {waResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 z-[70] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
            style={{ background: '#fff', border: '1px solid rgba(37,211,102,0.3)' }}>
            <MessageCircle size={16} style={{ color: '#25d366' }} />
            <div>
              <p className="text-sm font-bold text-gray-800">{waResult.error ? 'WhatsApp failed' : 'WhatsApp sent!'}</p>
              <p className="text-xs text-gray-500">
                {waResult.error ? waResult.error : `Message sent to ${waResult.sent} recipient${waResult.sent !== 1 ? 's' : ''}.`}
              </p>
            </div>
            <button onClick={() => setWaResult(null)} className="ml-2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email sent confirmation */}
      <AnimatePresence>
        {emailResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
            style={{ background: '#fff', border: '1px solid rgba(16,185,129,0.3)' }}>
            <CheckCircle size={16} style={{ color: '#10b981' }} />
            <div>
              <p className="text-sm font-bold text-gray-800">Emails sent!</p>
              <p className="text-xs text-gray-500">
                {emailResult.errors?.length > 0
                  ? `Failed: ${emailResult.errors.map(e => e.error).join(', ')}`
                  : `Form link sent to ${emailResult.sent} recipient${emailResult.sent !== 1 ? 's' : ''}. Sheet will sync when they respond.`
                }
              </p>
            </div>
            <button onClick={() => setEmailResult(null)} className="ml-2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DigiLocker Verify Modal — removed, verification is now inline in the data table */}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Analysis History</h2>
          <p className="text-gray-600 dark:text-gray-400">View all your previous data quality analyses</p>
        </div>
        {history.length > 0 && (
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              <FileText size={14} /> Export CSV
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setConfirmAll(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={14} /> Delete All
            </motion.button>
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['File Name', 'Date', 'Rows', 'Score', 'Problem Rows', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.map((item, index) => (
                <motion.tr
                  key={item._id || item.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{item.fileName || item.file}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(item.createdAt || item.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.rowCount ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-semibold ${scoreColor(item.scores?.overallScore ?? item.score)}`}>
                      {item.scores?.overallScore ?? item.score}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {item.scores?.problemRowPct != null ? (
                      <span className={`text-sm font-semibold ${
                        item.scores.problemRowPct > 30 ? 'text-red-500' :
                        item.scores.problemRowPct > 10 ? 'text-orange-500' : 'text-green-500'
                      }`}>{item.scores.problemRowPct}%</span>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => handleView(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}>
                        <Eye size={12} /> View
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setConfirmId(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}>
                        <Trash2 size={12} /> Delete
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}

export default AnalysisHistory;
