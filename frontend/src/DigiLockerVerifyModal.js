import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, CheckCircle, XCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import api from './api';

const AADHAAR_RE = /^aadhaar|aadhar|uid|uidai$/i;
const PAN_RE     = /^pan$|pan_no|pan_number|pancard/i;
const AADHAAR_VAL = /^\d{12}$/;
const PAN_VAL     = /^[A-Z]{5}\d{4}[A-Z]$/i;

function maskAadhaar(v) { return `XXXX-XXXX-${String(v).slice(-4)}`; }
function maskPan(v)     { return `${v[0]}XXXX${v.slice(-4)}`; }

function detectSensitiveCols(rows) {
  if (!rows?.length) return { aadhaar: [], pan: [] };
  const cols = Object.keys(rows[0]);
  const aadhaar = [], pan = [];
  cols.forEach(c => {
    const byName = AADHAAR_RE.test(c);
    const byPanName = PAN_RE.test(c);
    const samples = rows.slice(0, 5).map(r => String(r[c] ?? '').trim().replace(/\s/g, ''));
    if (byName || samples.some(v => AADHAAR_VAL.test(v))) aadhaar.push(c);
    else if (byPanName || samples.some(v => PAN_VAL.test(v))) pan.push(c);
  });
  return { aadhaar, pan };
}

function buildVerifyRows(rows, sensitiveCols) {
  const entries = [];
  rows.forEach((row, idx) => {
    [...sensitiveCols.aadhaar, ...sensitiveCols.pan].forEach(col => {
      const raw = String(row[col] ?? '').trim().replace(/\s/g, '');
      const isAadhaar = sensitiveCols.aadhaar.includes(col);
      const valid = isAadhaar ? AADHAAR_VAL.test(raw) : PAN_VAL.test(raw.toUpperCase());
      if (!valid) return;
      entries.push({ rowIdx: idx, col, raw, docType: isAadhaar ? 'aadhaar' : 'pan', masked: isAadhaar ? maskAadhaar(raw) : maskPan(raw.toUpperCase()) });
    });
  });
  return entries;
}

export default function DigiLockerVerifyModal({ rows, onClose }) {
  const sensitiveCols = useMemo(() => detectSensitiveCols(rows), [rows]);
  const verifyRows    = useMemo(() => buildVerifyRows(rows, sensitiveCols), [rows, sensitiveCols]);

  const [results, setResults]   = useState({});   // key: `${rowIdx}-${col}` → result
  const [loading, setLoading]   = useState({});
  const [verifyingAll, setVerifyingAll] = useState(false);

  const verify = async (entry) => {
    const key = `${entry.rowIdx}-${entry.col}`;
    setLoading(l => ({ ...l, [key]: true }));
    try {
      const res = await api.verifyDocument(entry.raw, 1);
      if (res.source === 'DigiLocker (Simulated)') {
        setResults(r => ({ ...r, [key]: { ...res, status: 'Not Verified', errorMsg: 'Live API unreachable — check Integration Settings' } }));
      } else {
        setResults(r => ({ ...r, [key]: res }));
      }
    } catch (e) {
      setResults(r => ({ ...r, [key]: { status: 'Not Verified', errorMsg: 'Connection failed — check Integration Settings' } }));
    }
    setLoading(l => ({ ...l, [key]: false }));
  };

  const verifyAll = async () => {
    setVerifyingAll(true);
    await Promise.all(verifyRows.map(verify));
    setVerifyingAll(false);
  };

  const verified   = Object.values(results).filter(r => r.status === 'Verified').length;
  const unverified = Object.values(results).filter(r => r.status !== 'Verified').length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        style={{ border: '1px solid rgba(16,185,129,0.25)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(99,102,241,0.15))', border: '1px solid rgba(16,185,129,0.3)' }}>
            <ShieldCheck size={16} style={{ color: '#10b981' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">DigiLocker Verification</p>
            <p className="text-xs text-gray-400">{verifyRows.length} sensitive value{verifyRows.length !== 1 ? 's' : ''} detected</p>
          </div>

          {/* Summary badges */}
          {Object.keys(results).length > 0 && (
            <div className="flex gap-2 ml-auto mr-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                <CheckCircle size={11} /> {verified}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                <XCircle size={11} /> {unverified}
              </span>
            </div>
          )}

          <button onClick={verifyAll} disabled={verifyingAll || !verifyRows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 3px 10px rgba(16,185,129,0.3)' }}>
            {verifyingAll ? <RefreshCw size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            Verify All
          </button>

          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-700/60">
          {verifyRows.length === 0 ? (
            <p className="text-sm text-center text-gray-400 py-10">No valid Aadhaar/PAN values found in this dataset.</p>
          ) : verifyRows.map((entry) => {
            const key = `${entry.rowIdx}-${entry.col}`;
            const res = results[key];
            const busy = loading[key];
            return (
              <div key={key} className="flex items-center gap-3 px-5 py-3">
                {/* Row info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Row {entry.rowIdx + 1}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: entry.docType === 'aadhaar' ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)', color: entry.docType === 'aadhaar' ? '#6366f1' : '#f59e0b' }}>
                      {entry.docType.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 truncate">{entry.col}</span>
                  </div>
                  <p className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{entry.masked}</p>
                </div>

                {/* Result */}
                <AnimatePresence mode="wait">
                  {res ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 flex-shrink-0">
                      {res.status === 'Verified' ? (
                        <>
                          <CheckCircle size={15} style={{ color: '#10b981' }} />
                          <div className="text-right">
                            <p className="text-xs font-bold" style={{ color: '#10b981' }}>Verified</p>
                            {res.name && <p className="text-xs text-gray-500">{res.name}</p>}
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle size={15} style={{ color: '#ef4444' }} />
                          <div className="text-right">
                            <p className="text-xs font-bold" style={{ color: '#ef4444' }}>Not Verified</p>
                            {res.errorMsg && <p className="text-xs mt-0.5 max-w-[160px]" style={{ color: '#ef4444', opacity: 0.75 }}>{res.errorMsg}</p>}
                          </div>
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <motion.button key="btn" onClick={() => verify(entry)} disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {busy ? <RefreshCw size={11} className="animate-spin" /> : <ShieldAlert size={11} />}
                      {busy ? 'Verifying…' : 'Verify'}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

export { detectSensitiveCols };
