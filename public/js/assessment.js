/*
 * Assessment runner.
 *
 * The browser holds no authority here: the timer is re-synced from the server,
 * answers are pushed to the server as they are chosen, and the correct options
 * are never downloaded. A refresh or a dropped connection loses nothing.
 */
(function () {
  'use strict';

  var LETTERS = ['A', 'B', 'C', 'D'];

  var state = {
    questions: [],
    answers: {},        // questionId -> { selected: int|null, marked: bool }
    index: 0,
    deadline: 0,        // local clock estimate of when time runs out
    tabSwitches: 0,
    submitting: false,
    finished: false,
    pending: {}         // questionId -> payload awaiting a successful save
  };

  var el = {
    loading: document.getElementById('loading'),
    layout: document.getElementById('examLayout'),
    who: document.getElementById('who'),
    timer: document.getElementById('timer'),
    saveState: document.getElementById('saveState'),
    qnum: document.getElementById('qnum'),
    qtag: document.getElementById('qtag'),
    qmarked: document.getElementById('qmarked'),
    qtext: document.getElementById('qtext'),
    qcode: document.getElementById('qcode'),
    opts: document.getElementById('opts'),
    qgrid: document.getElementById('qgrid'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    markBtn: document.getElementById('markBtn'),
    clearBtn: document.getElementById('clearBtn'),
    submitBtn: document.getElementById('submitBtn'),
    cAns: document.getElementById('cAns'),
    cUnans: document.getElementById('cUnans'),
    cMark: document.getElementById('cMark'),
    cTotal: document.getElementById('cTotal'),
    cTabs: document.getElementById('cTabs'),
    confirmOverlay: document.getElementById('confirmOverlay'),
    confirmSummary: document.getElementById('confirmSummary'),
    cancelSubmit: document.getElementById('cancelSubmit'),
    confirmSubmit: document.getElementById('confirmSubmit'),
    timeupOverlay: document.getElementById('timeupOverlay')
  };

  /* ------------------------------ plumbing ----------------------------- */

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, data: d }; });
    });
  }

  function goThankYou() {
    state.finished = true;
    window.location.replace('/thankyou');
  }

  /* --------------------------- autosave queue -------------------------- */

  function setSaveState(text, isError) {
    el.saveState.textContent = text;
    el.saveState.classList.toggle('err', !!isError);
  }

  function saveAnswer(questionId) {
    var a = state.answers[questionId] || { selected: null, marked: false };
    var payload = {
      questionId: questionId,
      selected: a.selected === null || a.selected === undefined ? null : a.selected,
      marked: !!a.marked
    };

    state.pending[questionId] = payload;
    setSaveState('Saving…');

    post('/api/answer', payload)
      .then(function (res) {
        if (res.data && res.data.finished) return goThankYou();
        if (!res.data || !res.data.ok) throw new Error('save rejected');

        // Only clear if nothing newer was queued for this question meanwhile.
        if (state.pending[questionId] === payload) delete state.pending[questionId];
        if (Object.keys(state.pending).length === 0) setSaveState('All answers saved');
      })
      .catch(function () {
        setSaveState('Offline — retrying…', true);
      });
  }

  // Anything that failed to save gets retried until it lands.
  setInterval(function () {
    var ids = Object.keys(state.pending);
    if (!ids.length || state.finished) return;
    ids.forEach(function (id) { saveAnswer(Number(id)); });
  }, 5000);

  /* ------------------------------- timer ------------------------------- */

  function formatTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function tick() {
    if (state.finished) return;
    var left = state.deadline - Date.now();
    el.timer.textContent = formatTime(left);
    el.timer.classList.toggle('low', left <= 5 * 60 * 1000);

    if (left <= 0) {
      el.timer.textContent = '00:00';
      autoSubmit();
    }
  }

  // Re-sync with the server so a paused or skewed client clock cannot buy time.
  function syncClock() {
    if (state.finished) return;
    fetch('/api/heartbeat')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) return;
        if (d.finished) return goThankYou();
        state.deadline = Date.now() + d.remainingMs;
        tick();
      })
      .catch(function () { /* offline: keep counting down locally */ });
  }

  /* ------------------------------ rendering ---------------------------- */

  function currentQuestion() { return state.questions[state.index]; }

  function answerFor(q) {
    if (!state.answers[q.id]) state.answers[q.id] = { selected: null, marked: false };
    return state.answers[q.id];
  }

  function renderQuestion() {
    var q = currentQuestion();
    if (!q) return;
    var a = answerFor(q);

    el.qnum.textContent = 'Question ' + (state.index + 1) + ' of ' + state.questions.length;
    el.qtag.textContent = q.difficulty;
    el.qtag.className = 'tag ' + q.difficulty;
    el.qmarked.style.display = a.marked ? '' : 'none';

    el.qtext.textContent = q.question;

    if (q.code) {
      el.qcode.textContent = q.code;
      el.qcode.style.display = '';
    } else {
      el.qcode.style.display = 'none';
    }

    el.opts.innerHTML = '';
    q.options.forEach(function (text, i) {
      var label = document.createElement('label');
      label.className = 'opt' + (a.selected === i ? ' sel' : '');

      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'q' + q.id;
      radio.value = String(i);
      radio.checked = a.selected === i;
      radio.addEventListener('change', function () { select(i); });

      var letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = LETTERS[i] + '.';

      var span = document.createElement('span');
      span.className = 'text';
      span.textContent = text;

      label.appendChild(radio);
      label.appendChild(letter);
      label.appendChild(span);
      el.opts.appendChild(label);
    });

    el.markBtn.textContent = a.marked ? 'Unmark review' : 'Mark for review';
    el.prevBtn.disabled = state.index === 0;
    el.nextBtn.disabled = state.index === state.questions.length - 1;

    renderGrid();
    renderCounts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderGrid() {
    el.qgrid.innerHTML = '';
    state.questions.forEach(function (q, i) {
      var a = state.answers[q.id] || {};
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(i + 1);
      if (a.selected !== null && a.selected !== undefined) b.classList.add('answered');
      if (a.marked) b.classList.add('marked');
      if (i === state.index) b.classList.add('current');
      b.title = 'Question ' + (i + 1);
      b.addEventListener('click', function () { goTo(i); });
      el.qgrid.appendChild(b);
    });
  }

  function tallies() {
    var answered = 0;
    var marked = 0;
    state.questions.forEach(function (q) {
      var a = state.answers[q.id];
      if (a && a.selected !== null && a.selected !== undefined) answered++;
      if (a && a.marked) marked++;
    });
    return { answered: answered, marked: marked, unanswered: state.questions.length - answered };
  }

  function renderCounts() {
    var t = tallies();
    el.cAns.textContent = t.answered;
    el.cUnans.textContent = t.unanswered;
    el.cMark.textContent = t.marked;
    el.cTabs.textContent = state.tabSwitches;
  }

  /* ------------------------------- actions ----------------------------- */

  function select(optionIndex) {
    var q = currentQuestion();
    var a = answerFor(q);
    a.selected = optionIndex;
    saveAnswer(q.id);
    renderQuestion();
  }

  function clearAnswer() {
    var q = currentQuestion();
    var a = answerFor(q);
    if (a.selected === null) return;
    a.selected = null;
    saveAnswer(q.id);
    renderQuestion();
  }

  function toggleMark() {
    var q = currentQuestion();
    var a = answerFor(q);
    a.marked = !a.marked;
    saveAnswer(q.id);
    renderQuestion();
  }

  function goTo(i) {
    if (i < 0 || i >= state.questions.length) return;
    state.index = i;
    renderQuestion();
  }

  el.prevBtn.addEventListener('click', function () { goTo(state.index - 1); });
  el.nextBtn.addEventListener('click', function () { goTo(state.index + 1); });
  el.markBtn.addEventListener('click', toggleMark);
  el.clearBtn.addEventListener('click', clearAnswer);

  document.addEventListener('keydown', function (e) {
    if (state.finished || el.confirmOverlay.style.display !== 'none') return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') goTo(state.index + 1);
    else if (e.key === 'ArrowLeft') goTo(state.index - 1);
    else if (/^[1-4]$/.test(e.key)) select(Number(e.key) - 1);
  });

  /* ------------------------------- submit ------------------------------ */

  el.submitBtn.addEventListener('click', function () {
    var t = tallies();
    var parts = [];
    parts.push('<p class="lead" style="margin-bottom:12px;">You have answered <strong>' +
      t.answered + ' of ' + state.questions.length + '</strong> questions.</p>');

    if (t.unanswered > 0) {
      parts.push('<div class="note bad"><strong>' + t.unanswered +
        ' question' + (t.unanswered === 1 ? '' : 's') + ' left unanswered.</strong>' +
        ' Unanswered questions score zero.</div>');
    } else {
      parts.push('<div class="note good">All questions answered.</div>');
    }

    if (t.marked > 0) {
      parts.push('<div class="note warn" style="margin-top:10px;">' + t.marked +
        ' question' + (t.marked === 1 ? ' is' : 's are') + ' still marked for review.</div>');
    }

    el.confirmSummary.innerHTML = parts.join('');
    el.confirmOverlay.style.display = 'flex';
  });

  el.cancelSubmit.addEventListener('click', function () {
    el.confirmOverlay.style.display = 'none';
  });

  el.confirmSubmit.addEventListener('click', function () {
    doSubmit(false);
  });

  function doSubmit(auto) {
    if (state.submitting || state.finished) return;
    state.submitting = true;
    el.confirmSubmit.disabled = true;
    el.confirmSubmit.textContent = 'Submitting…';
    el.submitBtn.disabled = true;

    post('/api/submit', { auto: !!auto })
      .then(function () { goThankYou(); })
      .catch(function () {
        // The server auto-submits on its own timer, so a failure here is not fatal.
        state.submitting = false;
        el.confirmSubmit.disabled = false;
        el.confirmSubmit.textContent = 'Yes, submit now';
        el.submitBtn.disabled = false;
        setSaveState('Submit failed — retrying…', true);
        setTimeout(function () { doSubmit(auto); }, 3000);
      });
  }

  function autoSubmit() {
    if (state.submitting || state.finished) return;
    el.confirmOverlay.style.display = 'none';
    el.timeupOverlay.style.display = 'flex';
    doSubmit(true);
  }

  /* ------------------------------ anti-cheat --------------------------- */

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  ['copy', 'cut', 'paste', 'dragstart', 'selectstart'].forEach(function (evt) {
    document.addEventListener(evt, function (e) { e.preventDefault(); });
  });

  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'u', 's', 'p'].indexOf(k) !== -1) {
      e.preventDefault();
    }
  });

  var lastSwitch = 0;
  function recordTabSwitch() {
    if (state.finished || state.submitting) return;
    var now = Date.now();
    if (now - lastSwitch < 1000) return; // blur+visibilitychange often fire together
    lastSwitch = now;

    state.tabSwitches++;
    renderCounts();
    post('/api/tab-switch', {})
      .then(function (res) {
        if (res.data && typeof res.data.tabSwitches === 'number') {
          state.tabSwitches = res.data.tabSwitches;
          renderCounts();
        }
      })
      .catch(function () { /* counted locally; the next one will sync */ });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) recordTabSwitch();
    else syncClock();
  });
  window.addEventListener('blur', recordTabSwitch);

  window.addEventListener('beforeunload', function (e) {
    if (state.finished || state.submitting) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });

  /* -------------------------------- boot ------------------------------- */

  fetch('/api/state')
    .then(function (r) {
      if (r.status === 401) { window.location.replace('/'); throw new Error('no session'); }
      return r.json();
    })
    .then(function (d) {
      if (!d || !d.ok) { window.location.replace('/'); return; }
      if (d.finished) { goThankYou(); return; }

      state.questions = d.questions;
      state.tabSwitches = d.tabSwitches || 0;
      state.deadline = Date.now() + d.remainingMs;

      d.questions.forEach(function (q) {
        var saved = d.answers[q.id];
        state.answers[q.id] = {
          selected: saved && saved.selected !== null && saved.selected !== undefined ? saved.selected : null,
          marked: !!(saved && saved.marked)
        };
      });

      // Resume where the candidate left off: first unanswered question.
      var firstUnanswered = state.questions.findIndex(function (q) {
        return state.answers[q.id].selected === null;
      });
      state.index = firstUnanswered === -1 ? 0 : firstUnanswered;

      el.who.textContent = d.candidate.name + ' · ' + d.candidate.roll_no;
      el.cTotal.textContent = state.questions.length;

      el.loading.style.display = 'none';
      el.layout.style.display = '';

      renderQuestion();
      tick();
      setInterval(tick, 500);
      setInterval(syncClock, 30000);
    })
    .catch(function (err) {
      if (String(err && err.message) === 'no session') return;
      el.loading.innerHTML = '<div class="note bad" style="max-width:420px;margin:0 auto;">' +
        'Could not load the question paper. Please refresh the page.</div>';
    });
})();
