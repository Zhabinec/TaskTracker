param([ValidateSet('chromium', 'firefox', 'webkit')][string[]]$Browsers = @('chromium', 'firefox', 'webkit'))
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $taskFrontend = [IO.Path]::GetFullPath('frontend')
    if (-not (Test-Path -LiteralPath (Join-Path $taskFrontend 'node_modules/@playwright/test/cli.js'))) { throw 'Run npm ci in frontend first.' }
    $taskContainer = docker compose ps -q frontend
    if ($LASTEXITCODE -ne 0 -or -not $taskContainer) { throw 'Start the local app before running browser tests.' }
    $taskNetworks = docker inspect --format '{{json .NetworkSettings.Networks}}' $taskContainer | ConvertFrom-Json
    $taskNetwork = ($taskNetworks.PSObject.Properties | Select-Object -First 1).Name
    if (-not $taskNetwork) { throw 'Frontend network not found.' }
    $taskImage = 'mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea'
    $taskArgs = @('run', '--rm', '--ipc=host', '--network', $taskNetwork, '--mount', "type=bind,source=$taskFrontend,target=/work", '--workdir', '/work', $taskImage, 'node', 'scripts/browser-container.mjs')
    foreach ($taskBrowser in $Browsers) { $taskArgs += "--project=$taskBrowser" }
    & docker @taskArgs
    if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed.' }
}
finally { Pop-Location }
