# ISM DATA TECHNOLOGY ASSESSMENT

A self-contained online assessment platform for UG campus recruitment.
50 MCQs (20 easy + 30 hard), 60-minute server-enforced timer, live admin dashboard.

No build step, no external services — Node.js + Express + SQLite + plain HTML/CSS/JS.

---

## Run it

```bash
cd ism-assessment
npm install
npm start
```

The server prints the local URL, your LAN URL and the admin URL on startup.

| Page | URL |
| --- | --- |
| Candidate entry | `http://localhost:3000/` |
| Assessment | `http://localhost:3000/assessment` |
| Admin dashboard | `http://localhost:3000/admin` |

Share the **LAN URL** (e.g. `http://192.168.1.7:3000/`) with candidates on the same
Wi-Fi or network. On the first run Windows may ask you to allow Node.js through the
firewall — choose **Private networks**, otherwise phones and laptops on the Wi-Fi
cannot reach the server.

## Configuration — `.env`

```
PORT=3000
ADMIN_PASSWORD=pick-your-own
DURATION_MINUTES=60
```

Change `ADMIN_PASSWORD` before a real drive.

## How the exam works

**Registration** — name, email, phone (10 digits), college, degree & branch, year of
study and register/roll number are all required and validated on both sides. Email and
roll number are `UNIQUE` in the database, so nobody can attempt the paper twice — even
if two tabs submit at the same instant.

**The paper** — 50 questions, shuffled per candidate, one per screen, with a navigator
panel showing answered / unanswered / marked-for-review. Answers save to the server the
moment they are clicked; a failed save is retried every 5 seconds until it lands. A
refresh or a network drop loses nothing and drops the candidate back on their first
unanswered question.

**The timer is server-side.** `start_time` is written at registration and the remaining
time is recomputed from it on every request, so refreshing, closing the tab or changing
the machine clock buys no extra time. The browser re-syncs every 30 seconds. A
background sweeper closes and grades any attempt whose window expired while the
candidate was offline, marking it `auto-submitted`.

**Grading is server-only.** Correct answers live in `questions.js` on the server and are
stripped from every payload sent to the browser — viewing source or the network tab
reveals nothing. Candidates never see their score.

**Anti-cheat** — right-click, copy/cut/paste and text selection are blocked on the
question area, and every tab or window switch is counted and stored in the database
(shown in the admin table, flagged red when above zero).

## Admin dashboard

Sign in at `/admin` with the password from `.env`. The table auto-refreshes every 15
seconds and shows name, email, phone, college, degree, year, roll no, start and submit
time, time taken, easy score /20, hard score /30, total /50, percentage, tab-switch
count and status.

- Click any column header to sort (score, name, time taken, tab switches…).
- Search by name, roll number, email, college or phone; filter by status.
- Click a row to review every question with the candidate's answer against the correct one.
- **Download CSV / Excel** exports the full result set (UTF-8 with BOM, so Excel opens it cleanly).

## Data & durability

| File | Purpose |
| --- | --- |
| `assessment.db` | SQLite database (candidates + answers). Created on first run. |
| `results_backup.csv` | Every completed attempt is also appended here as a plain-text safety net. |

SQLite runs in WAL mode with `synchronous = FULL`, so the admin dashboard can read while
50 candidates write, and a committed answer survives a crash. `better-sqlite3` is
synchronous, which means concurrent writes are serialised inside the process — there is
no lost-update window. 20–50 simultaneous candidates is comfortably within range.

To archive a drive and start fresh, stop the server and move `assessment.db`,
`assessment.db-wal`, `assessment.db-shm` and `results_backup.csv` somewhere safe.

## Question bank

`questions.js` holds all 50 questions as `{ id, difficulty, question, code, options, answer }`
where `answer` is the 0-based index of the correct option. Each traced answer carries a
comment showing the reasoning, so the key can be re-checked at a glance.

- **20 easy** — OOP, data structures, DBMS/SQL, OS, networking, time complexity, simple output.
- **30 hard** — step-by-step tracing: pre/post increment (`i = i++ + ++i` in both Java and C),
  increments in loop conditions, short-circuit evaluation, recursion tracing and call
  counting, static variables in recursion, tail recursion, pointer arithmetic, operator
  precedence, negative integer division and modulo (C vs Python), bitwise tricks,
  nested loops with `break`/`continue`, string manipulation, Python aliasing and late
  binding, Java string interning and the Integer cache, SQL with NULLs, complexity
  analysis, BST traversal and stack-sequence feasibility.

Undefined behaviour appears in exactly one question, where
"Undefined behaviour / compiler dependent" is itself the correct option.

The server validates the bank at boot (50 questions, 20/30 split, unique ids, four
options each, answer index in range) and refuses to start if anything is off.

## Project layout

```
ism-assessment/
├── server.js            Express app, SQLite, grading, admin API
├── questions.js         The 50-question bank (correct answers live here only)
├── package.json
├── .env
└── public/
    ├── index.html       Entry / registration
    ├── assessment.html  Exam runner
    ├── thankyou.html    Confirmation
    ├── admin.html       Dashboard
    ├── styles.css
    └── js/
        ├── entry.js
        ├── assessment.js
        └── admin.js
```
