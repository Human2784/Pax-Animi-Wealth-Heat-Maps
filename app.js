(function () {
  const page = document.body.dataset.page;
  const funds = window.PAW.funds;
  const $ = (id) => document.getElementById(id);

  function pct(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    const v = (Math.round(n * 100) / 100).toFixed(2);
    return (n < 0 ? "−" : "") + Math.abs(v) + "%";
  }
  function cls(n) {
    if (n === null || n === undefined || Math.abs(n) < 0.005) return "";
    return n > 0 ? "pos" : "neg";
  }
  function heat(n) {
    if (n === null || n === undefined) return "";
    const t = Math.max(-18, Math.min(18, n)) / 18;
    const color = t >= 0
      ? `rgba(29, 107, 69, ${0.12 + t * 0.55})`
      : `rgba(141, 47, 47, ${0.12 + -t * 0.55})`;
    return `background:${color}`;
  }
  function yearRows(f) {
    return Object.keys(f.returns || {}).sort().map(d => ({
      key: d === "30/09/2026" ? "2026 YTD" : d.slice(6),
      date: d,
      value: f.returns[d]
    }));
  }
  function avg(rows) {
    if (!rows.length) return null;
    return rows.reduce((s, r) => s + r.value, 0) / rows.length;
  }
  function fillFilters() {
    const house = $("house");
    const role = $("role");
    if (house) {
      [...new Set(funds.map(f => f.house))].sort().forEach(h => {
        const o = document.createElement("option");
        o.value = h; o.textContent = h; house.appendChild(o);
      });
    }
    if (role) {
      [...new Set(funds.map(f => f.role))].sort().forEach(h => {
        const o = document.createElement("option");
        o.value = h; o.textContent = h; role.appendChild(o);
      });
    }
  }
  function selectedFunds() {
    const q = ($("q")?.value || "").toLowerCase();
    const house = $("house")?.value || "";
    const role = $("role")?.value || "";
    return funds.filter(f => {
      if (house && f.house !== house) return false;
      if (role && f.role !== role) return false;
      if (q && !(f.name + f.isin).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function nameCell(f) {
    return `<td class="left"><span class="name">${f.name}</span><span class="meta">${f.class} · ${f.isin}</span></td>`;
  }

  let sortKey = null;
  let sortDir = -1;

  function bindSort(draw) {
    const table = $("grid");
    if (table.dataset.bound) return;
    table.dataset.bound = "1";
    table.addEventListener("click", (e) => {
      const th = e.target.closest("th");
      if (!th || !th.dataset.k) return;
      const key = th.dataset.k;
      sortDir = sortKey === key ? -sortDir : -1;
      sortKey = key;
      draw();
    });
  }

  function drawHeat() {
    const rows = selectedFunds().map(f => ({ f, years: yearRows(f), avg: avg(yearRows(f)) }));
    const keys = [...new Set(rows.flatMap(r => r.years.map(y => y.key)))];
    if (sortKey) {
      rows.sort((a, b) => {
        const av = sortKey === "name" ? a.f.name : sortKey === "avg" ? a.avg : (a.years.find(y => y.key === sortKey)?.value ?? -999);
        const bv = sortKey === "name" ? b.f.name : sortKey === "avg" ? b.avg : (b.years.find(y => y.key === sortKey)?.value ?? -999);
        if (av < bv) return -sortDir;
        if (av > bv) return sortDir;
        return 0;
      });
    }
    const head = `<thead><tr><th class="left" data-k="name">Fund</th>${keys.map(k => `<th data-k="${k}">${k}</th>`).join("")}<th data-k="avg">Average</th></tr></thead>`;
    const body = rows.map(r => {
      const cells = keys.map(k => {
        const y = r.years.find(v => v.key === k);
        const n = y ? y.value : null;
        return `<td class="heat ${cls(n)}" style="${heat(n)}">${pct(n)}</td>`;
      }).join("");
      return `<tr>${nameCell(r.f)}${cells}<td class="${cls(r.avg)}">${pct(r.avg)}</td></tr>`;
    }).join("");
    $("grid").innerHTML = head + `<tbody>${body}</tbody>`;
    bindSort(drawHeat);
  }

  function drawRolling() {
    const cols = [["m3","3 months"],["m6","6 months"],["y1","1 year"],["y3","3y ann."],["y5","5y ann."],["y10","10y ann."]];
    let rows = selectedFunds();
    if (sortKey) {
      rows = rows.slice().sort((a, b) => {
        const av = sortKey === "name" ? a.name : a.rolling[sortKey];
        const bv = sortKey === "name" ? b.name : b.rolling[sortKey];
        if (av === null) return 1;
        if (bv === null) return -1;
        if (av < bv) return -sortDir;
        if (av > bv) return sortDir;
        return 0;
      });
    }
    const head = `<thead><tr><th class="left" data-k="name">Fund</th>${cols.map(c => `<th data-k="${c[0]}">${c[1]}</th>`).join("")}</tr></thead>`;
    const body = rows.map(f => `<tr>${nameCell(f)}${cols.map(c => {
      const n = f.rolling[c[0]];
      return `<td class="${cls(n)}">${pct(n)}</td>`;
    }).join("")}</tr>`).join("");
    $("grid").innerHTML = head + `<tbody>${body}</tbody>`;
    bindSort(drawRolling);
  }

  function axisPct(value) {
    return value + "%";
  }
  const pctScale = { ticks: { callback: axisPct } };
  function drawCagr() {
    let rows = selectedFunds().slice().sort((a, b) => b.cagr.cagr - a.cagr.cagr);
    if (sortKey === "name") rows.sort((a, b) => a.name.localeCompare(b.name) * sortDir);
    else if (sortKey) rows.sort((a, b) => ((a.cagr[sortKey] ?? -999) - (b.cagr[sortKey] ?? -999)) * sortDir);
    if (chart) chart.destroy();
    chart = new Chart($("chart"), {
      type: "bar",
      data: {
        labels: rows.map(f => f.name.replace(" Portfolio","").replace(" Fund","").replace(" Trust","")),
        datasets: [{ label: "CAGR since launch", data: rows.map(f => f.cagr.cagr), backgroundColor: "#1f4d3a" }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: pctScale } }
    });
    const head = `<thead><tr><th class="left" data-k="name">Fund</th><th class="left" data-k="launch">Launch</th><th data-k="years">Years</th><th data-k="launchPrice">Launch price</th><th data-k="price">Price now</th><th data-k="cagr">CAGR</th></tr></thead>`;
    const body = rows.map(f => `<tr>${nameCell(f)}<td class="left">${f.cagr.launch}</td><td>${f.cagr.years.toFixed(2)}</td><td>£${f.cagr.launchPrice.toFixed(2)}</td><td>£${f.cagr.price.toFixed(2)}</td><td class="${cls(f.cagr.cagr)}">${pct(f.cagr.cagr)}</td></tr>`).join("");
    $("grid").innerHTML = head + `<tbody>${body}</tbody>`;
    bindSort(drawCagr);
  }

  function drawRpi() {
    let rows = selectedFunds().slice().sort((a, b) => b.rpi.real - a.rpi.real);
    if (sortKey) {
      rows.sort((a, b) => {
        const av = sortKey === "name" ? a.name : a.rpi[sortKey];
        const bv = sortKey === "name" ? b.name : b.rpi[sortKey];
        if (av < bv) return -sortDir;
        if (av > bv) return sortDir;
        return 0;
      });
    }
    if (chart) chart.destroy();
    chart = new Chart($("chart"), {
      type: "bar",
      data: {
        labels: rows.map(f => f.name.replace(" Portfolio","").replace(" Fund","").replace(" Trust","")),
        datasets: [
          { label: "RPI, same span", data: rows.map(f => f.rpi.rpi), backgroundColor: "#b7b1a4" },
          { label: "Real return", data: rows.map(f => f.rpi.real), backgroundColor: rows.map(f => f.rpi.real >= 0 ? "#1f4d3a" : "#8d2f2f") }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", scales: { x: pctScale } }
    });
    const head = `<thead><tr><th class="left" data-k="name">Fund</th><th data-k="years">Years</th><th data-k="cagr">Fund CAGR</th><th data-k="rpi">RPI</th><th data-k="real">Real return</th></tr></thead>`;
    const body = rows.map(f => `<tr>${nameCell(f)}<td>${f.rpi.years.toFixed(2)}</td><td class="${cls(f.rpi.cagr)}">${pct(f.rpi.cagr)}</td><td>${pct(f.rpi.rpi)}</td><td class="${cls(f.rpi.real)}">${pct(f.rpi.real)}</td></tr>`).join("");
    $("grid").innerHTML = head + `<tbody>${body}</tbody>`;
    bindSort(drawRpi);
  }

  function drawMarkets() {
    const group = $("group");
    if (!group.dataset.ready) {
      [...new Set(window.PAW.markets.map(m => m.group))].sort().forEach(g => {
        const o = document.createElement("option");
        o.value = g; o.textContent = g; group.appendChild(o);
      });
      group.dataset.ready = "1";
    }
    const q = ($("q").value || "").toLowerCase();
    let rows = window.PAW.markets.filter(m => (!group.value || m.group === group.value) && (!q || m.name.toLowerCase().includes(q)));
    rows.sort((a, b) => (sortKey === "name" ? a.name.localeCompare(b.name) : (a.ytd - b.ytd)) * (sortDir || -1));
    if (!sortKey) rows.sort((a, b) => b.ytd - a.ytd);
    if (chart) chart.destroy();
    chart = new Chart($("chart"), {
      type: "bar",
      data: {
        labels: rows.map(m => m.name),
        datasets: [{ label: "YTD", data: rows.map(m => m.ytd), backgroundColor: rows.map(m => m.ytd >= 0 ? "#1f4d3a" : "#8d2f2f") }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: pctScale } }
    });
    const head = `<thead><tr><th class="left" data-k="name">Market</th><th>Group</th><th>Start</th><th>Latest</th><th data-k="ytd">YTD</th></tr></thead>`;
    const body = rows.map(m => `<tr><td class="left"><span class="name">${m.name}</span><span class="meta">${m.symbol}</span></td><td class="left">${m.group}</td><td class="left">${m.startPrice}</td><td class="left">${m.endPrice}</td><td class="${cls(m.ytd)}">${pct(m.ytd)}</td></tr>`).join("");
    $("grid").innerHTML = head + `<tbody>${body}</tbody>`;
    bindSort(drawMarkets);
  }

  const draw = { heatmap: drawHeat, rolling: drawRolling, cagr: drawCagr, rpi: drawRpi, markets: drawMarkets }[page];
  if (page !== "markets") fillFilters();
  ["q","house","role","group"].forEach(id => $(id)?.addEventListener("input", draw));
  draw();
})();
