# MyDataQuality — POC front-end

Prototype **interface seule** du *Data Quality Agent for AI Pipelines* décrit dans
`PRD_Data_Quality_Agent.docx`. Objectif : présenter le concept de bout en bout
(upload → règles → anomalies → score → biais → tickets) sans backend.

## Lancer la démo

Aucune dépendance, aucun build, aucun serveur : ouvrez le fichier dans un navigateur.

```bash
# macOS
open frontend/index.html
# Linux
xdg-open frontend/index.html
```

```powershell
# Windows
Start-Process .\frontend\index.html
```

## Déroulé de démonstration (2 minutes)

1. Cliquez sur un des trois jeux de démonstration (**Clients**, **Patients**, **Transactions**).
2. La chaîne des trois agents se déroule à l'écran : ingestion → *Data Validator* → *Data Analyst* → *Report Generator*.
3. Le rapport affiche : score pondéré, qualité par dimension, risque de biais IA, anomalies expliquées, santé par colonne, tickets générés, catalogue de règles.
4. Déroulez une anomalie pour montrer la règle, l'impact IA, la correction proposée et des exemples réels tirés du fichier.
5. **Exporter le JSON** produit le rapport complet — le contrat d'interface qu'exposera le futur backend Python.
6. Glissez-déposez un CSV quelconque : l'analyse est réellement recalculée sur vos colonnes.

## Ce qui est réel / ce qui ne l'est pas

**Réel** — rien n'est codé en dur dans l'écran de résultat :

- parsing CSV/TSV/JSON (détection du séparateur, guillemets, BOM) ;
- profilage des colonnes (type, rôle sémantique, cardinalité, taux de remplissage) ;
- 16 règles de qualité exécutées, réparties sur 5 dimensions ;
- détection d'anomalies statistiques (écart interquartile ×1,5 et ×3) ;
- mesure du déséquilibre des attributs sensibles (risque de biais IA) ;
- score, priorisation et génération des tickets.

**Non couvert par ce POC** (prévu pour l'implémentation Python/Pandas) :

- fichiers Excel `.xlsx` (convertir en CSV pour la démo) ;
- persistance, historique des analyses et détection de dérive (*drift*) ;
- appel LLM pour la reformulation des explications ;
- envoi réel des tickets vers Jira / ServiceNow ;
- très gros volumes (tout est traité en mémoire dans l'onglet).

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html` | Structure des trois écrans : accueil, analyse, rapport. |
| `assets/css/styles.css` | Design system : thèmes clair/sombre, cartes, jauge, barres, tableau. |
| `assets/js/rules.js` | **Catalogue de règles au format JSON** : dimensions, pondérations, seuils, motifs, référentiels, attributs sensibles. |
| `assets/js/engine.js` | Moteur : parsing, profilage, les trois agents, score et tickets. |
| `assets/js/app.js` | Rendu de l'interface et interactions (aucune logique qualité). |
| `assets/js/samples.js` | Jeux de démonstration embarqués (fonctionne sans serveur). |
| `data/*.csv` | Mêmes jeux de données, en fichiers, pour tester le glisser-déposer. |

## Modèle de score

```
score = Σ (poids de la dimension × score de la dimension) − pénalité de biais IA
```

| Dimension | Poids | Question posée |
|---|---|---|
| Complétude | 25 % | Les valeurs attendues sont-elles présentes ? |
| Validité | 25 % | Les formats et plages sont-ils respectés ? |
| Unicité | 20 % | Les enregistrements sont-ils dédupliqués ? |
| Cohérence | 15 % | Les valeurs suivent-elles un référentiel stable ? |
| Exactitude | 15 % | Les valeurs sont-elles plausibles ? |

Le score d'une dimension est le **taux de cellules conformes**, *plafonné* par la
sévérité la plus élevée rencontrée : une anomalie critique ne peut pas rester verte
(plafond 70), une anomalie majeure plafonne à 88. Le détail (conformité mesurée et
plafond appliqué) s'affiche au survol de chaque dimension.

## Ajouter une règle

Le moteur est piloté par les données : une règle se déclare dans
`assets/js/rules.js` (`checks[]`) et s'implémente dans `runValidator()` de
`assets/js/engine.js`. Passer `enabled: false` suffit à la désactiver.
Les libellés, seuils, référentiels (`domains`) et attributs sensibles se modifient
sans toucher au moteur — c'est le même contrat que les *JSON rules* du PRD.

## Confidentialité

Tout s'exécute dans l'onglet : aucun appel réseau, aucun envoi de fichier.
Le POC fonctionne hors ligne, en `file://`.
