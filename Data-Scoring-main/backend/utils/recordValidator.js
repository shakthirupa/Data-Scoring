const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/; // exactly 10 digits after stripping non-numeric

/**
 * Strips all non-digit characters from a phone string.
 * Returns the cleaned string (may be empty).
 */
function cleanPhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '');
}

/**
 * Validates a single record for name, email, phone.
 * Returns { isVerified, reasons, cleanedPhone }
 */
function validateRecord(record) {
  const reasons = [];

  // Resolve field regardless of casing (name / Name / NAME)
  const get = (keys) => {
    for (const k of keys) {
      const found = Object.keys(record).find(rk => rk.toLowerCase() === k);
      if (found && record[found] !== null && record[found] !== undefined) return String(record[found]).trim();
    }
    return '';
  };

  const name  = get(['name', 'full_name', 'fullname']);
  const email = get(['email', 'email_address']);
  const phone = get(['phone', 'phone_number', 'mobile', 'contact']);

  if (!name) reasons.push('Name is empty');

  if (!email) {
    reasons.push('Email is missing');
  } else if (!EMAIL_RE.test(email)) {
    reasons.push(`Email "${email}" is invalid (must contain @)`);
  }

  const cleaned = cleanPhone(phone);
  if (!phone) {
    reasons.push('Phone number is missing');
  } else if (cleaned.length !== 10) {
    reasons.push(`Phone "${phone}" is invalid (must be 10 digits)`);
  }

  return {
    isVerified: reasons.length === 0,
    reasons,
    cleanedPhone: cleaned.length === 10 ? cleaned : null,
    name,
    email,
    phone,
  };
}

module.exports = { validateRecord };
