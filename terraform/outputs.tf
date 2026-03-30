output "public_ip_address" {
  description = "Static public IP address of the VM"
  value       = azurerm_public_ip.this.ip_address
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh ${var.admin_username}@${azurerm_public_ip.this.ip_address}"
}

output "app_url" {
  description = "URL to access the application"
  value       = "https://${var.domain_name}"
}
