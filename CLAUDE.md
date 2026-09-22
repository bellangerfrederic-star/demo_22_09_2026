# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Early-stage hackathon project ("antropic-hackathon-vibe-coding-2026", Capgemini). At the time of writing, the repository contains **no application code yet** — only:

- `data-quality-agent__1_.html` — a static UI mockup with hardcoded results (file upload, "Run Analysis" button, fake quality score / badges / issues / tickets). No real analysis logic; treat it as a visual reference for the target UI, not as a baseline implementation.
- `PRD_Data_Quality_Agent.docx` — the authoritative product spec. See "Planned architecture" below for the summary.
- `DataSet/` — sample inputs (`customers.xlsx`, `patients.xlsx`, `transactions.xlsx`) for testing ingestion and rules.
- `README.md` — default GitLab template, **not project documentation**. Ignore it as a source of truth; rely on the PRD and the HTML mockup.

There is no build system, package manager, test suite, or CI configured yet. When asked to "run", "build", or "test", first check whether the relevant tooling has been added since this file was written.

## Planned architecture (per PRD)

The product is a **Data Quality Agent for AI pipelines**: ingest tabular data, run rule-based + anomaly checks, score quality, explain issues, and emit tickets — to be used *before* data feeds an AI/ML pipeline.

Pipeline shape:

```
Frontend (Streamlit)  →  Data Quality Engine  →  Rule Engine          →  Reporting
                                              →  Anomaly Detection
```

Agent decomposition (three logical roles, intended to be implemented as cooperating components/agents):

- **Data Validator** — applies rules (null checks, uniqueness, format, range, allowed values) defined as JSON.
- **Data Analyst** — anomaly detection and explainability.
- **Report Generator** — quality score, top issues, AI-bias risk insight, ticket generation.

Inputs to support: CSV, Excel, JSON. Outputs: quality score, per-column issue list, generated tickets.

Stack chosen in the PRD: **Python, Pandas, Streamlit**, JSON-defined rules, optional LLM for insight/explanation. Prefer this stack unless the user explicitly chooses otherwise — the HTML mockup is a wireframe, not a commitment to a JS implementation.

Hackathon roadmap: Day 1 = ingestion + rule engine; Day 2 = reporting + UI + pitch. Scope decisions should favor demoable end-to-end flow over depth in any single component.

## Working with the sample datasets

`DataSet/*.xlsx` are the canonical fixtures for manual testing and demos. When implementing ingestion or rules, validate against all three (`customers`, `patients`, `transactions`) — they cover different domains and likely surface different anomaly types referenced in the mockup (missing IDs, duplicates, invalid email formats, country inconsistencies → bias risk).
