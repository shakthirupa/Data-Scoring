import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Plus, Edit2, Trash2, CheckCircle, X, RefreshCw, Download, ChevronLeft, ChevronRight, ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

const EMPTY = { rollNumber: '', name: '', aadhaar: '', phone: '', email: '', pan: '', dlNumber: '' };

const FIELDS = [
  { key: 'rollNumber', label: 'Roll Number',   placeholder: 'e.g. 2021CS001' },
  { key: 'name',       label: 'Name',           placeholder: 'Full name' },
  { key: 'aadhaar',    label: 'Aadhaar Number', placeholder: '12-digit number' },
  { key: 'phone',      label: 'Phone',          placeholder: '10-digit mobile' },
  { key: 'email',      label: 'Email',          placeholder: 'email@example.com' },
  { key: 'pan',        label: 'PAN Number',     placeholder: 'ABCDE1234F' },
  { key: 'dlNumber',   label: 'DL Number',      placeholder: 'Driving licence number' },
];

function mask(val, type) {
  if (!val) return '—';
  if (type === 'aadhaar') return `XXXX-XXXX-${String(val).slice(-4)}`;
  if (type === 'pan')     return `${val[0]}XXXX${String(val).slice(-4)}`;
  return val;
}

export default function StudentsPage() {
  const { dark } = useTheme();
  const [students, setStudents] = useState([]);
  const [stats, setStats]       = useState(null);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);

  // Modal
  const [modal, setModal]       = useState(null); // 'add' | 'edit' | 'extract'
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [modalError, setModalError] = useState(null);

  // Extract
  const [analyses, setAnalyses]     = useState([]);
  const [extractId, setExtractId]   = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);

  // Folder import + build
  const [folderModal, setFolderModal]       = useState(false);
  const [folderId, setFolderId]             = useState('');
  const [folderBuilding, setFolderBuilding] = useState(false);
  const [folderResult, setFolderResult]     = useState(null);
  const [folderError, setFolderError]       = useState(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  // Verify against Drive (SSE)
  const [verifyModal, setVerifyModal]         = useState(false);
  const [verifyFolder, setVerifyFolder] = useState(() => localStorage.getItem('verify_folder_id') || '');
  const [verifying, setVerifying]             = useState(false);
  const [driveVerifyRows, setDriveVerifyRows]     = useState([]);
  const [driveVerifyStatus, setDriveVerifyStatus] = useState('');
  const [driveVerifyTotal, setDriveVerifyTotal]   = useState(0);
  const [driveVerifyDone, setDriveVerifyDone]     = useState(false);
  const [driveVerifyError, setDriveVerifyError]   = useState(null);

  // Per-row verify
  const [rowVerifyingId, setRowVerifyingId]   = useState(null);
  const [rowVerifyResults, setRowVerifyResults] = useState({}); // studentId -> result
  const [verifyingAll, setVerifyingAll]         = useState(false);
  const stopVerifyAllRef                        = useRef(false);

  // Filter + detail modal
  const [filterUnverified, setFilterUnverified] = useState(false);
  const [detailStudent, setDetailStudent]       = useState(null);

  const card = dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
  const inputStyle = { background: dark ? '#1f2937' : '#f3f4f6', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, color: dark ? '#d1d5db' : '#374151', borderRadius: '10px', padding: '9px 12px', fontSize: 13, outline: 'none', width: '100%' };
  const labelColor   = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getStudents({ search, page, limit: 20 });
      setStudents(data.students || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {}
    setLoading(false);
  }, [search, page]);

  function getFieldJustification(field, passed, mismatch) {
    if (passed) return { color: '#10b981', headline: 'Match confirmed', detail: 'Value found in document.' };

    const ocrWeak = mismatch?.lowOcr;
    const chars   = mismatch?.textLen ?? 0;

    if (field === 'aadhaar') {
      if (mismatch?.found === 'not found') {
        if (ocrWeak) return { color: '#ef4444', headline: 'Aadhaar not readable — OCR quality too low', detail: `Only ${chars} characters were extracted from the Aadhaar image. The image may be blurry, low-resolution, or the scan is too dark/light for OCR to read the number.` };
        return { color: '#ef4444', headline: 'Aadhaar number not found in document', detail: 'The document does not contain any recognisable 12-digit Aadhaar number. This may be the wrong file, or the number is obscured.' };
      }
      if (ocrWeak) return { color: '#ef4444', headline: 'Aadhaar mismatch — OCR may have misread digits', detail: `Only ${chars} characters were extracted from the image. OCR likely misread some digits. The number shown below may not be accurate — consider re-scanning with a clearer image.` };
      return { color: '#ef4444', headline: 'Aadhaar number does not match', detail: 'The Aadhaar number in the database is different from what was found in the document. This could be a wrong document uploaded, or the number was entered incorrectly in the database.' };
    }
    if (field === 'pan') {
      if (mismatch?.found === 'not found') {
        if (ocrWeak) return { color: '#ef4444', headline: 'PAN not readable — OCR quality too low', detail: `Only ${chars} characters were extracted. The PAN card image may be unclear.` };
        return { color: '#ef4444', headline: 'PAN number not found in document', detail: 'No PAN number pattern was detected. This may not be a PAN card, or the image quality is insufficient.' };
      }
      if (ocrWeak) return { color: '#ef4444', headline: 'PAN mismatch — OCR may have misread', detail: `Only ${chars} characters extracted. OCR may have misread the PAN. Try re-scanning with a clearer image.` };
      return { color: '#ef4444', headline: 'PAN number does not match', detail: 'The PAN in the database differs from what was found in the document. Wrong document or data entry error.' };
    }
    if (field === 'phone') {
      return { color: '#ef4444', headline: 'Phone number not found in document', detail: 'The phone number stored in the database was not found anywhere in the document text.' };
    }
    if (field === 'name') {
      return { color: '#ef4444', headline: 'Name not matched in document', detail: 'The student name could not be matched in the extracted text. OCR may have misread the name, or this document belongs to a different person.' };
    }
    if (field === 'email') {
      return { color: '#ef4444', headline: 'Email not found in document', detail: 'The email address was not found in the document.' };
    }
    return { color: '#ef4444', headline: `${field} did not match`, detail: 'Value not found in document.' };
  }

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.getStudentStats().then(setStats).catch(() => {});
    api.getHistory().then(h => setAnalyses(h || [])).catch(() => {});
  }, [students]);

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModalError(null); setModal('add'); };
  const openEdit = (s) => { setForm({ rollNumber: s.rollNumber||'', name: s.name||'', aadhaar: s.aadhaar||'', phone: s.phone||'', pan: s.pan||'', dlNumber: s.dlNumber||'' }); setEditId(s.id); setModalError(null); setModal('edit'); };

  const handleSave = async () => {
    setSaving(true); setModalError(null);
    try {
      if (modal === 'add') await api.createStudent(form);
      else await api.updateStudent(editId, form);
      setModal(null); load();
    } catch (e) { setModalError(e.message); }
    setSaving(false);
  };

  const handleDelete = async () => {
    await api.deleteStudent(deleteId);
    setDeleteId(null); load();
  };

  const handleExtract = async () => {
    if (!extractId) return;
    setExtracting(true); setExtractResult(null);
    try {
      const res = await api.extractStudents(extractId);
      setExtractResult(res);
      load();
    } catch (e) { setExtractResult({ error: e.message }); }
    setExtracting(false);
  };

  const verifyFinishedRef = useRef(false);
  const verifyEsRef = useRef(null);
  const [verifyRefresh, setVerifyRefresh] = useState(false);
  const [verifySkipped, setVerifySkipped] = useState(0);

  // Live lookup map: studentId -> result, merges bulk SSE results + per-row results
  const liveVerifyMap = { ...rowVerifyResults, ...driveVerifyRows.reduce((acc, r) => { acc[r.id] = r; return acc; }, {}) };

  const handleVerify = () => {
    if (!verifyFolder.trim()) return;
    const raw = verifyFolder.trim();
    const match = raw.match(/\/folders\/([a-zA-Z0-9_-]{25,})/) || raw.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
    const resolvedId = match ? match[1] : raw;

    const refresh = verifyRefresh;
    verifyFinishedRef.current = false;
    setVerifying(true);
    setDriveVerifyRows([]);
    setDriveVerifyStatus('');
    setDriveVerifyTotal(0);
    setDriveVerifyDone(false);
    setDriveVerifyError(null);
    setVerifySkipped(0);

    const token = localStorage.getItem('auth_token') || '';
    const es = new EventSource(`http://localhost:5000/api/students/verify-drive-stream?folderId=${encodeURIComponent(resolvedId)}&refresh=${refresh}&token=${encodeURIComponent(token)}`);
    verifyEsRef.current = es;

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'status')   setDriveVerifyStatus(msg.message);
      if (msg.type === 'total')    { setDriveVerifyTotal(msg.total); setVerifySkipped(msg.skipped || 0); }
      if (msg.type === 'checking') setDriveVerifyStatus(`Checking: ${msg.name || msg.rollNumber || msg.id}`);
      if (msg.type === 'result')   setDriveVerifyRows(prev => [...prev, msg]);
      if (msg.type === 'done')     { verifyFinishedRef.current = true; setDriveVerifyDone(true); setVerifying(false); es.close(); verifyEsRef.current = null; load().then(() => setDriveVerifyRows([])); }
      if (msg.type === 'error')    { verifyFinishedRef.current = true; setDriveVerifyError(msg.message); setVerifying(false); es.close(); verifyEsRef.current = null; }
    };

    es.onerror = () => {
      if (verifyFinishedRef.current) return;
      setDriveVerifyError('Connection lost. Please try again.');
      setVerifying(false);
      es.close();
      verifyEsRef.current = null;
    };
  };

  const handleStopVerify = async () => {
    if (verifyEsRef.current) { verifyEsRef.current.close(); verifyEsRef.current = null; }
    verifyFinishedRef.current = true;
    setVerifying(false);
    setDriveVerifyStatus('Saving results…');
    // Save whatever has been verified so far to DB
    await Promise.all(
      driveVerifyRows.map(r =>
        api.updateStudent(r.id, { verified: r.verified, verifyResult: r })
          .catch(() => {})
      )
    );
    setDriveVerifyStatus('Stopped — partial results saved');
    load();
  };

  const handleVerifyRow = async (s) => {
    const folder = verifyFolder.trim();
    if (!folder) { setVerifyModal(true); return; }
    const raw = folder;
    const match = raw.match(/\/folders\/([a-zA-Z0-9_-]{25,})/) || raw.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
    const resolvedId = match ? match[1] : raw;
    setRowVerifyingId(s.id);
    try {
      const res = await api.verifyRow({ name: s.name, rollNumber: s.rollNumber, aadhaar: s.aadhaar, pan: s.pan, phone: s.phone, email: s.email }, resolvedId);
      setRowVerifyResults(prev => ({ ...prev, [s.id]: res }));
      if (res.verified !== undefined) await api.updateStudent(s.id, { verified: res.verified, verifyResult: res });
      load();
    } catch (e) {
      setRowVerifyResults(prev => ({ ...prev, [s.id]: { error: e.message } }));
    }
    setRowVerifyingId(null);
  };

  const handleVerifyAll = async () => {
    if (!verifyFolder.trim()) { setVerifyModal(true); return; }
    stopVerifyAllRef.current = false;
    setVerifyingAll(true);
    for (const s of students) {
      if (stopVerifyAllRef.current) break;
      await handleVerifyRow(s);
    }
    setVerifyingAll(false);
  };

  const handleStopVerifyAll = () => {
    stopVerifyAllRef.current = true;
    setVerifyingAll(false);
  };

  const handleBuildFromFolder = async () => {
    setFolderBuilding(true); setFolderResult(null); setFolderError(null);
    try {
      // Extract folder ID from URL if needed
      const raw = folderId.trim();
      const match = raw.match(/\/folders\/([a-zA-Z0-9_-]{25,})/) || raw.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
      const resolvedId = match ? match[1] : raw;
      // Step 1: import all files from folder into analyses
      const importRes = await api.importDriveFolder(resolvedId);
      if (importRes.error) throw new Error(importRes.error);
      const analysisIds = importRes.results.filter(r => r.analysisId).map(r => r.analysisId);
      if (!analysisIds.length) throw new Error('No files could be imported from this folder');
      // Step 2: extract students from all analyses
      const extractRes = await api.extractStudentsBulk(analysisIds);
      setFolderResult({ imported: importRes.total, analysisIds, ...extractRes });
      load();
    } catch (e) { setFolderError(e.message); }
    setFolderBuilding(false);
  };

  const exportCsv = async () => {
    try {
      const data = await api.getStudents({ search, page: 1, limit: 100000 });
      const all  = data.students || [];
      if (!all.length) { alert('No students to export'); return; }

      const headers = ['Roll Number', 'Name', 'Aadhaar', 'Phone', 'PAN', 'DL Number', 'Verified', 'Source File', 'Created At'];
      const escape  = v => `"${String(v || '').replace(/"/g, '""')}"`;
      const rows    = all.map(s => [
        s.rollNumber, s.name, s.aadhaar, s.phone, s.pan, s.dlNumber,
        s.verified ? 'Yes' : 'No',
        s.sourceFile,
        s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
      ].map(escape).join(','));

      const csv  = [headers.map(escape).join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `students_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Student Database</h2>
          <p className="text-sm mt-0.5" style={{ color: labelColor }}>{total} students · extracted from uploaded files</p>
        </div>
        <div className="flex gap-2">
          {verifyingAll ? (
            <button onClick={handleStopVerifyAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <X size={14} /> Stop
            </button>
          ) : (
            <button onClick={handleVerifyAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
              <ShieldCheck size={14} /> Verify All
            </button>
          )}
          <button onClick={() => { setExtractResult(null); setModal('extract'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
            <RefreshCw size={14} /> Extract from Analysis
          </button>
          <button onClick={() => { setFolderResult(null); setFolderError(null); setFolderId(''); setFolderModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(66,133,244,0.1)', color: '#4285f4', border: '1px solid rgba(66,133,244,0.2)' }}>
            <Download size={14} /> Build from Drive Folder
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
            <Plus size={14} /> Add Student
          </button>
        </div>
      </div>

      {/* Drive folder bar */}
      <div className="flex items-center gap-2 p-3 rounded-2xl" style={card}>
        <ShieldCheck size={14} style={{ color: verifying ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
        <input
          value={verifyFolder}
          onChange={e => { setVerifyFolder(e.target.value); localStorage.setItem('verify_folder_id', e.target.value); }}
          placeholder="Paste Drive folder URL or ID to enable per-row verify…"
          style={{ ...inputStyle, flex: 1, borderRadius: '8px', padding: '7px 10px' }}
        />
        {verifying && (
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', whiteSpace: 'nowrap' }}>
            <RefreshCw size={10} className="animate-spin" />
            {driveVerifyRows.length}/{driveVerifyTotal - verifySkipped} checking…
          </span>
        )}
        {!verifying && verifyFolder.trim() && (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', whiteSpace: 'nowrap' }}>
            ✓ folder set
          </span>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total',    value: stats.total,       color: '#6366f1' },
            { label: 'Verified', value: stats.verified,    color: '#10b981' },
            { label: 'Aadhaar',  value: stats.withAadhaar, color: '#4285f4' },
            { label: 'PAN',      value: stats.withPan,     color: '#f59e0b' },
            { label: 'DL',       value: stats.withDl,      color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-2xl text-center" style={card}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: labelColor }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, roll number, Aadhaar or phone…"
            style={{ ...inputStyle, paddingLeft: 34, borderRadius: '12px' }} />
        </div>
        <button
          onClick={() => { setFilterUnverified(f => !f); setPage(1); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
          style={filterUnverified
            ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }
            : { background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: labelColor, border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
          <ShieldX size={14} /> {filterUnverified ? 'Showing Not Verified' : 'Show Not Verified'}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: labelColor }}>Loading…</div>
        ) : students.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Users size={32} className="mx-auto" style={{ color: labelColor }} />
            <p className="text-sm font-semibold" style={{ color: headingColor }}>No students yet</p>
            <p className="text-xs" style={{ color: labelColor }}>Add manually or extract from an uploaded analysis</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                <tr>
                  {['Roll No.', 'Name', 'Aadhaar', 'Phone', 'Email', 'PAN', 'Match', 'Drive Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: labelColor }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students
                  .filter(s => {
                    if (!filterUnverified) return true;
                    const live = liveVerifyMap[s.id];
                    if (live) return !live.verified;
                    return !s.verified;
                  })
                  .map((s, i) => {
                  const live = liveVerifyMap[s.id];
                  const vr = live || s.verifyResult;
                  const matchPct = vr?.matchPct ?? null;
                  const isChecking = rowVerifyingId === s.id;
                  const rowBtnDisabled = rowVerifyingId === s.id || verifyingAll;
                  const isNotVerified = vr && !(live ? live.verified : s.verified);
                  return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => isNotVerified ? setDetailStudent({ s, vr }) : null}
                    style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, background: live ? (live.verified ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)') : s.verifyResult ? (s.verified ? 'rgba(16,185,129,0.02)' : 'rgba(239,68,68,0.02)') : 'transparent', cursor: isNotVerified ? 'pointer' : 'default' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#6366f1' }}>{s.rollNumber || '—'}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: headingColor }}>{s.name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: labelColor }}>{mask(s.aadhaar, 'aadhaar')}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: labelColor }}>{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: labelColor }}>{s.email || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: labelColor }}>{mask(s.pan, 'pan')}</td>
                    <td className="px-4 py-3">
                      {isChecking ? (
                        <span className="flex items-center gap-1 text-xs" style={{ color: labelColor }}><RefreshCw size={10} className="animate-spin" /> checking</span>
                      ) : matchPct === null ? (
                        <span className="text-xs" style={{ color: labelColor }}>—</span>
                      ) : matchPct === 100 ? (
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#10b981' }}><ShieldCheck size={12} /> {matchPct}%</span>
                      ) : matchPct >= 50 ? (
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#f59e0b' }}><ShieldAlert size={12} /> {matchPct}%</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#ef4444' }}><ShieldX size={12} /> {matchPct}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {/* Live result during streaming */}
                      {live ? (
                        <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
                          style={{ background: live.verified ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: live.verified ? '#10b981' : '#ef4444' }}>
                          {live.verified ? <CheckCircle size={11} /> : <X size={11} />}
                          {live.verified ? 'Verified' : 'Not Verified'}
                        </motion.span>
                      ) : isChecking ? (
                        <span className="flex items-center gap-1 text-xs" style={{ color: labelColor }}>
                          <RefreshCw size={10} className="animate-spin" /> checking...
                        </span>
                      ) : s.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                          <CheckCircle size={11} /> Verified
                        </span>
                      ) : s.verifyResult ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                          <X size={11} /> Not Verified
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: labelColor }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                          <Edit2 size={12} style={{ color: '#6366f1' }} />
                        </button>
                        <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 size={12} style={{ color: '#ef4444' }} />
                        </button>
                        <button
                          onClick={() => handleVerifyRow(s)}
                          disabled={rowBtnDisabled}
                          title={verifyFolder.trim() ? (verifying ? 'Bulk verify running…' : 'Verify this student') : 'Set Drive folder first'}
                          className="p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-40">
                          {(rowVerifyingId === s.id || isChecking)
                            ? <RefreshCw size={12} className="animate-spin" style={{ color: '#f59e0b' }} />
                            : <ShieldCheck size={12} style={{ color: verifyFolder.trim() ? '#f59e0b' : labelColor }} />}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
            <span className="text-xs" style={{ color: labelColor }}>Page {page} of {pages} · {total} students</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: labelColor }}>
                <ChevronLeft size={14} />
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: labelColor }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {(modal === 'add' || modal === 'edit') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: dark ? '#0a0f1e' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <p className="text-sm font-bold" style={{ color: headingColor }}>{modal === 'add' ? 'Add Student' : 'Edit Student'}</p>
                <button onClick={() => setModal(null)} style={{ color: labelColor }}><X size={16} /></button>
              </div>
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: labelColor }}>{label}</label>
                    <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} style={inputStyle} />
                  </div>
                ))}
                {modalError && <p className="text-xs" style={{ color: '#ef4444' }}>{modalError}</p>}
              </div>
              <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extract Modal */}
      <AnimatePresence>
        {modal === 'extract' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: dark ? '#0a0f1e' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <p className="text-sm font-bold" style={{ color: headingColor }}>Extract Students from Analysis</p>
                <button onClick={() => setModal(null)} style={{ color: labelColor }}><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs" style={{ color: labelColor }}>
                  Select an analysis to automatically extract student records (roll number, name, Aadhaar, phone, PAN, DL) from its data.
                </p>
                <select value={extractId} onChange={e => setExtractId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select an analysis…</option>
                  {analyses.map(a => (
                    <option key={a.id} value={a.id}>{a.fileName} — {new Date(a.createdAt).toLocaleDateString()}</option>
                  ))}
                </select>

                {extractResult && (
                  <div className="p-3 rounded-xl text-xs space-y-1"
                    style={{ background: extractResult.error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${extractResult.error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, color: extractResult.error ? '#ef4444' : '#10b981' }}>
                    {extractResult.error ? extractResult.error : (
                      <>
                        <p className="font-semibold">Extraction complete</p>
                        <p>Created: {extractResult.created} · Updated: {extractResult.updated} · Skipped: {extractResult.skipped}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
                  Close
                </button>
                <button onClick={handleExtract} disabled={!extractId || extracting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                  {extracting ? <><RefreshCw size={13} className="animate-spin" /> Extracting…</> : 'Extract'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDeleteId(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4"
              style={{ background: dark ? '#0a0f1e' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
              <p className="text-sm font-bold text-center" style={{ color: headingColor }}>Delete this student?</p>
              <p className="text-xs text-center" style={{ color: labelColor }}>This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
                  Cancel
                </button>
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder Build Modal */}
      <AnimatePresence>
        {folderModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setFolderModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: dark ? '#0a0f1e' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <p className="text-sm font-bold" style={{ color: headingColor }}>Build Database from Drive Folder</p>
                <button onClick={() => setFolderModal(false)} style={{ color: labelColor }}><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs" style={{ color: labelColor }}>
                  Paste the Google Drive <strong style={{ color: headingColor }}>folder ID</strong> (or full folder URL). All PDFs, images, and documents inside will be imported and student data extracted automatically.
                </p>
                <input
                  value={folderId}
                  onChange={e => setFolderId(e.target.value)}
                  placeholder="Folder ID or https://drive.google.com/drive/folders/…"
                  style={inputStyle}
                />
                <p className="text-xs" style={{ color: labelColor }}>
                  Tip: the folder ID is the last part of the folder URL after <code>/folders/</code>
                </p>

                {folderBuilding && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#4285f4' }}>
                    <RefreshCw size={13} className="animate-spin" />
                    Importing files and extracting student data… this may take a moment.
                  </div>
                )}

                {folderResult && (
                  <div className="p-3 rounded-xl text-xs space-y-1"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
                    <p className="font-semibold">Done!</p>
                    <p>Files imported: {folderResult.imported} · Analyses created: {folderResult.analysisIds?.length}</p>
                    <p>Students created: {folderResult.created} · Updated: {folderResult.updated} · Skipped: {folderResult.skipped}</p>
                    {folderResult.errors?.length > 0 && (
                      <p style={{ color: '#f59e0b' }}>{folderResult.errors.length} file(s) had errors</p>
                    )}
                  </div>
                )}

                {folderError && (
                  <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    {folderError}
                  </div>
                )}
              </div>
              <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <button onClick={() => setFolderModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
                  Close
                </button>
                <button onClick={handleBuildFromFolder} disabled={!folderId.trim() || folderBuilding}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#4285f4,#34a853)' }}>
                  {folderBuilding ? <><RefreshCw size={13} className="animate-spin" /> Building…</> : 'Build Database'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verify vs Drive Modal */}
      <AnimatePresence>
        {verifyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setVerifyModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: dark ? '#0a0f1e' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} style={{ color: '#f59e0b' }} />
                  <p className="text-sm font-bold" style={{ color: headingColor }}>Verify Database vs Drive Documents</p>
                </div>
                <button onClick={() => setVerifyModal(false)} style={{ color: labelColor }}><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs" style={{ color: labelColor }}>
                  Paste the Google Drive folder URL or ID that contains the PDFs, images and documents. Each student's name, Aadhaar, phone and email will be checked against the text extracted from those files.
                </p>
                <input value={verifyFolder} onChange={e => { setVerifyFolder(e.target.value); localStorage.setItem('verify_folder_id', e.target.value); }}
                  placeholder="https://drive.google.com/drive/folders/… or folder ID"
                  style={inputStyle} />

                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: labelColor }}>
                  <input type="checkbox" checked={verifyRefresh} onChange={e => setVerifyRefresh(e.target.checked)} />
                  Re-scan Drive files (ignore cache)
                </label>

                {(verifying || driveVerifyStatus) && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#f59e0b' }}>
                    {verifying && <RefreshCw size={13} className="animate-spin" />}
                    {driveVerifyStatus || 'Starting…'}
                    {driveVerifyTotal > 0 && ` (${driveVerifyRows.length}/${driveVerifyTotal - verifySkipped})`}
                    {verifySkipped > 0 && <span style={{ color: '#10b981' }}>· {verifySkipped} already verified, skipped</span>}
                  </div>
                )}

                {(driveVerifyDone || driveVerifyRows.length > 0) && (
                  <div className="space-y-3">
                    {driveVerifyDone && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Total',   value: driveVerifyTotal,                               color: '#6366f1' },
                          { label: 'Matched', value: driveVerifyRows.filter(r => r.verified).length, color: '#10b981' },
                          { label: 'Failed',  value: driveVerifyRows.filter(r => !r.verified).length, color: '#ef4444' },
                        ].map(s => (
                          <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-xs" style={{ color: labelColor }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {driveVerifyRows.map(r => (
                        <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
                          style={{ background: r.verified ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)' }}>
                          {r.verified ? <ShieldCheck size={12} style={{ color: '#10b981' }} /> : <ShieldX size={12} style={{ color: '#ef4444' }} />}
                          <span className="flex-1 font-semibold" style={{ color: headingColor }}>{r.name || r.rollNumber || `ID ${r.id}`}</span>
                          <span style={{ color: r.matchPct === 100 ? '#10b981' : r.matchPct >= 50 ? '#f59e0b' : '#ef4444' }}>{r.matchPct}%</span>
                          <span style={{ color: labelColor }} className="truncate max-w-[140px]" title={r.matchedFile}>
                            {r.folderName ? `📁 ${r.folderName}` : 'no folder'}
                            {r.filesChecked ? ` · ${r.filesChecked} files` : ''}
                          </span>
                          <span style={{ color: labelColor }}>
                            {Object.entries(r.checks || {}).map(([k, v]) => (
                              <span key={k} className="ml-1" style={{ color: v ? '#10b981' : '#ef4444' }}>{k[0].toUpperCase()}</span>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {driveVerifyError && (
                  <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    {driveVerifyError}
                  </div>
                )}
              </div>
              <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <button onClick={() => setVerifyModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
                  Close
                </button>
                {verifying && (
                  <button onClick={handleStopVerify}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                    <X size={13} /> Stop
                  </button>
                )}
                {!verifying && (
                  <button onClick={handleVerify} disabled={!verifyFolder.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <ShieldCheck size={13} /> {driveVerifyDone ? 'Run Again' : 'Run Verification'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not-Verified Detail Modal */}
      <AnimatePresence>
        {detailStudent && (() => {
          const { s, vr } = detailStudent;
          const checks = vr?.checks || {};
          const noFolder = vr?.note && vr.note.toLowerCase().includes('no');
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              onClick={() => setDetailStudent(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: dark ? '#0a0f1e' : '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: 'rgba(239,68,68,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <ShieldX size={16} style={{ color: '#ef4444' }} />
                    <p className="text-sm font-bold" style={{ color: '#ef4444' }}>Why Verification Failed</p>
                  </div>
                  <button onClick={() => setDetailStudent(null)} style={{ color: labelColor }}><X size={16} /></button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

                  {/* Student identity row */}
                  <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                      {(s.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: headingColor }}>{s.name || '—'}</p>
                      <p className="text-xs" style={{ color: labelColor }}>{s.rollNumber || 'No roll number'}</p>
                    </div>
                    {vr?.matchPct != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold" style={{ color: vr.matchPct >= 50 ? '#f59e0b' : '#ef4444' }}>{vr.matchPct}%</p>
                        <p className="text-xs" style={{ color: labelColor }}>match</p>
                      </div>
                    )}
                  </div>

                  {/* No folder found */}
                  {noFolder && (
                    <div className="flex items-start gap-3 px-3 py-3 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <ShieldX size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#ef4444' }}>No matching folder found in Drive</p>
                        <p className="text-xs mt-0.5" style={{ color: labelColor }}>No subfolder matched this student's roll number or name. Make sure the Drive folder contains a subfolder named after this student or their roll number.</p>
                      </div>
                    </div>
                  )}

                  {/* Matched folder */}
                  {vr?.folderName && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                      <span>📁</span>
                      <span style={{ color: labelColor }}>Checked folder:</span>
                      <span className="font-semibold" style={{ color: headingColor }}>{vr.folderName}</span>
                    </div>
                  )}

                  {/* Per-field justification */}
                  {!noFolder && Object.keys(checks).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: labelColor }}>Field-by-field result</p>
                      {Object.entries(checks).map(([field, passed]) => {
                        const mismatch = (vr?.mismatchedNumbers || []).find(m => m.field === field);
                        const j = getFieldJustification(field, passed, mismatch);
                        return (
                          <div key={field} className="rounded-xl overflow-hidden"
                            style={{ border: `1px solid ${passed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.25)'}` }}>
                            {/* Field header */}
                            <div className="flex items-center gap-2 px-3 py-2"
                              style={{ background: passed ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)' }}>
                              {passed
                                ? <CheckCircle size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                                : <X size={13} style={{ color: '#ef4444', flexShrink: 0 }} />}
                              <span className="text-xs font-bold capitalize flex-1" style={{ color: headingColor }}>{field}</span>
                              <span className="text-xs font-bold" style={{ color: j.color }}>{passed ? 'PASS' : 'FAIL'}</span>
                            </div>
                            {/* Justification body */}
                            {!passed && (
                              <div className="px-3 py-2.5 space-y-1.5"
                                style={{ background: dark ? 'rgba(239,68,68,0.03)' : 'rgba(239,68,68,0.02)' }}>
                                <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>{j.headline}</p>
                                <p className="text-xs leading-relaxed" style={{ color: labelColor }}>{j.detail}</p>
                                {mismatch && mismatch.found !== 'not found' && (
                                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                    <div className="px-2 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)' }}>
                                      <p className="text-xs" style={{ color: labelColor }}>In database</p>
                                      <p className="text-xs font-mono font-bold mt-0.5" style={{ color: '#ef4444' }}>{mismatch.expected}</p>
                                    </div>
                                    <div className="px-2 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)' }}>
                                      <p className="text-xs" style={{ color: labelColor }}>Found in document</p>
                                      <p className="text-xs font-mono font-bold mt-0.5" style={{ color: '#f59e0b' }}>{mismatch.found}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No checks at all */}
                  {!noFolder && Object.keys(checks).length === 0 && (
                    <div className="flex items-start gap-3 px-3 py-3 rounded-xl"
                      style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <ShieldAlert size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>No fields could be checked</p>
                        <p className="text-xs mt-0.5" style={{ color: labelColor }}>The folder was found but no readable text could be extracted. The documents may be scanned images with poor quality, password-protected, or in an unsupported format.</p>
                      </div>
                    </div>
                  )}

                  {/* Backend note */}
                  {vr?.note && !noFolder && (
                    <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>{vr.note}</p>
                  )}
                </div>

                <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <button onClick={() => setDetailStudent(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: labelColor }}>
                    Close
                  </button>
                  <button onClick={() => { setDetailStudent(null); handleVerifyRow(s); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <RefreshCw size={13} /> Re-verify
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
