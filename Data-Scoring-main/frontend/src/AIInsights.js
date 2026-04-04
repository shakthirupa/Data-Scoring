import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import { useTheme } from './ThemeContext';

function AIInsights({ scores }) {
  const { dark } = useTheme();
  if (!scores) return null;

  const insights = [];
  if (scores.completeness < 80)  insights.push({ text: 'Completeness is below 80%. Check for missing or null values in your dataset.', color: '#ef4444' });
  if (scores.uniqueness < 75)    insights.push({ text: 'Uniqueness score is below 75%. Consider removing duplicate records.', color: '#f59e0b' });
  if (scores.validity < 85)      insights.push({ text: 'Validity needs improvement. Review email formats, date formats, and data types.', color: '#f59e0b' });
  if (scores.consistency < 80)   insights.push({ text: 'Consistency is low. Standardize data formats across all columns.', color: '#f59e0b' });
  if (scores.overallScore >= 90) insights.push({ text: 'Excellent data quality! Your dataset meets high standards across all dimensions.', color: '#10b981' });
  else if (scores.overallScore >= 80) insights.push({ text: 'Overall data quality is good. Focus on improving lower-scoring dimensions.', color: '#10b981' });
  if (insights.length === 0)     insights.push({ text: 'Data quality looks acceptable. Continue monitoring for regressions.', color: '#6366f1' });

  const cardBg = dark
    ? 'linear-gradient(135deg, #0d1a2e 0%, #111827 100%)'
    : 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)';
  const cardBorder = dark ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(99,102,241,0.15)';
  const headingColor = dark ? '#f9fafb' : '#111827';
  const dotBg = dark ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.1)';
  const dotBorder = dark ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.2)';
  const dotIcon = dark ? '#10b981' : '#6366f1';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl" style={{ background: cardBg, border: cardBorder }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: dotBg, border: `1px solid ${dotBorder}` }}>
          <Bot size={17} style={{ color: dotIcon }} />
        </div>
        <div>
          <h3 className="text-base font-semibold" style={{ color: headingColor }}>AI Insights</h3>
          <p className="text-xs" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>Powered by data analysis</p>
        </div>
        <div className="ml-auto">
          <Sparkles size={14} style={{ color: dark ? '#10b981' : '#6366f1', opacity: 0.6 }} />
        </div>
      </div>
      <ul className="space-y-2.5">
        {insights.map((insight, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)', border: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.04)' }}>
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: insight.color, boxShadow: dark ? `0 0 6px ${insight.color}` : 'none' }} />
            <span className="text-sm leading-relaxed" style={{ color: dark ? '#d1d5db' : '#374151' }}>{insight.text}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

export default AIInsights;
