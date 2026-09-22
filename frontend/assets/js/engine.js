/* ---------------------------------------------------------------------------
 * Data Quality Engine (POC front-end, 100 % navigateur).
 * Trois agents logiques du PRD :
 *   - Data Validator  : applique le catalogue de regles (rules.js)
 *   - Data Analyst    : detection d'anomalies statistiques + risque de biais IA
 *   - Report Generator: score, synthese, tickets
 * ------------------------------------------------------------------------- */
(function (global) {
  "use strict";

  var R = global.DQ_RULES;
  var SEV_WEIGHT = { critical: 1, major: 0.6, minor: 0.25 };

  /* ----------------------------- utilitaires ----------------------------- */

  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === "" ||
      ["null", "n/a", "na", "none", "-", "nan", "undefined"].indexOf(String(v).trim().toLowerCase()) !== -1;
  }
  function norm(s) { return String(s).trim().toLowerCase(); }
  function normName(s) { return String(s).trim().toLowerCase().replace(/[\s-]+/g, "_"); }
  function pct(n, d) { return d ? n / d : 0; }
  function rx(key) { return new RegExp(R.patterns[key]); }

  function parseNumber(v) {
    var s = String(v).trim().replace(/\s/g, "").replace(",", ".");
    if (s === "" || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return parseFloat(s);
  }

  /* Formatage francais : virgule decimale, separateur de milliers fin */
  function fr(x, d) {
    return Number(x).toFixed(d === undefined ? 1 : d).replace(".", ",");
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q, base = Math.floor(pos), rest = pos - base;
    return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
  }

  /* ------------------------------ parsing CSV ---------------------------- */

  function parseCSV(text) {
    var delim = detectDelimiter(text);
    var rows = [], field = "", row = [], inQuotes = false;
    text = text.replace(/^﻿/, "");
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === delim) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else { field += c; }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return r.length > 1 || (r[0] || "").trim() !== ""; });
    if (!rows.length) throw new Error("Fichier vide.");
    var header = rows.shift().map(function (h, idx) { return String(h).trim() || ("colonne_" + (idx + 1)); });
    var records = rows.map(function (r) {
      var o = {};
      header.forEach(function (h, idx) { o[h] = r[idx] === undefined ? "" : String(r[idx]).trim(); });
      return o;
    });
    return { columns: header, rows: records };
  }

  function detectDelimiter(text) {
    var line = text.split(/\r?\n/)[0] || "";
    var candidates = [",", ";", "\t", "|"], best = ",", bestCount = -1;
    candidates.forEach(function (d) {
      var n = line.split(d).length - 1;
      if (n > bestCount) { bestCount = n; best = d; }
    });
    return best;
  }

  function parseJSON(text) {
    var data = JSON.parse(text);
    if (!Array.isArray(data)) {
      var arrKey = Object.keys(data).filter(function (k) { return Array.isArray(data[k]); })[0];
      if (!arrKey) throw new Error("JSON non tabulaire.");
      data = data[arrKey];
    }
    var cols = [];
    data.forEach(function (o) {
      Object.keys(o || {}).forEach(function (k) { if (cols.indexOf(k) === -1) cols.push(k); });
    });
    var rows = data.map(function (o) {
      var r = {};
      cols.forEach(function (c) { r[c] = o && o[c] !== undefined && o[c] !== null ? String(o[c]) : ""; });
      return r;
    });
    return { columns: cols, rows: rows };
  }

  /* --------------------------- profilage colonne ------------------------- */

  function semanticOf(name) {
    var n = normName(name), found = null;
    R.semantics.some(function (s) {
      if (new RegExp(s.match).test(n)) { found = s.type; return true; }
      return false;
    });
    return found;
  }

  function profileColumn(name, values, rowCount) {
    var filled = values.filter(function (v) { return !isBlank(v); });
    var distinct = {};
    filled.forEach(function (v) { distinct[v] = (distinct[v] || 0) + 1; });
    var distinctKeys = Object.keys(distinct);
    var semantic = semanticOf(name);
    var numeric = filled.length && filled.every(function (v) { return !isNaN(parseNumber(v)); });
    var dateLike = filled.length && filled.filter(function (v) { return rx("iso_date").test(v) || rx("other_date").test(v); }).length / filled.length > 0.8;

    var type = "texte";
    if (semantic === "identifier" && distinctKeys.length > rowCount * 0.5) type = "identifiant";
    else if (numeric) type = filled.every(function (v) { return Number.isInteger(parseNumber(v)); }) ? "entier" : "décimal";
    else if (dateLike) type = "date";
    else if (semantic === "email") type = "email";
    else if (distinctKeys.length <= R.thresholds.max_categories) type = "catégoriel";

    var uniqueness = filled.length ? distinctKeys.length / filled.length : 0;
    var isPrimary = semantic === "identifier" && filled.length > 5 &&
      uniqueness >= 0.95 && distinctKeys.length > rowCount * 0.5;

    return {
      name: name,
      semantic: semantic,
      isPrimary: isPrimary,
      type: type,
      values: values,
      filled: filled,
      distinct: distinct,
      distinctCount: distinctKeys.length,
      missing: rowCount - filled.length,
      missingRate: pct(rowCount - filled.length, rowCount),
      uniqueRate: pct(distinctKeys.length, filled.length || 1),
      issues: []
    };
  }

  /* -------------------------- agent Data Validator ----------------------- */

  function severityFromRate(rate, t1, t2) {
    if (rate >= t2) return "critical";
    if (rate >= t1) return "major";
    return "minor";
  }

  function makeIssue(o) {
    var check = R.checks.filter(function (c) { return c.id === o.ruleId; })[0] || {};
    return {
      id: o.ruleId + "::" + (o.column || "dataset"),
      ruleId: o.ruleId,
      rule: check.label || o.ruleId,
      dimension: check.dimension || "validity",
      column: o.column || null,
      severity: o.severity,
      count: o.count,
      rate: o.rate,
      title: o.title,
      description: o.description || check.description,
      impact: o.impact,
      fix: o.fix || check.fix,
      samples: (o.samples || []).slice(0, 6)
    };
  }

  function enabled(id) {
    return R.checks.some(function (c) { return c.id === id && c.enabled !== false; });
  }

  function runValidator(profiles, rows, ctx) {
    var issues = [], T = R.thresholds, today = new Date().toISOString().slice(0, 10);
    var touched = {};
    Object.keys(R.dimensions).forEach(function (d) { touched[d] = {}; });
    /* memorise qu'une regle de la dimension `d` a ete evaluee sur la colonne */
    function touch(d, col) { touched[d][col || "__dataset__"] = true; }

    /* Lignes strictement dupliquees (scope dataset) */
    if (enabled("duplicate_rows")) {
      touch("uniqueness", "__dataset__");
      var seen = {}, dupes = 0, dupSamples = [];
      rows.forEach(function (r, i) {
        var key = ctx.columns.map(function (c) { return r[c]; }).join("\u0001");
        if (seen[key] !== undefined) { dupes++; if (dupSamples.length < 4) dupSamples.push("ligne " + (i + 2) + " ≡ ligne " + (seen[key] + 2)); }
        else seen[key] = i;
      });
      if (dupes) {
        issues.push(makeIssue({
          ruleId: "duplicate_rows", count: dupes, rate: pct(dupes, rows.length),
          severity: pct(dupes, rows.length) >= T.duplicate_major ? "major" : "minor",
          title: dupes + " ligne(s) strictement dupliquée(s)",
          impact: "Sur-pondération de certains profils pendant l'entraînement.",
          samples: dupSamples
        }));
      }
    }

    profiles.forEach(function (p) {
      var n = rows.length;

      /* Completude */
      if (enabled("not_null")) touch("completeness", p.name);
      if (p.missing > 0 && enabled("not_null")) {
        var isKey = p.isPrimary;
        var sev = isKey ? "critical"
          : (p.semantic === "identifier" ? "major" : severityFromRate(p.missingRate, T.missing_major, T.missing_critical));
        issues.push(makeIssue({
          ruleId: isKey ? "required_key" : "not_null", column: p.name, count: p.missing, rate: p.missingRate, severity: sev,
          title: p.missing + " valeur(s) manquante(s) sur « " + p.name + " »",
          impact: isKey
            ? "Lignes non traçables : jointures et déduplication impossibles."
            : "Le modèle devra imputer " + fr(p.missingRate * 100) + " % des valeurs de cette variable.",
          samples: ["taux de remplissage : " + fr((1 - p.missingRate) * 100) + " %"]
        }));
      }

      /* Unicite des identifiants (cles primaires uniquement) */
      if (p.isPrimary && enabled("unique_key")) {
        touch("uniqueness", p.name);
        var dupKeys = Object.keys(p.distinct).filter(function (k) { return p.distinct[k] > 1; });
        if (dupKeys.length) {
          var dupCount = dupKeys.reduce(function (a, k) { return a + p.distinct[k] - 1; }, 0);
          issues.push(makeIssue({
            ruleId: "unique_key", column: p.name, count: dupCount, rate: pct(dupCount, n), severity: "critical",
            title: dupCount + " doublon(s) d'identifiant sur « " + p.name + " »",
            impact: "Clé non fiable : risque de fuite de données entre jeux d'entraînement et de test.",
            samples: dupKeys.slice(0, 5)
          }));
        }
      }

      /* Validite : email */
      if ((p.semantic === "email" || p.type === "email") && enabled("format_email")) {
        touch("validity", p.name);
        var re = rx("email");
        var bad = p.filled.filter(function (v) { return !re.test(v); });
        if (bad.length) {
          issues.push(makeIssue({
            ruleId: "format_email", column: p.name, count: bad.length, rate: pct(bad.length, n),
            severity: severityFromRate(pct(bad.length, n), T.invalid_major, T.invalid_critical),
            title: bad.length + " adresse(s) email non conforme(s)",
            impact: "Canal de contact inexploitable et enrichissement externe faussé.",
            samples: bad
          }));
        }
      }

      /* Validite : dates + formats mixtes + dates futures */
      if (p.type === "date" || p.semantic === "date") {
        touch("validity", p.name); touch("consistency", p.name); touch("accuracy", p.name);
        var iso = rx("iso_date"), other = rx("other_date");
        var badDates = p.filled.filter(function (v) { return !iso.test(v) && !other.test(v); });
        var mixed = p.filled.filter(function (v) { return !iso.test(v) && other.test(v); });
        if (badDates.length && enabled("format_date")) {
          issues.push(makeIssue({
            ruleId: "format_date", column: p.name, count: badDates.length, rate: pct(badDates.length, n),
            severity: "major", title: badDates.length + " date(s) illisible(s) sur « " + p.name + " »",
            impact: "Parsing en échec : lignes rejetées ou date nulle silencieuse.", samples: badDates
          }));
        }
        if (mixed.length && enabled("mixed_formats")) {
          issues.push(makeIssue({
            ruleId: "mixed_formats", column: p.name, count: mixed.length, rate: pct(mixed.length, n),
            severity: "major", title: "Formats de date hétérogènes sur « " + p.name + " »",
            impact: "Ambiguïté JJ/MM vs MM/JJ : décalages temporels invisibles.", samples: mixed
          }));
        }
        if (enabled("future_date")) {
          var future = p.filled.filter(function (v) { return iso.test(v) && v > today; });
          if (future.length) {
            issues.push(makeIssue({
              ruleId: "future_date", column: p.name, count: future.length, rate: pct(future.length, n),
              severity: "major", title: future.length + " date(s) dans le futur sur « " + p.name + " »",
              impact: "Incohérence temporelle : fuite de données futures dans les features.", samples: future
            }));
          }
        }
      }

      /* Validite : numerique + plages */
      var numericSemantics = ["amount", "age", "ratio"];
      if (p.type === "entier" || p.type === "décimal" || numericSemantics.indexOf(p.semantic) !== -1) {
        touch("validity", p.name);
        var nonNum = p.filled.filter(function (v) { return isNaN(parseNumber(v)); });
        if (nonNum.length && enabled("format_number")) {
          issues.push(makeIssue({
            ruleId: "format_number", column: p.name, count: nonNum.length, rate: pct(nonNum.length, n),
            severity: "major", title: nonNum.length + " valeur(s) non numérique(s) sur « " + p.name + " »",
            impact: "Typage instable : la colonne bascule en texte à l'ingestion.", samples: nonNum
          }));
        }
        var range = R.ranges[p.semantic];
        if (range && enabled("range_check")) {
          var out = p.filled.filter(function (v) {
            var x = parseNumber(v);
            if (isNaN(x)) return false;
            return (range.min !== null && x < range.min) || (range.max !== null && x > range.max);
          });
          if (out.length) {
            issues.push(makeIssue({
              ruleId: "range_check", column: p.name, count: out.length, rate: pct(out.length, n),
              severity: severityFromRate(pct(out.length, n), 0.005, T.invalid_major),
              title: out.length + " valeur(s) hors plage sur « " + p.name + " »",
              description: "Plage attendue : [" + (range.min === null ? "-∞" : range.min) + " ; " + (range.max === null ? "+∞" : range.max) + "].",
              impact: "Valeurs impossibles : le modèle apprend du bruit.", samples: out
            }));
          }
        }
      }

      /* Coherence : referentiel */
      var domain = R.domains[p.semantic];
      if (domain && enabled("allowed_values")) {
        touch("consistency", p.name);
        var offenders = p.filled.filter(function (v) { return domain.indexOf(String(v).trim().toUpperCase()) === -1; });
        if (offenders.length) {
          var uniqOff = offenders.filter(function (v, i, a) { return a.indexOf(v) === i; });
          issues.push(makeIssue({
            ruleId: "allowed_values", column: p.name, count: offenders.length, rate: pct(offenders.length, n),
            severity: severityFromRate(pct(offenders.length, n), 0.01, T.invalid_critical),
            title: uniqOff.length + " valeur(s) hors référentiel sur « " + p.name + " »",
            description: "Référentiel attendu : " + domain.slice(0, 8).join(", ") + (domain.length > 8 ? "…" : "") + ".",
            impact: "Segmentation faussée et jointures référentielles en échec.", samples: uniqOff
          }));
        }
      }

      /* Coherence : variantes de casse / espaces */
      if (enabled("case_variants") && (p.type === "catégoriel" || p.type === "texte") && p.distinctCount <= 60) {
        touch("consistency", p.name);
        var groups = {};
        Object.keys(p.distinct).forEach(function (v) {
          var k = norm(v);
          (groups[k] = groups[k] || []).push(v);
        });
        var variants = Object.keys(groups).filter(function (k) { return groups[k].length > 1; });
        if (variants.length) {
          /* lignes a corriger = tout le groupe moins la graphie majoritaire */
          var affected = variants.reduce(function (a, k) {
            var counts = groups[k].map(function (v) { return p.distinct[v]; });
            var total = counts.reduce(function (x, y) { return x + y; }, 0);
            return a + (total - Math.max.apply(null, counts));
          }, 0);
          issues.push(makeIssue({
            ruleId: "case_variants", column: p.name, count: affected, rate: pct(affected, n),
            severity: "major",
            title: variants.length + " modalité(s) écrite(s) de plusieurs façons sur « " + p.name + " »",
            impact: "Une même catégorie est comptée plusieurs fois : distribution erronée.",
            samples: variants.slice(0, 4).map(function (k) { return groups[k].map(function (v) { return '"' + v + '"'; }).join(" / "); })
          }));
        }
      }

      /* Exactitude : colonne constante */
      if (enabled("constant_column") && p.filled.length > 5 && p.distinctCount === 1) {
        issues.push(makeIssue({
          ruleId: "constant_column", column: p.name, count: p.filled.length, rate: 0, severity: "minor",
          title: "« " + p.name + " » est constante",
          impact: "Aucune variance : la feature est inutile pour le modèle.",
          samples: [Object.keys(p.distinct)[0]]
        }));
      }

      /* Exactitude : valeurs aberrantes (IQR) */
      if (enabled("outlier_iqr") && (p.type === "entier" || p.type === "décimal") && p.semantic !== "identifier" && p.filled.length >= 12) {
        touch("accuracy", p.name);
        var nums = p.filled.map(parseNumber).filter(function (x) { return !isNaN(x); }).sort(function (a, b) { return a - b; });
        var q1 = quantile(nums, 0.25), q3 = quantile(nums, 0.75), iqr = q3 - q1;
        if (iqr > 0) {
          var lo = q1 - T.outlier_iqr * iqr, hi = q3 + T.outlier_iqr * iqr;
          var xlo = q1 - T.extreme_iqr * iqr, xhi = q3 + T.extreme_iqr * iqr;
          var outliers = nums.filter(function (x) { return x < lo || x > hi; });
          var extremes = nums.filter(function (x) { return x < xlo || x > xhi; });
          if (outliers.length) {
            issues.push(makeIssue({
              ruleId: "outlier_iqr", column: p.name, count: outliers.length, rate: pct(outliers.length, n),
              severity: extremes.length ? "major" : "minor",
              title: outliers.length + " valeur(s) aberrante(s) sur « " + p.name + " »",
              description: "Hors [" + fr(lo, 2) + " ; " + fr(hi, 2) + "] (IQR × " + T.outlier_iqr + ")" +
                (extremes.length ? ", dont " + extremes.length + " extrême(s) (IQR × " + T.extreme_iqr + ")." : "."),
              impact: "Les extrêmes tirent la moyenne et déforment l'apprentissage.",
              samples: outliers.slice(0, 3).concat(outliers.slice(-3)).filter(function (v, i, a) { return a.indexOf(v) === i; })
                .map(function (x) { return String(x); })
            }));
          }
        }
      }
    });

    /* Coherence croisee : ordre chronologique entre deux colonnes de dates.
       L'ordre attendu est deduit des donnees (>= 85 % des lignes dans le meme sens). */
    if (enabled("date_order")) {
      var dateCols = profiles.filter(function (p) {
        return (p.type === "date" || p.semantic === "date") && p.filled.length > 5;
      }).slice(0, 6);
      for (var a = 0; a < dateCols.length; a++) {
        for (var b = a + 1; b < dateCols.length; b++) {
          var A = dateCols[a], B = dateCols[b], iso = rx("iso_date");
          var compared = 0, ordered = 0, breaches = [];
          rows.forEach(function (row, idx) {
            var x = row[A.name], y = row[B.name];
            if (isBlank(x) || isBlank(y) || !iso.test(x) || !iso.test(y)) return;
            compared++;
            if (y >= x) ordered++;
            else breaches.push({ line: idx + 2, x: x, y: y });
          });
          if (compared < 10) continue;
          var ratio = ordered / compared;
          if (ratio >= 0.85 && ratio < 1) {
            touch("consistency", A.name + "↔" + B.name);
            issues.push(makeIssue({
              ruleId: "date_order", column: B.name, count: breaches.length, rate: pct(breaches.length, rows.length),
              severity: "major",
              title: breaches.length + " ligne(s) où « " + B.name + " » précède « " + A.name + " »",
              description: "Ordre chronologique déduit des données : « " + B.name + " » ≥ « " + A.name + " » sur " +
                fr(ratio * 100) + " % des lignes.",
              impact: "Durées négatives et features temporelles faussées.",
              samples: breaches.slice(0, 4).map(function (br) {
                return "ligne " + br.line + " : " + br.x + " → " + br.y;
              })
            }));
          }
        }
      }
    }

    issues.forEach(function (iss) {
      if (!iss.column) return;
      var p = profiles.filter(function (x) { return x.name === iss.column; })[0];
      if (p) p.issues.push(iss);
    });
    return { issues: issues, touched: touched };
  }

  /* --------------------------- agent Data Analyst ------------------------ */

  function runAnalyst(profiles, rows) {
    var T = R.thresholds, findings = [];

    profiles.forEach(function (p) {
      var sensitive = R.sensitive_attributes.some(function (k) { return normName(p.name).indexOf(k) !== -1; });
      if (!sensitive) return;
      if (p.distinctCount > T.max_categories || !p.filled.length) return;

      var entries = Object.keys(p.distinct).map(function (k) { return { value: k, count: p.distinct[k] }; })
        .sort(function (a, b) { return b.count - a.count; });
      var top = entries[0];
      var share = top.count / p.filled.length;
      var level = share >= T.bias_dominance_critical ? "critical" : (share >= T.bias_dominance ? "major" : null);
      var missingIssue = p.missingRate >= 0.05;

      if (level || missingIssue) {
        findings.push({
          column: p.name,
          distribution: entries.slice(0, 6),
          total: p.filled.length,
          dominantValue: top.value,
          dominantShare: share,
          missingRate: p.missingRate,
          level: level || "minor",
          note: level
            ? "« " + top.value + " » représente " + fr(share * 100, 0) + " % des valeurs : un modèle entraîné sur ce jeu sous-apprendra les autres modalités."
            : fr(p.missingRate * 100) + " % de valeurs manquantes sur un attribut sensible : la population non renseignée devient invisible pour le modèle."
        });
      }
    });

    var worst = findings.reduce(function (a, f) { return Math.max(a, f.dominantShare || 0); }, 0);
    var level = "low";
    if (findings.some(function (f) { return f.level === "critical"; })) level = "high";
    else if (findings.length) level = "medium";

    return {
      level: level,
      worstShare: worst,
      findings: findings.sort(function (a, b) { return (b.dominantShare || 0) - (a.dominantShare || 0); }),
      summary: level === "high"
        ? "Déséquilibre marqué sur un attribut sensible : risque élevé de décision discriminante en production."
        : level === "medium"
          ? "Déséquilibres modérés détectés : à documenter dans la fiche modèle avant entraînement."
          : "Aucun déséquilibre significatif détecté sur les attributs sensibles."
    };
  }

  /* ------------------------- agent Report Generator ---------------------- */

  /* Score d'une dimension = taux de cellules conformes, plafonne par la severite
     la plus elevee rencontree (une anomalie critique ne peut pas rester "verte"). */
  function capFor(counts) {
    if (counts.critical) return Math.max(35, 70 - 5 * (counts.critical - 1));
    if (counts.major) return Math.max(62, 88 - 4 * (counts.major - 1));
    if (counts.minor) return Math.max(88, 96 - 2 * (counts.minor - 1));
    return 100;
  }

  function scoreDimensions(issues, touched, profiles, rowCount) {
    return Object.keys(R.dimensions).map(function (d) {
      var dimIssues = issues.filter(function (i) { return i.dimension === d; });
      var checkedCols = Object.keys(touched[d] || {}).length;
      var denom = Math.max(checkedCols * rowCount, rowCount);

      var affected = dimIssues.reduce(function (a, i) {
        var keyBoost = (i.ruleId === "required_key" || i.ruleId === "unique_key") ? 3 : 1;
        return a + i.count * keyBoost;
      }, 0);
      var conformity = 100 * (1 - Math.min(1, affected / denom));

      var counts = { critical: 0, major: 0, minor: 0 };
      dimIssues.forEach(function (i) { counts[i.severity]++; });

      return {
        key: d,
        label: R.dimensions[d].label,
        question: R.dimensions[d].question,
        weight: R.weights[d],
        score: Math.round(Math.min(conformity, capFor(counts))),
        conformity: Math.round(conformity),
        cap: capFor(counts),
        checkedColumns: checkedCols,
        issues: dimIssues.length,
        anomalies: dimIssues.reduce(function (a, i) { return a + i.count; }, 0)
      };
    });
  }

  function gradeOf(score) {
    if (score >= 90) return { label: "Excellent", tone: "good", verdict: "Dataset exploitable en l'état pour l'entraînement." };
    if (score >= 75) return { label: "Bon", tone: "good", verdict: "Exploitable après correction des anomalies majeures." };
    if (score >= 60) return { label: "Acceptable", tone: "warning", verdict: "Corrections requises avant mise en production du modèle." };
    if (score >= 40) return { label: "Fragile", tone: "serious", verdict: "Remédiation nécessaire : le pipeline IA doit être bloqué." };
    return { label: "Critique", tone: "critical", verdict: "Dataset non exploitable : reprise à la source indispensable." };
  }

  var PRIORITY = { critical: "P1", major: "P2", minor: "P3" };
  var OWNER = {
    completeness: "Data Engineer", uniqueness: "Data Engineer", validity: "Data Steward",
    consistency: "Data Steward", accuracy: "Data Analyst"
  };
  var EFFORT = { critical: "M", major: "S", minor: "XS" };

  function generateTickets(issues, bias, datasetName) {
    var tickets = issues
      .filter(function (i) { return i.severity !== "minor"; })
      .sort(function (a, b) { return SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] || b.count - a.count; })
      .slice(0, 8)
      .map(function (iss, i) {
        return {
          key: "DQ-" + (101 + i),
          priority: PRIORITY[iss.severity],
          severity: iss.severity,
          title: iss.title,
          column: iss.column,
          dataset: datasetName,
          description: (iss.description || "") + " " + (iss.impact || ""),
          action: iss.fix,
          acceptance: iss.column
            ? "0 anomalie « " + iss.rule + " » sur la colonne " + iss.column + " lors du prochain contrôle."
            : "0 anomalie « " + iss.rule + " » sur le dataset lors du prochain contrôle.",
          assignee: OWNER[iss.dimension] || "Data Steward",
          effort: EFFORT[iss.severity],
          labels: ["data-quality", iss.dimension, iss.ruleId]
        };
      });

    if (bias.level === "high") {
      var f = bias.findings[0];
      tickets.unshift({
        key: "DQ-100",
        priority: "P1",
        severity: "critical",
        title: "Risque de biais IA sur « " + f.column + " »",
        column: f.column,
        dataset: datasetName,
        description: f.note,
        action: "Rééquilibrer l'échantillon (sur/sous-échantillonnage ou pondération) et documenter la distribution dans la fiche modèle.",
        acceptance: "Part de la modalité dominante ramenée sous 70 % ou pondération validée par le métier.",
        assignee: "ML Engineer",
        effort: "L",
        labels: ["ai-risk", "bias", "fairness"]
      });
    }
    return tickets;
  }

  /* ------------------------------- pipeline ------------------------------ */

  function analyze(dataset) {
    var t0 = (global.performance && performance.now) ? performance.now() : Date.now();
    var rows = dataset.rows, columns = dataset.columns;
    if (!rows.length) throw new Error("Aucune ligne exploitable dans le fichier.");

    var profiles = columns.map(function (c) {
      return profileColumn(c, rows.map(function (r) { return r[c]; }), rows.length);
    });

    var validation = runValidator(profiles, rows, { columns: columns });
    var issues = validation.issues;
    var bias = runAnalyst(profiles, rows);
    var dimensions = scoreDimensions(issues, validation.touched, profiles, rows.length);

    var biasPenalty = bias.level === "high" ? 6 : (bias.level === "medium" ? 2 : 0);
    var score = Math.round(dimensions.reduce(function (a, d) { return a + d.score * d.weight; }, 0));
    score = Math.max(0, score - biasPenalty);

    var missingCells = profiles.reduce(function (a, p) { return a + p.missing; }, 0);
    var anomalies = issues.reduce(function (a, i) { return a + i.count; }, 0);
    var t1 = (global.performance && performance.now) ? performance.now() : Date.now();

    var columnsReport = profiles.map(function (p) {
      var worst = p.issues.reduce(function (a, i) {
        return (SEV_WEIGHT[i.severity] || 0) > (SEV_WEIGHT[a] || 0) ? i.severity : a;
      }, "none");
      var health = Math.max(0, 100 - p.issues.reduce(function (a, i) {
        return a + SEV_WEIGHT[i.severity] * (25 + 55 * Math.min(i.count / Math.max(rows.length, 1), 1));
      }, 0));
      return {
        name: p.name, type: p.type, semantic: p.semantic,
        missing: p.missing, missingRate: p.missingRate,
        distinctCount: p.distinctCount, uniqueRate: p.uniqueRate,
        issueCount: p.issues.length,
        anomalies: p.issues.reduce(function (a, i) { return a + i.count; }, 0),
        worstSeverity: worst,
        health: Math.round(health),
        issues: p.issues
      };
    });

    return {
      meta: {
        name: dataset.name,
        source: dataset.source || "fichier local",
        rowCount: rows.length,
        colCount: columns.length,
        cellCount: rows.length * columns.length,
        analyzedAt: new Date(),
        durationMs: Math.max(1, Math.round(t1 - t0)),
        rulesEvaluated: R.checks.filter(function (c) { return c.enabled !== false; }).length
      },
      score: score,
      grade: gradeOf(score),
      scoring: {
        formula: "Score = Σ (poids × score de la dimension) − pénalité de biais IA",
        biasPenalty: biasPenalty,
        weights: R.weights
      },
      dimensions: dimensions,
      issues: issues.sort(function (a, b) { return SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] || b.count - a.count; }),
      columns: columnsReport,
      bias: bias,
      tickets: generateTickets(issues, bias, dataset.name),
      stats: {
        missingCells: missingCells,
        missingRate: pct(missingCells, Math.max(rows.length * columns.length, 1)),
        anomalies: anomalies,
        impactedColumns: columnsReport.filter(function (c) { return c.issueCount > 0; }).length,
        criticalIssues: issues.filter(function (i) { return i.severity === "critical"; }).length,
        majorIssues: issues.filter(function (i) { return i.severity === "major"; }).length,
        minorIssues: issues.filter(function (i) { return i.severity === "minor"; }).length
      }
    };
  }

  global.DQEngine = {
    analyze: analyze,
    parseCSV: parseCSV,
    parseJSON: parseJSON,
    isBlank: isBlank
  };
})(window);
