# Isolated integration check. Never points tests at the user's database or volume.
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerPath = if ($dockerCommand) { $dockerCommand.Source } else {
    @(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe",
        'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $dockerPath) { throw 'Docker Desktop wurde nicht gefunden.' }
$containerName = 'fuelanalytics-qa-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$variables = 'SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD', 'POSTGRES_PASSWORD', 'TANKERKOENIG_API_KEY', 'Path'
$previous = @{}
foreach ($variable in $variables) { $previous[$variable] = [Environment]::GetEnvironmentVariable($variable, 'Process') }
$created = $false
$testExit = 1
try {
    $env:Path = (Split-Path -Parent $dockerPath) + ';' + $env:Path
    $randomBytes = New-Object byte[] 24
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($randomBytes) } finally { $random.Dispose() }
    $env:POSTGRES_PASSWORD = [BitConverter]::ToString($randomBytes).Replace('-', '')
    # Empty disposable container, random loopback port; no production volumes.
    & $dockerPath run --detach --rm --name $containerName --publish '127.0.0.1::5432' `
        --env 'POSTGRES_DB=fuelanalytics_test' --env 'POSTGRES_USER=fuelanalytics_test' `
        --env POSTGRES_PASSWORD --health-cmd 'pg_isready -U fuelanalytics_test -d fuelanalytics_test' `
        --health-interval 1s --health-timeout 3s --health-retries 30 'postgres:18.6-alpine' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Die isolierte Testdatenbank konnte nicht starten.' }
    $created = $true
    $healthy = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        $health = & $dockerPath inspect --format '{{.State.Health.Status}}' $containerName
        if ($health -eq 'healthy') { $healthy = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $healthy) { throw 'Die isolierte Testdatenbank ist nicht bereit.' }
    $binding = & $dockerPath port $containerName '5432/tcp'
    if ($binding -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unerwartete Portfreigabe der Testdatenbank.' }
    $env:SPRING_DATASOURCE_URL = 'jdbc:postgresql://127.0.0.1:' + $Matches[1] + '/fuelanalytics_test'
    $env:SPRING_DATASOURCE_USERNAME = 'fuelanalytics_test'
    $env:SPRING_DATASOURCE_PASSWORD = $env:POSTGRES_PASSWORD
    $env:TANKERKOENIG_API_KEY = ''
    Write-Output 'Tests laufen gegen eine neue, isolierte PostgreSQL-Datenbank.'
    Push-Location (Join-Path $projectDir 'backend')
    try { & .\mvnw.cmd -B test; $testExit = $LASTEXITCODE } finally { Pop-Location }
} finally {
    if ($created) { & $dockerPath stop --time 5 $containerName | Out-Null }
    foreach ($variable in $variables) { [Environment]::SetEnvironmentVariable($variable, $previous[$variable], 'Process') }
}
exit $testExit
