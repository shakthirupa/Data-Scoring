import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart2, Bot, TrendingUp, AlertTriangle, GitCompare, FileDown,
  ArrowRight, Star, ChevronRight, Zap, Shield, Activity
} from 'lucide-react';

const features = [
  { icon: BarChart2, title: 'Real-Time Scoring', desc: 'Instantly score your datasets across Completeness, Uniqueness, Validity, and Consistency.' },
  { icon: Bot, title: 'AI-Powered Insights', desc: 'Get intelligent recommendations tailored to your specific data quality issues.' },
  { icon: TrendingUp, title: 'Trend Analysis', desc: 'Track quality improvements over time with beautiful charts and historical data.' },
  { icon: AlertTriangle, title: 'Issue Detection', desc: 'Automatically detect missing values, duplicates, and invalid formats in your data.' },
  { icon: GitCompare, title: 'Data Comparison', desc: 'Compare multiple datasets side by side to identify regressions and improvements.' },
  { icon: FileDown, title: 'Export Reports', desc: 'Download detailed CSV reports to share with your team or stakeholders.' },
];

const stats = [
  { value: '10K+', label: 'Datasets Analyzed', icon: BarChart2 },
  { value: '98%',  label: 'Accuracy Rate',     icon: Shield },
  { value: '500+', label: 'Companies',          icon: Activity },
  { value: '4.9',  label: 'Avg Rating',         icon: Star },
];

const testimonials = [
  { name: 'Sarah Chen',     role: 'Data Engineer, TechCorp',    text: 'DataQuality AI cut our data validation time by 80%. The AI insights are incredibly accurate.' },
  { name: 'Marcus Johnson', role: 'Analytics Lead, FinanceHub',  text: 'We caught critical data issues before they reached production. This tool paid for itself in week one.' },
  { name: 'Priya Patel',    role: 'CTO, DataStartup',            text: 'The comparison feature alone is worth it. We can now track data quality across all our pipelines.' },
];

/* ─── reusable glass card style ─── */
const glass = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.8)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(16,185,129,0.08)',
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-x-hidden relative"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0f9ff 70%, #fefce8 100%)' }}>

      {/* ── Glow orbs ── */}
      <div className="pointer-events-none fixed" style={{
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(34,197,94,0.22), transparent)',
        top: -100, left: -100, filter: 'blur(100px)', zIndex: 0,
      }} />
      <div className="pointer-events-none fixed" style={{
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent)',
        bottom: -100, right: -100, filter: 'blur(120px)', zIndex: 0,
      }} />
      <div className="pointer-events-none fixed" style={{
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(245,158,11,0.1), transparent)',
        top: '40%', right: '10%', filter: 'blur(90px)', zIndex: 0,
      }} />

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(16,185,129,0.15)',
        boxShadow: '0 4px 30px rgba(16,185,129,0.1)',
      }}>
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 20px rgba(16,185,129,0.5)' }}>
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">
              DataQuality <span className="text-brand-500">AI</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {['Features', 'Testimonials'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition-all">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 rounded-xl transition-all hover:text-brand-600"
              style={{ border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(255,255,255,0.6)' }}>
              Log In
            </button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/signup')}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}>
              Get Started <ChevronRight size={14} />
            </motion.button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-40 pb-24 px-6 z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold text-brand-700 uppercase tracking-widest"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              AI-Powered Data Quality Platform
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight text-gray-900">
              Know Your Data<br />
              <span style={{ background: 'linear-gradient(135deg,#10b981,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Quality Instantly
              </span>
            </h1>

            <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload your CSV, get a comprehensive quality score in seconds, and receive AI-powered recommendations to fix issues before they cost you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/signup')}
                className="flex items-center justify-center gap-2 px-8 py-4 text-white font-semibold rounded-xl text-base"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 8px 30px rgba(16,185,129,0.4)' }}>
                Start for Free <ArrowRight size={18} />
              </motion.button>

            </div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.3 }}
            className="mt-20 p-6 relative"
            style={{ ...glass, boxShadow: '0 40px 80px rgba(16,185,129,0.12), 0 8px 32px rgba(0,0,0,0.08)' }}>

            {/* Browser bar */}
            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-brand-400" />
              <div className="flex-1 mx-4 h-6 rounded-lg flex items-center px-3"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <span className="text-xs text-gray-400">app.dataquality.ai/dashboard</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total Analyses', val: '128', color: '#10b981', icon: BarChart2 },
                { label: 'Avg Score',      val: '84%', color: '#f59e0b', icon: TrendingUp },
                { label: 'Critical Issues',val: '3',   color: '#ef4444', icon: AlertTriangle },
                { label: 'Files Processed',val: '128', color: '#059669', icon: FileDown },
              ].map(({ label, val, color, icon: Icon }) => (
                <div key={label} className="rounded-2xl p-4 text-left"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <Icon size={14} style={{ color, marginBottom: 8 }} />
                  <p className="text-xl font-bold" style={{ color }}>{val}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                ['Completeness', 85, '#10b981'],
                ['Uniqueness',   70, '#f59e0b'],
                ['Validity',     90, '#34d399'],
                ['Consistency',  80, '#059669'],
              ].map(([label, val, color]) => (
                <div key={label} className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-2">{label}</p>
                  <p className="text-xl font-bold text-gray-800 mb-2">{val}%</p>
                  <div className="w-full rounded-full h-2" style={{ background: 'rgba(0,0,0,0.06)' }}>
                    <div className="h-2 rounded-full" style={{ width: `${val}%`, background: color, boxShadow: `0 0 8px ${color}60` }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 relative z-10" style={{ background: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(({ value, label, icon: Icon }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }} viewport={{ once: true }}
              className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-1"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Icon size={18} className="text-brand-500" />
              </div>
              <p className="text-3xl font-extrabold text-gray-900">{value}</p>
              <p className="text-gray-500 text-sm">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-600 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need to trust your data</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">A complete platform to measure, monitor, and improve your data quality at scale.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }} viewport={{ once: true }}
                whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(16,185,129,0.15)' }}
                className="p-6 transition-all cursor-default"
                style={glass}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <f.icon size={18} className="text-brand-500" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-28 px-6 relative z-10"
        style={{ background: 'rgba(255,255,255,0.3)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-600 text-sm font-semibold uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="text-4xl font-bold text-gray-900">Trusted by data teams worldwide</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={t.name}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className="p-6" style={glass}>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, s) => <Star key={s} size={13} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6 relative z-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.18), transparent 65%)' }} />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">Ready to trust your data?</h2>
            <p className="text-gray-500 text-lg mb-10">Join thousands of data teams who rely on DataQuality AI every day.</p>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/signup')}
              className="inline-flex items-center gap-2 px-10 py-4 text-white font-bold rounded-xl text-base"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 8px 30px rgba(16,185,129,0.45)' }}>
              Get Started for Free <ArrowRight size={18} />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 text-center text-sm text-gray-400 relative z-10"
        style={{ borderTop: '1px solid rgba(16,185,129,0.12)' }}>
        © {new Date().getFullYear()} DataQuality AI. All rights reserved.
      </footer>
    </div>
  );
}
