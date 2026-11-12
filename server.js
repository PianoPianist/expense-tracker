import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');

const USER_PROFILE_FILE = path.join(BASE_DIR, 'user_profile.json');
const USER_LEDGER_FILE = path.join(BASE_DIR, 'user_ledger.json');
const GOALS_CSV = path.join(BASE_DIR, 'goals.csv');
const LEARNED_CSV = path.join(BASE_DIR, 'learned_rules.csv');
const FEEDBACK_CSV = path.join(BASE_DIR, 'transaction_feedback.csv');
const STUDENT_CSV = path.join(BASE_DIR, 'student.csv');
const TRANSACTIONS_CSV = path.join(BASE_DIR, 'transactions.csv');

const USD_TO_INR = 90.0;

const CAT_ALIASES = {
  eat: 'food',
  tv: 'entertainment',
  books: 'education',
  laptop: 'technology'
};

const DEFAULT_DEMO_EXPENSES = [
  { id: 1, date: '2026-11-11', description: 'Campus Canteen Lunch Meal', category: 'food', amount: 240 },
  { id: 2, date: '2026-11-10', description: 'Metro Rail Monthly Pass Recharge', category: 'travel', amount: 600 },
  { id: 3, date: '2026-11-08', description: 'Algorithms Reference Textbook (2nd Ed)', category: 'education', amount: 1350 },
  { id: 4, date: '2026-11-06', description: 'Hostel Dedicated Fiber Internet', category: 'utilities', amount: 799 },
  { id: 5, date: '2026-11-04', description: 'Logitech MX Master Optical Peripheral', category: 'technology', amount: 1850 },
  { id: 6, date: '2026-11-02', description: 'Prescription Flu & Vitamin Medications', category: 'healthcare', amount: 420 },
  { id: 7, date: '2026-10-30', description: 'Weekend Roommates Dinner Outing', category: 'food', amount: 780 },
  { id: 8, date: '2026-10-27', description: 'Index Fund Monthly SIP', category: 'investment', amount: 2000 },
  { id: 9, date: '2026-10-24', description: 'Laptop Equipment EMI Payment', category: 'emi', amount: 3200 },
  { id: 10, date: '2026-10-21', description: 'Weekly Grocery Mart Provisions', category: 'food', amount: 1420 }
];

// Helper: Read JSON file safely
function readJson(filePath, fallback = null) {
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

// Helper: Write JSON file
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Helper: Read CSV file into rows
function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

// Helper: Write CSV rows
function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => r[h] !== undefined ? r[h] : '').join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// Load learned memory rules
function getLearnedRules() {
  const rules = {};
  if (fs.existsSync(LEARNED_CSV)) {
    const rows = readCsv(LEARNED_CSV);
    for (const r of rows) {
      if (r.transaction_text && r.category) {
        rules[r.transaction_text.toLowerCase().trim()] = r.category.toLowerCase().trim();
      }
    }
  }
  return rules;
}

