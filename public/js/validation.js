(function () {
  'use strict';

  const form = document.getElementById('leadForm');
  if (!form) return;

  const fields = {
    name:    { el: document.getElementById('name'),    err: document.getElementById('nameError') },
    email:   { el: document.getElementById('email'),   err: document.getElementById('emailError') },
    budget:  { el: document.getElementById('budget'),  err: document.getElementById('budgetError') },
    message: { el: document.getElementById('message'), err: document.getElementById('messageError') },
  };

  const submitBtn    = document.getElementById('submitBtn');
  const successMsg   = document.getElementById('successMsg');
  const serverErrors = document.getElementById('serverErrors');
  const serverList   = document.getElementById('serverErrorList');
  const charCount    = document.getElementById('charCount');

  let submitting = false;

  // ── Validators ──────────────────────────────────────────────────────────────
  function validate(key) {
    const { el, err } = fields[key];
    const v = el.value.trim();
    let msg = '';

    if (key === 'name') {
      if (!v)          msg = 'Name is required';
      else if (v.length < 2)   msg = 'Name must be at least 2 characters';
      else if (v.length > 100) msg = 'Name must be under 100 characters';
    } else if (key === 'email') {
      if (!v)                              msg = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Please enter a valid email address';
    } else if (key === 'budget') {
      if (!el.value) msg = 'Please select a budget range';
    } else if (key === 'message') {
      if (!v)          msg = 'Message is required';
      else if (v.length < 10)   msg = 'Message must be at least 10 characters';
      else if (v.length > 2000) msg = 'Message must be under 2000 characters';
    }

    err.textContent = msg;
    el.classList.toggle('error',   !!msg);
    el.classList.toggle('success', !msg && !!v);
    return !msg;
  }

  // ── Char counter ────────────────────────────────────────────────────────────
  fields.message.el.addEventListener('input', function () {
    const len = this.value.length;
    charCount.textContent = len + ' / 2000';
    charCount.style.color = len > 1900 ? '#e63946' : '#6c757d';
    if (this.classList.contains('error') || this.classList.contains('success')) validate('message');
  });

  // ── Real-time validation on blur / input ────────────────────────────────────
  ['name', 'email', 'message'].forEach(key => {
    fields[key].el.addEventListener('blur', () => validate(key));
    fields[key].el.addEventListener('input', function () {
      if (this.classList.contains('error') || this.classList.contains('success')) validate(key);
    });
  });
  fields.budget.el.addEventListener('change', () => validate('budget'));

  // ── Submit ───────────────────────────────────────────────────────────────────
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (submitting) return;

    const valid = ['name', 'email', 'budget', 'message'].map(validate).every(Boolean);
    if (!valid) {
      form.querySelector('.error')?.focus();
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';
    serverErrors.style.display = 'none';

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    fields.name.el.value.trim(),
          email:   fields.email.el.value.trim(),
          budget:  fields.budget.el.value,
          message: fields.message.el.value.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        form.reset();
        Object.values(fields).forEach(({ el }) => el.classList.remove('error', 'success'));
        charCount.textContent = '0 / 2000';
        successMsg.style.display = 'flex';
        successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // hide success after 8s
        setTimeout(() => { successMsg.style.display = 'none'; }, 8000);
      } else {
        serverList.innerHTML = (data.errors || ['An error occurred']).map(e => `<li>${e}</li>`).join('');
        serverErrors.style.display = 'flex';
        serverErrors.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      serverList.innerHTML = '<li>Network error. Please check your connection and try again.</li>';
      serverErrors.style.display = 'flex';
    } finally {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').style.display = 'inline';
      submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
  });
})();
