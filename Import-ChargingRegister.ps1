$ErrorActionPreference = 'Stop'
# Official snapshot; update the URL deliberately when importing a newer register.
$sourceUrl = 'https://data.bundesnetzagentur.de/Bundesnetzagentur/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenregister_BNetzA_2026-09-01.csv'
$dataDirectory = Join-Path $PSScriptRoot 'data'
New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
$downloadPath = Join-Path $dataDirectory 'charging-bnetza.csv.download'
$registerPath = Join-Path $dataDirectory 'charging-bnetza.csv'
try {
    Invoke-WebRequest -Uri $sourceUrl -OutFile $downloadPath -TimeoutSec 120
    if ((Get-Item -LiteralPath $downloadPath).Length -gt 100000000) { throw 'Registerdatei unerwartet groß.' }
    $reader = [System.IO.StreamReader]::new($downloadPath, [System.Text.Encoding]::UTF8)
    try {
        $foundHeader = $false
        $foundDate = $false
        for ($lineNumber = 0; $lineNumber -lt 30 -and -not $reader.EndOfStream; $lineNumber++) {
            $line = $reader.ReadLine()
            if ($line.StartsWith('Letzte Aktualisierung vom:')) { $foundDate = $true }
            if ($line.StartsWith('Ladeeinrichtungs-ID;') -and $line.Contains('Breitengrad;Längengrad;')) { $foundHeader = $true }
        }
    } finally { $reader.Dispose() }
    if (-not $foundHeader -or -not $foundDate) { throw 'Die Antwort enthält kein erwartetes Ladesäulenregister. Bestehender Import bleibt erhalten.' }
    Move-Item -LiteralPath $downloadPath -Destination $registerPath -Force
    Write-Output 'Offizielles Ladesäulenregister lokal gespeichert. Die Datei bleibt von Git ausgeschlossen.'
} finally {
    if (Test-Path -LiteralPath $downloadPath) { Remove-Item -LiteralPath $downloadPath }
}
