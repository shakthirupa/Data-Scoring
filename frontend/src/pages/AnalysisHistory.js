import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Eye, AlertTriangle, X, FileText, ShieldCheck } from 'lucide-react';
import api from '../api';
import DigiLockerVerifyModal, { detectSensitiveCols } from '../DigiLockerVerifyModal';

function AnalysisHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getHistory()
      .then(data => { setHistory(data); setLoading(false); })
      .catch(() => { setError('Failed to load history'); setLoading(false); });
  }, []);

  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewPage, setViewPage] = useState(0);
  const [showDigiLocker, setShowDigiLocker] = useState(false);
  const [sensitiveCols, setSensitiveCols] = useState({ aadhaar: [], pan: [] });

  const handleView = async (id) => {
    setViewLoading(true);
    setViewData(null);
    setShowDigiLocker(false);
    const res = await api.getAnalysisById(id);
    setViewData(res);
    const cols = detectSensitiveCols(res?.rawData || []);
    setSensitiveCols(cols);
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

      {/* View Details Modal */}
      <AnimatePresence>
        {(viewLoading || viewData) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => { setViewData(null); setViewPage(0); setShowDigiLocker(false); }}>
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
                // Use backend-stored problemRowPct for display consistency
                const problemRowPct = viewData.problemRowPct ?? Math.round((rows.filter((r,i) => isRowProblem(r,i)).length / rows.length) * 100);
                const problemRowCount = Math.round((problemRowPct / 100) * rows.length);
                const pageSize = 20;
                const totalPages = Math.ceil(rows.length / pageSize);
                const pageRows = rows.slice(viewPage * pageSize, (viewPage + 1) * pageSize);
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
                        <button onClick={() => { setViewData(null); setViewPage(0); setShowDigiLocker(false); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <X size={16} className="text-gray-500" />
                        </button>
                      </div>
                    </div>

                    {/* DigiLocker banner */}
                    <AnimatePresence>
                      {(sensitiveCols.aadhaar.length > 0 || sensitiveCols.pan.length > 0) && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-3 mx-4 mt-3 px-4 py-3 rounded-xl flex-shrink-0"
                          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)' }}>
                          <ShieldCheck size={15} style={{ color: '#10b981' }} className="flex-shrink-0" />
                          <p className="text-xs text-gray-600 dark:text-gray-300 flex-1">
                            This dataset contains <span className="font-semibold" style={{ color: '#10b981' }}>Aadhaar/PAN columns</span>. Verify identities with DigiLocker?
                          </p>
                          <button onClick={() => setShowDigiLocker(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 3px 10px rgba(16,185,129,0.3)' }}>
                            <ShieldCheck size={11} /> Verify with DigiLocker
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {pageRows.map((row, i) => {
                              const globalIdx = viewPage * pageSize + i;
                              const rowHasIssue = isRowProblem(row, globalIdx);
                              return (
                              <tr key={i} className={`transition-colors ${rowHasIssue ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                                <td className="px-4 py-2.5 text-xs text-gray-400">{globalIdx + 1}</td>
                                {cols.map(col => {
                                  const cellIssue = isCellProblem(row, col);
                                  return (
                                  <td key={col} className={`px-4 py-2.5 whitespace-nowrap max-w-[180px] truncate text-sm font-medium ${cellIssue ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {row[col] ?? '—'}
                                  </td>
                                  );
                                })}
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
                        <span className="text-xs text-gray-400">Page {viewPage + 1} of {totalPages} · {rows.length} rows</span>
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
      {/* DigiLocker Verify Modal */}
      <AnimatePresence>
        {showDigiLocker && viewData && (
          <DigiLockerVerifyModal
            rows={viewData.rawData || []}
            onClose={() => setShowDigiLocker(false)}
          />
        )}
      </AnimatePresence>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Analysis History</h2>
        <p className="text-gray-600 dark:text-gray-400">View all your previous data quality analyses</p>
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
