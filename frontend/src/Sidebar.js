import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, FileText, Star, AlertTriangle, Bell, User, Settings, HelpCircle, Zap, Fingerprint, Activity, ShieldCheck, Search, Lock } from 'lucide-react';
import { useTheme } from './ThemeContext';

const menuSections = [
  {
    label: '',
    items: [
      { name: 'Dashboard',        icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Analysis History', icon: History,         path: '/history' },
      { name: 'Reports',          icon: FileText,        path: '/reports' },
    ]
  },
  {
    label: 'Insights',
    items: [
      { name: 'Quality Score',    icon: Star,            path: '/quality-score' },
      { name: 'Issues',           icon: AlertTriangle,   path: '/issues' },
      { name: 'Notifications',    icon: Bell,            path: '/notifications' },
    ]
  },
  {
    label: 'AI Features',
    items: [
      { name: 'Data Forensics',   icon: Search,          path: '/forensics',    badge: 'NEW' },
      { name: 'Predictive Index', icon: Activity,        path: '/predictive',   badge: 'NEW' },
      { name: 'Fingerprinting',   icon: Fingerprint,     path: '/fingerprint',  badge: 'NEW' },
      { name: 'Consistency',      icon: ShieldCheck,     path: '/consistency',  badge: 'NEW' },
      { name: 'DigiLocker',       icon: Lock,            path: '/digilocker',   badge: 'NEW' },
    ]
  },
  {
    label: 'Account',
    items: [
      { name: 'Profile',          icon: User,            path: '/profile' },
      { name: 'Settings',         icon: Settings,        path: '/settings' },
      { name: 'Help',             icon: HelpCircle,      path: '/help' },
    ]
  }
];

function Sidebar() {
  const location = useLocation();
  const { dark } = useTheme();

  const sideBg = dark ? 'rgba(10,15,30,0.95)' : 'rgba(255,255,255,0.85)';
  const sideBorder = dark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.08)';
  const sectionLabel = dark ? 'text-gray-600' : 'text-gray-400';
  const activeLink = dark ? 'text-emerald-400' : 'text-emerald-600';
  const inactiveLink = dark ? 'text-gray-500 hover:text-gray-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100';
  const activeIcon = dark ? 'text-emerald-400' : 'text-emerald-500';
  const inactiveIcon = dark ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-400 group-hover:text-gray-600';
  const footerBorder = dark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.07)';
  const versionText = dark ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="w-56 fixed left-0 top-20 h-[calc(100vh-5rem)] flex flex-col overflow-y-auto"
      style={{ background: sideBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: sideBorder }}>

      <nav className="flex-1 px-3 py-4 space-y-6">
        {menuSections.map((section) => (
          <div key={section.label}>
            {section.label && (
              <p className={`text-xs font-semibold uppercase tracking-widest px-3 mb-2 ${sectionLabel}`}
                style={section.label === 'AI Features' ? { color: '#6366f1' } : {}}>
                {section.label === 'AI Features' ? '✦ ' : ''}{section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ name, icon: Icon, path, badge }) => {
                const active = location.pathname === path;
                const isAI = section.label === 'AI Features';
                return (
                  <Link key={path} to={path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${active ? activeLink : inactiveLink}`}
                    style={active
                      ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(255,255,255,0.22)' }
                      : { border: '1px solid transparent' }
                    }>
                    <Icon size={15} className={active ? activeIcon : inactiveIcon} />
                    <span>{name}</span>
                    {badge && !active && (
                      <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
                        {badge}
                      </span>
                    )}
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(16,185,129,0.7)' }} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4" style={{ borderTop: footerBorder }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <Zap size={12} className="text-emerald-500" />
          <span className={`text-xs ${versionText}`}>DataQuality AI <span className="text-emerald-500">v1.0</span></span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
