import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, HardDrive } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import DigiLockerPanel from '../DigiLockerPanel';
import GoogleDrivePanel from '../GoogleDrivePanel';

const TABS = [
  { id: 'digilocker', label: 'DigiLocker',   icon: Lock,      color: '#10b981' },
  { id: 'gdrive',     label: 'Google Drive', icon: HardDrive, color: '#4285f4' },
];

export default function IntegrationsPage() {
  const { dark } = useTheme();
  const location = useLocation();
  const initTab = location.state?.tab === 'gdrive' ? 'gdrive' : 'digilocker';
  const [tab, setTab] = useState(initTab);

  const headingColor = dark ? '#f9fafb' : '#111827';
  const labelColor   = dark ? '#9ca3af' : '#6b7280';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Integrations</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>Connect external services to verify and import data</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 rounded-2xl w-fit"
        style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
        {TABS.map(({ id, label, icon: Icon, color }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={active
                ? { background: dark ? '#1f2937' : '#fff', color, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: `1px solid ${color}30` }
                : { color: labelColor, border: '1px solid transparent' }}>
              <Icon size={14} />
              {label}
              {active && <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: color }} />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === 'digilocker' && (
          <motion.div key="digilocker" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DigiLockerPanel orgId={1} />
          </motion.div>
        )}
        {tab === 'gdrive' && (
          <motion.div key="gdrive" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GoogleDrivePanel
              initialFolderId={location.state?.folderId}
              initialFolderName={location.state?.folderName}
              showVerify={true}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
