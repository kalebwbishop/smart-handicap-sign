resource "azurerm_key_vault" "this" {
  name                            = local.key_vault_name
  location                        = azurerm_resource_group.this.location
  resource_group_name             = azurerm_resource_group.this.name
  tenant_id                       = data.azurerm_client_config.current.tenant_id
  sku_name                        = "standard"
  rbac_authorization_enabled      = true
  soft_delete_retention_days      = 7
  purge_protection_enabled        = false
  enabled_for_deployment          = false
  enabled_for_disk_encryption     = false
  enabled_for_template_deployment = false
}

resource "azurerm_role_assignment" "deployer_key_vault_secrets_user" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_role_assignment" "container_app_key_vault_secrets_user" {
  scope                            = azurerm_key_vault.this.id
  role_definition_name             = "Key Vault Secrets User"
  principal_id                     = azurerm_user_assigned_identity.container_app.principal_id
  skip_service_principal_aad_check = true
}

data "azurerm_key_vault_secret" "workos_api_key" {
  name         = local.key_vault_secret_names.workos_api_key
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [azurerm_role_assignment.deployer_key_vault_secrets_user]
}

data "azurerm_key_vault_secret" "postgres_connection_string" {
  name         = local.key_vault_secret_names.postgres_connection_string
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [azurerm_role_assignment.deployer_key_vault_secrets_user]
}

data "azurerm_key_vault_secret" "workos_client_id" {
  name         = local.key_vault_secret_names.workos_client_id
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [azurerm_role_assignment.deployer_key_vault_secrets_user]
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
