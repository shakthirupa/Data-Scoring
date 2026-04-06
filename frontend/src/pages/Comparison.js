import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';
import { useTheme } from '../ThemeContext';

const MOCK = [
  { _id: 'm0', fileName: 'customer_data.csv', createdAt: '2024-01-20', scores: { completeness: 85, uniqueness: 70, validity: 90, consistency: 80, overallScore: 81 } },
  { _id: 'm1', fileName: 'sales_records.csv', createdAt: '2024-01-18', scores: { completeness: 72, uniqueness: 88, validity: 76, consistency: 65, overallScore: 75 } },
  { _id: 'm2', fileName: 'inventory_data.csv', createdAt: '2024-01-15', scores: { completeness: 95, uniqueness: 91, validity: 88, consistency: 92, overallScore: 92 } },
  { _id: 'm3', fileName: 'user_profiles.csv', createdAt: '2024-01-12', scores: { completeness: 60, uniqueness: 74, validity: 82, consistency: 70, overallScore: 72 } },
];

function Comparison() {
  const { dark } = useTheme();
  const [analyses, setAnalyses] = useState([]);
  const [selected, setSelected] = useState([0, 1]);

  useEffect(() => {
    api.getHistory()
      .then(data => setAnalyses(
        data.length >= 2
          ? data.map(a => ({ ...a, _id: a._id || a.id }))
          : MOCK
      ))
      .catch(() => setAnalyses(MOCK));
  }, []);

  const toggleSelect = (idx) => {
    if (selected.includes(idx)) {
      if (selected.length > 1) setSelected(selected.filter(s => s !== idx));
    } else {
      if (selected.length < 2) setSelected([...selected, idx]);
      else setSelected([selected[1], idx]);
    }
  };

  const getColor = (score) =>
    score >= 80 ? 'text-green-600 dark:text-green-400' :
    score >= 60 ? 'text-orange-500 dark:text-orange-400' : 'text-red-600 dark:text-red-400';

  const a0 = analyses[selected[0]];
  const a1 = analyses[selected[1]];

  const radarData = a0 && a1
    ? ['completeness', 'uniqueness', 'validity', 'consistency'].map(dim => ({
        dimension: dim.charAt(0).toUpperCase() + dim.slice(1),
        [a0.fileName]: a0.scores[dim],
        [a1.fileName]: a1.scores[dim],
      }))
    : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Data Comparison</h2>
        <p className="text-gray-600 dark:text-gray-400">Compare two analyses side by side</p>
      </div>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select 2 Files to Compare</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analyses.slice(0, 16).map((a, idx) => (
              <motion.button key={a._id} whileTap={{ scale: 0.97 }}
                onClick={() => toggleSelect(idx)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${selected.includes(idx) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.fileName}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {a.fileName.match(/\.(pdf|docx?|xlsx?|xls|ods|png|jpe?g|webp|bmp|tiff?)$/i)
                    ? a.fileName.match(/\.(pdf|docx?|xlsx?|xls|ods|png|jpe?g|webp|bmp|tiff?)$/i)[0].toUpperCase().replace('.', '')
                    : 'CSV'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(a.createdAt).toLocaleDateString()}</p>
                <p className={`text-lg font-bold mt-2 ${getColor(a.scores.overallScore)}`}>{a.scores.overallScore}%</p>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {a0 && a1 && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Radar Comparison</h3>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={dark ? '#ffffff' : '#6b7280'} />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Radar name={a0.fileName} dataKey={a0.fileName} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                  <Radar name={a1.fileName} dataKey={a1.fileName} stroke="#f97316" fill="#f97316" fillOpacity={0.4} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>

            <div className="grid grid-cols-2 gap-6">
              {[a0, a1].map((a, i) => (
                <motion.div key={a._id}
                  initial={{ opacity: 0, x: i === 0 ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 truncate">{a.fileName}</h4>
                  {['completeness', 'uniqueness', 'validity', 'consistency'].map(dim => (
                    <div key={dim} className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-gray-600 dark:text-gray-400">{dim}</span>
                        <span className={`font-semibold ${getColor(a.scores[dim])}`}>{a.scores[dim]}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${a.scores[dim]}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className={`h-2 rounded-full ${a.scores[dim] >= 80 ? 'bg-green-500' : a.scores[dim] >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Overall Score</p>
                    <p className={`text-3xl font-bold ${getColor(a.scores.overallScore)}`}>{a.scores.overallScore}%</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default Comparison;
