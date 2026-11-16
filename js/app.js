/* ============ MediCare – shared UI helpers ============ */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- toast ---------- */
  function toast(msg, type) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; stack.setAttribute('role', 'status'); stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(() => { t.remove(); }, 4200);
  }

  /* One-time message that survives a redirect (e.g. "no permission"). */
  function flash(msg, type) { try { sessionStorage.setItem('mc_flash', JSON.stringify({ msg: msg, type: type || '' })); } catch (e) { /* ignore */ } }
  function showFlash() {
    try {
      const raw = sessionStorage.getItem('mc_flash'); if (!raw) return null;
      sessionStorage.removeItem('mc_flash');
      const f = JSON.parse(raw); if (f && f.msg) { toast(f.msg, f.type); return f; }
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ---------- modal ---------- */
  function modal(opts) {
    // opts: {title, body (html), actions:[{label, cls, onClick(close, root)}], onOpen(root, close)}
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '"><h2>' + esc(opts.title) + '</h2><div class="modal-body">' + (opts.body || '') + '</div><div class="modal-actions"></div></div>';
    const box = back.querySelector('.modal');
    const actions = back.querySelector('.modal-actions');
    function close() { document.removeEventListener('keydown', onKey); back.remove(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    (opts.actions || []).forEach(a => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ' + (a.cls || 'btn-outline'); b.textContent = a.label;
      b.addEventListener('click', () => a.onClick ? a.onClick(close, box) : close());
      actions.appendChild(b);
    });
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    const first = box.querySelector('input,select,textarea,button');
    if (first) first.focus();
    if (opts.onOpen) opts.onOpen(box, close);
    return close;
  }

  function confirmBox(title, message, okLabel, onOk, danger) {
    modal({
      title, body: '<p class="muted">' + esc(message) + '</p>',
      actions: [
        { label: 'Cancel', cls: 'btn-outline' },
        { label: okLabel || 'Confirm', cls: danger === false ? 'btn-primary' : 'btn-danger', onClick: (close) => { close(); onOk(); } }
      ]
    });
  }

  /* ---------- navigation ---------- */
  function linksFor(role) {
    if (role === 'admin') return [['admin-dashboard.html', 'Dashboard'], ['doctors.html', 'Doctors']];
    if (role === 'doctor') return [['doctor-dashboard.html', 'Dashboard'], ['doctors.html', 'Doctors']];
    return [['patient-dashboard.html', 'Dashboard'], ['doctors.html', 'Find Doctors'], ['my-appointments.html', 'My Appointments']];
  }

  function renderHeader(user, active) {
    const host = document.getElementById('site-header');
    if (!host) return;
    const links = linksFor(user.role).map(l => {
      const isActive = l[0] === active || (active === 'doctor-profile.html' && l[0] === 'doctors.html') || (active === 'booking.html' && l[0] === 'doctors.html');
      return '<li><a href="' + l[0] + '"' + (isActive ? ' class="active" aria-current="page"' : '') + '>' + l[1] + '</a></li>';
    }).join('');
    const initials = user.name.replace(/^Dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    host.innerHTML =
      '<header class="site-header"><div class="container nav-bar">' +
      '<a class="brand" href="' + MC.Access.home(user.role) + '"><span class="brand-mark" aria-hidden="true">✚</span>MediCare</a>' +
      '<button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="navMenu">☰</button>' +
      '<div class="nav-menu" id="navMenu" style="display:contents">' +
      '<nav aria-label="Main"><ul class="nav-links">' + links + '</ul></nav>' +
      '<div class="nav-user"><div style="display:flex;align-items:center;gap:10px"><span class="avatar">' + esc(initials) + '</span><div class="user-meta"><strong>' + esc(user.name) + '</strong><span>' + esc(user.role) + '</span></div></div>' +
      '<button class="btn btn-outline btn-sm" id="logoutBtn" type="button">Log out</button></div></div>' +
      '</div></header>';
    // On wide screens the wrapper uses display:contents; on small screens it becomes the collapsible menu.
    const menu = document.getElementById('navMenu');
    const toggle = document.getElementById('navToggle');
    const mq = window.matchMedia('(max-width: 860px)');
    function sync() { menu.removeAttribute('style'); if (!mq.matches) { menu.style.display = 'contents'; menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } }
    sync();
    (mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync));
    toggle.addEventListener('click', () => { const o = menu.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(o)); });
    document.getElementById('logoutBtn').addEventListener('click', () => { MC.Auth.logout(); location.href = MC.Access.loginFor(user.role); });
  }

  function renderFooter() {
    const host = document.getElementById('site-footer');
    if (!host) return;
    host.innerHTML = '<footer class="site-footer"><div class="container"><span>© ' + new Date().getFullYear() + ' MediCare Clinic Appointments</span><span>Demo project – data is stored in your browser only.</span></div></footer>';
  }

  /* ---------- access control for protected pages ---------- */
  // Returns the signed-in user, or null after redirecting (not logged in, or role not allowed on this page).
  function enforce(page) {
    const user = MC.Auth.current();
    if (!user) { location.replace(MC.Access.loginForPage(page) + '?next=' + encodeURIComponent(page + location.search)); return null; }
    if (!MC.Access.canAccess(page, user)) {
      flash('You do not have permission to open that page.', 'error');
      location.replace(MC.Access.home(user.role));
      return null;
    }
    return user;
  }

  function init(opts) {
    opts = opts || {};
    const page = MC.Access.pageName(location.pathname);
    const user = enforce(page);
    if (!user) return null;
    renderHeader(user, opts.active || page);
    renderFooter();
    showFlash();

    // Keep the page honest if the session changes elsewhere: logging out in another tab,
    // an admin disabling this account, or the browser restoring a cached page after logout.
    window.addEventListener('storage', function (e) {
      if (e.key === 'mc_session' || e.key === 'mc_users') enforce(page);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) enforce(page); });
    return user;
  }

  function statusBadge(s) { return '<span class="badge ' + esc(s) + '">' + esc(s) + '</span>'; }
  function param(name) { return new URLSearchParams(location.search).get(name); }

  global.App = { esc, toast, flash, showFlash, modal, confirmBox, init, statusBadge, param, renderFooter };
})(window);
