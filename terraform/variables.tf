variable "subscription_id" {
  description = "Azure subscription ID used by the azurerm provider"
  type        = string
  default     = "3d5d1ab2-b17f-4c99-9bf1-db4fe0ad882e"
}

variable "resource_group_name" {
  description = "Name of the Azure resource group Terraform manages"
  type        = string
  default     = "res000_0_shs"
}

variable "location" {
  description = "Azure region for the managed infrastructure"
  type        = string
  default     = "eastus"
}

variable "storage_account_name" {
  description = "Globally unique Azure Storage Account name used by Functions and static website hosting"
  type        = string
  default     = "shsstaticweb"
}

variable "api_function_plan_name" {
  description = "Name of the .NET API Azure Functions Flex Consumption plan"
  type        = string
  default     = "ASP-res0000shs-api"
}

variable "ai_function_plan_name" {
  description = "Name of the Python AI Azure Functions Flex Consumption plan"
  type        = string
  default     = "ASP-res0000shs-ai"
}

variable "function_plan_location" {
  description = "Azure region for the Azure Functions Consumption plan"
  type        = string
  default     = "eastus"
}

variable "api_function_app_name" {
  description = "Name of the .NET API Azure Function App"
  type        = string
  default     = "func-smart-handicap-sign-api"
}

variable "ai_function_app_name" {
  description = "Name of the Python AI Azure Function App"
  type        = string
  default     = "func-smart-handicap-sign-ai"
}

variable "model_blob_url" {
  description = "HTTPS URL of the AI model checkpoint blob"
  type        = string
  default     = "https://res0000shs9a64.blob.core.windows.net/res0000shs9a64/best.pt"
}

variable "model_storage_account_name" {
  description = "Storage account containing the AI model checkpoint"
  type        = string
  default     = "res0000shs9a64"
}

variable "static_website_index_document" {
  description = "Entry document served by the Storage Account static website"
  type        = string
  default     = "index.html"
}

variable "static_website_error_document" {
  description = "Fallback error document served by the Storage Account static website"
  type        = string
  default     = "404.html"
}

variable "service_bus_connection_string" {
  description = "Service Bus connection string used by the Function Apps"
  type        = string
  sensitive   = true
  default     = null
  nullable    = true
}

variable "key_vault_name" {
  description = "Stable Azure Key Vault name used for application secrets"
  type        = string
  default     = "hhhazardherokv"
}

variable "domain_name" {
  description = "Optional public hostname for the application, managed outside Terraform"
  type        = string
  default     = ""
}

variable "postgres_connection_string" {
  description = "Legacy compatibility input. PostgreSQL connection string is now read from Azure Key Vault."
  type        = string
  sensitive   = true
  default     = null
  nullable    = true
}

variable "frontend_url" {
  description = "Public frontend URL used by the backend"
  type        = string
  default     = ""
}

variable "workos_redirect_uri" {
  description = "OAuth callback URL registered with WorkOS"
  type        = string
  default     = "https://ca-smart-handicap-sign.bluebay-3cb7e242.eastus.azurecontainerapps.io/api/v1/auth/callback"
}

variable "cors_origin" {
  description = "Comma-separated CORS origins for the backend API"
  type        = string
  default     = ""
}

variable "iothub_host_name" {
  description = "Azure IoT Hub host name used by the backend"
  type        = string
  default     = "hazardhero-iothub.azure-devices.net"
}

variable "iothub_eventhub_name" {
  description = "Event Hub-compatible endpoint name used by the backend"
  type        = string
  default     = "iothub-ehub-hazardhero-72042401-0a34df473a"
}

# Application secrets
variable "workos_api_key" {
  description = "Legacy compatibility input. The WorkOS API key is now read from Azure Key Vault."
  type        = string
  sensitive   = true
  default     = null
  nullable    = true
}

variable "workos_client_id" {
  description = "Legacy compatibility input. The WorkOS client ID is now read from Azure Key Vault."
  type        = string
  sensitive   = true
  default     = null
  nullable    = true
}
