# warning-card
<img width="271" height="173" alt="image" src="https://github.com/user-attachments/assets/e2ec1d4c-2df2-4802-8bf4-1e8ac921dee6" />

`warning-card` ist eine Home Assistant Lovelace Custom Card als Web Component.
Sie zeigt nur dann etwas an, wenn mindestens eine Regel aktiv ist.

## Features

- Mehrere Regeln mit mehreren Entities pro Regel
- Regeltypen: `numeric_below`, `numeric_above`, `state_is`, `state_in`, `template`
- Gruppierung nach Severity: `critical`, `warning`, `info`
- Action-Buttons pro aktivem Eintrag
- Optionales Modal beim Klick
- Optionales Auto-Modal bei neuem Trigger
- Visual Editor ueber den offiziellen Home Assistant Form-Editor

## Voraussetzungen

- Home Assistant (Lovelace)
- Zugriff auf `/config/www` fuer die Card-Datei
- Optional: Zugriff auf `/config/custom_components` fuer den Backend-Service

## Installation (Frontend)

1. `warning-card.js` nach `/config/www/warning-card.js` kopieren
2. In Home Assistant unter **Einstellungen -> Dashboards -> Ressourcen** eintragen:
   - URL: `/local/warning-card.js`
   - Typ: `JavaScript Module`
3. Dashboard neu laden (ggf. Browser-Cache leeren)

## Installation (Backend-Service, optional)

Wenn du Actions ohne eigenes Script nutzen willst:

1. Ordner `custom_components/warning_card` nach `/config/custom_components/warning_card` kopieren
2. Home Assistant neu starten
3. Danach ist der Service `warning_card.check_resolved` verfuegbar

## Nutzung (YAML)

```yaml
type: custom:warning-card
title: Warnungen
open_modal_on_tap: true
auto_open_on_trigger: true
script_mappings:
  - rule_id: batt_low
    script_entity: script.batterie_pruefen
    action_name: Batterie pruefen
  - rule_id: door_open
    script_entity: script.tuer_pruefen
    action_name: Tuer pruefen
rules:
  - id: batt_low
    name: Batterie kritisch
    icon: mdi:battery-alert
    entities:
      - sensor.xyz_battery
      - sensor.abc_battery
    type: numeric_below
    threshold: 1
    severity: critical
    message: "{{entity}} ist bei {{value}}"
```

## Regeltypen

- `numeric_below`: aktiv, wenn `value < threshold`
- `numeric_above`: aktiv, wenn `value > threshold`
- `state_is`: aktiv, wenn `state == rule.state`
- `state_in`: aktiv, wenn `state` in `rule.states`
- `template`: JavaScript-Expression (defensiv eingeschraenkt)

Hinweise:

- `unknown`/`unavailable` werden bei numeric/state-Regeln ignoriert
- Eine Regel mit mehreren passenden Entities erzeugt mehrere aktive Zeilen

## Optionen

- `open_modal_on_tap` (Default: `true`): Klick auf Eintrag oeffnet Modal
- `auto_open_on_trigger` (Default: `false`): Modal oeffnet automatisch, wenn ein Eintrag neu aktiv wird

## Actions

Jede Action ruft einen Service auf und sendet zusaetzlich `entity_id` und `rule_id`.

Im Visual Editor erfolgt die Zuordnung ueber `script_mappings` (rule_id -> script_entity).

## Visual Editor

Die Karte verwendet `getConfigForm()` und ist im Lovelace UI bearbeitbar.
Im Regel-Editor gibt es bei der Entitaeten-Auswahl einen Hilfetext zur Orientierung.

## Troubleshooting

- Visual Editor nicht verfuegbar: Browser-Cache leeren und Ressource neu laden
<<<<<<< HEAD
- Alte Version wird geladen: URL mit Cache-Buster nutzen, z. B. `/local/warning-card.js?v=5`
=======
- Alte Version wird geladen: URL mit Cache-Buster nutzen, z. B. `/local/warning-card.js?v=11`
>>>>>>> eca005c (Release v0.2.0: rule-script mappings in main editor)
- Actions reagieren nicht: pruefen, ob der Service existiert und Berechtigungen passen

