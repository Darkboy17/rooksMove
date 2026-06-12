<#
.SYNOPSIS
Build, push, and deploy a Dockerized backend to a Linux VM over SSH.

.EXAMPLE
.\deploy-backend.ps1 `
  -ImageRepository darkboy18/rooks-move-backend `
  -Tag arm64 `
  -Platform linux/arm64 `
  -SshHost 203.0.113.10 `
  -SshUser ubuntu `
  -SshKeyPath "$env:USERPROFILE\.ssh\your-vm-key" `
  -Domain api.example.com `
  -SiteName rooks-move-api `
  -ContainerName rooks-move-backend `
  -HostPort 3000 `
  -ContainerPort 3000 `
  -LocalEnvFile .env `
  -RequiredEnvKeys MONGODB_URI,JWT_SECRET `
  -CertbotMode nginx
#>

[CmdletBinding()]
param(
  [string]$ProjectPath = "",
  [string]$Dockerfile = "Dockerfile",

  [Parameter(Mandatory = $true)]
  [string]$ImageRepository,

  [string]$Tag = "arm64",
  [string]$Platform = "linux/arm64",

  [Parameter(Mandatory = $true)]
  [string]$SshHost,

  [string]$SshUser = "",
  [int]$SshPort = 22,
  [string]$SshKeyPath = "",

  [Parameter(Mandatory = $true)]
  [string]$Domain,

  [string]$SiteName = "",
  [string]$ContainerName = "",
  [int]$HostPort = 3000,
  [int]$ContainerPort = 3000,
  [string]$BindAddress = "127.0.0.1",

  [string]$LocalEnvFile = "",
  [string]$RemoteEnvFile = "",
  [string[]]$RequiredEnvKeys = @(),
  [string]$CertbotWebroot = "/var/www/html",
  [ValidateSet("nginx", "webroot")]
  [string]$CertbotMode = "nginx",
  [string]$CertbotEmail = "",
  [string]$AcmeChallengeVolumeHostPath = "",
  [string]$AcmeChallengeVolumeContainerPath = "/app/.well-known/acme-challenge",

  [switch]$SkipBuild,
  [switch]$SkipPush,
  [switch]$SkipEnvUpload,
  [switch]$StrictEnvValidation,
  [switch]$SkipFirewall,
  [switch]$SkipCertbot,
  [switch]$SkipNginx,
  [switch]$SkipRun,
  [switch]$SkipDnsPreflight
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function ConvertTo-BashString {
  param([AllowNull()][string]$Value)
  if ($null -eq $Value) {
    return "''"
  }

  return "'" + ($Value -replace "'", "'\''") + "'"
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

function Test-DomainDnsPreflight {
  param(
    [string]$DomainName,
    [string]$ExpectedHost
  )

  if ([string]::IsNullOrWhiteSpace($DomainName)) {
    throw "Domain is required for DNS preflight."
  }

  Write-Step "Checking DNS for $DomainName"

  try {
    $dnsRecords = Resolve-DnsName $DomainName -Type A -ErrorAction Stop |
      Where-Object { $_.IPAddress }
  } catch {
    throw @"
DNS preflight failed for $DomainName.
Resolve the domain before running Certbot. For DuckDNS, confirm the token/update URL has set $DomainName to your VM public IP, then wait for DNS propagation.
Original DNS error: $($_.Exception.Message)
"@
  }

  $addresses = @($dnsRecords | ForEach-Object { $_.IPAddress } | Sort-Object -Unique)
  if ($addresses.Count -eq 0) {
    throw "DNS preflight failed for $DomainName. No A records were returned."
  }

  Write-Host "Resolved A record(s): $($addresses -join ', ')"

  if ($ExpectedHost -match "^\d{1,3}(\.\d{1,3}){3}$" -and $addresses -notcontains $ExpectedHost) {
    Write-Warning "$DomainName resolves to $($addresses -join ', '), but SshHost is $ExpectedHost. Certbot will fail if the domain does not point to this nginx server."
  }
}

if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
  $ProjectPath = (Get-Location).Path
}

$resolvedProjectPath = (Resolve-Path $ProjectPath).Path
$resolvedDockerfile = Join-Path $resolvedProjectPath $Dockerfile

if (!(Test-Path $resolvedDockerfile)) {
  throw "Dockerfile not found: $resolvedDockerfile"
}

if ([string]::IsNullOrWhiteSpace($SiteName)) {
  $SiteName = ($Domain -replace "[^a-zA-Z0-9_-]", "-")
}

if ([string]::IsNullOrWhiteSpace($ContainerName)) {
  $ContainerName = "$SiteName-container"
}

if (!$SkipDnsPreflight -and !$SkipCertbot) {
  Test-DomainDnsPreflight -DomainName $Domain -ExpectedHost $SshHost
}

$resolvedLocalEnvFile = ""
$localEnvKeys = @()
if (![string]::IsNullOrWhiteSpace($LocalEnvFile)) {
  $localEnvCandidate = if ([System.IO.Path]::IsPathRooted($LocalEnvFile)) {
    $LocalEnvFile
  } else {
    Join-Path $resolvedProjectPath $LocalEnvFile
  }

  if (!(Test-Path $localEnvCandidate)) {
    throw "Local env file not found: $localEnvCandidate"
  }

  $resolvedLocalEnvFile = (Resolve-Path $localEnvCandidate).Path
  $localEnvKeys = Get-Content -LiteralPath $resolvedLocalEnvFile |
    ForEach-Object {
      if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
        $matches[1]
      }
    } |
    Sort-Object -Unique

  if ([string]::IsNullOrWhiteSpace($RemoteEnvFile)) {
    $RemoteEnvFile = "/opt/$SiteName/.env"
  }
}

