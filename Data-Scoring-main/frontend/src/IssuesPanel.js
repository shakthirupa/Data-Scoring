import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, AlertOctagon, AlertTriangle, Info, Copy, XCircle, Minus, FileSpreadsheet } from 'lucide-react';
import { useTheme } from './ThemeContext';

const severityConfig = {
  Critical: { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', icon: AlertOctagon },
  High:     { bg: 'rgba(249,115,22,0.12)', text: '#f97316', icon: ShieldAlert },
  Medium:   { bg: 'rgba(234,179,8,0.12)',  text: '#ca8a04', icon: AlertTriangle },
  Low:      { bg: 'rgba(99,102,241,0.12)', text: '#6366f1', icon: Info },
};

const typeIcon = (type) => ({ Missing: Minus, Duplicate: Copy, Invalid: XCircle, Inconsistent: AlertTriangle }[type] || Info);

function IssuesPanel({ issues }) {
  const { dark } = useTheme();
  if (!issues || issues.length === 0) return null;

  const cardBg = dark ? '#0a0f1e' : 'rgba(255,255,255,0.85)';
  const cardBorder = dark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)';
  const cardShadow = dark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.06)';
  const titleColor = dark ? '#f9fafb' : '#111827';
  const itemBorder = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';
  const itemHover = dark ? 'rgba(255,255,255,0.04)' : '#f9fafb';
  const nameColor = dark ? '#e5e7eb' : '#111827';
  const metaColor = dark ? '#6b7280' : '#9ca3af';

  return (
    <div className="p-5 rounded-2xl" style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)' }}>
          <ShieldAlert size={14} style={{ color: '#f97316' }} />
        </div>
        <h3 className="text-base font-semibold" style={{ color: titleColor }}>Recent Issues</h3>
      </div>
      <div className="space-y-2">
        {issues.map((item, i) => {
          const sev = severityConfig[item.topSeverity || item.severity] || severityConfig.Low;
          const SevIcon = sev.icon;
          const pctColor = (item.problemRowPct || 0) > 30 ? '#ef4444' : (item.problemRowPct || 0) > 10 ? '#f97316' : '#ca8a04';
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 p-3 rounded-xl transition-colors"
              style={{ border: `1px solid ${itemBorder}` }}
              onMouseEnter={e => e.currentTarget.style.background = itemHover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <FileSpreadsheet size={14} style={{ color: '#6366f1' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: nameColor }}>
                  {item.fileName || item.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {item.problemRowPct !== undefined && (
                    <span className="text-xs font-medium" style={{ color: pctColor }}>
                      {item.problemRows}/{item.rowCount} rows ({item.problemRowPct}%)
                    </span>
                  )}
                  {(item.types || []).map(type => {
                    const TypeIcon = typeIcon(type);
                    return (
                      <span key={type} className="inline-flex items-center gap-1 text-xs" style={{ color: metaColor }}>
                        <TypeIcon size={10} />{type}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0" style={{ background: sev.bg }}>
                <SevIcon size={11} style={{ color: sev.text }} />
                <span className="text-xs font-semibold" style={{ color: sev.text }}>{item.topSeverity || item.severity}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default IssuesPanel;
