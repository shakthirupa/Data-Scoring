import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronRight, Clock, Layers, BarChart2, FileSearch } from 'lucide-react';
import { useTheme } from './ThemeContext';
import api from './api';

// ── Config ────────────────────────────────────────────────────────────────────

const SEV = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: AlertOctagon },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: AlertTriangle },
  Medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
  Low:      { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', icon: Info },
};

const PHASE_COLOR = {
  'Data Ingestion':       '#3b82f6',
  'Data Validation':      '#f59e0b',
  'Data Deduplication':   '#ef4444',
  'Statistical Integrity':'#8b5cf6',
  'Logical Consistency':  '#f97316',
};

// ── Small reusable pieces ─────────────────────────────────────────────────────

function SevBadge({ severity }) {
  const cfg = SEV[severity] || SEV.Low;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} />{severity}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, count, color = '#6366f1' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
        <Icon size={15} style={{ color }} />
      </div>
      <h3 className="text-sm font-bold" style={{ color: 'inherit' }}>{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${color}15`, color }}>{count}</span>
      )}
    </div>
  );
}

// ── Event chain step ──────────────────────────────────────────────────────────

function ChainStep({ step, isLast, dark }) {
  const [open, setOpen] = useState(false);
  const color = PHASE_COLOR[step.phase] || '#6366f1';
  const sevCfg = SEV[step.severity] || SEV.Low;

  return (
    <div className="flex gap-3">
      {/* Connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white z-10"
          style={{ background: color, boxShadow: `0 0 12px ${color}50` }}>
          {step.step}
        </div>
        {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: `${color}30`, minHeight: 24 }} />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <button onClick={() => setOpen(o => !o)} className="w-full text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
              style={{ background: `${color}15`, color }}>{step.phase}</span>
            <SevBadge severity={step.severity} />
            <span className="ml-auto">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
          </div>
          <p className="text-sm font-medium mt-1" style={{ color: dark ? '#e5e7eb' : '#111827' }}>{step.event}</p>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <p className="text-xs leading-relaxed mt-2 p-3 rounded-xl"
                style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', color: dark ? '#9ca3af' : '#6b7280', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                {step.explanation}
              </p>
              {step.affectedColumns?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {step.affectedColumns.slice(0, 6).map(c => (
                    <span key={c} className="text-xs px-2 py-0.5 rounded-md font-mono"
                      style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}>{c}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Timeline row ──────────────────────────────────────────────────────────────

function TimelineRow({ entry, dark }) {
  const [open, setOpen] = useState(false);
  const topSev = entry.events.reduce((top, e) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return (order[e.severity] ?? 9) < (order[top] ?? 9) ? e.severity : top;
  }, 'Low');
  const cfg = SEV[topSev] || SEV.Low;

  return (
    <div className="border-b last:border-0" style={{ borderColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <span className="text-xs font-mono w-16 flex-shrink-0" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>Row {entry.rowIndex}</span>
        <SevBadge severity={topSev} />
        <span className="text-xs flex-1 truncate" style={{ color: dark ? '#d1d5db' : '#374151' }}>
          {entry.events[0]?.description}
          {entry.events.length > 1 && <span style={{ color: cfg.color }}> +{entry.events.length - 1} more</span>}
        </span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-4 pb-3 space-y-2">
            {entry.events.map((e, i) => (
              <div key={i} className="p-2.5 rounded-xl text-xs"
                style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${(SEV[e.severity] || SEV.Low).color}20` }}>
                <div className="flex items-center gap-2 mb-1">
                  <SevBadge severity={e.severity} />
                  {e.column && <span className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{e.column}</span>}
                </div>
                <p style={{ color: dark ? '#d1d5db' : '#374151' }}>{e.description}</p>
                {e.rootCause && <p className="mt-1 italic" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>↳ {e.rootCause}</p>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Column profile card ───────────────────────────────────────────────────────

function ColumnCard({ profile, dark, card }) {
  const [open, setOpen] = useState(false);
  const hasIssues = profile.patternIssues?.length > 0 || profile.outlierCount > 0 || profile.nullPct > 20;
  const issueColor = profile.nullPct > 50 ? '#ef4444' : profile.nullPct > 20 ? '#f97316' : '#10b981';

  return (
    <div className="rounded-xl overflow-hidden" style={{ ...card, padding: 0 }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold font-mono truncate" style={{ color: dark ? '#f9fafb' : '#111827' }}>{profile.column}</span>
            <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{profile.type}</span>
            {hasIssues && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: issueColor }} />}
          </div>
          <div className="flex gap-3 mt-1 text-xs" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>
            <span>{profile.nullPct}% null</span>
            <span>{profile.uniquenessRatio}% unique</span>
            {profile.outlierCount > 0 && <span style={{ color: '#f59e0b' }}>{profile.outlierCount} outliers</span>}
          </div>
        </div>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-4 pb-4 space-y-3">

            {/* Null bar */}
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>
                <span>Null rate</span><span style={{ color: issueColor }}>{profile.nullPct}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${profile.nullPct}%` }} transition={{ duration: 0.6 }}
                  className="h-1.5 rounded-full" style={{ background: issueColor }} />
              </div>
            </div>

            {/* Numeric stats */}
            {profile.stats?.mean !== undefined && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[['Mean', profile.stats.mean], ['Std Dev', profile.stats.stddev], ['Median', profile.stats.median],
                  ['Min', profile.stats.min], ['Max', profile.stats.max], ['IQR', profile.stats.iqr]].map(([l, v]) => (
                  <div key={l} className="p-2 rounded-lg text-center" style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                    <p style={{ color: dark ? '#6b7280' : '#9ca3af' }}>{l}</p>
                    <p className="font-semibold font-mono" style={{ color: dark ? '#e5e7eb' : '#374151' }}>{v}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Top values */}
            {profile.top?.length > 0 && (
              <div>
                <p className="text-xs mb-1.5" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>Top values</p>
                <div className="space-y-1">
                  {profile.top.slice(0, 4).map(({ value, count }) => (
                    <div key={value} className="flex items-center gap-2 text-xs">
                      <span className="font-mono truncate flex-1" style={{ color: dark ? '#d1d5db' : '#374151' }}>{value || '(empty)'}</span>
                      <span style={{ color: dark ? '#6b7280' : '#9ca3af' }}>{count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pattern issues */}
            {profile.patternIssues?.map((pi, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertTriangle size={11} style={{ color: '#f59e0b' }} />
                <span style={{ color: '#f59e0b' }}>{pi.pattern.replace(/_/g, ' ')} — {pi.count} occurrence{pi.count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DataForensics({ analysisId }) {
  const { dark } = useTheme();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('summary');
  const [search, setSearch] = useState('');

  const card = dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };

  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';

  useEffect(() => {
    if (!analysisId) { setLoading(false); return; }
    api.getForensicsReport(analysisId)
      .then(data => { setReport(data); setLoading(false); })
      .catch(() => { setError('Failed to load forensics report'); setLoading(false); });
  }, [analysisId]);

  if (loading) return (
    <div className="p-8 rounded-2xl flex items-center justify-center" style={card}>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span className="text-sm" style={{ color: labelColor }}>Running forensic analysis…</span>
      </div>
    </div>
  );

  if (error || !report) return (
    <div className="p-8 rounded-2xl flex items-center justify-center" style={card}>
      <p className="text-sm" style={{ color: labelColor }}>{error || 'No forensics data available'}</p>
    </div>
  );

  const filteredTimeline = (report.timeline || []).filter(entry =>
    !search || entry.events.some(e =>
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.column?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const TABS = [
    { id: 'summary',  label: 'Summary',   icon: FileSearch },
    { id: 'chain',    label: 'Event Chain', icon: Layers },
    { id: 'timeline', label: 'Timeline',  icon: Clock, count: report.timeline?.length },
    { id: 'columns',  label: 'Columns',   icon: BarChart2, count: report.columnProfiles?.length },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <FileSearch size={17} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: headingColor }}>Data Forensics</h3>
          <p className="text-xs" style={{ color: labelColor }}>{report.fileName} · {report.rowCount?.toLocaleString()} rows</p>
        </div>
        {/* Severity pills */}
        <div className="ml-auto flex gap-2 flex-wrap">
          {Object.entries(report.severityBreakdown || {}).filter(([, v]) => v > 0).map(([sev, count]) => (
            <span key={sev} className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: (SEV[sev] || SEV.Low).bg, color: (SEV[sev] || SEV.Low).color }}>
              {count} {sev}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center"
              style={tab === t.id
                ? { background: dark ? '#1f2937' : '#fff', color: '#6366f1', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                : { color: labelColor }}>
              <Icon size={12} />{t.label}
              {t.count !== undefined && <span className="ml-0.5 opacity-60">({t.count})</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

          {/* ── Summary ── */}
          {tab === 'summary' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl" style={card}>
                <SectionHeader icon={FileSearch} title="Forensic Summary" color="#ef4444" />
                <p className="text-sm leading-relaxed" style={{ color: dark ? '#d1d5db' : '#374151' }}>{report.summary}</p>
              </div>

              {/* Top issues */}
              {report.topIssues?.length > 0 && (
                <div className="p-5 rounded-2xl" style={card}>
                  <SectionHeader icon={AlertTriangle} title="Most Frequent Issues" count={report.topIssues.length} color="#f97316" />
                  <div className="space-y-2">
                    {report.topIssues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                        <span className="text-xs font-mono w-6 text-center font-bold" style={{ color: '#6366f1' }}>#{i + 1}</span>
                        <div className="flex-1">
                          <span className="text-xs font-semibold" style={{ color: dark ? '#e5e7eb' : '#374151' }}>
                            {issue.type.replace(/_/g, ' ')}
                          </span>
                          {issue.column && issue.column !== 'row' && (
                            <span className="ml-2 text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{issue.column}</span>
                          )}
                        </div>
                        <span className="text-xs font-bold" style={{ color: '#f97316' }}>{issue.count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Event Chain ── */}
          {tab === 'chain' && (
            <div className="p-5 rounded-2xl" style={card}>
              <SectionHeader icon={Layers} title="Root Cause Event Chain" count={report.eventChain?.length} color="#6366f1" />
              {report.eventChain?.length > 0 ? (
                <div className="mt-2">
                  {report.eventChain.map((step, i) => (
                    <ChainStep key={i} step={step} isLast={i === report.eventChain.length - 1} dark={dark} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: labelColor }}>No significant event chain detected — dataset appears clean.</p>
              )}
            </div>
          )}

          {/* ── Timeline ── */}
          {tab === 'timeline' && (
            <div className="rounded-2xl overflow-hidden" style={card}>
              <div className="p-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <SectionHeader icon={Clock} title="Anomaly Timeline" count={report.timeline?.length} color="#3b82f6" />
                <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                  <Search size={12} style={{ color: labelColor }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search rows or columns…"
                    className="bg-transparent outline-none text-xs w-40"
                    style={{ color: dark ? '#d1d5db' : '#374151' }} />
                </div>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {filteredTimeline.length > 0
                  ? filteredTimeline.map((entry, i) => <TimelineRow key={i} entry={entry} dark={dark} />)
                  : <p className="text-sm text-center py-10" style={{ color: labelColor }}>No anomalies found{search ? ' matching your search' : ''}.</p>
                }
              </div>
            </div>
          )}

          {/* ── Columns ── */}
          {tab === 'columns' && (
            <div className="space-y-3">
              {(report.columnProfiles || []).map((profile, i) => (
                <motion.div key={profile.column} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <ColumnCard profile={profile} dark={dark} card={card} />
                </motion.div>
              ))}
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
