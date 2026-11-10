param(
    [Parameter(Mandatory)][uri]$Origin,
    [string]$ExpectedBuild
)
$ErrorActionPreference = 'Stop'
if ($Origin.AbsolutePath -ne '/' -or $Origin.Query -or $Origin.Fragment -or $Origin.UserInfo) {
    throw 'Use an origin without a path, query, fragment or credentials.'
}
if ($Origin.Scheme -ne 'https' -and -not ($Origin.Scheme -eq 'http' -and $Origin.IsLoopback)) {
    throw 'Public deployments require HTTPS. HTTP is allowed only on loopback for local checks.'
}
$taskBase = $Origin.GetLeftPart([UriPartial]::Authority)
function Get-DeploymentResponse([string]$Path) {
    # Do not accept a redirect to another origin or an HTTP downgrade.
    $taskResponse = Invoke-WebRequest -Uri "$taskBase$Path" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 90
    if ($taskResponse.StatusCode -ne 200) { throw "Unexpected status for $Path" }
    return $taskResponse
}
function Get-DeploymentText($Response) {
    if ($Response.Content -is [byte[]]) { return [Text.Encoding]::UTF8.GetString($Response.Content) }
    return [string]$Response.Content
}
foreach ($taskPath in @('/health/live', '/health/ready')) {
    $taskResponse = Get-DeploymentResponse $taskPath
    if (((Get-DeploymentText $taskResponse) | ConvertFrom-Json).status -ne 'ok') { throw "Unhealthy: $taskPath" }
    if ($taskResponse.Headers['Cache-Control'] -notmatch 'no-store') { throw "Health response is cacheable: $taskPath" }
}
$taskResponse = Get-DeploymentResponse '/build-info.json'
if ($taskResponse.Headers['Cache-Control'] -notmatch 'no-store') { throw 'Build information is cacheable.' }
$taskBuild = ((Get-DeploymentText $taskResponse) | ConvertFrom-Json).build
if (-not $taskBuild) { throw 'Missing build identifier.' }
if ($ExpectedBuild -and $ExpectedBuild -ne $taskBuild) { throw "Expected build $ExpectedBuild; received $taskBuild" }
$taskResponse = Get-DeploymentResponse '/sw.js'
if ($taskResponse.Headers['Cache-Control'] -notmatch 'no-store') { throw 'Service worker is cacheable.' }
if ($taskResponse.Headers['Content-Type'] -notmatch 'javascript') { throw 'Service worker did not return JavaScript.' }
$taskManifest = (Get-DeploymentText (Get-DeploymentResponse '/manifest.webmanifest')) | ConvertFrom-Json
if ($taskManifest.start_url -ne '/projects' -or $taskManifest.display -ne 'standalone') { throw 'Unexpected PWA manifest.' }
foreach ($taskPath in @('/login', '/projects')) {
    $taskResponse = Get-DeploymentResponse $taskPath
    if ($taskResponse.Headers['Content-Type'] -notmatch 'text/html' -or $taskResponse.Content -notmatch 'TaskTracker') {
        throw "Missing app shell: $taskPath"
    }
}
foreach ($taskPath in @('/icon-192.png', '/icon-512.png', '/fonts/jakarta-latin.woff2', '/fonts/inter-latin.woff2', '/fonts/inter-cyrillic.woff2')) {
    $taskResponse = Get-DeploymentResponse $taskPath
    if ($taskResponse.RawContentLength -le 0) { throw "Empty PWA asset: $taskPath" }
}
[pscustomobject]@{ Origin = $taskBase; Build = $taskBuild; HTTPS = ($Origin.Scheme -eq 'https'); HTTPChecks = 'passed' }
Write-Host 'Browser offline, update/rollback and physical Android acceptance remain separate checks.'
