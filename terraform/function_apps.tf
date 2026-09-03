locals {
  api_function_app_settings = merge(
    {
      FUNCTIONS_EXTENSION_VERSION           = "~4"
      FUNCTIONS_WORKER_RUNTIME              = "dotnet-isolated"
      WEBSITE_RUN_FROM_PACKAGE              = "1"
      WEBSITE_NODE_DEFAULT_VERSION          = "~22"
      FRONTEND_URL                          = var.frontend_url
      WORKOS_REDIRECT_URI                   = var.workos_redirect_uri
      CORS_ORIGIN                           = var.cors_origin
      IOTHUB_HOST_NAME                      = var.iothub_host_name
      IOTHUB_EVENTHUB_NAME                  = var.iothub_eventhub_name
      POSTGRES_CONNECTION_STRING            = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.postgres_connection_string.versionless_id})"
      WORKOS_API_KEY                        = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.workos_api_key.versionless_id})"
      WORKOS_CLIENT_ID                      = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.workos_client_id.versionless_id})"
      APPLICATIONINSIGHTS_CONNECTION_STRING = ""
    },
    var.service_bus_connection_string != null ? {
      ServiceBusConnection = var.service_bus_connection_string
    } : {}
  )

  ai_function_app_settings = merge(
    {
      FUNCTIONS_EXTENSION_VERSION = "~4"
      FUNCTIONS_WORKER_RUNTIME    = "python"
      WEBSITE_RUN_FROM_PACKAGE    = "1"
    },
    var.service_bus_connection_string != null ? {
      ServiceBusConnection = var.service_bus_connection_string
    } : {}
  )
}

resource "azurerm_linux_function_app" "api" {
  name                       = var.api_function_app_name
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  service_plan_id            = azurerm_service_plan.functions.id
  storage_account_name       = azurerm_storage_account.static_site.name
  storage_account_access_key = azurerm_storage_account.static_site.primary_access_key

  https_only                  = true
  builtin_logging_enabled     = true
  functions_extension_version = "~4"

  identity {
    type = "SystemAssigned"
  }

  site_config {
    minimum_tls_version = "1.2"

    application_stack {
      dotnet_version = "10.0"
    }

    dynamic "cors" {
      for_each = trimspace(var.frontend_url) != "" ? [var.frontend_url] : []

      content {
        allowed_origins = [cors.value]
      }
    }
  }

  app_settings = local.api_function_app_settings

  depends_on = [
    azurerm_role_assignment.deployer_key_vault_secrets_user
  ]
}

resource "azurerm_linux_function_app" "ai" {
  name                       = var.ai_function_app_name
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  service_plan_id            = azurerm_service_plan.functions.id
  storage_account_name       = azurerm_storage_account.static_site.name
  storage_account_access_key = azurerm_storage_account.static_site.primary_access_key

  https_only                  = true
  builtin_logging_enabled     = true
  functions_extension_version = "~4"

  identity {
    type = "SystemAssigned"
  }

  site_config {
    minimum_tls_version = "1.2"

    application_stack {
      python_version = "3.12"
    }
  }

  app_settings = local.ai_function_app_settings
}

resource "azurerm_role_assignment" "api_key_vault_secrets_user" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_function_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "api_iothub_data_contributor" {
  scope                            = azurerm_iothub.this.id
  role_definition_name             = "IoT Hub Data Contributor"
  principal_id                     = azurerm_linux_function_app.api.identity[0].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "api_iothub_eventhub_data_receiver" {
  scope                            = azurerm_iothub.this.id
  role_definition_name             = "Azure Event Hubs Data Receiver"
  principal_id                     = azurerm_linux_function_app.api.identity[0].principal_id
  skip_service_principal_aad_check = true
}
