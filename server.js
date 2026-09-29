/*
 * ISM DATA TECHNOLOGY ASSESSMENT - server
 *
 * Express + Postgres (on Vercel) or SQLite (on a laptop) - see db.js.
 * Everything that matters (timer, grading, duplicate blocking) is decided on
 * the server; the browser is never trusted and never
 * receives a correct answer.
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const questions = require('./questions');
const db = require('./db');

/* ------------------------------------------------------------------ *
 *  Config                                                             *
 * ------------------------------------------------------------------ */

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ISM@admin2026';
const DURATION_MINUTES = parseInt(process.env.DURATION_MINUTES || '60', 10);
const DURATION_MS = DURATION_MINUTES * 60 * 1000;

const CSV_FILE = path.join(__dirname, 'results_backup.csv');

const SESSION_COOKIE = 'ism_sid';
const ADMIN_COOKIE = 'ism_admin';

/* Fail loudly at boot rather than half-way through an exam. */
(function validateQuestionBank() {
  const easy = questions.filter((q) => q.difficulty === 'easy');
  const hard = questions.filter((q) => q.difficulty === 'hard');
  const ids = new Set(questions.map((q) => q.id));
  const problems = [];

  if (questions.length !== 50) problems.push('expected 50 questions, found ' + questions.length);
  if (easy.length !== 20) problems.push('expected 20 easy, found ' + easy.length);
  if (hard.length !== 30) problems.push('expected 30 hard, found ' + hard.length);
  if (ids.size !== questions.length) problems.push('duplicate question ids');

  for (const q of questions) {
    if (!Array.isArray(q.options) || q.options.length !== 4) problems.push('q' + q.id + ': needs 4 options');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push('q' + q.id + ': bad answer index');
  }

  if (problems.length) {
    console.error('Question bank is invalid:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
})();

const QUESTION_BY_ID = new Map(questions.map((q) => [q.id, q]));
const EASY_TOTAL = questions.filter((q) => q.difficulty === 'easy').length;
const HARD_TOTAL = questions.filter((q) => q.difficulty === 'hard').length;
const TOTAL_MARKS = questions.length;

/* ------------------------------------------------------------------ *
 *  Queries                                                            *
 * ------------------------------------------------------------------ */

const stmt = {
  insertCandidate: (r) => db.run(
    `INSERT INTO candidates
       (name, email, email_key, phone, college, degree, year_of_study, roll_no, roll_key,
        token, question_order, start_time, status, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in progress', ?)`,
    [r.name, r.email, r.email_key, r.phone, r.college, r.degree, r.year_of_study, r.roll_no,
      r.roll_key, r.token, r.question_order, r.start_time, r.ip]
  ),
  byToken: (token) => db.get('SELECT * FROM candidates WHERE token = ?', [token]),
  byId: (id) => db.get('SELECT * FROM candidates WHERE id = ?', [id]),
  byEmailOrRoll: (email, roll) => db.get(
    'SELECT email_key, roll_key FROM candidates WHERE email_key = ? OR roll_key = ?', [email, roll]
  ),
  answersFor: (id) => db.all(
    'SELECT question_id, selected, marked FROM answers WHERE candidate_id = ?', [id]
  ),
  answeredCount: async (id) => {
    const row = await db.get(
      'SELECT COUNT(*) AS n FROM answers WHERE candidate_id = ? AND selected IS NOT NULL', [id]
    );
    return Number(row.n);
  },
  upsertAnswer: (a) => db.run(
    `INSERT INTO answers (candidate_id, question_id, selected, marked, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (candidate_id, question_id) DO UPDATE SET
       selected = excluded.selected,
       marked = excluded.marked,
       updated_at = excluded.updated_at`,
    [a.candidate_id, a.question_id, a.selected, a.marked, a.updated_at]
  ),
  bumpTabSwitch: (id) => db.run(
    "UPDATE candidates SET tab_switches = tab_switches + 1 WHERE id = ? AND status = 'in progress'", [id]
  ),
  finish: (f) => db.run(
    `UPDATE candidates
        SET submit_time = ?, status = ?, easy_score = ?, hard_score = ?, total_score = ?, percentage = ?
      WHERE id = ? AND status = 'in progress'`,
    [f.submit_time, f.status, f.easy_score, f.hard_score, f.total_score, f.percentage, f.id]
  ),
  expired: (cutoff) => db.all(
    "SELECT id FROM candidates WHERE status = 'in progress' AND start_time <= ?", [cutoff]
  ),
  setOrder: (order, id) => db.run('UPDATE candidates SET question_order = ? WHERE id = ?', [order, id]),
  allCandidates: () => db.all('SELECT * FROM candidates ORDER BY id DESC')
};

/* ------------------------------------------------------------------ *
 *  Helpers                                                          *
 * ------------------------------------------------------------------ */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

const CSV_HEADER = [
  'id', 'name', 'email', 'phone', 'college', 'degree', 'year_of_study', 'roll_no',
  'start_time', 'submit_time', 'time_taken_seconds', 'easy_score', 'hard_score',
  'total_score', 'percentage', 'tab_switches', 'status'
];

/* Every finished attempt is appended here as a plain-text safety net, so results
 * survive even if the database file is lost or corrupted. Only for the local
 * SQLite setup - on Vercel the disk is not writable and Postgres is the record. */
function appendToCsvBackup(row) {
  if (db.kind !== 'sqlite') return;
  try {
    if (!fs.existsSync(CSV_FILE)) {
      fs.writeFileSync(CSV_FILE, CSV_HEADER.map(csvCell).join(',') + '\n', 'utf8');
    }
    const line = [
      row.id, row.name, row.email, row.phone, row.college, row.degree, row.year_of_study,
      row.roll_no, new Date(row.start_time).toISOString(),
      row.submit_time ? new Date(row.submit_time).toISOString() : '',
      row.time_taken_seconds, row.easy_score, row.hard_score, row.total_score,
      row.percentage, row.tab_switches, row.status
    ];
    fs.appendFileSync(CSV_FILE, line.map(csvCell).join(',') + '\n', 'utf8');
  } catch (err) {
    console.error('[csv-backup] failed to append result for candidate', row.id, err.message);
  }
}

function remainingMs(candidate) {
  return Math.max(0, candidate.start_time + DURATION_MS - Date.now());
}

/*
 * Grades an attempt and closes it. Safe to call more than once and from more
 * than one place (manual submit, timer expiry, the sweeper) - the UPDATE only
 * matches rows still marked 'in progress', so the first caller wins.
 */
async function finishAttempt(candidateId, status) {
  const candidate = await stmt.byId(candidateId);
  if (!candidate || candidate.status !== 'in progress') return null;

  const answers = await stmt.answersFor(candidateId);
  let easy = 0;
  let hard = 0;

  for (const a of answers) {
    const q = QUESTION_BY_ID.get(a.question_id);
    if (!q || a.selected === null || a.selected !== q.answer) continue;
    if (q.difficulty === 'easy') easy++;
    else hard++;
  }

  const total = easy + hard;
  const info = await stmt.finish({
    id: candidateId,
    submit_time: Date.now(),
    status,
    easy_score: easy,
    hard_score: hard,
    total_score: total,
    percentage: Math.round((total / TOTAL_MARKS) * 10000) / 100
  });

  if (info.changes === 0) return null; // somebody else closed it first
  const result = await stmt.byId(candidateId);

  if (result) {
    appendToCsvBackup({
      ...result,
      time_taken_seconds: Math.round((result.submit_time - result.start_time) / 1000)
    });
    console.log(
      `[submit] #${result.id} ${result.name} (${result.roll_no}) -> ${result.total_score}/${TOTAL_MARKS} [${result.status}]`
    );
  }
  return result;
}

/* Closes attempts whose window ran out while the browser was offline/closed. */
async function sweepExpired() {
  try {
    const cutoff = Date.now() - DURATION_MS;
    for (const c of await stmt.expired(cutoff)) {
      await finishAttempt(c.id, 'auto-submitted');
    }
  } catch (err) {
    console.error('[sweeper]', err.message);
  }
}

/* ------------------------------------------------------------------ *
 *  Validation                                                         *
 * ------------------------------------------------------------------ */

const YEARS = ['1', '2', '3', '4', '5'];

function validateRegistration(body) {
  const errors = {};
  const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone).replace(/[\s-]/g, '');
  const college = clean(body.college);
  const degree = clean(body.degree);
  const year = clean(body.year);
  const roll = clean(body.roll).toUpperCase();

  if (name.length < 2 || name.length > 80) errors.name = 'Enter your full name (2-80 characters).';
  else if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) errors.name = 'Name may only contain letters, spaces, dots and hyphens.';

  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email) || email.length > 120) {
    errors.email = 'Enter a valid email address.';
  }

  if (!/^[0-9]{10}$/.test(phone)) errors.phone = 'Phone number must be exactly 10 digits.';

  if (college.length < 2 || college.length > 120) errors.college = 'Enter your college name.';
  if (degree.length < 2 || degree.length > 120) errors.degree = 'Enter your degree and branch.';
  if (!YEARS.includes(year)) errors.year = 'Select your year of study.';

  if (!/^[A-Za-z0-9/_-]{2,40}$/.test(roll)) {
    errors.roll = 'Enter a valid register / roll number (2-40 letters, digits, - _ /).';
  }

  return {
    errors,
    values: {
      name,
      email,
      email_key: email,
      phone,
      college,
      degree,
      year_of_study: year,
      roll_no: roll,
      roll_key: roll
    }
  };
}

