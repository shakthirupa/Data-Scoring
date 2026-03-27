import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';
import PredictiveIntegrityIndex from '../PredictiveIntegrityIndex';

export default function PredictivePage() {
  const { dark } = useTheme();
  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Predictive Integrity Index</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>Trend analysis, anomaly forecasting, and future risk scoring for your datasets</p>
      </div>
      <PredictiveIntegrityIndex />
    </motion.div>
  );
}
