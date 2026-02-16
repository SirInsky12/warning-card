class WarningCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._activeModalKey = null;
    this._previousEntryKeys = new Set();
    this._hasRenderedOnce = false;
  }

  setConfig(config) {
    const safeConfig = config && typeof config === "object" ? config : {};

    this._config = {
      title:
        typeof safeConfig.title === "string" && safeConfig.title.trim()
          ? safeConfig.title
          : "Warnungen",
      rules: Array.isArray(safeConfig.rules) ? safeConfig.rules : [],
      script_mappings: Array.isArray(safeConfig.script_mappings) ? safeConfig.script_mappings : [],
      open_modal_on_tap: safeConfig.open_modal_on_tap !== false,
      auto_open_on_trigger: safeConfig.auto_open_on_trigger === true,
      script_entity:
        typeof safeConfig.script_entity === "string" ? safeConfig.script_entity : "",
      script_action_name:
        typeof safeConfig.script_action_name === "string" ? safeConfig.script_action_name : "",
      script_confirm_text:
        typeof safeConfig.script_confirm_text === "string" ? safeConfig.script_confirm_text : "",
    };
    this._previousEntryKeys = new Set();
    this._hasRenderedOnce = false;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    const activeCount = this._evaluateRules().length;
    return Math.max(1, Math.ceil(activeCount / 3));
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        { name: "open_modal_on_tap", selector: { boolean: {} } },
        { name: "auto_open_on_trigger", selector: { boolean: {} } },
        {
          name: "rules",
          required: true,
          selector: {
            object: {
              multiple: true,
              label_field: "name",
              description_field: "type",
              fields: {
                id: { selector: { text: {} }, required: true },
                name: { selector: { text: {} }, required: true },
                icon: { selector: { icon: {} } },
                type: {
                  required: true,
                  selector: {
                    select: {
                      options: [
                        { value: "numeric_below", label: "numeric_below" },
                        { value: "numeric_above", label: "numeric_above" },
                        { value: "state_is", label: "state_is" },
                        { value: "state_in", label: "state_in" },
                        { value: "template", label: "template" },
                      ],
                      mode: "dropdown",
                    },
                  },
                },
                entities: {
                  description:
                    "Waehle hier eine oder mehrere Entities fuer diese Regel aus. Jede passende Entity erscheint als eigener Eintrag in der Karte.",
                  selector: {
                    entity: {
                      multiple: true,
                    },
                  },
                },
                threshold: {
                  selector: {
                    number: {
                      mode: "box",
                    },
                  },
                },
                state: { selector: { text: {} } },
                states: { selector: { text: {} } },
                template: { selector: { text: {} } },
                severity: {
                  selector: {
                    select: {
                      options: [
                        { value: "critical", label: "critical" },
                        { value: "warning", label: "warning" },
                        { value: "info", label: "info" },
                      ],
                      mode: "dropdown",
                    },
                  },
                },
                message: { selector: { text: {} } },
              },
            },
          },
        },
        {
          name: "script_mappings",
          description: "Regel zu Script zuordnen: jede rule_id kann ein eigenes Script erhalten.",
          selector: {
            object: {
              multiple: true,
              label_field: "rule_id",
              description_field: "script_entity",
              fields: {
                rule_id: {
                  required: true,
                  selector: { text: {} },
                },
                script_entity: {
                  required: true,
                  selector: {
                    entity: {
                      domain: "script",
                    },
                  },
                },
                action_name: { selector: { text: {} } },
                confirm_text: { selector: { text: {} } },
              },
            },
          },
        },
      ],
      computeLabel: (schema) => {
        if (schema.name === "title") return "Titel";
        if (schema.name === "open_modal_on_tap") return "Modal bei Klick";
        if (schema.name === "auto_open_on_trigger") return "Modal automatisch bei Trigger";
        if (schema.name === "rules") return "Regeln Auswahl";
        if (schema.name === "script_mappings") return "Regel-Script Zuordnung";
        return undefined;
      },
      assertConfig: (config) => {
        if (config?.rules && !Array.isArray(config.rules)) {
          throw new Error("'rules' muss eine Liste sein.");
        }
        if (config?.script_mappings && !Array.isArray(config.script_mappings)) {
          throw new Error("'script_mappings' muss eine Liste sein.");
        }
      },
    };
  }

  static getStubConfig() {
    return {
      type: "custom:warning-card",
      title: "Warnungen",
      open_modal_on_tap: true,
      auto_open_on_trigger: true,
      script_entity: "script.warntafel_behoben_pruefen",
      script_action_name: "Bitte beheben",
      script_confirm_text: "Wirklich behoben? Ich pruefe nach.",
      script_mappings: [
        {
          rule_id: "batt_low",
          script_entity: "script.warntafel_behoben_pruefen",
          action_name: "Bitte beheben",
          confirm_text: "Wirklich behoben? Ich pruefe nach.",
        },
      ],
      rules: [
        {
          id: "batt_low",
          name: "Batterie kritisch",
          icon: "mdi:battery-alert",
          entities: ["sensor.xyz_battery"],
          type: "numeric_below",
          threshold: 1,
          severity: "critical",
          message: "{{entity}} ist bei {{value}}",
          actions: [
            {
              name: "Bitte beheben",
              icon: "mdi:refresh",
              service: "warning_card.check_resolved",
            },
          ],
        },
      ],
    };
  }

  _render() {
    if (!this.shadowRoot || !this._config || !this._hass) {
      return;
    }

    const entries = this._evaluateRules();
    const autoOpenEntry = this._findAutoOpenEntry(entries);
    if (entries.length === 0) {
      this.shadowRoot.innerHTML = "";
      this._activeModalKey = null;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          padding: 10px 12px 12px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .title {
          font-size: 1.15rem;
          font-weight: 600;
          line-height: 1.2;
        }
        .count {
          font-size: 0.9rem;
          color: var(--secondary-text-color);
          white-space: nowrap;
        }
        .group {
          margin-top: 8px;
        }
        .group-title {
          margin: 10px 0 6px;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--secondary-text-color);
        }
        .row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid var(--divider-color);
        }
        .row.interactive {
          cursor: pointer;
        }
        .row.interactive:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
          border-radius: 8px;
        }
        .row:first-child {
          border-top: none;
        }
        .left {
          min-width: 0;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          flex: 1;
        }
        ha-icon {
          color: var(--warning-color);
          width: 22px;
          height: 22px;
          margin-top: 2px;
        }
        .line {
          min-width: 0;
        }
        .name {
          font-weight: 600;
          margin: 0;
        }
        .entity {
          margin: 2px 0 0;
          font-size: 0.88rem;
          color: var(--secondary-text-color);
          overflow-wrap: anywhere;
        }
        .message {
          margin: 4px 0 0;
          font-size: 0.92rem;
          line-height: 1.35;
        }
        .meta {
          margin-top: 6px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .value {
          font-size: 0.8rem;
          color: var(--secondary-text-color);
          background: var(--secondary-background-color);
          border-radius: 999px;
          padding: 2px 8px;
        }
        .badge {
          font-size: 0.74rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-radius: 999px;
          padding: 2px 8px;
        }
        .badge-critical {
          color: var(--error-color, #db4437);
          background: color-mix(in srgb, var(--error-color, #db4437) 16%, transparent);
        }
        .badge-warning {
          color: var(--warning-color, #f9a825);
          background: color-mix(in srgb, var(--warning-color, #f9a825) 16%, transparent);
        }
        .badge-info {
          color: var(--info-color, #2196f3);
          background: color-mix(in srgb, var(--info-color, #2196f3) 16%, transparent);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
          max-width: 42%;
        }
        hui-button-card {
          min-width: 84px;
          width: auto;
        }
        .fallback-action {
          border: 1px solid var(--divider-color);
          border-radius: 999px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          padding: 6px 10px;
          cursor: pointer;
        }
        dialog.modal {
          border: none;
          border-radius: 14px;
          padding: 0;
          max-width: min(680px, calc(100vw - 24px));
          width: 100%;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        }
        dialog.modal::backdrop {
          background: rgba(0, 0, 0, 0.5);
        }
        .modal-inner {
          padding: 14px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .modal-title {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0;
        }
        .close-btn {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          cursor: pointer;
          padding: 6px 10px;
        }
        .modal-actions {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }
        @media (max-width: 700px) {
          .row {
            flex-direction: column;
          }
          .actions {
            max-width: 100%;
            width: 100%;
            justify-content: flex-start;
          }
        }
      </style>
    `;

    const card = document.createElement("ha-card");
    const header = document.createElement("div");
    header.className = "header";
    header.innerHTML = `
      <div class="title">${this._escapeHtml(this._config.title)}</div>
      <div class="count">${entries.length} aktiv</div>
    `;
    card.appendChild(header);

    const order = ["critical", "warning", "info"];
    const grouped = {
      critical: [],
      warning: [],
      info: [],
    };

    for (const entry of entries) {
      grouped[entry.severity].push(entry);
    }

    for (const severity of order) {
      const groupEntries = grouped[severity];
      if (groupEntries.length === 0) {
        continue;
      }

      const groupEl = document.createElement("div");
      groupEl.className = "group";

      const title = document.createElement("div");
      title.className = "group-title";
      title.textContent = this._severityLabel(severity);
      groupEl.appendChild(title);

      for (const entry of groupEntries) {
        const row = this._buildEntryRow(entry);
        groupEl.appendChild(row);
      }

      card.appendChild(groupEl);
    }

    this.shadowRoot.appendChild(card);

    if (this._activeModalKey) {
      const selectedEntry = entries.find((entry) => this._entryKey(entry) === this._activeModalKey);
      if (selectedEntry) {
        this._openModal(selectedEntry);
      } else {
        this._activeModalKey = null;
      }
    } else if (autoOpenEntry) {
      this._openModal(autoOpenEntry);
    }
  }

  _buildEntryRow(entry) {
    const row = document.createElement("div");
    const modalEnabled = this._config?.open_modal_on_tap !== false;
    row.className = modalEnabled ? "row interactive" : "row";
    if (modalEnabled) {
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `${entry.name} details`);
      row.addEventListener("click", () => this._openModal(entry));
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this._openModal(entry);
        }
      });
    }

    const left = document.createElement("div");
    left.className = "left";

    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", entry.icon || "mdi:alert-circle");
    left.appendChild(icon);

    const line = document.createElement("div");
    line.className = "line";
    line.innerHTML = `
      <p class="name">${this._escapeHtml(entry.name)}</p>
      <p class="entity">${this._escapeHtml(entry.entityLabel)}</p>
      ${entry.message ? `<p class="message">${this._escapeHtml(entry.message)}</p>` : ""}
      <div class="meta">
        <span class="value">${this._escapeHtml(entry.valueLabel)}</span>
        <span class="badge badge-${this._escapeHtml(entry.severity)}">${this._escapeHtml(this._severityLabel(entry.severity))}</span>
      </div>
    `;
    left.appendChild(line);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.addEventListener("click", (ev) => ev.stopPropagation());
    actions.addEventListener("keydown", (ev) => ev.stopPropagation());
    for (const action of entry.actions) {
      const btn = this._buildActionButton(action, entry);
      if (btn) {
        actions.appendChild(btn);
      }
    }

    row.appendChild(left);
    row.appendChild(actions);
    return row;
  }

  _buildActionButton(action, entry) {
    if (!action || typeof action !== "object") {
      return null;
    }

    let service = "";
    if (typeof action.service === "string" && action.service.trim()) {
      service = action.service.trim();
    } else if (typeof action.script_entity === "string" && action.script_entity.startsWith("script.")) {
      service = action.script_entity;
    }

    if (!service) {
      return null;
    }
    if (!service.includes(".")) {
      return null;
    }

    const serviceData = {};
    if (entry.entityId) {
      serviceData.entity_id = entry.entityId;
    }
    serviceData.rule_id = entry.ruleId;

    const config = {
      type: "button",
      name: action.name || "Action",
      icon: action.icon || "mdi:play-circle-outline",
      show_state: false,
      show_name: true,
      tap_action: {
        action: "call-service",
        service,
        service_data: serviceData,
      },
      hold_action: {
        action: "none",
      },
    };

    if (typeof action.confirm_text === "string" && action.confirm_text.trim()) {
      config.tap_action.confirmation = {
        text: action.confirm_text,
      };
    }

    try {
      const el = document.createElement("hui-button-card");
      el.setConfig(config);
      el.hass = this._hass;
      return el;
    } catch (_err) {
      const fallback = document.createElement("button");
      fallback.type = "button";
      fallback.className = "fallback-action";
      fallback.textContent = action.name || "Action";
      fallback.addEventListener("click", async () => {
        if (config.tap_action.confirmation?.text) {
          const ok = window.confirm(config.tap_action.confirmation.text);
          if (!ok) {
            return;
          }
        }
        const [domain, srv] = service.split(".");
        await this._hass.callService(domain, srv, serviceData);
      });
      return fallback;
    }
  }

  _entryKey(entry) {
    return `${entry.ruleId}::${entry.entityId || "template"}`;
  }

  _findAutoOpenEntry(entries) {
    const currentKeys = new Set(entries.map((entry) => this._entryKey(entry)));
    const previousKeys = this._previousEntryKeys;
    this._previousEntryKeys = currentKeys;

    if (!this._hasRenderedOnce) {
      this._hasRenderedOnce = true;
      return null;
    }
    if (!this._config?.auto_open_on_trigger) {
      return null;
    }

    for (const entry of entries) {
      const key = this._entryKey(entry);
      if (!previousKeys.has(key)) {
        return entry;
      }
    }
    return null;
  }

  _openModal(entry) {
    if (!this.shadowRoot) {
      return;
    }
    this._activeModalKey = this._entryKey(entry);
    const existing = this.shadowRoot.querySelector("dialog.modal");
    if (existing) {
      existing.close();
      existing.remove();
    }

    const dialog = document.createElement("dialog");
    dialog.className = "modal";

    const wrapper = document.createElement("div");
    wrapper.className = "modal-inner";
    wrapper.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${this._escapeHtml(entry.name)}</h3>
        <button type="button" class="close-btn">Schliessen</button>
      </div>
      <p class="entity">${this._escapeHtml(entry.entityLabel)}</p>
      ${entry.message ? `<p class="message">${this._escapeHtml(entry.message)}</p>` : ""}
      <div class="meta">
        <span class="value">${this._escapeHtml(entry.valueLabel)}</span>
        <span class="badge badge-${this._escapeHtml(entry.severity)}">${this._escapeHtml(this._severityLabel(entry.severity))}</span>
      </div>
      <div class="modal-actions"></div>
    `;

    const closeBtn = wrapper.querySelector(".close-btn");
    closeBtn?.addEventListener("click", () => this._closeModal(dialog));

    const modalActions = wrapper.querySelector(".modal-actions");
    for (const action of entry.actions) {
      const btn = this._buildActionButton(action, entry);
      if (btn) {
        modalActions.appendChild(btn);
      }
    }

    dialog.addEventListener("click", (ev) => {
      if (ev.target === dialog) {
        this._closeModal(dialog);
      }
    });
    dialog.addEventListener("close", () => {
      if (this.shadowRoot?.contains(dialog)) {
        dialog.remove();
      }
      this._activeModalKey = null;
    });

    dialog.appendChild(wrapper);
    this.shadowRoot.appendChild(dialog);
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch (_err) {
        dialog.setAttribute("open", "");
      }
    }
  }

  _closeModal(dialog) {
    if (dialog?.open) {
      dialog.close();
    } else if (dialog?.parentNode) {
      dialog.remove();
      this._activeModalKey = null;
    }
  }

  _evaluateRules() {
    if (!this._config || !this._hass) {
      return [];
    }

    const entries = [];
    for (const rawRule of this._config.rules) {
      const rule = this._normalizeRule(rawRule);
      if (!rule) {
        continue;
      }

      const entities = rule.entities.length > 0 ? rule.entities : [null];
      for (const entityId of entities) {
        const stateObj = entityId ? this._hass.states[entityId] : null;
        const stateValue = stateObj?.state;
        const matched = this._ruleMatches(rule, entityId, stateObj, stateValue);
        if (!matched) {
          continue;
        }

        const entityLabel = entityId
          ? `${stateObj?.attributes?.friendly_name || entityId} (${entityId})`
          : "Template-Regel";
        const valueLabel = stateObj ? `${stateObj.state}` : "aktiv";
        const message = this._renderMessage(rule.message, entityId, valueLabel);

        entries.push({
          ruleId: rule.id,
          name: rule.name,
          icon: rule.icon,
          severity: rule.severity,
          actions: rule.actions,
          entityId,
          entityLabel,
          valueLabel,
          message,
        });
      }
    }

    return entries.sort((a, b) => this._severityRank(a.severity) - this._severityRank(b.severity));
  }

  _normalizeRule(rule) {
    if (!rule || typeof rule !== "object") {
      return null;
    }

    const type = String(rule.type || "").trim();
    const allowed = new Set(["numeric_below", "numeric_above", "state_is", "state_in", "template"]);
    if (!allowed.has(type)) {
      return null;
    }

    const id = typeof rule.id === "string" && rule.id.trim() ? rule.id.trim() : `rule_${Math.random().toString(36).slice(2, 10)}`;
    const name = typeof rule.name === "string" && rule.name.trim() ? rule.name : id;
    const entities = Array.isArray(rule.entities)
      ? rule.entities.filter((entityId) => typeof entityId === "string" && entityId.trim())
      : [];
    const severity = this._normalizeSeverity(rule.severity);
    const actions = Array.isArray(rule.actions) ? rule.actions : [];

    return {
      id,
      name,
      icon: typeof rule.icon === "string" ? rule.icon : "mdi:alert-circle",
      type,
      entities,
      threshold: rule.threshold,
      state: rule.state,
      states: rule.states,
      template: rule.template,
      severity,
      message: typeof rule.message === "string" ? rule.message : "",
      actions: this._extractRuleActions(rule, actions),
    };
  }

  _extractRuleActions(rule, existingActions) {
    const merged = Array.isArray(existingActions) ? [...existingActions] : [];
    const mapped = this._getScriptMappingForRule(rule.id);

    let service = "";
    if (typeof rule.action_service === "string" && rule.action_service.trim()) {
      service = rule.action_service.trim();
    } else if (
      typeof rule.action_script_entity === "string" &&
      rule.action_script_entity.startsWith("script.")
    ) {
      service = rule.action_script_entity;
    } else if (
      typeof mapped?.script_entity === "string" &&
      mapped.script_entity.startsWith("script.")
    ) {
      service = mapped.script_entity;
    } else if (
      typeof this._config?.script_entity === "string" &&
      this._config.script_entity.startsWith("script.")
    ) {
      service = this._config.script_entity;
    } else if (
      typeof rule.script_entity === "string" &&
      rule.script_entity.startsWith("script.")
    ) {
      service = rule.script_entity;
    }

    if (service) {
      merged.push({
        name:
          typeof rule.action_name === "string" && rule.action_name.trim()
            ? rule.action_name
            : typeof mapped?.action_name === "string" && mapped.action_name.trim()
            ? mapped.action_name
            : typeof this._config?.script_action_name === "string" &&
              this._config.script_action_name.trim()
            ? this._config.script_action_name
            : typeof rule.script_action_name === "string" && rule.script_action_name.trim()
            ? rule.script_action_name
            : "Bitte beheben",
        icon:
          typeof rule.action_icon === "string" && rule.action_icon.trim()
            ? rule.action_icon
            : "mdi:refresh",
        service,
        confirm_text:
          typeof rule.action_confirm_text === "string"
            ? rule.action_confirm_text
            : typeof mapped?.confirm_text === "string"
            ? mapped.confirm_text
            : typeof this._config?.script_confirm_text === "string"
            ? this._config.script_confirm_text
            : typeof rule.script_confirm_text === "string"
            ? rule.script_confirm_text
            : undefined,
      });
    }

    return merged;
  }

  _getScriptMappingForRule(ruleId) {
    if (!ruleId || !Array.isArray(this._config?.script_mappings)) {
      return null;
    }
    const id = String(ruleId).trim();
    if (!id) {
      return null;
    }
    const found = this._config.script_mappings.find(
      (mapping) =>
        mapping &&
        typeof mapping.rule_id === "string" &&
        mapping.rule_id.trim() === id
    );
    return found || null;
  }

  _ruleMatches(rule, entityId, stateObj, stateValue) {
    if (rule.type === "template") {
      return this._evaluateTemplateRule(rule, entityId, stateObj);
    }

    if (!stateObj || stateValue === "unknown" || stateValue === "unavailable") {
      return false;
    }

    if (rule.type === "numeric_below" || rule.type === "numeric_above") {
      const value = Number.parseFloat(stateValue);
      const threshold = Number.parseFloat(rule.threshold);
      if (!Number.isFinite(value) || !Number.isFinite(threshold)) {
        return false;
      }
      return rule.type === "numeric_below" ? value < threshold : value > threshold;
    }

    if (rule.type === "state_is") {
      if (typeof rule.state !== "string") {
        return false;
      }
      return stateValue === rule.state;
    }

    if (rule.type === "state_in") {
      if (!Array.isArray(rule.states)) {
        return false;
      }
      return rule.states.map((s) => String(s)).includes(stateValue);
    }

    return false;
  }

  _evaluateTemplateRule(rule, entityId, stateObj) {
    if (typeof rule.template !== "string" || !rule.template.trim()) {
      return false;
    }

    const expression = rule.template.trim();
    const blocked = /(window|document|globalThis|constructor|prototype|__proto__|Function|eval|import\s*\(|new\s+|this\b)/;
    if (blocked.test(expression)) {
      return false;
    }

    try {
      const fn = new Function(
        "hass",
        "entity",
        "stateObj",
        `"use strict"; return Boolean(${expression});`
      );
      return Boolean(fn(this._hass, entityId, stateObj));
    } catch (_err) {
      return false;
    }
  }

  _renderMessage(message, entityId, value) {
    if (!message) {
      return "";
    }
    return message
      .replaceAll("{{entity}}", entityId || "")
      .replaceAll("{{value}}", value || "");
  }

  _normalizeSeverity(severity) {
    const normalized = String(severity || "warning").toLowerCase();
    if (normalized === "critical" || normalized === "warning" || normalized === "info") {
      return normalized;
    }
    return "warning";
  }

  _severityRank(severity) {
    if (severity === "critical") return 0;
    if (severity === "warning") return 1;
    return 2;
  }

  _severityLabel(severity) {
    if (severity === "critical") return "Kritisch";
    if (severity === "warning") return "Warnung";
    return "Info";
  }

  _escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

if (!customElements.get("warning-card")) {
  customElements.define("warning-card", WarningCard);
}


window.customCards = window.customCards || [];
window.customCards.push({
  type: "warning-card",
  name: "Warning Card",
  description: "Generische Warntafel mit Regeln und Aktionen",
  preview: true,
});

