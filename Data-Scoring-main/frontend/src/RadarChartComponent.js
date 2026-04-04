import React from 'react';
import { motion } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { useTheme } from './ThemeContext';

function RadarChartComponent({ data }) {
  const { dark } = useTheme();
  return (
    <div className="p-6 rounded-2xl h-full"
      style={{ background: dark ? '#0a0f1e' : 'rgba(255,255,255,0.85)', border: dark ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(255,255,255,0.9)', boxShadow: dark ? '0 0 16px rgba(16,185,129,0.15), 0 4px 24px rgba(0,0,0,0.5)' : undefined }}>
      <h3 className="text-base font-semibold mb-4" style={{ color: dark ? '#f9fafb' : '#111827' }}>Quality Overview</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke={dark ? '#ffffff' : '#6b7280'} />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: dark ? '#ffffff' : '#6b7280', fontSize: 12 }} />
          <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={dark ? 0.25 : 0.15} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RadarChartComponent;
