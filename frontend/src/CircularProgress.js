import React from 'react';
import { useTheme } from './ThemeContext';

const CircularProgress = ({ score }) => {
  const { dark } = useTheme();
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const gradientId = `scoreGrad-${score}`;
  const glowId = `scoreGlow-${score}`;
  const colors =
    score >= 80 ? ['#10b981', '#34d399'] :
    score >= 60 ? ['#f59e0b', '#fbbf24'] :
                  ['#ef4444', '#f87171'];

  return (
    <div className="relative w-48 h-48">
      <svg className="transform -rotate-90 w-48 h-48" viewBox="0 0 200 200">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation={dark ? 5 : 3} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="100" cy="100" r={radius} stroke={dark ? '#334155' : '#e5e7eb'} strokeWidth="12" fill="none" />
        <circle cx="100" cy="100" r={radius}
          stroke={`url(#${gradientId})`} strokeWidth="12" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" filter={`url(#${glowId})`}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold leading-none" style={{ color: colors[0] }}>{score}</span>
        <span className="text-sm font-medium mt-1" style={{ color: dark ? '#6b7280' : '#9ca3af' }}>/ 100</span>
      </div>
    </div>
  );
};

export default CircularProgress;
