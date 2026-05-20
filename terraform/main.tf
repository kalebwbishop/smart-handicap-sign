terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  backend "azurerm" {
    use_azuread_auth     = true
    storage_account_name = "deployboxsaprod"
    container_name       = "deploy-box-iac-storage"
    key                  = "hazard-hero/terraform.tfstate"
  }
}

provider "azurerm" {
  subscription_id = var.subscription_id

  features {}
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
}

locals {
  key_vault_name                 = var.key_vault_name
  container_app_environment_name = "cae-smart-handicap-sign"
  container_app_name             = "ca-smart-handicap-sign"
  log_analytics_workspace_name   = "log-smart-handicap-sign"
  user_assigned_identity_name    = "id-smart-handicap-sign"
  optional_container_env = {
    FRONTEND_URL        = var.frontend_url
    WORKOS_REDIRECT_URI = var.workos_redirect_uri
    CORS_ORIGIN         = var.cors_origin
  }
}
