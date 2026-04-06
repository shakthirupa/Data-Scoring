import React from 'react';
import { motion } from 'framer-motion';

function StatsCard({ title, value, icon, trend, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-lg" style={{ boxShadow: '0 2px 12px rgba(16,185,129,0.06)' }}>
      <div className="flex items-center justify-between">
        <div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-gray-500 mb-1"
          >
            {title}
          </motion.p>
          <motion.p 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
            className="text-3xl font-bold text-gray-900"
          >
            {value}
          </motion.p>
          {trend && (
            <motion.p 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className={`text-xs mt-2 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last week
            </motion.p>
          )}
        </div>
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
          whileHover={{ rotate: 360, scale: 1.2 }}
          className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center text-2xl`}
        >
          {icon}
        </motion.div>
      </div>
    </div>
  );
}

export default StatsCard;
