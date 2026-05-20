resource "azurerm_key_vault" "this" {
  name                            = local.key_vault_name
  location                        = azurerm_resource_group.this.location
  resource_group_name             = azurerm_resource_group.this.name
  tenant_id                       = data.azurerm_client_config.current.tenant_id
  sku_name                        = "standard"
  soft_delete_retention_days      = 7
  purge_protection_enabled        = false
  enabled_for_deployment          = false
  enabled_for_disk_encryption     = false
  enabled_for_template_deployment = false
}

resource "azurerm_key_vault_access_policy" "deployer" {
  key_vault_id = azurerm_key_vault.this.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
  ]
}

resource "azurerm_key_vault_access_policy" "container_app" {
  key_vault_id = azurerm_key_vault.this.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.container_app.principal_id

  secret_permissions = [
    "Get",
    "List",
  ]
}

data "azurerm_key_vault_secret" "workos_api_key" {
  name         = local.key_vault_secret_names.workos_api_key
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

data "azurerm_key_vault_secret" "postgres_connection_string" {
  name         = local.key_vault_secret_names.postgres_connection_string
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

data "azurerm_key_vault_secret" "workos_client_id" {
  name         = local.key_vault_secret_names.workos_client_id
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

removed {
  from = azurerm_key_vault_secret.workos_api_key

  lifecycle {
    destroy = false
  }
}

removed {
  from = azurerm_key_vault_secret.postgres_connection_string

  lifecycle {
    destroy = false
  }
}

removed {
  from = azurerm_key_vault_secret.workos_client_id

  lifecycle {
    destroy = false
  }
}
