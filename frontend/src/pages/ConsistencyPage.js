import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Plus, Trash2, ToggleLeft, ToggleRight, Play, ChevronDown } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import api from '../api';

function useCard() {
  const { dark } = useTheme();
  return dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };
}

const SEV_COLOR = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#6366f1' };

export default function ConsistencyPage() {
  const { dark } = useTheme();
  const card = useCard();
  const [rulesData, setRulesData] = useState({ byCategory: {}, rules: [] });
  const [analyses, setAnalyses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [validateResult, setValidateResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({ ruleId: '', name: '', severity: 'Medium', category: 'Custom', expression: '', message: '' });
  const [addStatus, setAddStatus] = useState(null);
  const [openCat, setOpenCat] = useState(null);

  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const headingColor = dark ? '#f9fafb' : '#111827';
  const inputStyle = { background: dark ? '#1f2937' : '#f3f4f6', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, color: dark ? '#d1d5db' : '#374151', borderRadius: '10px', padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%' };

  const load = () => api.getConsistencyRules().then(d => setRulesData(d)).catch(() => {});

  useEffect(() => {
    load();
    api.getHistory().then(d => { const list = Array.isArray(d) ? d : []; setAnalyses(list); if (list.length) setSelectedId(list[0].id); }).catch(() => {});
  }, []);

  const handleValidate = async () => {
    if (!selectedId) return;
    setValidating(true); setValidateResult(null);
    const result = await api.validateConsistency(selectedId);
    setValidateResult(result);
    setValidating(false);
  };

  const handleAddRule = async () => {
    setAddStatus('saving');
    const result = await api.addConsistencyRule(newRule);
    if (result.error) { setAddStatus('error'); return; }
    setAddStatus('saved');
    setNewRule({ ruleId: '', name: '', severity: 'Medium', category: 'Custom', expression: '', message: '' });
    setShowAddForm(false);
    load();
    setTimeout(() => setAddStatus(null), 2000);
  };

  const handleRemove = async (ruleId) => {
    await api.removeConsistencyRule(ruleId);
    load();
  };

  const categories = Object.entries(rulesData.byCategory || {});

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Cognitive Consistency Engine</h2>
          <p className="text-sm mt-0.5" style={{ color: labelColor }}>Cross-field logical validation rules and dataset consistency scoring</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            {analyses.map(a => <option key={a.id} value={a.id}>#{a.id} — {a.fileName}</option>)}
          </select>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleValidate} disabled={validating || !selectedId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <Play size={13} />{validating ? 'Running…' : 'Run Validation'}
          </motion.button>
        </div>
      </div>

      {/* Validation result */}
      <AnimatePresence>
        {validateResult && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-5 rounded-2xl" style={card}>
            <div className="flex items-center gap-4 flex-wrap mb-4">
              <div>
                <p className="text-xs" style={{ color: labelColor }}>Consistency Score</p>
                <p className="text-3xl font-bold" style={{ color: validateResult.consistencyScore >= 80 ? '#10b981' : validateResult.consistencyScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {validateResult.consistencyScore}%
                </p>
              </div>
              <div><p className="text-xs" style={{ color: labelColor }}>Flagged Rows</p><p className="text-2xl font-bold" style={{ color: '#f97316' }}>{validateResult.flaggedCount}</p></div>
              <div><p className="text-xs" style={{ color: labelColor }}>Clean Rows</p><p className="text-2xl font-bold" style={{ color: '#10b981' }}>{validateResult.cleanCount}</p></div>
            </div>
            {validateResult.ruleSummary?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold mb-2" style={{ color: labelColor }}>Rule Hits</p>
                {validateResult.ruleSummary.slice(0, 8).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg"
                    style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEV_COLOR[r.severity] || '#6b7280' }} />
                    <span className="flex-1" style={{ color: headingColor }}>{r.name}</span>
                    <span className="font-bold" style={{ color: SEV_COLOR[r.severity] }}>{r.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules by category */}
      <div className="space-y-3">
        {categories.map(([cat, rules]) => (
          <div key={cat} className="rounded-2xl overflow-hidden" style={card}>
            <button onClick={() => setOpenCat(openCat === cat ? null : cat)}
              className="w-full flex items-center gap-3 p-4">
              <span className="text-sm font-bold" style={{ color: headingColor }}>{cat}</span>
              <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{rules.length}</span>
              <ChevronDown size={13} className={`ml-auto transition-transform ${openCat === cat ? 'rotate-180' : ''}`} style={{ color: labelColor }} />
            </button>
            <AnimatePresence>
              {openCat === cat && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1.5">
                    {rules.map(rule => (
                      <div key={rule.id} className="flex items-center gap-3 p-2.5 rounded-xl text-xs"
                        style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEV_COLOR[rule.severity] || '#6b7280' }} />
                        <span className="flex-1 font-medium" style={{ color: headingColor }}>{rule.name}</span>
                        <span className="font-mono" style={{ color: labelColor }}>{rule.id}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: `${SEV_COLOR[rule.severity]}15`, color: SEV_COLOR[rule.severity] }}>{rule.severity}</span>
                        {!rule.builtin && (
                          <button onClick={() => handleRemove(rule.id)} className="text-red-400 hover:text-red-500 ml-1"><Trash2 size={12} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Add custom rule */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        <button onClick={() => setShowAddForm(o => !o)} className="w-full flex items-center gap-2 p-4">
          <Plus size={14} style={{ color: '#10b981' }} />
          <span className="text-sm font-bold" style={{ color: headingColor }}>Add Custom Rule</span>
          <ChevronDown size={13} className={`ml-auto transition-transform ${showAddForm ? 'rotate-180' : ''}`} style={{ color: labelColor }} />
        </button>
        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-5 pb-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[['ruleId', 'Rule ID (e.g. MY_RULE)'], ['name', 'Rule Name']].map(([k, ph]) => (
                    <div key={k}>
                      <label className="block text-xs font-semibold mb-1" style={{ color: labelColor }}>{ph}</label>
                      <input value={newRule[k]} onChange={e => setNewRule(r => ({ ...r, [k]: e.target.value }))} placeholder={ph} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: labelColor }}>Severity</label>
                    <select value={newRule.severity} onChange={e => setNewRule(r => ({ ...r, severity: e.target.value }))} style={inputStyle}>
                      {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: labelColor }}>Category</label>
                    <input value={newRule.category} onChange={e => setNewRule(r => ({ ...r, category: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: labelColor }}>JS Expression (use `row.fieldName`)</label>
                  <input value={newRule.expression} onChange={e => setNewRule(r => ({ ...r, expression: e.target.value }))} placeholder="Number(row.age) < 16 && /bachelor/i.test(row.degree || '')" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: labelColor }}>Violation Message</label>
                  <input value={newRule.message} onChange={e => setNewRule(r => ({ ...r, message: e.target.value }))} placeholder="Age is too young for this degree" style={inputStyle} />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddRule}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: addStatus === 'saved' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                  {addStatus === 'saving' ? 'Adding…' : addStatus === 'saved' ? '✓ Rule Added!' : addStatus === 'error' ? 'Error — check fields' : 'Add Rule'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
