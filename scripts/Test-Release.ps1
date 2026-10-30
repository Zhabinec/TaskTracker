$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $taskChecks = @(
        @('--prefix', 'frontend', 'run', 'lint'),
        @('--prefix', 'frontend', 'run', 'typecheck'),
        @('--prefix', 'frontend', 'test'),
        @('--prefix', 'frontend', 'audit', '--omit=dev', '--audit-level=high')
    )
    foreach ($taskCheck in $taskChecks) { & npm @taskCheck; if ($LASTEXITCODE -ne 0) { throw "Failed: npm $taskCheck" } }
    docker compose up --build --wait --wait-timeout 180
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
    & (Join-Path $PSScriptRoot 'Test-Browsers.ps1')
    Write-Host 'Local release checks passed. Physical-device and public HTTPS acceptance are separate.'
}
finally { Pop-Location }
