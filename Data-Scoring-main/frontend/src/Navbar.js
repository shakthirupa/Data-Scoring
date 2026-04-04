import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon, ChevronDown, User, Settings, HelpCircle, LogOut, Zap } from 'lucide-react';
import { useTheme } from './ThemeContext';

function Navbar() {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const userName = localStorage.getItem('user_name') || 'User';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_name');
    navigate('/');
  };

  const navBg = dark
    ? 'rgba(10,15,30,0.95)'
    : 'rgba(255,255,255,0.85)';
  const navBorder = dark
    ? '1px solid rgba(255,255,255,0.2)'
    : '1px solid rgba(0,0,0,0.08)';
  const logoText = dark ? 'text-gray-100' : 'text-gray-900';
  const linkActive = dark ? 'text-emerald-400' : 'text-emerald-600';
  const linkInactive = dark ? 'text-gray-400 hover:text-gray-100 hover:bg-white/5' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100';
  const iconBtn = dark ? 'text-gray-400 hover:text-gray-100 hover:bg-white/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100';
  const userBtn = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const userText = dark ? 'text-gray-300' : 'text-gray-700';
  const dropBg = dark ? 'rgba(10,15,30,0.98)' : 'rgba(255,255,255,0.98)';
  const dropItemText = dark ? 'text-gray-400 hover:text-gray-100 hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50';
  const dropIconColor = dark ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="h-20 fixed top-0 left-0 right-0 z-20 flex items-center px-8 gap-4"
      style={{ background: navBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: navBorder, boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)' }}>

      {/* Logo */}
      <div className={`flex items-center gap-2 mr-4 flex-shrink-0 cursor-pointer`} onClick={() => navigate('/dashboard')}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 16px rgba(16,185,129,0.45)' }}>
          <Zap size={18} className="text-white" />
        </div>
        <span className={`font-bold text-xl tracking-tight ${logoText}`}>DataQuality <span className="text-emerald-500">AI</span></span>
      </div>

      <div className="flex-1" />

      {/* Right */}
      <div className="flex items-center gap-1">

        {/* Theme toggle */}
        <button onClick={toggle}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${iconBtn}`}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button onClick={() => navigate('/notifications')}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${iconBtn}`}>
          <Bell size={18} />
        </button>

        {/* User Dropdown */}
        <div className="relative ml-1" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
            style={{ background: userBtn, border: dark ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(0,0,0,0.1)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className={`text-base font-medium hidden md:block max-w-[100px] truncate ${userText}`}>{userName}</span>
            <ChevronDown size={13} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''} ${dark ? 'text-gray-400' : 'text-gray-400'}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-50 py-1"
              style={{ background: dropBg, backdropFilter: 'blur(20px)', border: dark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)', boxShadow: dark ? '0 20px 40px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.12)' }}>
              {[
                { icon: User,       label: 'Profile',  path: '/profile' },
                { icon: Settings,   label: 'Settings', path: '/settings' },
                { icon: HelpCircle, label: 'Help',     path: '/help' },
              ].map(({ icon: Icon, label, path }) => (
                <button key={path} onClick={() => { navigate(path); setDropdownOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${dropItemText}`}>
                  <Icon size={14} className={dropIconColor} />
                  {label}
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`, margin: '4px 0' }} />
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;
