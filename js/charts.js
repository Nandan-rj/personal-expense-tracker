(function (global) {
  "use strict";

  const colors = ["#3f8063", "#d6a852", "#7f77a9", "#dc806a", "#70a8a0", "#9b7d5d", "#7f9fcb", "#b0b9b4"];
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const svgNamespace = "http://www.w3.org/2000/svg";

  function svgElement(name, attributes) {
    const element = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function renderMonthly(container, expenses, now) {
    container.replaceChildren();
    const months = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      months.push({ key, label: new Intl.DateTimeFormat("en", { month: "short" }).format(date), total: 0, current: offset === 0 });
    }
    expenses.forEach((expense) => {
      const month = months.find((entry) => entry.key === expense.date.slice(0, 7));
      if (month) month.total += expense.amount;
    });
    const svg = svgElement("svg", { viewBox: "0 0 600 180", preserveAspectRatio: "none", class: "monthly-svg", "aria-hidden": "true" });
    const max = Math.max(...months.map((item) => item.total), 100);
    const chartTop = 10;
    const chartBottom = 145;
    const chartHeight = chartBottom - chartTop;
    [0, 0.5, 1].forEach((fraction) => {
      const y = chartBottom - chartHeight * fraction;
      svg.appendChild(svgElement("line", { x1: "38", y1: String(y), x2: "592", y2: String(y), class: "grid-line" }));
      const label = svgElement("text", { x: "0", y: String(y + 3) });
      label.textContent = fraction === 0 ? "₹0" : money.format(max * fraction);
      svg.appendChild(label);
    });
    const slotWidth = 554 / months.length;
    const barWidth = Math.min(40, slotWidth * 0.5);
    months.forEach((month, index) => {
      const height = month.total === 0 ? 2 : Math.max(3, (month.total / max) * chartHeight);
      const x = 38 + index * slotWidth + (slotWidth - barWidth) / 2;
      const bar = svgElement("rect", { x: String(x), y: String(chartBottom - height), width: String(barWidth), height: String(height), rx: "5", class: month.current ? "bar current" : "bar" });
      const title = svgElement("title", {});
      title.textContent = month.label + ": " + money.format(month.total);
      bar.appendChild(title);
      svg.appendChild(bar);
      const monthLabel = svgElement("text", { x: String(x + barWidth / 2), y: "166", "text-anchor": "middle" });
      monthLabel.textContent = month.label;
      svg.appendChild(monthLabel);
    });
    container.appendChild(svg);
    container.setAttribute("aria-label", "Monthly spending for the last six months. " + months.map((item) => item.label + " " + money.format(item.total)).join(", "));
  }

  function renderCategories(container, legend, expenses, now) {
    const totals = new Map(global.ExpenseStorage.categories.map((category) => [category, 0]));
    const currentMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    expenses.filter((expense) => expense.date.slice(0, 7) === currentMonth)
      .forEach((expense) => totals.set(expense.category, totals.get(expense.category) + expense.amount));
    const entries = [...totals.entries()].filter((entry) => entry[1] > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    if (total === 0) {
      container.style.background = "conic-gradient(#e9efec 0deg 360deg)";
      container.setAttribute("aria-label", "No spending recorded this month");
    } else {
      let currentAngle = 0;
      const segments = entries.map(([category, amount]) => {
        const start = currentAngle;
        currentAngle += (amount / total) * 360;
        return colors[global.ExpenseStorage.categories.indexOf(category)] + " " + start + "deg " + currentAngle + "deg";
      });
      container.style.background = "conic-gradient(" + segments.join(", ") + ")";
      container.setAttribute("aria-label", "Spending by category this month: " + entries.map(([category, amount]) => category + " " + money.format(amount)).join(", "));
    }
    legend.replaceChildren();
    entries.slice(0, 6).forEach(([category, amount]) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.className = "legend-name";
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = colors[global.ExpenseStorage.categories.indexOf(category)];
      const label = document.createElement("span");
      label.textContent = category;
      name.append(swatch, label);
      const value = document.createElement("strong");
      value.textContent = Math.round((amount / total) * 100) + "%";
      item.append(name, value);
      legend.appendChild(item);
    });
    return total;
  }

  global.ExpenseCharts = Object.freeze({ renderMonthly, renderCategories });
})(window);
