import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, CheckCircle, AlertTriangle, Info, Bell, BellOff, RefreshCw } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

const TYPE_CFG = {
  alert:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   icon: AlertOctagon,  label: 'Alert'   },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  icon: AlertTriangle, label: 'Warning' },
  success: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  icon: CheckCircle,   label: 'Success' },
  info:    { color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)',  icon: Info,          label: 'Info'    },
};

function NotifCard({ n, onMarkRead, onDismiss, dark, index }) {
  const cfg = TYPE_CFG[n.type] || TYPE_CFG.info;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-start gap-4 p-4 rounded-2xl relative"
      style={{
        background: dark ? '#0a0f1e' : 'rgba(255,255,255,0.9)',
        border: `1px solid ${n.read ? (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)') : cfg.border}`,
        boxShadow: n.read ? 'none' : `0 2px 12px ${cfg.bg}`,
      }}>

      {/* Unread dot */}
      {!n.read && (
        <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full"
          style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
      )}

      {/* Icon */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
        <Icon size={16} style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: dark ? '#f9fafb' : '#111827' }}>{n.title}</p>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: dark ? '#9ca3af' : '#6b7280' }}>{n.message}</p>
        <p className="text-xs mt-1.5" style={{ color: dark ? '#4b5563' : '#d1d5db' }}>{n.time}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
        {!n.read && (
          <button onClick={() => onMarkRead(n.id)}
            className="text-xs font-medium transition-colors"
            style={{ color: cfg.color }}>
            Mark read
          </button>
        )}
        <button onClick={() => onDismiss(n.id)}
          className="text-xs transition-colors"
          style={{ color: dark ? '#4b5563' : '#d1d5db' }}>
          ✕
        </button>
      </div>
    </motion.div>
  );
}

export default function Notifications() {
  const { dark } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const headingColor = dark ? '#f9fafb' : '#111827';
  const labelColor  = dark ? '#9ca3af' : '#6b7280';

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead   = (id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const dismiss    = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
  const markAllRead = ()  => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read)
    : filter === 'read' ? notifications.filter(n => n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  const FILTERS = ['all', 'unread', 'read', 'alert', 'warning', 'success'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Notifications</h2>
          <p className="text-sm mt-0.5" style={{ color: labelColor }}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
              Mark all read
            </button>
          )}
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => load(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </motion.button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl flex-wrap"
        style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
        {FILTERS.map(f => {
          const cfg = TYPE_CFG[f];
          const isActive = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={isActive
                ? { background: dark ? '#1f2937' : '#fff', color: cfg?.color || '#6366f1', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                : { color: labelColor }}>
              {f}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{unreadCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-sm" style={{ color: labelColor }}>Loading notifications…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <BellOff size={36} style={{ color: dark ? '#374151' : '#d1d5db' }} />
          <p className="text-sm font-medium" style={{ color: labelColor }}>
            {filter === 'all' ? 'No notifications yet — upload a dataset to get started' : `No ${filter} notifications`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((n, i) => (
              <NotifCard key={n.id} n={n} onMarkRead={markRead} onDismiss={dismiss} dark={dark} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
