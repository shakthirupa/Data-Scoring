import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useTheme } from '../ThemeContext';

function QualityScore() {
  const { dark } = useTheme();
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTrends().then(data => { setTrends(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const targets = { Completeness: 90, Uniqueness: 85, Validity: 95, Consistency: 88 };

  const latest = trends[trends.length - 1];
  const scoreData = latest ? [
    { dimension: 'Completeness', current: latest.completeness, target: targets.Completeness },
    { dimension: 'Uniqueness', current: latest.uniqueness, target: targets.Uniqueness },
    { dimension: 'Validity', current: latest.validity, target: targets.Validity },
    { dimension: 'Consistency', current: latest.consistency, target: targets.Consistency },
  ] : [
    { dimension: 'Completeness', current: 85, target: 90 },
    { dimension: 'Uniqueness', current: 70, target: 85 },
    { dimension: 'Validity', current: 90, target: 95 },
    { dimension: 'Consistency', current: 80, target: 88 },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Quality Score Details</h2>
        <p className="text-gray-600 dark:text-gray-400">Detailed breakdown of quality metrics</p>
      </div>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Current vs Target Scores</h3>
          {loading ? <p className="text-center text-gray-400 py-8">Loading...</p> : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#ffffff' : '#6b7280'} />
                <XAxis dataKey="dimension" tick={{ fill: dark ? '#ffffff' : '#6b7280' }} />
                <YAxis tick={{ fill: dark ? '#ffffff' : '#6b7280' }} />
                <Tooltip />
                <Bar dataKey="current" fill="#3b82f6" name="Current Score" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="#22c55e" name="Target Score" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scoreData.map((item, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{item.dimension}</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Current</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{item.current}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <motion.div className="bg-blue-500 h-2 rounded-full"
                      initial={{ width: 0 }} animate={{ width: `${item.current}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Target</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{item.target}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${item.target}%` }} />
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  Gap: <span className="font-semibold">{item.target - item.current}%</span>
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default QualityScore;
