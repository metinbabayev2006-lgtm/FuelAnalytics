$ErrorActionPreference = 'Stop'
$composePath = Join-Path $PSScriptRoot '..\compose.test.yaml'
try {
    & docker compose -f $composePath up -d --wait
    if ($LASTEXITCODE -ne 0) { throw 'Die isolierte PostgreSQL-Testdatenbank konnte nicht gestartet werden.' }
    Push-Location $PSScriptRoot
    try {
        & .\mvnw.cmd test '-Dtest=PostgresIntegrationTests' '-Dfuelanalytics.postgres.tests=true'
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL-Integrationstests fehlgeschlagen.' }
    } finally { Pop-Location }
} finally {
    & docker compose -f $composePath down
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Der Testcontainer konnte nicht beendet werden. Bitte compose.test.yaml prüfen.' }
}
