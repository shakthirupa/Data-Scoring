import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, AlertTriangle, Info, ShieldAlert, CheckCircle, Filter, FileText } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

const SEV = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)',  icon: AlertOctagon },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', icon: ShieldAlert  },
  Medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: AlertTriangle },
  Low:      { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', icon: Info         },
};

function SevCard({ label, count, dark }) {
  const cfg = SEV[label] || SEV.Low;
  const Icon = cfg.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl flex items-center gap-4"
      style={{ background: dark ? '#0a0f1e' : 'rgba(255,255,255,0.9)', border: `1px solid ${cfg.border}`, boxShadow: `0 2px 12px ${cfg.bg}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <Icon size={18} style={{ color: cfg.color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
        <p className="text-xs font-medium" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>{label}</p>
      </div>
    </motion.div>
  );
}

function IssueRow({ issue, onResolve, dark, index }) {
  const cfg = SEV[issue.severity] || SEV.Low;
  const Icon = cfg.icon;

  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-start gap-4 p-4 rounded-2xl"
      style={{ background: dark ? '#0a0f1e' : 'rgba(255,255,255,0.9)', border: `1px solid ${cfg.border}` }}>

      {/* Severity icon */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.bg }}>
        <Icon size={16} style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}>{issue.severity}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: dark ? '#d1d5db' : '#374151' }}>
            {issue.issueType}
          </span>
          {issue.column && issue.column !== 'all' && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
              {issue.column}
            </span>
          )}
        </div>
        <p className="text-sm mb-1.5" style={{ color: dark ? '#e5e7eb' : '#111827' }}>{issue.description}</p>
        <div className="flex items-center gap-3 text-xs" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>
          <span className="flex items-center gap-1">
            <FileText size={11} />{issue.fileName}
          </span>
          {issue.affectedRows != null && (
            <span style={{ color: cfg.color }}>{issue.affectedRows.toLocaleString()} rows affected</span>
          )}
        </div>
      </div>

      {/* Resolve button */}
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => onResolve(issue.id)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 transition-all"
        style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
        <CheckCircle size={12} />Resolve
      </motion.button>
    </motion.div>
  );
}

export default function Issues() {
  const { dark } = useTheme();
  const [issues, setIssues] = useState([]);
  const [counts, setCounts] = useState({ Critical: 0, High: 0, Medium: 0, Low: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const headingColor = dark ? '#f9fafb' : '#111827';
  const labelColor  = dark ? '#9ca3af' : '#6b7280';

  const load = () => {
    setLoading(true);
    api.getIssuesSummary().then(data => {
      const b = data.bySeverity || {};
      setCounts({
        Critical: b.critical ?? 0,
        High:     b.high     ?? 0,
        Medium:   b.medium   ?? 0,
        Low:      b.low      ?? 0,
      });
      setIssues(data.issues || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleResolve = (id) => {
    api.resolveIssue(id).then(() => {
      setIssues(prev => {
        const removed = prev.find(i => i.id === id);
        if (removed) setCounts(c => ({ ...c, [removed.severity]: Math.max(0, c[removed.severity] - 1) }));
        return prev.filter(i => i.id !== id);
      });
    });
  };

  const filtered = filter === 'All' ? issues : issues.filter(i => i.severity === filter);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Data Quality Issues</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>
          {total} unresolved issue{total !== 1 ? 's' : ''} across all datasets
        </p>
      </div>

      {/* Severity cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {['Critical', 'High', 'Medium', 'Low'].map((sev, i) => (
          <motion.div key={sev} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <SevCard label={sev} count={counts[sev]} dark={dark} />
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
        {['All', 'Critical', 'High', 'Medium', 'Low'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={filter === f
              ? { background: dark ? '#1f2937' : '#fff', color: f === 'All' ? '#6366f1' : (SEV[f]?.color || '#6366f1'), boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { color: labelColor }}>
            {f}
            {f !== 'All' && counts[f] > 0 && (
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${SEV[f]?.color}20`, color: SEV[f]?.color }}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-2 pl-2" style={{ borderLeft: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
          <Filter size={11} style={{ color: labelColor }} />
          <span className="text-xs" style={{ color: labelColor }}>{filtered.length} shown</span>
        </div>
      </div>

      {/* Issue list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-sm" style={{ color: labelColor }}>Loading issues…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={36} style={{ color: '#10b981', opacity: 0.5 }} />
          <p className="text-sm font-medium" style={{ color: labelColor }}>
            {filter === 'All' ? 'No unresolved issues — great job! 🎉' : `No ${filter} issues`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((issue, i) => (
              <IssueRow key={issue.id} issue={issue} onResolve={handleResolve} dark={dark} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