/* ------------------------------------------------------------------ *
 *  App                                                                *
 * ------------------------------------------------------------------ */

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

/* Express 4 does not catch rejected promises, so async handlers go through this. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use('/api', (req, res, next) => {
  noStore(res);
  next();
});

// Creates the tables on the first request of each (serverless) instance.
app.use(wrap(async (req, res, next) => {
  await db.init();
  next();
}));

/* Resolves the candidate behind the session cookie, auto-submitting first if
 * their 60 minutes elapsed while they were away. */
async function currentCandidate(req) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  let candidate = await stmt.byToken(token);
  if (!candidate) return null;

  if (candidate.status === 'in progress' && remainingMs(candidate) === 0) {
    candidate = (await finishAttempt(candidate.id, 'auto-submitted')) || (await stmt.byId(candidate.id));
  }
  return candidate;
}

const requireCandidate = wrap(async (req, res, next) => {
  const candidate = await currentCandidate(req);
  if (!candidate) return res.status(401).json({ ok: false, error: 'No active session. Please register again.' });
  req.candidate = candidate;
  next();
});

/* ---------------------------- registration ------------------------ */

app.post('/api/register', wrap(async (req, res) => {
  const { errors, values } = validateRegistration(req.body || {});
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const existing = await stmt.byEmailOrRoll(values.email_key, values.roll_key);

  if (existing) {
    const dupErrors = {};
    if (existing.email_key === values.email_key) dupErrors.email = 'This email has already taken the assessment.';
    if (existing.roll_key === values.roll_key) dupErrors.roll = 'This register / roll number has already taken the assessment.';
    return res.status(409).json({ ok: false, errors: dupErrors });
  }

  const token = newToken();
  const record = {
    ...values,
    token,
    question_order: JSON.stringify(shuffle(questions.map((q) => q.id))),
    start_time: Date.now(),
    ip: req.ip || ''
  };

  try {
    await stmt.insertCandidate(record);
  } catch (err) {
    // The UNIQUE indexes catch the race where two tabs register at once.
    if (db.isUniqueViolation(err)) {
      return res.status(409).json({
        ok: false,
        errors: { email: 'This email or roll number has already been registered.' }
      });
    }
    console.error('[register]', err);
    return res.status(500).json({ ok: false, error: 'Could not start the assessment. Please try again.' });
  }

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: DURATION_MS + 2 * 60 * 60 * 1000
  });
  console.log(`[register] ${record.name} (${record.roll_no}) <${record.email}>`);
  res.json({ ok: true, redirect: '/assessment' });
}));

