import React from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useTheme } from './ThemeContext';

function RecentActivity({ activities }) {
  const { dark } = useTheme();
  const cardBg = dark ? '#0a0f1e' : 'rgba(255,255,255,0.85)';
  const cardBorder = dark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)';
  const cardShadow = dark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.06)';
  const titleColor = dark ? '#f9fafb' : '#111827';
  const nameColor = dark ? '#e5e7eb' : '#111827';
  const dateColor = dark ? '#6b7280' : '#9ca3af';
  const itemBg = dark ? '#0f172a' : '#f9fafb';

  const scoreColor = (s) => s >= 80 ? '#22c55e' : s >= 60 ? '#f97316' : '#ef4444';

  return (
    <div className="p-5 rounded-2xl" style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }}>
      <h3 className="text-base font-semibold mb-4" style={{ color: titleColor }}>Recent Activity</h3>
      <div className="space-y-2">
        {activities.map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: itemBg }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <FileText size={14} style={{ color: '#6366f1' }} />
              </div>
              <div>
                <p className="text-sm font-medium truncate max-w-[130px]" style={{ color: nameColor }}>{a.fileName}</p>
                <p className="text-xs" style={{ color: dateColor }}>{a.date}</p>
              </div>
            </div>
            <span className="text-base font-bold" style={{ color: scoreColor(a.score) }}>{a.score}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default RecentActivity;
