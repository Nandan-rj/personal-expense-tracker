(function (global) {
  "use strict";

  const EXPENSES_KEY = "pennywise.expenses.v1";
  const BUDGET_KEY = "pennywise.monthlyBudget.v1";
  const categories = ["Food", "Transport", "Education", "Shopping", "Entertainment", "Bills", "Healthcare", "Other"];
  const payments = ["UPI", "Cash", "Card", "Net Banking", "Other"];

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T00:00:00Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeExpense(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const id = typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100 ? value.id : null;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 80) : "";
    const amount = Number(value.amount);
    if (!id || !title || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || !validDate(value.date)) return null;
    if (!categories.includes(value.category) || !payments.includes(value.payment)) return null;
    return {
      id,
      title,
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
      category: value.category,
      date: value.date,
      payment: value.payment,
      notes: typeof value.notes === "string" ? value.notes.trim().slice(0, 160) : ""
    };
  }

  function readExpenses() {
    let raw;
    try {
      raw = global.localStorage.getItem(EXPENSES_KEY);
    } catch (error) {
      return { expenses: [], error: "Browser storage is unavailable. Changes may not be saved." };
    }
    if (raw === null) return { expenses: [], error: "" };
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { expenses: [], error: "Saved expense data was invalid. Start fresh or load demo data." };
      const normalized = parsed.map(normalizeExpense);
      if (normalized.some((expense) => expense === null)) {
        return { expenses: normalized.filter(Boolean), error: "Some invalid saved entries were skipped. Review your expense list." };
      }
      return { expenses: normalized, error: "" };
    } catch (error) {
      return { expenses: [], error: "Saved expense data could not be read. Start fresh or load demo data." };
    }
  }

  function readBudget() {
    let raw;
    try {
      raw = global.localStorage.getItem(BUDGET_KEY);
    } catch (error) {
      return { budget: null, error: "Browser storage is unavailable. Changes may not be saved." };
    }
    if (raw === null) return { budget: null, error: "" };
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0 && parsed <= 100000000) {
        return { budget: Math.round((parsed + Number.EPSILON) * 100) / 100, error: "" };
      }
    } catch (error) {
      return { budget: null, error: "Saved budget data was invalid. Set your budget again." };
    }
    return { budget: null, error: "Saved budget data was invalid. Set your budget again." };
  }

  function saveExpenses(expenses) {
    const normalized = expenses.map(normalizeExpense);
    if (normalized.some((expense) => expense === null)) return { ok: false, error: "Expense data failed validation and was not saved." };
    try {
      global.localStorage.setItem(EXPENSES_KEY, JSON.stringify(normalized));
      return { ok: true, expenses: normalized };
    } catch (error) {
      return { ok: false, error: "Could not save expenses. Browser storage may be full or unavailable." };
    }
  }

  function saveBudget(budget) {
    if (budget === null) {
      try {
        global.localStorage.removeItem(BUDGET_KEY);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: "Could not update browser storage." };
      }
    }
    if (!Number.isFinite(budget) || budget <= 0 || budget > 100000000) return { ok: false, error: "Enter a valid monthly budget." };
    try {
      global.localStorage.setItem(BUDGET_KEY, JSON.stringify(Math.round((budget + Number.EPSILON) * 100) / 100));
      return { ok: true, budget: Math.round((budget + Number.EPSILON) * 100) / 100 };
    } catch (error) {
      return { ok: false, error: "Could not save your budget. Browser storage may be full or unavailable." };
    }
  }

  global.ExpenseStorage = Object.freeze({
    categories,
    payments,
    normalizeExpense,
    readExpenses,
    readBudget,
    saveExpenses,
    saveBudget,
    keys: Object.freeze({ expenses: EXPENSES_KEY, budget: BUDGET_KEY })
  });
})(window);