/* ---------------------------- assessment -------------------------- */

app.get('/api/state', requireCandidate, wrap(async (req, res) => {
  const c = req.candidate;
  if (c.status !== 'in progress') {
    return res.json({ ok: true, finished: true, redirect: '/thankyou' });
  }

  /* Re-shuffle every time the paper is opened, so a refresh never shows the
   * questions in the same sequence twice. Answers are keyed by question id,
   * not by position, so nothing already saved is disturbed. */
  const order = shuffle(questions.map((q) => q.id));
  await stmt.setOrder(JSON.stringify(order), c.id);

  const saved = {};
  for (const a of await stmt.answersFor(c.id)) {
    saved[a.question_id] = { selected: a.selected, marked: !!a.marked };
  }

  // Correct answers are deliberately dropped here - the client never sees them.
  const payload = order
    .map((id) => QUESTION_BY_ID.get(id))
    .filter(Boolean)
    .map((q) => ({
      id: q.id,
      difficulty: q.difficulty,
      question: q.question,
      code: q.code || null,
      options: q.options
    }));

  res.json({
    ok: true,
    finished: false,
    candidate: { name: c.name, roll_no: c.roll_no, college: c.college },
    durationMinutes: DURATION_MINUTES,
    remainingMs: remainingMs(c),
    tabSwitches: c.tab_switches,
    questions: payload,
    answers: saved
  });
}));

