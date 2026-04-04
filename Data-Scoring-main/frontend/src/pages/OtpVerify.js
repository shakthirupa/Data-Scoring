import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const glass = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.8)',
  borderRadius: '20px',
};

const RESEND_COOLDOWN = 60;

export default function OtpVerify() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email || '';
  const type  = state?.type  || 'login'; // 'signup' | 'login'

  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer]     = useState(RESEND_COOLDOWN);
  const inputRefs = useRef([]);

  // Redirect if no email in state
  useEffect(() => {
    if (!email) navigate('/login');
  }, [email, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) return setError('Please enter the complete 6-digit OTP');
    setError('');
    setLoading(true);
    try {
      const endpoint = type === 'signup' ? 'verify-signup-otp' : 'verify-login-otp';
      const res  = await fetch(`http://localhost:5000/api/user/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_name', data.name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setError('');
    setSuccess('');
    try {
      const res  = await fetch('http://localhost:5000/api/user/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('A new OTP has been sent to your email.');
      setTimer(RESEND_COOLDOWN);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 40%, #f0f9ff 70%, #fefce8 100%)' }}>

      <div className="pointer-events-none fixed" style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(34,197,94,0.2), transparent)', top: -100, left: -100, filter: 'blur(100px)', zIndex: 0 }} />
      <div className="pointer-events-none fixed" style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent)', bottom: -80, right: -80, filter: 'blur(100px)', zIndex: 0 }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-sm px-6 relative z-10">

        <div className="flex justify-center mb-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 20px rgba(16,185,129,0.45)' }}>
              <Zap size={17} className="text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">DataQuality <span className="text-emerald-500">AI</span></span>
          </Link>
        </div>

        <div className="p-8" style={{ ...glass, boxShadow: '0 20px 60px rgba(16,185,129,0.1), 0 4px 20px rgba(0,0,0,0.06)' }}>
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircle size={22} className="text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Check your email</h1>
            <p className="text-gray-500 text-sm">
              We sent a 6-digit OTP to<br />
              <span className="font-semibold text-gray-700">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-5" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text" inputMode="numeric" maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-11 h-12 text-center text-lg font-bold rounded-xl outline-none transition-all text-gray-900"
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: digit ? '2px solid rgba(16,185,129,0.7)' : '1px solid rgba(16,185,129,0.2)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(16,185,129,0.6)'}
                  onBlur={e => e.target.style.borderColor = digit ? 'rgba(16,185,129,0.7)' : 'rgba(16,185,129,0.2)'}
                />
              ))}
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-red-600 px-4 py-3 rounded-xl mb-4"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={14} /> {error}
              </motion.div>
            )}

            {success && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-emerald-600 px-4 py-3 rounded-xl mb-4"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle size={14} /> {success}
              </motion.div>
            )}

            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 text-white font-semibold rounded-xl disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </motion.button>
          </form>

          <div className="text-center mt-4">
            <button onClick={handleResend} disabled={timer > 0}
              className="flex items-center gap-1.5 mx-auto text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ color: timer > 0 ? '#9ca3af' : '#059669' }}>
              <RefreshCw size={13} />
              {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
            </button>
          </div>
        </div>

        <div className="mt-5 text-center">
          <Link to={type === 'signup' ? '/signup' : '/login'}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to {type === 'signup' ? 'sign up' : 'sign in'}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
