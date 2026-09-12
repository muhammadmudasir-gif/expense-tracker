/* Expense Tracker — vanilla JS, localStorage only. */
"use strict";

const STORAGE_KEY = "expense-tracker:expenses";
const CATEGORY_COLORS = {
  Food: "#f59e0b",
  Transport: "#38c7ff",
  Education: "#a78bfa",
  Entertainment: "#f472b6",
  Health: "#4ade80",
  Other: "#8b949e",
};

let expenses = load();
let toastTimer = null;

/* ---------- storage ---------- */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

/* ---------- helpers ---------- */
const rs = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
const monthKey = (iso) => iso.slice(0, 7); // "2026-09"
const monthLabel = (key) => {
  const [y, m] = key.split("-");
  return new Date(y, m - 1, 1).toLocaleDateString("en", { month: "long", year: "numeric" });
};
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText =
      "position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);background:#4ade80;color:#04121b;" +
      "padding:.6rem 1.1rem;border-radius:8px;font-weight:700;opacity:0;transition:opacity .2s;z-index:99";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.opacity = 0), 1800);
}

/* ---------- form ---------- */
const form = document.getElementById("expense-form");
const amountEl = document.getElementById("amount");
const categoryEl = document.getElementById("category");
const noteEl = document.getElementById("note");
const dateEl = document.getElementById("date");
dateEl.value = new Date().toISOString().slice(0, 10);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat(amountEl.value);
  if (!amount || amount <= 0) return;
  if (!categoryEl.value) { categoryEl.focus(); return; }

  expenses.push({
    id: Date.now(),
    amount,
    category: categoryEl.value,
    note: noteEl.value.trim() || categoryEl.value,
    date: dateEl.value || new Date().toISOString().slice(0, 10),
  });
  save();
  form.reset();
  dateEl.value = new Date().toISOString().slice(0, 10);
  render();
  toast("Expense added ✓");
});

/* ---------- filters ---------- */
const filterMonth = document.getElementById("filter-month");
const filterCategory = document.getElementById("filter-category");
filterMonth.addEventListener("change", render);
filterCategory.addEventListener("change", render);

function visible() {
  return expenses.filter(
    (x) =>
      (!filterMonth.value || monthKey(x.date) === filterMonth.value) &&
      (!filterCategory.value || x.category === filterCategory.value)
  );
}

/* ---------- render ---------- */
function render() {
  renderMonths();
  const rows = visible();
  const currentMonth = new Date().toISOString().slice(0, 10);
  const cmKey = currentMonth.slice(0, 7);

  // summary — always for the selected month (or current if no filter)
  const scopeKey = filterMonth.value || cmKey;
  const monthRows = expenses.filter((x) => monthKey(x.date) === scopeKey);
  const total = monthRows.reduce((s, x) => s + x.amount, 0);
  document.getElementById("total-month").textContent = rs(total);
  document.getElementById("entry-count").textContent = monthRows.length;

  const byCat = {};
  for (const x of monthRows) byCat[x.category] = (byCat[x.category] || 0) + x.amount;
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("top-category").textContent = top ? top[0] : "—";

  drawChart(byCat);
  renderList(rows);
}

function renderMonths() {
  const keys = [...new Set(expenses.map((x) => monthKey(x.date)))].sort().reverse();
  const cm = new Date().toISOString().slice(0, 7);
  if (!keys.includes(cm)) keys.unshift(cm);
  const prev = filterMonth.value;
  filterMonth.innerHTML =
    '<option value="">All months</option>' +
    keys.map((k) => `<option value="${k}">${monthLabel(k)}</option>`).join("");
  if (prev && keys.includes(prev)) filterMonth.value = prev;
}

function renderList(rows) {
  const list = document.getElementById("expense-list");
  const empty = document.getElementById("empty-state");
  list.innerHTML = "";
  rows.sort((a, b) => (a.date < b.date ? 1 : a.id - b.id)); // newest first, stable-ish

  for (const x of rows.slice().reverse()) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="cat-dot" style="background:${CATEGORY_COLORS[x.category] || "#8b949e"}"></span>
      <div class="info">
        <div class="note">${escapeHtml(x.note)}</div>
        <div class="meta">${x.category} · ${x.date}</div>
      </div>
      <span class="amt">${rs(x.amount)}</span>`;
    const del = document.createElement("button");
    del.className = "delete-btn";
    del.title = "Delete";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      expenses = expenses.filter((e) => e.id !== x.id);
      save();
      render();
      toast("Deleted");
    });
    li.appendChild(del);
    list.appendChild(li);
  }
  empty.style.display = rows.length ? "none" : "block";
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ---------- chart ---------- */
function drawChart(byCat) {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const legend = document.getElementById("legend");
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legend.innerHTML = "";
  if (!total) {
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(110, 110, 82, 0, Math.PI * 2);
    ctx.stroke();
    legend.innerHTML = '<li>No data for this month</li>';
    return;
  }

  let start = -Math.PI / 2;
  for (const [cat, val] of entries) {
    const angle = (val / total) * Math.PI * 2;
    ctx.strokeStyle = CATEGORY_COLORS[cat] || "#8b949e";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(110, 110, 82, start, start + angle - 0.03);
    ctx.stroke();
    start += angle;

    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="background:${CATEGORY_COLORS[cat]}"></span>
      ${cat} <span class="amt">${rs(val)}</span>`;
    legend.appendChild(li);
  }

  ctx.fillStyle = "#e6edf3";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(rs(total), 110, 105);
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#8b949e";
  ctx.fillText("total", 110, 128);
}

render();