app.post('/api/answer', requireCandidate, wrap(async (req, res) => {
  const c = req.candidate;
  if (c.status !== 'in progress') {
    return res.status(409).json({ ok: false, finished: true, redirect: '/thankyou' });
  }

  const questionId = Number(req.body && req.body.questionId);
  if (!QUESTION_BY_ID.has(questionId)) {
    return res.status(400).json({ ok: false, error: 'Unknown question.' });
  }

  let selected = req.body.selected;
  if (selected === null || selected === undefined || selected === '') selected = null;
  else {
    selected = Number(selected);
    if (!Number.isInteger(selected) || selected < 0 || selected > 3) {
      return res.status(400).json({ ok: false, error: 'Invalid option.' });
    }
  }

  await stmt.upsertAnswer({
    candidate_id: c.id,
    question_id: questionId,
    selected,
    marked: req.body.marked ? 1 : 0,
    updated_at: Date.now()
  });

  res.json({ ok: true, remainingMs: remainingMs(c) });
}));

app.post('/api/tab-switch', requireCandidate, wrap(async (req, res) => {
  await stmt.bumpTabSwitch(req.candidate.id);
  const updated = await stmt.byId(req.candidate.id);
  res.json({ ok: true, tabSwitches: updated ? updated.tab_switches : 0 });
}));

app.get('/api/heartbeat', requireCandidate, (req, res) => {
  const c = req.candidate;
  if (c.status !== 'in progress') {
    return res.json({ ok: true, finished: true, redirect: '/thankyou' });
  }
  res.json({ ok: true, finished: false, remainingMs: remainingMs(c) });
});

app.post('/api/submit', requireCandidate, wrap(async (req, res) => {
  const c = req.candidate;
  const status = req.body && req.body.auto ? 'auto-submitted' : 'submitted';

  if (c.status !== 'in progress') {
    return res.json({ ok: true, alreadySubmitted: true, redirect: '/thankyou' });
  }

  await finishAttempt(c.id, status);
  res.json({ ok: true, redirect: '/thankyou' });
}));

/* ------------------------------- admin ---------------------------- */

const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

/* Admin tokens are signed rather than stored in memory, so they stay valid
 * across serverless instances (Vercel) and server restarts. The key is derived
 * from the credentials, so changing the password signs everyone out. */
const ADMIN_SIGNING_KEY = crypto
  .createHash('sha256')
  .update('ism-admin:' + ADMIN_USERNAME + ':' + ADMIN_PASSWORD)
  .digest();

