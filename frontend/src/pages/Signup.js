import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, ArrowRight, AlertCircle, Zap, CheckCircle } from 'lucide-react';

const glass = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.8)',
  borderRadius: '20px',
};

const features = [
  'Instant quality scoring across 4 dimensions',
  'AI-powered recommendations for every issue',
  'Historical trend tracking and comparison',
  'Export reports in CSV format',
];

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/user/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_name', data.name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Full Name',        key: 'name',    type: 'text',     placeholder: 'John Doe',         icon: User },
    { label: 'Email',            key: 'email',   type: 'email',    placeholder: 'you@example.com',  icon: Mail },
    { label: 'Password',         key: 'password',type: 'password', placeholder: '••••••••',         icon: Lock },
    { label: 'Confirm Password', key: 'confirm', type: 'password', placeholder: '••••••••',         icon: Lock },
  ];

  return (
    <div className="min-h-screen flex relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0f9ff 70%, #fefce8 100%)' }}>

      {/* Glow orbs */}
      <div className="pointer-events-none fixed" style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(34,197,94,0.2), transparent)', top: -100, left: -100, filter: 'blur(100px)', zIndex: 0 }} />
      <div className="pointer-events-none fixed" style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent)', bottom: -80, right: -80, filter: 'blur(100px)', zIndex: 0 }} />

      {/* Left Panel */}
      <div className="hidden lg:flex w-[45%] flex-col justify-between p-12 relative z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 20px rgba(16,185,129,0.45)' }}>
            <Zap size={17} className="text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 tracking-tight">
            DataQuality <span className="text-brand-500">AI</span>
          </span>
        </Link>

        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
              Start improving your<br />
              <span style={{ background: 'linear-gradient(135deg,#10b981,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                data quality today
              </span>
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-8">
              Join thousands of data teams who trust DataQuality AI to keep their data clean, consistent, and reliable.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="space-y-3">
            {features.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <CheckCircle size={13} className="text-brand-500" />
                </div>
                <span className="text-gray-600 text-sm">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <p className="text-gray-400 text-xs">© {new Date().getFullYear()} DataQuality AI</p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-sm">

          <div className="mb-6">
            <Link to="/" className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 16px rgba(16,185,129,0.4)' }}>
                <Zap size={15} className="text-white" />
              </div>
              <span className="font-bold text-gray-900">DataQuality AI</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-500 text-sm">Free forever. No credit card required.</p>
          </div>

          <div className="p-8" style={{ ...glass, boxShadow: '0 20px 60px rgba(16,185,129,0.1), 0 4px 20px rgba(0,0,0,0.06)' }}>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {fields.map(({ label, key, type, placeholder, icon: Icon }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">{label}</label>
                  <div className="relative">
                    <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={type} required
                      value={form[key]}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-gray-900 placeholder-gray-400 text-sm outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(16,185,129,0.2)' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(16,185,129,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(16,185,129,0.2)'}
                    />
                  </div>
                </div>
              ))}

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-red-600 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={14} /> {error}
                </motion.div>
              )}

              <motion.button type="submit" disabled={loading}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-2.5 text-white font-semibold rounded-xl flex items-center justify-center gap-2 mt-1 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}>
                {loading ? 'Creating account...' : <><span>Create Account</span><ArrowRight size={16} /></>}
              </motion.button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">Sign in</Link>
            </p>
          </div>

          <div className="mt-5 text-center">
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
