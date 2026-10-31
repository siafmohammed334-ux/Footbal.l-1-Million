/* مليونير كرة القدم — منطق اللعبة (الإصدار 2) */
(function () {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const CFG = window.CFG || {};
const LADDER = [100,200,300,500,1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,1000000];
const SAFE = [4, 9]; // بعد السؤال 5 و 10
const RANKS = [[0,"مبتدئ"],[1000,"هاوي"],[10000,"لاعب"],[50000,"محترف"],[200000,"نجم"],[1000000,"أسطورة اللعبة"]];
const DAILY_GEMS = [50,75,100,150,200,300,500];
const LL = {
  fifty: { ic: "½", nm: "50:50", price: 40 },
  aud:   { ic: "👥", nm: "الجمهور", price: 40 },
  call:  { ic: "📞", nm: "صديق", price: 40 },
  skip:  { ic: "⏭", nm: "تخطي", price: 60 }
};
const LET = ["أ","ب","ج","د"];
const GAME_N = { classic: 15, daily: 10, speed: 40, survive: 60, tour: 12 };
const STAGES = ["دور المجموعات", "ربع النهائي", "نصف النهائي", "النهائي"], STAGE_PAY = [0.1, 0.2, 0.3, 0.6];
/* ---------- البطولات ---------- */
const TOURS = [
  { k: "ucl", fee: 400,   g: "club", ic: "⭐", nm: "دوري أبطال أوروبا",   ds: "أقوى بطولة أندية في العالم" },
  { k: "caf", fee: 150,   g: "club", ic: "🌍", nm: "دوري أبطال أفريقيا",  ds: "الأهلي والزمالك والترجي والوداد وغيرهم" },
  { k: "afc", fee: 150,   g: "club", ic: "🌏", nm: "دوري أبطال آسيا",     ds: "من الهلال والعين لأوراوا وأولسان" },
  { k: "euro", fee: 400,  g: "nat",  ic: "🇪🇺", nm: "أمم أوروبا (اليورو)", ds: "تاريخ كأس أمم أوروبا ونجومها" },
  { k: "afcon", fee: 250, g: "nat",  ic: "🦁", nm: "كأس أمم أفريقيا",     ds: "الفراعنة والأسود وكل أبطال القارة" },
  { k: "asian", fee: 250, g: "nat",  ic: "🥇", nm: "كأس آسيا (أمم آسيا)", ds: "من اليابان للسعودية وقطر والعراق" },
  { k: "wc", fee: 1000,    g: "nat",  ic: "🏆", nm: "كأس العالم",          ds: "أعظم بطولة في تاريخ كرة القدم" }
];
const TOUR_RE = {
  ucl: /أبطال أوروبا|أوروبا للأندية|الأندية الأوروبية|دوري الأبطال/,
  caf: /أبطال أفريقيا/, afc: /أبطال آسيا/,
  euro: /أمم أوروبا|يورو ?(19|20)\d\d/,
  afcon: /أمم أفريقيا/, asian: /كأس آسيا/,
  wc: /كأس العالم(?! للأندية)/
};
// وسم البطولة: العنصر السابع في السؤال لو موجود، وإلا بنصنّفه من نص السؤال
function tagsOf(r) {
  if (r[6]) return String(r[6]).split(",");
  const q = r[0], out = [];
  Object.keys(TOUR_RE).forEach(k => { if (TOUR_RE[k].test(q)) out.push(k); });
  if (out.includes("ucl") && (out.includes("caf") || out.includes("afc") || /أفريقيا|آسيا/.test(q))) out.splice(out.indexOf("ucl"), 1);
  return out;
}

/* ---------- أدوات ---------- */
const today = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate(); };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate(); };
const fmt = n => n >= 1e6 ? "مليون" : n >= 1000 ? (n/1000) + " ألف" : String(n);
const num = n => Number(n).toLocaleString("en-US");
const shuffle = a => { a = a.slice(); for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const qid = r => hashStr(r[0]);
async function sha(s) {
  try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("fm:" + s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join(""); }
  catch (e) { return "h" + hashStr("fm:" + s); }
}
const rankOf = p => { let r = RANKS[0][1]; RANKS.forEach(x => { if (p >= x[0]) r = x[1]; }); return r; };
const firebaseOn = () => CFG.FIREBASE && CFG.FIREBASE.apiKey;

/* ---------- صوت واهتزاز ونطق ---------- */
let AC;
function ctx() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; }
function beep(f, d, type, when) {
  if (!S || !S.set.sound) return;
  try {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    const t = c.currentTime + (when || 0);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .02);
  } catch (e) {}
}
function noise(dur, f0, f1, vol, when) { // ضجيج مفلتر = صوت جمهور/تصفيق
  if (!S || !S.set.sound) return;
  try {
    const c = ctx(), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = .8;
    const t = c.currentTime + (when || 0);
    f.frequency.setValueAtTime(f0, t); f.frequency.linearRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .25); g.gain.linearRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  } catch (e) {}
}
const sfx = {
  tap: () => beep(520, .06, "triangle"),
  ok: () => { beep(660,.12,"triangle"); beep(880,.12,"triangle",.12); beep(1175,.2,"triangle",.24); },
  no: () => { beep(220,.25,"sawtooth"); beep(150,.35,"sawtooth",.2); },
  tick: () => beep(900, .04, "square"),
  win: () => [523,659,784,1047,1319].forEach((f,i) => beep(f,.18,"triangle",i*.12)),
  cheer: (big) => { noise(big ? 3 : 1.6, 500, 1900, big ? .5 : .35); for (let i = 0; i < (big ? 26 : 12); i++) noise(.05, 2600, 2600, .3, .15 + i * .09 + Math.random() * .05); },
  boo: () => { noise(1.3, 450, 160, .3); beep(170, .6, "sawtooth", .1); },
  boom: () => { for (let i = 0; i < 5; i++) { noise(.35, 900, 120, .45, i * .35); beep(110, .25, "sine", i * .35); } }
};
function speak(t) {
  try {
    if (!S || !S.set.voice || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = "ar-SA"; u.rate = 1.05; u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch (e) {}
}
const vib = ms => { try { if (S && S.set.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

/* ---------- الحفظ ---------- */
let SES = lsGet("fm_session", null);
let S = null;
const defData = () => ({
  gems: 200, points: 0, xp: 0,
  stats: { games: 0, correct: 0, wrong: 0, best: 0, millions: 0, streak: 0, bestStreak: 0, dailyDone: 0, duelWins: 0, duelGames: 0 },
  daily: { last: "", streak: 0, claimedToday: false },
  mis: { date: "", correct: 0, c10: false, c25: false },
  dc: "", inv: { fifty: 0, aud: 0, call: 0, skip: 0 },
  seen: [], pack: [], skill: 0, hist: [], ach: {}, tour: {}, set: { sound: true, vibrate: true, voice: true }
});
function loadData() {
  if (!SES) return;
  S = Object.assign(defData(), lsGet("fm_data_" + SES.id, {}));
  S.set = Object.assign({ sound: true, vibrate: true, voice: true }, S.set);
  S.stats = Object.assign(defData().stats, S.stats);
  S.inv = Object.assign(defData().inv, S.inv);
  if (S.mis.date !== today()) S.mis = { date: today(), correct: 0, c10: false, c25: false };
  if (S.daily.last !== today()) S.daily.claimedToday = false;
  if (!S.pack || !S.pack.length) buildPack();
}
const save = () => { if (SES && S) lsSet("fm_data_" + SES.id, S); };

/* ---------- الأسئلة (أونلاين دايماً جديدة / أوفلاين حزمة محفوظة) ---------- */
const BUNDLED = window.BUNDLED_QUESTIONS || [];
let REMOTE = lsGet("fm_remote", []);
const online = () => navigator.onLine !== false;
const PACK_N = 500; // عدد الأسئلة المحفوظة للأوفلاين
let LAST_ADDED = 0; // عدد الأسئلة الجديدة اللي نزلت في آخر تحديث
const remoteConfigured = () => CFG.QUESTIONS_URL && !/USERNAME|REPO/.test(CFG.QUESTIONS_URL);
function validQ(r) { return Array.isArray(r) && r.length >= 6 && r.slice(0,5).every(x => typeof x === "string" && x) && new Set(r.slice(1,5)).size === 4 && r[5] >= 1 && r[5] <= 3; }
async function refreshQuestions() {
  if (!online() || !remoteConfigured()) return false;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(CFG.QUESTIONS_URL + "?t=" + Date.now(), { signal: ctl.signal, cache: "no-store" });
    clearTimeout(to);
    if (!res.ok) return false;
    const data = await res.json();
    const arr = (Array.isArray(data) ? data : data.questions || []).filter(validQ);
    if (arr.length >= 10) {
      REMOTE = arr; lsSet("fm_remote", arr); if (S) topUpPack(); return true;
    }
  } catch (e) {}
  return false;
}
function poolAll() {
  const m = new Map();
  BUNDLED.concat(REMOTE).forEach(r => { if (validQ(r)) m.set(qid(r), r); });
  return Array.from(m.values());
}
// حزمة الأوفلاين: 200 سؤال، بنفضّل فيها الأسئلة اللي اللاعب لسه ماشافهاش
function buildPack() {
  if (!S) return;
  const seen = new Set(S.seen), all = poolAll(), pack = [], ids = new Set();
  const rem = new Set(REMOTE.map(qid));
  const add = r => { if (pack.length < PACK_N && !ids.has(qid(r))) { ids.add(qid(r)); pack.push(r); } };
  [175, 200, 125].forEach((n, i) => {
    const tier = shuffle(all.filter(r => r[5] === i + 1));
    const fresh = tier.filter(r => !seen.has(qid(r))), old = tier.filter(r => seen.has(qid(r)));
    const freshNew = fresh.filter(r => rem.has(qid(r))), freshOld = fresh.filter(r => !rem.has(qid(r)));
    freshNew.concat(freshOld, old).slice(0, n).forEach(add);
  });
  // لو فئة ناقصة (مثلاً الصعب قليل) نكمّل لحد 200 من باقي الأسئلة
  shuffle(all.filter(r => !seen.has(qid(r))).concat(all)).forEach(add);
  S.pack = pack; save();
}
// تكملة الحزمة: بنشيل الأسئلة اللي اتلعبت، وبنجيب أسئلة جديدة خالص (ماظهرتش قبل كده) لحد ما الحزمة ترجع 500
function topUpPack() {
  if (!S) return;
  if (!S.pack || !S.pack.length) { buildPack(); LAST_ADDED = S.pack.length; return; }
  const seen = new Set(S.seen);
  const keep = S.pack.filter(r => validQ(r) && !seen.has(qid(r)));
  const ids = new Set(keep.map(qid));
  const need = PACK_N - keep.length;
  const fresh = shuffle(poolAll().filter(r => !seen.has(qid(r)) && !ids.has(qid(r)))).slice(0, Math.max(0, need));
  S.pack = keep.concat(fresh); LAST_ADDED = fresh.length; save();
}
function poolOffline() {
  const m = new Map();
  (S.pack || []).forEach(r => { if (validQ(r)) m.set(qid(r), r); });
  if (m.size < 60) shuffle(BUNDLED).forEach(r => { if (m.size < 150) m.set(qid(r), r); });
  return Array.from(m.values());
}
function markServed(q) {
  S.seen = S.seen.filter(x => x !== q.id); S.seen.push(q.id);
  if (S.seen.length > 6000) S.seen = S.seen.slice(-6000);
  save();
}
const REMOTE_IDS = () => new Set(REMOTE.map(qid));
const tourPool = k => poolAll().filter(r => tagsOf(r).includes(k));
// اختيار سؤال داخل بطولة: أسئلة البطولة بس، والجديد أولاً، والأقرب في الصعوبة
function pickTour(t, used) {
  const pool = tourPool(G.tour), seen = new Set(S.seen), free = r => !used.has(qid(r));
  const order = [0, 1, -1, 2, -2];
  for (const onlyNew of [true, false]) {
    for (const d of order) {
      const tt = t + d; if (tt < 1 || tt > 3) continue;
      const c = pool.filter(r => r[5] === tt && free(r) && (!onlyNew || !seen.has(qid(r))));
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
  }
  const c = pool.filter(free);
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}
function pickTier(t, used) {
  if (G && G.mode === "tour") return pickTour(t, used);
  const offline = !online();
  const pool = offline ? poolOffline() : poolAll();
  const seen = new Set(S.seen);
  const free = r => !used.has(qid(r));
  let c = [];
  for (const d of [0, 1, -1, 2, -2]) { // الأقرب في الصعوبة أولاً، والجديد قبل المكرر
    const tt = t + d; if (tt < 1 || tt > 3) continue;
    c = pool.filter(r => r[5] === tt && free(r) && !seen.has(qid(r)));
    if (!offline && c.length) { const cr = c.filter(r => REMOTE_IDS().has(qid(r))); if (cr.length) c = cr; } // أونلاين: الجديد من السحابة أولاً
    if (c.length) break;
  }
  if (!c.length && !offline) { // خلّصت كل الأسئلة الجديدة: دورة جديدة لحد ما ينزل غيرها
    S.seen = []; save();
    if (!pickTier.warned) { pickTier.warned = 1; toast("خلّصت كل الأسئلة الجديدة 🎉 هنعيد الدورة لحد ما تنزل أسئلة جديدة"); }
    c = pool.filter(r => r[5] === t && free(r));
  }
  if (!c.length) c = pool.filter(r => free(r) && Math.abs(r[5] - t) <= 1); // أوفلاين: تكرار مسموح
  if (!c.length) c = pool.filter(free);
  if (!c.length) return null;
  return c[Math.floor(Math.random() * c.length)];
}
function norm(r) {
  const opts = shuffle([0,1,2,3]).map(i => ({ t: r[1 + i], ok: i === 0 }));
  return { raw: r, id: qid(r), q: r[0], opts, ans: opts.findIndex(o => o.ok), l: r[5] };
}
// الصعوبة بتزيد مع التقدّم ومع كل إجابة صح (ومستواك العام)
function tierFor() {
  const prog = (G.mode === "classic" || G.mode === "daily" || G.mode === "tour") ? G.i / (GAME_N[G.mode] - 1) : Math.min(1, G.right / 12);
  const t = 1 + prog * 2 + S.skill * 0.6 + Math.min(.5, G.streak * .08);
  return Math.max(1, Math.min(3, Math.round(t)));
}

/* ---------- واجهة عامة ---------- */
let screen = "splash", timerId = null, G = null, leaveHook = null;
const app = $("#app");
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add("hidden"), 2600); }
function modal(html) { const m = $("#modal"); m.innerHTML = '<div class="mbox">' + html + "</div>"; m.classList.remove("hidden"); }
function closeModal() { $("#modal").classList.add("hidden"); $("#modal").innerHTML = ""; }
function confetti(n) {
  const d = document.createElement("div"); d.className = "conf";
  const cols = ["#ffe58a","#f5b727","#38d4ff","#2f7bff","#22c55e","#fff","#ff6b6b"];
  n = n || 60;
  for (let i = 0; i < n; i++) { const e = document.createElement("i"); e.style.left = Math.random()*100 + "%"; e.style.background = cols[i % cols.length]; e.style.animationDuration = (1.8 + Math.random()*1.8) + "s"; e.style.animationDelay = Math.random()*.6 + "s"; d.appendChild(e); }
  document.body.appendChild(d); setTimeout(() => d.remove(), 5000);
}
// لافتة رد الفعل: فرحة للإجابة الصح وحزن للغلط
function feedback(kind, text) {
  document.querySelectorAll(".fb").forEach(x => x.remove());
  const d = document.createElement("div"); d.className = "fb " + kind;
  d.innerHTML = `<div class="fbi">${kind === "ok" ? "🎉" : kind === "no" ? "😞" : "⏰"}</div><div class="fbt">${text}</div>`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1500);
}
function celebrate(big) {
  confetti(big ? 150 : 70); sfx.cheer(big); if (big) sfx.boom();
  const e = document.createElement("div"); e.className = "fw";
  e.textContent = big ? "🎆🎇🏆🎇🎆" : "🎉🏆🎉"; document.body.appendChild(e); setTimeout(() => e.remove(), 2600);
}
function netBadge() { return online() ? '<span class="net on">● أونلاين</span>' : '<span class="net off">● أوفلاين</span>'; }

function header() {
  const name = SES ? SES.name : "";
  return `<div class="top">
    <button class="avatar" data-go="profile">👑</button>
    <div class="who"><b>${esc(name)}</b><small>★ ${rankOf(S.points)}</small></div>
    <div class="gems"><span>💎</span><span>${num(S.gems)}</span><button class="plus" data-go="rewards">+</button></div>
    <button class="ibtn" data-go="board">🏆</button>
    <button class="ibtn" data-go="settings">⚙</button>
  </div>`;
}
function nav(cur) {
  const it = [["home","🏠","الرئيسية"],["challenges","⚡","التحديات"],["tournaments","🏟","البطولات"],["board","🏆","نتائجي"],["profile","👤","حسابي"]];
  return '<div class="nav">' + it.map(x => `<button data-go="${x[0]}" class="${cur === x[0] ? "on" : ""}"><span>${x[1]}</span>${x[2]}</button>`).join("") + "</div>";
}
function go(name, p) {
  stopTimer();
  if (leaveHook) { const h = leaveHook; leaveHook = null; try { h(); } catch (e) {} }
  FM.lock = false; closeModal(); screen = name; window.scrollTo(0, 0); (R[name] || R.home)(p);
}

/* ---------- الشاشات ---------- */
const R = {};

R.splash = function () {
  app.innerHTML = '<div class="splash"><img src="icon.png" alt=""></div>';
  setTimeout(() => {
    loadData();
    if (SES && S) { dailyLogin(); go("home"); refreshQuestions(); } else go("login");
  }, 1100);
};

/* تسجيل الدخول */
R.login = function (tab) {
  tab = tab || "in";
  app.innerHTML = `<div class="login">
    <img src="icon.png" alt="مليونير كرة القدم">
    <div class="tabs"><button data-tab="in" class="${tab==="in"?"on":""}">تسجيل الدخول</button><button data-tab="up" class="${tab==="up"?"on":""}">حساب جديد</button></div>
    ${tab==="up" ? '<input class="inp" id="nm" placeholder="الاسم في اللعبة" maxlength="20" autocomplete="nickname">' : ""}
    <input class="inp" id="em" type="email" placeholder="البريد الإلكتروني" dir="ltr" autocomplete="email">
    <input class="inp" id="pw" type="password" placeholder="كلمة السر (6 أحرف على الأقل)" dir="ltr" autocomplete="${tab==="up"?"new-password":"current-password"}">
    <div class="err" id="err"></div>
    <button class="btn" id="sub">${tab==="up" ? "إنشاء الحساب" : "دخول"}</button>
    ${tab==="in" && firebaseOn() ? '<button class="btn ghost" id="forgot" style="margin-top:8px">نسيت كلمة السر؟</button>' : ""}
    <div class="or">أو</div>
    <button class="btn sec" id="guest">👤 العب كضيف</button>
    <p class="mut" style="margin-top:14px">${netBadge()}</p>
  </div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => R.login(b.dataset.tab));
  $("#guest").onclick = () => { startSession({ id: "guest", name: "ضيف", guest: true }); };
  $("#sub").onclick = () => doAuth(tab);
  const f = $("#forgot"); if (f) f.onclick = forgot;
};
const authErr = c => ({ EMAIL_EXISTS: "الإيميل ده مسجل قبل كده", INVALID_LOGIN_CREDENTIALS: "الإيميل أو كلمة السر غلط", INVALID_PASSWORD: "كلمة السر غلط", EMAIL_NOT_FOUND: "مفيش حساب بالإيميل ده", WEAK_PASSWORD: "كلمة السر ضعيفة", INVALID_EMAIL: "الإيميل غير صحيح", TOO_MANY_ATTEMPTS_TRY_LATER: "محاولات كتير، جرّب بعد شوية" }[c] || "حصلت مشكلة، حاول تاني");
async function fbCall(path, body) {
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/" + path + "?key=" + CFG.FIREBASE.apiKey, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(((j.error && j.error.message) || "").split(" ")[0]); return j;
}
async function doAuth(tab) {
  const em = $("#em").value.trim().toLowerCase(), pw = $("#pw").value, nm = tab === "up" ? $("#nm").value.trim() : "";
  const err = m => { $("#err").textContent = m; };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return err("اكتب إيميل صحيح");
  if (pw.length < 6) return err("كلمة السر لازم 6 أحرف على الأقل");
  if (tab === "up" && nm.length < 2) return err("اكتب اسمك في اللعبة");
  const btn = $("#sub"); btn.disabled = true; err("");
  const accs = lsGet("fm_accounts", {}); const h = await sha(em + "|" + pw);
  try {
    if (firebaseOn() && online()) {
      const j = await fbCall(tab === "up" ? "accounts:signUp" : "accounts:signInWithPassword", { email: em, password: pw, returnSecureToken: true });
      const name = tab === "up" ? nm : (accs[em] && accs[em].name) || em.split("@")[0];
      accs[em] = { h, name, id: j.localId }; lsSet("fm_accounts", accs);
      return startSession({ id: j.localId, email: em, name });
    }
    if (firebaseOn() && !online() && tab === "up") { btn.disabled = false; return err("محتاج نت لإنشاء حساب جديد"); }
    if (tab === "up") {
      if (accs[em]) { btn.disabled = false; return err("الإيميل ده مسجل قبل كده"); }
      accs[em] = { h, name: nm, id: "u" + hashStr(em) }; lsSet("fm_accounts", accs);
      return startSession({ id: accs[em].id, email: em, name: nm });
    }
    if (!accs[em] || accs[em].h !== h) { btn.disabled = false; return err(accs[em] || !firebaseOn() ? "الإيميل أو كلمة السر غلط" : "سجّل دخولك أونلاين أول مرة"); }
    startSession({ id: accs[em].id, email: em, name: accs[em].name });
  } catch (e) { btn.disabled = false; err(authErr(e.message)); }
}
async function forgot() {
  const em = $("#em").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return ($("#err").textContent = "اكتب إيميلك الأول");
  try { await fbCall("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: em }); toast("بعتنالك رسالة على الإيميل ✉"); }
  catch (e) { $("#err").textContent = authErr(e.message); }
}
function startSession(s) { SES = s; lsSet("fm_session", s); loadData(); save(); dailyLogin(); go("home"); refreshQuestions(); }
function logout() { SES = null; S = null; try { localStorage.removeItem("fm_session"); } catch (e) {} go("login"); }

function dailyLogin() {
  if (S.daily.last === today()) return;
  S.daily.streak = S.daily.last === yesterday() ? S.daily.streak + 1 : 1;
  S.daily.last = today(); S.daily.claimedToday = false; save();
}

/* الرئيسية */
R.home = function () {
  const rows = LADDER.map((v, i) => i).reverse().map(i => {
    const cls = i === 14 ? "mil" : SAFE.includes(i) ? "safe" : "";
    return `<div class="r ${cls}"><span>${i === 14 ? "👑 " : ""}${String(i+1).padStart(2,"0")}</span><span>${fmt(LADDER[i])}${i===14?"":'<i></i>'}</span></div>`;
  }).join("");
  const n = !S.daily.claimedToday ? "🎁" : "";
  app.innerHTML = `<div style="text-align:center;padding:8px 12px;margin-bottom:6px;border:1.5px solid var(--line);border-radius:14px;background:var(--panel);color:var(--gold1);font-size:15px">سيف محمد صلاح يرحب بكم</div>` + header() + `
    <div class="hero">
      <div class="emb"><div class="tag">اختبر معرفتك.. وكن مليونيراً!</div><img src="icon.png" alt=""></div>
      <div class="ladder">${rows}</div>
    </div>
    <div class="ticker"><span>⚽</span><span>أسئلة كروية</span><span>•</span><span>تحدي المشجعين</span><span>•</span><span>هل أنت جاهز؟</span><span>⚽</span></div>
    <button class="btn big" id="play">▶ ابدأ اللعب</button>
    <button class="btn sec" id="duel" style="margin-top:12px">⚔ واحد ضد واحد — تحدّى لاعب</button>
    <button class="btn sec" id="tours" style="margin-top:12px">🏟 البطولات — كأس العالم واليورو ودوري الأبطال</button>
    <div class="tiles">
      <button class="tile" data-go="stats"><div class="ic">📊</div><b>إحصائياتي</b><small>شوف مستواك</small></button>
      <button class="tile" data-go="rewards"><div class="ic">🎁</div><b>المكافآت ${n}</b><small>جوائز وهدايا</small></button>
      <button class="tile" data-go="helps"><div class="ic">💡</div><b>المساعدات</b><small>استخدمها بحكمة</small></button>
    </div>
    <div class="banner"><div class="ic">👑⚽</div><div>ليس فقط عن كرة القدم.. بل عن ذكائك وشغفك بها! <div style="margin-top:4px">${netBadge()}</div></div></div>
  ` + nav("home");
  $("#play").onclick = () => startGame("classic");
  $("#duel").onclick = () => go("duel");
  $("#tours").onclick = () => go("tournaments");
};

/* البطولات */
R.tournaments = function () {
  const card = T => {
    const rec = S.tour && S.tour[T.k], n = tourPool(T.k).length;
    return `<div class="chal"><div class="ic">${T.ic}</div><div class="t grow"><b>${T.nm}</b><small>${T.ds}</small><br><small>${n} سؤال${rec && rec.games ? " — أفضل نتيجة: " + (rec.pass >= 4 ? "بطل 🏆" : "وصلت " + STAGES[rec.pass || 0]) : ""}</small></div><button class="btn" data-tour="${T.k}">العب · ${T.fee} 💎</button></div>`;
  };
  app.innerHTML = header() + `<h2>🏟 البطولات</h2>
    <p class="mut">ادفع جواهر عشان تدخل. البطولة 4 مراحل: دور المجموعات ← ربع النهائي ← نصف النهائي ← النهائي، وكل مرحلة 3 أسئلة لازم تجاوب 2 صح عشان تعدّيها. كل مرحلة بتعدّيها بترجّع لك جواهر، ولو كسبت البطولة بتكسب أكتر من اللي دفعته.</p>
    <div class="sect">🏟 بطولات الأندية</div>` + TOURS.filter(t => t.g === "club").map(card).join("") + `
    <div class="sect">🌍 بطولات المنتخبات</div>` + TOURS.filter(t => t.g === "nat").map(card).join("") + nav("tournaments");
  app.querySelectorAll("[data-tour]").forEach(b => b.onclick = () => startGame("tour", b.dataset.tour));
};

/* الإحصائيات */
const ACH = [
  ["first", "🎯", "أول فوز", "أجب بشكل صحيح على سؤال", s => s.stats.correct >= 1],
  ["c50", "⚽", "عاشق الكرة", "50 إجابة صحيحة", s => s.stats.correct >= 50],
  ["c250", "🏅", "خبير الكرة", "250 إجابة صحيحة", s => s.stats.correct >= 250],
  ["st10", "🔥", "سلسلة نارية", "10 إجابات صحيحة متتالية", s => s.stats.bestStreak >= 10],
  ["g10", "🎮", "مدمن اللعب", "العب 10 مباريات", s => s.stats.games >= 10],
  ["mil", "👑", "المليونير", "اوصل لمليون", s => s.stats.millions >= 1],
  ["duel1", "⚔", "أول انتصار", "افوز في تحدي واحد ضد واحد", s => s.stats.duelWins >= 1]
];
function checkAch() { ACH.forEach(a => { if (!S.ach[a[0]] && a[4](S)) { S.ach[a[0]] = 1; S.gems += 50; toast("🏆 إنجاز جديد: " + a[2] + " (+50 💎)"); } }); }
R.stats = function () {
  const st = S.stats, tot = st.correct + st.wrong, acc = tot ? Math.round(st.correct / tot * 100) : 0;
  const next = RANKS.find(r => r[0] > S.points); const prev = [...RANKS].reverse().find(r => r[0] <= S.points);
  const pct = next ? Math.round((S.points - prev[0]) / (next[0] - prev[0]) * 100) : 100;
  app.innerHTML = header() + `<h2>📊 إحصائياتي</h2>
    <div class="card"><div class="row"><b class="grow">${rankOf(S.points)}</b><span class="pill">${num(S.points)} نقطة</span></div>
      <div class="bar" style="margin-top:10px"><i style="width:${pct}%"></i></div>
      <div class="mut" style="margin-top:6px">${next ? "الرتبة الجاية: " + next[1] + " عند " + num(next[0]) + " نقطة" : "وصلت لأعلى رتبة 👑"}</div></div>
    <div class="grid2">
      <div class="card stat"><b>${st.games}</b><small>مباريات</small></div>
      <div class="card stat"><b>${acc}%</b><small>نسبة الدقة</small></div>
      <div class="card stat"><b>${st.correct}</b><small>إجابات صحيحة</small></div>
      <div class="card stat"><b>${st.wrong}</b><small>إجابات خاطئة</small></div>
      <div class="card stat"><b>${st.best ? fmt(st.best) : "—"}</b><small>أعلى جائزة</small></div>
      <div class="card stat"><b>${st.bestStreak}</b><small>أطول سلسلة صح</small></div>
      <div class="card stat"><b>${st.duelWins}</b><small>انتصارات 1 ضد 1</small></div>
      <div class="card stat"><b>${Math.round(S.skill * 100)}%</b><small>مستواك الحالي</small></div>
    </div>
    <h2>🏅 الإنجازات</h2><div class="card">${ACH.map(a => `<div class="ach ${S.ach[a[0]]?"on":""}"><span class="ic">${a[1]}</span><div><b>${a[2]}</b><div class="mut">${a[3]}</div></div></div>`).join("")}</div>
  ` + nav("profile");
};

/* المكافآت */
R.rewards = function () {
  const st = S.daily.streak, idx = (st - 1) % 7;
  const days = DAILY_GEMS.map((g, i) => `<div class="day ${i < idx || (i === idx && S.daily.claimedToday) ? "done" : ""} ${i === idx && !S.daily.claimedToday ? "now" : ""}">يوم ${i+1}<b>${g}</b>💎</div>`).join("");
  const m = S.mis;
  const mis = (key, need, gems, label) => {
    const ok = m.correct >= need, done = m[key];
    return `<div class="row" style="padding:8px 0"><div class="grow"><b>${label}</b><div class="mut">${Math.min(m.correct, need)} / ${need}</div><div class="bar" style="margin-top:4px"><i style="width:${Math.min(100, m.correct/need*100)}%"></i></div></div>
      <button class="btn ${done ? "ghost" : ""}" data-mis="${key}" style="width:auto;padding:8px 14px;font-size:14px" ${!ok || done ? "disabled" : ""}>${done ? "تم ✓" : "+" + gems + " 💎"}</button></div>`;
  };
  app.innerHTML = header() + `<h2>🎁 المكافآت</h2>
    <div class="card"><b>الهدية اليومية</b> <span class="pill">أيام متتالية: ${st}</span><div class="days">${days}</div>
      <button class="btn" id="claim" ${S.daily.claimedToday ? "disabled" : ""}>${S.daily.claimedToday ? "استلمت هدية النهاردة ✓" : "استلم +" + DAILY_GEMS[idx] + " 💎"}</button></div>
    <div class="card"><b>مهام اليوم</b>${mis("c10", 10, 60, "جاوب 10 أسئلة صح")}${mis("c25", 25, 150, "جاوب 25 سؤال صح")}</div>
    <p class="mut" style="text-align:center">اللعبة ترفيهية، والجوائز والأرباح افتراضية داخل اللعبة فقط.</p>
  ` + nav("home");
  $("#claim").onclick = () => { if (S.daily.claimedToday) return; S.gems += DAILY_GEMS[idx]; S.daily.claimedToday = true; save(); sfx.win(); toast("+" + DAILY_GEMS[idx] + " 💎"); R.rewards(); };
  app.querySelectorAll("[data-mis]").forEach(b => b.onclick = () => { const k = b.dataset.mis; const g = k === "c10" ? 60 : 150; if (S.mis[k]) return; S.mis[k] = true; S.gems += g; save(); sfx.win(); toast("+" + g + " 💎"); R.rewards(); });
};

/* المساعدات */
R.helps = function () {
  app.innerHTML = header() + `<h2>💡 المساعدات</h2>
    <p class="mut">في كل مباراة معاك مرة من كل مساعدة. تقدر تشتري زيادة بالجواهر 💎 وتحتفظ بيها.</p>` +
    Object.keys(LL).map(k => `<div class="chal"><div class="ic">${LL[k].ic}</div><div class="t grow"><b>${LL[k].nm}</b><small>${{fifty:"يشيل إجابتين غلط",aud:"الجمهور يصوّت على الإجابة",call:"صديقك يقترح إجابة (مش مضمونة)",skip:"تعدّي السؤال بدون ما تخسر"}[k]}</small><br><small>معاك زيادة: ${S.inv[k]}</small></div><button class="btn" data-buy="${k}">${LL[k].price} 💎</button></div>`).join("") + nav("home");
  app.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => { const k = b.dataset.buy; if (S.gems < LL[k].price) return toast("جواهرك مش كفاية — خدها من المكافآت 🎁"); S.gems -= LL[k].price; S.inv[k]++; save(); sfx.ok(); R.helps(); });
};

/* نتائجي */
R.board = function () {
  const h = S.hist.slice(0, 15);
  app.innerHTML = header() + `<h2>🏆 سجل نتائجي</h2>
    <div class="card"><div class="row"><div class="grow"><b>${esc(SES.name)}</b><div class="mut">${rankOf(S.points)}</div></div><span class="pill">${num(S.points)} نقطة</span></div></div>
    <div class="card lb">${h.length ? h.map((x, i) => `<div class="r"><span class="n">${i+1}</span><div class="grow"><b>${x.mode}</b><div class="mut">${x.date}</div></div><div style="text-align:left"><b style="color:var(--gold1)">+${num(x.pts)}</b><div class="mut">${x.info}</div></div></div>`).join("") : '<div class="mut" style="text-align:center;padding:16px">لسه ماعبتش أي مباراة — ابدأ دلوقتي!</div>'}</div>
    ${SES.guest ? '<p class="mut" style="text-align:center">سجّل بحساب لحفظ تقدّمك باسمك.</p>' : ""}` + nav("board");
};

/* الحساب */
R.profile = function () {
  app.innerHTML = header() + `<h2>👤 حسابي</h2>
    <div class="card"><div class="row"><div class="avatar">👑</div><div class="grow"><b>${esc(SES.name)}</b><div class="mut" dir="ltr" style="text-align:right">${esc(SES.email || "حساب ضيف")}</div><div class="mut">★ ${rankOf(S.points)}</div></div></div></div>
    <button class="btn sec" data-go="stats" style="margin-bottom:10px">📊 إحصائياتي والإنجازات</button>
    <button class="btn sec" data-go="rewards" style="margin-bottom:10px">🎁 المكافآت</button>
    <button class="btn sec" data-go="settings" style="margin-bottom:10px">⚙ الإعدادات</button>
    <button class="btn ghost" id="lo">${SES.guest ? "تسجيل حساب / دخول" : "تسجيل الخروج"}</button>` + nav("profile");
  $("#lo").onclick = logout;
};

/* الإعدادات */
R.settings = function () {
  const sw = (k, t) => `<div class="sw"><span>${t}</span><button class="tg ${S.set[k] ? "on" : ""}" data-sw="${k}"></button></div>`;
  app.innerHTML = header() + `<h2>⚙ الإعدادات</h2><div class="card">${sw("sound", "🔊 الصوت والمؤثرات")}${sw("voice", "🗣 التعليق الصوتي (إجابة صحيحة / خاطئة)")}${sw("vibrate", "📳 الاهتزاز")}</div>
    <div class="card"><b>الأسئلة</b><div class="mut" style="margin:6px 0">${netBadge()} — أسئلة جديدة لسه ماشفتهاش: ${poolAll().filter(r => !S.seen.includes(qid(r))).length}<br>الأوفلاين: محفوظ لك ${S.pack.length} سؤال (بنكمّلها لـ 500 بأسئلة ماشفتهاش)، ولما النت يشتغل بنجيب لك أسئلة جديدة وبنجدّد المحفوظ.</div>
      <button class="btn sec" id="upd">🔄 تحديث الأسئلة الآن</button></div>
    <div class="card mut">مليونير كرة القدم — لعبة ترفيهية. الجوائز افتراضية ولا توجد أي جوائز مالية حقيقية. الأسئلة عن كرة القدم للرجال.</div>` + nav("profile");
  app.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { S.set[b.dataset.sw] = !S.set[b.dataset.sw]; save(); R.settings(); });
  $("#upd").onclick = async () => { toast("جاري التحديث..."); const ok = await refreshQuestions(); toast(!online() ? "مفيش نت حالياً" : !remoteConfigured() ? "الأسئلة المدمجة بس حالياً" : ok ? (LAST_ADDED > 0 ? "تم التحديث ✓ نزل " + LAST_ADDED + " سؤال جديد، والمحفوظ دلوقتي " + S.pack.length : "الحزمة كاملة أو مفيش أسئلة جديدة على السيرفر، والمحفوظ " + S.pack.length) : "تعذّر التحديث"); R.settings(); };
};

/* التحديات */
R.challenges = function () {
  const doneToday = S.dc === today();
  const c = (ic, t, d, id, extra, dis) => `<div class="chal"><div class="ic">${ic}</div><div class="t grow"><b>${t}</b><small>${d}</small></div><button class="btn" data-ch="${id}" ${dis ? "disabled" : ""}>${extra}</button></div>`;
  app.innerHTML = header() + `<h2>⚡ التحديات</h2>` +
    c("⚔", "واحد ضد واحد", "تحدّى لاعب حقيقي أو صديقك على واتساب", "duel", "العب") +
    c("📅", "تحدي اليوم", "10 أسئلة — مرة كل يوم — 20 💎 لكل إجابة صح", "daily", doneToday ? "تم ✓" : "العب", doneToday) +
    c("⏱", "تحدي السرعة", "60 ثانية: جاوب أكبر عدد من الأسئلة", "speed", "العب") +
    c("🔥", "تحدي الصمود", "كمّل لحد أول غلطة — كل إجابة صح بنقاط أعلى", "survive", "العب") +
    c("👑", "المليونير الكلاسيكي", "15 سؤال والمساعدات الأربعة", "classic", "العب") +
    c("🏟", "البطولات", "دوري الأبطال واليورو وأمم أفريقيا وآسيا وكأس العالم", "tours", "ادخل") + nav("challenges");
  app.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => b.dataset.ch === "duel" ? go("duel") : b.dataset.ch === "tours" ? go("tournaments") : startGame(b.dataset.ch));
};

/* ---------- اللعب ---------- */
async function startGame(mode, tour) {
  sfx.tap();
  const T0 = mode === "tour" ? TOURS.find(x => x.k === tour) : null;
  if (T0 && S.gems < T0.fee) return toast("محتاج " + T0.fee + " 💎 عشان تدخل " + T0.nm + " — خدهم من المكافآت 🎁");
  if (online() && remoteConfigured() && Date.now() - (startGame.last || 0) > 30000) { startGame.last = Date.now(); await refreshQuestions(); }
  G = { mode, tour: tour || "", qs: [], n: GAME_N[mode], i: 0, locked: false, free: { fifty: 1, aud: 1, call: 1, skip: 1 }, score: 0, right: 0, streak: 0, t: 0, hidden: [], sr: 0, passed: 0 };
  if (mode === "speed") G.total = 60;
  if (!pickTier(1, new Set())) { G = null; return toast("مفيش أسئلة كفاية حالياً"); }
  if (T0) { S.gems -= T0.fee; save(); }
  go("game");
}
const qTime = () => G.i < 5 ? 30 : G.i < 10 ? 45 : 60;
const llCount = k => G.free[k] + S.inv[k];

R.game = function () {
  if (!G) return go("home");
  if (!G.qs[G.i]) {
    const r = pickTier(tierFor(), new Set(G.qs.map(x => x.id)));
    if (!r) return finish("done");
    G.qs[G.i] = norm(r);
  }
  const q = G.qs[G.i], m = G.mode;
  markServed(q); G.hidden = []; G.locked = false;
  const classic = m === "classic", TT = m === "tour" ? TOURS.find(x => x.k === G.tour) : null;
  const llHtml = (classic || m === "daily" || m === "tour") ? '<div class="ll">' + Object.keys(LL).map(k => `<button data-ll="${k}" ${llCount(k) < 1 ? "disabled" : ""}><span>${LL[k].ic}</span>${LL[k].nm}<em>${llCount(k)}</em></button>`).join("") + "</div>" : "";
  const label = classic ? `السؤال <bdi dir="ltr">${G.i + 1} / 15</bdi>` : m === "daily" ? `السؤال <bdi dir="ltr">${G.i + 1} / 10</bdi>` : m === "tour" ? `${TT.ic} ${STAGES[Math.floor(G.i / 3)]} · سؤال <bdi dir="ltr">${G.i % 3 + 1} / 3</bdi>` : m === "speed" ? `صح: ${G.right}` : `سلسلة: ${G.right}`;
  const centre = classic ? `<small>الجائزة الحالية</small><b>${fmt(LADDER[G.i])}</b>` : (m === "daily" || m === "tour") ? `<small>الإجابات الصح</small><b>${G.right}</b>` : `<small>النقاط</small><b>${num(G.score)}</b>`;
  app.innerHTML = `<div class="gtop">
      <button class="ibtn" id="quit">✕</button>
      <div class="prize">${centre}</div>
      <div class="timer" id="tm">${m === "speed" ? G.total : qTime()}</div>
    </div>
    <span class="pill qn">${label}</span>
    <div class="qbox">${esc(q.q)}</div>
    ${llHtml}
    <div class="opts">${q.opts.map((o, i) => `<button class="opt" data-o="${i}"><b>${LET[i]}</b><span class="tx">${esc(o.t)}</span><span class="pc"></span></button>`).join("")}</div>
    ${classic ? '<div class="gfoot"><button class="btn ghost" id="wd">💰 انسحب بـ ' + (G.i ? fmt(LADDER[G.i-1]) : "0") + "</button></div>" : ""}`;
  app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => answer(+b.dataset.o));
  app.querySelectorAll("[data-ll]").forEach(b => b.onclick = () => useLL(b.dataset.ll));
  $("#quit").onclick = () => confirmQuit();
  const wd = $("#wd"); if (wd) wd.onclick = () => { if (!G.i) return; modal(`<h3>تنسحب؟</h3><p>هتاخد ${fmt(LADDER[G.i-1])} وتنهي المباراة.</p><button class="btn" id="y">أيوه، انسحب</button><button class="btn ghost" id="n">كمّل اللعب</button>`); $("#y").onclick = () => { closeModal(); finish("withdraw"); }; $("#n").onclick = closeModal; };
  startQTimer();
};
function startQTimer() {
  stopTimer();
  const tm = $("#tm");
  if (G.mode === "speed") {
    timerId = setInterval(() => { G.total--; tm.textContent = G.total; tm.classList.toggle("low", G.total <= 10); if (G.total <= 10) sfx.tick(); if (G.total <= 0) { stopTimer(); finish("time"); } }, 1000);
  } else {
    G.t = qTime(); tm.textContent = G.t;
    timerId = setInterval(() => { G.t--; tm.textContent = G.t; tm.classList.toggle("low", G.t <= 8); if (G.t <= 5) sfx.tick(); if (G.t <= 0) { stopTimer(); answer(-1); } }, 1000);
  }
}
function confirmQuit() {
  modal(`<h3>خروج؟</h3><p>${G.mode === "classic" ? "لو خرجت دلوقتي هتخسر المباراة (من غير ما تاخد الجائزة)." : "هيتحسب اللي حققته لحد دلوقتي."}</p><button class="btn" id="y">خروج</button><button class="btn ghost" id="n">كمّل</button>`);
  $("#y").onclick = () => { closeModal(); if (G.mode === "classic") { G = null; go("home"); } else finish("quit"); };
  $("#n").onclick = closeModal;
}
function useLL(k) {
  if (G.locked || llCount(k) < 1) return;
  const q = G.qs[G.i];
  if (G.free[k] > 0) G.free[k]--; else S.inv[k]--;
  save(); sfx.tap();
  if (k === "fifty") {
    const wrong = shuffle(q.opts.map((o, i) => i).filter(i => i !== q.ans)).slice(0, 2);
    wrong.forEach(i => { G.hidden.push(i); const b = app.querySelector(`[data-o="${i}"]`); if (b) b.classList.add("gone"); });
  } else if (k === "skip") {
    const r = pickTier(q.l, new Set(G.qs.map(x => x.id)));
    if (r) G.qs[G.i] = norm(r);
    return R.game();
  } else if (k === "aud") {
    const strength = [.7, .58, .45][q.l - 1] || .5;
    let c = Math.round((strength + Math.random() * .15) * 100); c = Math.min(c, 90);
    const left = q.opts.map((o, i) => i).filter(i => i !== q.ans && !G.hidden.includes(i));
    let rest = 100 - c; const pc = {}; pc[q.ans] = c;
    left.forEach((i, idx) => { const v = idx === left.length - 1 ? rest : Math.round(Math.random() * rest * .7); pc[i] = v; rest -= v; });
    const shown = q.opts.map((o, i) => i).filter(i => !G.hidden.includes(i));
    modal(`<h3>👥 رأي الجمهور</h3>${shown.map(i => `<div class="pollrow"><b>${LET[i]}</b><div class="bar"><i style="width:${pc[i]||0}%"></i></div><span>${pc[i]||0}%</span></div>`).join("")}<button class="btn" id="ok">تمام</button>`);
    $("#ok").onclick = closeModal;
  } else if (k === "call") {
    const acc = [.92, .78, .62][q.l - 1] || .7;
    const pool = q.opts.map((o, i) => i).filter(i => !G.hidden.includes(i));
    const pick = Math.random() < acc ? q.ans : shuffle(pool.filter(i => i !== q.ans))[0];
    const sure = Math.random() < acc;
    modal(`<div class="big">📞</div><h3>صديقك بيقول:</h3><p>${sure ? "أنا متأكد تقريباً" : "مش متأكد أوي، بس أعتقد"} إن الإجابة <b style="color:var(--gold1)">(${LET[pick]}) ${esc(q.opts[pick].t)}</b></p><button class="btn" id="ok">شكراً</button>`);
    $("#ok").onclick = closeModal;
  }
  const bt = app.querySelector(`[data-ll="${k}"]`); if (bt) { bt.querySelector("em").textContent = llCount(k); if (llCount(k) < 1) bt.disabled = true; }
}
const OKS = ["إجابة صحيحة!", "أحسنت!", "ممتاز!", "برافو عليك!"], NOS = ["إجابة خاطئة", "للأسف إجابة غلط"];
function answer(i) {
  if (G.locked) return; G.locked = true;
  if (G.mode !== "speed") stopTimer();
  const q = G.qs[G.i], btns = app.querySelectorAll("[data-o]");
  btns.forEach(b => b.setAttribute("disabled", ""));
  const right = i === q.ans;
  if (i >= 0) btns[i].classList.add("sel");
  const speed = G.mode === "speed", ref = G;
  setTimeout(() => {
    if (G !== ref) return;
    if (i >= 0) btns[i].classList.remove("sel");
    btns[q.ans].classList.add("ok");
    if (i >= 0 && !right) btns[i].classList.add("no");
    if (right) {
      const t = OKS[Math.floor(Math.random() * OKS.length)];
      sfx.ok(); sfx.cheer(false); vib(40); feedback("ok", t); if (!speed) speak(t); else confetti(10);
    } else {
      const t = i === -1 ? "انتهى الوقت" : NOS[Math.floor(Math.random() * NOS.length)];
      sfx.no(); sfx.boo(); vib([80, 60, 120]); feedback(i === -1 ? "time" : "no", t); document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 500); if (!speed) speak(t);
    }
    S.stats[right ? "correct" : "wrong"]++;
    S.skill = Math.max(0, Math.min(1, S.skill + (right ? .06 : -.12)));
    if (right) { S.mis.correct++; G.right++; G.streak++; S.stats.streak = G.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, G.streak); G.score += G.mode === "survive" ? 50 * q.l + G.streak * 5 : G.mode === "speed" ? 100 + 20 * q.l : 0; }
    else { G.streak = 0; S.stats.streak = 0; }
    save();
    setTimeout(() => { if (G === ref) next(right, i === -1); }, speed ? 500 : 1700);
  }, speed ? 350 : 1100);
}
function next(right, timeout) {
  if (G.mode === "classic") {
    if (!right) return finish(timeout ? "timeout" : "wrong");
    if (G.i === 14) return finish("million");
    G.i++; return R.game();
  }
  if (G.mode === "tour") {
    if (right) G.sr++;
    if (G.i % 3 === 2) {
      if (G.sr < 2) return finish("out");
      G.passed++; G.sr = 0;
      if (G.i >= 11) return finish("done");
      toast("✅ عديت " + STAGES[G.passed - 1] + " — يلا على " + STAGES[G.passed]);
    }
    G.i++; return R.game();
  }
  if (G.mode === "daily") { if (G.i >= 9) return finish("done"); G.i++; return R.game(); }
  if (G.mode === "survive") { if (!right) return finish("wrong"); if (G.i >= G.n - 1) return finish("done"); G.i++; return R.game(); }
  if (G.mode === "speed") { if (G.i >= G.n - 1) return finish("done"); G.i++; return R.game(); }
}

function finish(why) {
  stopTimer();
  const g = G; G = null; if (!g) return go("home");
  let prize = 0, pts = 0, gems = 0, title = "", icon = "⚽", msg = "", info = "";
  const TT = g.mode === "tour" ? TOURS.find(x => x.k === g.tour) : null;
  const name = TT ? "🏟 " + TT.nm : { classic: "المليونير الكلاسيكي", daily: "تحدي اليوم", speed: "تحدي السرعة", survive: "تحدي الصمود" }[g.mode];
  if (g.mode === "classic") {
    if (why === "million") { prize = 1000000; S.stats.millions++; }
    else if (why === "withdraw") prize = g.i ? LADDER[g.i - 1] : 0;
    else { const s = [...SAFE].reverse().find(x => g.i > x); prize = s !== undefined ? LADDER[s] : 0; }
    pts = prize; gems = Math.round(prize / 400) + (why === "million" ? 500 : 0);
    S.stats.best = Math.max(S.stats.best, prize);
    info = fmt(prize);
    if (why === "million") { icon = "👑"; title = "مبروك! أنت مليونير كرة القدم!"; msg = "جاوبت على كل الأسئلة الـ15 صح 🎉"; }
    else if (why === "withdraw") { icon = "💰"; title = "انسحاب ذكي"; msg = `خدت ${fmt(prize)}`; }
    else { icon = why === "timeout" ? "⏰" : "😢"; title = why === "timeout" ? "خلص الوقت!" : "إجابة غلط!"; const qq = g.qs[g.i]; msg = `الإجابة الصح: <b style="color:var(--gold1)">${esc(qq.opts[qq.ans].t)}</b><br>جايزتك: ${prize ? fmt(prize) : "0"}`; }
  } else if (g.mode === "daily") {
    S.dc = today(); S.stats.dailyDone++; pts = g.right * 50; gems = g.right * 20; info = g.right + "/10";
    icon = g.right >= 7 ? "🏆" : "👏"; title = "خلصت تحدي اليوم"; msg = `جاوبت ${g.right} من 10`;
  } else if (g.mode === "tour") {
    const champ = g.passed >= 4, pass = Math.min(4, g.passed);
    pts = g.right * 50 + (champ ? 200 : 0);
    gems = Math.round(TT.fee * STAGE_PAY.slice(0, pass).reduce((a, b) => a + b, 0)) + (champ && g.right === 12 ? Math.round(TT.fee * 0.1) : 0);
    info = champ ? "بطل 🏆" : STAGES[pass];
    icon = champ ? "👑" : pass >= 2 ? "🏆" : "👏";
    title = champ ? "مبروك! أنت بطل " + TT.nm : "خرجت من " + STAGES[pass];
    msg = champ ? `جاوبت ${g.right} من 12 وكسبت البطولة` : `عديت ${pass} ${pass === 1 ? "مرحلة" : "مراحل"} وجاوبت ${g.right} إجابة صح`;
    S.tour = S.tour || {}; const rec = S.tour[g.tour] = Object.assign({ games: 0, best: 0, correct: 0, pass: 0 }, S.tour[g.tour]);
    rec.games++; rec.best = Math.max(rec.best, g.right); rec.correct += g.right; rec.pass = Math.max(rec.pass || 0, pass);
  } else if (g.mode === "speed") {
    pts = g.score; gems = Math.floor(g.right / 2) * 5; info = g.right + " صح"; icon = "⏱"; title = "انتهى الوقت!"; msg = `جاوبت ${g.right} إجابة صح`;
  } else {
    pts = g.score; gems = Math.floor(g.right / 3) * 5; info = g.right + " صح"; icon = "🔥"; title = why === "done" ? "ما غلطتش ولا مرة!" : "غلطة وخلصت"; msg = `سلسلتك: ${g.right} إجابة صح`;
  }
  S.stats.games++; S.points += pts; S.gems += gems;
  S.hist.unshift({ mode: name, date: new Date().toLocaleDateString("ar-EG"), pts, info }); S.hist = S.hist.slice(0, 30);
  checkAch(); save();
  if (online()) buildPack(); // نحدّث حزمة الأوفلاين بأسئلة لسه ماشافهاش
  screen = "result"; window.scrollTo(0, 0);
  const lost = why === "wrong" || why === "timeout";
  if (why === "million") { celebrate(true); speak("مبروك! أنت مليونير كرة القدم!"); }
  else if (!lost && pts > 0) { celebrate(false); speak("مبروك! أحسنت"); }
  else if (lost) { sfx.no(); sfx.boo(); speak(prize ? "حظ أوفر المرة الجاية" : "للأسف خسرت، جرّب تاني"); }
  app.innerHTML = `<div style="text-align:center;padding-top:40px"><div style="font-size:72px">${icon}</div><h2 style="font-size:26px">${title}</h2><p style="line-height:1.8">${msg}</p>
    <div class="grid2" style="margin:18px 0"><div class="card stat"><b>+${num(pts)}</b><small>نقاط</small></div><div class="card stat"><b>+${num(gems)} 💎</b><small>جواهر</small></div></div>
    <button class="btn" id="again">🔁 العب تاني</button>${TT ? '<button class="btn sec" id="tl" style="margin-top:10px">🏟 كل البطولات</button>' : ""}<button class="btn sec" id="hm" style="margin-top:10px">🏠 الرئيسية</button></div>`;
  $("#again").onclick = () => g.mode === "daily" ? go("challenges") : startGame(g.mode, g.tour);
  const tl = $("#tl"); if (tl) tl.onclick = () => go("tournaments");
  $("#hm").onclick = () => go("home");
}

/* ---------- ربط الأحداث ---------- */
document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]");
  if (g && !g.closest(".modal")) { if ((G && screen === "game") || FM.lock) return; sfx.tap(); go(g.dataset.go); }
});
const onBack = () => {
  if (!$("#modal").classList.contains("hidden")) closeModal();
  else if (screen === "game" && G) confirmQuit();
  else if (screen !== "home" && screen !== "login" && SES) go("home");
  else if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.exitApp();
};
try { if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.addListener("backButton", onBack); } catch (e) {}
window.addEventListener("online", () => { refreshQuestions(); if (screen === "home") R.home(); });
window.addEventListener("offline", () => { toast("النت قطع — هتكمل بأسئلة محفوظة 📴"); });

/* واجهة للملفات التانية (واحد ضد واحد) */
const FM = window.FM = {
  R, go, app, $, esc, toast, modal, closeModal, header, nav, sfx, vib, confetti, celebrate, speak, feedback, fmt, num, shuffle, norm, pickTier, validQ, qid, online, save, rankOf, checkAch, LET, markServed,
  lock: false,
  get S() { return S; }, get SES() { return SES; },
  setLeave(f) { leaveHook = f; }
};

go("splash");
})();