function signAdminToken(expires) {
  return crypto.createHmac('sha256', ADMIN_SIGNING_KEY).update(String(expires)).digest('hex');
}

// Constant-time compare so secrets cannot be probed byte by byte.
function safeEqual(supplied, expected) {
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isValidAdminToken(token) {
  const [expires, sig] = String(token || '').split('.');
  if (!expires || !sig || !/^\d+$/.test(expires)) return false;
  if (Number(expires) < Date.now()) return false;
  return safeEqual(sig, signAdminToken(expires));
}

function requireAdmin(req, res, next) {
  if (!isValidAdminToken(req.cookies[ADMIN_COOKIE])) {
    return res.status(401).json({ ok: false, error: 'Not authorised.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const username = String((req.body && req.body.username) || '').trim();
  const password = String((req.body && req.body.password) || '');

  // Evaluate both so the response time does not reveal which one was wrong.
  const userOk = safeEqual(username.toLowerCase(), ADMIN_USERNAME.toLowerCase());
  const passOk = safeEqual(password, ADMIN_PASSWORD);

  if (!(userOk && passOk)) {
    return res.status(401).json({ ok: false, error: 'Incorrect username or password.' });
  }

  const expires = Date.now() + ADMIN_SESSION_MS;
  const token = expires + '.' + signAdminToken(expires);
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: ADMIN_SESSION_MS
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.json({ ok: true });
});

async function candidateRow(c) {
  const answered = await stmt.answeredCount(c.id);

  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    college: c.college,
    degree: c.degree,
    year_of_study: c.year_of_study,
    roll_no: c.roll_no,
    start_time: c.start_time,
    submit_time: c.submit_time,
    time_taken_seconds: c.submit_time ? Math.round((c.submit_time - c.start_time) / 1000) : null,
    easy_score: c.easy_score,
    hard_score: c.hard_score,
    total_score: c.total_score,
    percentage: c.percentage,
    tab_switches: c.tab_switches,
    status: c.status,
    answered
  };
}

app.get('/api/admin/candidates', requireAdmin, wrap(async (req, res) => {
  await sweepExpired();
  const rows = await Promise.all((await stmt.allCandidates()).map(candidateRow));
  res.json({
    ok: true,
    serverTime: Date.now(),
    totals: { easy: EASY_TOTAL, hard: HARD_TOTAL, total: TOTAL_MARKS },
    candidates: rows
  });
}));

app.get('/api/admin/candidate/:id', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ ok: false, error: 'Candidate not found.' });
  const c = await stmt.byId(id);
  if (!c) return res.status(404).json({ ok: false, error: 'Candidate not found.' });

  const saved = new Map((await stmt.answersFor(c.id)).map((a) => [a.question_id, a]));

  /* Reviewed in the canonical bank order, not the candidate's shuffled order -
   * the shuffle changes on every reload, so it is no basis for numbering. */
  const detail = questions
    .map((q, idx) => {
      const a = saved.get(q.id);
      const selected = a && a.selected !== null && a.selected !== undefined ? a.selected : null;
      return {
        position: idx + 1,
        id: q.id,
        difficulty: q.difficulty,
        question: q.question,
        code: q.code || null,
        options: q.options,
        selected,
        selectedText: selected === null ? null : q.options[selected],
        correct: q.answer,
        correctText: q.options[q.answer],
        isCorrect: selected === q.answer,
        marked: !!(a && a.marked)
      };
    });

  res.json({ ok: true, candidate: await candidateRow(c), questions: detail });
}));

