/* ============ MediCare – login / sign-up page behaviour (shared by the 3 entry pages) ============ */
(function (global) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var phoneRe = /^[+\d][\d\s-]{6,}$/;

  function setErr(input, msg) {
    var f = input.closest('.field');
    f.classList.toggle('invalid', !!msg);
    var e = f.querySelector('.error'); if (e) e.textContent = msg || '';
    return !msg;
  }
  function showAlert(el, msg, type, link) {
    el.className = 'alert ' + (type || 'error');
    el.textContent = msg;
    if (link) { el.appendChild(document.createTextNode(' ')); var a = document.createElement('a'); a.href = link.href; a.textContent = link.label; a.style.fontWeight = '700'; el.appendChild(a); }
    el.classList.remove('hidden');
  }
  function hideAlert(el) { if (el) el.classList.add('hidden'); }

  /* Already signed in? go straight to that role's dashboard. */
  function redirectIfSignedIn() {
    var u = MC.Auth.current();
    if (u) { location.replace(MC.Access.home(u.role)); return true; }
    return false;
  }
  function nextUrl(user) {
    var n = App.param('next');
    if (n && /^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(n) && MC.Access.canAccess(MC.Access.pageName(n), user)) return n;
    return MC.Access.home(user.role);
  }

  /* Tabs: buttons with data-view="<id of panel>" */
  function bindTabs() {
    var tabs = document.querySelectorAll('.seg [role=tab]');
    function select(btn) {
      tabs.forEach(function (t) {
        var on = t === btn; t.setAttribute('aria-selected', String(on));
        $(t.dataset.view).classList.toggle('hidden', !on);
      });
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { select(t); }); });
    if (location.hash === '#register' || location.hash === '#apply') { var r = document.querySelector('.seg [role=tab]:nth-child(2)'); if (r) select(r); }
  }

  function bindLogin(portal) {
    var form = $('loginForm'), alertEl = $('loginAlert');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); hideAlert(alertEl);
      var em = $('loginEmail'), pw = $('loginPassword');
      var ok = setErr(em, !em.value.trim() ? 'Email is required.' : !emailRe.test(em.value.trim()) ? 'Enter a valid email address.' : '');
      ok = setErr(pw, !pw.value ? 'Password is required.' : '') && ok;
      if (!ok) return;
      var r = MC.Auth.login(em.value, pw.value, portal);
      if (!r.ok) {
        if (r.code === 'wrong-portal') showAlert(alertEl, r.error, 'error', { href: r.redirect, label: 'Go to the ' + r.redirect.replace('index.html', 'patient').replace('-login.html', '') + ' login' });
        else showAlert(alertEl, r.error, r.code === 'pending' ? 'warn' : 'error');
        return;
      }
      location.href = nextUrl(r.user);
    });
  }

  function bindPatientRegister() {
    $('registerForm').addEventListener('submit', function (e) {
      e.preventDefault(); hideAlert($('registerAlert'));
      var n = $('regName'), em = $('regEmail'), ph = $('regPhone'), pw = $('regPassword'), cf = $('regConfirm');
      var ok = setErr(n, n.value.trim().length < 3 ? 'Enter your full name.' : '');
      ok = setErr(em, !emailRe.test(em.value.trim()) ? 'Enter a valid email address.' : '') && ok;
      ok = setErr(ph, ph.value && !phoneRe.test(ph.value.trim()) ? 'Enter a valid phone number.' : '') && ok;
      ok = setErr(pw, MC.Auth.validatePassword(pw.value)) && ok;
      ok = setErr(cf, cf.value !== pw.value ? 'Passwords do not match.' : '') && ok;
      if (!ok) return;
      // The role is fixed by the data layer: this page can only ever create patient accounts.
      var r = MC.Auth.register({ name: n.value, email: em.value, phone: ph.value, password: pw.value });
      if (!r.ok) { showAlert($('registerAlert'), r.error); return; }
      location.href = nextUrl(r.user);
    });
  }

  function bindDoctorApply() {
    var form = $('applyForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); hideAlert($('applyAlert'));
      var f = function (id) { return $(id); };
      var name = f('apName'), em = f('apEmail'), ph = f('apPhone'), sp = f('apSpecialty'), lic = f('apLicense'), ex = f('apExperience'), fee = f('apFee'), loc = f('apLocation'), bio = f('apBio'), pw = f('apPassword'), cf = f('apConfirm'), chk = f('apConfirmInfo');
      var ok = setErr(name, name.value.replace(/^dr\.?\s*/i, '').trim().length < 3 ? 'Enter your full name.' : '');
      ok = setErr(em, !emailRe.test(em.value.trim()) ? 'Enter a valid email address.' : '') && ok;
      ok = setErr(ph, !phoneRe.test(ph.value.trim()) ? 'Enter a valid phone number.' : '') && ok;
      ok = setErr(sp, sp.value.trim().length < 2 ? 'Enter your specialty.' : '') && ok;
      ok = setErr(lic, !/^[A-Za-z0-9][A-Za-z0-9\-\/ ]{4,24}$/.test(lic.value.trim()) ? 'Enter your medical license number (5–25 letters, numbers or dashes).' : '') && ok;
      ok = setErr(ex, ex.value === '' || !(Number(ex.value) >= 0 && Number(ex.value) <= 60 && Number.isInteger(Number(ex.value))) ? 'Enter whole years, 0 to 60.' : '') && ok;
      ok = setErr(fee, fee.value === '' || !(Number(fee.value) >= 0 && Number(fee.value) <= 10000) ? 'Enter a fee between 0 and 10,000 EGP.' : '') && ok;
      ok = setErr(loc, loc.value.trim().length < 2 ? 'Enter your clinic or hospital location.' : '') && ok;
      ok = setErr(pw, MC.Auth.validatePassword(pw.value)) && ok;
      ok = setErr(cf, cf.value !== pw.value ? 'Passwords do not match.' : '') && ok;
      ok = setErr(chk, !chk.checked ? 'Please confirm that the information is accurate.' : '') && ok;
      if (!ok) return;
      var r = MC.Auth.registerDoctor({ name: name.value, email: em.value, phone: ph.value, specialty: sp.value, license: lic.value, experience: ex.value, fee: fee.value, location: loc.value, bio: bio.value, password: pw.value });
      if (!r.ok) { showAlert($('applyAlert'), r.error); return; }
      // No session is created: the account stays pending until an administrator approves it.
      $('applyDoneEmail').textContent = r.user.email;
      form.classList.add('hidden');
      $('applyDone').classList.remove('hidden');
      $('applyDone').scrollIntoView({ block: 'nearest' });
    });
    $('applyDoneBtn').addEventListener('click', function () {
      form.reset(); $('applyDone').classList.add('hidden'); form.classList.remove('hidden');
      var t = document.querySelector('.seg [role=tab]'); if (t) t.click();
    });
  }

  global.AuthUI = { redirectIfSignedIn: redirectIfSignedIn, bindTabs: bindTabs, bindLogin: bindLogin, bindPatientRegister: bindPatientRegister, bindDoctorApply: bindDoctorApply };
})(window);
