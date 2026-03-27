import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Download, CheckCircle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

function useCard() {
  const { dark } = useTheme();
  return dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
}

export default function Reports() {
  const { dark } = useTheme();
  const card = useCard();
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exported, setExported] = useState(null);

  const headingColor = dark ? '#f9fafb' : '#111827';
  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const tickColor = dark ? '#ffffff' : '#6b7280';
  const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  useEffect(() => {
    Promise.all([api.exportHistory(), api.getTrends()])
      .then(([hist, trend]) => {
        setHistory(Array.isArray(hist) ? hist : []);
        setTrends(Array.isArray(trend) ? trend : []);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  // Group trends by month for the bar chart
  const monthlyData = trends.reduce((acc, t) => {
    const month = new Date(t.date).toLocaleString('default', { month: 'short', year: '2-digit' });
    const existing = acc.find(a => a.month === month);
    if (existing) existing.score = Math.round((existing.score + t.score) / 2);
    else acc.push({ month, score: t.score });
    return acc;
  }, []);

  const handleExportJSON = async (id, fileName) => {
    setExported(id);
    try {
      const report = await api.exportReport(id);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `report-${fileName.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click(); URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setExported(null), 2000);
    }
  };

  const handleExportCSV = () => {
    const headers = ['File Name', 'Date', 'Row Count', 'Overall Score', 'Completeness', 'Uniqueness', 'Validity', 'Consistency'];
    const rows = history.map(h => [h.fileName, h.date, h.rowCount, h.overallScore, h.completeness, h.uniqueness, h.validity, h.consistency]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'analysis-history.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const scoreColor = (s) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Reports</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>Download and export your data quality reports</p>
      </div>

      {/* Monthly chart */}
      <div className="p-6 rounded-2xl" style={card}>
        <p className="text-sm font-bold mb-4" style={{ color: headingColor }}>Monthly Quality Score</p>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData.length ? monthlyData : [{ month: 'No data', score: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: dark ? '#1f2937' : '#fff', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: 10, color: dark ? '#f9fafb' : '#111827', fontSize: 12 }} />
              <Bar dataKey="score" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Analysis list */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
          <p className="text-sm font-bold" style={{ color: headingColor }}>Analysis Reports</p>
          {history.length > 0 && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              <Download size={12} />Export All CSV
            </motion.button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: labelColor }}>No analyses yet — upload a file to get started.</p>
        ) : (
          <div>
            {history.map((item, i) => (
              <motion.div key={item.id || i}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 p-4"
                style={{ borderBottom: i < history.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` : 'none' }}>

                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <FileText size={14} style={{ color: '#6366f1' }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: headingColor }}>{item.fileName}</p>
                  <p className="text-xs mt-0.5" style={{ color: labelColor }}>
                    {new Date(item.date).toLocaleDateString()} · {item.rowCount?.toLocaleString()} rows
                  </p>
                </div>

                <span className="text-sm font-bold flex-shrink-0" style={{ color: scoreColor(item.overallScore) }}>
                  {item.overallScore}%
                </span>

                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => handleExportJSON(item.id, item.fileName)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
                  style={exported === item.id
                    ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
                    : { background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor, border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                  {exported === item.id ? <><CheckCircle size={11} />Downloaded</> : <><Download size={11} />Download</>}
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
