(() => {
  "use strict";

  // ---------- Storage ----------
  const KEY = "pishi-planner-v1";
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; }
    catch { return { days: {} }; }
  };
  let db = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  // ask the browser to never evict our storage
  try { navigator.storage?.persist?.(); } catch {}

  const dateKey = (d = new Date()) => {
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  let TODAY = dateKey(); // updated automatically after midnight
  let current = TODAY; // the day being viewed / planned
  const day = (k = current) =>
    (db.days[k] ||= { goal: "", tasks: [], events: [], focusMin: 0, mood: 0, note: "" });

  const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
  // Iranian week: Saturday → Friday
  const weekStart = (dt) => addDays(dt, -((dt.getDay() + 1) % 7));
  const weekKeys = (k = current) => {
    const s = weekStart(parseKey(k));
    return Array.from({ length: 7 }, (_, i) => dateKey(addDays(s, i)));
  };
  const fmt = (opts) => {
    try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", opts); }
    catch { return new Intl.DateTimeFormat("fa-IR", opts); }
  };
  const fmtLong = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fmtWd = fmt({ weekday: "long" });
  const fmtDay = fmt({ day: "numeric" });
  const fmtDM = fmt({ day: "numeric", month: "long" });

  const uid = () => Math.random().toString(36).slice(2, 9);
  const $ = (s) => document.querySelector(s);
  const fa = (n) => Number(n).toLocaleString("fa-IR");
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Header date ----------
  const renderHeaderDate = () => {
    try {
      $("#todayDate").textContent = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      }).format(new Date());
    } catch { $("#todayDate").textContent = new Date().toDateString(); }
  };
  renderHeaderDate();

  // ---------- Day stats helpers (tasks + schedule items) ----------
  const statsOf = (rec) => {
    const tasks = rec?.tasks || [], events = rec?.events || [];
    const td = tasks.filter((t) => t.done).length, ed = events.filter((e) => e.done).length;
    return { t: tasks.length, td, e: events.length, ed, total: tasks.length + events.length, done: td + ed };
  };
  const focusMinOf = (rec) => Math.floor(((rec?.focusSec || 0) + (rec?.focusMin || 0) * 60) / 60);

  // ---------- Toast & confetti ----------
  let toastT;
  const toast = (msg) => {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2200);
  };
  const confetti = () => {
    const icons = ["🐾", "💚", "✨", "🐟", "🧶"];
    for (let i = 0; i < 28; i++) {
      const el = document.createElement("span");
      el.className = "confetti";
      el.textContent = icons[i % icons.length];
      el.style.left = Math.random() * 100 + "vw";
      el.style.animationDuration = 2 + Math.random() * 2 + "s";
      el.style.animationDelay = Math.random() * 0.6 + "s";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }
  };

  // ---------- Big cat ----------
  const cat = $("#bigCat");
  const speech = $("#speech");
  let speechT;
  const say = (msg) => {
    speech.textContent = msg;
    speech.classList.add("show");
    clearTimeout(speechT);
    speechT = setTimeout(() => speech.classList.remove("show"), 2600);
  };
  const happy = () => {
    cat.classList.remove("happy");
    void cat.getBoundingClientRect();
    cat.classList.add("happy");
  };

  const pupils = cat.querySelectorAll(".pupil");
  window.addEventListener("pointermove", (e) => {
    const r = cat.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
    const ang = Math.atan2(e.clientY - cy, e.clientX - cx);
    const dist = Math.min(1, Math.hypot(e.clientX - cx, e.clientY - cy) / 300);
    const x = Math.cos(ang) * 4 * dist, y = Math.sin(ang) * 4 * dist;
    pupils.forEach((p) => (p.style.transform = `translate(${x}px, ${y}px)`));
  });

  const cheer = () => {
    const d = day(TODAY);
    const total = d.tasks.length, done = d.tasks.filter((t) => t.done).length;
    const pool = [
      "میو! تو می‌تونی 💚", "یه کم استراحت هم لازمه 😽", "خرررر... 🐾",
      "آب خوردی امروز؟ 💧", "به خودت افتخار کن ✨", "یه ماهی بهم بدهکاری 🐟",
    ];
    if (total && done === total) pool.push("همه رو تموم کردی! 😻", "تو بهترینی 🏆");
    else if (total) pool.push(`فقط ${fa(total - done)} تا کار مونده!`);
    else pool.push("یه کار اضافه کن ببینم 😼");
    say(pool[Math.floor(Math.random() * pool.length)]);
    happy();
  };
  cat.addEventListener("click", cheer);
  setTimeout(() => say("سلام! من پیشی‌ام 😺"), 700);

  // ---------- Today Focus ----------
  const goal = $("#mainGoal");
  goal.addEventListener("input", () => { day().goal = goal.value; save(); });

  const renderTasks = () => {
    const d = day();
    const list = $("#taskList");
    list.innerHTML = d.tasks.map((t) => `
      <li class="task ${t.done ? "done" : ""}" data-id="${t.id}">
        <button class="check" aria-label="انجام شد"></button>
        <span class="txt">${esc(t.text)}</span>
        <button class="del" aria-label="حذف">×</button>
      </li>`).join("");
    $("#taskEmpty").style.display = d.tasks.length ? "none" : "block";
    const done = d.tasks.filter((t) => t.done).length;
    $("#focusBadge").textContent = `${fa(done)}/${fa(d.tasks.length)}`;
    renderReport();
    renderWeekbar();
  };

  $("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("#taskInput");
    const text = inp.value.trim();
    if (!text) return;
    day().tasks.push({ id: uid(), text, done: false });
    inp.value = "";
    save(); renderTasks();
  });

  $("#taskList").addEventListener("click", (e) => {
    const li = e.target.closest(".task");
    if (!li) return;
    const d = day();
    const t = d.tasks.find((x) => x.id === li.dataset.id);
    if (e.target.closest(".del")) {
      d.tasks = d.tasks.filter((x) => x.id !== t.id);
    } else if (e.target.closest(".check, .txt")) {
      t.done = !t.done;
      if (t.done) {
        const all = d.tasks.every((x) => x.done);
        if (all) { confetti(); say("همه کارا تموم شد! 😻🎉"); toast("آفرین! روزت عالی بود 💚"); }
        else { say("آفرین! 🐾"); }
        happy();
      }
    }
    save(); renderTasks();
  });

  // ---------- Pomodoro ----------
  let pomoLen = 25 * 60, pomoLeft = pomoLen, pomoTimer = null;
  const pomoFmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const pomoRender = () => {
    $("#pomoTime").textContent = pomoFmt(pomoLeft);
    $("#pomoBar").style.width = ((pomoLen - pomoLeft) / pomoLen) * 100 + "%";
    $("#pomoStart").textContent = pomoTimer ? "توقف" : (pomoLeft < pomoLen ? "ادامه" : "شروع");
    document.title = pomoTimer ? `${pomoFmt(pomoLeft)} · Pishi Planner` : "Pishi Planner 🐈‍⬛";
  };
  const pomoStop = () => { clearInterval(pomoTimer); pomoTimer = null; };
  const tick = () => {
    pomoLeft--;
    // every focused second is counted, so pausing never loses time
    const t = day(TODAY);
    t.focusSec = (t.focusSec || 0) + 1;
    save();
    if (current === TODAY) $("#statFocus").textContent = fa(focusMinOf(t));
    if (pomoLeft <= 0) {
      pomoStop();
      pomoLeft = pomoLen;
      renderReport();
      confetti(); say("وقت استراحته! 😽"); toast("یه جلسه تمرکز تموم شد ⏱️💚");
    }
    pomoRender();
  };
  $("#pomoStart").addEventListener("click", () => {
    if (pomoTimer) pomoStop();
    else { pomoTimer = setInterval(tick, 1000); say("تمرکز کن، من مراقبم 👀"); }
    pomoRender();
  });
  $("#pomoReset").addEventListener("click", () => {
    pomoStop(); pomoLeft = pomoLen; pomoRender();
  });
  document.querySelectorAll(".pomo-modes .chip").forEach((c) =>
    c.addEventListener("click", () => {
      document.querySelectorAll(".pomo-modes .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
      pomoStop();
      pomoLen = pomoLeft = +c.dataset.min * 60;
      pomoRender();
    })
  );

  // ---------- Schedule ----------
  const START_H = 6, END_H = 23;
  const renderSchedule = () => {
    const d = day();
    const events = [...d.events].sort((a, b) => a.time.localeCompare(b.time));
    const nowH = current === TODAY ? new Date().getHours() : -1;
    const minH = Math.min(START_H, ...events.map((e) => +e.time.slice(0, 2)));
    const maxH = Math.max(END_H, ...events.map((e) => +e.time.slice(0, 2)));
    let html = "";
    for (let h = minH; h <= maxH; h++) {
      const evs = events.filter((e) => +e.time.slice(0, 2) === h);
      html += `<div class="hour ${h === nowH ? "now" : ""}" data-h="${h}">
        <div class="h">${String(h).padStart(2, "0")}:00</div>
        <div class="slot">${evs.map((e) => `
          <div class="event ${e.color} ${e.done ? "done" : ""}" data-id="${e.id}" title="کلیک = انجام شد">
            <time>${e.time}</time><span>${esc(e.title)}</span>
            <button class="del" aria-label="حذف">×</button>
          </div>`).join("")}</div>
      </div>`;
    }
    $("#timeline").innerHTML = html;
    const ed = d.events.filter((e) => e.done).length;
    $("#schedBadge").textContent = `${fa(ed)}/${fa(d.events.length)}`;
    renderReport();
    renderWeekbar();
  };

  const nextHour = () => {
    const h = (new Date().getHours() + 1) % 24;
    return `${String(h).padStart(2, "0")}:00`;
  };
  $("#schedTime").value = nextHour();

  $("#schedForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const time = $("#schedTime").value;
    const title = $("#schedTitleInput").value.trim();
    if (!time || !title) return;
    const color = $("#schedColor").value;
    const repeat = $("#schedRepeat").checked;
    (repeat ? weekKeys() : [current]).forEach((k) =>
      day(k).events.push({ id: uid(), time, title, color, done: false })
    );
    $("#schedTitleInput").value = "";
    $("#schedRepeat").checked = false;
    save(); renderSchedule();
    say(repeat ? "برای کل هفته یادم موند! 🗓️" : "یادم می‌مونه! 📅");
  });

  $("#timeline").addEventListener("click", (e) => {
    const el = e.target.closest(".event");
    if (!el) return;
    const d = day();
    if (e.target.closest(".del")) d.events = d.events.filter((x) => x.id !== el.dataset.id);
    else {
      const ev = d.events.find((x) => x.id === el.dataset.id);
      ev.done = !ev.done;
      if (ev.done) { say("یکی دیگه هم تموم شد! 🐾"); happy(); }
    }
    save(); renderSchedule();
  });

  const scrollToNow = () => {
    const tl = $("#timeline");
    const now = tl.querySelector(".hour.now") || tl.querySelector(".event")?.closest(".hour");
    tl.scrollTop = now ? now.offsetTop - tl.offsetTop - 40 : 0;
  };

  // ---------- Report ----------
  const MOODS = ["", "😿", "😾", "😺", "😸", "😻"];
  const renderReport = () => {
    const d = day();
    const s = statsOf(d);
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    $("#ring").style.setProperty("--p", pct);
    $("#ringText").textContent = `${fa(pct)}%`;
    $("#statDone").textContent = `${fa(s.done)}/${fa(s.total)}`;
    $("#statFocus").textContent = fa(focusMinOf(d));

    // streak: consecutive days with at least one finished task or schedule item
    let streak = 0;
    const cur = new Date();
    const hasDone = (k) => statsOf(db.days[k]).done > 0;
    if (!hasDone(dateKey(cur))) cur.setDate(cur.getDate() - 1);
    while (hasDone(dateKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    $("#statStreak").textContent = fa(streak);

    // the selected week (Sat → Fri)
    const days = [];
    for (const k of weekKeys()) {
      const dt = parseKey(k), rec = db.days[k];
      days.push({
        k, dt,
        done: statsOf(rec).done,
        mood: rec?.mood || 0,
      });
    }
    const max = Math.max(1, ...days.map((x) => x.done));
    const wd = new Intl.DateTimeFormat("fa-IR", { weekday: "narrow" });
    $("#week").innerHTML = days.map((x) => `
      <div class="bar ${x.k === TODAY ? "today" : ""} ${x.k === current ? "active" : ""}" data-k="${x.k}" title="${fa(x.done)} مورد انجام شده">
        <span class="m">${MOODS[x.mood]}</span>
        <div class="col" style="height:${(x.done / max) * 80}%"></div>
        <small>${wd.format(x.dt)}</small>
      </div>`).join("");

    document.querySelectorAll("#moods button").forEach((b) =>
      b.classList.toggle("active", +b.dataset.mood === d.mood)
    );
  };

  $("#moods").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    day().mood = +b.dataset.mood;
    save(); renderReport();
    say(day().mood >= 3 ? "منم خوشحالم! 😸" : "بیا بغلم 🫂🐈‍⬛");
    happy();
  });

  $("#week").addEventListener("click", (e) => {
    const b = e.target.closest(".bar");
    if (b) selectDay(b.dataset.k);
  });

  const note = $("#note");
  note.addEventListener("input", () => { day().note = note.value; save(); });

  // ---------- Walking cat ----------
  const walker = $("#walker");
  walker.addEventListener("click", () => {
    walker.classList.toggle("sleep");
    toast(walker.classList.contains("sleep") ? "پیشی کوچولو خوابید 😴" : "پیشی بیدار شد! 🐾");
  });

  // ---------- Backup to / from file ----------
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pishi-planner-${TODAY}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("فایل ذخیره شد 💾");
  });

  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data.days !== "object") throw new Error("bad");
      if (!confirm("اطلاعات فعلی با محتوای فایل جایگزین بشه؟")) return;
      localStorage.setItem(KEY, JSON.stringify(data));
      location.reload();
    } catch {
      toast("این فایل معتبر نیست 😿");
    } finally {
      e.target.value = "";
    }
  });

  // ---------- Week bar ----------
  const renderWeekbar = () => {
    const keys = weekKeys();
    $("#weekLabel").textContent = `${fmtDM.format(parseKey(keys[0]))} تا ${fmtDM.format(parseKey(keys[6]))}`;
    $("#selDay").textContent = current === TODAY ? `امروز · ${fmtLong.format(parseKey(current))}` : fmtLong.format(parseKey(current));
    $("#wbDays").innerHTML = keys.map((k) => {
      const rec = db.days[k];
      const { t, td, e: ev, ed } = statsOf(rec);
      const info = t || ev ? `<span>✓${fa(td)}/${fa(t)}</span><span>⏰${fa(ed)}/${fa(ev)}</span>` : "<span>—</span>";
      return `<button class="wb-day ${k === TODAY ? "today" : ""} ${k === current ? "active" : ""} ${k < TODAY ? "past" : ""}" data-k="${k}">
        <span class="wd">${fmtWd.format(parseKey(k))}</span>
        <b>${fmtDay.format(parseKey(k))}</b>
        <span class="info ${t || ev ? "has" : ""}">${info}</span>
      </button>`;
    }).join("");
    const isToday = current === TODAY;
    const wd = fmtWd.format(parseKey(current));
    $("#focusDayName").textContent = isToday ? "تمرکز امروز" : `برنامه ${wd}`;
    $("#goalLabel").textContent = isToday ? "🎯 مهم‌ترین هدف امروز" : `🎯 مهم‌ترین هدف ${wd}`;
    $("#progressLabel").textContent = isToday ? "پیشرفت امروز" : `پیشرفت ${wd}`;
    $("#moodTitle").textContent = isToday ? "امروز حالت چطوره؟" : `${wd} حالت چطور بود؟`;
  };

  const selectDay = (k) => {
    current = k;
    goal.value = day().goal;
    note.value = day().note;
    renderTasks();
    renderSchedule();
    requestAnimationFrame(scrollToNow);
  };

  $("#wbDays").addEventListener("click", (e) => {
    const b = e.target.closest(".wb-day");
    if (b) { selectDay(b.dataset.k); if (b.dataset.k !== TODAY) say("بریم برای این روز برنامه بچینیم 🗓️"); }
  });
  $("#prevWeek").addEventListener("click", () => selectDay(dateKey(addDays(parseKey(current), -7))));
  $("#nextWeek").addEventListener("click", () => selectDay(dateKey(addDays(parseKey(current), 7))));
  $("#goToday").addEventListener("click", () => selectDay(TODAY));

  // ---------- Live updates (no refresh needed) ----------
  // 1) clock: move the "now" line, and roll over to the new day after midnight
  const heartbeat = () => {
    const k = dateKey();
    if (k !== TODAY) {
      const wasToday = current === TODAY;
      TODAY = k;
      renderHeaderDate();
      if (wasToday) { selectDay(TODAY); say("روز جدید مبارک! ☀️"); }
      else { renderTasks(); renderSchedule(); }
    } else {
      renderSchedule();
    }
  };
  setInterval(heartbeat, 30 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) heartbeat(); });

  // 2) other tabs / windows: pick up their changes instantly
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    db = load();
    if (document.activeElement !== goal) goal.value = day().goal;
    if (document.activeElement !== note) note.value = day().note;
    renderTasks();
    renderSchedule();
  });

  // ---------- Init ----------
  selectDay(TODAY);
  pomoRender();
})();
