# MyDataQuality — Data Quality Agent

> **v0.2 — POC front-end interactif.** L'interface complète du Data Quality Agent,
> exécutée entièrement dans le navigateur : parsing, moteur de règles, détection
> d'anomalies, score, risque de biais et génération de tickets. Backend Python à venir.

A hackathon project building a **Data Quality Agent for AI pipelines**: upload a dataset, detect anomalies, score quality, and surface bias risks before the data reaches an AI/ML pipeline.

## Démarrer

Aucune dépendance, aucun build :

```powershell
Start-Process .\frontend\index.html
```

Puis cliquez sur un des trois jeux de démonstration (Clients, Patients, Transactions),
ou glissez-déposez votre propre CSV/JSON. Voir `frontend/README.md` pour le déroulé
de démonstration et le détail du modèle de score.

## Contenu du dépôt

| Fichier / dossier | Rôle |
|---|---|
| `frontend/index.html` | POC front-end — accueil, chaîne d'agents animée, rapport de qualité. |
| `frontend/assets/js/rules.js` | Catalogue de règles au format JSON (dimensions, seuils, référentiels). |
| `frontend/assets/js/engine.js` | Moteur de qualité : parsing, profilage, règles, anomalies, score, tickets. |
| `frontend/data/*.csv` | Trois jeux de données de démonstration, avec anomalies injectées. |
| `PRD_Data_Quality_Agent.docx` | Product Requirement Document — vision et roadmap. |

## Ce que montre l'interface

- **Score de qualité** — note pondérée sur 100 et verdict d'exploitabilité pour l'IA.
- **Qualité par dimension** — complétude, unicité, validité, cohérence, exactitude.
- **Risque de biais IA** — déséquilibre des attributs sensibles et distribution des modalités.
- **Anomalies expliquées** — règle déclenchée, impact sur le modèle, correction proposée, exemples réels.
- **Santé par colonne** — tableau triable : type, rôle détecté, manquants, anomalies, sévérité.
- **Tickets générés** — priorité, action, critère d'acceptation, assignation, effort.
- **Catalogue de règles** — les 16 règles évaluées et leur statut.

## Roadmap

La prochaine étape remplace le moteur exécuté dans le navigateur par le moteur Python du PRD :

- **Stack:** Python, Pandas, Streamlit, JSON-defined rules, optional LLM for explainability.
- **Pipeline:** Frontend (Streamlit) → Data Quality Engine → Rule Engine + Anomaly Detection → Reporting.
- **Agent roles:** Data Validator (rules), Data Analyst (anomalies & explainability), Report Generator (score, tickets).
- **Inputs:** CSV, Excel, JSON.

See `PRD_Data_Quality_Agent.docx` for the full specification.

## Audience

Data Engineers, Data Analysts, ML Engineers, and Data Stewards who need to validate datasets before they feed AI pipelines.
