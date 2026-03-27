import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart2, TrendingUp, AlertTriangle, FileText, CheckCircle, ArrowRight, Star } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import FileUpload from '../FileUpload';
import ScoreDashboard from '../ScoreDashboard';
import RecommendationSection from '../RecommendationSection';
import TrendChart from '../TrendChart';
import RecentActivity from '../RecentActivity';
import IssuesPanel from '../IssuesPanel';
import api from '../api';

function useCard() {
  const { dark } = useTheme();
  return dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }
    : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' };
}

function StatCard({ icon: Icon, label, value, color, sub, onClick }) {
  const card = useCard();
  const { dark } = useTheme();
  return (
    <motion.div whileHover={{ y: -4, scale: 1.02 }} onClick={onClick}
      className="cursor-pointer p-5" style={card}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}35` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <ArrowRight size={13} className={dark ? 'text-gray-700 ml-auto' : 'text-gray-300 ml-auto'} />
      </div>
      <p className={`text-2xl font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>{sub}</p>}
    </motion.div>
  );
}

function EmptyState({ onUpload }) {
  const userName = localStorage.getItem('user_name') || 'there';
  const { dark } = useTheme();
  const card = useCard();
  const heroBg = dark
    ? 'linear-gradient(135deg, #0d1a2e 0%, #0a1628 50%, #0f1a1a 100%)'
    : 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #fefce8 100%)';
  const heroBorder = dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-2xl p-10 text-center relative overflow-hidden"
        style={{ background: heroBg, border: heroBorder }}>
        <div className="pointer-events-none absolute" style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent)', top: -100, left: '50%', transform: 'translateX(-50%)', filter: 'blur(60px)' }} />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 8px 32px rgba(16,185,129,0.35)' }}>
          <BarChart2 size={36} className="text-white" />
        </motion.div>
        <h2 className={`text-3xl font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>Welcome, {userName}!</h2>
        <p className={`text-base max-w-md mx-auto mb-8 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          Upload your first CSV file to get an instant AI-powered data quality score with detailed insights and recommendations.
        </p>
        <FileUpload onAnalysisComplete={onUpload} large />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: BarChart2,     color: '#10b981', title: 'Quality Scoring',   desc: 'Get scores across Completeness, Uniqueness, Validity & Consistency.' },
          { icon: AlertTriangle, color: '#f59e0b', title: 'Issue Detection',    desc: 'Automatically detect missing values, duplicates and invalid formats.' },
          { icon: Star,          color: '#6366f1', title: 'AI Recommendations', desc: 'Receive tailored action items to fix every data quality issue found.' },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} className="p-5" style={card}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <h3 className={`font-semibold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
            <p className={`text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{desc}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [issues, setIssues] = useState([]);
  const [activities, setActivities] = useState([]);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [hasData, setHasData] = useState(false);

  const fetchData = async () => {
    try {
      const s = await api.getDashboardStats();
      setStats(s);
      setHasData(s.totalAnalyses > 0);
      setActivities((s.recentAnalyses || []).map(a => ({
        fileName: a.fileName,
        date: new Date(a.createdAt).toLocaleDateString(),
        score: a.scores?.overallScore
      })));
    } catch {}
    try {
      const t = await api.getTrends();
      setTrends(t.map(d => ({ date: d.date, score: d.score, completeness: d.completeness, uniqueness: d.uniqueness })));
    } catch {}
    try {
      const i = await api.getIssuesSummary();
      setIssues(i.recentIssues || []);
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const handleAnalysisComplete = (result) => {
    setLastAnalysis(result);
    fetchData();
  };

  if (!hasData && !lastAnalysis) return <EmptyState onUpload={handleAnalysisComplete} />;

  const heading = dark ? 'text-white' : 'text-gray-900';
  const subtext = dark ? 'text-gray-400' : 'text-gray-500';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${heading}`}>Dashboard</h2>
          <p className={`text-sm mt-0.5 ${subtext}`}>Monitor your data quality in real-time</p>
        </div>
        <FileUpload onAnalysisComplete={handleAnalysisComplete} />
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {lastAnalysis && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-5 py-4 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-500">Analysis complete — {lastAnalysis.fileName}</p>
              <p className="text-xs text-emerald-600">{lastAnalysis.rowCount} rows · Overall Score: {lastAnalysis.scores?.overallScore}%</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BarChart2,     label: 'Total Analyses',    value: stats?.totalAnalyses ?? 0,  color: '#10b981', sub: 'All time',        route: '/history' },
          { icon: TrendingUp,    label: 'Avg Quality Score', value: `${stats?.avgScore ?? 0}%`, color: '#6366f1', sub: 'Across all files', route: '/quality-score' },
          { icon: AlertTriangle, label: 'Critical Issues',   value: stats?.criticalIssues ?? 0, color: '#ef4444', sub: 'Unresolved',       route: '/issues' },
          { icon: FileText,      label: 'Files Processed',   value: stats?.totalAnalyses ?? 0,  color: '#f59e0b', sub: 'Total uploads',    route: '/history' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <StatCard {...s} onClick={() => navigate(s.route)} />
          </motion.div>
        ))}
      </div>

      {/* Score dashboard */}
      {lastAnalysis && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <ScoreDashboard scores={lastAnalysis.scores} />
        </motion.div>
      )}

      {/* Trends + Activity */}
      {(trends.length > 0 || activities.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {trends.length > 0 && <div className="lg:col-span-2"><TrendChart data={trends} /></div>}
          {activities.length > 0 && <RecentActivity activities={activities} />}
        </div>
      )}

      {/* Issues + Recommendations */}
      {(issues.length > 0 || lastAnalysis) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {issues.length > 0 && <IssuesPanel issues={issues} />}
          {lastAnalysis && <RecommendationSection analysisId={lastAnalysis.analysisId} />}
        </div>
      )}
    </motion.div>
  );
}

export default Dashboard;
