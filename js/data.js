/* ============ MediCare – data layer (localStorage) ============ */
(function (global) {
  'use strict';

  const KEYS = { users: 'mc_users', doctors: 'mc_doctors', appts: 'mc_appts', session: 'mc_session', seeded: 'mc_seeded_v1' };

  /* ---------- storage helpers ---------- */
  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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
    write(KEYS.users, SEED_USERS);
    write(KEYS.doctors, SEED_DOCTORS);
    const t = (n) => addDays(n);
    write(KEYS.appts, [
      { id: 'a1', patientId: 'u1', doctorId: 'd1', date: t(2), time: '10:00', reason: 'Routine heart check-up', status: 'confirmed', createdAt: Date.now() - 86400000 },
      { id: 'a2', patientId: 'u1', doctorId: 'd3', date: t(5), time: '11:30', reason: 'Child vaccination', status: 'pending', createdAt: Date.now() - 3600000 },
      { id: 'a3', patientId: 'u1', doctorId: 'd2', date: t(-6), time: '12:00', reason: 'Skin allergy', status: 'completed', createdAt: Date.now() - 9 * 86400000 },
      { id: 'a4', patientId: 'u1', doctorId: 'd6', date: t(-3), time: '14:00', reason: 'Teeth cleaning', status: 'cancelled', createdAt: Date.now() - 6 * 86400000 }
    ]);
    write(KEYS.seeded, true);
  }

  /* ---------- collections ---------- */
  const Users = {
    all() { return read(KEYS.users, []); },
    save(list) { write(KEYS.users, list); },
    byId(id) { return this.all().find(u => u.id === id); },
    byEmail(email) { return this.all().find(u => u.email.toLowerCase() === String(email).trim().toLowerCase()); },
    update(id, patch) { const l = this.all(); const i = l.findIndex(u => u.id === id); if (i > -1) { l[i] = Object.assign({}, l[i], patch); this.save(l); } },
    remove(id) { this.save(this.all().filter(u => u.id !== id)); }
  };

  const Doctors = {
    all() { return read(KEYS.doctors, []); },
    save(list) { write(KEYS.doctors, list); },
    byId(id) { return this.all().find(d => d.id === id); },
    active() { return this.all().filter(d => d.status !== 'disabled'); },
    specialties() { return Array.from(new Set(this.active().map(d => d.specialty))).sort(); },
    add(d) { const l = this.all(); const doc = Object.assign({ id: uid('d'), rating: 4.5, reviews: 0, reviewList: [], languages: ['English', 'Arabic'], days: [0, 1, 2, 3, 4], start: 9, end: 16, status: 'active', bio: '', education: '', location: 'Cairo' }, d); l.push(doc); this.save(l); return doc; },
    update(id, patch) { const l = this.all(); const i = l.findIndex(d => d.id === id); if (i > -1) { l[i] = Object.assign({}, l[i], patch); this.save(l); } },
    remove(id) { this.save(this.all().filter(d => d.id !== id)); },
    initials(name) { return name.replace(/^Dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  };

  const Appts = {
    all() { return read(KEYS.appts, []); },
    save(list) { write(KEYS.appts, list); },
    byId(id) { return this.all().find(a => a.id === id); },
    forPatient(pid) { return this.all().filter(a => a.patientId === pid); },
    forDoctor(did) { return this.all().filter(a => a.doctorId === did); },
    isTaken(doctorId, date, time, ignoreId) {
      return this.all().some(a => a.id !== ignoreId && a.doctorId === doctorId && a.date === date && a.time === time && a.status !== 'cancelled');
    },
    create(data) {
      if (this.isTaken(data.doctorId, data.date, data.time)) return { ok: false, error: 'That time slot has just been taken. Please choose another one.' };
      const a = Object.assign({ id: uid('a'), status: 'pending', createdAt: Date.now() }, data);
      const l = this.all(); l.push(a); this.save(l); return { ok: true, appt: a };
    },
    setStatus(id, status) { const l = this.all(); const i = l.findIndex(a => a.id === id); if (i > -1) { l[i].status = status; this.save(l); } },
    reschedule(id, date, time) {
      const a = this.byId(id); if (!a) return { ok: false, error: 'Appointment not found.' };
      if (this.isTaken(a.doctorId, date, time, id)) return { ok: false, error: 'That slot is not available.' };
      const l = this.all(); const i = l.findIndex(x => x.id === id); l[i].date = date; l[i].time = time; l[i].status = 'pending'; this.save(l); return { ok: true };
    },
    remove(id) { this.save(this.all().filter(a => a.id !== id)); },
    /* upcoming = not cancelled/completed and date/time in the future */
    isUpcoming(a) { return (a.status === 'pending' || a.status === 'confirmed') && (a.date + ' ' + a.time) >= (todayISO() + ' ' + nowTime()); }
  };
  function nowTime() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ---------- availability ---------- */
  function slotsFor(doctor, date) {
    const dow = parseISO(date).getDay();
    if (!doctor.days.includes(dow)) return { working: false, slots: [] };
    const out = [];
    for (let h = doctor.start; h < doctor.end; h++) {
      ['00', '30'].forEach(m => {
        const time = pad(h) + ':' + m;
        const past = date === todayISO() && time <= nowTime();
        out.push({ time, available: !past && !Appts.isTaken(doctor.id, date, time) });
      });
    }
    return { working: true, slots: out };
  }

  /* ---------- auth ---------- */
  const Auth = {
    current() { const id = read(KEYS.session, null); return id ? Users.byId(id) || null : null; },
    login(email, password) {
      const u = Users.byEmail(email);
      if (!u || u.password !== password) return { ok: false, error: 'Incorrect email or password.' };
      if (u.status === 'disabled') return { ok: false, error: 'This account has been disabled. Contact the administrator.' };
      write(KEYS.session, u.id); return { ok: true, user: u };
    },
    register(data) {
      if (Users.byEmail(data.email)) return { ok: false, error: 'An account with this email already exists.' };
      const u = { id: uid('u'), name: data.name.trim(), email: data.email.trim(), password: data.password, role: 'patient', phone: (data.phone || '').trim(), status: 'active' };
      const l = Users.all(); l.push(u); Users.save(l); write(KEYS.session, u.id); return { ok: true, user: u };
    },
    logout() { try { localStorage.removeItem(KEYS.session); } catch (e) { /* ignore */ } },
    home(role) { return role === 'admin' ? 'admin-dashboard.html' : role === 'doctor' ? 'doctor-dashboard.html' : 'patient-dashboard.html'; }
  };

  function resetAll() { Object.values(KEYS).forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }); seed(); }

  seed();
  global.MC = { Users, Doctors, Appts, Auth, slotsFor, resetAll, util: { todayISO, addDays, toISO, parseISO, fmtDate, fmtTime, uid, nowTime } };
})(window);
