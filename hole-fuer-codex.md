Prompt für Copilot/Codex

Erstelle eine Home Assistant Lovelace Custom Card als Web Component (plain JavaScript, kein Build), Custom Element Name: warning-card.

Zweck

Die Karte ist eine generische Warntafel, die mehrere Regeln (rules) auswertet. Jede Regel kann einen oder mehrere Entities prüfen und wird „aktiv“, wenn ihre Bedingung zutrifft. Die Karte erscheint nur, wenn mindestens eine Regel aktiv ist.

Konfiguration (YAML)

Die Karte erhält:

title: string (Default: "Warnungen")

rules: Rule[] (muss vorhanden sein)

Rule Struktur:

- id: "batt_low"
  name: "Batterie kritisch"
  icon: "mdi:battery-alert"
  entities:
    - sensor.xyz_battery
    - sensor.abc_battery
  type: "numeric_below"   # enum: numeric_below | numeric_above | state_is | state_in | template
  threshold: 1            # für numeric_* Regeln
  state: "on"             # für state_is
  states: ["on","open"]   # für state_in
  template: "{{ ... }}"   # für template (HA template als String)
  severity: "critical"    # enum: info | warning | critical
  message: "Freier Text mit optionalem {{entity}} / {{value}}"
  actions:
    - name: "Behoben?"
      icon: "mdi:check-circle"
      service: "script.warntafel_behoben_pruefen"
      confirm_text: "Wirklich behoben? Ich prüfe nach."
      # beim Aufruf: service_data: { entity_id: <betroffene entity>, rule_id: <id> }
    - name: "Neu prüfen"
      icon: "mdi:refresh"
      service: "script.warntafel_behoben_pruefen"

Regeln-Auswertung

numeric_below: aktiv, wenn mindestens eine Entity numerisch parsebar ist und value < threshold

numeric_above: aktiv, wenn value > threshold

state_is: aktiv, wenn state == rule.state

state_in: aktiv, wenn state in rule.states

template: aktiv, wenn HA template zu truthy evaluiert (siehe unten)

Wichtig: Eine Regel kann mehrere Entities haben. Wenn mehrere Entities die Bedingung erfüllen, sollen sie alle als aktive „Einträge“ angezeigt werden (eine Zeile pro Entity).

Template-Regel (ohne Backend)

Da die Karte im Frontend läuft und HA-Jinja nicht direkt evaluiert:

Implementiere type: "template" als JavaScript expression template mit new Function, aber sicher:

Erlaube nur Zugriff auf hass.states und entity/stateObj Variablen

Alternativ: Wenn das zu riskant ist, dann template-Regel NICHT implementieren und dokumentiere im Code Kommentar, dass sie nicht unterstützt ist.
(Die Karte muss trotzdem für numeric/state Regeln vollständig funktionieren.)

UI / Anzeige

Verwende <ha-card> und render:

Header: Titel + Zähler aktiver Einträge

Liste: gruppiert nach severity (critical oben, warning, info)

Jede Zeile zeigt:

Icon der Regel

Regelname

Friendly name + entity_id

aktuellen Wert/State

Severity Badge (z. B. „KRITISCH“)

Actions rechts (Buttons)

Actions / Bestätigung

Actions werden als eingebettete hui-button-card gerendert, damit die native HA Confirmation funktioniert:

Für Action mit confirm_text: tap_action.confirmation.text = confirm_text

tap_action.action = "call-service"

tap_action.service = action.service

tap_action.service_data = { entity_id: <entity>, rule_id: <rule.id> }

Buttons sollen kompakt sein und auf Mobile umbrechen.

Verhalten

Wenn keine aktive Regel: Karte soll nichts rendern (leerer shadowRoot Inhalt).

Wenn Entities unknown/unavailable/nicht parsebar:

Numeric-Regeln: ignorieren

State-Regeln: nur vergleichen, wenn state nicht unknown/unavailable

Implementierung / Datei

Datei: /config/www/warning-card.js

customElements.define("warning-card", ...)

Optional: window.customCards.push(...) für Card Picker.

Keine externen Abhängigkeiten, kein Build.

Sauberer Code, Kommentare, defensive checks.