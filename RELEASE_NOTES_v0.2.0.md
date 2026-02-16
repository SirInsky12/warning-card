# v0.2.0

## Highlights

- Visual Editor verbessert:
  - `Regeln Auswahl` steht jetzt vor der Script-Konfiguration.
  - Globale erste Script-Auswahl entfernt.
  - Neue `Regel-Script Zuordnung` auf der Hauptseite (`script_mappings`).
- 1:1 Mapping moeglich:
  - Regel 1 -> Script 1
  - Regel 2 -> Script 2
  - usw. (per `rule_id`).
- Modal/Auto-Modal Verhalten aus v0.1.x bleibt erhalten.

## Neue Konfiguration

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
    entities:
      - sensor.xyz_battery
    type: numeric_below
    threshold: 1
    severity: critical
```

## Migration von v0.1.x

- Wenn du bisher ein globales Script-Feld genutzt hast:
  - auf `script_mappings` umstellen.
- Bestehende regelinterne `actions` funktionieren weiterhin.

## Hinweise

- Nach Update die Ressource mit Cache-Buster laden, z. B.:
  - `/local/warning-card.js?v=13`
- Danach Browser Hard-Reload (`Ctrl+F5`).
