import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HardDrive, Folder, FileText, FileSpreadsheet, ChevronRight,
  CheckCircle, XCircle, RefreshCw, Copy, AlertTriangle,
  ExternalLink, ArrowLeft, Download, Link, Image, Users, Clock,
  ShieldCheck, ShieldX, ShieldAlert, X,
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import api from './api';

const MIME_ICON = {
  'text/csv': FileText,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.google-apps.spreadsheet': FileSpreadsheet,
  'application/pdf': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/webp': Image,
  'image/bmp': Image,
  'image/tiff': Image,
};

function FileIcon({ mimeType, isFolder, color }) {
  if (isFolder) return <Folder size={15} style={{ color: '#f59e0b' }} />;
  const Icon = MIME_ICON[mimeType] || FileText;
  return <Icon size={15} style={{ color }} />;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GoogleDrivePanel({ onImportComplete, initialFolderId, initialFolderName, showVerify = false }) {
  const { dark } = useTheme();
  const [serviceEmail, setServiceEmail] = useState(null);
  const [configured, setConfigured]     = useState(null);
  const [copied, setCopied]             = useState(false);

  // Verify vs Drive state
  const [verifyUrl, setVerifyUrl]           = useState('');
  const [verifying, setVerifying]           = useState(false);
  const [verifyRefresh, setVerifyRefresh]   = useState(false);
  const [verifyStatus, setVerifyStatus]     = useState('');
  const [verifyRows, setVerifyRows]         = useState([]);
  const [verifyTotal, setVerifyTotal]       = useState(0);
  const [verifyDone, setVerifyDone]         = useState(false);
  const [verifyError, setVerifyError]       = useState(null);
  const [verifyFilter, setVerifyFilter]     = useState('all'); // 'all' | 'verified' | 'not_verified'
  const [verifyDetail, setVerifyDetail]     = useState(null);
  const verifyFinished                      = React.useRef(false);

  const startVerify = () => {
    const raw = verifyUrl.trim();
    if (!raw) return;
    const m = raw.match(/\/folders\/([a-zA-Z0-9_-]{25,})/) || raw.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
    const fid = m ? m[1] : raw;
    verifyFinished.current = false;
    setVerifying(true); setVerifyRows([]); setVerifyStatus(''); setVerifyTotal(0); setVerifyDone(false); setVerifyError(null);
    const token = localStorage.getItem('auth_token') || '';
    const es = new EventSource(`http://localhost:5000/api/students/verify-drive-stream?folderId=${encodeURIComponent(fid)}&refresh=${verifyRefresh}&token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'status')   setVerifyStatus(msg.message);
      if (msg.type === 'total')    setVerifyTotal(msg.total);
      if (msg.type === 'checking') setVerifyStatus(`Checking: ${msg.name || msg.rollNumber || msg.id}`);
      if (msg.type === 'result')   setVerifyRows(prev => [...prev, msg]);
      if (msg.type === 'done')     { verifyFinished.current = true; setVerifyDone(true); setVerifying(false); es.close(); }
      if (msg.type === 'error')    { verifyFinished.current = true; setVerifyError(msg.message); setVerifying(false); es.close(); }
    };
    es.onerror = () => { if (verifyFinished.current) return; setVerifyError('Connection lost. Please try again.'); setVerifying(false); es.close(); };
  };

  // Browser state — if initialFolderId provided, start there
  const [stack, setStack] = useState(
    initialFolderId
      ? [{ id: 'root', name: 'My Drive' }, { id: initialFolderId, name: initialFolderName || 'Folder' }]
      : [{ id: 'root', name: 'My Drive' }]
  );
  const [items, setItems]       = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError]     = useState(null);

  // Import state
  const [importing, setImporting]       = useState(null); // fileId being imported
  const [importingFolder, setImportingFolder] = useState(null); // folderId being batch imported
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError]   = useState(null);

  // Build database from folder
  const [buildingFolder, setBuildingFolder] = useState(null);
  const [buildProgress, setBuildProgress]   = useState({ done: 0, total: 0 });
  const [buildResult, setBuildResult]       = useState(null);
  const [buildError, setBuildError]         = useState(null);

  // Connection history
  const [connections, setConnections] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Manual link fallback
  const [driveUrl, setDriveUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [folderUrl, setFolderUrl] = useState('');
  const [pendingFolder, setPendingFolder] = useState(null); // { id, name } waiting for Connect click

  const card = dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
  const rowHover  = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const divider   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const labelColor   = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';
  const inputStyle = {
    background: dark ? '#1f2937' : '#f3f4f6',
    border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
    color: dark ? '#d1d5db' : '#374151',
    borderRadius: '10px', padding: '9px 12px 9px 32px', fontSize: 13, outline: 'none', width: '100%',
  };

  useEffect(() => {
    api.getDriveServiceEmail()
      .then(data => { setConfigured(data.configured); setServiceEmail(data.email); })
      .catch(() => setConfigured(false));
  }, []);

  // Show connected message once on first successful browse
  const [showConnected, setShowConnected] = useState(false);

  useEffect(() => {
    if (!configured) return;
    api.getDriveConnections().then(d => setConnections(d.connections || [])).catch(() => {});
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    const current = stack[stack.length - 1];
    setBrowseLoading(true); setBrowseError(null);
    api.browseDrive(current.id)
      .then(data => {
        if (data.error) throw new Error(data.error);
        setItems(data.items || []);
        if (current.id === 'root') {
          setShowConnected(true);
        } else {
          // Save non-root folder as a connection
          api.saveDriveConnection(current.id, current.name, `https://drive.google.com/drive/folders/${current.id}`)
            .then(d => d.success && setConnections(prev => {
              const filtered = prev.filter(c => c.folderId !== current.id);
              return [{ folderId: current.id, folderName: current.name, folderUrl: `https://drive.google.com/drive/folders/${current.id}`, connectedAt: new Date().toISOString() }, ...filtered].slice(0, 20);
            }))
            .catch(() => {});
        }
      })
      .catch(e => setBrowseError(e.message))
      .finally(() => setBrowseLoading(false));
  }, [stack, configured]);

  const openFolder = (folder) => {
    setImportResult(null); setImportError(null);
    setStack(s => [...s, { id: folder.id, name: folder.name }]);
  };

  const goBack = () => {
    if (stack.length <= 1) return;
    setStack(s => s.slice(0, -1));
  };

  const goTo = (idx) => setStack(s => s.slice(0, idx + 1));

  const handleImportFolder = async (folder) => {
    setImportingFolder(folder.id); setImportResult(null); setImportError(null);
    try {
      const res = await api.importDriveFolder(folder.id);
      if (res.error) throw new Error(res.error);
      setImportResult({
        type: 'folder',
        folderName: folder.name,
        success: res.success,
        total: res.total,
        errors: res.errors || [],
      });
    } catch (e) {
      setImportError(e.message);
    }
    setImportingFolder(null);
  };

  const handleImport = async (file) => {
    setImporting(file.id); setImportResult(null); setImportError(null);
    try {
      const res = await api.importDriveFileById(file.id);
      if (res.error) throw new Error(res.error);
      setImportResult({ fileName: file.name, ...res });
      if (onImportComplete) onImportComplete(res);
    } catch (e) {
      setImportError(e.message);
    }
    setImporting(null);
  };

  const handleBuildDatabase = async (folder) => {
    setBuildingFolder(folder.id); setBuildResult(null); setBuildError(null); setBuildProgress({ done: 0, total: 0 });
    try {
      const { jobId, error } = await api.importDriveFolder(folder.id);
      if (error) throw new Error(error);
      // Poll every 1.5s for progress
      await new Promise((resolve, reject) => {
        const iv = setInterval(async () => {
          try {
            const job = await api.getDriveFolderJob(jobId);
            setBuildProgress({ done: job.done || 0, total: job.total || 0 });
            if (job.status === 'done' || job.status === 'error') {
              clearInterval(iv);
              if (job.status === 'error') return reject(new Error(job.error));
              setBuildResult({ folderName: folder.name, imported: job.imported.length, total: job.total, errors: job.errors });
              resolve();
            }
          } catch (e) { clearInterval(iv); reject(e); }
        }, 1500);
      });
    } catch (e) { setBuildError(e.message); }
    setBuildingFolder(null);
  };

  const handleLinkImport = async () => {
    if (!driveUrl.trim()) return;
    setLinkLoading(true); setImportResult(null); setImportError(null);
    try {
      const res = await api.importDriveFile(driveUrl.trim());
      if (res.error) throw new Error(res.error);
      setImportResult({ fileName: res.fileName, ...res });
      if (onImportComplete) onImportComplete(res);
    } catch (e) {
      setImportError(e.message);
    }
    setLinkLoading(false);
  };

  const parseFolderUrl = () => {
    const url = folderUrl.trim();
    if (!url) return;
    const m = url.match(/\/folders\/([a-zA-Z0-9_-]{25,})/) ||
              url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
    if (!m) { setImportError('Could not extract folder ID from this link'); return; }
    const name = url.includes('folders') ? 'Shared Folder' : 'Folder';
    setPendingFolder({ id: m[1], name });
  };

  const connectPendingFolder = () => {
    if (!pendingFolder) return;
    setStack([{ id: 'root', name: 'My Drive' }, { id: pendingFolder.id, name: pendingFolder.name }]);
    setFolderUrl('');
    setPendingFolder(null);
  };

  const copyEmail = () => {
    if (!serviceEmail) return;
    navigator.clipboard.writeText(serviceEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading ──
  if (configured === null) {
    return <div className="p-8 rounded-2xl flex items-center justify-center" style={card}>
      <RefreshCw size={16} className="animate-spin" style={{ color: labelColor }} />
    </div>;
  }

  // ── Not configured ──
  if (!configured) {
    return (
      <div className="p-5 rounded-2xl space-y-4" style={card}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: headingColor }}>Service account not configured</p>
            <p className="text-xs mt-0.5" style={{ color: labelColor }}>Add credentials to backend/.env</p>
          </div>
        </div>
        <div className="p-3 rounded-xl text-xs font-mono space-y-1.5"
          style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${divider}` }}>
          <p style={{ color: '#10b981' }}>GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com</p>
          <p style={{ color: '#10b981' }}>GOOGLE_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...</p>
        </div>
        <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
          style={{ background: 'rgba(66,133,244,0.08)', color: '#4285f4', border: '1px solid rgba(66,133,244,0.2)' }}>
          <ExternalLink size={11} /> Create service account in Google Cloud Console
        </a>
      </div>
    );
  }

  const currentFolder = stack[stack.length - 1];
  const folders = items.filter(i => i.isFolder);
  const files   = items.filter(i => !i.isFolder && i.isSupported);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Connection History Modal — rendered at top level so fixed positioning works */}
      <AnimatePresence>
        {showHistory && (connections.length > 0 || stack.length > 1) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowHistory(false)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: dark ? '#0a0f1e' : '#fff', border: '1px solid rgba(66,133,244,0.25)' }}>
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: `1px solid ${divider}`, background: 'rgba(66,133,244,0.05)' }}>
                <div className="flex items-center gap-2">
                  <Clock size={16} style={{ color: '#4285f4' }} />
                  <p className="text-sm font-bold" style={{ color: headingColor }}>Drive Connection History</p>
                </div>
                <button onClick={() => setShowHistory(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                  style={{ color: labelColor }}>
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y" style={{ borderColor: divider }}>
                {stack.length > 1 && (
                  <div className="flex items-center gap-3 px-5 py-3.5"
                    style={{ background: 'rgba(16,185,129,0.05)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <Folder size={15} style={{ color: '#10b981' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: headingColor }}>{stack[stack.length - 1].name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#10b981' }}>Currently connected</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Active
                    </span>
                  </div>
                )}
                {connections
                  .filter(c => stack.length <= 1 || c.folderId !== stack[stack.length - 1].id)
                  .map((c, i) => (
                    <button key={c.folderId || i}
                      onClick={() => { setStack([{ id: 'root', name: 'My Drive' }, { id: c.folderId, name: c.folderName }]); setShowHistory(false); }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <Folder size={15} style={{ color: '#f59e0b' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: headingColor }}>{c.folderName}</p>
                        <p className="text-xs mt-0.5" style={{ color: labelColor }}>
                          <Clock size={10} className="inline mr-1" />
                          {new Date(c.connectedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}{new Date(c.connectedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          {c.folderUrl && (
                            <a href={c.folderUrl} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="ml-2 underline" style={{ color: '#4285f4' }}>
                              Open in Drive
                            </a>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(66,133,244,0.08)', color: '#4285f4', border: '1px solid rgba(66,133,244,0.2)' }}>
                          Connect
                        </span>
                        <ChevronRight size={13} style={{ color: labelColor }} />
                      </div>
                    </button>
                  ))}
                {connections.filter(c => stack.length <= 1 || c.folderId !== stack[stack.length - 1].id).length === 0 && stack.length <= 1 && (
                  <p className="px-5 py-6 text-xs text-center" style={{ color: labelColor }}>No previous connections found</p>
                )}
              </div>
              <div className="px-5 py-3" style={{ borderTop: `1px solid ${divider}`, background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                <p className="text-xs" style={{ color: labelColor }}>Click any folder to reconnect · {connections.length} saved</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,rgba(66,133,244,0.15),rgba(52,168,83,0.15))', border: '1px solid rgba(66,133,244,0.25)' }}>
          <HardDrive size={18} style={{ color: '#4285f4' }} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: headingColor }}>Google Drive</h3>
          <p className="text-xs" style={{ color: labelColor }}>
            {stack.length > 1
              ? <><Folder size={11} className="inline mr-1" style={{ color: '#f59e0b' }} />{stack[stack.length - 1].name}</>
              : 'Browse and import files from your Drive'
            }
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
            ● {stack.length > 1 ? `Connected · ${stack[stack.length - 1].name}` : 'Ready'}
          </span>
          {(connections.length > 0 || stack.length > 1) && (
            <button onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: showHistory ? 'rgba(66,133,244,0.15)' : 'rgba(66,133,244,0.08)', color: '#4285f4', border: '1px solid rgba(66,133,244,0.2)' }}>
              <Clock size={11} /> History
            </button>
          )}
        </div>
      </div>

      {/* Currently Connected Drive */}
      <AnimatePresence>
        {stack.length > 1 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-4 px-5 py-4 rounded-2xl"
            style={{ background: 'linear-gradient(135deg,rgba(66,133,244,0.08),rgba(52,168,83,0.08))', border: '1px solid rgba(66,133,244,0.25)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,rgba(66,133,244,0.15),rgba(52,168,83,0.15))', border: '1px solid rgba(66,133,244,0.3)' }}>
              <HardDrive size={20} style={{ color: '#4285f4' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: '#4285f4' }}>Connected Drive Folder</p>
              <p className="text-sm font-bold truncate mt-0.5" style={{ color: headingColor }}>
                {stack[stack.length - 1].name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: labelColor }}>
                ID: {stack[stack.length - 1].id.slice(0, 24)}…
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Connected
              </span>
              <button onClick={() => setStack([{ id: 'root', name: 'My Drive' }])}
                className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected message */}
      <AnimatePresence>
        {showConnected && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle size={15} style={{ color: '#10b981' }} className="flex-shrink-0" />
            <p className="text-xs font-semibold flex-1" style={{ color: '#10b981' }}>
              Google Drive connected successfully
            </p>
            <button onClick={() => setShowConnected(false)} style={{ color: labelColor }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share email banner */}
      <div className="p-4 rounded-2xl space-y-3" style={{ ...card, border: '1px solid rgba(66,133,244,0.3)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(66,133,244,0.12)', border: '1px solid rgba(66,133,244,0.25)' }}>
            <HardDrive size={16} style={{ color: '#4285f4' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: headingColor }}>Step 1 — Share your Drive folder</p>
            <p className="text-xs mt-0.5" style={{ color: labelColor }}>Give Viewer access to this service account email</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: dark ? 'rgba(66,133,244,0.08)' : 'rgba(66,133,244,0.06)', border: '1px solid rgba(66,133,244,0.2)' }}>
          <span className="text-xs font-mono font-semibold flex-1" style={{ color: '#4285f4' }}>{serviceEmail}</span>
          <motion.button whileTap={{ scale: 0.9 }} onClick={copyEmail}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(66,133,244,0.12)', color: copied ? '#10b981' : '#4285f4', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(66,133,244,0.2)'}` }}>
            {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </motion.button>
        </div>
        <ol className="space-y-1.5 text-xs" style={{ color: labelColor }}>
          <li className="flex items-start gap-2"><span className="font-bold" style={{ color: '#4285f4' }}>1.</span> Open <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="underline" style={{ color: '#4285f4' }}>Google Drive</a> and right-click your folder</li>
          <li className="flex items-start gap-2"><span className="font-bold" style={{ color: '#4285f4' }}>2.</span> Click <strong style={{ color: headingColor }}>Share</strong> → paste the email above → set role to <strong style={{ color: headingColor }}>Viewer</strong></li>
          <li className="flex items-start gap-2"><span className="font-bold" style={{ color: '#4285f4' }}>3.</span> Click <strong style={{ color: headingColor }}>Send</strong> — then paste the folder link below</li>
        </ol>
      </div>

      {/* Import result / error */}
      <AnimatePresence>
        {importResult && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle size={14} style={{ color: '#10b981' }} />
            <div className="flex-1 min-w-0">
              {importResult.type === 'folder' ? (
                <>
                  <p className="text-xs font-semibold" style={{ color: '#10b981' }}>
                    {importResult.folderName} — {importResult.success} of {importResult.total} files imported & added to Student Database
                  </p>
                  {importResult.errors.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>
                      {importResult.errors.length} file(s) failed: {importResult.errors.map(e => e.file).join(', ')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold" style={{ color: '#10b981' }}>{importResult.fileName} imported</p>
                  <p className="text-xs" style={{ color: labelColor }}>{importResult.rowCount} rows · Score: {importResult.scores?.overallScore}%</p>
                </>
              )}
            </div>
            <button onClick={() => setImportResult(null)} style={{ color: labelColor }}>✕</button>
          </motion.div>
        )}
        {importError && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <XCircle size={13} className="flex-shrink-0 mt-0.5" /> {importError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build database result / error */}
      <AnimatePresence>
        {buildResult && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="px-4 py-3 rounded-xl text-xs space-y-1"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <p className="font-semibold" style={{ color: '#10b981' }}>Database built from "{buildResult.folderName}"</p>
            <p style={{ color: '#10b981' }}>Files imported: {buildResult.imported} of {buildResult.total} · Student records auto-extracted</p>
            {buildResult.errors?.length > 0 && <p style={{ color: '#f59e0b' }}>{buildResult.errors.length} file(s) had errors</p>}
            <button onClick={() => setBuildResult(null)} className="mt-1" style={{ color: '#10b981', opacity: 0.7 }}>✕ Dismiss</button>
          </motion.div>
        )}
        {buildError && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <XCircle size={13} className="flex-shrink-0 mt-0.5" /> {buildError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2 — Jump to folder */}
      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: headingColor }}>Step 2 — Paste your folder link</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Folder size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }} />
            <input value={folderUrl} onChange={e => { setFolderUrl(e.target.value); setPendingFolder(null); }}
              onKeyDown={e => e.key === 'Enter' && parseFolderUrl()}
              placeholder="Paste a Google Drive folder link to connect…"
              style={{ ...inputStyle, paddingLeft: 32 }} />
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={parseFolderUrl}
            disabled={!folderUrl.trim()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            Preview
          </motion.button>
        </div>

        {/* Connect confirmation */}
        <AnimatePresence>
          {pendingFolder && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.25)' }}>
              <Folder size={14} style={{ color: '#f59e0b' }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: headingColor }}>{pendingFolder.name}</p>
                <p className="text-xs" style={{ color: labelColor }}>ID: {pendingFolder.id.slice(0, 20)}…</p>
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={connectPendingFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#4285f4,#34a853)', boxShadow: '0 2px 8px rgba(66,133,244,0.3)' }}>
                <CheckCircle size={11} /> Connect
              </motion.button>
              <button onClick={() => setPendingFolder(null)} style={{ color: labelColor }} className="flex-shrink-0">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Build entire database from current folder */}
      {stack.length > 1 && (
        <>
          <div className="p-4 rounded-2xl flex items-center gap-4" style={{ ...card, border: '1px solid rgba(16,185,129,0.25)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <Users size={18} style={{ color: '#10b981' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: headingColor }}>Build Student Database</p>
              <p className="text-xs mt-0.5" style={{ color: labelColor }}>
                Process all files inside <strong style={{ color: headingColor }}>"{ stack[stack.length - 1].name }"</strong> and all its subfolders
              </p>
              {buildingFolder && buildProgress.total > 0 && (
                <div className="mt-2">
                  <div className="w-full rounded-full h-1.5" style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                    <div className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((buildProgress.done / buildProgress.total) * 100)}%`, background: 'linear-gradient(90deg,#10b981,#059669)' }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: labelColor }}>Processing {buildProgress.done} of {buildProgress.total} files…</p>
                </div>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.96 }}
              onClick={() => handleBuildDatabase(stack[stack.length - 1])}
              disabled={!!buildingFolder}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex-shrink-0"
              style={{ background: buildingFolder ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg,#10b981,#059669)', boxShadow: buildingFolder ? 'none' : '0 4px 14px rgba(16,185,129,0.3)' }}>
              {buildingFolder
                ? <><RefreshCw size={14} className="animate-spin" /> {buildProgress.total > 0 ? `${buildProgress.done}/${buildProgress.total}` : 'Scanning…'}</>
                : <><Users size={14} /> Build All</>
              }
            </motion.button>
          </div>
        </>
      )}

      {/* File browser */}
      <div className="rounded-2xl overflow-hidden" style={card}>

        {/* Breadcrumb + back */}
        <div className="flex items-center gap-1 px-4 py-3 flex-wrap"
          style={{ borderBottom: `1px solid ${divider}` }}>
          {stack.length > 1 && (
            <button onClick={goBack} className="flex items-center gap-1 mr-1 px-2 py-1 rounded-lg text-xs"
              style={{ color: labelColor, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
              <ArrowLeft size={11} /> Back
            </button>
          )}
          {stack.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <button onClick={() => goTo(idx)}
                className="text-xs font-semibold hover:underline"
                style={{ color: idx === stack.length - 1 ? headingColor : labelColor }}>
                {crumb.name}
              </button>
              {idx < stack.length - 1 && <ChevronRight size={11} style={{ color: labelColor }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        {browseLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs" style={{ color: labelColor }}>
            <RefreshCw size={13} className="animate-spin" /> Loading…
          </div>
        ) : browseError ? (
          <div className="px-4 py-6 text-xs text-center" style={{ color: '#ef4444' }}>{browseError}</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: labelColor }}>This folder is empty</div>
        ) : (
          <div className="divide-y" style={{ borderColor: divider }}>
            {/* Folders first */}
            {folders.map(folder => (
              <motion.div key={folder.id} className="flex items-center gap-3 px-4 py-3"
                onMouseEnter={e => e.currentTarget.style.background = rowHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <button className="flex items-center gap-3 flex-1 text-left" onClick={() => openFolder(folder)}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.1)' }}>
                    <Folder size={15} style={{ color: '#f59e0b' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: headingColor }}>{folder.name}</p>
                    <p className="text-xs" style={{ color: labelColor }}>Folder · click to browse</p>
                  </div>
                  <ChevronRight size={14} style={{ color: labelColor }} />
                </button>
              </motion.div>
            ))}

            {/* Files */}
            {files.map(file => {
              const busy = importing === file.id;
              const color = file.mimeType.includes('google') ? '#4285f4' : file.mimeType.includes('image') ? '#8b5cf6' : '#10b981';
              return (
                <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                    <FileIcon mimeType={file.mimeType} isFolder={false} color={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: headingColor }}>{file.name}</p>
                    <p className="text-xs" style={{ color: labelColor }}>
                      {formatSize(file.size)}{file.modifiedTime ? ` · ${new Date(file.modifiedTime).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleImport(file)}
                    disabled={!!importing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex-shrink-0"
                    style={{ background: busy ? 'rgba(66,133,244,0.5)' : 'linear-gradient(135deg,#4285f4,#34a853)', boxShadow: busy ? 'none' : '0 2px 8px rgba(66,133,244,0.25)' }}>
                    {busy ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                    {busy ? 'Importing…' : 'Import'}
                  </motion.button>
                </div>
              );
            })}

            {/* Unsupported files note */}
            {items.filter(i => !i.isFolder && !i.isSupported).length > 0 && (
              <p className="px-4 py-2 text-xs" style={{ color: labelColor }}>
                {items.filter(i => !i.isFolder && !i.isSupported).length} unsupported file(s) hidden
              </p>
            )}
          </div>
        )}
      </div>

      {/* Manual link fallback */}
      <div className="p-4 rounded-2xl space-y-2" style={card}>
        <p className="text-xs font-semibold" style={{ color: labelColor }}>Or paste a direct file link</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }} />
            <input value={driveUrl} onChange={e => setDriveUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLinkImport()}
              placeholder="https://drive.google.com/file/d/…"
              style={inputStyle} />
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleLinkImport}
            disabled={linkLoading || !driveUrl.trim()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#4285f4,#34a853)' }}>
            {linkLoading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            {linkLoading ? 'Importing…' : 'Import'}
          </motion.button>
        </div>
      </div>

      {/* Verify vs Drive */}
      {showVerify && (
        <div className="p-4 rounded-2xl space-y-3" style={{ ...card, border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Users size={15} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: headingColor }}>Verify Students vs Drive</p>
              <p className="text-xs" style={{ color: labelColor }}>Paste the folder URL containing student documents</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Folder size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }} />
              <input value={verifyUrl} onChange={e => setVerifyUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startVerify()}
                placeholder="https://drive.google.com/drive/folders/… or folder ID"
                style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
            <motion.button whileTap={{ scale: 0.96 }} onClick={startVerify}
              disabled={!verifyUrl.trim() || verifying}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              {verifying ? <><RefreshCw size={11} className="animate-spin" /> Verifying…</> : 'Run Verification'}
            </motion.button>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: labelColor }}>
            <input type="checkbox" checked={verifyRefresh} onChange={e => setVerifyRefresh(e.target.checked)} />
            Re-scan Drive files (ignore cache)
          </label>

          {(verifying || verifyStatus) && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#f59e0b' }}>
              {verifying && <RefreshCw size={11} className="animate-spin" />}
              <span className="flex-1 truncate">{verifyStatus || 'Starting…'}</span>
              {verifyTotal > 0 && <span style={{ color: labelColor }}>{verifyRows.length}/{verifyTotal}</span>}
            </div>
          )}

          {verifyDone && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total',        value: verifyTotal,                               color: '#6366f1' },
                { label: 'Verified',     value: verifyRows.filter(r => r.verified).length, color: '#10b981' },
                { label: 'Not Verified', value: verifyRows.filter(r => !r.verified).length, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center"
                  style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                  <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs" style={{ color: labelColor }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {verifyRows.length > 0 && (
            <div className="space-y-2">
              {/* Filter tabs */}
              <div className="flex gap-1.5">
                {[
                  { key: 'all',         label: `All (${verifyRows.length})`,                               color: '#6366f1' },
                  { key: 'verified',    label: `Verified (${verifyRows.filter(r => r.verified).length})`,  color: '#10b981' },
                  { key: 'not_verified',label: `Not Verified (${verifyRows.filter(r => !r.verified).length})`, color: '#ef4444' },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setVerifyFilter(tab.key)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
                    style={verifyFilter === tab.key
                      ? { background: `${tab.color}22`, color: tab.color, border: `1px solid ${tab.color}55` }
                      : { background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: labelColor, border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Rows */}
              <div className="max-h-52 overflow-y-auto rounded-xl overflow-hidden"
                style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                {verifyRows
                  .filter(r => verifyFilter === 'all' || (verifyFilter === 'verified' ? r.verified : !r.verified))
                  .map(r => (
                    <motion.div key={r.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      onClick={() => !r.verified && setVerifyDetail(r)}
                      className="flex items-center gap-3 px-3 py-2 text-xs"
                      style={{ background: r.verified ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, cursor: r.verified ? 'default' : 'pointer' }}>
                      {r.verified
                        ? <CheckCircle size={13} style={{ color: '#10b981' }} className="flex-shrink-0" />
                        : <XCircle size={13} style={{ color: '#ef4444' }} className="flex-shrink-0" />}
                      <span className="flex-1 font-semibold truncate" style={{ color: headingColor }}>{r.name || r.rollNumber || `ID ${r.id}`}</span>
                      {r.folderName && <span className="text-xs truncate max-w-[80px]" style={{ color: labelColor }} title={r.folderName}>📁 {r.folderName}</span>}
                      <span className="font-bold flex-shrink-0" style={{ color: r.matchPct === 100 ? '#10b981' : r.matchPct >= 50 ? '#f59e0b' : '#ef4444' }}>{r.matchPct}%</span>
                      {!r.verified && <span className="text-xs flex-shrink-0" style={{ color: '#ef4444', opacity: 0.6 }}>↗ details</span>}
                    </motion.div>
                  ))}
              </div>
            </div>
          )}

          {verifyError && (
            <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              {verifyError}
            </div>
          )}
        </div>
      )}

      {/* Not-Verified Detail Modal */}
      <AnimatePresence>
        {verifyDetail && (() => {
          const r = verifyDetail;
          const checks = r.checks || {};
          const failedFields = Object.entries(checks).filter(([, v]) => !v);
          const lowOcr = Object.keys(checks).length > 0 && failedFields.length === 0 && (r.matchPct ?? 0) < 50;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              onClick={() => setVerifyDetail(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: dark ? '#0a0f1e' : '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: 'rgba(239,68,68,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <ShieldX size={16} style={{ color: '#ef4444' }} />
                    <p className="text-sm font-bold" style={{ color: '#ef4444' }}>Verification Failed</p>
                  </div>
                  <button onClick={() => setVerifyDetail(null)} style={{ color: labelColor }}><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4">
                  {/* Student info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                      {(r.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: headingColor }}>{r.name || '—'}</p>
                      <p className="text-xs" style={{ color: labelColor }}>{r.rollNumber || `ID ${r.id}`}</p>
                    </div>
                    {r.matchPct != null && (
                      <span className="ml-auto text-lg font-bold" style={{ color: r.matchPct >= 50 ? '#f59e0b' : '#ef4444' }}>{r.matchPct}%</span>
                    )}
                  </div>

                  {/* Folder */}
                  {r.folderName && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                      <span>📁</span>
                      <span style={{ color: labelColor }}>Matched folder:</span>
                      <span className="font-semibold" style={{ color: headingColor }}>{r.folderName}</span>
                    </div>
                  )}

                  {/* Field checks */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold" style={{ color: labelColor }}>Field Check Results</p>
                    {Object.keys(checks).length === 0 ? (
                      <p className="text-xs" style={{ color: '#f59e0b' }}>No fields were checked — folder or file may not have been found</p>
                    ) : (
                      Object.entries(checks).map(([field, passed]) => (
                        <div key={field} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: passed ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)', border: `1px solid ${passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                          {passed
                            ? <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            : <X size={14} style={{ color: '#ef4444', flexShrink: 0 }} />}
                          <span className="text-xs font-semibold capitalize flex-1" style={{ color: headingColor }}>{field}</span>
                          <span className="text-xs" style={{ color: passed ? '#10b981' : '#ef4444' }}>
                            {passed ? 'Found in document'
                              : (field === 'aadhaar' || field === 'pan')
                                ? 'Number not found — may be misread by OCR or missing'
                                : 'Not found in document'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Likely cause */}
                  {(failedFields.length > 0 || lowOcr) && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <ShieldAlert size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                          {lowOcr ? 'Document Quality Issue' : `${failedFields.map(([k]) => k).join(', ')} Mismatch`}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: labelColor }}>
                          {lowOcr
                            ? 'Document may be a fuzzy/blurry image — OCR could not read it clearly'
                            : 'The number or value in the document does not match the database record'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-5 py-4" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <button onClick={() => setVerifyDetail(null)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </motion.div>
  );
}
