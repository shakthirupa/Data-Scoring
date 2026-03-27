import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Scatter
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldCheck, Zap, Activity, ChevronDown } from 'lucide-react';
import { useTheme } from './ThemeContext';
import api from './api';

// ── Risk level config ─────────────────────────────────────────────────────────
const RISK_CONFIG = {
  Low:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)', icon: ShieldCheck },
  Medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  icon: Minus },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)',  icon: AlertTriangle },
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',   icon: AlertTriangle },
};

const TREND_CONFIG = {
  improving: { icon: TrendingUp,   color: '#10b981', label: 'Improving' },
  stable:    { icon: Minus,        color: '#6366f1', label: 'Stable'    },
  degrading: { icon: TrendingDown, color: '#ef4444', label: 'Degrading' },
  volatile:  { icon: Activity,     color: '#f59e0b', label: 'Volatile'  },
};

// ── Merge historical + forecast into one chart series ────────────────────────
function buildChartData(historicalSeries, forecastSeries) {
  const hist = (historicalSeries || []).map(p => ({
    date: p.date, score: p.score, ema: p.ema,
    regression: p.regressionLine,
    anomaly: p.anomaly ? p.score : null,
    type: 'historical',
  }));

  // Bridge point: last historical becomes first forecast point
  const bridge = hist.length > 0 ? [{
    date: hist[hist.length - 1].date,
    predicted: hist[hist.length - 1].score,
    lower: hist[hist.length - 1].score,
    upper: hist[hist.length - 1].score,
    type: 'bridge',
  }] : [];

  const fore = (forecastSeries || []).map(p => ({
    date: p.date, predicted: p.predicted,
    lower: p.lower, upper: p.upper, type: 'forecast',
  }));

  return [...hist, ...bridge, ...fore];
}

// ── Risk gauge arc ────────────────────────────────────────────────────────────
function RiskGauge({ score, level }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.Low;
  const angle = (score / 100) * 180 - 90; // -90 to +90 degrees
  const r = 52, cx = 64, cy = 64;
  const toRad = d => (d * Math.PI) / 180;
  const arcX = cx + r * Math.cos(toRad(angle - 90));
  const arcY = cy + r * Math.sin(toRad(angle - 90));

  return (
    <svg width={128} height={80} viewBox="0 0 128 80">
      {/* Background arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} strokeLinecap="round" />
      {/* Colored arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${arcX} ${arcY}`}
        fill="none" stroke={cfg.color} strokeWidth={10} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${cfg.color}80)` }} />
      {/* Needle dot */}
      <circle cx={arcX} cy={arcY} r={5} fill={cfg.color} />
      {/* Score text */}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={18} fontWeight="bold" fill={cfg.color}>{score}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)">RISK SCORE</text>
    </svg>
  );
}

