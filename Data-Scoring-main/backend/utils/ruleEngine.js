// ─────────────────────────────────────────────────────────────────────────────
// Cognitive Consistency Engine — Rule Engine
// Each rule is: { id, name, severity, category, requiredFields, check(row) }
// check(row) returns null (pass) or a reason string (fail).
// ─────────────────────────────────────────────────────────────────────────────

// ── Column name resolver ──────────────────────────────────────────────────────
// Finds the actual column key in a row using fuzzy aliases.

const ALIASES = {
  age:        ['age', 'years', 'age_years', 'person_age', 'user_age'],
  degree:     ['degree', 'education', 'qualification', 'edu', 'education_level', 'highest_degree'],
  salary:     ['salary', 'wage', 'pay', 'income', 'annual_salary', 'compensation', 'ctc'],
  job:        ['job', 'job_title', 'title', 'role', 'position', 'designation', 'occupation'],
  city:       ['city', 'town', 'municipality', 'city_name', 'location'],
  country:    ['country', 'nation', 'country_name', 'country_code'],
  gender:     ['gender', 'sex', 'gender_identity'],
  dob:        ['dob', 'date_of_birth', 'birth_date', 'birthdate', 'birthday'],
  experience: ['experience', 'exp', 'years_exp', 'work_experience', 'experience_years'],
  score:      ['score', 'test_score', 'grade', 'marks', 'result'],
  zip:        ['zip', 'zipcode', 'zip_code', 'postal_code', 'postcode', 'pin'],
  phone:      ['phone', 'mobile', 'contact', 'phone_number', 'cell'],
  email:      ['email', 'email_address', 'mail'],
  price:      ['price', 'cost', 'amount', 'total', 'fee', 'charge'],
  quantity:   ['quantity', 'qty', 'count', 'units', 'stock'],
  rating:     ['rating', 'stars', 'review_score', 'rate'],
  discount:   ['discount', 'discount_pct', 'discount_percent', 'rebate'],
};

function resolve(row, field) {
  const aliases = ALIASES[field] || [field];
  const keys = Object.keys(row).map(k => k.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = keys.indexOf(alias.toLowerCase());
    if (idx !== -1) return { key: Object.keys(row)[idx], value: row[Object.keys(row)[idx]] };
  }
  return null;
}

function get(row, field) {
  const r = resolve(row, field);
  return r ? String(r.value ?? '').trim() : null;
}

