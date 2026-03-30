variable "resource_group_name" {
  description = "Name of the existing Azure resource group"
  type        = string
  default     = "res000_0_4e69310cb4464d47"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "smarthandicapsign.deploy-box.com"
}

variable "vm_size" {
  description = "Azure VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "admin_username" {
  description = "SSH admin username for the VM"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key file"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "github_repo_url" {
  description = "HTTPS URL of the GitHub repository to clone"
  type        = string
  default     = "https://github.com/kalebwbishop/smart-handicap-sign.git"
}

variable "github_repo_branch" {
  description = "Branch to checkout after cloning"
  type        = string
  default     = "main"
}

# Secrets (sensitive)
variable "workos_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "workos_client_id" {
  type      = string
  sensitive = true
  default   = ""
}

# TLS certificate paths
variable "tls_fullchain_path" {
  type    = string
  default = "../certs/fullchain.pem"
}
variable "tls_privkey_path" {
  type    = string
  default = "../certs/privkey.pem"
}
