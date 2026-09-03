output "app_url" {
  description = "Preferred public URL for the application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : azurerm_storage_account.static_site.primary_web_endpoint
}

output "key_vault_name" {
  description = "Azure Key Vault name containing application secrets"
  value       = azurerm_key_vault.this.name
}

output "key_vault_uri" {
  description = "Azure Key Vault URI containing application secrets"
  value       = azurerm_key_vault.this.vault_uri
}

output "static_website_url" {
  description = "Storage Account static website URL"
  value       = azurerm_storage_account.static_site.primary_web_endpoint
}

output "storage_account_name" {
  description = "Storage Account used by the static website and Function Apps"
  value       = azurerm_storage_account.static_site.name
}

output "function_plan_name" {
  description = "Azure Functions Consumption plan name"
  value       = azurerm_service_plan.functions.name
}

output "api_function_app_url" {
  description = "Default URL for the .NET API Function App"
  value       = "https://${azurerm_linux_function_app.api.default_hostname}"
}

output "ai_function_app_url" {
  description = "Default URL for the Python AI Function App"
  value       = "https://${azurerm_linux_function_app.ai.default_hostname}"
}
