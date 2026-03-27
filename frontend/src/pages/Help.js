import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Upload, BarChart2, Search, Activity, Fingerprint, ShieldCheck, Lock, FileText } from 'lucide-react';
import { useTheme } from '../ThemeContext';

const GUIDES = [
  { icon: Upload,      color: '#10b981', title: 'Upload a Dataset',         desc: 'Click "Upload File" on the dashboard. Choose your file type (CSV, Excel, JSON, XML, SQL, Google Sheets) from the picker. For Excel files with multiple sheets, you\'ll be prompted to select which sheet to analyse.' },
  { icon: BarChart2,   color: '#6366f1', title: 'Read Your Quality Score',  desc: 'After upload, the dashboard shows your overall score (0–100) plus four dimension scores: Completeness, Uniqueness, Validity, and Consistency. A grade (A–D) summarises the result.' },
  { icon: Search,      color: '#ef4444', title: 'Data Forensics',           desc: 'Go to AI Features → Data Forensics. Select an analysis to see a root cause event chain, anomaly timeline (searchable row-by-row), and deep column profiles with outlier detection.' },
  { icon: Activity,    color: '#f59e0b', title: 'Predictive Integrity',     desc: 'Go to AI Features → Predictive Index. Upload the same dataset repeatedly over time to build a trend history. The engine uses regression and EMA to forecast future quality and flag degradation risk.' },
  { icon: Fingerprint, color: '#3b82f6', title: 'Fingerprinting',           desc: 'Go to AI Features → Fingerprinting. Every upload generates a SHA-256 composite fingerprint. Use the Compare tab to detect duplicate datasets, schema changes, or near-identical files with different names.' },
  { icon: ShieldCheck, color: '#10b981', title: 'Consistency Engine',       desc: 'Go to AI Features → Consistency. Run 19 built-in cross-field rules (age vs degree, salary vs job title, city vs country, etc.) against any dataset. Add your own custom JS rules from the same page.' },
  { icon: Lock,        color: '#6366f1', title: 'DigiLocker Verification',  desc: 'Go to AI Features → DigiLocker. Enter an Aadhaar (12 digits) or PAN number to verify it. Use Mock mode for testing (try 123456789012). Switch to Live mode and add your API credentials for real verification.' },
  { icon: FileText,    color: '#f97316', title: 'Download Reports',         desc: 'Go to Reports in the sidebar. Download any analysis as a JSON report or export your full history as a CSV file.' },
];

const FAQS = [
  { q: 'What file formats are supported?', a: 'CSV, TSV, Excel (.xlsx/.xls), ODS, JSON, NDJSON, XML, SQL (INSERT INTO statements), and Google Sheets via public share URL. For Excel/ODS files with multiple sheets, a sheet picker appears after selecting the file.' },
  { q: 'How is the Overall Score calculated?', a: 'It\'s a weighted combination: Completeness (30%) + Uniqueness (20%) + Validity (30%) + Consistency (20%), minus a penalty for the percentage of problem rows. The final score ranges from 0–100.' },
  { q: 'What is Completeness?', a: 'The percentage of cells that have non-null, non-empty values across all rows and columns.' },
  { q: 'What is Uniqueness?', a: 'The percentage of rows that are not exact duplicates of another row in the dataset.' },
  { q: 'What is Validity?', a: 'The percentage of filled cells that pass format validation — correct email formats, valid dates, valid phone numbers, non-negative amounts.' },
  { q: 'What is Consistency?', a: 'The percentage of columns where all values share the same inferred data type (all numeric, all string, etc.).' },
  { q: 'Is my data stored permanently?', a: 'Uploaded files are deleted from disk immediately after parsing. The parsed row data is stored in the database to power forensics, fingerprinting, and consistency checks. You can delete any analysis from the History page.' },
  { q: 'How does the Predictive Index work?', a: 'Each upload creates a snapshot. Once you have 2+ snapshots of the same dataset, the engine runs weighted linear regression and exponential moving average on the score history to forecast future scores and compute a risk level (Low/Medium/High/Critical).' },
  { q: 'What is Data DNA Fingerprinting?', a: 'Each dataset gets a SHA-256 hash of its file bytes plus a composite hash of its schema, row count, and column statistics. Two datasets with the same composite hash are considered identical regardless of filename. The similarity score (0–100) detects near-duplicates.' },
  { q: 'How do I add a custom consistency rule?', a: 'Go to AI Features → Consistency → Add Custom Rule. Write a JavaScript boolean expression using `row.fieldName` (e.g. `Number(row.age) < 16 && /bachelor/i.test(row.degree || "")`). Add a human-readable violation message and choose a severity.' },
];

export default function Help() {
  const { dark } = useTheme();
  const [openFaq, setOpenFaq] = useState(null);

  const headingColor = dark ? '#f9fafb' : '#111827';
  const labelColor = dark ? '#9ca3af' : '#6b7280';
  const card = dark
    ? { background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }
    : { background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: headingColor }}>Help & Documentation</h2>
        <p className="text-sm mt-0.5" style={{ color: labelColor }}>Learn how to use every feature of DataQuality AI</p>
      </div>

      {/* Feature guides */}
      <div className="p-6 rounded-2xl" style={card}>
        <p className="text-sm font-bold mb-5" style={{ color: headingColor }}>Feature Guide</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GUIDES.map((g, i) => {
            const Icon = g.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${g.color}15`, border: `1px solid ${g.color}25` }}>
                  <Icon size={14} style={{ color: g.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: headingColor }}>{g.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: labelColor }}>{g.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* FAQs */}
      <div className="p-6 rounded-2xl" style={card}>
        <p className="text-sm font-bold mb-5" style={{ color: headingColor }}>Frequently Asked Questions</p>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
                style={{ background: openFaq === i ? (dark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)') : 'transparent' }}>
                <span className="text-sm font-medium pr-4" style={{ color: headingColor }}>{faq.q}</span>
                <ChevronDown size={14} className="flex-shrink-0 transition-transform"
                  style={{ transform: openFaq === i ? 'rotate(180deg)' : 'none', color: labelColor }} />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: labelColor, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`, paddingTop: 12 }}>
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