foreach ($key in $RequiredEnvKeys) {
  if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "Invalid required env key: $key"
  }
}

if ($RequiredEnvKeys.Count -gt 0 -and ![string]::IsNullOrWhiteSpace($resolvedLocalEnvFile)) {
  $missingLocalEnvKeys = $RequiredEnvKeys | Where-Object { $localEnvKeys -notcontains $_ }
  if ($missingLocalEnvKeys.Count -gt 0) {
    $message = "Local env file is missing required keys: $($missingLocalEnvKeys -join ', ')"
    if ($StrictEnvValidation) {
      throw $message
    }
    Write-Warning $message
  }
}

$imageRef = "${ImageRepository}:${Tag}"
$requiredEnvKeysText = $RequiredEnvKeys -join "`n"
$sshTarget = if ([string]::IsNullOrWhiteSpace($SshUser)) { $SshHost } else { "${SshUser}@${SshHost}" }
$sshBaseArgs = @("-p", "$SshPort")

if (![string]::IsNullOrWhiteSpace($SshKeyPath)) {
  $sshBaseArgs += @("-i", $SshKeyPath)
}

$sshArgs = $sshBaseArgs + @($sshTarget, "bash -s")
$scpArgs = @("-P", "$SshPort")

if (![string]::IsNullOrWhiteSpace($SshKeyPath)) {
  $scpArgs += @("-i", $SshKeyPath)
}

if (!$SkipBuild) {
  Write-Step "Building $imageRef for $Platform"
  Invoke-Checked "docker" @(
    "build",
    "--platform", $Platform,
    "-t", $imageRef,
    "-f", $resolvedDockerfile,
    $resolvedProjectPath
  )
}

if (!$SkipPush) {
  Write-Step "Pushing $imageRef"
  Invoke-Checked "docker" @("push", $imageRef)
}

$remoteEnvUploadPath = ""
if (!$SkipEnvUpload -and ![string]::IsNullOrWhiteSpace($resolvedLocalEnvFile)) {
  $remoteEnvUploadPath = "/tmp/$SiteName.env.$([guid]::NewGuid().ToString('N'))"
  Write-Step "Uploading local env file to VM"
  Write-Host "Local env keys: $($localEnvKeys -join ', ')"
  Invoke-Checked "scp" ($scpArgs + @($resolvedLocalEnvFile, "${sshTarget}:$remoteEnvUploadPath"))
}

$remoteScript = @"
set -euo pipefail

IMAGE_REF=$(ConvertTo-BashString $imageRef)
DOMAIN=$(ConvertTo-BashString $Domain)
SITE_NAME=$(ConvertTo-BashString $SiteName)
CONTAINER_NAME=$(ConvertTo-BashString $ContainerName)
HOST_PORT=$(ConvertTo-BashString ([string]$HostPort))
CONTAINER_PORT=$(ConvertTo-BashString ([string]$ContainerPort))
BIND_ADDRESS=$(ConvertTo-BashString $BindAddress)
REMOTE_ENV_FILE=$(ConvertTo-BashString $RemoteEnvFile)
REMOTE_ENV_UPLOAD_PATH=$(ConvertTo-BashString $remoteEnvUploadPath)
REQUIRED_ENV_KEYS_TEXT=$(ConvertTo-BashString $requiredEnvKeysText)
CERTBOT_WEBROOT=$(ConvertTo-BashString $CertbotWebroot)
CERTBOT_MODE=$(ConvertTo-BashString $CertbotMode)
CERTBOT_EMAIL=$(ConvertTo-BashString $CertbotEmail)
ACME_VOLUME_HOST=$(ConvertTo-BashString $AcmeChallengeVolumeHostPath)
ACME_VOLUME_CONTAINER=$(ConvertTo-BashString $AcmeChallengeVolumeContainerPath)
SKIP_FIREWALL=$(ConvertTo-BashString ([string][int]$SkipFirewall.IsPresent))
SKIP_CERTBOT=$(ConvertTo-BashString ([string][int]$SkipCertbot.IsPresent))
SKIP_NGINX=$(ConvertTo-BashString ([string][int]$SkipNginx.IsPresent))
SKIP_RUN=$(ConvertTo-BashString ([string][int]$SkipRun.IsPresent))
STRICT_ENV_VALIDATION=$(ConvertTo-BashString ([string][int]$StrictEnvValidation.IsPresent))

