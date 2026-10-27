const KEYS = { users: "studentSpendUsers", current: "studentSpendCurrentUser", expenses: "studentSpendExpenses", budget: "studentSpendBudget", profile: "studentSpendProfile" };
const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const money = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const users = () => read(KEYS.users, []);
const currentEmail = () => localStorage.getItem(KEYS.current);
const currentUser = () => users().find(u => u.email === currentEmail()) || null;
const allExpenses = () => read(KEYS.expenses, []);
const saveExpenses = data => write(KEYS.expenses, data);
const currentExpenses = () => allExpenses().filter(e => e.email === currentEmail());
const saveCurrentExpenses = list => { const others = allExpenses().filter(e => e.email !== currentEmail()); saveExpenses([...others, ...list]); };
const getBudget = () => Number(read(KEYS.budget, {})[currentEmail()] || 10000);
const setBudget = amount => { const budgets = read(KEYS.budget, {}); budgets[currentEmail()] = Number(amount); write(KEYS.budget, budgets); };
const profile = () => read(KEYS.profile, {})[currentEmail()] || {};
const saveProfile = p => { const data = read(KEYS.profile, {}); data[currentEmail()] = p; write(KEYS.profile, data); };
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const categoryIcons = { Food:"🍎", Transport:"🚌", Education:"📚", Shopping:"🛍️", Entertainment:"🎬", Bills:"🧾", Health:"💊", Other:"✨" };
function requireLogin() {
  const protectedPage = !["index.html", "signup.html", ""].includes(location.pathname.split("/").pop());
  if (protectedPage && !currentUser()) location.replace("index.html");
}
function renderHeader() {
  const user = currentUser(); if (!user) return;
  const p = profile(); const name = p.name || user.name || "Student";
  document.querySelectorAll("#headerName").forEach(el => el.textContent = name);
  document.querySelectorAll("#avatarInitial").forEach(el => el.textContent = name.trim().charAt(0).toUpperCase() || "S");
}
function setupAuth() {
  const login = document.getElementById("loginForm");
  if (login) login.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const user = users().find(u => u.email === email && u.password === password);
    const msg = document.getElementById("loginMessage");
    if (!user) { msg.style.color = "#c33c4c"; msg.textContent = "Account not found or password is incorrect. Try signing up first."; return; }
    localStorage.setItem(KEYS.current, user.email);
    location.href = "dashboard.html";
  });
  const signup = document.getElementById("signupForm");
  if (signup) signup.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    const msg = document.getElementById("signupMessage");
    if (password !== confirm) { msg.style.color = "#c33c4c"; msg.textContent = "Passwords do not match."; return; }
    const list = users();
    if (list.some(u => u.email === email)) { msg.style.color = "#c33c4c"; msg.textContent = "An account with this email already exists."; return; }
    list.push({ name, email, password }); write(KEYS.users, list); localStorage.setItem(KEYS.current, email); saveProfile({ name });
    location.href = "dashboard.html";
  });
  document.querySelectorAll("[data-logout]").forEach(btn => btn.addEventListener("click", () => { localStorage.removeItem(KEYS.current); location.href = "index.html"; }));
}
function monthExpenses() { const ym = today().slice(0,7); return currentExpenses().filter(e => e.date && e.date.slice(0,7) === ym); }
function sum(list) { return list.reduce((total, e) => total + Number(e.amount || 0), 0); }
function renderDashboard() {
  if (!document.getElementById("dashSpent")) return;
  const list = monthExpenses(), spent = sum(list), budget = getBudget();
  document.getElementById("dashSpent").textContent = money(spent);
  document.getElementById("dashRemaining").textContent = money(budget - spent);
  document.getElementById("dashCount").textContent = list.length;
  document.getElementById("dashBudgetLabel").textContent = `Of ${money(budget)} monthly budget`;
  const recent = [...currentExpenses()].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt).slice(0,5);
  const listEl = document.getElementById("recentTransactions");
  listEl.innerHTML = recent.map(e => `<div class="transaction-item"><div class="category-icon">${categoryIcons[e.category] || "✨"}</div><div class="transaction-info"><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.category)} · ${escapeHtml(e.date)}</small></div><div class="transaction-amount">−${money(e.amount)}</div></div>`).join("");
  document.getElementById("recentEmpty").hidden = recent.length > 0;
  const totals = categoryTotals(list);
  const catEl = document.getElementById("categorySummary");
  catEl.innerHTML = Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,val]) => `<div><div class="category-line-head"><span>${categoryIcons[cat]||"✨"} ${escapeHtml(cat)}</span><span>${money(val)}</span></div><div class="category-track"><div class="category-fill" style="width:${spent ? Math.min(100,val/spent*100) : 0}%"></div></div></div>`).join("");
  document.getElementById("categoryEmpty").hidden = Object.keys(totals).length > 0;
  const name = profile().name || currentUser()?.name || "Student";
  const welcome = document.getElementById("welcomeTitle"); if (welcome) welcome.textContent = `Good to see you, ${name.split(" ")[0]} 👋`;
}
function categoryTotals(list) { return list.reduce((acc,e) => { acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0); return acc; }, {}); }
function renderExpenses() {
  if (!document.getElementById("expenseTableBody")) return;
  const search = document.getElementById("expenseSearch").value.trim().toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const sort = document.getElementById("sortFilter").value;
  let list = currentExpenses().filter(e => (e.name + " " + (e.note || "")).toLowerCase().includes(search) && (category === "all" || e.category === category));
  list.sort((a,b) => sort === "oldest" ? a.date.localeCompare(b.date) : sort === "high" ? b.amount-a.amount : sort === "low" ? a.amount-b.amount : b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
  document.getElementById("expenseTableBody").innerHTML = list.map(e => `<tr><td>${escapeHtml(e.name)}${e.note ? `<span class="muted">${escapeHtml(e.note)}</span>` : ""}</td><td><span class="category-pill">${escapeHtml(e.category)}</span></td><td>${escapeHtml(e.date)}</td><td><strong>${money(e.amount)}</strong></td><td><button class="delete-btn" data-delete="${escapeHtml(e.id)}">Delete</button></td></tr>`).join("");
  document.getElementById("expensesEmpty").hidden = list.length > 0;
  document.getElementById("transactionCount").textContent = `${list.length} transaction${list.length === 1 ? "" : "s"}`;
  document.getElementById("transactionTotal").textContent = `Total: ${money(sum(list))}`;
  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => {
    if (!confirm("Delete this expense?")) return;
    saveCurrentExpenses(currentExpenses().filter(e => e.id !== btn.dataset.delete)); renderExpenses();
  }));
}
function setupExpenseForm() {
  const form = document.getElementById("expenseForm"); if (!form) return;
  document.getElementById("expenseDate").value = today();
  form.addEventListener("submit", e => {
    e.preventDefault();
    const amount = Number(document.getElementById("expenseAmount").value);
    const msg = document.getElementById("expenseFormMessage");
    if (!Number.isFinite(amount) || amount <= 0) { msg.style.color = "#c33c4c"; msg.textContent = "Enter an amount greater than zero."; return; }
    const item = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), email: currentEmail(), name: document.getElementById("expenseName").value.trim(), amount, category: document.getElementById("expenseCategory").value, date: document.getElementById("expenseDate").value, payment: document.getElementById("expensePayment").value, note: document.getElementById("expenseNote").value.trim(), createdAt: Date.now() };
    if (!item.name || !item.category || !item.date) { msg.style.color = "#c33c4c"; msg.textContent = "Please fill in all required fields."; return; }
    saveCurrentExpenses([...currentExpenses(), item]); location.href = "expenses.html";
  });
}
function setupBudget() {
  const form = document.getElementById("budgetForm");
  if (form) {
    document.getElementById("monthlyBudget").value = getBudget();
    form.addEventListener("submit", e => { e.preventDefault(); const val = Number(document.getElementById("monthlyBudget").value); const msg = document.getElementById("budgetMessage"); if (!Number.isFinite(val) || val <= 0) { msg.style.color="#c33c4c"; msg.textContent="Enter a budget greater than zero."; return; } setBudget(val); msg.style.color="var(--green)"; msg.textContent="Your budget has been saved."; renderBudget(); });
  }
  renderBudget();
}
function renderBudget() {
  if (!document.getElementById("budgetSpent")) return;
  const spent = sum(monthExpenses()), budget = getBudget(), remaining = budget-spent, pct = budget ? spent/budget*100 : 0;
  document.getElementById("budgetSpent").textContent = money(spent);
  document.getElementById("budgetProgress").style.width = `${Math.min(100,pct)}%`;
  document.getElementById("budgetProgress").style.background = pct > 100 ? "#d94d5d" : "var(--primary)";
  document.getElementById("budgetPercent").textContent = `${Math.round(pct)}%`;
  document.getElementById("budgetLeft").textContent = money(remaining);
  document.getElementById("budgetWarning").textContent = pct > 100 ? "You have gone over your monthly budget. Review recent expenses to see where you can adjust." : pct >= 80 ? "You're getting close to your limit. Keep an eye on new expenses." : "You're within your monthly budget. Keep tracking your expenses.";
}
function renderReports() {
  if (!document.getElementById("reportTotal")) return;
  const list = currentExpenses(), total = sum(list), totals = categoryTotals(list), entries = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  document.getElementById("reportTotal").textContent = money(total);
  document.getElementById("reportAverage").textContent = money(list.length ? total/list.length : 0);
  document.getElementById("reportTopCategory").textContent = entries[0]?.[0] || "—";
  document.getElementById("reportCategories").innerHTML = entries.map(([cat,val])=>`<div class="report-bar-row"><span>${categoryIcons[cat]||"✨"} ${escapeHtml(cat)}</span><div class="category-track"><div class="category-fill" style="width:${total ? val/total*100 : 0}%"></div></div><strong>${money(val)}</strong></div>`).join("");
  document.getElementById("reportEmpty").hidden = list.length > 0;
  const largest = [...list].sort((a,b)=>b.amount-a.amount)[0];
  const monthTotal = sum(monthExpenses()), budget = getBudget();
  const insights = list.length ? [
    `<strong>Top spending category</strong>${escapeHtml(entries[0]?.[0] || "No category")} accounts for ${total ? Math.round(entries[0][1]/total*100) : 0}% of your recorded spending.`,
    `<strong>Largest expense</strong>${largest ? `${escapeHtml(largest.name)} · ${money(largest.amount)}` : "No expenses yet."}`,
    `<strong>This month's budget</strong>${money(monthTotal)} spent out of ${money(budget)}.`
  ] : [`<strong>Start tracking</strong>Add your first expense to unlock insights.`,`<strong>Set a budget</strong>Choose a monthly spending limit on the My budget page.`];
  document.getElementById("reportInsights").innerHTML = insights.map(t=>`<div class="insight-item">${t}</div>`).join("");
}
function exportCsv() {
  const list = currentExpenses();
  const headers = ["Name","Amount INR","Category","Date","Payment method","Note"];
  const rows = list.map(e => [e.name,e.amount,e.category,e.date,e.payment,e.note]);
  const csv = [headers,...rows].map(row=>row.map(v=>`"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href=url; a.download="student-expenses.csv"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function setupProfile() {
  const form = document.getElementById("profileForm"); if (!form) return;
  const user = currentUser(), p = profile();
  document.getElementById("profileName").value = p.name || user.name || "";
  document.getElementById("profileEmail").value = user.email;
  document.getElementById("profileAvatar").textContent = (p.name || user.name || "S").charAt(0).toUpperCase();
  form.addEventListener("submit", e => { e.preventDefault(); const name = document.getElementById("profileName").value.trim(); if (!name) return; saveProfile({name}); const list = users().map(u => u.email === user.email ? {...u, name} : u); write(KEYS.users,list); document.getElementById("profileAvatar").textContent=name.charAt(0).toUpperCase(); document.getElementById("profileMessage").textContent="Profile updated."; renderHeader(); });
}
function setupSettings() {
  document.getElementById("exportCsv")?.addEventListener("click", exportCsv);
  document.getElementById("settingsExport")?.addEventListener("click", exportCsv);
  document.getElementById("clearData")?.addEventListener("click", () => {
    if (!confirm("Clear all your expenses and reset your monthly budget? This cannot be undone.")) return;
    saveCurrentExpenses([]); setBudget(10000);
    document.getElementById("settingsMessage").textContent = "Your expense data has been cleared and budget reset.";
  });
}
document.addEventListener("DOMContentLoaded", () => {
  requireLogin(); setupAuth();
  if (currentUser()) { renderHeader(); renderDashboard(); renderExpenses(); setupExpenseForm(); setupBudget(); renderReports(); setupProfile(); setupSettings(); }
  document.getElementById("expenseSearch")?.addEventListener("input", renderExpenses);
  document.getElementById("categoryFilter")?.addEventListener("change", renderExpenses);
  document.getElementById("sortFilter")?.addEventListener("change", renderExpenses);
});