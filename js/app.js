(function () {
  "use strict";

  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const today = new Date();
  const todayIso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  const elements = {};
  const state = { expenses: [], budget: null, toastTimer: null };

  function element(id) {
    if (!elements[id]) elements[id] = document.getElementById(id);
    return elements[id];
  }

  function monthKey(date) {
    return date.slice(0, 7);
  }

  function currentMonth() {
    return todayIso.slice(0, 7);
  }

  function localId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return "expense-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function notify(message, isError) {
    const toast = element("toast");
    toast.textContent = message;
    toast.classList.toggle("error", Boolean(isError));
    toast.classList.add("visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
  }

  function formatDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
  }

  function safeText(elementNode, text) {
    elementNode.textContent = text;
    return elementNode;
  }

  function populateSelects() {
    const filter = element("category-filter");
    const category = element("expense-category");
    ExpenseStorage.categories.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      filter.appendChild(option);
      category.appendChild(option.cloneNode(true));
    });
  }

  function expensesForCurrentMonth() {
    return state.expenses.filter((expense) => monthKey(expense.date) === currentMonth());
  }

  function renderSummary() {
    const monthExpenses = expensesForCurrentMonth();
    let selected = state.expenses;
    const period = element("period-filter").value;
    if (period === "month") selected = monthExpenses;
    if (period === "30days") {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
      const startIso = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, "0"), String(start.getDate()).padStart(2, "0")].join("-");
      selected = state.expenses.filter((expense) => expense.date >= startIso && expense.date <= todayIso);
    }
    const selectedTotal = selected.reduce((sum, expense) => sum + expense.amount, 0);
    const monthTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    element("selected-total").textContent = money.format(selectedTotal);
    element("selected-caption").textContent = period === "month" ? "For this month" : period === "30days" ? "For the last 30 days" : "Across all recorded time";
    element("month-total").textContent = money.format(monthTotal);
    element("transaction-count").textContent = String(state.expenses.length);
    const categories = new Map();
    monthExpenses.forEach((expense) => categories.set(expense.category, (categories.get(expense.category) || 0) + expense.amount));
    const top = [...categories.entries()].sort((a, b) => b[1] - a[1])[0];
    element("top-category").textContent = top ? top[0] : "—";
    element("top-category-caption").textContent = top ? money.format(top[1]) + " this month" : "No spending this month";
    ExpenseCharts.renderMonthly(element("monthly-chart"), state.expenses, today);
    const categoryTotal = ExpenseCharts.renderCategories(element("category-chart"), element("category-legend"), state.expenses, today);
    element("category-total").textContent = money.format(categoryTotal);
  }

  function visibleExpenses() {
    const query = element("search-input").value.trim().toLocaleLowerCase();
    const category = element("category-filter").value;
    const selectedMonth = element("month-filter").value;
    const results = state.expenses.filter((expense) =>
      (!query || expense.title.toLocaleLowerCase().includes(query)) &&
      (!category || expense.category === category) &&
      (!selectedMonth || monthKey(expense.date) === selectedMonth)
    );
    const sort = element("sort-filter").value;
    results.sort((a, b) => {
      if (sort === "date-asc") return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      if (sort === "amount-desc") return b.amount - a.amount || b.date.localeCompare(a.date);
      if (sort === "amount-asc") return a.amount - b.amount || b.date.localeCompare(a.date);
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });
    return results;
  }

  function renderTransactions() {
    const rows = element("transaction-rows");
    rows.replaceChildren();
    const results = visibleExpenses();
    results.forEach((expense) => {
      const row = document.createElement("tr");
      const descriptionCell = document.createElement("td");
      const description = document.createElement("div");
      description.className = "expense-cell";
      const avatar = document.createElement("span");
      avatar.className = "expense-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = expense.title.trim().charAt(0).toLocaleUpperCase();
      const textGroup = document.createElement("span");
      const title = document.createElement("span");
      title.className = "expense-name";
      title.title = expense.title;
      safeText(title, expense.title);
      textGroup.appendChild(title);
      if (expense.notes) {
        const notes = document.createElement("span");
        notes.className = "expense-note";
        safeText(notes, expense.notes);
        textGroup.appendChild(notes);
      }
      description.append(avatar, textGroup);
      descriptionCell.appendChild(description);
      const categoryCell = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = "category-pill";
      safeText(pill, expense.category);
      categoryCell.appendChild(pill);
      const dateCell = document.createElement("td");
      safeText(dateCell, formatDate(expense.date));
      const paymentCell = document.createElement("td");
      safeText(paymentCell, expense.payment);
      const amountCell = document.createElement("td");
      amountCell.className = "amount-cell";
      safeText(amountCell, money.format(expense.amount));
      const actionsCell = document.createElement("td");
      actionsCell.className = "actions-cell";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "row-action";
      edit.setAttribute("aria-label", "Edit " + expense.title);
      edit.title = "Edit expense";
      edit.textContent = "✎";
      edit.addEventListener("click", () => beginEdit(expense.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "row-action delete";
      remove.setAttribute("aria-label", "Delete " + expense.title);
      remove.title = "Delete expense";
      remove.textContent = "×";
      remove.addEventListener("click", () => deleteExpense(expense.id));
      actionsCell.append(edit, remove);
      row.append(descriptionCell, categoryCell, dateCell, paymentCell, amountCell, actionsCell);
      rows.appendChild(row);
    });
    const empty = results.length === 0;
    element("empty-state").hidden = !empty;
    element("empty-title").textContent = state.expenses.length && (element("search-input").value || element("category-filter").value || element("month-filter").value) ? "No matching expenses" : "Nothing here yet";
    element("empty-description").textContent = state.expenses.length ? "Try changing your search or filters to find a transaction." : "Add your first expense or load demo data to see your dashboard come to life.";
    element("empty-add").hidden = state.expenses.length > 0;
    element("table-count").textContent = "Showing all " + results.length + " matching " + (results.length === 1 ? "transaction" : "transactions");
  }

  function renderBudget() {
    const monthTotal = expensesForCurrentMonth().reduce((sum, expense) => sum + expense.amount, 0);
    const track = element("budget-progress");
    const fill = element("budget-progress-fill");
    const status = element("budget-status");
    track.classList.remove("warning", "exceeded");
    status.classList.remove("warning", "exceeded");
    element("budget-limit-display").textContent = state.budget ? money.format(state.budget) : "Not set";
    element("budget-spent-label").textContent = money.format(monthTotal) + " spent";
    if (!state.budget) {
      fill.style.width = "0%";
      track.setAttribute("aria-valuenow", "0");
      element("budget-remaining").textContent = "Set a budget to track";
      status.textContent = "A budget is a planning tool, not a bank balance.";
      return;
    }
    const ratio = monthTotal / state.budget;
    const percentage = Math.round(ratio * 100);
    const visualPercentage = Math.min(100, percentage);
    fill.style.width = visualPercentage + "%";
    track.setAttribute("aria-valuenow", String(visualPercentage));
    if (ratio > 1) {
      track.classList.add("exceeded");
      status.classList.add("exceeded");
      element("budget-remaining").textContent = money.format(monthTotal - state.budget) + " over";
      status.textContent = "Budget exceeded by " + money.format(monthTotal - state.budget) + ". Review this month's spending.";
    } else {
      element("budget-remaining").textContent = money.format(state.budget - monthTotal) + " left";
      if (ratio >= 0.8) {
        track.classList.add("warning");
        status.classList.add("warning");
        status.textContent = "Heads up: you've used " + percentage + "% of this month's budget.";
      } else {
        status.textContent = percentage + "% of your monthly budget used.";
      }
    }
  }

  function render() {
    renderSummary();
    renderTransactions();
    renderBudget();
  }

  function saveExpenses(nextExpenses) {
    const result = ExpenseStorage.saveExpenses(nextExpenses);
    if (!result.ok) {
      notify(result.error, true);
      return false;
    }
    state.expenses = result.expenses;
    render();
    return true;
  }

  function resetExpenseForm() {
    element("expense-form").reset();
    element("expense-id").value = "";
    element("expense-date").value = todayIso;
    element("form-heading").textContent = "Quick add";
    element("form-subtitle").textContent = "Keep track as you go";
    element("submit-expense").replaceChildren(document.createTextNode("Add expense "));
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    element("submit-expense").appendChild(arrow);
    element("cancel-edit").hidden = true;
    element("form-error").hidden = true;
  }

  function beginEdit(id) {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) {
      notify("That expense could not be found.", true);
      return;
    }
    element("expense-id").value = expense.id;
    element("expense-title").value = expense.title;
    element("expense-amount").value = String(expense.amount);
    element("expense-category").value = expense.category;
    element("expense-date").value = expense.date;
    element("expense-payment").value = expense.payment;
    element("expense-notes").value = expense.notes;
    element("form-heading").textContent = "Edit expense";
    element("form-subtitle").textContent = "Update the details below";
    element("submit-expense").textContent = "Save changes →";
    element("cancel-edit").hidden = false;
    element("form-error").hidden = true;
    element("expense-form-section").scrollIntoView({ behavior: "smooth", block: "center" });
    element("expense-title").focus({ preventScroll: true });
  }

  function deleteExpense(id) {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense || !confirm('Delete "' + expense.title + '"? This cannot be undone.')) return;
    if (saveExpenses(state.expenses.filter((item) => item.id !== id))) notify("Expense deleted.");
  }

  function validateForm() {
    const title = element("expense-title").value.trim();
    const amount = Number(element("expense-amount").value);
    const category = element("expense-category").value;
    const date = element("expense-date").value;
    const payment = element("expense-payment").value;
    if (!title) return "Add a short title for this expense.";
    if (title.length > 80) return "The title must be 80 characters or fewer.";
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return "Enter an amount greater than ₹0 and no more than ₹10 crore.";
    if (!ExpenseStorage.categories.includes(category)) return "Choose a valid expense category.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + "T00:00:00Z").getTime()) || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) return "Choose a valid date.";
    if (!ExpenseStorage.payments.includes(payment)) return "Choose a valid payment method.";
    return "";
  }

  function handleExpenseSubmit(event) {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      element("form-error").textContent = error;
      element("form-error").hidden = false;
      return;
    }
    const id = element("expense-id").value || localId();
    const entry = ExpenseStorage.normalizeExpense({
      id,
      title: element("expense-title").value.trim(),
      amount: Number(element("expense-amount").value),
      category: element("expense-category").value,
      date: element("expense-date").value,
      payment: element("expense-payment").value,
      notes: element("expense-notes").value.trim()
    });
    if (!entry) {
      element("form-error").textContent = "Expense details are invalid. Please review the form.";
      element("form-error").hidden = false;
      return;
    }
    const existing = state.expenses.some((expense) => expense.id === id);
    const next = existing ? state.expenses.map((expense) => expense.id === id ? entry : expense) : [entry, ...state.expenses];
    if (saveExpenses(next)) {
      notify(existing ? "Expense updated." : "Expense added.");
      resetExpenseForm();
    }
  }

  function handleBudgetSubmit(event) {
    event.preventDefault();
    const input = element("budget-input");
    const value = input.value.trim() === "" ? NaN : Number(input.value);
    const result = ExpenseStorage.saveBudget(value);
    if (!result.ok) {
      notify(result.error, true);
      return;
    }
    state.budget = result.budget;
    input.value = "";
    renderBudget();
    notify("Monthly budget saved.");
  }

  function demoExpenses() {
    const dateInMonth = (offset) => {
      const date = new Date(today.getFullYear(), today.getMonth(), Math.min(offset, today.getDate()));
      return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    };
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const priorDate = (day) => [previousMonth.getFullYear(), String(previousMonth.getMonth() + 1).padStart(2, "0"), String(Math.min(day, new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0).getDate())).padStart(2, "0")].join("-");
    return [
      { id: "demo-lunch", title: "Lunch at campus", amount: 180, category: "Food", date: dateInMonth(3), payment: "UPI", notes: "Thali with classmates" },
      { id: "demo-metro", title: "Metro recharge", amount: 450, category: "Transport", date: dateInMonth(5), payment: "UPI", notes: "" },
      { id: "demo-notes", title: "Semester notes", amount: 320, category: "Education", date: dateInMonth(8), payment: "Cash", notes: "Printed lecture notes" },
      { id: "demo-groceries", title: "Weekly groceries", amount: 760, category: "Food", date: dateInMonth(11), payment: "Card", notes: "" },
      { id: "demo-streaming", title: "Music subscription", amount: 119, category: "Entertainment", date: dateInMonth(14), payment: "UPI", notes: "" },
      { id: "demo-cab", title: "Auto to college", amount: 140, category: "Transport", date: dateInMonth(17), payment: "Cash", notes: "Rainy day ride" },
      { id: "demo-book", title: "Design thinking book", amount: 540, category: "Education", date: dateInMonth(20), payment: "Card", notes: "" },
      { id: "demo-cafe", title: "Coffee & snack", amount: 160, category: "Food", date: dateInMonth(23), payment: "UPI", notes: "Study break" },
      { id: "demo-shopping", title: "Notebook and pens", amount: 275, category: "Shopping", date: dateInMonth(25), payment: "Cash", notes: "" },
      { id: "demo-prior", title: "Previous month bus pass", amount: 600, category: "Transport", date: priorDate(12), payment: "UPI", notes: "" }
    ];
  }

  function loadDemo() {
    const demo = demoExpenses();
    const existingIds = new Set(state.expenses.map((expense) => expense.id));
    const additions = demo.filter((expense) => !existingIds.has(expense.id));
    if (additions.length === 0) {
      notify("Demo data is already loaded.");
      return;
    }
    if (saveExpenses([...additions, ...state.expenses])) {
      if (!state.budget) {
        const budgetResult = ExpenseStorage.saveBudget(5000);
        if (budgetResult.ok) state.budget = budgetResult.budget;
        else notify(budgetResult.error, true);
      }
      render();
      notify("Demo transactions added without duplicating existing demo entries.");
    }
  }

  function exportCsv() {
    const rows = [["Title", "Amount (INR)", "Category", "Date", "Payment method", "Notes"]];
    visibleExpenses().forEach((expense) => rows.push([expense.title, expense.amount.toFixed(2), expense.category, expense.date, expense.payment, expense.notes]));
    const csv = rows.map((row) => row.map((value) => {
      const safeValue = /^[\s]*[=+\-@]/.test(String(value)) ? "'" + value : String(value);
      return '"' + safeValue.replace(/"/g, '""') + '"';
    }).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pennywise-expenses-" + todayIso + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("CSV export downloaded.");
  }

  function clearAll() {
    if (!state.expenses.length && state.budget === null) {
      notify("There is no saved data to clear.");
      return;
    }
    if (!confirm("Clear all expenses and the monthly budget from this browser? This cannot be undone.")) return;
    const expenseResult = ExpenseStorage.saveExpenses([]);
    const budgetResult = ExpenseStorage.saveBudget(null);
    if (!expenseResult.ok || !budgetResult.ok) {
      notify([expenseResult.error, budgetResult.error].filter(Boolean).join(" "), true);
      return;
    }
    state.expenses = [];
    state.budget = null;
    resetExpenseForm();
    render();
    notify("All local data has been cleared.");
  }

  function setActiveNavigation() {
    const links = document.querySelectorAll(".nav-link");
    links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === location.hash));
    const current = location.hash === "#transactions" ? "Transactions" : location.hash === "#budget" ? "Monthly budget" : "Overview";
    element("breadcrumb-current").textContent = current;
  }

  function initialize() {
    populateSelects();
    element("expense-date").value = todayIso;
    element("today-label").textContent = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(today).toLocaleUpperCase() + " · YOUR MONEY, MADE CLEAR";
    const storedExpenses = ExpenseStorage.readExpenses();
    const storedBudget = ExpenseStorage.readBudget();
    state.expenses = storedExpenses.expenses;
    state.budget = storedBudget.budget;
    if (storedExpenses.error) notify(storedExpenses.error, true);
    else if (storedBudget.error) notify(storedBudget.error, true);
    element("expense-form").addEventListener("submit", handleExpenseSubmit);
    element("cancel-edit").addEventListener("click", resetExpenseForm);
    element("budget-form").addEventListener("submit", handleBudgetSubmit);
    element("load-demo").addEventListener("click", loadDemo);
    element("clear-data").addEventListener("click", clearAll);
    element("add-expense-top").addEventListener("click", () => {
      element("expense-form-section").scrollIntoView({ behavior: "smooth", block: "center" });
      element("expense-title").focus({ preventScroll: true });
    });
    element("empty-add").addEventListener("click", () => element("add-expense-top").click());
    ["search-input", "category-filter", "month-filter", "sort-filter"].forEach((id) => element(id).addEventListener(id === "search-input" ? "input" : "change", renderTransactions));
    element("period-filter").addEventListener("change", renderSummary);
    window.addEventListener("hashchange", setActiveNavigation);
    element("export-csv").addEventListener("click", exportCsv);
    render();
    setActiveNavigation();
  }

  initialize();
})();
