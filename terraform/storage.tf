resource "azurerm_storage_account" "static_site" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  https_traffic_only_enabled = true
  min_tls_version            = "TLS1_2"

}

resource "azurerm_storage_account_static_website" "static_site" {
  storage_account_id = azurerm_storage_account.static_site.id
  index_document     = var.static_website_index_document
  error_404_document = var.static_website_error_document
}

resource "azurerm_storage_container" "api_function_package" {
  name                  = "api-function-package"
  storage_account_id    = azurerm_storage_account.static_site.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "ai_function_package" {
  name                  = "ai-function-package"
  storage_account_id    = azurerm_storage_account.static_site.id
  container_access_type = "private"
}

resource "azurerm_service_plan" "api_functions" {
  name                         = var.api_function_plan_name
  location                     = var.function_plan_location
  resource_group_name          = azurerm_resource_group.this.name
  os_type                      = "Linux"
  sku_name                     = "FC1"
  maximum_elastic_worker_count = 1
}

resource "azurerm_service_plan" "ai_functions" {
  name                         = var.ai_function_plan_name
  location                     = var.function_plan_location
  resource_group_name          = azurerm_resource_group.this.name
  os_type                      = "Linux"
  sku_name                     = "FC1"
  maximum_elastic_worker_count = 1
}

removed {
  from = azurerm_service_plan.functions

  lifecycle {
    destroy = false
  }
}
