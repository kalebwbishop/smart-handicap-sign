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

variable "container_registry_name" {
  description = "Azure Container Registry name used to store backend images"
  type        = string
  default     = "deployboxcrprod"
}

variable "container_registry_resource_group_name" {
  description = "Resource group that contains the Azure Container Registry"
  type        = string
  default     = "deploy-box-rg-prod"
}

variable "container_image_repository" {
  description = "Repository name inside the Azure Container Registry"
  type        = string
  default     = "hazard-hero-backend"
}

variable "container_image" {
  description = "Optional full container image reference to run in Azure Container Apps"
  type        = string
  default     = ""
}

variable "container_cpu" {
  description = "vCPU allocated to the backend container"
  type        = number
  default     = 0.25
}

variable "container_memory" {
  description = "Memory allocated to the backend container"
  type        = string
  default     = "0.5Gi"
}

variable "container_target_port" {
  description = "Port exposed by the backend container"
  type        = number
  default     = 8000
}

variable "container_min_replicas" {
  description = "Minimum number of backend replicas"
  type        = number
  default     = 0
}

variable "container_max_replicas" {
  description = "Maximum number of backend replicas"
  type        = number
  default     = 1
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