function getNum(row, field) {
  const v = get(row, field);
  if (v === null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function hasFields(row, ...fields) {
  return fields.every(f => get(row, f) !== null && get(row, f) !== '');
}

// ── Built-in rule definitions ─────────────────────────────────────────────────

const BUILT_IN_RULES = [

  // ── Age / Education ──────────────────────────────────────────────────────
  {
    id: 'AGE_PHD',
    name: 'Age too young for PhD',
    severity: 'High',
    category: 'Education',
    requiredFields: ['age', 'degree'],
    check(row) {
      const age = getNum(row, 'age');
      const degree = get(row, 'degree');
      if (age === null || !degree) return null;
      if (age < 22 && /phd|doctorate|d\.phil/i.test(degree))
        return `Age ${age} is too young to hold a PhD (minimum ~22)`;
      return null;
    },
  },
  {
    id: 'AGE_MASTERS',
    name: 'Age too young for Masters',
    severity: 'Medium',
    category: 'Education',
    requiredFields: ['age', 'degree'],
    check(row) {
      const age = getNum(row, 'age');
      const degree = get(row, 'degree');
      if (age === null || !degree) return null;
      if (age < 18 && /master|msc|mba|m\.s\.|m\.a\./i.test(degree))
        return `Age ${age} is too young to hold a Masters degree (minimum ~18)`;
      return null;
    },
  },
  {
    id: 'AGE_BACHELORS',
    name: 'Age too young for Bachelors',
    severity: 'Medium',
    category: 'Education',
    requiredFields: ['age', 'degree'],
    check(row) {
      const age = getNum(row, 'age');
      const degree = get(row, 'degree');
      if (age === null || !degree) return null;
      if (age < 16 && /bachelor|b\.sc|b\.a\.|b\.tech|b\.e\./i.test(degree))
        return `Age ${age} is too young to hold a Bachelors degree (minimum ~16)`;
      return null;
    },
  },
  {
    id: 'AGE_EXPERIENCE',
    name: 'Experience exceeds working age',
    severity: 'High',
    category: 'Education',
    requiredFields: ['age', 'experience'],
    check(row) {
      const age = getNum(row, 'age');
      const exp = getNum(row, 'experience');
      if (age === null || exp === null) return null;
      if (exp >= age - 14)
        return `Experience (${exp} yrs) is impossible for age ${age} — working age starts ~14`;
      return null;
    },
  },
  {
    id: 'AGE_RANGE',
    name: 'Age out of realistic range',
    severity: 'High',
    category: 'Demographic',
    requiredFields: ['age'],
    check(row) {
      const age = getNum(row, 'age');
      if (age === null) return null;
      if (age < 0 || age > 130)
        return `Age ${age} is outside realistic human range (0–130)`;
      return null;
    },
  },

  // ── Salary / Job ─────────────────────────────────────────────────────────
  {
    id: 'SALARY_INTERN',
    name: 'Intern salary too high',
    severity: 'Medium',
    category: 'Compensation',
    requiredFields: ['salary', 'job'],
    check(row) {
      const salary = getNum(row, 'salary');
      const job = get(row, 'job');
      if (salary === null || !job) return null;
      if (/intern|trainee|apprentice/i.test(job) && salary > 80000)
        return `Salary $${salary.toLocaleString()} is unusually high for role "${job}"`;
      return null;
    },
  },
  {
    id: 'SALARY_EXECUTIVE',
    name: 'Executive salary too low',
    severity: 'Medium',
    category: 'Compensation',
    requiredFields: ['salary', 'job'],
    check(row) {
      const salary = getNum(row, 'salary');
      const job = get(row, 'job');
      if (salary === null || !job) return null;
      if (/\b(ceo|cto|cfo|coo|chief|president|vp|vice president)\b/i.test(job) && salary < 50000)
        return `Salary $${salary.toLocaleString()} is suspiciously low for role "${job}"`;
      return null;
    },
  },
  {
    id: 'SALARY_NEGATIVE',
    name: 'Negative salary',
    severity: 'Critical',
    category: 'Compensation',
    requiredFields: ['salary'],
    check(row) {
      const salary = getNum(row, 'salary');
      if (salary === null) return null;
      if (salary < 0) return `Salary cannot be negative (got ${salary})`;
      return null;
    },
  },
  {
    id: 'SALARY_AGE',
    name: 'High salary for very young age',
    severity: 'Low',
    category: 'Compensation',
    requiredFields: ['salary', 'age'],
    check(row) {
      const salary = getNum(row, 'salary');
      const age = getNum(row, 'age');
      if (salary === null || age === null) return null;
      if (age < 18 && salary > 30000)
        return `Salary $${salary.toLocaleString()} is unusually high for age ${age}`;
      return null;
    },
  },

  // ── Geography ────────────────────────────────────────────────────────────
  {
    id: 'CITY_COUNTRY',
    name: 'City does not match country',
    severity: 'High',
    category: 'Geography',
    requiredFields: ['city', 'country'],
    check(row) {
      const city = get(row, 'city')?.toLowerCase();
      const country = get(row, 'country')?.toLowerCase();
      if (!city || !country) return null;

      const CITY_COUNTRY_MAP = {
        'new york': ['us', 'usa', 'united states', 'united states of america'],
        'los angeles': ['us', 'usa', 'united states'],
        'chicago': ['us', 'usa', 'united states'],
        'london': ['uk', 'gb', 'united kingdom', 'great britain', 'england'],
        'manchester': ['uk', 'gb', 'united kingdom', 'england'],
        'paris': ['fr', 'france'],
        'berlin': ['de', 'germany', 'deutschland'],
        'munich': ['de', 'germany'],
        'tokyo': ['jp', 'japan'],
        'osaka': ['jp', 'japan'],
        'beijing': ['cn', 'china'],
        'shanghai': ['cn', 'china'],
        'sydney': ['au', 'australia'],
        'melbourne': ['au', 'australia'],
        'toronto': ['ca', 'canada'],
        'vancouver': ['ca', 'canada'],
        'mumbai': ['in', 'india'],
        'delhi': ['in', 'india'],
        'bangalore': ['in', 'india'],
        'hyderabad': ['in', 'india'],
        'dubai': ['ae', 'uae', 'united arab emirates'],
        'abu dhabi': ['ae', 'uae', 'united arab emirates'],
        'singapore': ['sg', 'singapore'],
        'seoul': ['kr', 'south korea', 'korea'],
        'amsterdam': ['nl', 'netherlands', 'holland'],
        'madrid': ['es', 'spain'],
        'barcelona': ['es', 'spain'],
        'rome': ['it', 'italy'],
        'milan': ['it', 'italy'],
        'moscow': ['ru', 'russia'],
        'cairo': ['eg', 'egypt'],
        'lagos': ['ng', 'nigeria'],
        'nairobi': ['ke', 'kenya'],
        'sao paulo': ['br', 'brazil'],
        'rio de janeiro': ['br', 'brazil'],
        'mexico city': ['mx', 'mexico'],
        'buenos aires': ['ar', 'argentina'],
      };

      const validCountries = CITY_COUNTRY_MAP[city];
      if (!validCountries) return null; // unknown city — skip
      if (!validCountries.some(c => country.includes(c) || c.includes(country)))
        return `City "${get(row, 'city')}" does not belong to country "${get(row, 'country')}"`;
      return null;
    },
  },
  {
    id: 'ZIP_FORMAT_US',
    name: 'Invalid US ZIP code format',
    severity: 'Low',
    category: 'Geography',
    requiredFields: ['zip', 'country'],
    check(row) {
      const zip = get(row, 'zip');
      const country = get(row, 'country')?.toLowerCase();
      if (!zip || !country) return null;
      if (['us', 'usa', 'united states'].includes(country) && !/^\d{5}(-\d{4})?$/.test(zip))
        return `ZIP code "${zip}" is not a valid US format (expected 12345 or 12345-6789)`;
      return null;
    },
  },

  // ── Dates / Age ──────────────────────────────────────────────────────────
  {
    id: 'DOB_AGE_MISMATCH',
    name: 'Date of birth does not match age',
    severity: 'High',
    category: 'Demographic',
    requiredFields: ['dob', 'age'],
    check(row) {
      const dob = get(row, 'dob');
      const age = getNum(row, 'age');
      if (!dob || age === null) return null;
      const birth = new Date(dob);
      if (isNaN(birth.getTime())) return null;
      const computed = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
      if (Math.abs(computed - age) > 1)
        return `Date of birth (${dob}) implies age ${computed}, but age field says ${age}`;
      return null;
    },
  },
  {
    id: 'FUTURE_DOB',
    name: 'Date of birth is in the future',
    severity: 'Critical',
    category: 'Demographic',
    requiredFields: ['dob'],
    check(row) {
      const dob = get(row, 'dob');
      if (!dob) return null;
      const birth = new Date(dob);
      if (isNaN(birth.getTime())) return null;
      if (birth > new Date())
        return `Date of birth "${dob}" is in the future`;
      return null;
    },
  },

  // ── Scores / Ratings ─────────────────────────────────────────────────────
  {
    id: 'SCORE_RANGE',
    name: 'Score out of valid range',
    severity: 'Medium',
    category: 'Scores',
    requiredFields: ['score'],
    check(row) {
      const score = getNum(row, 'score');
      if (score === null) return null;
      if (score < 0 || score > 100)
        return `Score ${score} is outside valid range (0–100)`;
      return null;
    },
  },
  {
    id: 'RATING_RANGE',
    name: 'Rating out of valid range',
    severity: 'Medium',
    category: 'Scores',
    requiredFields: ['rating'],
    check(row) {
      const rating = getNum(row, 'rating');
      if (rating === null) return null;
      if (rating < 0 || rating > 5)
        return `Rating ${rating} is outside valid range (0–5)`;
      return null;
    },
  },

  // ── Commerce ─────────────────────────────────────────────────────────────
  {
    id: 'DISCOUNT_RANGE',
    name: 'Discount out of valid range',
    severity: 'High',
    category: 'Commerce',
    requiredFields: ['discount'],
    check(row) {
      const d = getNum(row, 'discount');
      if (d === null) return null;
      if (d < 0 || d > 100)
        return `Discount ${d}% is outside valid range (0–100)`;
      return null;
    },
  },
  {
    id: 'QUANTITY_NEGATIVE',
    name: 'Negative quantity',
    severity: 'High',
    category: 'Commerce',
    requiredFields: ['quantity'],
    check(row) {
      const q = getNum(row, 'quantity');
      if (q === null) return null;
      if (q < 0) return `Quantity cannot be negative (got ${q})`;
      return null;
    },
  },
  {
    id: 'PRICE_NEGATIVE',
    name: 'Negative price',
    severity: 'Critical',
    category: 'Commerce',
    requiredFields: ['price'],
    check(row) {
      const p = getNum(row, 'price');
      if (p === null) return null;
      if (p < 0) return `Price cannot be negative (got ${p})`;
      return null;
    },
  },

  // ── Gender ───────────────────────────────────────────────────────────────
  {
    id: 'GENDER_VALUES',
    name: 'Unrecognised gender value',
    severity: 'Low',
    category: 'Demographic',
    requiredFields: ['gender'],
    check(row) {
      const g = get(row, 'gender')?.toLowerCase();
      if (!g) return null;
      const valid = ['male', 'female', 'm', 'f', 'man', 'woman', 'non-binary', 'nonbinary', 'other', 'prefer not to say', 'unknown'];
      if (!valid.includes(g))
        return `Gender value "${get(row, 'gender')}" is not a recognised value`;
      return null;
    },
  },
];

// ── Rule registry ─────────────────────────────────────────────────────────────
// Holds both built-in and dynamically added custom rules.

class RuleRegistry {
  constructor() {
    this._rules = new Map();
    BUILT_IN_RULES.forEach(r => this._rules.set(r.id, { ...r, builtin: true }));
  }

  add(rule) {
    if (!rule.id || !rule.name || typeof rule.check !== 'function')
      throw new Error('Rule must have id, name, and check function');
    if (this._rules.has(rule.id))
      throw new Error(`Rule with id "${rule.id}" already exists`);
    this._rules.set(rule.id, { ...rule, builtin: false });
    return rule.id;
  }

  remove(id) {
    const rule = this._rules.get(id);
    if (!rule) throw new Error(`Rule "${id}" not found`);
    if (rule.builtin) throw new Error(`Cannot remove built-in rule "${id}"`);
    this._rules.delete(id);
  }

  get(id) { return this._rules.get(id) || null; }

  list() { return [...this._rules.values()]; }

  listByCategory() {
    const cats = {};
    this._rules.forEach(r => {
      const cat = r.category || 'General';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({ id: r.id, name: r.name, severity: r.severity, builtin: r.builtin });
    });
    return cats;
  }
}

// Singleton registry shared across the process
const registry = new RuleRegistry();

// ── Dataset runner ────────────────────────────────────────────────────────────

function runRules(rows, ruleIds = null) {
  const rules = ruleIds
    ? ruleIds.map(id => registry.get(id)).filter(Boolean)
    : registry.list();

  const flaggedRows = [];
  const ruleSummary = {};  // ruleId → { count, severity, name }

  rows.forEach((row, idx) => {
    const violations = [];
    rules.forEach(rule => {
      try {
        const reason = rule.check(row);
        if (reason) {
          violations.push({ ruleId: rule.id, ruleName: rule.name, severity: rule.severity, category: rule.category, reason });
          ruleSummary[rule.id] = ruleSummary[rule.id] || { count: 0, severity: rule.severity, name: rule.name, category: rule.category };
          ruleSummary[rule.id].count++;
        }
      } catch (_) { /* skip broken custom rules */ }
    });
    if (violations.length > 0)
      flaggedRows.push({ rowIndex: idx + 1, row, violations });
  });

  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  flaggedRows.sort((a, b) => {
    const topA = Math.min(...a.violations.map(v => severityOrder[v.severity] ?? 9));
    const topB = Math.min(...b.violations.map(v => severityOrder[v.severity] ?? 9));
    return topA - topB;
  });

  return {
    totalRows: rows.length,
    flaggedCount: flaggedRows.length,
    cleanCount: rows.length - flaggedRows.length,
    consistencyScore: Math.round(((rows.length - flaggedRows.length) / Math.max(rows.length, 1)) * 100),
    ruleSummary: Object.entries(ruleSummary)
      .map(([id, s]) => ({ ruleId: id, ...s }))
      .sort((a, b) => b.count - a.count),
    flaggedRows,
  };
}

module.exports = { registry, runRules, resolve, get, getNum };
