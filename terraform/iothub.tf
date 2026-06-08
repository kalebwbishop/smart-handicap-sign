resource "azurerm_iothub" "this" {
  endpoint                     = []
  enrichment                   = []
  event_hub_partition_count    = 2
  event_hub_retention_in_days  = 1
  local_authentication_enabled = true
  location                     = azurerm_resource_group.this.location
  min_tls_version              = "1.2"
  name                         = "hazardhero-iothub"
  resource_group_name          = azurerm_resource_group.this.name
  route                        = []
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


resource "azurerm_iothub_shared_access_policy" "service" {
  name                = "service"
  resource_group_name = azurerm_resource_group.this.name
  iothub_name         = azurerm_iothub.this.name
  service_connect     = true
}

resource "azurerm_role_assignment" "iothub_eventhub_data_receiver" {
  scope                            = azurerm_iothub.this.id
  role_definition_name             = "Azure Event Hubs Data Receiver"
  principal_id                     = azurerm_user_assigned_identity.container_app.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "iothub_data_contributor" {
  scope                            = azurerm_iothub.this.id
  role_definition_name             = "IoT Hub Data Contributor"
  principal_id                     = azurerm_user_assigned_identity.container_app.principal_id
  skip_service_principal_aad_check = true
}


locals {
  iothub_eventhub_connection_string = "Endpoint=${azurerm_iothub.this.event_hub_events_endpoint};SharedAccessKeyName=${azurerm_iothub_shared_access_policy.service.name};SharedAccessKey=${azurerm_iothub_shared_access_policy.service.primary_key};EntityPath=${azurerm_iothub.this.event_hub_events_path}"
}