app.get('/api/admin/export.csv', requireAdmin, wrap(async (req, res) => {
  await sweepExpired();
  const rows = await stmt.allCandidates();
  const lines = [CSV_HEADER.map(csvCell).join(',')];

  for (const c of rows) {
    lines.push(
      [
        c.id, c.name, c.email, c.phone, c.college, c.degree, c.year_of_study, c.roll_no,
        new Date(c.start_time).toISOString(),
        c.submit_time ? new Date(c.submit_time).toISOString() : '',
        c.submit_time ? Math.round((c.submit_time - c.start_time) / 1000) : '',
        c.easy_score, c.hard_score, c.total_score, c.percentage, c.tab_switches, c.status
      ]
        .map(csvCell)
        .join(',')
    );
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="ism-assessment-results-${stamp}.csv"`);
  res.send('﻿' + lines.join('\n') + '\n'); // BOM so Excel reads UTF-8 correctly
}));

/* ------------------------------- pages ---------------------------- */

const PUBLIC_DIR = path.join(__dirname, 'public');

app.get('/', wrap(async (req, res) => {
  const candidate = await currentCandidate(req);
  if (candidate && candidate.status === 'in progress') return res.redirect('/assessment');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
}));

app.get('/assessment', wrap(async (req, res) => {
  noStore(res);
  const candidate = await currentCandidate(req);
  if (!candidate) return res.redirect('/');
  if (candidate.status !== 'in progress') return res.redirect('/thankyou');
  res.sendFile(path.join(PUBLIC_DIR, 'assessment.html'));
}));

app.get('/thankyou', (req, res) => {
  noStore(res);
  res.sendFile(path.join(PUBLIC_DIR, 'thankyou.html'));
});

app.get('/admin', (req, res) => {
  noStore(res);
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.use(express.static(PUBLIC_DIR, { index: false }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found.' });
  res.status(404).redirect('/');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  // Setup mistakes (no database connected) are shown as-is so they can be fixed.
  const error = db.kind === 'none' ? err.message : 'Server error. Please try again.';
  if (req.path.startsWith('/api/')) return res.status(500).json({ ok: false, error });
  res.status(500).type('text').send(error);
});

/* ------------------------------- boot ----------------------------- */

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push({ name, address: net.address });
    }
  }
  return out;
}

/* On Vercel the app is imported by api/index.js and run as a function; only a
 * direct `node server.js` starts a long-running server. */
module.exports = app;
if (require.main === module) startServer();

function startServer() {
  const server = app.listen(PORT, '0.0.0.0', () => {
    const lans = lanAddresses();
    const bar = '='.repeat(64);
    console.log('\n' + bar);
    console.log('  ISM DATA TECHNOLOGY ASSESSMENT');
    console.log(bar);
    console.log(`  Questions      : ${TOTAL_MARKS} (${EASY_TOTAL} easy + ${HARD_TOTAL} hard)`);
    console.log(`  Duration       : ${DURATION_MINUTES} minutes (server enforced)`);
    console.log(`  Database       : ${db.kind} - ${db.location}`);
    if (db.kind === 'sqlite') console.log(`  CSV backup     : ${CSV_FILE}`);
    console.log('-'.repeat(64));
    console.log(`  Local URL      : http://localhost:${PORT}/`);
    if (lans.length) {
      lans.forEach((l, i) => {
        console.log(`  LAN URL   ${i === 0 ? '     ' : '     '}: http://${l.address}:${PORT}/   (${l.name})`);
      });
      console.log(`  Admin URL      : http://${lans[0].address}:${PORT}/admin`);
    } else {
      console.log('  LAN URL        : (no external IPv4 interface detected)');
    }
    console.log(`  Admin (local)  : http://localhost:${PORT}/admin`);
    console.log(`  Admin username : ${ADMIN_USERNAME}`);
    console.log(`  Admin password : ${ADMIN_PASSWORD}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log('  >> WARNING: using the built-in default password. Set ADMIN_PASSWORD in .env.');
    }
    console.log(bar + '\n');
    console.log('  Share the LAN URL with candidates on the same Wi-Fi / network.');
    console.log('  Press Ctrl+C to stop.\n');
  });

  function shutdown(signal) {
    console.log(`\n[${signal}] shutting down, flushing database...`);
    server.close(async () => {
      try {
        await db.close();
      } catch (_) {
        /* already closed */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  setInterval(sweepExpired, 10000).unref();
  db.init().then(sweepExpired).catch((err) => console.error('[db]', err.message));
}
