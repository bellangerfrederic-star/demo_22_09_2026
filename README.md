# MyDataQuality — Data Quality Agent

> **First release (v0.1) — UI prototype.** A static HTML mockup of the Data Quality Agent, showing the target user experience with hardcoded results. No backend or analysis logic yet.

A hackathon project building a **Data Quality Agent for AI pipelines**: upload a dataset, detect anomalies, score quality, and surface bias risks before the data reaches an AI/ML pipeline.

## What's in this release

| File / folder | Purpose |
|---|---|
| `data-quality-agent__1_.html` | Standalone UI prototype — open it in a browser to walk through the planned flow. |
| `DataSet/customers.xlsx` | Sample dataset: customer records (used to demo missing IDs, duplicates, invalid emails, country inconsistencies). |
| `DataSet/patients.xlsx` | Sample dataset: patient records. |
| `DataSet/transactions.xlsx` | Sample dataset: transaction records. |
| `PRD_Data_Quality_Agent.docx` | Product Requirement Document — full vision and roadmap. |

## Run the prototype

No build step, no dependencies. Just open the HTML file in any modern browser:

```powershell
Start-Process .\data-quality-agent__1_.html
```

Then:

1. Click **Choose File** and pick one of the `.xlsx` files in `DataSet/`.
2. Click **Run Analysis**.
3. The mockup reveals a quality score (74/100), a quality gauge, badges, top issues, an interactive table, AI risk insight, and generated tickets.

> The results are **hardcoded** in this release — uploading a different file will not change them. The prototype exists to validate the UX with stakeholders before the analysis engine is built.

## What the UI shows

- **Quality Score** — overall data-quality rating out of 100.
- **Quality Gauge** — circular indicator of the same score.
- **Badges** — categories of detected problems (Missing Values, Duplicates, Format Issues).
- **Top Issues** — plain-language list of the most impactful problems.
- **Interactive Table** — per-column issue breakdown.
- **AI Risk Insight** — flag when the dataset may bias a downstream AI model.
- **Generated Tickets** — actionable items, prioritized, ready to send to a tracker.

## Roadmap

The next release will replace the hardcoded UI with a real engine, per the PRD:

- **Stack:** Python, Pandas, Streamlit, JSON-defined rules, optional LLM for explainability.
- **Pipeline:** Frontend (Streamlit) → Data Quality Engine → Rule Engine + Anomaly Detection → Reporting.
- **Agent roles:** Data Validator (rules), Data Analyst (anomalies & explainability), Report Generator (score, tickets).
- **Inputs:** CSV, Excel, JSON.

See `PRD_Data_Quality_Agent.docx` for the full specification.

## Audience

Data Engineers, Data Analysts, ML Engineers, and Data Stewards who need to validate datasets before they feed AI pipelines.