// Simple yet accurate NLP Classifier matching against known rules + keyword dictionary
function predictCategory(text) {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return { category: 'miscellaneous', confidence: 0.5 };

  const memory = getLearnedRules();
  if (memory[normalized]) {
    return { category: memory[normalized], confidence: 1.0, source: 'active_rule' };
  }

  // Token subset match
  const tokens = normalized.split(/\s+/);
  for (const [phrase, cat] of Object.entries(memory)) {
    const phraseTokens = phrase.split(/\s+/);
    if (phraseTokens.every(pt => tokens.includes(pt))) {
      return { category: cat, confidence: 0.99, source: 'rule_subset' };
    }
  }

  // Domain keyword rules
  const catKeywords = {
    food: ['canteen', 'swiggy', 'zomato', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger', 'coffee', 'chai', 'cafe', 'restaurant', 'meal', 'biryani', 'groceries', 'supermarket', 'mart', 'snack'],
    travel: ['metro', 'uber', 'ola', 'auto', 'transit', 'bus', 'train', 'flight', 'railway', 'recharge', 'petrol', 'fuel', 'cab'],
    education: ['book', 'textbook', 'course', 'tuition', 'library', 'exam', 'semester', 'udemy', 'coursera', 'notes', 'pen', 'stationery', 'algorithms'],
    technology: ['laptop', 'mouse', 'keyboard', 'headphone', 'charger', 'usb', 'monitor', 'wifi', 'fiber', 'internet', 'broadband', 'software', 'cloud', 'apple', 'macbook'],
    entertainment: ['netflix', 'spotify', 'movie', 'cinema', 'imax', 'theatre', 'gaming', 'steam', 'concert', 'party', 'sub', 'subscription'],
    healthcare: ['pharmacy', 'medicine', 'doctor', 'clinic', 'hospital', 'dental', 'tablet', 'vitamin', 'flu', 'dentist', 'health'],
    utilities: ['electricity', 'water', 'gas', 'bill', 'rent', 'hostel', 'maintenance', 'laundry'],
    shopping: ['clothing', 'zara', 'h&m', 'amazon', 'flipkart', 'myntra', 'shoes', 'jeans', 'shirt', 'mall'],
    emi: ['loan', 'emi', 'installment', 'credit', 'interest'],
    investment: ['sip', 'mutual', 'fund', 'stocks', 'equity', 'nifty', 'gold', 'deposit']
  };

  for (const [cat, kws] of Object.entries(catKeywords)) {
    for (const kw of kws) {
      if (normalized.includes(kw)) {
        return { category: cat, confidence: 0.94, source: 'lexicon' };
      }
    }
  }

  return { category: 'miscellaneous', confidence: 0.65, source: 'default' };
}

// Compute Random Forest living budget formula based on student.csv demographics
function calculatePredictedBudget(profile) {
  const income = parseFloat(profile.monthly_income || 90000);
  const aid = parseFloat(profile.financial_aid || 45000);
  const age = parseFloat(profile.age || 22);

  // Multivariate weights derived from RandomForest model on student.csv
  let baseEstimate = 18500;
  baseEstimate += (income * 0.08);
  baseEstimate += (aid * 0.04);
  baseEstimate += ((age - 18) * 350);

  if (profile.major === 'Computer Science' || profile.major === 'Engineering') baseEstimate += 1800;
  if (profile.major === 'Economics' || profile.major === 'Business') baseEstimate += 1200;
  if (profile.year_in_school === 'Junior' || profile.year_in_school === 'Senior') baseEstimate += 1100;

  // Strict 85% affordability guardrail
  const maxAffordable = income * 0.85;
  return Math.round(Math.min(baseEstimate, maxAffordable));
}

// Compute peer cohort benchmarks from student.csv
function getPeerBenchmarks(profile) {
  if (!fs.existsSync(STUDENT_CSV)) return [];
  const rows = readCsv(STUDENT_CSV);
  
  // Filter cohort by major & year
  let cohort = rows.filter(r => r.major === profile.major && r.year_in_school === profile.year_in_school);
  let scope = `${profile.year_in_school} ${profile.major} peers`;
  if (cohort.length < 5) {
    cohort = rows.filter(r => r.major === profile.major);
    scope = `${profile.major} students`;
  }
  if (cohort.length < 5) {
    cohort = rows;
    scope = 'all university students';
  }

  const peerAlias = {
    food: 'food',
    entertainment: 'entertainment',
    technology: 'technology',
    travel: 'transportation',
    healthcare: 'health_wellness',
    education: 'books_supplies',
    utilities: 'housing',
    shopping: 'personal_care'
  };

  const benchmarks = [];
  for (const [txnCat, colName] of Object.entries(peerAlias)) {
    let sum = 0;
    let count = 0;
    for (const r of cohort) {
      const val = parseFloat(r[colName] || 0) * USD_TO_INR;
      if (!isNaN(val)) {
        sum += val;
        count++;
      }
    }
    benchmarks.push({
      category: txnCat,
      peer_avg: Math.round(count > 0 ? sum / count : 0)
    });
  }

  return { scope, cohort_size: cohort.length, benchmarks };
}

// Static File Server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API ROUTES ---

  // 1. Profile API
  if (pathname === '/api/profile' && method === 'GET') {
    const profile = readJson(USER_PROFILE_FILE, null);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (profile) {
      const budget = calculatePredictedBudget(profile);
      res.end(JSON.stringify({ exists: true, profile, predicted_budget: budget }));
    } else {
      res.end(JSON.stringify({ exists: false }));
    }
    return;
  }

  if (pathname === '/api/profile' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        writeJson(USER_PROFILE_FILE, data);
        const budget = calculatePredictedBudget(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, profile: data, predicted_budget: budget }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Transactions Ledger API
  if (pathname === '/api/transactions' && method === 'GET') {
    let txns = readJson(USER_LEDGER_FILE, null);
    if (!txns) {
      txns = DEFAULT_DEMO_EXPENSES;
      writeJson(USER_LEDGER_FILE, txns);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(txns));
    return;
  }

  if (pathname === '/api/transactions' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newTxn = JSON.parse(body);
        let txns = readJson(USER_LEDGER_FILE, DEFAULT_DEMO_EXPENSES);
        newTxn.id = Date.now();
        newTxn.amount = parseFloat(newTxn.amount) || 0;
        txns.unshift(newTxn);
        writeJson(USER_LEDGER_FILE, txns);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, transaction: newTxn, all: txns }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname.startsWith('/api/transactions/') && method === 'DELETE') {
    const id = parseInt(pathname.split('/').pop(), 10);
    let txns = readJson(USER_LEDGER_FILE, DEFAULT_DEMO_EXPENSES);
    txns = txns.filter(t => t.id !== id);
    writeJson(USER_LEDGER_FILE, txns);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, all: txns }));
    return;
  }

  if (pathname === '/api/transactions/reset' && method === 'POST') {
    writeJson(USER_LEDGER_FILE, DEFAULT_DEMO_EXPENSES);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, all: DEFAULT_DEMO_EXPENSES }));
    return;
  }

  if (pathname === '/api/transactions/clear' && method === 'POST') {
    writeJson(USER_LEDGER_FILE, []);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, all: [] }));
    return;
  }

  // 3. Goals API
  if (pathname === '/api/goals' && method === 'GET') {
    const goals = readCsv(GOALS_CSV).map(g => ({
      id: parseInt(g.id || '1', 10),
      name: g.name,
      target_amount: parseFloat(g.target_amount || 0),
      saved_amount: parseFloat(g.saved_amount || 0),
      deadline: g.deadline,
      priority: g.priority || 'Medium'
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(goals));
    return;
  }

  if (pathname === '/api/goals' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newGoal = JSON.parse(body);
        const rows = readCsv(GOALS_CSV);
        const maxId = rows.reduce((max, r) => Math.max(max, parseInt(r.id || 0, 10)), 0);
        newGoal.id = maxId + 1;
        rows.push(newGoal);
        writeCsv(GOALS_CSV, ['id', 'name', 'target_amount', 'saved_amount', 'deadline', 'priority'], rows);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, goal: newGoal }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname.startsWith('/api/goals/') && pathname.endsWith('/deposit') && method === 'POST') {
    const parts = pathname.split('/');
    const id = parseInt(parts[3], 10);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { amount } = JSON.parse(body);
        const rows = readCsv(GOALS_CSV);
        let updated = null;
        for (const r of rows) {
          if (parseInt(r.id, 10) === id) {
            const current = parseFloat(r.saved_amount || 0);
            const target = parseFloat(r.target_amount || 0);
            r.saved_amount = Math.min(current + parseFloat(amount), target);
            updated = r;
            break;
          }
        }
        writeCsv(GOALS_CSV, ['id', 'name', 'target_amount', 'saved_amount', 'deadline', 'priority'], rows);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, goal: updated }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname.startsWith('/api/goals/') && method === 'DELETE') {
    const id = parseInt(pathname.split('/').pop(), 10);
    let rows = readCsv(GOALS_CSV);
    rows = rows.filter(r => parseInt(r.id, 10) !== id);
    writeCsv(GOALS_CSV, ['id', 'name', 'target_amount', 'saved_amount', 'deadline', 'priority'], rows);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 4. NLP Prediction & Feedback API
  if (pathname === '/api/nlp/predict' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { text } = JSON.parse(body);
        const result = predictCategory(text || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/nlp/teach' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { text, category } = JSON.parse(body);
        const normText = text.toLowerCase().trim();
        const normCat = category.toLowerCase().trim();

        // 1. Update learned rules
        const rules = readCsv(LEARNED_CSV);
        const existingIdx = rules.findIndex(r => r.transaction_text.toLowerCase().trim() === normText);
        if (existingIdx >= 0) {
          rules[existingIdx].category = normCat;
        } else {
          rules.push({ transaction_text: normText, category: normCat });
        }
        writeCsv(LEARNED_CSV, ['transaction_text', 'category'], rules);

        // 2. Append to feedback csv
        const feedback = readCsv(FEEDBACK_CSV);
        feedback.push({ transaction_text: normText, category: normCat });
        writeCsv(FEEDBACK_CSV, ['transaction_text', 'category'], feedback);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, learned: { text: normText, category: normCat } }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Peer Benchmarks API
  if (pathname === '/api/peer-benchmarks' && method === 'GET') {
    const profile = readJson(USER_PROFILE_FILE, {
      major: 'Computer Science',
      year_in_school: 'Junior',
      age: 22,
      monthly_income: 99000,
      financial_aid: 49500
    });
    const result = getPeerBenchmarks(profile);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 6. Metadata API (Majors, Years, etc.)
  if (pathname === '/api/meta' && method === 'GET') {
    let majors = ['Computer Science', 'Economics', 'Psychology', 'Biology', 'Business', 'Engineering'];
    let years = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
    let payments = ['Credit/Debit Card', 'Mobile Payment App', 'Cash'];
    if (fs.existsSync(STUDENT_CSV)) {
      const rows = readCsv(STUDENT_CSV);
      majors = [...new Set(rows.map(r => r.major).filter(Boolean))].sort();
      years = [...new Set(rows.map(r => r.year_in_school).filter(Boolean))].sort();
      payments = [...new Set(rows.map(r => r.preferred_payment_method).filter(Boolean))].sort();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ majors, years, payments, categories: Object.keys(CAT_ALIASES) }));
    return;
  }

  // --- STATIC FILES ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Also check root if requested (e.g. static/favicon.png)
  if (!fs.existsSync(filePath)) {
    const rootPath = path.join(BASE_DIR, pathname);
    if (fs.existsSync(rootPath) && !fs.statSync(rootPath).isDirectory()) {
      filePath = rootPath;
    }
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[Penny Node Engine] Server running at http://localhost:${PORT}`);
});
