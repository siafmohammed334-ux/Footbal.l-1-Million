/* واحد ضد واحد — خصم عشوائي حقيقي أو صديق بكود (واتساب)
   بيشتغل على Firebase Realtime Database عن طريق REST (من غير مكتبات) */
(function () {
"use strict";
const F = window.FM, CFG = window.CFG || {};
const R = F.R, $ = F.$, esc = F.esc;
const NQ = 10, QT = 15, TIERS = [1,1,2,2,2,2,3,3,3,3];
const base = () => String(CFG.FIREBASE_DB || "").replace(/\/+$/, "");
const ready = () => /^https?:\/\//.test(base());
let st = null;   // حالة المباراة الحالية

async function db(method, path, body) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(base() + path + ".json", { method, signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error("db" + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}
const rid = () => "g" + Math.random().toString(36).slice(2, 10);
function myId() {
  let id = F.SES && F.SES.id;
  if (!id || id === "guest") { try { id = localStorage.getItem("fm_uid"); if (!id) { id = rid(); localStorage.setItem("fm_uid", id); } } catch (e) { id = rid(); } }
  return String(id).replace(/[.$#\[\]\/]/g, "_");
}
const me = () => ({ id: myId(), name: (F.SES && F.SES.name) || "لاعب" });
const CODE_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 6 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join("");

function buildQs() {
  const used = new Set(), out = [];
  for (const t of TIERS) {
    const r = F.pickTier(t, used); if (!r) return null;
    used.add(F.qid(r)); const n = F.norm(r);
    out.push({ q: n.q, o: n.opts.map(x => x.t), a: n.ans, l: n.l });
  }
  return out;
}
function guard() {
  if (!F.online()) { F.toast("محتاج نت عشان تلعب 1 ضد 1 📴"); return false; }
  if (!ready()) { F.modal(`<div class="big">🛠</div><h3>الميزة محتاجة تفعيل</h3><p>وضع «واحد ضد واحد» محتاج قاعدة بيانات Firebase مجانية. اتّبع الخطوات اللي في ملف <b>الدليل</b> (دقيقتين) وبعدها هيشتغل.</p><button class="btn" id="ok">تمام</button>`); $("#ok").onclick = F.closeModal; return false; }
  return true;
}
function clearAll() {
  if (!st) return;
  st.alive = false; clearTimeout(st.timer); clearInterval(st.poll); clearInterval(st.tick); clearTimeout(st.adv);
}
async function cleanupLeave() {
  const s = st; if (!s) return; clearAll();
  try {
    if (s.phase === "seek") await db("DELETE", "/seek/" + s.me.id);
    else if (s.phase === "wait" && s.R) await db("DELETE", "/rooms/" + s.R);
  } catch (e) {}
  st = null;
}
function enter() { F.setLeave(cleanupLeave); }

/* ---------- القائمة ---------- */
R.duel = function () {
  enter();
  F.app.innerHTML = F.header() + `<h2>⚔ واحد ضد واحد</h2>
    <p class="mut" style="margin-top:-4px">10 أسئلة، نفس الأسئلة للاتنين، والأسرع والأدق بياخد النقاط.</p>
    <div class="chal"><div class="ic">🎲</div><div class="t grow"><b>خصم عشوائي</b><small>بنوصّلك بلاعب حقيقي أونلاين دلوقتي</small></div><button class="btn" id="rnd">العب</button></div>
    <div class="chal"><div class="ic">💬</div><div class="t grow"><b>تحدّى صديق</b><small>ابعتله كود التحدي على واتساب</small></div><button class="btn" id="fr">ابعت</button></div>
    <div class="card"><b>🔑 عندك كود من صديقك؟</b>
      <div class="row" style="margin-top:8px"><input class="inp" id="cd" placeholder="اكتب الكود" maxlength="6" dir="ltr" style="margin:0;text-transform:uppercase;text-align:center;letter-spacing:4px"><button class="btn" id="jn" style="width:auto;padding:12px 18px;font-size:16px">انضم</button></div></div>
    ${ready() ? "" : '<p class="mut" style="text-align:center">⚠ الميزة لسه محتاجة إعداد قاعدة البيانات.</p>'}` + F.nav("challenges");
  $("#rnd").onclick = startRandom;
  $("#fr").onclick = createFriend;
  $("#jn").onclick = () => joinFriend($("#cd").value);
};

/* ---------- خصم عشوائي ---------- */
function waitScreen(title, sub, extra) {
  F.app.innerHTML = `<div style="text-align:center;padding-top:60px"><div class="spin"></div><h2>${title}</h2><p class="mut">${sub}</p>${extra || ""}<button class="btn ghost" id="cx" style="margin-top:18px">إلغاء</button></div>`;
  $("#cx").onclick = () => F.go("duel");
}
async function startRandom() {
  if (!guard()) return;
  const m = me(); clearAll();
  st = { kind: "random", phase: "seek", me: m, alive: true };
  const s = st;
  waitScreen("بندوّر على خصم...", "استنى ثواني، بنوصّلك بلاعب حقيقي");
  const t0 = Date.now(); let fails = 0;
  const loop = async () => {
    if (st !== s || !s.alive) return;
    try {
      const w = await db("PATCH", "/seek/" + m.id, { name: m.name, t: { ".sv": "timestamp" } });
      const now = w.t, all = (await db("GET", "/seek")) || {};
      if (st !== s || !s.alive) return;
      const mine = all[m.id];
      if (mine && mine.room) { s.phase = "play"; db("DELETE", "/seek/" + m.id).catch(() => {}); return enterRoom(mine.room, "guest"); }
      const alive = Object.entries(all).filter(([id, v]) => v && !v.room && v.t >= now - 9000).sort((a, b) => a[0] < b[0] ? -1 : 1);
      if (alive.length >= 2 && alive[0][0] === m.id) {
        const [oid, ov] = alive[1], qs = buildQs();
        if (!qs) throw new Error("noq");
        const Rm = code();
        await db("PUT", "/rooms/" + Rm, { host: m, guest: { id: oid, name: ov.name || "لاعب" }, qs, state: "play", created: { ".sv": "timestamp" } });
        await db("PATCH", "/seek/" + oid, { room: Rm });
        s.phase = "play"; await db("DELETE", "/seek/" + m.id).catch(() => {});
        return enterRoom(Rm, "host");
      }
      fails = 0;
    } catch (e) { if (++fails >= 4) { F.toast("مشكلة في الاتصال، جرّب تاني"); return F.go("duel"); } }
    if (Date.now() - t0 > 45000) { return noOpponent(); }
    s.timer = setTimeout(loop, 1500);
  };
  loop();
}
function noOpponent() {
  cleanupLeave();
  F.app.innerHTML = `<div style="text-align:center;padding-top:60px"><div style="font-size:64px">😴</div><h2>مفيش لاعبين متاحين دلوقتي</h2><p class="mut">جرّب تاني بعد شوية، أو تحدّى صديقك بكود على واتساب.</p>
    <button class="btn" id="again">🔁 جرّب تاني</button><button class="btn sec" id="fr" style="margin-top:10px">💬 تحدّى صديق</button><button class="btn ghost" id="bk" style="margin-top:10px">رجوع</button></div>`;
  $("#again").onclick = startRandom; $("#fr").onclick = createFriend; $("#bk").onclick = () => F.go("duel");
}

/* ---------- تحدي صديق بكود واتساب ---------- */
async function createFriend() {
  if (!guard()) return;
  const m = me(); clearAll();
  const qs = buildQs(); if (!qs) return F.toast("مفيش أسئلة كفاية");
  const Rm = code();
  try { await db("PUT", "/rooms/" + Rm, { host: m, guest: null, qs, state: "wait", created: { ".sv": "timestamp" } }); }
  catch (e) { return F.toast("مشكلة في الاتصال، جرّب تاني"); }
  st = { kind: "friend", phase: "wait", me: m, R: Rm, alive: true };
  const s = st, text = `تحدّاني في «مليونير كرة القدم» ⚽👑\nافتح اللعبة ← التحديات ← واحد ضد واحد ← اكتب الكود: ${Rm}`;
  waitScreen("استنى صديقك...", "ابعتله الكود واستنى لحد ما ينضم",
    `<div class="code">${Rm}</div><button class="btn" id="wa" style="margin:6px 0">💬 ابعت على واتساب</button>`);
  $("#wa").onclick = () => shareWA(text);
  const t0 = Date.now();
  s.poll = setInterval(async () => {
    if (st !== s) return;
    try {
      const r = await db("GET", "/rooms/" + Rm);
      if (!r) { clearAll(); return F.go("duel"); }
      if (r.guest && r.state === "play") { s.phase = "play"; clearInterval(s.poll); return enterRoom(Rm, "host"); }
    } catch (e) {}
    if (Date.now() - t0 > 300000) { F.toast("انتهت مهلة الانتظار"); F.go("duel"); }
  }, 1500);
}
function shareWA(text) {
  try {
    const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
    if (P) return P.share({ text, dialogTitle: "ابعت التحدي" }).catch(() => {});
  } catch (e) {}
  const u = "https://wa.me/?text=" + encodeURIComponent(text);
  try { window.open(u, "_system") || (location.href = u); } catch (e) { location.href = u; }
}
async function joinFriend(raw) {
  const c = String(raw || "").trim().toUpperCase();
  if (c.length !== 6) return F.toast("اكتب الكود (6 حروف وأرقام)");
  if (!guard()) return;
  const m = me();
  try {
    const r = await db("GET", "/rooms/" + c);
    if (!r) return F.toast("الكود غلط أو التحدي انتهى");
    if (r.state !== "wait" || r.guest) return F.toast("الغرفة دي اتملت");
    if (r.host && r.host.id === m.id) return F.toast("ده كود التحدي بتاعك — ابعته لصديقك");
    await db("PATCH", "/rooms/" + c, { guest: m, state: "play" });
    const r2 = await db("GET", "/rooms/" + c);
    if (!r2 || !r2.guest || r2.guest.id !== m.id) return F.toast("الغرفة اتملت");
    clearAll(); st = { kind: "friend", phase: "play", me: m, alive: true };
    enterRoom(c, "guest");
  } catch (e) { F.toast("مشكلة في الاتصال، جرّب تاني"); }
}

/* ---------- المباراة ---------- */
async function enterRoom(Rm, role) {
  const m = me();
  let room;
  try { room = await db("GET", "/rooms/" + Rm); } catch (e) {}
  if (!room) { F.toast("الغرفة مش متاحة"); return F.go("duel"); }
  clearAll();
  const opp = role === "host" ? room.guest : room.host;
  st = { kind: "duel", phase: "play", R: Rm, role, me: m, opp: opp || { id: "?", name: "الخصم" }, qs: room.qs, i: 0, ans: {}, alive: true, revealed: false, myAns: null, total: { me: 0, opp: 0 } };
  F.lock = true;
  F.setLeave(() => { const s = st; clearAll(); F.lock = false; st = null; });
  const s = st;
  s.poll = setInterval(pollRoom, 1000);
  showQ();
}
const pts = (a, q) => (a && a.c === q.a) ? 100 + Math.max(0, Math.round((QT * 1000 - Math.min(a.ms, QT * 1000)) / 1000)) * 5 : 0;
const ansOf = (i, id) => (st.ans[i] && st.ans[i][id]) || null;
function totals(upto) {
  let a = 0, b = 0;
  for (let j = 0; j <= upto; j++) { const q = st.qs[j]; a += pts(ansOf(j, st.me.id), q); b += pts(ansOf(j, st.opp.id), q); }
  return [a, b];
}
function topBar(sub1, sub2) {
  const [a, b] = totals(st.revealed ? st.i : st.i - 1);
  return `<div class="vs">
    <div class="p"><b>${esc(st.me.name)}</b><span id="sa">${a}</span><small id="s1">${sub1 || ""}</small></div>
    <div class="timer mid" id="tm">${QT}</div>
    <div class="p" id="po"><b>${esc(st.opp.name)}</b><span id="sb">${b}</span><small id="s2">${sub2 || ""}</small></div>
  </div><span class="pill qn">السؤال <bdi dir="ltr">${st.i + 1} / ${NQ}</bdi></span>`;
}
function showQ() {
  const s = st; if (!s || !s.alive) return;
  const q = s.qs[s.i]; s.revealed = false; s.myAns = null; s.qStart = Date.now(); s.myAnsAt = 0;
  F.app.innerHTML = topBar() + `<div class="qbox">${esc(q.q)}</div>
    <div class="opts">${q.o.map((t, i) => `<button class="opt" data-o="${i}"><b>${F.LET[i]}</b><span class="tx">${esc(t)}</span><span class="pc"></span></button>`).join("")}</div>`;
  F.app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => submit(+b.dataset.o));
  clearInterval(s.tick);
  s.tick = setInterval(() => {
    if (st !== s) return;
    const left = QT - Math.floor((Date.now() - s.qStart) / 1000), tm = $("#tm");
    if (tm) { tm.textContent = Math.max(0, left); tm.classList.toggle("low", left <= 5); }
    if (left <= 0 && s.myAns === null) submit(-1);
  }, 250);
}
async function submit(c) {
  const s = st; if (!s || s.myAns !== null || s.revealed) return;
  const ms = Math.min(QT * 1000, Date.now() - s.qStart);
  s.myAns = { c, ms }; s.myAnsAt = Date.now(); s.ans[s.i] = s.ans[s.i] || {}; s.ans[s.i][s.me.id] = { c, ms };
  F.app.querySelectorAll("[data-o]").forEach(b => { b.setAttribute("disabled", ""); if (+b.dataset.o === c) b.classList.add("sel", "mine"); });
  F.sfx.tap();
  const s1 = $("#s1"); if (s1) s1.textContent = "جاوبت ✓";
  try { await db("PUT", "/rooms/" + s.R + "/ans/" + s.i + "/" + s.me.id, { c, ms }); } catch (e) { try { await db("PUT", "/rooms/" + s.R + "/ans/" + s.i + "/" + s.me.id, { c, ms }); } catch (e2) {} }
  checkReveal();
}
async function pollRoom() {
  const s = st; if (!s || !s.alive || s.phase !== "play") return;
  try {
    const r = await db("GET", "/rooms/" + s.R);
    if (st !== s) return;
    if (!r) return endDuel("gone");
    if (r.ans) Object.keys(r.ans).forEach(k => { s.ans[k] = Object.assign({}, s.ans[k] || {}, r.ans[k]); });
    const oa = ansOf(s.i, s.opp.id), s2 = $("#s2"), po = $("#po");
    if (oa && s2 && !s.revealed) { s2.textContent = "جاوب ✓"; po && po.classList.add("done"); }
    if (s.myAns && !oa && !s.revealed && Date.now() - s.myAnsAt > 22000) return endDuel("forfeit");
    checkReveal();
  } catch (e) {}
}
function checkReveal() {
  const s = st; if (!s || !s.alive || s.revealed || s.myAns === null) return;
  const oa = ansOf(s.i, s.opp.id), ma = ansOf(s.i, s.me.id);
  if (!oa || !ma) return;
  s.revealed = true; clearInterval(s.tick);
  const q = s.qs[s.i], btns = F.app.querySelectorAll("[data-o]");
  btns.forEach(b => b.setAttribute("disabled", ""));
  btns[q.a] && btns[q.a].classList.add("ok");
  const right = ma.c === q.a;
  if (ma.c >= 0 && !right && btns[ma.c]) { btns[ma.c].classList.remove("sel"); btns[ma.c].classList.add("no"); }
  btns.forEach((b, i) => { const pc = b.querySelector(".pc"); if (pc && oa.c === i) pc.textContent = "الخصم"; });
  const [a, b] = totals(s.i); const sa = $("#sa"), sb = $("#sb"); if (sa) sa.textContent = a; if (sb) sb.textContent = b;
  if (right) { F.sfx.ok(); F.sfx.cheer(false); F.feedback("ok", "إجابة صحيحة!"); F.speak("إجابة صحيحة"); F.vib(40); }
  else { F.sfx.no(); F.sfx.boo(); F.feedback(ma.c === -1 ? "time" : "no", ma.c === -1 ? "انتهى الوقت" : "إجابة خاطئة"); F.speak("إجابة خاطئة"); F.vib([80, 60, 120]); }
  s.adv = setTimeout(() => { if (st !== s) return; if (s.i >= NQ - 1) endDuel("done"); else { s.i++; showQ(); } }, 2300);
}
function endDuel(why) {
  const s = st; if (!s) return;
  clearAll(); F.lock = false;
  const last = why === "done" ? NQ - 1 : Math.max(-1, s.i - (s.revealed ? 0 : 1));
  let [a, b] = totals(last);
  let res = a > b ? "win" : a < b ? "lose" : "draw";
  if (why === "forfeit") res = "win";
  const S = F.S;
  S.stats.duelGames++; if (res === "win") S.stats.duelWins++;
  const gems = res === "win" ? 60 : res === "draw" ? 25 : 10, points = res === "win" ? 300 : res === "draw" ? 120 : 40;
  S.gems += gems; S.points += points;
  S.hist.unshift({ mode: "واحد ضد واحد", date: new Date().toLocaleDateString("ar-EG"), pts: points, info: res === "win" ? "فوز" : res === "draw" ? "تعادل" : "خسارة" }); S.hist = S.hist.slice(0, 30);
  F.checkAch(); F.save();
  if (s.role === "host") setTimeout(() => db("DELETE", "/rooms/" + s.R).catch(() => {}), 8000);
  const icon = res === "win" ? "🏆" : res === "draw" ? "🤝" : "😞";
  const title = res === "win" ? (why === "forfeit" ? "الخصم انسحب — فزت!" : "مبروك! فزت!") : res === "draw" ? "تعادل!" : "خسرت المرة دي";
  if (res === "win") { F.celebrate(true); F.speak("مبروك! فزت"); } else if (res === "lose") { F.sfx.no(); F.sfx.boo(); F.speak("حظ أوفر المرة الجاية"); } else F.sfx.win();
  F.app.innerHTML = `<div style="text-align:center;padding-top:30px"><div style="font-size:76px">${icon}</div><h2 style="font-size:26px">${title}</h2>
    <div class="vs" style="margin-top:14px"><div class="p"><b>${esc(s.me.name)}</b><span>${a}</span></div><div class="mid" style="width:36px">VS</div><div class="p"><b>${esc(s.opp.name)}</b><span>${b}</span></div></div>
    <div class="grid2" style="margin:14px 0"><div class="card stat"><b>+${points}</b><small>نقاط</small></div><div class="card stat"><b>+${gems} 💎</b><small>جواهر</small></div></div>
    <button class="btn" id="rm">🎲 خصم جديد</button><button class="btn sec" id="hm" style="margin-top:10px">🏠 الرئيسية</button></div>`;
  st = null;
  $("#rm").onclick = () => { F.go("duel"); setTimeout(startRandom, 50); };
  $("#hm").onclick = () => F.go("home");
}
})();
