/* TUNEVA browser application.
   Prices, permissions, answers and balances are validated on the server.
   Keep secrets in .env. This file contains presentation and API calls only. */
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format((value || 0) / 100);
const date = (value) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const naira = (value) => Math.round(Number(value) * 100);
const kinds = {
  quiz: { name: "Answer a Quiz", icon: "✳︎", color: "lilac" },
  language: { name: "Teach Your Language", icon: "Aa", color: "peach" },
  music: { name: "Listen to Music", icon: "♫", color: "mint" },
  video: { name: "Watch a Video", icon: "▷", color: "lilac" },
};
let config = {},
  me = null,
  currentFilter = "all",
  timer = null,
  routeVersion = 0;
const modal = $("#modal");

// API base URL. In production this points to the Render backend.
// Locally it falls back to same-origin so existing development still works.
const API_BASE =
  (typeof window !== "undefined" && window.TUNEVA_API_BASE) ||
  (typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
    ? "https://api.tunevaconnect.top"
    : "");

async function api(path, data) {
  const response = await fetch(API_BASE + "/api" + path, {
    method: data === undefined ? "GET" : "POST",
    credentials: "include",
    headers:
      data === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": me?.csrf || "",
          },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "Please try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => $("#toast").classList.remove("show"), 5500);
}
function badge(status) {
  const color = ["approved", "paid", "published", "active"].includes(status)
    ? "green"
    : ["pending", "started", "draft"].includes(status)
      ? "amber"
      : ["rejected", "disabled"].includes(status)
        ? "red"
        : "purple";
  return `<span class="pill ${color}">${esc(status || "available")}</span>`;
}
function field(label, name, type = "text", value = "", extra = "") {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function area(label, name, extra = "") {
  return `<label class="field"><span>${label}</span><textarea name="${name}" ${extra}></textarea></label>`;
}
function status() {
  return '<p class="error form-status" role="status"></p>';
}
function formData(form) {
  return Object.fromEntries(new FormData(form));
}
function bindForm(selector, handler) {
  const form = $(selector);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("button[type=submit]", form);
    const out = $(".form-status", form);
    if (button) button.disabled = true;
    if (out) out.textContent = "";
    try {
      await handler(formData(form), form);
    } catch (e) {
      if (out) out.textContent = e.message;
      else toast(e.message);
    } finally {
      if (button) button.disabled = false;
    }
  });
}
function openModal(title, html) {
  closeModal();
  $("#modal-content").innerHTML =
    `<div class="dialog-heading"><h2>${esc(title)}</h2><button class="close" aria-label="Close dialog">×</button></div>${html}`;
  $(".close", modal).onclick = closeModal;
  modal.showModal();
}
function closeModal() {
  clearInterval(timer);
  timer = null;
  const media = $("video,audio", modal);
  if (media) media.pause();
  modal.close();
}
modal.addEventListener("close", () => {
  clearInterval(timer);
  timer = null;
  const media = $("video,audio", modal);
  if (media) media.pause();
});
function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
const icons = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tasks:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  wallet:
    '<path d="M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7"/><path d="M21 12h-6v5h6"/><circle cx="17" cy="14.5" r=".5"/>',
  activity: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  account:
    '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  reviews: '<path d="M8 4H5v17h14V4h-3M9 3h6v4H9Z"/><path d="m8 14 3 3 5-6"/>',
  bank: '<path d="m3 8 9-5 9 5H3Zm0 13h18M5 11v7m7-7v7m7-7v7"/>',
  members:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
  system: '<path d="M4 4h16v12H4ZM8 21h8m-4-5v5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
};
function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.tasks}</svg>`;
}
const adminSections = [
  ["overview", "dashboard", "Overview"],
  ["tasks", "tasks", "Task library"],
  ["reviews", "reviews", "Review queue"],
  ["withdrawals", "bank", "Withdrawals"],
  ["payments", "wallet", "Payments"],
  ["members", "members", "Members"],
  ["broadcast", "activity", "Broadcast"],
  ["system", "system", "System"],
  ["audit", "activity", "Audit log"],
];
function shell(page, detail) {
  const adminView = page === "admin" && me.user.role === "admin";
  let links = [
    ["dashboard", "dashboard", "Overview"],
    ["tasks", "tasks", "Explore tasks"],
    ["wallet", "wallet", "Wallet"],
    ["activity", "activity", "Activity"],
    ["account", "account", "Account"],
  ];
  if (me.user.role !== "admin" && (!me.user.active || !me.user.verified))
    links = [["account", "account", "Activate account"]];
  if (adminView)
    links = adminSections.map(([key, symbol, label]) => [
      "admin/" + key,
      symbol,
      label,
    ]);
  const selected = adminView ? "admin/" + (detail || "overview") : page;
  const navLink = ([key, symbol, label]) =>
    `<a class="nav-link ${selected === key ? "active" : ""}" href="#${key}" ${selected === key ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span>${selected === key ? '<span class="nav-current" aria-hidden="true"></span>' : ""}</a>`;
  const quick = adminView
    ? links.filter(([key]) =>
        [
          "admin/overview",
          "admin/reviews",
          "admin/withdrawals",
          "admin/members",
        ].includes(key),
      )
    : links;
  $("#app").innerHTML =
    `<div class="shell ${adminView ? "admin-shell" : "member-shell"}"><button class="nav-shade" aria-label="Close navigation" tabindex="-1"></button><aside id="workspace-nav" class="sidebar"><a class="brand" href="/"><span>T</span> tuneva<span class="brand-period">.</span></a><div class="workspace-chip">${icon(adminView ? "system" : "tasks")}<div><strong>${adminView ? "Management console" : "Member workspace"}</strong><small>${adminView ? "ADMINISTRATOR" : esc(me.user.plan.toUpperCase()) + " MEMBERSHIP"}</small></div></div><p class="nav-label">${adminView ? "PLATFORM" : "WORKSPACE"}</p><nav aria-label="Main navigation">${links.map(navLink).join("")}</nav><div class="sidebar-bottom">${me.user.role === "admin" ? `<a class="nav-link" href="#${adminView ? "tasks" : "admin/overview"}">${icon(adminView ? "tasks" : "system")}<span>${adminView ? "Member workspace" : "Management console"}</span></a>` : ""}<a class="profile-mini" href="#account"><span class="avatar">${esc(initials(me.user.name))}</span><div><strong>${esc(me.user.name)}</strong><small>${adminView ? "Manage your account" : "Your profile & settings"}</small></div>${icon("arrow")}</a></div></aside><main class="main"><header class="topbar"><div class="topbar-left"><button class="menu-button" aria-label="Open navigation" aria-controls="workspace-nav" aria-expanded="false">${icon("menu")}</button><div class="breadcrumb">${adminView ? "Console" : "Workspace"} <span>/</span> <strong>${esc(links.find((l) => l[0] === selected)?.[2] || "Account")}</strong></div></div><div class="top-right"><span class="top-date">${date(Date.now())}</span><span class="pill purple">${adminView ? "ADMIN" : esc(me.user.plan.toUpperCase())}</span><a class="avatar" href="#account" aria-label="Your account">${esc(initials(me.user.name))}</a></div></header><div id="view"></div><footer class="workspace-footer"><span>TUNEVA CONNECT</span><span>Your contribution. Your progress.</span></footer></main><nav class="mobile-dock" aria-label="Quick navigation">${quick.map(navLink).join("")}</nav></div>`;
  const closeNav = () => {
    $(".shell").classList.remove("nav-open");
    $(".menu-button").setAttribute("aria-expanded", "false");
  };
  $(".menu-button").onclick = () => {
    const open = $(".shell").classList.toggle("nav-open");
    $(".menu-button").setAttribute("aria-expanded", String(open));
  };
  $(".nav-shade").onclick = closeNav;
  $("#workspace-nav").onkeydown = (event) => {
    if (event.key === "Escape") {
      closeNav();
      $(".menu-button").focus();
    }
  };
}
function weekChart(rows, label) {
  const zone = { timeZone: "Africa/Lagos" };
  const key = (time) =>
    new Intl.DateTimeFormat("en-CA", zone).format(new Date(time));
  const days = Array.from(
    { length: 7 },
    (_, i) => Date.now() - (6 - i) * 86400000,
  );
  const totals = days.map((day) =>
    rows
      .filter((row) => key(row.created) === key(day))
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const max = Math.max(...totals, 1);
  return `<div class="week-chart"><svg viewBox="0 0 560 180" role="img" aria-label="${esc(label)} for the last seven days in Nigeria time"><path d="M10 25H550M10 75H550M10 125H550" class="chart-grid"/>${totals
    .map((value, i) => {
      const height = (value / max) * 110;
      return `<g><rect x="${25 + i * 78}" y="${135 - height}" width="36" height="${value ? height : 3}" rx="5" class="chart-bar ${i === 6 ? "latest" : ""}"><title>${date(days[i])}: ${money(value)}</title></rect><text x="${43 + i * 78}" y="161" text-anchor="middle">${new Date(days[i]).toLocaleDateString("en-GB", { ...zone, weekday: "short" })}</text></g>`;
    })
    .join(
      "",
    )}</svg><details class="chart-data"><summary>View daily amounts</summary>${totals.map((v, i) => `<div class="row"><span>${date(days[i])}</span><strong>${money(v)}</strong></div>`).join("")}</details>${totals.every((x) => !x) ? '<p class="fine chart-empty">No recorded ' + esc(label.toLowerCase()) + " in this period.</p>" : ""}</div>`;
}
function bankPreview(bank) {
  return bank
    ? `<span class="bank-logo">${icon("bank")}</span><strong>${esc(bank.bank)}</strong><span class="bank-number">•••• •• ${esc(bank.account.slice(-4))}</span><small>${esc(bank.account_name)}</small>`
    : `<span class="bank-logo">${icon("bank")}</span><strong>Your bank, connected.</strong><p>Add an account for your withdrawal requests.</p>`;
}
function heading(kicker, title, subtitle) {
  return `<div class="page-heading"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${subtitle}</p></div>`;
}
function stat(label, value, note, icon) {
  return `<article class="stat glass"><div class="stat-top">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><p>${note}</p></article>`;
}
function activationNotice() {
  if (!me.user.verified)
    return '<div class="notice">Verify your email to activate your plan and start earning. <a class="text-link" href="#account">Open account settings <span class="arrow" aria-hidden="true"></span></a></div>';
  if (!me.user.active)
    return (
      '<div class="notice">Your workspace is ready. Activate your ' +
      esc(me.user.plan.toUpperCase()) +
      ' plan to start eligible tasks. <a class="text-link" href="#account">Review activation <span class="arrow" aria-hidden="true"></span></a></div>'
    );
  return "";
}
function taskCard(t) {
  const k = kinds[t.type],
    reward = t[me.user.plan + "_reward"];
  const complete = t.attempt_status && t.attempt_status !== "started";
  return `<article class="task-card glass"><div class="row"><span class="task-symbol ${k.color}">${k.icon}</span>${t.attempt_status ? badge(t.attempt_status) : '<span class="pill">' + (t.source === "advertiser" ? "SPONSORED" : "COMMUNITY") + "</span>"}</div><div class="task-category">${k.name.toUpperCase()}</div><h3>${esc(t.title)}</h3><p>${esc(t.description.slice(0, 150))}${t.description.length > 150 ? "…" : ""}</p><div class="task-bottom"><strong>${money(reward)}<small>${esc(t.sponsor)}</small></strong><button class="button secondary task-open" data-id="${t.id}" ${!reward || complete ? "disabled" : ""}>${complete ? "Submitted" : t.attempt_status === "started" ? 'Continue <span class="arrow" aria-hidden="true"></span>' : 'Start task <span class="arrow" aria-hidden="true"></span>'}</button></div></article>`;
}
function bindTasks() {
  for (const b of $$(".task-open")) b.onclick = () => startTask(b.dataset.id);
}
async function dashboard() {
  const [tasks, activity, wallet] = await Promise.all([
    api("/tasks"),
    api("/activity"),
    api("/wallet"),
  ]);
  const pending = activity.filter((a) => a.status === "pending").length;
  const available = tasks.filter(
    (t) =>
      !t.attempt_status &&
      t[me.user.plan + "_reward"] > 0 &&
      t.available >= t[me.user.plan + "_reward"],
  );
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  $("#view").innerHTML =
    `<div class="heading-actions">${heading("YOUR OVERVIEW", `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, ${esc(me.user.name.split(" ")[0])}.`, "Here’s where you stand. Make your next contribution count.")}<a class="button" href="#tasks">Explore tasks ${icon("arrow")}</a></div>${activationNotice()}
  <div class="overview-metrics"><section class="balance-feature"><div class="row"><span>Available balance</span>${icon("wallet")}</div><strong class="balance-amount">${money(wallet.balance)}</strong><div class="balance-foot"><span>${esc(me.user.plan.toUpperCase())} membership</span><a href="#wallet">Open wallet ${icon("arrow")}</a></div></section>${stat("Total task rewards", money(wallet.earned), "All approved task credits", icon("tasks"))}${stat("Awaiting review", pending, "From your latest 200 submissions", icon("reviews"))}${stat("Withdrawal holds", money(wallet.held), "Pending and approved requests", icon("bank"))}</div>
  <div class="workspace-grid"><div class="primary-column"><section class="panel glass chart-panel"><div class="section-title"><div><span class="eyebrow">YOUR PROGRESS</span><h2>Rewards credited</h2></div><span class="period-label">Last 7 days</span></div>${weekChart(wallet.recentRewards, "Rewards")}</section><section><div class="section-title"><div><span class="eyebrow">MAKE YOUR NEXT MOVE</span><h2>Available for you <span class="count-chip">${available.length}</span></h2></div><a class="text-link" href="#tasks">All tasks ${icon("arrow")}</a></div><div class="task-grid">${available.slice(0, 2).map(taskCard).join("") || '<div class="empty panel glass">You’re all caught up. New funded tasks will appear here when published.</div>'}</div></section></div>
  <aside class="secondary-column"><section class="membership-card"><span class="eyebrow">YOUR MEMBERSHIP</span><div class="row"><h2>TUNEVA ${esc(me.user.plan.toUpperCase())}</h2>${icon("tasks")}</div><p>Choose from quizzes, language contributions, music and video tasks.</p><a href="#account" class="text-link">Membership details ${icon("arrow")}</a></section><section class="bank-preview panel glass">${bankPreview(wallet.bank)}<a href="#wallet" class="button secondary small">${wallet.bank ? "Manage bank account" : "Add bank account"} ${icon("arrow")}</a></section><section class="panel glass"><div class="section-title"><h3>Recent activity</h3><a href="#activity" class="text-link">View all</a></div>${
    activity
      .slice(0, 3)
      .map(
        (a) =>
          `<div class="activity-row"><span class="activity-icon">${icon(kinds[a.type] ? "tasks" : "activity")}</span><div><strong>${esc(a.title)}</strong><small>${date(a.created)}</small></div>${badge(a.status)}</div>`,
      )
      .join("") ||
    '<p class="subtle">Complete your first task to start your activity history.</p>'
  }</section></aside></div>`;
  bindTasks();
}
async function taskList() {
  const tasks = await api("/tasks");
  $("#view").innerHTML =
    heading(
      "MAKE YOUR CONTRIBUTION",
      "Find your next task.",
      "Rewards are shown upfront. Each published task allows one attempt per member.",
    ) +
    activationNotice() +
    `<label class="search-field">${icon("search")}<input id="task-search" type="search" aria-label="Search tasks" placeholder="Search tasks by title or sponsor"></label><div class="filter-bar"><button class="filter ${currentFilter === "all" ? "active" : ""}" data-filter="all">All tasks</button>${Object.entries(
      kinds,
    )
      .map(
        ([key, k]) =>
          `<button class="filter ${currentFilter === key ? "active" : ""}" data-filter="${key}">${k.icon} ${k.name}</button>`,
      )
      .join("")}</div><div class="task-grid wide">${
      tasks
        .filter((t) => currentFilter === "all" || t.type === currentFilter)
        .map(taskCard)
        .join("") ||
      '<p class="empty">No tasks in this category yet. Check back soon.</p>'
    }</div>`;
  for (const b of $$(".filter"))
    b.onclick = () => {
      currentFilter = b.dataset.filter;
      taskList().catch((e) => toast(e.message));
    };
  $("#task-search").oninput = (event) => {
    const term = event.target.value.toLowerCase();
    $$(".task-card").forEach((card) => {
      card.hidden = !card.textContent.toLowerCase().includes(term);
    });
  };
  bindTasks();
}
async function startTask(taskId) {
  try {
    const a = await api("/tasks/" + taskId + "/start", {});
    if (a.status !== "started") {
      toast("This attempt is " + a.status + ". See your activity for details.");
      return;
    }
    const c = a.config;
    let content = `<p class="modal-note">${esc(a.description || "")}</p><p class="modal-note">Reward: <strong>${money(a.reward)}</strong> · Finish by ${new Date(a.expires).toLocaleString()}. Your reward is reserved while you work.</p><form id="task-form">`;
    if (a.type === "quiz")
      content +=
        `<p class="modal-note">Pass mark: ${c.pass}%. Check your answers before submitting; this is your only attempt.</p>` +
        c.questions
          .map(
            (q, i) =>
              `<fieldset class="question"><legend>${i + 1}. ${esc(q.prompt)}</legend>${q.options.map((o, j) => `<label class="quiz-option"><input type="radio" name="q${i}" value="${j}" required> ${esc(o)}</label>`).join("")}</fieldset>`,
          )
          .join("");
    else if (a.type === "language")
      content +=
        field(
          "Language",
          "language",
          "text",
          "",
          'required minlength="2" maxlength="80"',
        ) +
        area(
          "Phrase in your language",
          "phrase",
          'required minlength="2" maxlength="2000"',
        ) +
        area(
          "English translation",
          "translation",
          'required minlength="2" maxlength="2000"',
        ) +
        area(
          "Meaning and when to use it",
          "explanation",
          'required minlength="2" maxlength="3000"',
        );
    else
      content +=
        `<p class="modal-note">Play for at least ${c.seconds} seconds at normal speed with this page visible. Then answer the question. Your submission will be reviewed.</p><${a.type === "music" ? "audio" : "video"} class="task-media" controls preload="metadata" src="${esc(c.url)}"></${a.type === "music" ? "audio" : "video"}><div class="media-progress"><span id="play-progress"></span></div><p id="play-time" class="fine">${a.seconds} / ${c.seconds} seconds recorded</p>` +
        area(
          esc(c.question),
          "answer",
          'required minlength="3" maxlength="3000"',
        );
    content +=
      status() +
      '<button class="button full" type="submit">Submit ' +
      (a.type === "quiz" ? "answers" : "for review") +
      ' <span class="arrow" aria-hidden="true"></span></button></form>';
    openModal(kinds[a.type].name, content);
    if (["music", "video"].includes(a.type)) {
      const player = $(".task-media");
      let busy = false;
      const ping = async (final = false) => {
        if (
          busy ||
          (!final && (player.paused || player.ended)) ||
          document.hidden ||
          player.playbackRate !== 1 ||
          player.seeking ||
          player.readyState < 2
        )
          return;
        busy = true;
        try {
          const r = await api("/attempts/" + a.id + "/heartbeat", {});
          $("#play-time").textContent =
            `${r.seconds} / ${r.required} seconds recorded`;
          $("#play-progress").style.width =
            (r.seconds / r.required) * 100 + "%";
        } catch (e) {
          toast(e.message);
        } finally {
          busy = false;
        }
      };
      player.addEventListener("play", () => ping());
      player.addEventListener("ended", () => ping(true));
      timer = setInterval(() => ping(), 3000);
      player.addEventListener("error", () =>
        toast("This media file could not load. Please try again later."),
      );
    }
    bindForm("#task-form", async (data) => {
      const payload =
        a.type === "quiz"
          ? { answers: c.questions.map((_, i) => Number(data["q" + i])) }
          : data;
      const result = await api("/attempts/" + a.id + "/submit", payload);
      closeModal();
      toast(
        result.status === "approved"
          ? "Quiz passed. Your reward is in your wallet."
          : result.status === "pending"
            ? "Submitted. You can track the review in Activity."
            : result.note || "Attempt completed.",
      );
      await render();
    });
  } catch (e) {
    toast(e.message);
  }
}
async function walletPage() {
  const w = await api("/wallet");
  $("#view").innerHTML =
    heading(
      "YOUR MONEY",
      "Wallet & withdrawals.",
      "Your approved rewards, withdrawal requests and saved bank account.",
    ) +
    `<div class="wallet-grid"><section class="balance-feature wallet-balance"><div class="row"><span>Available to withdraw</span>${icon("wallet")}</div><strong class="balance-amount">${money(w.balance)}</strong><p>Minimum withdrawal · ${money(w.minimum)}</p><button class="button light" id="withdraw" ${w.balance < w.minimum ? "disabled" : ""}>Request withdrawal ${icon("arrow")}</button><small>Withdrawal holds of ${money(w.held)} are already excluded.</small></section><section class="bank-preview panel glass"><div class="section-title"><span class="eyebrow">SAVED PAYOUT ACCOUNT</span>${w.bank ? '<span class="pill">Saved</span>' : ""}</div>${bankPreview(w.bank)}<button class="button secondary small" id="edit-bank">${w.bank ? "Edit bank details" : "Add bank account"}</button><p class="fine">Details you provide are reviewed for payout. Account names are not automatically verified with your bank.</p></section></div>
    <div class="withdrawal-guide"><span>${icon("reviews")} Request submitted</span>${icon("arrow")}<span>${icon("account")} Admin review</span>${icon("arrow")}<span>${icon("bank")} Bank transfer</span></div>
    <section class="panel glass"><div class="section-title"><h2>Withdrawal history</h2><span class="period-label">Latest 100 requests</span></div>${table(
      ["Requested", "Amount", "Destination", "Status"],
      w.withdrawals.map((x) => [
        date(x.created),
        `<strong>${money(x.amount)}</strong>`,
        esc(x.bank) +
          "<small>•••• " +
          esc(x.account.slice(-4)) +
          " · " +
          esc(x.account_name) +
          "</small>",
        badge(x.status) + "<small>" + esc(x.note || "") + "</small>",
      ]),
    )}</section><section class="panel glass"><div class="section-title"><h2>Wallet transactions</h2><span class="period-label">Latest 200 entries</span></div>${table(
      ["Date", "Description", "Amount"],
      w.ledger.map((x) => [
        date(x.created),
        esc(x.reason),
        `<strong class="${x.amount > 0 ? "positive" : ""}">${x.amount > 0 ? "+" : ""}${money(x.amount)}</strong>`,
      ]),
    )}</section>`;
  $("#edit-bank").onclick = () => editBank(w.bank);
  $("#withdraw").onclick = () => {
    if (!w.bank) {
      editBank(null);
      return;
    }
    const key = crypto.randomUUID();
    openModal(
      "Request a withdrawal",
      `<p class="modal-note">Available ${money(w.balance)} · Minimum ${money(w.minimum)}</p><div class="destination-review"><span class="eyebrow">CONFIRM YOUR DESTINATION</span><strong>${esc(w.bank.bank)} · ${esc(w.bank.account)}</strong><p>${esc(w.bank.account_name)}</p></div><form id="withdraw-form">${field("Amount (₦)", "amount", "number", "", `required min="${w.minimum / 100}" max="${w.balance / 100}" step="0.01"`)}<label class="check-field"><input type="checkbox" required> I have checked the bank details above.</label><p class="fine">Your request is reviewed before an administrator makes the transfer.</p>${status()}<button class="button full" type="submit">Confirm withdrawal request</button></form>`,
    );
    bindForm("#withdraw-form", async (data) => {
      await api("/withdrawals", {
        amount: naira(data.amount),
        key,
        use_saved: true,
        bank_version: w.bank.version,
      });
      closeModal();
      toast("Withdrawal requested. Your funds are reserved.");
      await walletPage();
    });
  };
}
function editBank(bank) {
  openModal(
    bank ? "Edit bank account" : "Add bank account",
    `<p class="modal-note">Save an account in your own name. These details will be used for future withdrawal requests.</p><form id="bank-form">${field("Bank name", "bank", "text", bank?.bank || "", 'required minlength="2" maxlength="100" autocomplete="off"')}${field("Account number", "account", "text", bank?.account || "", 'required pattern="[0-9]{10}" inputmode="numeric" maxlength="10" autocomplete="off"')}${field("Account holder name", "account_name", "text", bank?.account_name || "", 'required minlength="3" maxlength="150"')}${field("Confirm your TUNEVA password", "password", "password", "", 'required maxlength="128" autocomplete="current-password"')}<p class="fine">Changes apply to future requests. Existing withdrawals keep their original bank details.</p>${status()}<button class="button full" type="submit">Save bank account</button></form>`,
  );
  bindForm("#bank-form", async (data) => {
    await api("/wallet/bank", { ...data, version: bank?.version || null });
    closeModal();
    toast("Your bank account is saved.");
    await walletPage();
  });
}
function table(headers, rows) {
  return rows.length
    ? `<div class="table-wrap"><table class="table"><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => "<tr>" + row.map((v) => "<td>" + v + "</td>").join("") + "</tr>").join("")}</tbody></table></div>`
    : '<div class="empty">Nothing here yet.</div>';
}
async function activityPage() {
  const rows = await api("/activity");
  $("#view").innerHTML =
    heading(
      "EVERY CONTRIBUTION COUNTS",
      "Your activity, <em>at a glance.</em>",
      "Follow submissions from started to reviewed.",
    ) +
    `<section class="panel glass">${table(
      ["Task", "Submitted", "Reward", "Status", "Review note"],
      rows.map((a) => [
        "<strong>" +
          esc(a.title) +
          "</strong><small>" +
          kinds[a.type].name +
          "</small>",
        date(a.created),
        money(a.reward),
        badge(a.status),
        esc(a.note || "—"),
      ]),
    )}</section>`;
}
function goToSquad(checkout) {
  const url = new URL(checkout.checkout_url);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(url.hostname === "squadco.com" || url.hostname.endsWith(".squadco.com"))
  )
    throw Error("Unexpected checkout address. Please contact support.");
  location.assign(url.href);
}
const checkedPaymentReturns = new Set();
async function verifyPayment(ref) {
  await api("/payments/" + encodeURIComponent(ref) + "/verify", {});
  toast("Payment verified. Your plan is active.");
  await render();
}
async function accountPage() {
  const returnRef = new URL(location.href).searchParams.get("payment_ref");
  if (
    returnRef &&
    /^PAY[a-f0-9]{32}$/.test(returnRef) &&
    !checkedPaymentReturns.has(returnRef)
  ) {
    checkedPaymentReturns.add(returnRef);
    try {
      await api("/payments/" + encodeURIComponent(returnRef) + "/verify", {});
      me = await api("/me");
      const clean = new URL(location.href);
      clean.searchParams.delete("payment_ref");
      history.replaceState(
        null,
        "",
        clean.pathname + clean.search + clean.hash,
      );
      toast("Payment verified. Your plan is active.");
    } catch (error) {
      toast(error.message + " Use Check existing payment if you have paid.");
    }
  }
  const pending = await api("/payments/pending");
  $("#view").innerHTML =
    heading(
      "MAKE YOURSELF AT HOME",
      me.user.active && me.user.verified
        ? "Your <em>account.</em>"
        : "Activate your <em>account.</em>",
      me.user.active && me.user.verified
        ? "Manage your plan and account access."
        : "Verify your email and complete your plan payment to unlock your workspace.",
    ) +
    `<div class="wallet-grid"><section class="panel glass"><div class="row"><h2>${esc(me.user.name)}</h2><span class="avatar">${esc(initials(me.user.name))}</span></div><p class="subtle">${esc(me.user.email)}<br>${esc(me.user.phone)}</p><div class="mini-item"><strong>Email verification</strong>${badge(me.user.verified ? "approved" : "pending")}</div><div class="mini-item"><strong>${esc(config.plans[me.user.plan].name)}</strong>${badge(me.user.active ? "active" : "pending")}</div>${!me.user.verified ? '<button class="button secondary full" id="resend">Resend verification email</button>' : ""}<div class="actions dialog-footer"><button class="button secondary small" id="change-password">Change password</button><button class="button secondary small" id="logout-others">Sign out other devices</button><button class="button secondary small" id="logout">Sign out</button></div></section><section class="panel glass"><span class="eyebrow">YOUR MEMBERSHIP</span><h2>${esc(config.plans[me.user.plan].name)}</h2><p class="plan-price">${money(config.plans[me.user.plan].price)} <small>activation</small></p><p class="subtle">${me.user.active ? "Your membership payment is confirmed. Complete email verification to access tasks if you have not already done so." : "Activate your membership to begin eligible tasks. Payment activates access; task rewards depend on available work and successful completion."}</p>${me.user.active ? (me.user.verified ? '<a class="button" href="#tasks">Explore tasks <span class="arrow" aria-hidden="true"></span></a>' : '<p class="notice">Payment confirmed. Verify your email to unlock your workspace.</p>') : config.demo ? '<button class="button" id="demo-activate">Activate demo plan</button>' : `<button class="button" id="pay" ${!me.user.verified || !config.paymentReady ? "disabled" : ""}>${pending ? "Continue payment" : "Pay with Squad"} <span class="arrow" aria-hidden="true"></span></button>${!config.paymentReady ? '<p class="fine">Payments are not available yet. Please check back.</p>' : ""}`}<p class="error" id="payment-message" role="status"></p>${pending ? `<p class="fine">Payment reference: ${esc(pending.reference)}</p><button id="check-payment" class="button secondary small">Check existing payment</button>${(pending.earlierReferences || []).map((ref) => `<p class="fine">Earlier reference: ${esc(ref)}</p><button type="button" class="button secondary small" data-earlier-payment="${esc(ref)}">Check earlier payment</button>`).join("")}` : ""}</section></div>`;
  $("#change-password").onclick = () => {
    openModal(
      "Change your password",
      `<p class="modal-note">Changing your password signs you out on all devices.</p><form id="password-form">${field("Current password", "currentPassword", "password", "", 'required autocomplete="current-password" maxlength="128"')}${field("New password", "password", "password", "", 'required autocomplete="new-password" minlength="12" maxlength="128"')}${field("Confirm new password", "confirmPassword", "password", "", 'required autocomplete="new-password" minlength="12" maxlength="128"')}${status()}<button class="button full" type="submit">Update password</button></form>`,
    );
    bindForm("#password-form", async (data) => {
      if (data.password !== data.confirmPassword)
        throw Error("Your new passwords do not match.");
      await api("/auth/password", {
        currentPassword: data.currentPassword,
        password: data.password,
      });
      closeModal();
      me = null;
      location.hash = "login";
      toast("Password updated. Sign in again.");
    });
  };
  $("#logout-others").onclick = async () => {
    try {
      await api("/auth/logout-others", {});
      toast("Other devices have been signed out.");
    } catch (e) {
      toast(e.message);
    }
  };
  $("#logout").onclick = async () => {
    try {
      await api("/auth/logout", {});
      me = null;
      location.hash = "login";
    } catch (e) {
      toast(e.message);
    }
  };
  if ($("#resend"))
    $("#resend").onclick = async () => {
      try {
        await api("/auth/resend", {});
        toast(
          "Verification email requested. Check your inbox and spam folder.",
        );
      } catch (e) {
        toast(e.message);
      }
    };
  if ($("#demo-activate"))
    $("#demo-activate").onclick = async () => {
      await api("/demo/activate", {});
      await render();
    };
  if ($("#check-payment"))
    $("#check-payment").onclick = async () => {
      try {
        await verifyPayment(pending.reference);
      } catch (e) {
        $("#payment-message").textContent = e.message;
      }
    };
  $$("[data-earlier-payment]").forEach((button) => {
    button.onclick = async () => {
      button.disabled = true;
      try {
        await verifyPayment(button.dataset.earlierPayment);
      } catch (error) {
        $("#payment-message").textContent = error.message;
        button.disabled = false;
      }
    };
  });
  if ($("#pay"))
    $("#pay").onclick = async () => {
      const button = $("#pay");
      button.disabled = true;
      try {
        const checkout = await api("/payments/create", {});
        if (checkout.busy) {
          throw Error(
            "Your checkout is still being prepared. Wait a moment, then continue payment.",
          );
        }
        if (checkout.needsReplacement) {
          button.disabled = false;
          openModal(
            "Your earlier payment",
            `${checkout.renewalDue ? "<p>Your checkout was opened at least 20 hours ago. If you have not paid, you can request fresh payment details.</p>" : "<p>Your earlier checkout is unavailable.</p>"}<p><strong>Already paid or debited?</strong> Close this message and select Check existing payment. Do not pay again.</p><p>Otherwise, open a new checkout and use only its payment details. Your earlier reference remains available for verification.</p><p class="error" id="replacement-error" role="status"></p><button type="button" class="button full" id="replace-checkout">I haven't paid — open new checkout</button>`,
          );
          $("#replace-checkout").onclick = async () => {
            const replaceButton = $("#replace-checkout");
            replaceButton.disabled = true;
            try {
              const next = await api("/payments/create", {
                replacePending: true,
                reference: checkout.transaction_ref,
              });
              if (!next.checkout_url)
                throw Error(
                  "Checkout is not ready. Close this message and check your existing payment.",
                );
              goToSquad(next);
            } catch (error) {
              $("#replacement-error").textContent = error.message;
              replaceButton.disabled = false;
            }
          };
          return;
        }
        goToSquad(checkout);
      } catch (e) {
        $("#payment-message").textContent = e.message;
        button.disabled = false;
      }
    };

  // Referral section – show for members once they have a code
  const refCode = me?.referral?.code || null;
  if (refCode) {
    const link = `https://tunevaconnect.top/app.html#signup?ref=${refCode}`;
    const refCard = document.createElement("section");
    refCard.className = "panel glass";
    refCard.style.marginTop = "20px";
    refCard.innerHTML = `
      <div class="section-title"><div><span class="eyebrow">INVITE & EARN</span><h2>Your referral link</h2></div></div>
      <p class="subtle">Share this link. When someone joins and activates a plan, you earn <strong>50%</strong> of their activation fee.</p>
      <div class="mini-item" style="word-break:break-all"><strong>${esc(link)}</strong></div>
      <div class="actions" style="margin-top:12px">
        <button class="button secondary small" id="copy-ref">Copy link</button>
      </div>
      <div class="mini-item" style="margin-top:16px"><strong>People referred</strong> ${me.referral?.count || 0}</div>
      <div class="mini-item"><strong>Commission earned</strong> ${money(me.referral?.earned || 0)}</div>
    `;
    const view = $("#view");
    if (view) view.appendChild(refCard);
    const copyBtn = $("#copy-ref");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(link);
          toast("Referral link copied");
        } catch {
          toast("Copy failed. Select and copy the link manually.");
        }
      };
    }
  }
}
async function authPage(mode, detail) {
  const signup = mode === "signup",
    forgot = mode === "forgot",
    reset = mode === "reset",
    verify = mode === "verify";
  if (verify) {
    $("#app").innerHTML =
      '<div class="auth-wrap"><section class="auth-card glass"><h2>Verify your email</h2><p>Confirm your email address to continue.</p><button class="button" id="verify-email">Verify email</button><p class="error" id="verify-result"></p><a class="text-link" href="#account">Return to your account <span class="arrow" aria-hidden="true"></span></a></section></div>';
    $("#verify-email").onclick = async () => {
      try {
        await api("/auth/verify", { token: detail });
        toast("Your email is verified.");
        location.hash = "account";
      } catch (e) {
        $("#verify-result").textContent = e.message;
      }
    };
    return;
  }
  if (signup && config.registrationOpen === false) {
    $("#app").innerHTML =
      `<div class="auth-wrap"><section class="auth-card glass"><a class="brand" href="/">tuneva.</a><h2>Registration opens soon.</h2><p>We’re getting everything ready. Please check back soon.</p><a class="button" href="#login">Sign in</a></section></div>`;
    return;
  }
  const title = signup
    ? "Your next chapter starts here."
    : forgot
      ? "Let’s get you back in."
      : reset
        ? "Choose a new password."
        : "Good to see you again.";
  $("#app").innerHTML =
    `<div class="auth-wrap"><section class="auth-copy"><a class="brand" href="/"><span>T</span> tuneva.</a><span class="eyebrow">YOUR EVERYDAY POTENTIAL</span><h1>A little curiosity.<br>A world of<br><em>possibility.</em></h1><p>Join a community that makes room<br>for your knowledge, language and perspective.</p><div class="auth-art" aria-hidden="true">✳︎ ◒</div></section><section class="auth-card glass"><h2>${title}</h2><p>${signup ? "Create your account and choose your starting point." : forgot ? "Enter your email to request a password reset link." : reset ? "Use a unique password with at least 12 characters." : "Sign in to your TUNEVA workspace."}</p><form id="auth-form">${signup ? field("Full name", "name", "text", "", 'required autocomplete="name" minlength="2" maxlength="100"') : ""}${!reset ? field("Email address", "email", "email", "", 'required autocomplete="email" maxlength="254"') : ""}${signup ? field("Phone number", "phone", "tel", "", 'required autocomplete="tel" minlength="7" maxlength="24"') : ""}${!forgot ? field("Password", "password", "password", "", 'required minlength="12" maxlength="128" autocomplete="' + (signup || reset ? "new-password" : "current-password") + '"') : ""}${signup ? `<div class="field plan-chooser"><span>Choose your plan</span><button type="button" class="button secondary full" id="plan-toggle" style="margin-top:8px">Select a membership plan</button><div id="plan-options" style="display:none;margin-top:14px;gap:12px;flex-direction:column"><label class="plan-card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid #e5e0f0;border-radius:14px;cursor:pointer"><input type="radio" name="plan" value="pro" ${detail === "pro" ? "checked" : ""} required style="accent-color:#6d28d9"><div><strong>Pro</strong> · ₦9,000 activation</div></label><label class="plan-card recommended" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:2px solid #6d28d9;border-radius:14px;cursor:pointer;background:#f8f5ff;position:relative"><input type="radio" name="plan" value="max" ${detail === "max" || !detail ? "checked" : ""} required style="accent-color:#6d28d9"><div><span style="font-size:11px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:.04em">Recommended</span><br><strong>Max</strong> · ₦14,000 activation</div></label></div><p class="fine">Membership provides access to eligible funded tasks. Rewards vary by task; completing signup does not generate earnings.</p></div>` : ""}
${status()}<button type="submit" class="button">${signup ? 'Create account <span class="arrow" aria-hidden="true"></span>' : forgot ? "Send reset link" : reset ? "Update password" : 'Sign in <span class="arrow" aria-hidden="true"></span>'}</button></form><p class="auth-bottom">${signup ? 'Already a member? <a href="#login">Sign in</a>' : forgot || reset ? '<a href="#login">Back to sign in</a>' : 'New here? <a href="#signup">Create an account</a><br><br><a href="#forgot">Forgot your password?</a>'}</p>${config.demo && !signup && !forgot && !reset ? '<div class="demo-accounts">Try the demo · no real payments or money.<br><button data-demo="member">Use member account</button> · <button data-demo="admin">Use admin account</button><br>Password: TunevaDemo2026!</div>' : ""}</section></div>`;
  for (const b of $$("[data-demo]"))
    b.onclick = () => {
      $("[name=email]").value = b.dataset.demo + "@tuneva.demo";
      $("[name=password]").value = "TunevaDemo2026!";
    };
  const planToggle = $("#plan-toggle");
  const planOptions = $("#plan-options");
  if (planToggle && planOptions) {
    planToggle.onclick = () => {
      planOptions.style.display = planOptions.style.display === "none" ? "flex" : "none";
      planToggle.textContent = planOptions.style.display === "none" ? "Select a membership plan" : "Hide plans";
    };
  }
  bindForm("#auth-form", async (data) => {
    let referral_code = null;
    if (signup) {
      try {
        // Referral URLs use the app hash route (#signup?ref=CODE), so
        // location.search alone does not contain the referral query.
        const hashQuery = location.hash.includes("?")
          ? location.hash.slice(location.hash.indexOf("?") + 1)
          : "";
        const params = new URLSearchParams(hashQuery || location.search);
        referral_code =
          params.get("ref") || localStorage.getItem("tuneva_ref") || null;
        if (params.get("ref"))
          localStorage.setItem("tuneva_ref", params.get("ref"));
      } catch {}
    }
    const result = await api("/auth/" + mode, {
      ...data,
      ...(reset ? { token: detail } : {}),
      ...(signup && referral_code ? { referral_code } : {}),
    });
    if (forgot) {
      $(".form-status").textContent = result.message;
      return;
    }
    if (reset) {
      toast("Password updated. Sign in with your new password.");
      location.hash = "login";
      return;
    }
    if (signup && !result.emailSent && !config.demo)
      toast("Account created. Open Account to resend your verification email.");
    location.hash = "dashboard";
  });
}
function adminTabs(section) {
  return `<div class="filter-bar admin-tabs">${["overview", "tasks", "reviews", "withdrawals", "payments", "members", "broadcast", "system", "audit"].map((k) => `<a class="filter ${section === k ? "active" : ""}" href="#admin/${k}">${k[0].toUpperCase() + k.slice(1)}</a>`).join("")}</div>`;
}
async function adminPage(section = "overview") {
  if (me.user.role !== "admin") {
    location.hash = "dashboard";
    return;
  }
  $("#view").innerHTML =
    heading(
      "MANAGEMENT CONSOLE",
      section === "overview"
        ? "Your platform, at a glance."
        : esc(adminSections.find((x) => x[0] === section)?.[2] || "Overview") +
            ".",
      section === "overview"
        ? "A clear view of your members, commitments and next decisions."
        : "Manage your platform with every action accounted for.",
    ) +
    adminTabs(section) +
    '<div id="admin-content"></div>';
  const root = $("#admin-content");
  if (section === "overview") {
    const o = await api("/admin/overview");
    const b = o.budgets,
      remaining = Math.max(0, b.allocated - b.reserved - b.spent);
    const published =
      o.taskCounts.find((t) => t.status === "published")?.n || 0;
    root.innerHTML = `<div class="overview-metrics admin-metrics">${stat("Registered members", o.members, `${o.activeMembers} active and unrestricted`, icon("members"))}${stat("Confirmed receipts", money(o.confirmedReceipts), "All confirmed membership payments", icon("wallet"))}${stat("Review queue", o.pending, "Task submissions awaiting a decision", icon("reviews"))}${stat("Withdrawal queue", o.withdrawalQueue, money(o.held) + " reserved for payout", icon("bank"))}</div>
    <div class="workspace-grid"><div class="primary-column"><section class="panel glass chart-panel"><div class="section-title"><div><span class="eyebrow">PAYMENT ACTIVITY</span><h2>Confirmed receipts</h2></div><span class="period-label">Last 7 days</span></div>${weekChart(o.recentReceipts, "Receipts")}<p class="fine">Grouped by payment creation date. Receipts are not profit or a bank balance.</p></section>
    <section class="panel glass"><div class="section-title"><div><span class="eyebrow">YOUR COMMUNITY</span><h2>Newest members</h2></div><a class="text-link" href="#admin/members">Manage members ${icon("arrow")}</a></div>${table(
      ["Member", "Plan", "Joined", "Access"],
      o.recentMembers.map((u) => [
        `<div class="person-cell"><span class="avatar">${esc(initials(u.name))}</span><div><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div></div>`,
        esc(u.plan.toUpperCase()),
        date(u.created),
        badge(u.disabled ? "disabled" : u.active ? "active" : "pending"),
      ]),
    )}</section></div>
    <aside class="secondary-column"><section class="action-center panel glass"><span class="eyebrow">NEEDS YOUR ATTENTION</span><h2>Next decisions</h2><a class="action-row" href="#admin/reviews"><span class="activity-icon">${icon("reviews")}</span><div><strong>Review submissions</strong><small>${o.pending} waiting for review</small></div>${icon("arrow")}</a><a class="action-row" href="#admin/withdrawals"><span class="activity-icon mint">${icon("bank")}</span><div><strong>Manage withdrawals</strong><small>${o.withdrawalQueue} awaiting completion</small></div>${icon("arrow")}</a><a class="action-row" href="#admin/tasks"><span class="activity-icon peach">${icon("tasks")}</span><div><strong>Publish opportunities</strong><small>${published} tasks currently published</small></div>${icon("arrow")}</a></section>
    <section class="panel glass budget-card"><div class="section-title"><span class="eyebrow">TASK BUDGETS</span>${icon("tasks")}</div><strong class="budget-total">${money(b.allocated)}</strong><p class="fine">Total allocated across all tasks</p><meter min="0" max="${Math.max(b.allocated, 1)}" value="${b.reserved + b.spent}" aria-label="Committed and spent task budget"></meter><dl class="finance-breakdown"><div><dt>Uncommitted</dt><dd>${money(remaining)}</dd></div><div><dt>Reserved for tasks</dt><dd>${money(b.reserved)}</dd></div><div><dt>Rewards credited</dt><dd>${money(b.spent)}</dd></div></dl><a href="#admin/tasks" class="button secondary full small">Manage budgets ${icon("arrow")}</a><p class="fine">Budget allocations do not represent money held in a bank account.</p></section>
    <section class="commitment-card"><span class="eyebrow">MEMBER COMMITMENTS</span><div class="row"><span>Available wallets</span><strong>${money(o.liability)}</strong></div><div class="row"><span>Withdrawal holds</span><strong>${money(o.held)}</strong></div><p>Keep both amounts covered when planning payouts.</p></section></aside></div>`;
  } else if (section === "tasks") {
    const tasks = await api("/admin/tasks");
    root.innerHTML = `<div class="section-title"><h2>Your task library</h2><button class="button small" id="create-task">＋ Create task</button></div><section class="panel glass">${table(
      ["Task", "Pro / Max reward", "Budget / available", "Status", "Manage"],
      tasks.map((t) => [
        "<strong>" +
          esc(t.title) +
          "</strong><small>" +
          kinds[t.type].name +
          " · " +
          esc(t.sponsor) +
          "</small>",
        money(t.pro_reward) + " / " + money(t.max_reward),
        money(t.budget) +
          "<small>" +
          money(t.budget - t.spent - t.reserved) +
          " available</small>",
        badge(t.status),
        `<div class="actions"><button class="button secondary" data-task-action="${t.status === "published" ? "pause" : "publish"}" data-id="${t.id}">${t.status === "published" ? "Pause" : "Publish"}</button><button class="button secondary" data-task-action="rewards" data-id="${t.id}">Rewards</button><button class="button secondary" data-task-action="fund" data-id="${t.id}">Add budget</button></div>`,
      ]),
    )}</section><p class="fine">Zero reward excludes that plan. Changes to rewards apply only to new starts. Started tasks keep their reserved amount. A published task permits one attempt per member; create a new task for a fresh round.</p>`;
    $("#create-task").onclick = createTaskModal;
    for (const b of $$("[data-task-action]"))
      b.onclick = () => {
        const t = tasks.find((t) => t.id === b.dataset.id),
          action = b.dataset.taskAction;
        if (action === "pause" || action === "publish") {
          api("/admin/tasks/" + t.id, { action })
            .then(() => adminPage("tasks"))
            .catch((e) => toast(e.message));
          return;
        }
        openModal(
          action === "fund" ? "Add task budget" : "Update task rewards",
          `<p class="modal-note">${esc(t.title)}. ${action === "fund" ? "Record money allocated from your available funding." : "Existing reservations keep their original reward."}</p><form id="task-edit">${action === "fund" ? field("Additional budget (₦)", "amount", "number", "", 'required min="0.01" step="0.01"') + field("Funding reference / note", "note", "text", "", 'required minlength="3" maxlength="300"') : field("Pro reward (₦; zero excludes Pro)", "pro_reward", "number", t.pro_reward / 100, 'required min="0" step="0.01"') + field("Max reward (₦; zero excludes Max)", "max_reward", "number", t.max_reward / 100, 'required min="0" step="0.01"')}${status()}<button class="button full" type="submit">Save changes</button></form>`,
        );
        bindForm("#task-edit", async (data) => {
          await api("/admin/tasks/" + t.id, {
            ...data,
            action,
            ...(action === "fund"
              ? { amount: naira(data.amount) }
              : {
                  pro_reward: naira(data.pro_reward),
                  max_reward: naira(data.max_reward),
                }),
          });
          closeModal();
          await adminPage("tasks");
        });
      };
  } else if (section === "reviews") {
    const rows = await api("/admin/reviews");
    root.innerHTML =
      rows
        .map((a) => {
          const submission = JSON.parse(a.submission);
          return `<article class="review-card glass"><div class="row"><div><h3>${esc(a.title)}</h3><p class="fine">${esc(a.name)} · ${esc(a.email)} · ${date(a.created)}</p></div><span class="pill purple">${money(a.reward)} reserved</span></div><div class="submission-data">${Object.entries(
            submission,
          )
            .map(
              ([k, v]) => `<div><span>${esc(k)}</span><p>${esc(v)}</p></div>`,
            )
            .join(
              "",
            )}</div><div class="actions"><button class="button small" data-review="${a.id}" data-approve="true">Approve reward</button><button class="button danger small" data-review="${a.id}" data-approve="false">Reject submission</button></div></article>`;
        })
        .join("") ||
      '<section class="glass empty">You’re all caught up. New submissions will appear here.</section>';
    for (const b of $$("[data-review]"))
      b.onclick = () => {
        const approve = b.dataset.approve === "true";
        decisionModal(
          approve ? "Approve this reward?" : "Reject this submission?",
          `Your note will be visible to the member. ${approve ? "Approval credits the reserved reward once." : "Rejection releases the reservation back to the task budget."}`,
          async (data) => {
            await api("/admin/reviews/" + b.dataset.review, {
              approve,
              ...data,
            });
            await adminPage("reviews");
          },
        );
      };
  } else if (section === "withdrawals") {
    const rows = await api("/admin/withdrawals");
    root.innerHTML =
      '<div class="notice">Approving reserves the request for payment. Make the bank transfer separately, then record its unique bank reference using “Mark transferred”. This application does not send bank transfers.</div>' +
      `<section class="panel glass">${table(
        ["Member", "Amount", "Bank details", "Status", "Action"],
        rows.map((w) => [
          "<strong>" +
            esc(w.name) +
            "</strong><small>" +
            esc(w.email) +
            "</small>",
          money(w.amount),
          esc(w.bank) +
            "<small>" +
            esc(w.account) +
            "<br>" +
            esc(w.account_name) +
            "</small>",
          badge(w.status) +
            "<small>" +
            esc(w.transfer_ref || w.note || "") +
            "</small>",
          w.status === "pending"
            ? `<div class="actions"><button class="button secondary" data-payout="${w.id}" data-action="approve">Approve</button><button class="button danger" data-payout="${w.id}" data-action="reject">Reject</button></div>`
            : w.status === "approved"
              ? `<button class="button secondary" data-payout="${w.id}" data-action="paid">Mark transferred</button>`
              : "—",
        ]),
      )}</section>`;
    for (const b of $$("[data-payout]"))
      b.onclick = () =>
        decisionModal(
          b.dataset.action === "paid"
            ? "Record completed bank transfer"
            : "Confirm withdrawal decision",
          b.dataset.action === "paid"
            ? "Only continue after the transfer has succeeded in your bank. Enter the unique bank transaction reference."
            : "Approval does not transfer money. Rejection returns the reserved amount to the member’s available balance.",
          async (data) => {
            await api("/admin/withdrawals/" + b.dataset.payout, {
              action: b.dataset.action,
              ...data,
            });
            await adminPage("withdrawals");
          },
          b.dataset.action === "paid",
        );
  } else if (section === "members") {
    const rows = await api("/admin/members");
    root.innerHTML = `<section class="panel glass">${table(
      ["Member", "Plan", "Membership", "Email", "Manage"],
      rows.map((u) => [
        "<strong>" +
          esc(u.name) +
          "</strong><small>" +
          esc(u.email) +
          "</small>",
        esc(u.plan.toUpperCase()),
        badge(u.disabled ? "disabled" : u.active ? "active" : "pending"),
        badge(u.verified ? "verified" : "pending"),
        u.id === me.user.id
          ? "You"
          : u.role === "admin"
            ? "Administrator"
            : `<div class="actions">${!u.active && !u.disabled ? `<button class="button" data-activate-member="${u.id}">Activate manually</button>` : ""}<button class="button secondary" data-member="${u.id}" data-disabled="${!u.disabled}">${u.disabled ? "Enable" : "Disable"}</button></div>`,
      ]),
    )}</section>`;
    root.insertAdjacentHTML(
      "afterbegin",
      `<label class="search-field">${icon("search")}<input id="member-search" type="search" placeholder="Search members by name or email" aria-label="Search members"></label>`,
    );
    $("#member-search").oninput = (event) => {
      const term = event.target.value.toLowerCase();
      $$(".table tbody tr", root).forEach(
        (row) => (row.hidden = !row.textContent.toLowerCase().includes(term)),
      );
    };
    for (const b of $$("[data-member]"))
      b.onclick = () =>
        decisionModal(
          "Update member access",
          "Restricting an account signs the member out and blocks new submissions and withdrawals.",
          async (data) => {
            await api("/admin/members/" + b.dataset.member, {
              disabled: b.dataset.disabled === "true",
              note: data.note,
            });
            await adminPage("members");
          },
        );
    for (const button of $$("[data-activate-member]"))
      button.onclick = () => {
        const member = rows.find((u) => u.id === button.dataset.activateMember);
        const price = config.plans[member.plan].price;
        openModal(
          "Confirm direct payment",
          `<p class="modal-note">${esc(member.name)} · ${esc(member.email)}<br>${esc(config.plans[member.plan].name)} · <strong>${money(price)}</strong></p><form id="manual-activation-form"><label class="field"><span>Payment method</span><select name="method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option></select></label>${field("Bank reference or unique receipt number", "reference", "text", "", 'required minlength="4" maxlength="100"')}${area("Confirmation note", "note", 'required minlength="3" maxlength="500"')}<label class="field"><span><input type="checkbox" name="confirmed" required> I have confirmed receipt of ${money(price)}.</span></label><p class="fine">This records a direct payment and activates membership. Email verification remains required.</p>${status()}<button class="button full" type="submit">Confirm payment & activate</button></form>`,
        );
        bindForm("#manual-activation-form", async (data) => {
          await api("/admin/members/" + member.id + "/activate", {
            ...data,
            amount: price,
          });
          closeModal();
          toast("Payment recorded. Membership activated.");
          await adminPage("members");
        });
      };
  } else if (section === "payments") {
    let page = 1;
    const load = async () => {
      const result = await api("/admin/payments?page=" + page);
      root.innerHTML = `<section class="panel glass"><div class="section-title"><div><span class="eyebrow">PAYMENT RECORDS</span><h2>Membership payments</h2></div><span class="pill purple">${result.count} records</span></div><p class="subtle">Check pending payments directly with Squad. Squad payments activate after server verification. Direct payments are recorded through Members → Activate manually.</p>${table(
        [
          "Member",
          "Plan / amount",
          "Reference",
          "Status",
          "Last check",
          "Action",
        ],
        result.rows.map((p) => [
          esc(p.name) + "<small>" + esc(p.email) + "</small>",
          esc(p.plan.toUpperCase()) + "<small>" + money(p.amount) + "</small>",
          esc(p.reference),
          badge(p.status),
          p.checked_at
            ? date(p.checked_at) + "<small>" + esc(p.result) + "</small>"
            : "Not checked yet",
          ["pending", "superseded"].includes(p.status)
            ? `<button class="button secondary small" data-payment="${esc(p.reference)}">Check with Squad</button>`
            : p.status === "paid"
              ? "Verified"
              : esc(p.status),
        ]),
      )}<div class="actions dialog-footer"><button class="button secondary small" id="previous-payments" ${page === 1 ? "disabled" : ""}>Previous</button><span>Page ${page} of ${Math.max(1, Math.ceil(result.count / 25))}</span><button class="button secondary small" id="next-payments" ${page * 25 >= result.count ? "disabled" : ""}>Next</button></div></section>`;
      $("#previous-payments").onclick = () => {
        page--;
        load().catch((e) => toast(e.message));
      };
      $("#next-payments").onclick = () => {
        page++;
        load().catch((e) => toast(e.message));
      };
      $$("[data-payment]").forEach(
        (button) =>
          (button.onclick = async () => {
            button.disabled = true;
            try {
              await api(
                "/admin/payments/" +
                  encodeURIComponent(button.dataset.payment) +
                  "/verify",
                {},
              );
              toast("Payment verified. Membership activated.");
            } catch (e) {
              toast(e.message);
            } finally {
              await load().catch((e) => toast(e.message));
            }
          }),
      );
    };
    await load();
  } else if (section === "broadcast") {
    const data = await api("/admin/broadcast");
    const history = data.history || [];

    root.innerHTML = `
      <div class="workspace-grid">
        <div class="primary-column">
          <section class="panel glass">
            <div class="section-title">
              <div>
                <span class="eyebrow">COMMUNICATION</span>
                <h2>Send a broadcast</h2>
              </div>
            </div>
            <p class="subtle">Send an email to registered members or to a custom list of addresses. Messages are delivered through your Brevo account.</p>
            <form id="broadcast-form">
              <label class="field">
                <span>Audience</span>
                <select name="audience" id="broadcast-audience">
                  <option value="all">All registered members</option>
                  <option value="active">Active & verified members only</option>
                  <option value="verified">All verified members</option>
                  <option value="unverified">Unverified members only</option>
                  <option value="custom">Custom email list</option>
                </select>
              </label>
              <div id="custom-emails-wrap" style="display:none">
                <label class="field">
                  <span>Email addresses (one per line, max 200)</span>
                  <textarea name="emails" rows="6" placeholder="person@example.com&#10;another@example.com" maxlength="12000"></textarea>
                </label>
              </div>
              <label class="field">
                <span>Subject</span>
                <input name="subject" type="text" required minlength="3" maxlength="180" placeholder="Important update from TUNEVA">
              </label>
              <label class="field">
                <span>Message</span>
                <textarea name="body" rows="10" required minlength="10" maxlength="8000" placeholder="Write your message here..."></textarea>
              </label>
              <p class="fine">Plain text is recommended. A simple branded HTML wrapper is applied automatically.</p>
              <div id="broadcast-status"></div>
              <button class="button" type="submit">Send broadcast</button>
            </form>
            <div class="notice" style="margin-top:16px">
              <strong>If sending fails:</strong> Check Admin → System for email status. 
              Make sure BREVO_API_KEY and EMAIL_FROM are set correctly on Render, 
              and that the sender address is verified in your Brevo account. 
              Always test first with a Custom list containing only your own email.
            </div>
          </section>
        </div>
        <aside class="secondary-column">
          <section class="panel glass">
            <div class="section-title">
              <span class="eyebrow">HISTORY</span>
              <h2>Recent broadcasts</h2>
            </div>
            ${
              history.length === 0
                ? '<p class="subtle">No broadcasts have been sent yet.</p>'
                : table(
                    ["When", "Subject", "Audience", "Result"],
                    history.map((h) => [
                      date(h.created),
                      esc(h.subject),
                      esc(h.audience),
                      `${h.accepted} sent · ${h.failed} failed`,
                    ]),
                  )
            }
          </section>
          <section class="panel glass">
            <p class="fine">Broadcasts are rate-limited and sent sequentially. Very large lists may take several minutes. Always test with a small custom list first.</p>
          </section>
        </aside>
      </div>
    `;

    const audienceSelect = $("#broadcast-audience");
    const customWrap = $("#custom-emails-wrap");
    audienceSelect.addEventListener("change", () => {
      customWrap.style.display =
        audienceSelect.value === "custom" ? "block" : "none";
    });

    $("#broadcast-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const status = $("#broadcast-status");
      const btn = form.querySelector('button[type="submit"]');
      const audience = form.audience.value;
      const subject = form.subject.value.trim();
      const body = form.body.value.trim();

      let emails = [];
      if (audience === "custom") {
        emails = form.emails.value
          .split(/[\n,;]+/)
          .map((v) => v.trim())
          .filter(Boolean);
        if (emails.length === 0) {
          status.innerHTML =
            '<p class="notice error">Enter at least one valid email address.</p>';
          return;
        }
      }

      btn.disabled = true;
      btn.textContent = "Sending…";
      status.innerHTML =
        '<p class="notice">Sending messages. This may take a moment…</p>';

      try {
        const result = await api("/admin/broadcast", {
          audience,
          subject,
          body,
          emails,
        });
        let extra = "";
        if (result.failed > 0 && result.lastError) {
          const r = result.lastError;
          if (r.reason === "configuration_missing") {
            extra =
              " Reason: BREVO_API_KEY or EMAIL_FROM is missing on the server.";
          } else if (r.reason === "provider_rejected") {
            extra = ` Reason: Brevo rejected the message (HTTP ${r.status || "?"} · ${r.code || "unknown"}). Check sender verification and credits in Brevo.`;
          } else if (r.reason === "network_or_timeout") {
            extra = " Reason: Network error or timeout reaching Brevo.";
          } else {
            extra = ` Reason: ${r.reason || "unknown"}`;
          }
        }
        status.innerHTML = `<p class="notice ${result.failed === 0 ? "success" : "error"}">Broadcast finished. ${result.accepted} accepted, ${result.failed} failed out of ${result.total}.${extra}</p>`;
        toast(
          `Broadcast finished · ${result.accepted} sent, ${result.failed} failed`,
        );
        setTimeout(() => adminPage("broadcast"), 1500);
      } catch (err) {
        status.innerHTML = `<p class="notice error">${esc(err.message)}</p>`;
        toast(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Send broadcast";
      }
    });
  } else if (section === "system") {
    const info = await api("/admin/system");
    root.innerHTML = `<section class="panel glass"><div class="section-title"><div><span class="eyebrow">PLATFORM SETUP</span><h2>Operating status</h2></div><span class="pill ${info.mode === "live" ? "green" : "amber"}">${esc(info.mode.toUpperCase())}</span></div><p class="subtle">These checks confirm configuration is present. Complete a real email and payment test before opening registration to customers.</p>${table(
      ["Setting", "Status", "Setup guidance"],
      info.checks.map((c) => [
        esc(c.label),
        badge(c.ok ? "configured" : "missing"),
        c.ok ? "Configuration present" : esc(c.detail),
      ]),
    )}<div class="notice">Payment recovery: ${info.backgroundChecks ? "Enabled while the server is awake — checks due payments in batches with retry delays." : "Inactive in demo or without payment credentials."}</div><p class="subtle">Database: <strong>${esc(info.database.engine)}</strong> · ${info.database.accounts} accounts<br>Email provider: <strong>${esc(info.emailDelivery?.status || "No attempt recorded")}</strong>${info.emailDelivery ? ` · ${date(info.emailDelivery.at)} · HTTP ${info.emailDelivery.httpStatus || "—"} · ${esc(info.emailDelivery.code || "—")}` : ""}<br><span class="fine">Accepted means Brevo accepted the request; check Brevo transactional logs for delivery.</span><br>Published tasks: <strong>${info.publishedTasks}</strong><br>Payout method: ${esc(info.payoutMethod)}.</p><p class="fine">API keys are managed in your server environment and are never displayed here. Backups need a scheduled job and an off-server copy. A configured path alone does not prove a backup exists.</p></section>`;
  } else if (section === "audit") {
    const rows = await api("/admin/audit");
    root.innerHTML = `<section class="panel glass">${table(
      ["When", "Action", "Target", "Details"],
      rows.map((a) => [
        date(a.created),
        esc(a.action),
        esc(a.target),
        esc(a.details),
      ]),
    )}</section>`;
  }
}
function decisionModal(title, description, action, reference = false) {
  openModal(
    title,
    `<p class="modal-note">${esc(description)}</p><form id="decision-form">${reference ? field("Bank transfer reference", "reference", "text", "", 'required minlength="4" maxlength="150"') : ""}${area("Decision note", "note", 'required minlength="3" maxlength="500"')}${status()}<button class="button full" type="submit">Confirm decision</button></form>`,
  );
  bindForm("#decision-form", async (data) => {
    await action(data);
    closeModal();
    toast("Decision saved.");
  });
}
function createTaskModal() {
  openModal(
    "Create a funded task",
    `<form id="create-form">${field("Task title", "title", "text", "", 'required minlength="3" maxlength="120"')}${area("Instructions for the member", "description", 'required minlength="10" maxlength="3000"')}<div class="fields-two"><label class="field"><span>Task type</span><select name="type" id="task-type">${Object.entries(
      kinds,
    )
      .map(([key, k]) => `<option value="${key}">${k.name}</option>`)
      .join(
        "",
      )}</select></label><label class="field"><span>Funding source</span><select name="source"><option value="business">Business budget</option><option value="advertiser">Advertiser budget</option></select></label></div>${field("Budget owner / advertiser", "sponsor", "text", "", 'required minlength="2" maxlength="150"')}<div class="fields-two">${field("Pro reward (₦)", "pro_reward", "number", "", 'required min="0" step="0.01"')}${field("Max reward (₦)", "max_reward", "number", "", 'required min="0" step="0.01"')}</div>${field("Allocated task budget (₦)", "budget", "number", "", 'required min="0.01" step="0.01"')}<p class="fine">Zero reward excludes a plan. Allocate only money you have available to fund these rewards.</p><div id="type-fields"></div>${status()}<button class="button full" type="submit">Save draft</button></form>`,
  );
  let count = 0;
  function addQuestion() {
    const i = count++;
    const box = document.createElement("div");
    box.className = "question";
    box.dataset.question = i;
    box.innerHTML =
      field(
        "Question " + (i + 1),
        "prompt" + i,
        "text",
        "",
        'required minlength="3" maxlength="500"',
      ) +
      [0, 1, 2]
        .map((n) =>
          field(
            "Option " + (n + 1),
            "option" + i + "_" + n,
            "text",
            "",
            'required maxlength="300"',
          ),
        )
        .join("") +
      `<label class="field"><span>Correct answer</span><select name="correct${i}"><option value="0">Option 1</option><option value="1">Option 2</option><option value="2">Option 3</option></select></label>`;
    $("#questions").append(box);
  }
  function typeFields() {
    count = 0;
    const type = $("#task-type").value;
    $("#type-fields").innerHTML =
      type === "quiz"
        ? field(
            "Passing score (%)",
            "pass",
            "number",
            70,
            'required min="1" max="100" step="1"',
          ) +
          '<div id="questions"></div><button id="add-question" class="button secondary small" type="button">＋ Add question</button><br><br>'
        : type === "language"
          ? '<p class="fine">Members will submit language, phrase, English translation and an explanation. You review each submission.</p>'
          : field(
              "Direct HTTPS media file URL",
              "url",
              "url",
              "",
              'required placeholder="https://…/video.mp4"',
            ) +
            field(
              "Required playback (seconds)",
              "seconds",
              "number",
              30,
              'required min="10" max="3600" step="1"',
            ) +
            field(
              "Question to answer after playback",
              "question",
              "text",
              "",
              'required minlength="5" maxlength="500"',
            ) +
            '<p class="fine">Use a direct MP4 / MP3 file URL that permits browser playback. YouTube and streaming-page links are not supported. You review the member’s answer before payment.</p>';
    if (type === "quiz") {
      addQuestion();
      $("#add-question").onclick = () => {
        if (count < 20) addQuestion();
        else toast("Maximum 20 questions.");
      };
    }
  }
  $("#task-type").onchange = typeFields;
  typeFields();
  bindForm("#create-form", async (data, form) => {
    const payload = {
      ...data,
      pro_reward: naira(data.pro_reward),
      max_reward: naira(data.max_reward),
      budget: naira(data.budget),
    };
    if (data.type === "quiz") {
      payload.pass = Number(data.pass);
      payload.questions = $$("[data-question]", form).map((q) => {
        const i = q.dataset.question;
        return {
          prompt: data["prompt" + i],
          options: [0, 1, 2].map((n) => data["option" + i + "_" + n]),
          correct: Number(data["correct" + i]),
        };
      });
    }
    if (["music", "video"].includes(data.type))
      payload.seconds = Number(data.seconds);
    await api("/admin/tasks", payload);
    closeModal();
    toast("Draft saved. Publish it when you’re ready.");
    await adminPage("tasks");
  });
}
async function render() {
  const version = ++routeVersion;
  closeModal();
  const hashRoute = (location.hash.slice(1) || "dashboard").split("?", 1)[0];
  let [page, detail] = hashRoute.split("/");
  try {
    if (["login", "signup", "forgot", "reset", "verify"].includes(page)) {
      await authPage(page, detail);
      return;
    }
    try {
      me = await api("/me");
    } catch (e) {
      if (e.status === 401) {
        location.hash = "login";
        return;
      }
      throw e;
    }
    if (version !== routeVersion) return;
    if (
      ![
        "dashboard",
        "tasks",
        "wallet",
        "activity",
        "account",
        "admin",
      ].includes(page)
    )
      page = "dashboard";
    if (me.user.role !== "admin" && (!me.user.active || !me.user.verified)) {
      page = "account";
      if (location.hash !== "#account")
        history.replaceState(null, "", "#account");
    }
    if (me.user.role === "admin" && page === "dashboard") {
      page = "admin";
      detail = "overview";
    }
    shell(page, detail);
    await {
      dashboard,
      tasks: taskList,
      wallet: walletPage,
      activity: activityPage,
      account: accountPage,
      admin: () => adminPage(detail),
    }[page]();
  } catch (e) {
    if ($("#view"))
      $("#view").innerHTML =
        `<section class="glass panel"><h2>We couldn’t open this view.</h2><p class="error">${esc(e.message)}</p><button class="button secondary" id="retry">Try again</button></section>`;
    else $("#app").innerHTML = '<p class="loading">' + esc(e.message) + "</p>";
    if ($("#retry")) $("#retry").onclick = render;
  }
}
window.addEventListener("hashchange", render);
(async () => {
  try {
    config = await api("/config");
    if (config.demo) {
      $("#demo-banner").hidden = false;
      $("#demo-banner").textContent =
        "DEMO WORKSPACE · Sample tasks and simulated balances. No real payments or payouts.";
    }
    if (!config.demo && config.mode === "sandbox") {
      $("#demo-banner").hidden = false;
      $("#demo-banner").textContent =
        "SANDBOX · Test payments and balances. This is not the live platform.";
    }
    await render();
  } catch (e) {
    $("#app").innerHTML = '<p class="loading">' + esc(e.message) + "</p>";
  }
})();
