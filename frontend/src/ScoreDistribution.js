import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

function ScoreDistribution({ data }) {
  const chartData = [
    { name: 'Excellent (90-100)', value: data.excellent, color: '#22c55e' },
    { name: 'Good (80-89)', value: data.good, color: '#3b82f6' },
    { name: 'Fair (60-79)', value: data.fair, color: '#f97316' },
    { name: 'Poor (<60)', value: data.poor, color: '#ef4444' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ScoreDistribution;
