resource "azurerm_linux_virtual_machine" "this" {
  name                = "vm-smart-handicap-sign"
  location            = data.azurerm_resource_group.this.location
  resource_group_name = data.azurerm_resource_group.this.name
  size                = var.vm_size

  admin_username                  = var.admin_username
  disable_password_authentication = true

  admin_ssh_key {
    username   = var.admin_username
    public_key = file(var.ssh_public_key_path)
  }

  network_interface_ids = [azurerm_network_interface.this.id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 30
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
    admin_username     = var.admin_username
    github_repo_url    = var.github_repo_url
    github_repo_branch = var.github_repo_branch
    domain_name        = var.domain_name
    public_ip          = azurerm_public_ip.this.ip_address
    workos_api_key     = var.workos_api_key
    workos_client_id   = var.workos_client_id
    tls_fullchain      = file(var.tls_fullchain_path)
    tls_privkey        = file(var.tls_privkey_path)
  }))
}
