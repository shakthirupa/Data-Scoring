const jwt = require('jsonwebtoken');
const Analysis = require('../models/Analysis');

const SECRET = process.env.JWT_SECRET || 'dataquality_secret_key';

function generateUpdateToken(analysisId, rowIndex) {
  return jwt.sign({ analysisId, rowIndex }, SECRET, { expiresIn: '7d' });
}

// GET /api/update/:token — serve pre-filled HTML form
exports.showForm = async (req, res) => {
  try {
    const { analysisId, rowIndex } = jwt.verify(req.params.token, SECRET);
    const analysis = await Analysis.findByPk(analysisId);
    if (!analysis) return res.status(404).send('<h2>Link expired or invalid.</h2>');

    const row = (analysis.rawData || [])[rowIndex];
    if (!row) return res.status(404).send('<h2>Record not found.</h2>');

    const fields = Object.entries(row)
      .map(([key, val]) => `
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;">${key}</label>
          <input name="${key}" value="${String(val ?? '').replace(/"/g, '&quot;')}"
            style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;" />
        </div>`)
      .join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Update Your Details — DataQuality AI</title>
  <style>
    body { font-family: sans-serif; background: #f9fafb; margin: 0; padding: 24px; }
    .card { max-width: 520px; margin: auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h2 { color: #111827; margin-bottom: 4px; }
    p  { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    button { width: 100%; padding: 12px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
    button:hover { background: #4338ca; }
    .success { display:none; text-align:center; color: #059669; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Update Your Details</h2>
    <p>Please correct the fields below and click Save. Your record will be updated immediately.</p>
    <form method="POST">
      ${fields}
      <button type="submit">Save Changes</button>
    </form>
  </div>
</body>
</html>`);
  } catch (e) {
    res.status(400).send('<h2>This link has expired or is invalid.</h2>');
  }
};

// POST /api/update/:token — save directly to PostgreSQL
exports.submitForm = async (req, res) => {
  try {
    const { analysisId, rowIndex } = jwt.verify(req.params.token, SECRET);
    const analysis = await Analysis.findByPk(analysisId);
    if (!analysis) return res.status(404).send('<h2>Record not found.</h2>');

    const rawData = [...(analysis.rawData || [])];
    if (!rawData[rowIndex]) return res.status(404).send('<h2>Record not found.</h2>');

    // Merge submitted fields into the existing row
    const updated = { ...rawData[rowIndex] };
    for (const [k, v] of Object.entries(req.body)) {
      if (k in updated) updated[k] = v;
    }
    rawData[rowIndex] = updated;
    analysis.rawData = rawData;
    analysis.changed('rawData', true);
    await analysis.save();

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Updated — DataQuality AI</title>
  <style>body{font-family:sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
  .card{background:#fff;border-radius:16px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
  h2{color:#059669;}p{color:#6b7280;}</style>
</head>
<body>
  <div class="card">
    <h2>✅ Details Updated Successfully</h2>
    <p>Your information has been saved. You may close this tab.</p>
  </div>
</body>
</html>`);
  } catch (e) {
    res.status(400).send('<h2>This link has expired or is invalid.</h2>');
  }
};

module.exports.generateUpdateToken = generateUpdateToken;