log() {
  printf '\n==> %s\n' "`$1"
}

require_command() {
  if ! command -v "`$1" >/dev/null 2>&1; then
    printf 'Missing required command on VM: %s\n' "`$1" >&2
    exit 1
  fi
}

require_command docker

if [ -n "`$REMOTE_ENV_UPLOAD_PATH" ]; then
  if [ -z "`$REMOTE_ENV_FILE" ]; then
    printf 'REMOTE_ENV_FILE is required when uploading a local env file\n' >&2
    exit 1
  fi

  log "Installing env file at `$REMOTE_ENV_FILE"
  sudo mkdir -p "`$(dirname "`$REMOTE_ENV_FILE")"
  sudo install -m 600 -o root -g root "`$REMOTE_ENV_UPLOAD_PATH" "`$REMOTE_ENV_FILE"
  rm -f "`$REMOTE_ENV_UPLOAD_PATH"

  installed_env_keys="`$(sudo awk -F= '/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=/{gsub(/^[[:space:]]+|[[:space:]]+`$/, "", `$1); print `$1}' "`$REMOTE_ENV_FILE" | sort -u | paste -sd ', ' -)"
  echo "Installed env keys: `$installed_env_keys"
fi

if [ -n "`$REMOTE_ENV_FILE" ] && [ -n "`$REQUIRED_ENV_KEYS_TEXT" ]; then
  missing_env_keys=()
  while IFS= read -r env_key; do
    [ -z "`$env_key" ] && continue
    if ! sudo grep -Eq "^[[:space:]]*`$env_key[[:space:]]*=" "`$REMOTE_ENV_FILE"; then
      missing_env_keys+=("`$env_key")
    fi
  done <<< "`$REQUIRED_ENV_KEYS_TEXT"

  if [ "`${#missing_env_keys[@]}" -gt 0 ]; then
    if [ "`$STRICT_ENV_VALIDATION" = "1" ]; then
      printf 'Remote env file is missing required keys: %s\n' "`$(IFS=', '; echo "`${missing_env_keys[*]}")" >&2
      exit 1
    fi
    printf 'Warning: remote env file is missing expected keys: %s\n' "`$(IFS=', '; echo "`${missing_env_keys[*]}")" >&2
  fi
fi

if [ "`$SKIP_FIREWALL" != "1" ]; then
  log "Opening TCP port `$HOST_PORT with iptables"
  if sudo iptables -C INPUT -m state --state NEW -p tcp --dport "`$HOST_PORT" -j ACCEPT 2>/dev/null; then
    echo "iptables rule already exists"
  else
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "`$HOST_PORT" -j ACCEPT
  fi

  if command -v netfilter-persistent >/dev/null 2>&1; then
    sudo netfilter-persistent save
  else
    echo "netfilter-persistent not installed; iptables rule may not survive reboot"
  fi
fi

if [ "`$SKIP_NGINX" != "1" ]; then
  require_command nginx
  sudo mkdir -p "`$CERTBOT_WEBROOT"

  log "Writing bootstrap nginx site `$SITE_NAME for certificate issuance"
  sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

  sudo tee "/etc/nginx/sites-available/`$SITE_NAME" >/dev/null <<NGINX_BOOTSTRAP
server {
    listen 80;
    server_name `$DOMAIN;

    root `$CERTBOT_WEBROOT;

    location ^~ /.well-known/acme-challenge/ {
        root `$CERTBOT_WEBROOT;
    }

    location / {
        return 200 'Backend deployment bootstrap for `$DOMAIN';
        add_header Content-Type text/plain;
    }
}
NGINX_BOOTSTRAP

  sudo ln -sfn "/etc/nginx/sites-available/`$SITE_NAME" "/etc/nginx/sites-enabled/`$SITE_NAME"
  sudo nginx -t

  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl reload nginx
  else
    sudo service nginx reload || sudo nginx -s reload
  fi
