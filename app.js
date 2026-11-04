(() => {
  "use strict";

  // ---------- Storage ----------
  const KEY = "pishi-planner-v1";
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; }
    catch { return { days: {} }; }
  };
  const db = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };

  const dateKey = (d = new Date()) => {
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  const TODAY = dateKey();
  const day = (k = TODAY) =>
    (db.days[k] ||= { goal: "", tasks: [], events: [], focusMin: 0, mood: 0, note: "" });

  const uid = () => Math.random().toString(36).slice(2, 9);
  const $ = (s) => document.querySelector(s);
  const fa = (n) => Number(n).toLocaleString("fa-IR");
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Header date ----------
  try {
    $("#todayDate").textContent = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(new Date());
  } catch { $("#todayDate").textContent = new Date().toDateString(); }

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
    const x = Math.cos(ang) * 7 * dist, y = Math.sin(ang) * 5 * dist;
    pupils.forEach((p) => (p.style.transform = `translate(${x}px, ${y}px)`));
  });

  const cheer = () => {
    const d = day();
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
  goal.value = day().goal;
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
  let pomoLen = 25 * 60, pomoLeft = pomoLen, pomoTimer = null, pomoCounted = 0;
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
    const elapsedMin = Math.floor((pomoLen - pomoLeft) / 60);
    if (elapsedMin > pomoCounted) {
      day().focusMin += elapsedMin - pomoCounted;
      pomoCounted = elapsedMin;
      save(); renderReport();
    }
    if (pomoLeft <= 0) {
      pomoStop();
      pomoLeft = pomoLen; pomoCounted = 0;
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
    pomoStop(); pomoLeft = pomoLen; pomoCounted = 0; pomoRender();
  });
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
      pomoStop();
      pomoLen = pomoLeft = +c.dataset.min * 60; pomoCounted = 0;
      pomoRender();
    })
  );

  // ---------- Schedule ----------
  const START_H = 6, END_H = 23;
  const renderSchedule = () => {
    const d = day();
    const events = [...d.events].sort((a, b) => a.time.localeCompare(b.time));
    const nowH = new Date().getHours();
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
    $("#schedBadge").textContent = fa(d.events.length);
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
    day().events.push({ id: uid(), time, title, color: $("#schedColor").value, done: false });
    $("#schedTitleInput").value = "";
    save(); renderSchedule();
    say("یادم می‌مونه! 📅");
  });

  $("#timeline").addEventListener("click", (e) => {
    const el = e.target.closest(".event");
    if (!el) return;
    const d = day();
    if (e.target.closest(".del")) d.events = d.events.filter((x) => x.id !== el.dataset.id);
    else { const ev = d.events.find((x) => x.id === el.dataset.id); ev.done = !ev.done; }
    save(); renderSchedule();
  });

  const scrollToNow = () => {
    const tl = $("#timeline");
    const now = tl.querySelector(".hour.now");
    if (now) tl.scrollTop = now.offsetTop - tl.offsetTop - 40;
  };

  // ---------- Report ----------
  const MOODS = ["", "😿", "😾", "😺", "😸", "😻"];
  const renderReport = () => {
    const d = day();
    const total = d.tasks.length, done = d.tasks.filter((t) => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("#ring").style.setProperty("--p", pct);
    $("#ringText").textContent = `${fa(pct)}%`;
    $("#statDone").textContent = fa(done);
    $("#statFocus").textContent = fa(d.focusMin);

    // streak: consecutive days with at least one finished task
    let streak = 0;
    const cur = new Date();
    const hasDone = (k) => (db.days[k]?.tasks || []).some((t) => t.done);
    if (!hasDone(dateKey(cur))) cur.setDate(cur.getDate() - 1);
    while (hasDone(dateKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    $("#statStreak").textContent = fa(streak);

    // last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const k = dateKey(dt), rec = db.days[k];
      days.push({
        k, dt,
        done: (rec?.tasks || []).filter((t) => t.done).length,
        mood: rec?.mood || 0,
      });
    }
    const max = Math.max(1, ...days.map((x) => x.done));
    const wd = new Intl.DateTimeFormat("fa-IR", { weekday: "narrow" });
    $("#week").innerHTML = days.map((x) => `
      <div class="bar ${x.k === TODAY ? "today" : ""}" title="${fa(x.done)} کار">
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

  const note = $("#note");
  note.value = day().note;
  note.addEventListener("input", () => { day().note = note.value; save(); });

  // ---------- Walking cat ----------
  const walker = $("#walker");
  walker.addEventListener("click", () => {
    walker.classList.toggle("sleep");
    toast(walker.classList.contains("sleep") ? "پیشی کوچولو خوابید 😴" : "پیشی بیدار شد! 🐾");
  });

  // ---------- Init ----------
  renderTasks();
  renderSchedule();
  pomoRender();
  requestAnimationFrame(scrollToNow);
  setInterval(renderSchedule, 60 * 1000);
})();
