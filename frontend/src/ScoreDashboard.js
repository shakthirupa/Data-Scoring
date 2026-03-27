import React from 'react';
import { motion } from 'framer-motion';
import RadarChartComponent from './RadarChartComponent';
import CircularProgress from './CircularProgress';
import AIInsights from './AIInsights';
import { ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTheme } from './ThemeContext';

const scoreColor = (v) => {
  if (v >= 80) return { bar: '#10b981', text: '#10b981' };
  if (v >= 60) return { bar: '#f59e0b', text: '#f59e0b' };
  return { bar: '#ef4444', text: '#ef4444' };
};

const gradeInfo = (v) => {
  if (v >= 90) return { grade: 'A', label: 'Excellent',  icon: ShieldCheck,   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' };
  if (v >= 75) return { grade: 'B', label: 'Good',       icon: TrendingUp,    color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)' };
  if (v >= 60) return { grade: 'C', label: 'Fair',       icon: TrendingUp,    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)' };
  return               { grade: 'D', label: 'Poor',       icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)' };
};

function ScoreDashboard({ scores }) {
  const { dark } = useTheme();
  if (!scores) return null;

  const card = dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }
    : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' };

  const trackBg = dark ? '#334155' : 'rgba(0,0,0,0.06)';
  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';

  const radarData = [
    { dimension: 'Completeness', value: scores.completeness },
    { dimension: 'Uniqueness',   value: scores.uniqueness },
    { dimension: 'Validity',     value: scores.validity },
    { dimension: 'Consistency',  value: scores.consistency },
  ];

  const dims = ['completeness', 'uniqueness', 'validity', 'consistency'];
  const { grade, label, icon: GradeIcon, color, bg, border } = gradeInfo(scores.overallScore);

  return (
    <div className="space-y-4">

      {/* Overall + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 flex flex-col" style={card}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: labelColor }}>Overall Quality Score</p>
          <div className="flex items-center gap-6 flex-1">
            <CircularProgress score={scores.overallScore} />
            <div className="flex flex-col gap-4 flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <GradeIcon size={14} style={{ color }} />
                <span className="text-sm font-bold" style={{ color }}>Grade {grade}</span>
                <span className="text-xs" style={{ color, opacity: 0.75 }}>— {label}</span>
              </div>
              <div className="space-y-2.5">
                {dims.map(key => {
                  const { bar } = scoreColor(scores[key]);
                  return (
                    <div key={key}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs capitalize" style={{ color: labelColor }}>{key}</span>
                        <span className="text-xs font-bold" style={{ color: bar }}>{scores[key]}%</span>
                      </div>
                      <div className="w-full rounded-full h-1.5" style={{ background: trackBg }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${scores[key]}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className="h-1.5 rounded-full" style={{ background: bar, boxShadow: dark ? `0 0 8px ${bar}60` : 'none' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <RadarChartComponent data={radarData} />
        </motion.div>
      </div>

      {/* Dimension cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {dims.map((key, i) => {
          const val = scores[key];
          const { bar, text } = scoreColor(val);
          const status = val >= 80 ? 'Good' : val >= 60 ? 'Fair' : 'Low';
          return (
            <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }} className="p-5" style={card}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider capitalize" style={{ color: labelColor }}>{key}</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${bar}18`, color: text }}>{status}</span>
              </div>
              <p className="text-3xl font-bold mb-3" style={{ color: text }}>{val}%</p>
              <div className="w-full rounded-full h-1.5" style={{ background: trackBg }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }}
                  transition={{ duration: 1, delay: 0.4 + i * 0.08, ease: 'easeOut' }}
                  className="h-1.5 rounded-full"
                  style={{ background: bar, boxShadow: dark ? `0 0 10px ${bar}70` : 'none' }} />
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <AIInsights scores={scores} />
      </motion.div>
    </div>
  );
}

export default ScoreDashboard;