// ── Dimension trend bar ───────────────────────────────────────────────────────
function DimTrend({ label, slope, dark }) {
  const positive = slope >= 0;
  const color = slope > 0.3 ? '#10b981' : slope < -0.3 ? '#ef4444' : '#6366f1';
  const width = Math.min(100, Math.abs(slope) * 20);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-24 capitalize flex-shrink-0" style={{ color: dark ? '#9ca3af' : '#6b7280' }}>{label}</span>
      <div className="flex-1 flex items-center gap-1.5">
        <div className="flex-1 h-1.5 rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 0.8 }}
            className="h-1.5 rounded-full" style={{ background: color, marginLeft: positive ? 0 : 'auto' }} />
        </div>
        <span className="text-xs font-mono w-14 text-right" style={{ color }}>
          {positive ? '+' : ''}{slope.toFixed(3)}/pt
        </span>
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null;
  const bg = dark ? '#1f2937' : '#fff';
  const border = dark ? '#374151' : '#e5e7eb';
  const text = dark ? '#f9fafb' : '#111827';
  return (
    <div className="rounded-xl p-3 text-xs shadow-xl" style={{ background: bg, border: `1px solid ${border}`, color: text, minWidth: 140 }}>
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Group selector ────────────────────────────────────────────────────────────
function GroupSelector({ groups, selected, onSelect, dark }) {
  const [open, setOpen] = useState(false);
  const cfg = RISK_CONFIG;
  const inputBg = dark ? '#1f2937' : '#f3f4f6';
  const inputBorder = dark ? '1px solid #374151' : '1px solid #e5e7eb';

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
        style={{ background: inputBg, border: inputBorder, color: dark ? '#d1d5db' : '#374151' }}>
        <Activity size={14} style={{ color: '#6366f1' }} />
        {selected?.fileName || 'Select dataset'}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute top-full mt-1 right-0 z-20 rounded-xl overflow-hidden shadow-xl min-w-[220px]"
            style={{ background: dark ? '#0a0f1e' : '#fff', border: inputBorder }}>
            {groups.map(g => {
              const risk = g.riskLevel || 'Low';
              const rc = cfg[risk] || cfg.Low;
              return (
                <button key={g.fileGroup} onClick={() => { onSelect(g); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                  style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rc.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: dark ? '#f9fafb' : '#111827' }}>{g.fileName}</p>
                    <p className="text-xs" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>{g.snapshotCount} snapshots</p>
                  </div>
                  <span className="text-xs font-bold" style={{ color: rc.color }}>{g.latestScore?.toFixed(0)}%</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function PredictiveIntegrityIndex({ analysisId }) {
  const { dark } = useTheme();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const card = dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' };

  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';
  const tickColor = dark ? '#ffffff' : '#6b7280';
  const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Load groups on mount
  useEffect(() => {
    api.getIntegrityGroups()
      .then(data => {
        const gs = data.groups || [];
        setGroups(gs);
        if (gs.length > 0) setSelectedGroup(gs[0]);
      })
      .catch(() => setError('Could not load integrity groups'));
  }, []);

  // Load prediction when group changes or analysisId provided
  useEffect(() => {
    if (!selectedGroup && !analysisId) { setLoading(false); return; }
    setLoading(true); setError(null);
    const fetch = analysisId && !selectedGroup
      ? api.predictIntegrityByAnalysis(analysisId)
      : api.predictIntegrityGroup(selectedGroup.fileGroup);
    fetch
      .then(data => { setPrediction(data); setLoading(false); })
      .catch(() => { setError('Prediction failed'); setLoading(false); });
  }, [selectedGroup, analysisId]);

  const chartData = prediction ? buildChartData(prediction.historicalSeries, prediction.forecastSeries) : [];
  const riskCfg = prediction ? (RISK_CONFIG[prediction.riskLevel] || RISK_CONFIG.Low) : RISK_CONFIG.Low;
  const trendCfg = prediction ? (TREND_CONFIG[prediction.trend] || TREND_CONFIG.stable) : TREND_CONFIG.stable;
  const TrendIcon = trendCfg.icon;
  const RiskIcon = riskCfg.icon;

  if (loading) return (
    <div className="p-6 rounded-2xl flex items-center justify-center h-48" style={card}>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span className="text-sm" style={{ color: labelColor }}>Computing predictions…</span>
      </div>
    </div>
  );

  if (error || !prediction) return (
    <div className="p-6 rounded-2xl flex items-center justify-center h-48" style={card}>
      <p className="text-sm" style={{ color: labelColor }}>{error || 'No prediction data yet — upload more datasets to enable forecasting'}</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Activity size={17} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: headingColor }}>Predictive Integrity Index</h3>
            <p className="text-xs" style={{ color: labelColor }}>
              {prediction.snapshotCount} snapshots · {prediction.forecastSeries?.length || 0} steps forecast
            </p>
          </div>
        </div>
        {groups.length > 1 && (
          <GroupSelector groups={groups} selected={selectedGroup} onSelect={setSelectedGroup} dark={dark} />
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Future Risk', value: prediction.futureRiskScore, suffix: '', color: riskCfg.color, sub: prediction.riskLevel },
          { label: 'Predicted Score', value: prediction.predictedScore?.toFixed(1), suffix: '%', color: '#6366f1', sub: `in ${prediction.forecastSeries?.length || 0} steps` },
          { label: 'Confidence', value: prediction.confidenceScore, suffix: '%', color: '#10b981', sub: `R² ${prediction.r2}` },
          { label: 'Volatility', value: prediction.volatility?.toFixed(1), suffix: 'σ', color: '#f59e0b', sub: `${prediction.anomalyCount} anomalies` },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }} className="p-4" style={card}>
            <p className="text-xs mb-1" style={{ color: labelColor }}>{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}{kpi.suffix}</p>
            <p className="text-xs mt-0.5" style={{ color: labelColor }}>{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Main chart */}
      <div className="p-5 rounded-2xl" style={card}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: headingColor }}>Historical + Forecast</p>
            <p className="text-xs" style={{ color: labelColor }}>Solid = actual · Dashed = predicted · Band = confidence interval</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: riskCfg.bg, border: `1px solid ${riskCfg.border}` }}>
            <RiskIcon size={13} style={{ color: riskCfg.color }} />
            <span className="text-xs font-bold" style={{ color: riskCfg.color }}>{prediction.riskLevel} Risk</span>
            <TrendIcon size={13} style={{ color: trendCfg.color }} />
            <span className="text-xs font-semibold" style={{ color: trendCfg.color }}>{trendCfg.label}</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={d => d?.slice(5)} />
            <YAxis domain={[0, 100]} tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip dark={dark} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: labelColor }} />

            {/* Confidence band */}
            <Area dataKey="upper" fill={riskCfg.color} fillOpacity={0.06} stroke="none" name="Upper bound" legendType="none" />
            <Area dataKey="lower" fill={dark ? '#0a0f1e' : '#fff'} fillOpacity={1} stroke="none" name="Lower bound" legendType="none" />

            {/* Regression line */}
            <Line dataKey="regression" stroke="rgba(99,102,241,0.35)" strokeWidth={1}
              strokeDasharray="4 4" dot={false} name="Regression" />

            {/* EMA */}
            <Line dataKey="ema" stroke="#6366f1" strokeWidth={1.5}
              dot={false} name="EMA" strokeDasharray="2 2" />

            {/* Actual score */}
            <Line dataKey="score" stroke="#3b82f6" strokeWidth={2.5}
              dot={false} name="Actual Score" connectNulls={false} />

            {/* Forecast */}
            <Line dataKey="predicted" stroke={riskCfg.color} strokeWidth={2}
              strokeDasharray="6 3" dot={{ r: 3, fill: riskCfg.color }} name="Forecast" connectNulls />

            {/* Anomaly markers */}
            <Scatter dataKey="anomaly" fill="#ef4444" name="Anomaly"
              shape={({ cx, cy }) => cy ? (
                <g key={`${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r={5} fill="#ef4444" fillOpacity={0.8} />
                  <circle cx={cx} cy={cy} r={9} fill="none" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.4} />
                </g>
              ) : null} />

            {/* Reference line at current score */}
            <ReferenceLine y={prediction.currentScore} stroke={dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}
              strokeDasharray="3 3" label={{ value: 'Now', fill: labelColor, fontSize: 10 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: risk gauge + dimension trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Risk gauge + summary */}
        <div className="p-5 rounded-2xl" style={card}>
          <p className="text-sm font-semibold mb-4" style={{ color: headingColor }}>Risk Assessment</p>
          <div className="flex items-center gap-6">
            <RiskGauge score={prediction.futureRiskScore} level={prediction.riskLevel} />
            <div className="space-y-2.5 flex-1">
              {[
                { label: 'Trend slope', value: `${prediction.trendSlope > 0 ? '+' : ''}${prediction.trendSlope}/pt`, color: prediction.trendSlope >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Momentum', value: `${prediction.momentum > 0 ? '+' : ''}${prediction.momentum?.toFixed(2)}`, color: prediction.momentum >= 0 ? '#10b981' : '#f59e0b' },
                { label: 'Anomaly rate', value: `${(prediction.anomalyRate * 100).toFixed(1)}%`, color: prediction.anomalyRate > 0.2 ? '#ef4444' : '#10b981' },
                { label: 'Data points', value: prediction.snapshotCount, color: labelColor },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span style={{ color: labelColor }}>{item.label}</span>
                  <span className="font-semibold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dimension trends */}
        <div className="p-5 rounded-2xl" style={card}>
          <p className="text-sm font-semibold mb-4" style={{ color: headingColor }}>Dimension Trends</p>
          <div className="space-y-3">
            {Object.entries(prediction.dimTrends || {}).map(([dim, slope]) => (
              <DimTrend key={dim} label={dim} slope={slope} dark={dark} />
            ))}
          </div>
          <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
            <Zap size={13} style={{ color: '#6366f1' }} />
            <p className="text-xs" style={{ color: labelColor }}>
              Slope = score change per snapshot. Positive = improving.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default PredictiveIntegrityIndex;
