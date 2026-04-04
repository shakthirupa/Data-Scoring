import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Copy, GitCompare, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

function useCard() {
  const { dark } = useTheme();
  return dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
}

function RelBadge({ rel }) {
  const cfg = {
    exact_duplicate:        { color: '#ef4444', label: 'Exact Duplicate' },
    same_file_different_name:{ color: '#f97316', label: 'Same File, Different Name' },
    near_duplicate:         { color: '#f59e0b', label: 'Near Duplicate' },
    structurally_similar:   { color: '#6366f1', label: 'Structurally Similar' },
    different:              { color: '#10b981', label: 'Different' },
  }[rel] || { color: '#6b7280', label: rel };
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>;
}

export default function FingerprintPage() {
  const { dark } = useTheme();
  const card = useCard();
  const [fingerprints, setFingerprints] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [tab, setTab] = useState('all');

  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';
  const inputStyle = { background: dark ? '#1f2937' : '#f3f4f6', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, color: dark ? '#d1d5db' : '#374151', borderRadius: '10px', padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' };

  useEffect(() => {
    api.getAllFingerprints().then(d => setFingerprints(Array.isArray(d) ? d : [])).catch(() => {});
    api.getDuplicates().then(d => setDuplicates(d.groups || [])).catch(() => {});
  }, []);

  const handleCompare = async () => {
    if (!compareA || !compareB) return;
    setComparing(true);
    const result = await api.compareFingerprints(Number(compareA), Number(compareB));
    setCompareResult(result);
    setComparing(false);
  };

  const TABS = [
    { id: 'all', label: 'All Fingerprints', count: fingerprints.length },
    { id: 'duplicates', label: 'Duplicates', count: duplicates.length },
    { id: 'compare', label: 'Compare' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Data DNA Fingerprinting</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>Detect duplicate datasets, compare structures, and track dataset identity</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.id ? { background: dark ? '#1f2937' : '#fff', color: '#6366f1', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } : { color: labelColor }}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* All fingerprints */}
      {tab === 'all' && (
        <div className="p-5 rounded-2xl" style={card}>
          {fingerprints.length === 0
            ? <p className="text-sm text-center py-10" style={{ color: labelColor }}>No fingerprints yet — upload datasets to generate them.</p>
            : (
              <div className="space-y-2">
                {fingerprints.map((fp, i) => (
                  <motion.div key={fp.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <Fingerprint size={14} style={{ color: '#6366f1' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: headingColor }}>{fp.fileName}</p>
                      <p className="text-xs font-mono truncate" style={{ color: labelColor }}>{fp.compositeHash?.slice(0, 24)}…</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold" style={{ color: '#6366f1' }}>{fp.rowCount?.toLocaleString()} rows</p>
                      <p className="text-xs" style={{ color: labelColor }}>{fp.columnCount} cols</p>
                    </div>
                    <p className="text-xs flex-shrink-0" style={{ color: labelColor }}>#{fp.analysisId}</p>
                  </motion.div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Duplicates */}
      {tab === 'duplicates' && (
        <div className="space-y-3">
          {duplicates.length === 0
            ? <div className="p-8 rounded-2xl text-center" style={card}><p className="text-sm" style={{ color: labelColor }}>No duplicate datasets detected.</p></div>
            : duplicates.map((group, i) => (
              <div key={i} className="p-5 rounded-2xl" style={card}>
                <div className="flex items-center gap-2 mb-3">
                  <Copy size={14} style={{ color: '#ef4444' }} />
                  <span className="text-sm font-bold" style={{ color: '#ef4444' }}>{group.count} identical datasets</span>
                  <span className="text-xs font-mono ml-auto" style={{ color: labelColor }}>{group.compositeHash?.slice(0, 16)}…</span>
                </div>
                <div className="space-y-1.5">
                  {group.datasets.map((d, j) => (
                    <div key={j} className="flex items-center gap-3 text-xs p-2 rounded-lg"
                      style={{ background: dark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)' }}>
                      <span className="font-semibold" style={{ color: headingColor }}>{d.fileName}</span>
                      <span style={{ color: labelColor }}>{d.rowCount} rows</span>
                      <span className="ml-auto" style={{ color: labelColor }}>{new Date(d.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Compare */}
      {tab === 'compare' && (
        <div className="p-5 rounded-2xl space-y-4" style={card}>
          <div className="flex items-center gap-2 mb-1">
            <GitCompare size={15} style={{ color: '#6366f1' }} />
            <h3 className="text-sm font-bold" style={{ color: headingColor }}>Compare Two Datasets</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>Dataset A — Analysis ID</label>
              <select value={compareA} onChange={e => setCompareA(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {fingerprints.map(fp => <option key={fp.analysisId} value={fp.analysisId}>#{fp.analysisId} — {fp.fileName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>Dataset B — Analysis ID</label>
              <select value={compareB} onChange={e => setCompareB(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {fingerprints.map(fp => <option key={fp.analysisId} value={fp.analysisId}>#{fp.analysisId} — {fp.fileName}</option>)}
              </select>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCompare} disabled={comparing || !compareA || !compareB}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            {comparing ? 'Comparing…' : 'Compare Fingerprints'}
          </motion.button>

          {compareResult && !compareResult.error && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
              <div className="flex items-center gap-3 flex-wrap">
                <RelBadge rel={compareResult.relationship} />
                <span className="text-sm font-bold" style={{ color: '#6366f1' }}>{compareResult.similarity}% similar</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['File A', compareResult.fileNameA],
                  ['File B', compareResult.fileNameB],
                  ['Row Δ', `${compareResult.summary?.rowCountDelta > 0 ? '+' : ''}${compareResult.summary?.rowCountDelta}`],
                  ['Shared Cols', compareResult.summary?.sharedColumnCount],
                  ['Added Cols', compareResult.summary?.addedColumns?.join(', ') || '—'],
                  ['Removed Cols', compareResult.summary?.removedColumns?.join(', ') || '—'],
                ].map(([l, v]) => (
                  <div key={l} className="p-2.5 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <p style={{ color: labelColor }}>{l}</p>
                    <p className="font-semibold mt-0.5 truncate" style={{ color: headingColor }}>{v}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
