/* ---------------------------------------------------------------------------
 * Catalogue de regles qualite (format JSON, conformement au PRD).
 * Le moteur (engine.js) lit ce catalogue : ajouter une regle ici suffit.
 * ------------------------------------------------------------------------- */
window.DQ_RULES = {
  version: "0.1.0",

  /* Ponderation des dimensions dans le score global (somme = 1) */
  weights: {
    completeness: 0.25,
    uniqueness: 0.20,
    validity: 0.25,
    consistency: 0.15,
    accuracy: 0.15
  },

  dimensions: {
    completeness: { label: "Complétude", question: "Les valeurs attendues sont-elles présentes ?" },
    uniqueness:   { label: "Unicité",    question: "Les enregistrements sont-ils dédupliqués ?" },
    validity:     { label: "Validité",   question: "Les formats et plages sont-ils respectés ?" },
    consistency:  { label: "Cohérence",  question: "Les valeurs suivent-elles un référentiel stable ?" },
    accuracy:     { label: "Exactitude", question: "Les valeurs sont-elles plausibles ?" }
  },

  thresholds: {
    missing_minor: 0.01,
    missing_major: 0.08,
    missing_critical: 0.20,
    duplicate_major: 0.01,
    invalid_major: 0.03,
    invalid_critical: 0.10,
    outlier_iqr: 1.5,
    extreme_iqr: 3.0,
    bias_dominance: 0.70,
    bias_dominance_critical: 0.85,
    max_categories: 25
  },

  patterns: {
    email: "^[\\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$",
    iso_date: "^\\d{4}-\\d{2}-\\d{2}$",
    other_date: "^\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}$",
    number: "^-?\\d+([.,]\\d+)?$",
    phone_fr: "^\\+?[0-9][0-9 .()-]{6,}$",
    icd10: "^[A-TV-Z][0-9]{2}(\\.[0-9A-Z]{1,4})?$"
  },

  /* Detection semantique par nom de colonne (regex sur le nom normalise) */
  semantics: [
    { type: "identifier", match: "(^|_)(id|uuid|code|reference|ref|numero)($|_)|_id$|^id_" },
    { type: "email",      match: "mail" },
    { type: "phone",      match: "phone|tel|mobile" },
    { type: "date",       match: "date|_at$|jour|day" },
    { type: "amount",     match: "amount|montant|price|prix|value|valeur|revenue|ltv|cost|total|salaire|salary" },
    { type: "age",        match: "^age$|_age$|^age_" },
    { type: "ratio",      match: "score|rate|ratio|taux|pct|percent|probability" },
    { type: "country",    match: "country|pays|nationalit" },
    { type: "currency",   match: "currency|devise" },
    { type: "status",     match: "status|statut|state|etat" },
    { type: "gender",     match: "gender|sexe|genre" }
  ],

  /* Referentiels de valeurs autorisees */
  domains: {
    country: ["FR", "BE", "CH", "LU", "CA", "DE", "ES", "IT", "NL", "PT", "UK", "US"],
    currency: ["EUR", "USD", "GBP", "CHF", "CAD"],
    gender: ["F", "M", "X"],
    boolean: ["TRUE", "FALSE", "0", "1", "YES", "NO", "OUI", "NON"]
  },

  ranges: {
    age: { min: 0, max: 120 },
    ratio: { min: 0, max: 1 },
    amount: { min: 0, max: null }
  },

  /* Attributs sensibles surveilles par l'agent "Data Analyst" (risque de biais IA) */
  sensitive_attributes: [
    "gender", "sexe", "genre", "age", "country", "pays", "nationalit", "region",
    "ethnic", "origine", "langue", "language", "department", "service", "segment",
    "insurance", "assurance", "revenu", "income", "handicap"
  ],

  /* Regles executees par le moteur. `enabled: false` desactive la regle. */
  checks: [
    { id: "not_null",        dimension: "completeness", label: "Valeurs manquantes",        scope: "column", enabled: true,
      description: "Aucune cellule ne doit être vide sur une colonne exploitée par le modèle.",
      fix: "Compléter la source ou définir une valeur de repli explicite (imputation documentée)." },
    { id: "required_key",    dimension: "completeness", label: "Clé technique absente",      scope: "column", enabled: true,
      description: "Une colonne identifiante ne peut pas être vide : la ligne devient non traçable.",
      fix: "Rejeter la ligne en ingestion ou régénérer l'identifiant en amont." },
    { id: "unique_key",      dimension: "uniqueness",   label: "Identifiants dupliqués",     scope: "column", enabled: true,
      description: "Une colonne identifiante doit être unique sur l'ensemble du dataset.",
      fix: "Dédupliquer sur la clé métier et tracer la règle de survivance retenue." },
    { id: "duplicate_rows",  dimension: "uniqueness",   label: "Lignes dupliquées",          scope: "dataset", enabled: true,
      description: "Deux enregistrements strictement identiques faussent les statistiques d'entraînement.",
      fix: "Ajouter une étape de déduplication (hash de ligne) dans le pipeline d'ingestion." },
    { id: "format_email",    dimension: "validity",     label: "Emails non conformes",       scope: "column", enabled: true,
      description: "Le format doit respecter la RFC 5322 simplifiée.",
      fix: "Valider à la saisie et mettre en quarantaine les adresses non conformes." },
    { id: "format_date",     dimension: "validity",     label: "Dates non conformes",        scope: "column", enabled: true,
      description: "Les dates doivent être au format ISO 8601 (AAAA-MM-JJ).",
      fix: "Normaliser en ISO 8601 à l'ingestion et refuser les formats ambigus." },
    { id: "format_number",   dimension: "validity",     label: "Numériques non conformes",   scope: "column", enabled: true,
      description: "Une colonne numérique ne doit pas contenir de texte libre.",
      fix: "Typer la colonne explicitement dans le schéma d'ingestion." },
    { id: "range_check",     dimension: "validity",     label: "Valeurs hors plage",         scope: "column", enabled: true,
      description: "Les valeurs doivent rester dans la plage métier attendue.",
      fix: "Ajouter une contrainte de plage (CHECK) et alerter sur dépassement." },
    { id: "allowed_values",  dimension: "consistency",  label: "Hors référentiel",           scope: "column", enabled: true,
      description: "La valeur doit appartenir au référentiel déclaré.",
      fix: "Mapper vers le référentiel officiel et bloquer les valeurs inconnues." },
    { id: "case_variants",   dimension: "consistency",  label: "Variantes de casse / espaces", scope: "column", enabled: true,
      description: "La même modalité ne doit pas exister sous plusieurs graphies.",
      fix: "Normaliser (trim + casse) puis figer la liste des modalités." },
    { id: "mixed_formats",   dimension: "consistency",  label: "Formats hétérogènes",        scope: "column", enabled: true,
      description: "Une colonne ne doit pas mélanger plusieurs conventions de format.",
      fix: "Imposer un format unique en sortie de la couche bronze." },
    { id: "future_date",     dimension: "accuracy",     label: "Dates dans le futur",        scope: "column", enabled: true,
      description: "Une date d'événement passé ne peut pas être postérieure à aujourd'hui.",
      fix: "Ajouter un contrôle temporel et remonter l'anomalie à la source." },
    { id: "outlier_iqr",     dimension: "accuracy",     label: "Valeurs aberrantes",         scope: "column", enabled: true,
      description: "Détection statistique par écart interquartile (IQR × 1.5 / × 3).",
      fix: "Vérifier les extrêmes avec le métier avant apprentissage (winsorisation ou exclusion)." },
    { id: "constant_column", dimension: "accuracy",     label: "Colonne constante",          scope: "column", enabled: true,
      description: "Une colonne sans variance n'apporte aucun signal au modèle.",
      fix: "Exclure la colonne du jeu de features." },
    { id: "date_order",      dimension: "consistency",  label: "Chronologie incohérente",   scope: "dataset", enabled: true,
      description: "Deux colonnes de dates liées doivent rester dans l'ordre chronologique attendu.",
      fix: "Ajouter un contrôle croisé (date_fin ≥ date_début) et rejeter les lignes en écart." },
    { id: "class_imbalance", dimension: "consistency",  label: "Déséquilibre de modalités",  scope: "column", enabled: true,
      description: "Une modalité très dominante induit un biais d'apprentissage.",
      fix: "Rééquilibrer (échantillonnage / pondération) et documenter la distribution." }
  ]
};
