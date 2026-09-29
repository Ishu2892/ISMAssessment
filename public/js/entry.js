/* Entry page - client-side validation mirrors the server rules, then registers. */
(function () {
  'use strict';

  var form = document.getElementById('regForm');
  var startBtn = document.getElementById('startBtn');
  var formError = document.getElementById('formError');

  var RULES = {
    name: function (v) {
      if (v.length < 2) return 'Please enter your full name.';
      if (!/^[A-Za-z][A-Za-z .'-]*$/.test(v)) return 'Name may only contain letters, spaces, dots and hyphens.';
      return '';
    },
    email: function (v) {
      if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v)) return 'Enter a valid email address.';
      return '';
    },
    phone: function (v) {
      if (!/^[0-9]{10}$/.test(v.replace(/[\s-]/g, ''))) return 'Phone number must be exactly 10 digits.';
      return '';
    },
    college: function (v) { return v.length < 2 ? 'Enter your college name.' : ''; },
    degree: function (v) { return v.length < 2 ? 'Enter your degree and branch.' : ''; },
    year: function (v) { return v ? '' : 'Select your year of study.'; },
    roll: function (v) {
      if (!/^[A-Za-z0-9/_-]{2,40}$/.test(v)) return 'Enter a valid register / roll number.';
      return '';
    }
  };

  function field(name) { return document.getElementById(name); }
  function errBox(name) { return document.querySelector('[data-err="' + name + '"]'); }

  function setError(name, message) {
    var el = field(name);
    var box = errBox(name);
    if (box) box.textContent = message || '';
    if (el) el.classList.toggle('bad', !!message);
  }

  function validateField(name) {
    var el = field(name);
    if (!el) return true;
    var value = el.value.trim().replace(/\s+/g, ' ');
    var message = RULES[name] ? RULES[name](value) : '';
    setError(name, message);
    return !message;
  }

  Object.keys(RULES).forEach(function (name) {
    var el = field(name);
    if (!el) return;
    el.addEventListener('blur', function () { validateField(name); });
    el.addEventListener('input', function () {
      if (el.classList.contains('bad')) validateField(name);
    });
  });

  // Phone: digits only, as typed.
  field('phone').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formError.style.display = 'none';

    var ok = true;
    var firstBad = null;
    Object.keys(RULES).forEach(function (name) {
      if (!validateField(name)) {
        ok = false;
        if (!firstBad) firstBad = name;
      }
    });

    if (!ok) {
      if (firstBad) field(firstBad).focus();
      return;
    }

    var payload = {
      name: field('name').value.trim(),
      email: field('email').value.trim(),
      phone: field('phone').value.trim(),
      college: field('college').value.trim(),
      degree: field('degree').value.trim(),
      year: field('year').value,
      roll: field('roll').value.trim()
    };

    startBtn.disabled = true;
    startBtn.textContent = 'Starting…';

    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
      .then(function (res) {
        if (res.data && res.data.ok) {
          window.location.replace(res.data.redirect || '/assessment');
          return;
        }

        startBtn.disabled = false;
        startBtn.innerHTML = 'Start assessment &rarr;';

        if (res.data && res.data.errors) {
          var names = Object.keys(res.data.errors);
          names.forEach(function (n) { setError(n, res.data.errors[n]); });
          formError.textContent = res.status === 409
            ? 'This candidate has already taken the assessment.'
            : 'Please correct the highlighted fields.';
          formError.style.display = 'block';
          if (names.length) {
            var el = field(names[0]);
            if (el) el.focus();
          }
        } else {
          formError.textContent = (res.data && res.data.error) || 'Something went wrong. Please try again.';
          formError.style.display = 'block';
        }
      })
      .catch(function () {
        startBtn.disabled = false;
        startBtn.innerHTML = 'Start assessment &rarr;';
        formError.textContent = 'Could not reach the server. Check your connection and try again.';
        formError.style.display = 'block';
      });
  });
})();