fi

if [ "`$SKIP_CERTBOT" != "1" ]; then
  require_command certbot
  log "Requesting/renewing certificate for `$DOMAIN using `$CERTBOT_MODE mode"

  if ! getent ahosts "`$DOMAIN" >/dev/null 2>&1; then
    printf 'DNS preflight failed on the VM for %s. Certbot cannot issue a certificate until the domain resolves publicly to this nginx server.\n' "`$DOMAIN" >&2
    printf 'For DuckDNS, update the domain to the VM public IP and wait for DNS propagation before retrying.\n' >&2
    exit 1
  fi

  certbot_args=(--agree-tos --non-interactive --keep-until-expiring -d "`$DOMAIN")
  if [ -n "`$CERTBOT_EMAIL" ]; then
    certbot_args+=(--email "`$CERTBOT_EMAIL")
  else
    certbot_args+=(--register-unsafely-without-email)
  fi

  if [ "`$CERTBOT_MODE" = "nginx" ]; then
    sudo certbot --nginx "`${certbot_args[@]}"
  else
    sudo mkdir -p "`$CERTBOT_WEBROOT"
    sudo certbot certonly --webroot -w "`$CERTBOT_WEBROOT" "`${certbot_args[@]}"
  fi
fi

if [ "`$SKIP_NGINX" != "1" ]; then
  log "Writing final nginx site `$SITE_NAME for `$DOMAIN"

  sudo tee "/etc/nginx/sites-available/`$SITE_NAME" >/dev/null <<NGINX
server {
    listen 80;
    server_name `$DOMAIN;

    location ^~ /.well-known/acme-challenge/ {
        root `$CERTBOT_WEBROOT;
    }

    location / {
        return 301 https://\`$host\`$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name `$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/`$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/`$DOMAIN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:`$HOST_PORT;

        proxy_set_header Host \`$host;
        proxy_set_header X-Real-IP \`$remote_addr;
        proxy_set_header X-Forwarded-For \`$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \`$scheme;
        proxy_set_header X-Forwarded-Host \`$host;
        proxy_set_header X-Forwarded-Port \`$server_port;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \`$http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
NGINX

  sudo ln -sfn "/etc/nginx/sites-available/`$SITE_NAME" "/etc/nginx/sites-enabled/`$SITE_NAME"
  sudo nginx -t

  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl reload nginx
  else
    sudo service nginx reload || sudo nginx -s reload
  fi
fi

if [ "`$SKIP_RUN" != "1" ]; then
  log "Pulling Docker image `$IMAGE_REF"
  sudo docker pull "`$IMAGE_REF"

  log "Replacing container `$CONTAINER_NAME"
  sudo docker rm -f "`$CONTAINER_NAME" >/dev/null 2>&1 || true

  port_mapping="`$HOST_PORT:`$CONTAINER_PORT"
  if [ -n "`$BIND_ADDRESS" ]; then
    port_mapping="`$BIND_ADDRESS:`$port_mapping"
  fi

  run_args=(run -d --restart unless-stopped -p "`$port_mapping" --name "`$CONTAINER_NAME")

  if [ -n "`$REMOTE_ENV_FILE" ]; then
    if [ ! -f "`$REMOTE_ENV_FILE" ]; then
      printf 'Remote env file does not exist: %s\n' "`$REMOTE_ENV_FILE" >&2
      exit 1
    fi
    run_args+=(--env-file "`$REMOTE_ENV_FILE")
  fi

  if [ -n "`$ACME_VOLUME_HOST" ]; then
    sudo mkdir -p "`$ACME_VOLUME_HOST"
    run_args+=(-v "`$ACME_VOLUME_HOST:`$ACME_VOLUME_CONTAINER")
  fi

  run_args+=("`$IMAGE_REF")
  sudo docker "`${run_args[@]}"

  log "Container status"
  sudo docker ps --filter "name=`$CONTAINER_NAME" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
fi

log "Deployment complete"
echo "Access link: https://`$DOMAIN"
"@

Write-Step "Deploying $imageRef to $sshTarget"

# Convert Windows CRLF line endings to Linux LF before sending to remote bash.
$remoteScriptForSsh = $remoteScript -replace "`r`n", "`n" -replace "`r", "`n"

$remoteScriptForSsh | & ssh @sshArgs

if ($LASTEXITCODE -ne 0) {
  throw "Remote deployment failed with exit code $LASTEXITCODE"
}

Write-Step "Done"
Write-Host "Access link: https://$Domain"
