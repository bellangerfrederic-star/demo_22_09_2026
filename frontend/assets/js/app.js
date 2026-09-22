/* ---------------------------------------------------------------------------
 * MyDataQuality — couche interface (POC).
 * Aucun appel reseau : parsing, regles et rendu s'executent dans le navigateur.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var state = { report: null, severityFilter: "all", sort: { key: "health", dir: "asc" }, search: "" };

  /* --------------------------------- icones ------------------------------ */
  var ICON = {
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    users: '<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="4"/><path d="M22 19v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>',
    heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    alert: '<path d="M12 9v4m0 4h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    ticket: '<path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z"/><path d="M13 5v14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    scale: '<path d="M12 3v18M7 7h10M5 11l2.5-5L10 11a2.5 2.5 0 0 1-5 0zM14 11l2.5-5L19 11a2.5 2.5 0 0 1-5 0z"/>',
    brain: '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 7 17a3 3 0 0 0 5 2 3 3 0 0 0 5-2 3 3 0 0 0 2-5.2A3 3 0 0 0 18 6a3 3 0 0 0-3-3 3 3 0 0 0-3 1.5A3 3 0 0 0 9 3z"/>'
  };
  function icon(name, size, stroke) {
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + (stroke || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICON[name] + '</svg>';
  }

  /* --------------------------------- helpers ----------------------------- */

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmtPct(x, d) { return (x * 100).toFixed(d === undefined ? 1 : d).replace(".", ",") + " %"; }
  function fmtNum(n) { return new Intl.NumberFormat("fr-FR").format(n); }
  function toneOf(score) {
    if (score >= 85) return "good";
    if (score >= 70) return "warning";
    if (score >= 50) return "serious";
    return "critical";
  }
  function toneColor(tone) {
    return getComputedStyle(document.documentElement).getPropertyValue("--" + tone).trim() || "#2a78d6";
  }
  var SEV_LABEL = { critical: "Critique", major: "Majeur", minor: "Mineur", none: "Conforme" };
  function sevBadge(sev) {
    if (sev === "none") return '<span class="sev sev--good">' + icon("check", 12, 2.4) + "Conforme</span>";
    return '<span class="sev sev--' + sev + '">' + icon("alert", 12, 2.2) + SEV_LABEL[sev] + "</span>";
  }

  /* Badge de verdict global : libelle metier, jamais la couleur seule */
  var GRADE_BADGE = {
    "Excellent":  { cls: "good",     icon: "check", label: "Prêt pour l\u2019IA" },
    "Bon":        { cls: "good",     icon: "check", label: "Exploitable sous réserve" },
    "Acceptable": { cls: "minor",    icon: "alert", label: "À corriger avant production" },
    "Fragile":    { cls: "major",    icon: "alert", label: "Remédiation requise" },
    "Critique":   { cls: "critical", icon: "alert", label: "Pipeline à bloquer" }
  };
  function gradeBadge(grade) {
    var g = GRADE_BADGE[grade.label] || GRADE_BADGE.Acceptable;
    return '<span class="sev sev--' + g.cls + '">' + icon(g.icon, 12, 2.4) + g.label + "</span>";
  }

  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("is-visible"); }, 3200);
  }

  function showView(id) {
    $$(".view").forEach(function (v) { v.classList.toggle("is-active", v.id === id); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* --------------------------------- theme ------------------------------- */

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem("dq-theme"); } catch (e) { /* mode prive */ }
    if (stored) document.documentElement.setAttribute("data-theme", stored);
    $("#themeToggle").addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      if (!current) {
        current = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("dq-theme", next); } catch (e) { /* ignore */ }
      renderThemeIcon();
      if (state.report) { renderReport(state.report); }
    });
    renderThemeIcon();
  }
  function renderThemeIcon() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark" ||
      (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    $("#themeToggle").innerHTML = isDark ? icon("sun", 17) : icon("moon", 17);
    $("#themeToggle").setAttribute("aria-label", isDark ? "Passer en thème clair" : "Passer en thème sombre");
  }

  /* -------------------------------- accueil ------------------------------ */

  function renderSamples() {
    var wrap = $("#samples");
    wrap.innerHTML = Object.keys(window.DQ_SAMPLES).map(function (key) {
      var s = window.DQ_SAMPLES[key];
      return '<button class="card sample" data-sample="' + esc(key) + '">' +
        '<div class="sample__icon">' + icon(s.icon, 19) + "</div>" +
        '<div class="sample__name">' + esc(s.label) + "</div>" +
        '<div class="sample__desc">' + esc(s.description) + "</div>" +
        '<div class="sample__cta">Analyser ' + icon("arrow", 15) + "</div>" +
        "</button>";
    }).join("");
    $$("[data-sample]", wrap).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var s = window.DQ_SAMPLES[btn.getAttribute("data-sample")];
        var parsed = window.DQEngine.parseCSV(s.csv);
        runAnalysis({ name: s.file, source: "jeu de démonstration", columns: parsed.columns, rows: parsed.rows });
      });
    });
  }

  function initUpload() {
    var zone = $("#dropzone"), input = $("#fileInput");
    zone.addEventListener("click", function (e) {
      if (e.target.closest("button") && e.target.closest("button").dataset.noopen) return;
      input.click();
    });
    zone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
    });
    zone.addEventListener("drop", function (e) {
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) readFile(input.files[0]);
      input.value = "";
    });
  }

  function readFile(file) {
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (["xlsx", "xls"].indexOf(ext) !== -1) {
      toast("Excel non pris en charge dans ce POC : convertissez en CSV (les 3 jeux de démonstration sont prêts).");
      return;
    }
    if (["csv", "json", "txt", "tsv"].indexOf(ext) === -1) {
      toast("Format non reconnu. Formats acceptés : CSV, TSV, JSON.");
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () { toast("Lecture du fichier impossible."); };
    reader.onload = function () {
      try {
        var text = String(reader.result);
        var parsed = ext === "json" ? window.DQEngine.parseJSON(text) : window.DQEngine.parseCSV(text);
        runAnalysis({
          name: file.name,
          source: "fichier local (" + Math.max(1, Math.round(file.size / 1024)) + " Ko)",
          columns: parsed.columns,
          rows: parsed.rows
        });
      } catch (err) {
        toast("Fichier illisible : " + err.message);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  /* ------------------------------- analyse ------------------------------- */

  var STEPS = [
    { label: "Ingestion du fichier", meta: "lecture, détection du séparateur, typage des colonnes" },
    { label: "Data Validator", meta: "application du catalogue de règles JSON" },
    { label: "Data Analyst", meta: "anomalies statistiques et risque de biais IA" },
    { label: "Report Generator", meta: "score qualité, synthèse et tickets" }
  ];

  function runAnalysis(dataset) {
    showView("view-analysis");
    $("#analysisFile").textContent = dataset.name + " — " + fmtNum(dataset.rows.length) + " lignes × " + dataset.columns.length + " colonnes";
    var list = $("#steps");
    list.innerHTML = STEPS.map(function (s, i) {
      return '<li class="step" data-i="' + i + '"><span class="step__dot">' + "</span>" +
        '<span><span class="step__label">' + esc(s.label) + "</span><br>" +
        '<span class="step__meta">' + esc(s.meta) + "</span></span></li>";
    }).join("");

    var report = null, i = 0;
    var tick = function () {
      $$(".step", list).forEach(function (el, idx) {
        el.classList.toggle("is-active", idx === i);
        el.classList.toggle("is-done", idx < i);
        if (idx < i) el.querySelector(".step__dot").innerHTML = icon("check", 12, 3);
      });
      $("#progressBar").style.width = Math.round((i / STEPS.length) * 100) + "%";

      if (i === 1 && !report) {
        try {
          report = window.DQEngine.analyze(dataset);
        } catch (err) {
          toast("Analyse impossible : " + err.message);
          showView("view-home");
          return;
        }
      }
      i++;
      if (i <= STEPS.length) {
        setTimeout(tick, i === 1 ? 420 : 380);
      } else {
        $("#progressBar").style.width = "100%";
        setTimeout(function () {
          state.report = report;
          state.severityFilter = "all";
          state.search = "";
          state.sort = { key: "health", dir: "asc" };
          renderReport(report);
          showView("view-report");
        }, 260);
      }
    };
    tick();
  }

  /* -------------------------------- rapport ------------------------------ */

  function renderReport(r) {
    renderHeader(r);
    renderScore(r);
    renderStats(r);
    renderDimensions(r);
    renderBias(r);
    renderIssues(r);
    renderTable(r);
    renderTickets(r);
    renderRules(r);
  }

  function renderHeader(r) {
    $("#reportName").textContent = r.meta.name;
    $("#reportMeta").innerHTML = [
      icon("grid", 14) + " " + fmtNum(r.meta.rowCount) + " lignes × " + r.meta.colCount + " colonnes",
      icon("shield", 14) + " " + r.meta.rulesEvaluated + " règles évaluées",
      icon("clock", 14) + " analyse en " + r.meta.durationMs + " ms",
      icon("doc", 14) + " " + esc(r.meta.source)
    ].map(function (h) { return "<span>" + h + "</span>"; }).join("");
  }

  function renderScore(r) {
    var tone = r.grade.tone, color = toneColor(tone);
    var radius = 72, circ = 2 * Math.PI * radius;
    $("#scoreCard").innerHTML =
      '<div class="gauge">' +
        '<svg width="168" height="168" viewBox="0 0 168 168" role="img" aria-label="Score qualité ' + r.score + ' sur 100">' +
          '<circle class="gauge__track" cx="84" cy="84" r="' + radius + '" fill="none" stroke-width="13"/>' +
          '<circle class="gauge__value" cx="84" cy="84" r="' + radius + '" fill="none" stroke-width="13" ' +
            'stroke="' + color + '" stroke-dasharray="' + circ + '" stroke-dashoffset="' + circ + '"/>' +
        "</svg>" +
        '<div class="gauge__center"><div class="gauge__num">' + r.score + "</div>" +
        '<div class="gauge__den">sur 100</div></div>' +
      "</div>" +
      '<div class="score-card__body">' +
        '<div class="eyebrow">Score de qualité</div>' +
        '<h2 style="font-size:24px;margin-top:6px">' + esc(r.grade.label) + " " + gradeBadge(r.grade) + "</h2>" +
        '<p class="score-card__verdict">' + esc(r.grade.verdict) + "</p>" +
        '<p class="score-card__formula">' + esc(r.scoring.formula) +
          (r.scoring.biasPenalty ? " · pénalité appliquée : −" + r.scoring.biasPenalty + " pts" : "") + "</p>" +
      "</div>";
    requestAnimationFrame(function () {
      var el = $(".gauge__value");
      if (el) el.style.strokeDashoffset = String(circ * (1 - r.score / 100));
    });
  }

  function renderStats(r) {
    var s = r.stats;
    var items = [
      { label: "Anomalies détectées", value: fmtNum(s.anomalies), sub: s.criticalIssues + " critiques · " + s.majorIssues + " majeures · " + s.minorIssues + " mineures", icon: "alert" },
      { label: "Cellules manquantes", value: fmtPct(s.missingRate), sub: fmtNum(s.missingCells) + " cellules sur " + fmtNum(r.meta.cellCount), icon: "grid" },
      { label: "Colonnes impactées", value: s.impactedColumns + "/" + r.meta.colCount, sub: "colonnes portant au moins une anomalie", icon: "doc" },
      { label: "Tickets générés", value: String(r.tickets.length), sub: "prêts à être poussés dans Jira", icon: "ticket" }
    ];
    $("#stats").innerHTML = items.map(function (it) {
      return '<div class="card stat">' +
        '<div class="stat__label">' + icon(it.icon, 14) + " " + esc(it.label) + "</div>" +
        '<div class="stat__value">' + esc(it.value) + "</div>" +
        '<div class="stat__sub">' + esc(it.sub) + "</div></div>";
    }).join("");
  }

  function renderDimensions(r) {
    $("#dims").innerHTML = r.dimensions.map(function (d) {
      var tone = toneOf(d.score);
      return '<div class="dim" title="' + esc(d.question) + " Conformité mesurée : " + d.conformity + "/100, plafonnée à " + d.cap + " par la sévérité la plus élevée.\">" +
        '<div class="dim__top">' +
          '<span class="dim__label">' + esc(d.label) + ' <span class="dim__weight">· poids ' + Math.round(d.weight * 100) + " %</span></span>" +
          '<span class="dim__value">' + d.score + "</span>" +
        "</div>" +
        '<div class="bar"><div class="bar__fill" data-w="' + d.score + '" style="background:' + toneColor(tone) + '"></div></div>' +
        '<div class="dim__note">' + (d.issues
          ? d.issues + " règle(s) en échec · " + fmtNum(d.anomalies) + " valeur(s) concernée(s)"
          : "aucune anomalie détectée") + "</div></div>";
    }).join("");
    requestAnimationFrame(function () {
      $$("#dims .bar__fill").forEach(function (el) { el.style.width = el.getAttribute("data-w") + "%"; });
    });
  }

  function renderBias(r) {
    var b = r.bias;
    var map = {
      high:   { cls: "critical", ic: "alert", txt: "Risque élevé" },
      medium: { cls: "minor",    ic: "alert", txt: "Risque modéré" },
      low:    { cls: "good",     ic: "check", txt: "Risque faible" }
    };
    var m = map[b.level];
    var html =
      '<div class="card__head"><span class="card__title">' + icon("brain", 16) + " Risque de biais IA</span>" +
      '<span class="card__hint">attributs sensibles</span></div>' +
      '<div class="bias__level"><span class="sev sev--' + m.cls + '">' + icon(m.ic, 12, 2.4) + m.txt + "</span></div>" +
      '<p class="bias__summary">' + esc(b.summary) + "</p>";

    html += b.findings.slice(0, 2).map(function (f) {
      var max = f.distribution[0].count;
      return '<div class="bias__finding">' +
        '<div class="bias__col"><span>' + esc(f.column) + "</span>" +
        '<span class="card__hint">' + fmtNum(f.total) + " valeurs renseignées</span></div>" +
        '<div class="dist">' + f.distribution.map(function (d) {
          return '<div class="dist__row"><span class="dist__name" title="' + esc(d.value) + '">' + esc(d.value) + "</span>" +
            '<span class="dist__track"><span class="dist__fill" style="width:' + (d.count / max * 100).toFixed(1) + '%"></span></span>' +
            '<span class="dist__val">' + fmtPct(d.count / f.total, 0) + "</span></div>";
        }).join("") + "</div>" +
        '<p class="bias__note">' + esc(f.note) + "</p></div>";
    }).join("");

    if (!b.findings.length) {
      html += '<p class="bias__note" style="margin-top:14px">Aucun attribut sensible déséquilibré parmi les colonnes analysées.</p>';
    }
    $("#biasCard").innerHTML = html;
  }

  function renderIssues(r) {
    var counts = { all: r.issues.length, critical: 0, major: 0, minor: 0 };
    r.issues.forEach(function (i) { counts[i.severity]++; });
    var filters = [
      { key: "all", label: "Toutes" }, { key: "critical", label: "Critiques" },
      { key: "major", label: "Majeures" }, { key: "minor", label: "Mineures" }
    ];
    $("#issueFilters").innerHTML = filters.map(function (f) {
      return '<button class="chip' + (state.severityFilter === f.key ? " is-active" : "") + '" data-sev="' + f.key + '">' +
        esc(f.label) + " (" + counts[f.key] + ")</button>";
    }).join("");
    $$("#issueFilters .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        state.severityFilter = c.getAttribute("data-sev");
        renderIssues(state.report);
      });
    });

    var list = r.issues.filter(function (i) {
      return state.severityFilter === "all" || i.severity === state.severityFilter;
    });
    var toneMap = { critical: "critical", major: "serious", minor: "warning" };

    $("#issues").innerHTML = list.length ? list.map(function (iss, idx) {
      return '<div class="issue" data-idx="' + idx + '">' +
        '<button class="issue__btn" aria-expanded="false">' +
          '<span class="issue__stripe" style="background:' + toneColor(toneMap[iss.severity]) + '"></span>' +
          sevBadge(iss.severity) +
          '<span class="issue__main"><span class="issue__title">' + esc(iss.title) + "</span>" +
          '<span class="issue__sub">' + esc(iss.rule) + (iss.column ? " · colonne " + esc(iss.column) : " · dataset") + "</span></span>" +
          '<span class="issue__count">' + fmtNum(iss.count) + " valeur(s)</span>" +
          '<span class="issue__caret">' + icon("chevron", 16) + "</span>" +
        "</button>" +
        '<div class="issue__body">' +
          '<div class="issue__row"><b>Règle.</b> ' + esc(iss.description || "") + "</div>" +
          '<div class="issue__row"><b>Impact IA.</b> ' + esc(iss.impact || "") + "</div>" +
          '<div class="issue__row"><b>Correction proposée.</b> ' + esc(iss.fix || "") + "</div>" +
          (iss.samples && iss.samples.length
            ? '<div class="issue__row"><b>Exemples.</b><div class="samples">' +
              iss.samples.map(function (s) { return "<code>" + esc(s) + "</code>"; }).join("") + "</div></div>"
            : "") +
        "</div></div>";
    }).join("") : '<p class="card__hint">Aucune anomalie pour ce filtre.</p>';

    $$("#issues .issue__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var parent = btn.parentNode;
        var open = parent.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  var COLS = [
    { key: "name", label: "Colonne" },
    { key: "type", label: "Type" },
    { key: "missingRate", label: "Manquants", num: true },
    { key: "distinctCount", label: "Distinctes", num: true },
    { key: "anomalies", label: "Anomalies", num: true },
    { key: "health", label: "Santé", num: true },
    { key: "worstSeverity", label: "Sévérité" }
  ];
  var SEV_ORDER = { critical: 3, major: 2, minor: 1, none: 0 };

  function renderTable(r) {
    var rows = r.columns.filter(function (c) {
      return !state.search || c.name.toLowerCase().indexOf(state.search.toLowerCase()) !== -1;
    });
    var k = state.sort.key, dir = state.sort.dir === "asc" ? 1 : -1;
    rows = rows.slice().sort(function (a, b) {
      var va = k === "worstSeverity" ? SEV_ORDER[a[k]] : a[k];
      var vb = k === "worstSeverity" ? SEV_ORDER[b[k]] : b[k];
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });

    $("#tableHead").innerHTML = "<tr>" + COLS.map(function (c) {
      var sorted = state.sort.key === c.key;
      return '<th data-key="' + c.key + '"' + (sorted ? ' aria-sort="' + (state.sort.dir === "asc" ? "ascending" : "descending") + '"' : "") + ">" +
        esc(c.label) + "</th>";
    }).join("") + "</tr>";

    $("#tableBody").innerHTML = rows.map(function (c) {
      var tone = toneOf(c.health);
      return "<tr>" +
        '<td><div class="col-name">' + esc(c.name) + "</div>" +
          (c.semantic ? '<div class="col-type">rôle détecté : ' + esc(c.semantic) + "</div>" : "") + "</td>" +
        '<td><span class="col-type">' + esc(c.type) + "</span></td>" +
        '<td class="num">' + (c.missing ? fmtPct(c.missingRate) : "—") + "</td>" +
        '<td class="num">' + fmtNum(c.distinctCount) + "</td>" +
        '<td class="num">' + (c.anomalies ? fmtNum(c.anomalies) : "—") + "</td>" +
        '<td><div class="health"><span class="health__track">' +
          '<span class="health__fill" style="width:' + c.health + "%;background:" + toneColor(tone) + '"></span></span>' +
          '<span class="health__val">' + c.health + "</span></div></td>" +
        "<td>" + sevBadge(c.worstSeverity) + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="7" class="card__hint">Aucune colonne ne correspond à la recherche.</td></tr>';

    $$("#tableHead th").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-key");
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else state.sort = { key: key, dir: key === "name" || key === "type" ? "asc" : "desc" };
        renderTable(state.report);
      });
    });
  }

  function renderTickets(r) {
    $("#ticketCount").textContent = r.tickets.length + " ticket(s)";
    $("#tickets").innerHTML = r.tickets.map(function (t) {
      return '<div class="card ticket">' +
        '<div class="ticket__head"><span class="ticket__key">' + esc(t.key) + "</span>" +
          sevBadge(t.severity) +
          '<span class="card__hint">' + esc(t.priority) + "</span></div>" +
        '<div class="ticket__title">' + esc(t.title) + "</div>" +
        '<div class="ticket__desc">' + esc(t.description) + "</div>" +
        '<div class="ticket__action"><b>Action.</b> ' + esc(t.action) + "<br><b>Critère d’acceptation.</b> " + esc(t.acceptance) + "</div>" +
        '<div class="ticket__foot">' +
          "<span>" + icon("users", 13) + " " + esc(t.assignee) + "</span>" +
          "<span>" + icon("clock", 13) + " effort " + esc(t.effort) + "</span>" +
          "<span>" + icon("doc", 13) + " " + esc(t.labels.join(" · ")) + "</span>" +
        "</div></div>";
    }).join("") || '<p class="card__hint">Aucun ticket : le dataset ne présente pas d’anomalie majeure.</p>';
  }

  function renderRules(r) {
    var rules = window.DQ_RULES;
    var failing = {};
    r.issues.forEach(function (i) { failing[i.ruleId] = (failing[i.ruleId] || 0) + 1; });
    $("#rules").innerHTML = rules.checks.map(function (c) {
      var n = failing[c.id] || 0;
      return '<div class="rule">' +
        '<div class="rule__top"><span class="rule__label">' + esc(c.label) + "</span>" +
          (n ? '<span class="sev sev--minor">' + n + " échec(s)</span>" : '<span class="sev sev--good">' + icon("check", 11, 2.6) + "OK</span>") +
        "</div>" +
        '<div class="rule__dim">' + esc(rules.dimensions[c.dimension].label) + "</div>" +
        '<div class="rule__desc">' + esc(c.description) + "</div>" +
        '<div class="rule__id">' + esc(c.id) + "</div></div>";
    }).join("");
  }

  /* --------------------------------- export ------------------------------ */

  function exportJSON() {
    var r = state.report;
    if (!r) return;
    var payload = {
      generated_by: "MyDataQuality POC v0.1",
      generated_at: new Date().toISOString(),
      dataset: r.meta,
      score: r.score,
      grade: r.grade,
      scoring: r.scoring,
      dimensions: r.dimensions,
      statistics: r.stats,
      issues: r.issues,
      columns: r.columns.map(function (c) {
        return { name: c.name, type: c.type, missing: c.missing, missing_rate: c.missingRate, distinct: c.distinctCount, health: c.health, severity: c.worstSeverity };
      }),
      ai_bias_risk: r.bias,
      tickets: r.tickets
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "rapport-qualite-" + r.meta.name.replace(/\.[^.]+$/, "") + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Rapport JSON exporté.");
  }

  /* ---------------------------------- init ------------------------------- */

  function init() {
    initTheme();
    renderSamples();
    initUpload();
    $("#newAnalysis").addEventListener("click", function () { showView("view-home"); });
    $("#exportBtn").addEventListener("click", exportJSON);
    $("#printBtn").addEventListener("click", function () { window.print(); });
    $("#colSearch").addEventListener("input", function (e) {
      state.search = e.target.value;
      renderTable(state.report);
    });
    $("#year").textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
