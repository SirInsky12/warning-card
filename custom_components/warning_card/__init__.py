from __future__ import annotations

import voluptuous as vol

from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, SERVICE_CHECK_RESOLVED

UNKNOWN_STATES = {"unknown", "unavailable"}
ACTIVE_DEFAULT_STATES = {"on", "open"}

SERVICE_SCHEMA_CHECK_RESOLVED = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Optional("rule_id", default=""): cv.string,
    }
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up warning_card backend services."""

    async def handle_check_resolved(call: ServiceCall) -> None:
        entity_id: str = call.data[ATTR_ENTITY_ID]
        rule_id: str = call.data.get("rule_id", "")

        state_obj = hass.states.get(entity_id)
        if state_obj is None:
            title = "Warnung pruefen"
            message = f"Entity {entity_id} wurde nicht gefunden."
        else:
            state_value = state_obj.state
            is_active = state_value in UNKNOWN_STATES or state_value in ACTIVE_DEFAULT_STATES
            if is_active:
                title = "Warnung weiter aktiv"
            else:
                title = "Warnung behoben"
            message = f"Regel {rule_id or '-'}: {entity_id} ist aktuell '{state_value}'."

        await hass.services.async_call(
            "persistent_notification",
            "create",
            {
                "title": title,
                "message": message,
            },
            blocking=True,
        )

    hass.services.async_register(
        DOMAIN,
        SERVICE_CHECK_RESOLVED,
        handle_check_resolved,
        schema=SERVICE_SCHEMA_CHECK_RESOLVED,
    )

    return True
