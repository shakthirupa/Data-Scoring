import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { useTheme } from './ThemeContext';
import api from './api';

const priorityStyle = {
  High:   { text: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)' },
  Medium: { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  Low:    { text: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
};

function RecommendationSection({ analysisId }) {
  const { dark } = useTheme();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!analysisId) return;
    setLoading(true);
    api.generateRecommendations(analysisId)
      .then(data => { setRecommendations(data.recommendations || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [analysisId]);

  const cardBg = dark ? '#0a0f1e' : 'rgba(255,255,255,0.85)';
  const cardBorder = dark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)';
  const cardShadow = dark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.06)';
  const headingColor = dark ? '#f9fafb' : '#111827';
  const itemBg = dark ? 'rgba(255,255,255,0.03)' : undefined;
  const recText = dark ? '#d1d5db' : '#374151';
  const catText = dark ? '#6b7280' : '#9ca3af';

  return (
    <div className="p-5 rounded-2xl" style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <Lightbulb size={15} style={{ color: '#6366f1' }} />
        </div>
        <h3 className="text-base font-semibold" style={{ color: headingColor }}>Recommendations</h3>
      </div>
      {loading ? (
        <p className="text-center py-6 text-sm" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>Generating recommendations...</p>
      ) : (
        <ul className="space-y-2.5">
          {recommendations.map((rec, i) => {
            const s = priorityStyle[rec.priority] || priorityStyle.Low;
            return (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: itemBg || s.bg, border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : s.border}` }}>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                  {rec.priority}
                </span>
                <div>
                  <p className="text-sm font-medium" style={{ color: recText }}>{rec.type}</p>
                  {rec.category && <p className="text-xs mt-0.5" style={{ color: catText }}>{rec.category}</p>}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default RecommendationSection;
