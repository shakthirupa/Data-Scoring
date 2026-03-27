import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileText, FileSpreadsheet, FileJson, Database, Link, ChevronRight, Table, CheckCircle } from 'lucide-react';
import { useTheme } from './ThemeContext';
import api from './api';

const FILE_TYPES = [
  { id: 'csv',    label: 'CSV',           ext: '.csv',         icon: FileText,        desc: 'Comma-separated values',       accept: '.csv',        hasSheets: false },
  { id: 'tsv',    label: 'TSV',           ext: '.tsv',         icon: FileText,        desc: 'Tab-separated values',         accept: '.tsv',        hasSheets: false },
  { id: 'excel',  label: 'Excel',         ext: '.xlsx / .xls', icon: FileSpreadsheet, desc: 'Microsoft Excel workbook',     accept: '.xlsx,.xls',  hasSheets: true  },
  { id: 'ods',    label: 'ODS',           ext: '.ods',         icon: FileSpreadsheet, desc: 'LibreOffice / OpenDocument',   accept: '.ods',        hasSheets: true  },
  { id: 'json',   label: 'JSON',          ext: '.json',        icon: FileJson,        desc: 'Array of records or wrapped',  accept: '.json',       hasSheets: false },
  { id: 'ndjson', label: 'NDJSON',        ext: '.ndjson',      icon: FileJson,        desc: 'Newline-delimited JSON',       accept: '.ndjson',     hasSheets: false },
  { id: 'xml',    label: 'XML',           ext: '.xml',         icon: FileText,        desc: 'Repeated element list',        accept: '.xml',        hasSheets: false },
  { id: 'sql',    label: 'SQL',           ext: '.sql',         icon: Database,        desc: 'INSERT INTO statements',       accept: '.sql',        hasSheets: false },
  { id: 'gsheet', label: 'Google Sheets', ext: 'URL',          icon: Link,            desc: 'Paste a public share link',    accept: null,          hasSheets: false },
];

