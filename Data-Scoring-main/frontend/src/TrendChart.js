import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from './ThemeContext';

function TrendChart({ data }) {
  const { dark } = useTheme();
  const cardBg = dark ? '#0a0f1e' : 'rgba(255,255,255,0.85)';
  const cardBorder = dark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)';
  const cardShadow = dark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.06)';
  const titleColor = dark ? '#f9fafb' : '#111827';
  const tickColor = dark ? '#ffffff' : '#6b7280';
  const gridColor = dark ? '#ffffff' : '#6b7280';

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
      className="p-5 rounded-2xl" style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }}>
      <h3 className="text-base font-semibold mb-4" style={{ color: titleColor }}>Quality Trends</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 10, color: dark ? '#f9fafb' : '#111827', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: tickColor }} />
          <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={false} name="Overall Score" />
          <Line type="monotone" dataKey="completeness" stroke="#22c55e" strokeWidth={2} dot={false} name="Completeness" />
          <Line type="monotone" dataKey="uniqueness" stroke="#f97316" strokeWidth={2} dot={false} name="Uniqueness" />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export default TrendChart;
