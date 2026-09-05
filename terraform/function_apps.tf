locals {
  api_function_app_settings = merge(
    {
      APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.this.connection_string
      FRONTEND_URL                          = var.frontend_url
      WORKOS_REDIRECT_URI                   = var.workos_redirect_uri
      CORS_ORIGIN                           = var.cors_origin
      IOTHUB_HOST_NAME                      = var.iothub_host_name
      IOTHUB_EVENTHUB_NAME                  = var.iothub_eventhub_name
      POSTGRES_CONNECTION_STRING            = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.postgres_connection_string.versionless_id})"
      IOT_HUB_CONNECTION_STRING             = "HostName=${azurerm_iothub.this.hostname};SharedAccessKeyName=${azurerm_iothub_shared_access_policy.service.name};SharedAccessKey=${azurerm_iothub_shared_access_policy.service.primary_key}"
      WORKOS_API_KEY                        = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.workos_api_key.versionless_id})"
      WORKOS_CLIENT_ID                      = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.workos_client_id.versionless_id})"
    },
    var.service_bus_connection_string != null ? {
      ServiceBusConnection = var.service_bus_connection_string
    } : {}
  )

  ai_function_app_settings = merge(
    {
      APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.this.connection_string
      MODEL_BLOB_URL                        = var.model_blob_url
    },
    var.service_bus_connection_string != null ? {
      ServiceBusConnection = var.service_bus_connection_string
    } : {}
  )
}

resource "azurerm_application_insights" "this" {
  name                = "appi-smart-handicap-sign"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.this.id
}

data "azurerm_storage_account" "model" {
  name                = var.model_storage_account_name
  resource_group_name = azurerm_resource_group.this.name
}

resource "azurerm_function_app_flex_consumption" "api" {
  name                          = var.api_function_app_name
  location                      = azurerm_resource_group.this.location
  resource_group_name           = azurerm_resource_group.this.name
  service_plan_id               = azurerm_service_plan.api_functions.id
  storage_container_type        = "blobContainer"
  storage_container_endpoint    = "${azurerm_storage_account.static_site.primary_blob_endpoint}${azurerm_storage_container.api_function_package.name}"
  storage_authentication_type   = "StorageAccountConnectionString"
  storage_access_key            = azurerm_storage_account.static_site.primary_access_key
  runtime_name                  = "dotnet-isolated"
  runtime_version               = "10.0"
  maximum_instance_count        = 100
  instance_memory_in_mb         = 512
  https_only                    = true
  enabled                       = true
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    minimum_tls_version = "1.2"

    dynamic "cors" {
      for_each = trimspace(var.frontend_url) != "" ? [var.frontend_url] : []

      content {
        allowed_origins     = [cors.value]
        support_credentials = false
      }
    }
  }

  app_settings = local.api_function_app_settings

  depends_on = [
    azurerm_role_assignment.deployer_key_vault_secrets_user
  ]
}

resource "azurerm_function_app_flex_consumption" "ai" {
  name                          = var.ai_function_app_name
  location                      = azurerm_resource_group.this.location
  resource_group_name           = azurerm_resource_group.this.name
  service_plan_id               = azurerm_service_plan.ai_functions.id
  storage_container_type        = "blobContainer"
  storage_container_endpoint    = "${azurerm_storage_account.static_site.primary_blob_endpoint}${azurerm_storage_container.ai_function_package.name}"
  storage_authentication_type   = "StorageAccountConnectionString"
  storage_access_key            = azurerm_storage_account.static_site.primary_access_key
  runtime_name                  = "python"
  runtime_version               = "3.12"
  maximum_instance_count        = 100
  instance_memory_in_mb         = 512
  https_only                    = true
  enabled                       = true
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    minimum_tls_version = "1.2"
  }

  app_settings = local.ai_function_app_settings
}

resource "azurerm_role_assignment" "api_key_vault_secrets_user" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_function_app_flex_consumption.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "ai_model_blob_reader" {
  scope                = data.azurerm_storage_account.model.id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = azurerm_function_app_flex_consumption.ai.identity[0].principal_id
}