// ── Sheet picker modal ────────────────────────────────────────────────────────
function SheetPicker({ sheets, fileName, onSelect, onCancel, dark }) {
  const [selected, setSelected] = useState(sheets[0]?.name || '');
  const bg = dark ? '#0a0f1e' : '#ffffff';
  const border = dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)';
  const rowHover = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const labelColor = dark ? '#f9fafb' : '#111827';
  const subColor = dark ? '#6b7280' : '#9ca3af';
  const activeRow = dark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{ background: bg, border, boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: border }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Table size={15} style={{ color: '#10b981' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: labelColor }}>Select a sheet</p>
              <p className="text-xs mt-0.5 truncate max-w-[220px]" style={{ color: subColor }}>{fileName}</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: subColor }}>
            <X size={14} />
          </button>
        </div>

        {/* Sheet list */}
        <div className="py-2 max-h-72 overflow-y-auto">
          {sheets.map((sheet) => {
            const isSelected = selected === sheet.name;
            return (
              <button key={sheet.name} onClick={() => setSelected(sheet.name)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                style={{ background: isSelected ? activeRow : 'transparent' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = rowHover; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>

                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isSelected ? 'rgba(16,185,129,0.15)' : dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isSelected ? 'rgba(16,185,129,0.3)' : 'transparent'}` }}>
                  <FileSpreadsheet size={14} style={{ color: isSelected ? '#10b981' : subColor }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: labelColor }}>{sheet.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: subColor }}>
                    {sheet.rowCount.toLocaleString()} rows · {sheet.columnCount} columns
                    {sheet.columns?.length > 0 && (
                      <span className="ml-1">· {sheet.columns.slice(0, 3).join(', ')}{sheet.columns.length > 3 ? '…' : ''}</span>
                    )}
                  </p>
                </div>

                {isSelected && <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: border }}>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: subColor }}>
            Cancel
          </button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onSelect(selected)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
            Analyse "{selected}"
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main FileUpload component ─────────────────────────────────────────────────
function FileUpload({ onAnalysisComplete, large }) {
  const { dark } = useTheme();
  const [showPicker, setShowPicker] = useState(false);   // file type modal
  const [chosen, setChosen] = useState(null);            // FILE_TYPES entry
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Sheet picker state
  const [sheets, setSheets] = useState(null);            // array of sheet info
  const [tempId, setTempId] = useState(null);            // server-side temp file id
  const [loadingSheets, setLoadingSheets] = useState(false);

  const fileInputRef = useRef();
  const modalRef = useRef();

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e) => { if (modalRef.current && !modalRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const reset = () => {
    setChosen(null); setFile(null); setUrl(''); setError(null);
    setShowPicker(false); setSheets(null); setTempId(null); setLoadingSheets(false);
  };

  const selectType = (type) => {
    setChosen(type);
    setFile(null); setUrl(''); setError(null); setSheets(null); setTempId(null);
    setShowPicker(false);
    if (type.accept) setTimeout(() => fileInputRef.current?.click(), 50);
  };

  // When a file is chosen from OS picker
  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setError(null); setSheets(null); setTempId(null);

    // If Excel/ODS — fetch sheet names before showing analyze button
    if (chosen?.hasSheets) {
      setLoadingSheets(true);
      try {
        const data = await api.getSheets(f);
        if (data.error) throw new Error(data.error);
        if (data.sheets.length === 1) {
          // Only one sheet — skip picker, go straight to analyze
          setTempId(data.tempId);
          setSheets(null);
        } else {
          setTempId(data.tempId);
          setSheets(data.sheets);
        }
      } catch (err) {
        setError(err.message || 'Could not read sheets');
      } finally {
        setLoadingSheets(false);
      }
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Called when user picks a sheet from the picker
  const handleSheetSelect = async (sheetName) => {
    setSheets(null);
    await runAnalysis({ sheetName });
  };

  const handleAnalyze = async () => {
    if (chosen?.id === 'gsheet') {
      await runAnalysis({});
    } else if (chosen?.hasSheets && sheets) {
      // sheets modal is open — wait for user to pick
    } else {
      await runAnalysis({});
    }
  };

  const runAnalysis = async ({ sheetName } = {}) => {
    setLoading(true); setError(null);
    try {
      let result;
      if (chosen?.id === 'gsheet') {
        if (!url.trim()) throw new Error('Please paste a Google Sheets URL');
        result = await api.uploadFromUrl(url.trim());
      } else if (tempId) {
        // Re-use pre-uploaded temp file with chosen sheet
        result = await api.uploadFile(null, sheetName || null, tempId, file?.name);
      } else {
        if (!file) throw new Error('Please choose a file');
        result = await api.uploadFile(file, sheetName || null);
      }
      if (result.error) throw new Error(result.error);
      if (onAnalysisComplete) onAnalysisComplete(result);
      reset();
    } catch (err) {
      setError(err.message || 'Upload failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const bg = dark ? '#0a0f1e' : '#ffffff';
  const border = dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)';
  const rowHover = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const inputBg = dark ? '#1f2937' : '#f3f4f6';
  const inputText = dark ? '#d1d5db' : '#374151';
  const inputBorder = dark ? '1px solid #374151' : '1px solid #e5e7eb';
  const labelColor = dark ? '#f9fafb' : '#111827';
  const subColor = dark ? '#6b7280' : '#9ca3af';

  // Can proceed to analyze: gsheet needs url, excel needs tempId (sheets resolved), others need file
  const canAnalyze = chosen?.id === 'gsheet'
    ? !!url.trim()
    : chosen?.hasSheets
      ? !!tempId && !sheets  // tempId set and sheet picker not open
      : !!file;

  const uploadBtn = (btnLarge) => (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={() => setShowPicker(true)}
      className={`flex items-center gap-2 font-semibold rounded-xl text-white ${btnLarge ? 'px-8 py-3 text-base' : 'px-4 py-2 text-sm'}`}
      style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}>
      <Upload size={btnLarge ? 18 : 14} />
      Upload File
    </motion.button>
  );

  // File type picker modal
  const typePicker = (
    <AnimatePresence>
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <motion.div ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.18 }}
            className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
            style={{ background: bg, border, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: border }}>
              <div>
                <p className="text-sm font-bold" style={{ color: labelColor }}>Choose file type</p>
                <p className="text-xs mt-0.5" style={{ color: subColor }}>Select the format you want to analyse</p>
              </div>
              <button onClick={() => setShowPicker(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: subColor }}>
                <X size={14} />
              </button>
            </div>

            <div className="py-2 max-h-[420px] overflow-y-auto">
              {FILE_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <motion.button key={type.id} whileHover={{ x: 2 }}
                    onClick={() => selectType(type)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background = rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: dark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <Icon size={16} style={{ color: '#10b981' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: labelColor }}>{type.label}</p>
                      <p className="text-xs" style={{ color: subColor }}>{type.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
                        style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: subColor }}>
                        {type.ext}
                      </span>
                      {type.hasSheets && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>sheets</span>
                      )}
                      <ChevronRight size={13} style={{ color: subColor }} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const hiddenInput = (
    <input ref={fileInputRef} type="file" accept={chosen?.accept || '*'} className="hidden"
      onChange={handleFileChange} />
  );

  // After type chosen: selected state row
  const selectedState = chosen && (
    <div className="flex items-center gap-2 flex-wrap">
      {chosen.id === 'gsheet' ? (
        <input value={url} onChange={e => { setUrl(e.target.value); setError(null); }}
          placeholder="Paste Google Sheets share URL..."
          className={`rounded-xl text-sm outline-none ${large ? 'px-4 py-3 w-72' : 'px-3 py-2 w-52'}`}
          style={{ background: inputBg, color: inputText, border: inputBorder }}
          autoFocus />
      ) : (
        <button onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 rounded-xl text-sm font-medium transition-all ${large ? 'px-5 py-3' : 'px-4 py-2'}`}
          style={{ background: inputBg, color: inputText, border: inputBorder }}>
          <chosen.icon size={14} style={{ color: '#10b981' }} />
          {loadingSheets
            ? 'Reading sheets…'
            : file
              ? (file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name)
              : `Choose ${chosen.label} file`
          }
          {chosen.hasSheets && !file && (
            <span className="text-xs ml-1 px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>multi-sheet</span>
          )}
        </button>
      )}

      {/* Sheet count badge */}
      {tempId && !sheets && file && chosen?.hasSheets && (
        <span className="text-xs px-2 py-1 rounded-lg font-medium"
          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle size={11} className="inline mr-1" />Sheet selected
        </span>
      )}

      {canAnalyze && (
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleAnalyze} disabled={loading}
          className={`text-white font-semibold rounded-xl disabled:opacity-50 ${large ? 'px-8 py-3' : 'px-4 py-2 text-sm'}`}
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 2px 12px rgba(16,185,129,0.3)' }}>
          {loading ? 'Analyzing…' : large ? 'Analyze Now' : 'Analyze'}
        </motion.button>
      )}

      <button onClick={reset} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="w-full text-xs text-red-500">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      <div className={large ? 'flex flex-col items-center gap-3' : 'flex items-center gap-2 flex-wrap'}>
        {!chosen ? uploadBtn(large) : selectedState}
        {typePicker}
        {hiddenInput}
      </div>

      {/* Sheet picker modal — rendered outside the button row */}
      <AnimatePresence>
        {sheets && (
          <SheetPicker
            sheets={sheets}
            fileName={file?.name || ''}
            onSelect={handleSheetSelect}
            onCancel={() => { setSheets(null); setTempId(null); setFile(null); }}
            dark={dark}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default FileUpload;
