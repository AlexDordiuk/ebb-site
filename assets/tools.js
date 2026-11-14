/* Ebb site tools: savings calculator, taper plan builder, "where am I on the timeline".
   Source: ebb-ios/site/src/assets/tools.js (copied to ebb-site/assets/ by site/build.py).
   No network requests. The timeline date is kept in this browser's localStorage only. */
(function () {
  "use strict";

  var lang = document.documentElement.lang || "en";

  function num(value) {
    var n = parseFloat(String(value).replace(",", "."));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  // What pouches cost: pouches a day / pouches in a can × price of a can.
  each('[data-tool="savings"]', function (el) {
    var money;
    try {
      money = new Intl.NumberFormat(el.dataset.locale, { style: "currency", currency: el.dataset.currency, maximumFractionDigits: 0 });
    } catch (e) {
      money = { format: function (n) { return Math.round(n) + " " + el.dataset.currency; } };
    }
    function field(name) { return el.querySelector('[name="' + name + '"]'); }
    function out(name, value) { el.querySelector('[data-out="' + name + '"]').textContent = money.format(value); }
    function update() {
      var perCan = num(field("perCan").value);
      var year = perCan ? num(field("perDay").value) / perCan * num(field("price").value) * 365 : 0;
      out("month", year / 12);
      out("year", year);
      out("five", year * 5);
    }
    el.addEventListener("input", update);
    update();
    el.hidden = false;
  });

  // Taper plan. Same rule as the app (EbbKit Taper.dailyLimit): limit = ceil(base × (1 − step)^weeks), until it reaches 1.
  each('[data-tool="taper"]', function (el) {
    var perDay = el.querySelector('[name="perDay"]');
    var step = el.querySelector('[name="step"]');
    var body = el.querySelector("tbody");
    var summary = el.querySelector('[data-out="summary"]');
    function row(a, b) {
      var tr = document.createElement("tr");
      [a, b].forEach(function (text) {
        var td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    }
    function update() {
      var base = Math.min(60, Math.max(2, Math.round(num(perDay.value))));
      var s = num(step.value) / 100;
      var limits = [];
      for (var week = 0; week <= 52; week++) {
        var limit = Math.ceil(base * Math.pow(1 - s, week) * (1 - 1e-12));
        limits.push(limit);
        if (limit <= 1) break;
      }
      body.textContent = "";
      limits.forEach(function (limit, i) { row(String(i + 1), String(limit)); });
      row(String(limits.length + 1), el.dataset.quit);
      summary.textContent = el.dataset.summary.replace("{weeks}", limits.length);
    }
    el.addEventListener("input", update);
    el.addEventListener("change", update);
    update();
    el.hidden = false;
  });

  // Where am I on the timeline: marks the milestones already reached and names the next one.
  each('[data-tool="quit"]', function (el) {
    var KEY = "ebb.lastPouch";
    var input = el.querySelector("input");
    var status = el.querySelector('[data-out="status"]');
    var clear = el.querySelector("button");
    var list = document.querySelector("ol.timeline");
    var items = list ? Array.prototype.slice.call(list.querySelectorAll("li[data-seconds]")) : [];
    if (!items.length) return;

    function unit(n, name) {
      try {
        return new Intl.NumberFormat(lang, { style: "unit", unit: name, unitDisplay: "long" }).format(n);
      } catch (e) {
        return n + " " + name;
      }
    }
    function join(parts) {
      try {
        return new Intl.ListFormat(lang, { style: "long", type: "conjunction" }).format(parts);
      } catch (e) {
        return parts.join(", ");
      }
    }
    function span(seconds) {
      var minutes = Math.max(1, Math.round(seconds / 60));
      if (minutes < 60) return unit(minutes, "minute");
      var hours = Math.floor(minutes / 60);
      if (hours < 24) return minutes % 60 ? join([unit(hours, "hour"), unit(minutes % 60, "minute")]) : unit(hours, "hour");
      var days = Math.floor(hours / 24);
      return days < 60 && hours % 24 ? join([unit(days, "day"), unit(hours % 24, "hour")]) : unit(days, "day");
    }
    function local(date) {
      var d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return d.toISOString().slice(0, 16);
    }
    function update() {
      var start = input.value ? new Date(input.value).getTime() : NaN;
      var now = Date.now();
      input.max = local(new Date(now));
      var valid = !isNaN(start) && start <= now;
      list.classList.toggle("tracking", valid);
      clear.hidden = !input.value;
      if (!valid) {
        items.forEach(function (li) { li.classList.remove("reached", "next"); });
        status.textContent = "";
        return;
      }
      var seconds = (now - start) / 1000;
      var reached = 0;
      items.forEach(function (li) { if (Number(li.dataset.seconds) <= seconds) reached++; });
      items.forEach(function (li, i) {
        li.classList.toggle("reached", i < reached);
        li.classList.toggle("next", i === reached);
      });
      var text = el.dataset.since.replace("{time}", span(seconds)) + " "
        + el.dataset.reached.replace("{n}", reached).replace("{total}", items.length) + " ";
      var next = items[reached];
      text += next
        ? el.dataset.next.replace("{when}", next.querySelector(".when").textContent.trim())
            .replace("{time}", span(Number(next.dataset.seconds) - seconds))
        : el.dataset.all;
      status.textContent = text;
    }
    function save() {
      try {
        if (input.value) localStorage.setItem(KEY, input.value);
        else localStorage.removeItem(KEY);
      } catch (e) { /* private mode: works without saving */ }
    }
    try { input.value = localStorage.getItem(KEY) || ""; } catch (e) { /* no storage */ }
    input.addEventListener("input", function () { save(); update(); });
    clear.addEventListener("click", function () { input.value = ""; save(); update(); });
    setInterval(update, 60000);
    update();
    el.hidden = false;
  });
})();
