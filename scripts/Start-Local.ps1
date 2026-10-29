$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    if (-not (Test-Path -LiteralPath '.env')) {
        $taskPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        @(
            'POSTGRES_DB=tasktracker'
            'POSTGRES_USER=tasktracker'
            "POSTGRES_PASSWORD=$taskPassword"
            'POSTGRES_PORT=15432'
            'APP_ORIGIN=http://localhost:3000'
        ) | Set-Content -LiteralPath '.env' -Encoding utf8
        Write-Host 'Created local .env with a random database password.'
    }
    docker compose up --build --wait --wait-timeout 180
    if ($LASTEXITCODE -ne 0) { throw 'Local stack failed to start.' }
    Write-Host 'TaskTracker is ready: http://localhost:3000'
    Write-Host 'Stop with: docker compose down (database contents are preserved).'
}
finally { Pop-Location }
