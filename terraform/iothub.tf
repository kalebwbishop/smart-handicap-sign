resource "azurerm_iothub" "this" {
  enrichment                   = []
  event_hub_partition_count    = 2
  event_hub_retention_in_days  = 1
  local_authentication_enabled = true
  location                     = azurerm_resource_group.this.location
  min_tls_version              = "1.2"
  name                         = "hazardhero-iothub"
  resource_group_name          = azurerm_resource_group.this.name
  tags                         = {}
  cloud_to_device {
    default_ttl        = "PT1H"
    max_delivery_count = 10
    feedback {
      lock_duration      = "PT1M"
      max_delivery_count = 10
      time_to_live       = "PT1H"
    }
  }
  fallback_route {
    condition      = "true"
    enabled        = true
    endpoint_names = ["events"]
    source         = "DeviceMessages"
  }
  sku {
    capacity = 1
    name     = "F1"
  }
}

data "azurerm_servicebus_namespace_authorization_rule" "hazard_hero_function" {
  name                = "HazardHeroFunction"
  namespace_name      = data.azurerm_servicebus_namespace.this.name
  resource_group_name = data.azurerm_servicebus_namespace.this.resource_group_name
}

resource "azurerm_iothub_endpoint_servicebus_queue" "signal_classification_requests" {
  name                = "sbq-signal-classification-requests"
  resource_group_name = azurerm_resource_group.this.name
  iothub_id           = azurerm_iothub.this.id
  connection_string   = data.azurerm_servicebus_namespace_authorization_rule.hazard_hero_function.primary_connection_string
  endpoint_uri        = "sb://${data.azurerm_servicebus_namespace.this.name}.servicebus.windows.net/"
  entity_path         = "sbq-signal-classification-requests"
}

resource "azurerm_iothub_route" "signal_classification_requests" {
  name                = "sbq-signal-classification-requests"
  resource_group_name = azurerm_resource_group.this.name
  iothub_name         = azurerm_iothub.this.name
  source              = "DeviceMessages"
  condition           = "true"
  endpoint_names      = [azurerm_iothub_endpoint_servicebus_queue.signal_classification_requests.name]
  enabled             = true
}


resource "azurerm_iothub_shared_access_policy" "service" {
  name                = "service"
  resource_group_name = azurerm_resource_group.this.name
  iothub_name         = azurerm_iothub.this.name
  service_connect     = true
}

resource "azurerm_role_assignment" "iothub_eventhub_data_receiver" {
  scope                            = azurerm_iothub.this.id
  role_definition_name             = "Azure Event Hubs Data Receiver"
  principal_id                     = azurerm_function_app_flex_consumption.api.identity[0].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "iothub_data_contributor" {
  scope                            = azurerm_iothub.this.id
  role_definition_name             = "IoT Hub Data Contributor"
  principal_id                     = azurerm_function_app_flex_consumption.api.identity[0].principal_id
  skip_service_principal_aad_check = true
}

moved {
  from = azurerm_role_assignment.api_iothub_eventhub_data_receiver
  to   = azurerm_role_assignment.iothub_eventhub_data_receiver
}

moved {
  from = azurerm_role_assignment.api_iothub_data_contributor
  to   = azurerm_role_assignment.iothub_data_contributor
}


locals {
  iothub_eventhub_connection_string = "Endpoint=${azurerm_iothub.this.event_hub_events_endpoint};SharedAccessKeyName=${azurerm_iothub_shared_access_policy.service.name};SharedAccessKey=${azurerm_iothub_shared_access_policy.service.primary_key};EntityPath=${azurerm_iothub.this.event_hub_events_path}"
}