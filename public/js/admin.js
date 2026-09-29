/* Admin dashboard: live candidate table, search, sort, per-candidate review, CSV export. */
(function () {
  'use strict';

  var LETTERS = ['A', 'B', 'C', 'D'];
  var REFRESH_MS = 15000;

  var data = { candidates: [], totals: { easy: 20, hard: 30, total: 50 } };
  var sort = { key: 'total_score', dir: 'desc' };
  var timer = null;

  var el = {
    loginView: document.getElementById('loginView'),
    dashView: document.getElementById('dashView'),
    loginForm: document.getElementById('loginForm'),
    user: document.getElementById('user'),
    pwd: document.getElementById('pwd'),
    loginErr: document.getElementById('loginErr'),
    stats: document.getElementById('stats'),
    rows: document.getElementById('rows'),
    emptyState: document.getElementById('emptyState'),
    search: document.getElementById('search'),
    statusFilter: document.getElementById('statusFilter'),
    rowCount: document.getElementById('rowCount'),
    headRow: document.getElementById('headRow'),
    liveStamp: document.getElementById('liveStamp'),
    refreshBtn: document.getElementById('refreshBtn'),
    exportBtn: document.getElementById('exportBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    detailOverlay: document.getElementById('detailOverlay'),
    detailName: document.getElementById('detailName'),
    detailMeta: document.getElementById('detailMeta'),
    detailBody: document.getElementById('detailBody'),
    closeDetail: document.getElementById('closeDetail')
  };

  /* ------------------------------ helpers ------------------------------ */

  function fmtTime(ms) {
    if (!ms) return '—';
    var d = new Date(ms);
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function fmtDuration(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }

  function statusPill(status) {
    var cls = status === 'submitted' ? 'submitted' : status === 'auto-submitted' ? 'auto' : 'progress';
    return '<span class="pill ' + cls + '">' + status + '</span>';
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------- login ------------------------------- */

  el.loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    el.loginErr.textContent = '';

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: el.user.value, password: el.pwd.value })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) {
          el.pwd.value = '';
          el.user.classList.remove('bad');
          el.pwd.classList.remove('bad');
          showDashboard();
        } else {
          el.loginErr.textContent = (d && d.error) || 'Incorrect username or password.';
          el.user.classList.add('bad');
          el.pwd.classList.add('bad');
        }
      })
      .catch(function () { el.loginErr.textContent = 'Could not reach the server.'; });
  });

  el.logoutBtn.addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST' }).finally(function () {
      if (timer) clearInterval(timer);
      el.dashView.style.display = 'none';
      el.loginView.style.display = '';
    });
  });

  function showDashboard() {
    el.loginView.style.display = 'none';
    el.dashView.style.display = '';
    load();
    if (timer) clearInterval(timer);
    timer = setInterval(load, REFRESH_MS);
  }

  /* -------------------------------- data ------------------------------- */

  function load() {
    return fetch('/api/admin/candidates')
      .then(function (r) {
        if (r.status === 401) {
          if (timer) clearInterval(timer);
          el.dashView.style.display = 'none';
          el.loginView.style.display = '';
          throw new Error('unauthorised');
        }
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.ok) return;
        data = d;
        render();
        el.liveStamp.textContent = 'Updated ' + new Date().toLocaleTimeString() + ' · auto-refresh 15s';
      })
      .catch(function (err) {
        if (String(err && err.message) === 'unauthorised') return;
        el.liveStamp.textContent = 'Connection lost — retrying…';
      });
  }

  el.refreshBtn.addEventListener('click', load);
  el.exportBtn.addEventListener('click', function () {
    window.location.href = '/api/admin/export.csv';
  });

  /* ------------------------------- render ------------------------------ */

  function visibleRows() {
    var q = el.search.value.trim().toLowerCase();
    var status = el.statusFilter.value;

    var rows = data.candidates.filter(function (c) {
      if (status && c.status !== status) return false;
      if (!q) return true;
      return [c.name, c.roll_no, c.email, c.college, c.degree, c.phone]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });

    rows.sort(function (a, b) {
      var x = a[sort.key];
      var y = b[sort.key];
      // Nulls (unfinished attempts) always sort last.
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      if (typeof x === 'string' && typeof y === 'string') {
        var cmp = x.localeCompare(y);
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      return sort.dir === 'asc' ? x - y : y - x;
    });

    return rows;
  }

  function renderStats() {
    var all = data.candidates;
    var done = all.filter(function (c) { return c.status !== 'in progress'; });
    var scored = done.filter(function (c) { return typeof c.total_score === 'number'; });
    var avg = scored.length
      ? (scored.reduce(function (s, c) { return s + c.total_score; }, 0) / scored.length).toFixed(1)
      : '—';
    var top = scored.length ? Math.max.apply(null, scored.map(function (c) { return c.total_score; })) : '—';

    var cards = [
      ['Registered', all.length],
      ['In progress', all.filter(function (c) { return c.status === 'in progress'; }).length],
      ['Submitted', done.length],
      ['Average score', avg + (scored.length ? ' / ' + data.totals.total : '')],
      ['Highest score', top + (scored.length ? ' / ' + data.totals.total : '')],
      ['Tab-switch flags', all.filter(function (c) { return c.tab_switches > 0; }).length]
    ];

    el.stats.innerHTML = cards.map(function (c) {
      return '<div class="stat"><div class="k">' + c[0] + '</div><div class="v">' + c[1] + '</div></div>';
    }).join('');
  }

  function renderHead() {
    Array.prototype.forEach.call(el.headRow.children, function (th) {
      var base = th.textContent.replace(/ [▲▼]$/, '');
      th.innerHTML = esc(base) + (th.dataset.key === sort.key
        ? ' <span class="arrow">' + (sort.dir === 'asc' ? '▲' : '▼') + '</span>'
        : '');
    });
  }

  function render() {
    renderStats();
    renderHead();

    var rows = visibleRows();
    el.rowCount.textContent = rows.length + ' of ' + data.candidates.length + ' candidates';
    el.emptyState.style.display = rows.length ? 'none' : '';

    el.rows.innerHTML = rows.map(function (c) {
      var scoreCell = function (v) {
        return typeof v === 'number' ? '<span class="score">' + v + '</span>' : '—';
      };
      return '<tr data-id="' + c.id + '">' +
        '<td>' + c.id + '</td>' +
        '<td><strong>' + esc(c.name) + '</strong></td>' +
        '<td>' + esc(c.roll_no) + '</td>' +
        '<td>' + esc(c.email) + '</td>' +
        '<td>' + esc(c.phone) + '</td>' +
        '<td>' + esc(c.college) + '</td>' +
        '<td>' + esc(c.degree) + '</td>' +
        '<td>' + esc(c.year_of_study) + '</td>' +
        '<td>' + fmtTime(c.start_time) + '</td>' +
        '<td>' + fmtTime(c.submit_time) + '</td>' +
        '<td>' + fmtDuration(c.time_taken_seconds) + '</td>' +
        '<td>' + scoreCell(c.easy_score) + '</td>' +
        '<td>' + scoreCell(c.hard_score) + '</td>' +
        '<td>' + scoreCell(c.total_score) + '</td>' +
        '<td>' + (typeof c.percentage === 'number' ? c.percentage.toFixed(1) + '%' : '—') + '</td>' +
        '<td' + (c.tab_switches > 0 ? ' class="flagged"' : '') + '>' + c.tab_switches + '</td>' +
        '<td>' + statusPill(c.status) + '</td>' +
        '</tr>';
    }).join('');
  }

  el.headRow.addEventListener('click', function (e) {
    var th = e.target.closest('th.sortable');
    if (!th) return;
    var key = th.dataset.key;
    if (sort.key === key) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    else {
      sort.key = key;
      sort.dir = ['name', 'roll_no', 'email', 'college', 'degree', 'status'].indexOf(key) !== -1 ? 'asc' : 'desc';
    }
    render();
  });

  el.search.addEventListener('input', render);
  el.statusFilter.addEventListener('change', render);

  /* ------------------------------- detail ------------------------------ */

  el.rows.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]');
    if (tr) openDetail(tr.dataset.id);
  });

  el.closeDetail.addEventListener('click', function () {
    el.detailOverlay.style.display = 'none';
  });

  el.detailOverlay.addEventListener('click', function (e) {
    if (e.target === el.detailOverlay) el.detailOverlay.style.display = 'none';
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') el.detailOverlay.style.display = 'none';
  });

  function openDetail(id) {
    el.detailName.textContent = 'Loading…';
    el.detailMeta.textContent = '';
    el.detailBody.innerHTML = '';
    el.detailOverlay.style.display = 'flex';

    fetch('/api/admin/candidate/' + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) {
          el.detailBody.innerHTML = '<div class="note bad">Could not load this candidate.</div>';
          return;
        }

        var c = d.candidate;
        el.detailName.textContent = c.name + ' — ' + c.roll_no;
        el.detailMeta.innerHTML =
          esc(c.email) + ' · ' + esc(c.phone) + '<br>' +
          esc(c.college) + ' · ' + esc(c.degree) + ' · Year ' + esc(c.year_of_study) + '<br>' +
          'Easy <strong>' + (c.easy_score === null ? '—' : c.easy_score) + '/' + d.questions.filter(function (q) { return q.difficulty === 'easy'; }).length + '</strong>' +
          ' · Hard <strong>' + (c.hard_score === null ? '—' : c.hard_score) + '/' + d.questions.filter(function (q) { return q.difficulty === 'hard'; }).length + '</strong>' +
          ' · Total <strong>' + (c.total_score === null ? '—' : c.total_score + '/' + data.totals.total) + '</strong>' +
          (typeof c.percentage === 'number' ? ' (' + c.percentage.toFixed(1) + '%)' : '') +
          '<br>Time taken ' + fmtDuration(c.time_taken_seconds) +
          ' · Tab switches ' + c.tab_switches +
          ' · ' + c.status;

        el.detailBody.innerHTML = d.questions.map(function (q) {
          var cls = q.selected === null ? 'blank' : (q.isCorrect ? 'right' : 'wrong');
          var given = q.selected === null
            ? '<span class="you">Not answered</span>'
            : '<span class="you' + (q.isCorrect ? ' ok' : '') + '">' +
              LETTERS[q.selected] + '. ' + esc(q.selectedText) + '</span>';

          return '<div class="review ' + cls + '">' +
            '<div class="qhead" style="margin-bottom:8px;">' +
              '<span class="qnum">Q' + q.position + '</span>' +
              '<span class="tag ' + q.difficulty + '">' + q.difficulty + '</span>' +
              (q.marked ? '<span class="tag mk">marked</span>' : '') +
            '</div>' +
            '<div style="font-weight:600;">' + esc(q.question) + '</div>' +
            (q.code ? '<pre class="code" style="margin:10px 0 0;">' + esc(q.code) + '</pre>' : '') +
            '<div class="ans"><span class="lab">Answered:</span> ' + given + '</div>' +
            '<div class="ans"><span class="lab">Correct:</span> <span class="sol">' +
              LETTERS[q.correct] + '. ' + esc(q.correctText) + '</span></div>' +
          '</div>';
        }).join('');
      })
      .catch(function () {
        el.detailBody.innerHTML = '<div class="note bad">Could not load this candidate.</div>';
      });
  }

  /* -------------------------------- boot ------------------------------- */

  // If an admin cookie is still valid, skip the login screen.
  fetch('/api/admin/candidates').then(function (r) {
    if (r.ok) showDashboard();
  }).catch(function () { /* stay on login */ });
})();
