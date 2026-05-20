output "container_app_url" {
  description = "Default Azure Container Apps URL for the backend"
  value       = "https://${azurerm_container_app.this.latest_revision_fqdn}"
}

output "app_url" {
  description = "Preferred public URL for the application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${azurerm_container_app.this.latest_revision_fqdn}"
}

output "key_vault_name" {
  description = "Azure Key Vault name containing application secrets"
  value       = azurerm_key_vault.this.name
}

output "key_vault_uri" {
  description = "Azure Key Vault URI containing application secrets"
  value       = azurerm_key_vault.this.vault_uri
}
