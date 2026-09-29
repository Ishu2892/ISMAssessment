/*
 * Storage for the assessment.
 *
 *  - DATABASE_URL set (Vercel + Neon/Postgres): results live in Postgres, so they
 *    survive across serverless instances and redeploys.
 *  - DATABASE_URL not set (running on a laptop): a local SQLite file, as before.
 *
 * Both expose the same small async API. SQL is written with `?` placeholders and
 * converted to `$1, $2, ...` for Postgres.
 */

'use strict';

const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

const SCHEMA_PG = `
  CREATE TABLE IF NOT EXISTS candidates (
    id              SERIAL PRIMARY KEY,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL,
    email_key       TEXT    NOT NULL UNIQUE,
    phone           TEXT    NOT NULL,
    college         TEXT    NOT NULL,
    degree          TEXT    NOT NULL,
    year_of_study   TEXT    NOT NULL,
    roll_no         TEXT    NOT NULL,
    roll_key        TEXT    NOT NULL UNIQUE,
    token           TEXT    NOT NULL UNIQUE,
    question_order  TEXT    NOT NULL,
    start_time      BIGINT  NOT NULL,
    submit_time     BIGINT,
    status          TEXT    NOT NULL DEFAULT 'in progress',
    tab_switches    INTEGER NOT NULL DEFAULT 0,
    easy_score      INTEGER,
    hard_score      INTEGER,
    total_score     INTEGER,
    percentage      DOUBLE PRECISION,
    ip              TEXT
  );

  CREATE TABLE IF NOT EXISTS answers (
    candidate_id  INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    question_id   INTEGER NOT NULL,
    selected      INTEGER,
    marked        INTEGER NOT NULL DEFAULT 0,
    updated_at    BIGINT  NOT NULL,
    PRIMARY KEY (candidate_id, question_id)
  );

  CREATE INDEX IF NOT EXISTS idx_answers_candidate ON answers(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
`;

const SCHEMA_SQLITE = `
  CREATE TABLE IF NOT EXISTS candidates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL,
    email_key       TEXT    NOT NULL UNIQUE,
    phone           TEXT    NOT NULL,
    college         TEXT    NOT NULL,
    degree          TEXT    NOT NULL,
    year_of_study   TEXT    NOT NULL,
    roll_no         TEXT    NOT NULL,
    roll_key        TEXT    NOT NULL UNIQUE,
    token           TEXT    NOT NULL UNIQUE,
    question_order  TEXT    NOT NULL,
    start_time      INTEGER NOT NULL,
    submit_time     INTEGER,
    status          TEXT    NOT NULL DEFAULT 'in progress',
    tab_switches    INTEGER NOT NULL DEFAULT 0,
    easy_score      INTEGER,
    hard_score      INTEGER,
    total_score     INTEGER,
    percentage      REAL,
    ip              TEXT
  );

  CREATE TABLE IF NOT EXISTS answers (
    candidate_id  INTEGER NOT NULL,
    question_id   INTEGER NOT NULL,
    selected      INTEGER,
    marked        INTEGER NOT NULL DEFAULT 0,
    updated_at    INTEGER NOT NULL,
    PRIMARY KEY (candidate_id, question_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_answers_candidate ON answers(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
`;

function toPgPlaceholders(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => '$' + ++n);
}

function createPostgres() {
  const { Pool, types } = require('pg');
  // BIGINT (millisecond timestamps) comes back as a string by default.
  types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000
  });

  let ready = null;
  const init = () => (ready = ready || pool.query(SCHEMA_PG).catch((err) => {
    ready = null; // let the next request retry
    throw err;
  }));

  return {
    kind: 'postgres',
    location: DATABASE_URL.replace(/\/\/[^@]*@/, '//***@'),
    init,
    async all(sql, params = []) {
      return (await pool.query(toPgPlaceholders(sql), params)).rows;
    },
    async get(sql, params = []) {
      return (await pool.query(toPgPlaceholders(sql), params)).rows[0];
    },
    async run(sql, params = []) {
      return { changes: (await pool.query(toPgPlaceholders(sql), params)).rowCount };
    },
    isUniqueViolation: (err) => err && err.code === '23505',
    async close() {
      await pool.end();
    }
  };
}

function createSqlite() {
  const Database = require('better-sqlite3');
  const file = path.join(__dirname, 'assessment.db');
  const db = new Database(file);

  /* WAL keeps readers (the admin dashboard polling every 15s) from blocking the
   * writers (50 students autosaving). better-sqlite3 is synchronous, so writes
   * from concurrent requests are already serialised inside this process. */
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQLITE);

  return {
    kind: 'sqlite',
    location: file,
    init: async () => {},
    async all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    async run(sql, params = []) {
      return { changes: db.prepare(sql).run(...params).changes };
    },
    isUniqueViolation: (err) => err && String(err.message).includes('UNIQUE'),
    async close() {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    }
  };
}

/* On Vercel the disk is read-only and wiped between requests, so SQLite cannot
 * work there. Fail with a clear message instead of a confusing crash. */
function createMissing() {
  const fail = async () => {
    throw new Error(
      'No database configured. In Vercel, open the project -> Storage -> connect a Neon ' +
      'Postgres database (it sets DATABASE_URL), then redeploy.'
    );
  };
  return { kind: 'none', location: '(not configured)', init: fail, all: fail, get: fail, run: fail,
    isUniqueViolation: () => false, close: async () => {} };
}

module.exports = DATABASE_URL ? createPostgres() : process.env.VERCEL ? createMissing() : createSqlite();
