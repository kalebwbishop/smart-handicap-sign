resource "azurerm_log_analytics_workspace" "this" {
  name                = local.log_analytics_workspace_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "this" {
  name                       = local.container_app_environment_name
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
}

resource "azurerm_user_assigned_identity" "container_app" {
  name                = local.user_assigned_identity_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
}

resource "azurerm_container_app" "this" {
  name                         = local.container_app_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = azurerm_resource_group.this.name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.container_app.id]
  }

  secret {
    name                = "postgres-connection-string"
    identity            = azurerm_user_assigned_identity.container_app.id
    key_vault_secret_id = data.azurerm_key_vault_secret.postgres_connection_string.versionless_id
  }

  secret {
    name                = "workos-api-key"
    identity            = azurerm_user_assigned_identity.container_app.id
    key_vault_secret_id = data.azurerm_key_vault_secret.workos_api_key.versionless_id
  }

  secret {
    name                = "workos-client-id"
    identity            = azurerm_user_assigned_identity.container_app.id
    key_vault_secret_id = data.azurerm_key_vault_secret.workos_client_id.versionless_id
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = var.container_target_port
    transport                  = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.container_min_replicas
    max_replicas = var.container_max_replicas

    container {
      name   = "backend"
      image  = var.container_image
      cpu    = var.container_cpu
      memory = var.container_memory

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      env {
        name  = "PORT"
        value = tostring(var.container_target_port)
      }

      env {
        name        = "POSTGRES_CONNECTION_STRING"
        secret_name = "postgres-connection-string"
      }

      env {
        name        = "WORKOS_API_KEY"
        secret_name = "workos-api-key"
      }

      env {
        name        = "WORKOS_CLIENT_ID"
        secret_name = "workos-client-id"
      }

      dynamic "env" {
        for_each = {
          for name, value in local.optional_container_env : name => value if trimspace(value) != ""
        }

        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  depends_on = [azurerm_key_vault_access_policy.container_app]
}
