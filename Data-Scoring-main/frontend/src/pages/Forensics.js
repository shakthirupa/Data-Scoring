import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';
import DataForensics from '../DataForensics';
import api from '../api';

export default function ForensicsPage() {
  const { dark } = useTheme();
  const [analyses, setAnalyses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';
  const inputStyle = { background: dark ? '#1f2937' : '#f3f4f6', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, color: dark ? '#d1d5db' : '#374151', borderRadius: '10px', padding: '8px 12px', fontSize: 13, outline: 'none' };

  useEffect(() => {
    api.getHistory().then(data => {
      const list = Array.isArray(data) ? data : [];
      setAnalyses(list);
      if (list.length > 0) setSelectedId(list[0].id);
    }).catch(() => {});
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Data Forensics</h2>
          <p className="text-sm mt-0.5" style={{ color: labelColor }}>Deep-dive anomaly analysis, root cause chains, and column profiling</p>
        </div>
        {analyses.length > 0 && (
          <select value={selectedId || ''} onChange={e => setSelectedId(Number(e.target.value))} style={inputStyle}>
            {analyses.map(a => (
              <option key={a.id} value={a.id}>{a.fileName} — {new Date(a.createdAt).toLocaleDateString()}</option>
            ))}
          </select>
        )}
      </div>
      {selectedId
        ? <DataForensics analysisId={selectedId} />
        : <p className="text-sm text-center py-16" style={{ color: labelColor }}>Upload a dataset to run forensic analysis.</p>
      }
    </motion.div>
  );
}
