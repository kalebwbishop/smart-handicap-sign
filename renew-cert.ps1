<#
.SYNOPSIS
    Renew TLS cert via certbot + Azure DNS, using Docker.
.DESCRIPTION
    Run from Windows PowerShell: .\renew-cert.ps1
    Requires Docker Desktop to be running.
    Configure variables in .env.cert or set them as environment variables.
#>
$ErrorActionPreference = "Stop"

# ── Load .env.cert if it exists ─────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir ".env.cert"

if (Test-Path $EnvFile) {
    Write-Host "Loading variables from $EnvFile"
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            Set-Item -Path "env:$($Matches[1].Trim())" -Value $Matches[2].Trim()
        }
    }
}

# ── Validate required variables ─────────────────────────────────────
$required = @("DOMAIN", "EMAIL", "AZURE_ZONE_RESOURCE_ID")
$missing = $required | Where-Object { -not (Get-Item "env:$_" -ErrorAction SilentlyContinue) }

if ($missing) {
    Write-Error "ERROR: Missing required variables: $($missing -join ', ')`nSet them in the environment or in $EnvFile"
    exit 1
}

$Domain = $env:DOMAIN
$Email = $env:EMAIL
$AzureZoneResourceId = $env:AZURE_ZONE_RESOURCE_ID
$OutputDir = Join-Path $ScriptDir "certs"
$CertbotImage = "certbot-azure-dns"

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }

# ── 1. Build image with Azure CLI + certbot ─────────────────────────
Write-Host "Building certbot + Azure CLI image (cached after first run)..."
@"
FROM mcr.microsoft.com/azure-cli
RUN tdnf install -y python3-pip && pip3 install --no-cache-dir "azure-mgmt-dns<9.0.0" certbot certbot-dns-azure
"@ | docker build -t $CertbotImage -f - .

if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }

# ── 2. Azure CLI login ──────────────────────────────────────────────
Write-Host "Checking Azure CLI login..."
docker run --rm -v certbot-azure-cli:/root/.azure $CertbotImage az account show 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in - use the device code below to authenticate..."
    docker run --rm -it -v certbot-azure-cli:/root/.azure $CertbotImage az login --use-device-code
    if ($LASTEXITCODE -ne 0) { throw "Azure login failed" }
}

$AccountName = docker run --rm -v certbot-azure-cli:/root/.azure $CertbotImage az account show --query user.name -o tsv
Write-Host "Logged in as: $AccountName"

# ── 3. Run certbot ──────────────────────────────────────────────────
Write-Host "Running certbot (DNS-01 via Azure DNS)..."

$ContainerScript = @"
mkdir -p /tmp/cb
cat > /tmp/cb/azure.ini <<EOF
dns_azure_use_cli_credentials = true
dns_azure_zone1 = ${Domain}:${AzureZoneResourceId}
EOF
chmod 600 /tmp/cb/azure.ini

certbot certonly \
  --config-dir /tmp/cb/config \
  --work-dir   /tmp/cb/work \
  --logs-dir   /tmp/cb/logs \
  --authenticator dns-azure \
  --dns-azure-config /tmp/cb/azure.ini \
  --dns-azure-propagation-seconds 60 \
  --non-interactive \
  --agree-tos \
  --email '${Email}' \
  -d '${Domain}' \
  -d '*.${Domain}' \
  --preferred-challenges dns-01 \
  --key-type ecdsa \
  -v

CERT_DIR=/tmp/cb/config/live/${Domain}
cp "`${CERT_DIR}/fullchain.pem" /out/fullchain.pem
cp "`${CERT_DIR}/privkey.pem"   /out/privkey.pem
cp "`${CERT_DIR}/cert.pem"      /out/cert.pem
cp "`${CERT_DIR}/chain.pem"     /out/chain.pem
"@
$ContainerScript = $ContainerScript -replace "`r", ""

docker run --rm `
  -v certbot-azure-cli:/root/.azure `
  -v "${OutputDir}:/out" `
  $CertbotImage `
  sh -c $ContainerScript

if ($LASTEXITCODE -ne 0) { throw "Certbot failed" }

Write-Host ""
Write-Host "Done! Certificate files saved to $OutputDir/"
Write-Host "   fullchain.pem  - certificate + intermediates (use for nginx ssl_certificate)"
Write-Host "   privkey.pem    - private key (use for nginx ssl_certificate_key)"
Write-Host "   cert.pem       - certificate only"
Write-Host "   chain.pem      - intermediate chain only"
