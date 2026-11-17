/* ============ MediCare – data, auth & access layer (localStorage) ============
 * Every read and write goes through the functions below, and each one checks the
 * signed-in user's role. Raw storage is private to this file.
 * NOTE: this is a front-end demo. Browser storage can be edited by the person using the
 * browser, so these rules protect the app's UI and flows, not a real server.
 */
(function (global) {
  'use strict';

  const KEYS = { users: 'mc_users', doctors: 'mc_doctors', appts: 'mc_appts', session: 'mc_session', flash: 'mc_flash', seeded: 'mc_seeded_v1', migrated: 'mc_migrated_v3' };
  const MAX_AHEAD_DAYS = 90;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[+\d][\d\s-]{6,}$/;
  const LICENSE_RE = /^[A-Za-z0-9][A-Za-z0-9\-\/ ]{4,24}$/;
  const FORBIDDEN = 'You do not have permission to do that.';

  /* ---------- storage helpers ---------- */
  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }
  function drop(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function flash(msg, type) { try { sessionStorage.setItem(KEYS.flash, JSON.stringify({ msg: msg, type: type || '' })); } catch (e) { /* ignore */ } }

  const rawUsers = () => read(KEYS.users, []);
  const setUsers = (l) => write(KEYS.users, l);
  const rawDoctors = () => read(KEYS.doctors, []);
  const setDoctors = (l) => write(KEYS.doctors, l);
  const rawAppts = () => read(KEYS.appts, []);
  const setAppts = (l) => write(KEYS.appts, l);

  const fail = (error) => ({ ok: false, error: error });
  const ok = (extra) => Object.assign({ ok: true }, extra || {});
  function pub(u) { if (!u) return u; const c = Object.assign({}, u); delete c.password; if (!c.status) c.status = 'active'; return c; }
  function statusOf(u) { return u.status || 'active'; }

  /* ---------- date helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return toISO(new Date()); }
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); }
  function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function fmtDate(s, opts) { return parseISO(s).toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(t) {
    const [h, m] = t.split(':').map(Number);
    return (h % 12 || 12) + ':' + pad(m) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function nowTime() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ---------- validation helpers ---------- */
  function cleanText(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max); }
  function normEmail(s) { return cleanText(s, 120).toLowerCase(); }
  function passwordProblem(pw) {
    pw = String(pw == null ? '' : pw);
    if (pw.length < 8) return 'Use at least 8 characters.';
    if (pw.length > 72) return 'Use 72 characters or fewer.';
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Include at least one letter and one number.';
    return '';
  }
  function findByEmail(email) { const e = normEmail(email); return rawUsers().find(u => String(u.email).toLowerCase() === e); }
  function drName(n) { n = cleanText(n, 80).replace(/^dr\.?\s*/i, ''); return n ? 'Dr. ' + n : ''; }

  /* ---------- seed ---------- */
  const SEED_DOCTORS = [
    { id: 'd1', userId: 'u2', name: 'Dr. Sarah Ahmed', specialty: 'Cardiology', experience: 14, rating: 4.9, reviews: 212, fee: 600, location: 'Cairo – Heliopolis Clinic', languages: ['English', 'Arabic'], days: [0, 1, 2, 3, 4], start: 9, end: 16,
      education: 'MD, Cairo University · Fellowship, Cleveland Clinic', bio: 'Consultant cardiologist focused on preventive cardiology, hypertension and heart-failure management. Believes in clear explanations and long-term follow-up.',
      reviewList: [{ by: 'Mona K.', stars: 5, text: 'Very thorough and patient. Explained everything clearly.' }, { by: 'Hassan M.', stars: 5, text: 'Short waiting time and a precise diagnosis.' }], status: 'active' },
    { id: 'd2', name: 'Dr. Omar Khaled', specialty: 'Dermatology', experience: 9, rating: 4.7, reviews: 148, fee: 450, location: 'Giza – Dokki Medical Center', languages: ['English', 'Arabic'], days: [0, 2, 3, 4, 6], start: 10, end: 18,
      education: 'MD, Ain Shams University · Diploma in Cosmetic Dermatology', bio: 'Treats acne, eczema, hair loss and skin allergies with evidence-based plans tailored to each skin type.',
      reviewList: [{ by: 'Salma R.', stars: 5, text: 'My skin improved a lot in two months.' }, { by: 'Youssef A.', stars: 4, text: 'Great doctor, clinic can be busy.' }], status: 'active' },
    { id: 'd3', name: 'Dr. Laila Mansour', specialty: 'Pediatrics', experience: 11, rating: 4.9, reviews: 305, fee: 400, location: 'Cairo – Maadi Kids Clinic', languages: ['English', 'Arabic', 'French'], days: [0, 1, 2, 3, 4, 6], start: 9, end: 15,
      education: 'MD, Alexandria University · MRCPCH (UK)', bio: 'Pediatrician caring for newborns through teenagers, with a special interest in nutrition, vaccinations and developmental check-ups.',
      reviewList: [{ by: 'Nour H.', stars: 5, text: 'My kids love her. So gentle and kind.' }, { by: 'Ahmed S.', stars: 5, text: 'Always available for follow-up questions.' }], status: 'active' },
    { id: 'd4', name: 'Dr. Karim Fathy', specialty: 'Orthopedics', experience: 16, rating: 4.6, reviews: 120, fee: 700, location: 'Cairo – Nasr City Hospital', languages: ['English', 'Arabic'], days: [1, 2, 3, 4], start: 11, end: 19,
      education: 'MD, Cairo University · Sports Medicine Fellowship, Germany', bio: 'Orthopedic surgeon specialising in sports injuries, joint pain and minimally invasive knee and shoulder procedures.',
      reviewList: [{ by: 'Tarek E.', stars: 5, text: 'Back to football after 3 months. Thank you!' }, { by: 'Dina F.', stars: 4, text: 'Professional and honest about options.' }], status: 'active' },
    { id: 'd5', name: 'Dr. Mariam Saeed', specialty: 'Neurology', experience: 12, rating: 4.8, reviews: 97, fee: 650, location: 'Alexandria – Smouha Clinic', languages: ['English', 'Arabic'], days: [0, 1, 3, 4], start: 9, end: 14,
      education: 'MD, Alexandria University · PhD Neurology', bio: 'Specialist in migraine, epilepsy and sleep disorders, using modern diagnostics and patient-centred treatment plans.',
      reviewList: [{ by: 'Ibrahim G.', stars: 5, text: 'Finally found the cause of my headaches.' }], status: 'active' },
    { id: 'd6', name: 'Dr. Hany Rashad', specialty: 'Dentistry', experience: 8, rating: 4.5, reviews: 183, fee: 350, location: 'Giza – Mohandessin Dental Care', languages: ['English', 'Arabic'], days: [0, 1, 2, 3, 6], start: 12, end: 20,
      education: 'BDS, Cairo University · Orthodontics Certificate', bio: 'General and cosmetic dentist offering check-ups, whitening, fillings, braces and painless root canal treatment.',
      reviewList: [{ by: 'Farah N.', stars: 5, text: 'Painless and quick. Clinic is spotless.' }, { by: 'Mostafa B.', stars: 4, text: 'Good results, fair price.' }], status: 'active' }
  ];

  const SEED_USERS = [
    { id: 'u1', name: 'Mazen Patient', email: 'patient@demo.com', password: '1234', role: 'patient', phone: '+20 100 000 0001', status: 'active' },
    { id: 'u2', name: 'Dr. Sarah Ahmed', email: 'doctor@demo.com', password: '1234', role: 'doctor', phone: '+20 100 000 0002', status: 'active', doctorId: 'd1' },
    { id: 'u3', name: 'Admin User', email: 'admin@demo.com', password: '1234', role: 'admin', phone: '+20 100 000 0003', status: 'active' }
  ];

  function seed() {
    if (read(KEYS.seeded, false)) return;
    setUsers(SEED_USERS);
    setDoctors(SEED_DOCTORS);
    const t = (n) => addDays(n);
    setAppts([
      { id: 'a1', patientId: 'u1', doctorId: 'd1', date: t(2), time: '10:00', reason: 'Routine heart check-up', status: 'confirmed', createdAt: Date.now() - 86400000 },
      { id: 'a2', patientId: 'u1', doctorId: 'd3', date: t(5), time: '11:30', reason: 'Child vaccination', status: 'pending', createdAt: Date.now() - 3600000 },
      { id: 'a3', patientId: 'u1', doctorId: 'd2', date: t(-6), time: '12:00', reason: 'Skin allergy', status: 'completed', createdAt: Date.now() - 9 * 86400000 },
      { id: 'a4', patientId: 'u1', doctorId: 'd6', date: t(-3), time: '14:00', reason: 'Teeth cleaning', status: 'cancelled', createdAt: Date.now() - 6 * 86400000 }
    ]);
    write(KEYS.seeded, true);
  }

  /* Default accounts: created once in storage so they can be used with the normal login forms. */
  const DEFAULT_ACCOUNTS = [
    { role: 'patient', email: 'patient@demo.com', password: '1234' },
    { role: 'doctor', email: 'doctor@demo.com', password: '1234' },
    { role: 'admin', email: 'admin@demo.com', password: '1234' }
  ];
  function logDefaultAccounts() {
    try {
      console.info('[MediCare] Default accounts (log in through each role\'s own login page):\n' +
        DEFAULT_ACCOUNTS.map(a => '  ' + a.role.padEnd(8) + a.email + ' / ' + a.password).join('\n'));
    } catch (e) { /* ignore */ }
  }

  /* One-time, additive upgrade (keeps existing data): makes sure the three default accounts exist and
   * adds a sample pending doctor application so the approval flow can be tried. */
  function migrate() {
    if (read(KEYS.migrated, false)) return;
    const users = rawUsers(), docs = rawDoctors();
    SEED_USERS.forEach(s => {
      if (!users.some(u => String(u.email).toLowerCase() === s.email)) users.push(Object.assign({}, s));
    });
    SEED_DOCTORS.forEach(s => { if (!docs.some(d => d.id === s.id)) docs.push(JSON.parse(JSON.stringify(s))); });
    setUsers(users); setDoctors(docs);
    if (!users.some(u => u.id === 'u4')) {
      users.push({ id: 'u4', name: 'Dr. Nadia Fouad', email: 'nadia.pending@demo.com', password: 'Pending123', role: 'doctor', phone: '+20 100 000 0004', status: 'pending', doctorId: 'd7', license: 'EG-GYN-48213', appliedAt: Date.now() - 2 * 86400000 });
      setUsers(users);
    }
    if (!docs.some(d => d.id === 'd7')) {
      docs.push({ id: 'd7', userId: 'u4', name: 'Dr. Nadia Fouad', specialty: 'Gynecology', experience: 7, rating: 0, reviews: 0, fee: 500, location: 'Cairo – New Cairo Clinic', languages: ['English', 'Arabic'], days: [0, 1, 2, 3, 4], start: 9, end: 16,
        education: '', bio: 'Obstetrics and gynecology specialist applying to join MediCare.', license: 'EG-GYN-48213', reviewList: [], status: 'pending' });
      setDoctors(docs);
    }
    write(KEYS.migrated, true);
    logDefaultAccounts();
  }

  /* ---------- access control ---------- */
  const PAGE_ACCESS = {
    'index.html': null,                                   // public: patient login / sign-up
    'doctor-login.html': null,                            // public: doctor login / application
    'admin-login.html': null,                             // public: administrator login (no sign-up)
    'patient-dashboard.html': ['patient'],
    'doctors.html': ['patient', 'doctor', 'admin'],
    'doctor-profile.html': ['patient', 'doctor', 'admin'],
    'booking.html': ['patient'],
    'my-appointments.html': ['patient'],
    'doctor-dashboard.html': ['doctor'],
    'admin-dashboard.html': ['admin']
  };
  const PERMS = {
    patient: ['appointments.bookOwn', 'appointments.cancelOwn', 'profile.editOwn'],
    doctor: ['appointments.manageOwn', 'schedule.editOwn', 'profile.editOwn'],
    admin: ['users.manage', 'doctors.manage', 'applications.review', 'admins.create', 'appointments.manageAll', 'profile.editOwn']
  };
  const Access = {
    pages: PAGE_ACCESS,
    pageName(p) { const s = String(p || '').split('?')[0].split('#')[0].split('/').pop(); return s || 'index.html'; },
    canAccess(page, user) {
      if (!(page in PAGE_ACCESS)) return !!user;
      const r = PAGE_ACCESS[page];
      if (r === null) return true;
      return !!user && r.indexOf(user.role) > -1;
    },
    home(role) { return role === 'admin' ? 'admin-dashboard.html' : role === 'doctor' ? 'doctor-dashboard.html' : 'patient-dashboard.html'; },
    /* each role has its own entry page */
    loginFor(role) { return role === 'admin' ? 'admin-login.html' : role === 'doctor' ? 'doctor-login.html' : 'index.html'; },
    /* where an anonymous visitor is sent when they open a protected page */
    loginForPage(page) { const r = PAGE_ACCESS[page]; return r && r.length === 1 ? Access.loginFor(r[0]) : 'index.html'; },
    isLoginPage(page) { return page === 'index.html' || page === 'doctor-login.html' || page === 'admin-login.html'; },
    can(perm) { const a = Auth.current(); return !!a && (PERMS[a.role] || []).indexOf(perm) > -1; }
  };
  function actor() { return Auth.current(); }
  function isAdmin() { const a = actor(); return !!a && a.role === 'admin'; }

  /* ---------- users ---------- */
  const Users = {
    all() { return isAdmin() ? rawUsers().map(pub) : []; },
    byId(id) {
      const a = actor(); if (!a) return undefined;
      const u = rawUsers().find(x => x.id === id); if (!u) return undefined;
      if (a.role === 'admin' || a.id === id) return pub(u);
      // a doctor may see basic contact details of patients who booked with them
      if (a.role === 'doctor' && u.role === 'patient' && rawAppts().some(x => x.patientId === id && x.doctorId === a.doctorId)) {
        return { id: u.id, name: u.name, phone: u.phone, role: u.role, status: 'active' };
      }
      return undefined;
    },
    emailTaken(email) { return !!findByEmail(email); },
    update(id, patch) {
      const a = actor(); if (!a) return fail('Please log in.');
      if (!(a.role === 'admin' || a.id === id)) return fail(FORBIDDEN);
      const list = rawUsers(); const i = list.findIndex(u => u.id === id); if (i < 0) return fail('User not found.');
      patch = patch || {};
      if ('name' in patch) { const n = cleanText(patch.name, 80); if (n.length < 3) return fail('Enter a full name.'); list[i].name = n; }
      if ('phone' in patch) { const ph = cleanText(patch.phone, 30); if (ph && !PHONE_RE.test(ph)) return fail('Enter a valid phone number.'); list[i].phone = ph; }
      setUsers(list); return ok();       // role, email, status and password can never be changed here
    },
    setStatus(id, status) {
      if (!isAdmin()) return fail(FORBIDDEN);
      if (id === actor().id) return fail('You cannot change your own account status.');
      if (status !== 'active' && status !== 'disabled') return fail('Invalid status.');
      const list = rawUsers(); const i = list.findIndex(u => u.id === id); if (i < 0) return fail('User not found.');
      const cur = statusOf(list[i]);
      if (cur !== 'active' && cur !== 'disabled') return fail('Pending and rejected doctor accounts are handled under Applications.');
      list[i].status = status; setUsers(list); return ok();
    },
    createAdmin(data) {
      if (!isAdmin()) return fail(FORBIDDEN);
      data = data || {};
      const name = cleanText(data.name, 80), email = normEmail(data.email);
      if (name.length < 3) return fail('Enter the administrator\'s full name.');
      if (!EMAIL_RE.test(email)) return fail('Enter a valid email address.');
      if (findByEmail(email)) return fail('An account with this email already exists.');
      const pp = passwordProblem(data.password); if (pp) return fail(pp);
      const list = rawUsers();
      const u = { id: uid('u'), name: name, email: email, password: String(data.password), role: 'admin', phone: '', status: 'active', createdBy: actor().id };
      list.push(u); setUsers(list); return ok({ user: pub(u) });
    },
    removeCascade(id) {
      if (!isAdmin()) return fail(FORBIDDEN);
      if (id === actor().id) return fail('You cannot delete your own account.');
      const u = rawUsers().find(x => x.id === id); if (!u) return fail('User not found.');
      if (u.role === 'doctor' && u.doctorId) {
        setAppts(rawAppts().filter(a => a.doctorId !== u.doctorId));
        setDoctors(rawDoctors().filter(d => d.id !== u.doctorId));
      }
      if (u.role === 'patient') setAppts(rawAppts().filter(a => a.patientId !== id));
      setUsers(rawUsers().filter(x => x.id !== id));
      return ok();
    }
  };

  /* ---------- doctors ---------- */
  function doctorProblem(d) {
    if (d.name.length < 7) return 'Enter the doctor\'s full name.';
    if (d.specialty.length < 2) return 'Specialty is required.';
    if (d.location.length < 2) return 'Location is required.';
    if (!(Number.isInteger(d.experience) && d.experience >= 0 && d.experience <= 60)) return 'Experience must be between 0 and 60 years.';
    if (!(typeof d.fee === 'number' && isFinite(d.fee) && d.fee >= 0 && d.fee <= 10000)) return 'Enter a valid consultation fee.';
    return '';
  }
  function normaliseDoctorInput(data) {
    return { name: drName(data.name), specialty: cleanText(data.specialty, 60), location: cleanText(data.location, 120), experience: Number(data.experience), fee: Number(data.fee), bio: cleanText(data.bio, 400), license: cleanText(data.license, 25) };
  }
  function buildDoctor(n, status) {
    return { id: uid('d'), userId: null, name: n.name, specialty: n.specialty, experience: n.experience, rating: 0, reviews: 0, fee: n.fee, location: n.location, languages: ['English', 'Arabic'], days: [0, 1, 2, 3, 4], start: 9, end: 16, education: '', bio: n.bio, license: n.license, reviewList: [], status: status };
  }

  const Doctors = {
    all() { return isAdmin() ? rawDoctors() : rawDoctors().filter(d => d.status === 'active'); },
    active() { return rawDoctors().filter(d => d.status === 'active'); },
    byId(id) {
      const d = rawDoctors().find(x => x.id === id); if (!d) return undefined;
      if (d.status === 'active') return d;
      const a = actor();
      if (a && (a.role === 'admin' || (a.role === 'doctor' && a.doctorId === d.id))) return d;
      return undefined;
    },
    specialties() { return Array.from(new Set(this.active().map(d => d.specialty))).sort(); },
    update(id, patch) {
      const a = actor(); if (!a) return fail('Please log in.');
      const list = rawDoctors(); const i = list.findIndex(d => d.id === id); if (i < 0) return fail('Doctor not found.');
      let allowed;
      if (a.role === 'admin') allowed = ['name', 'specialty', 'location', 'experience', 'fee', 'bio', 'education', 'languages', 'days', 'start', 'end', 'license'];
      else if (a.role === 'doctor' && a.doctorId === id) allowed = ['days', 'start', 'end', 'fee'];
      else return fail(FORBIDDEN);
      patch = patch || {};
      const keys = Object.keys(patch);
      if (keys.some(k => allowed.indexOf(k) < 0)) return fail(FORBIDDEN);
      const next = Object.assign({}, list[i]);
      keys.forEach(k => { next[k] = patch[k]; });
      if ('name' in patch) next.name = drName(patch.name);
      ['specialty', 'location'].forEach(k => { if (k in patch) next[k] = cleanText(patch[k], k === 'specialty' ? 60 : 120); });
      if ('bio' in patch) next.bio = cleanText(patch.bio, 400);
      if ('education' in patch) next.education = cleanText(patch.education, 200);
      if ('license' in patch) next.license = cleanText(patch.license, 25);
      if ('experience' in patch) next.experience = Number(patch.experience);
      if ('fee' in patch) next.fee = Number(patch.fee);
      if ('days' in patch) {
        const d = Array.isArray(patch.days) ? patch.days.map(Number) : [];
        if (!d.length || d.some(x => !Number.isInteger(x) || x < 0 || x > 6)) return fail('Select at least one valid working day.');
        next.days = Array.from(new Set(d)).sort();
      }
      if ('start' in patch || 'end' in patch) {
        next.start = Number(next.start); next.end = Number(next.end);
        if (!(Number.isInteger(next.start) && Number.isInteger(next.end) && next.start >= 0 && next.end <= 24 && next.start < next.end)) return fail('End time must be after start time.');
      }
      const prob = doctorProblem({ name: next.name, specialty: next.specialty, location: next.location, experience: Number(next.experience), fee: Number(next.fee) });
      if (prob) return fail(prob);
      list[i] = next; setDoctors(list); return ok();
    },
    setStatus(id, status) {
      if (!isAdmin()) return fail(FORBIDDEN);
      if (status !== 'active' && status !== 'disabled') return fail('Invalid status.');
      const list = rawDoctors(); const i = list.findIndex(d => d.id === id); if (i < 0) return fail('Doctor not found.');
      if (list[i].status !== 'active' && list[i].status !== 'disabled') return fail('Pending and rejected applications are handled under Applications.');
      list[i].status = status; setDoctors(list); return ok();
    },
    removeCascade(id) {
      if (!isAdmin()) return fail(FORBIDDEN);
      if (!rawDoctors().some(d => d.id === id)) return fail('Doctor not found.');
      setAppts(rawAppts().filter(a => a.doctorId !== id));
      setUsers(rawUsers().filter(u => u.doctorId !== id));
      setDoctors(rawDoctors().filter(d => d.id !== id));
      return ok();
    },
    initials(name) { return String(name).replace(/^Dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); },
    ratingLabel(d, withCount) { return d && d.reviews > 0 ? '★ ' + Number(d.rating).toFixed(1) + (withCount ? ' (' + d.reviews + ')' : '') : 'New'; }
  };

  /* ---------- admin-only workflows ---------- */
  const Admin = {
    applications() {
      if (!isAdmin()) return [];
      const docs = rawDoctors();
      return rawUsers().filter(u => u.role === 'doctor' && (statusOf(u) === 'pending' || statusOf(u) === 'rejected'))
        .sort((a, b) => (statusOf(a) === 'pending' ? 0 : 1) - (statusOf(b) === 'pending' ? 0 : 1) || (b.appliedAt || 0) - (a.appliedAt || 0))
        .map(u => ({ user: pub(u), doctor: docs.find(d => d.id === u.doctorId) || null }));
    },
    pendingApplications() { return this.applications().filter(x => x.user.status === 'pending'); },
    approveDoctor(userId) {
      if (!isAdmin()) return fail(FORBIDDEN);
      const users = rawUsers(); const i = users.findIndex(u => u.id === userId && u.role === 'doctor'); if (i < 0) return fail('Application not found.');
      if (statusOf(users[i]) !== 'pending' && statusOf(users[i]) !== 'rejected') return fail('This account is not an open application.');
      const docs = rawDoctors(); const j = docs.findIndex(d => d.id === users[i].doctorId); if (j < 0) return fail('Doctor profile missing.');
      users[i].status = 'active'; delete users[i].rejectionReason; users[i].reviewedAt = Date.now();
      docs[j].status = 'active';
      setUsers(users); setDoctors(docs); return ok();
    },
    rejectDoctor(userId, reason) {
      if (!isAdmin()) return fail(FORBIDDEN);
      const users = rawUsers(); const i = users.findIndex(u => u.id === userId && u.role === 'doctor'); if (i < 0) return fail('Application not found.');
      if (statusOf(users[i]) !== 'pending') return fail('Only pending applications can be rejected.');
      const docs = rawDoctors(); const j = docs.findIndex(d => d.id === users[i].doctorId);
      users[i].status = 'rejected'; users[i].rejectionReason = cleanText(reason, 200); users[i].reviewedAt = Date.now();
      if (j > -1) docs[j].status = 'rejected';
      setUsers(users); setDoctors(docs); return ok();
    },
    addDoctor(data, login) {
      if (!isAdmin()) return fail(FORBIDDEN);
      const n = normaliseDoctorInput(data || {}); const prob = doctorProblem(n); if (prob) return fail(prob);
      let email = '';
      if (login && (login.email || login.password)) {
        email = normEmail(login.email);
        if (!EMAIL_RE.test(email)) return fail('Enter a valid login email.');
        if (findByEmail(email)) return fail('That email is already in use.');
        const pp = passwordProblem(login.password); if (pp) return fail(pp);
      }
      const doc = buildDoctor(n, 'active');
      if (email) {
        const u = { id: uid('u'), name: doc.name, email: email, password: String(login.password), role: 'doctor', phone: '', status: 'active', doctorId: doc.id };
        doc.userId = u.id; const users = rawUsers(); users.push(u); setUsers(users);
      }
      const docs = rawDoctors(); docs.push(doc); setDoctors(docs);
      return ok({ doctor: doc });
    }
  };

  /* ---------- appointments ---------- */
  const TRANSITIONS = { pending: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] };
  const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

  function takenRaw(doctorId, date, time, ignoreId) {
    return rawAppts().some(a => a.id !== ignoreId && a.doctorId === doctorId && a.date === date && a.time === time && a.status !== 'cancelled');
  }
  function slotProblem(doc, date, time, ignoreId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || isNaN(parseISO(date).getTime())) return 'Invalid date or time.';
    if (date < todayISO()) return 'The date cannot be in the past.';
    if (date > addDays(MAX_AHEAD_DAYS)) return 'Appointments can be booked up to ' + MAX_AHEAD_DAYS + ' days ahead.';
    if (doc.days.indexOf(parseISO(date).getDay()) < 0) return doc.name + ' does not work on this day.';
    const h = Number(time.slice(0, 2)), m = time.slice(3);
    if (!(m === '00' || m === '30') || h < doc.start || h >= doc.end) return 'That time is outside working hours.';
    if (date === todayISO() && time <= nowTime()) return 'That time has already passed.';
    if (takenRaw(doc.id, date, time, ignoreId)) return 'That time slot has just been taken. Please choose another one.';
    return '';
  }

  const Appts = {
    all() {
      const a = actor(); if (!a) return [];
      const l = rawAppts();
      if (a.role === 'admin') return l;
      if (a.role === 'doctor') return l.filter(x => x.doctorId === a.doctorId);
      return l.filter(x => x.patientId === a.id);
    },
    byId(id) { return this.all().find(a => a.id === id); },
    forPatient(pid) { return this.all().filter(a => a.patientId === pid); },
    forDoctor(did) { return this.all().filter(a => a.doctorId === did); },
    isTaken(doctorId, date, time, ignoreId) { return takenRaw(doctorId, date, time, ignoreId); },
    create(data) {
      const a = actor(); if (!a) return fail('Please log in.');
      if (a.role !== 'patient') return fail('Only patients can book appointments.');
      data = data || {};
      const doc = rawDoctors().find(d => d.id === data.doctorId && d.status === 'active');
      if (!doc) return fail('This doctor is not available for booking.');
      const date = String(data.date), time = String(data.time);
      const prob = slotProblem(doc, date, time, null); if (prob) return fail(prob);
      const reason = cleanText(data.reason, 400); if (reason.length < 5) return fail('Please describe the reason for your visit.');
      const appt = { id: uid('a'), patientId: a.id, doctorId: doc.id, date: date, time: time, reason: reason, phone: cleanText(data.phone, 30), status: 'pending', createdAt: Date.now() };
      const l = rawAppts(); l.push(appt); setAppts(l); return ok({ appt: appt });
    },
    setStatus(id, status) {
      const a = actor(); if (!a) return fail('Please log in.');
      if (STATUSES.indexOf(status) < 0) return fail('Invalid status.');
      const l = rawAppts(); const i = l.findIndex(x => x.id === id); if (i < 0) return fail('Appointment not found.');
      const cur = l[i].status;
      if (a.role === 'admin') { /* admins may set any status */ }
      else if (a.role === 'doctor') {
        if (l[i].doctorId !== a.doctorId) return fail(FORBIDDEN);
        if ((TRANSITIONS[cur] || []).indexOf(status) < 0) return fail('That change is not allowed for a ' + cur + ' appointment.');
      } else if (a.role === 'patient') {
        if (l[i].patientId !== a.id) return fail(FORBIDDEN);
        if (status !== 'cancelled' || (cur !== 'pending' && cur !== 'confirmed')) return fail('You can only cancel upcoming appointments.');
      } else return fail(FORBIDDEN);
      l[i].status = status; setAppts(l); return ok();
    },
    reschedule(id, date, time) {
      const a = actor(); if (!a) return fail('Please log in.');
      if (a.role !== 'patient') return fail(FORBIDDEN);
      const l = rawAppts(); const i = l.findIndex(x => x.id === id);
      if (i < 0 || l[i].patientId !== a.id) return fail('Appointment not found.');
      if (l[i].status !== 'pending' && l[i].status !== 'confirmed') return fail('Only upcoming appointments can be rescheduled.');
      const doc = rawDoctors().find(d => d.id === l[i].doctorId && d.status === 'active'); if (!doc) return fail('This doctor is not available for booking.');
      const prob = slotProblem(doc, String(date), String(time), id); if (prob) return fail(prob);
      l[i].date = date; l[i].time = time; l[i].status = 'pending'; setAppts(l); return ok();
    },
    remove(id) {
      if (!isAdmin()) return fail(FORBIDDEN);
      setAppts(rawAppts().filter(a => a.id !== id)); return ok();
    },
    isUpcoming(a) { return (a.status === 'pending' || a.status === 'confirmed') && (a.date + ' ' + a.time) >= (todayISO() + ' ' + nowTime()); }
  };

  /* ---------- availability ---------- */
  function slotsFor(doctor, date) {
    const dow = parseISO(date).getDay();
    if (!doctor.days.includes(dow)) return { working: false, slots: [] };
    const out = [];
    for (let h = doctor.start; h < doctor.end; h++) {
      ['00', '30'].forEach(m => {
        const time = pad(h) + ':' + m;
        const past = date === todayISO() && time <= nowTime();
        out.push({ time: time, available: !past && !takenRaw(doctor.id, date, time) });
      });
    }
    return { working: true, slots: out };
  }

  /* ---------- auth ---------- */
  const Auth = {
    current() {
      const id = read(KEYS.session, null); if (!id) return null;
      const u = rawUsers().find(x => x.id === id);
      if (!u || statusOf(u) !== 'active') {
        drop(KEYS.session);
        flash('Your session ended because the account is no longer active.', 'error');
        return null;
      }
      return pub(u);
    },
    validatePassword: passwordProblem,
    /* `portal` is the role whose login page is being used ('patient' | 'doctor' | 'admin').
     * Credentials are checked first, so a wrong-portal message never reveals whether an email exists. */
    login(email, password, portal) {
      const u = findByEmail(email);
      if (!u || u.password !== password) return fail('Incorrect email or password.');
      if (portal && u.role !== portal) {
        const where = Access.loginFor(u.role);
        return { ok: false, code: 'wrong-portal', redirect: where, error: 'This is the ' + portal + ' login. ' + u.role.charAt(0).toUpperCase() + u.role.slice(1) + ' accounts sign in on the ' + u.role + ' login page.' };
      }
      const s = statusOf(u);
      if (s === 'pending') return { ok: false, code: 'pending', error: 'Your doctor application is still waiting for admin approval. You can log in once it has been approved.' };
      if (s === 'rejected') return { ok: false, code: 'rejected', error: 'Your doctor application was not approved.' + (u.rejectionReason ? ' Reason: ' + u.rejectionReason : '') + ' Please contact the clinic administrator.' };
      if (s !== 'active') return { ok: false, code: 'disabled', error: 'This account has been disabled. Contact the administrator.' };
      write(KEYS.session, u.id); return ok({ user: pub(u) });
    },
    /* Patient self-registration. The role is always "patient"; any role in `data` is ignored. */
    register(data) {
      data = data || {};
      const name = cleanText(data.name, 80), email = normEmail(data.email), phone = cleanText(data.phone, 30);
      if (name.length < 3) return fail('Enter your full name.');
      if (!EMAIL_RE.test(email)) return fail('Enter a valid email address.');
      if (phone && !PHONE_RE.test(phone)) return fail('Enter a valid phone number.');
      const pp = passwordProblem(data.password); if (pp) return fail(pp);
      if (findByEmail(email)) return fail('An account with this email already exists.');
      const u = { id: uid('u'), name: name, email: email, password: String(data.password), role: 'patient', phone: phone, status: 'active' };
      const l = rawUsers(); l.push(u); setUsers(l); write(KEYS.session, u.id); return ok({ user: pub(u) });
    },
    /* Doctor application. Creates a PENDING account and an unlisted profile; no session is started. */
    registerDoctor(data) {
      data = data || {};
      const name = cleanText(data.name, 80), email = normEmail(data.email), phone = cleanText(data.phone, 30);
      if (name.replace(/^dr\.?\s*/i, '').length < 3) return fail('Enter your full name.');
      if (!EMAIL_RE.test(email)) return fail('Enter a valid email address.');
      if (!PHONE_RE.test(phone)) return fail('Enter a valid phone number.');
      const pp = passwordProblem(data.password); if (pp) return fail(pp);
      const license = cleanText(data.license, 25); if (!LICENSE_RE.test(license)) return fail('Enter a valid medical license number (5–25 letters, numbers or dashes).');
      const n = normaliseDoctorInput({ name: name, specialty: data.specialty, location: data.location, experience: data.experience, fee: data.fee, bio: data.bio, license: license });
      const prob = doctorProblem(n); if (prob) return fail(prob);
      if (findByEmail(email)) return fail('An account with this email already exists.');
      const doc = buildDoctor(n, 'pending');
      const u = { id: uid('u'), name: n.name, email: email, password: String(data.password), role: 'doctor', phone: phone, status: 'pending', doctorId: doc.id, license: license, appliedAt: Date.now() };
      doc.userId = u.id;
      const users = rawUsers(); users.push(u); setUsers(users);
      const docs = rawDoctors(); docs.push(doc); setDoctors(docs);
      return ok({ user: pub(u) });
    },
    logout() { drop(KEYS.session); },
    home: Access.home
  };

  function resetAll() {
    if (!isAdmin()) return fail(FORBIDDEN);
    Object.keys(KEYS).forEach(k => { if (KEYS[k] !== KEYS.flash) drop(KEYS[k]); });
    seed(); migrate(); return ok();
  }

  seed();
  migrate();
  global.MC = { Users: Users, Doctors: Doctors, Appts: Appts, Admin: Admin, Auth: Auth, Access: Access, slotsFor: slotsFor, resetAll: resetAll, util: { todayISO: todayISO, addDays: addDays, toISO: toISO, parseISO: parseISO, fmtDate: fmtDate, fmtTime: fmtTime, uid: uid, nowTime: nowTime } };
})(window);
