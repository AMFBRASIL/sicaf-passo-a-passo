param(
  [ValidateSet("chrome", "edge", "firefox", "all")]
  [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist"
$manifestChrome = Join-Path $root "chrome\manifest.json"
$manifestEdge = Join-Path $root "edge\manifest.json"
$manifestFirefox = Join-Path $root "firefox\manifest.json"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function New-CleanDir {
  param([string]$Path)
  if (Test-Path $Path) {
    Remove-Item -Path $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Path $Path | Out-Null
}

function Copy-BaseFiles {
  param([string]$Destination)

  $excludeNames = @("chrome", "edge", "firefox", "dist", "manifest.firefox.json", "manifest.chrome.json")
  Get-ChildItem -Path $root -Force | Where-Object {
    $excludeNames -notcontains $_.Name -and $_.Extension -ne ".ps1"
  } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $Destination -Recurse -Force
  }
}

function New-NormalizedZip {
  param(
    [string]$SourceDir,
    [string]$ZipPath
  )

  if (Test-Path $ZipPath) {
    Remove-Item -Path $ZipPath -Force
  }

  $zip = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $files = Get-ChildItem -Path $SourceDir -File -Recurse
    foreach ($file in $files) {
      $relativePath = $file.FullName.Substring($SourceDir.Length).TrimStart('\', '/')
      $entryName = $relativePath -replace '\\', '/'
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip,
        $file.FullName,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  } finally {
    $zip.Dispose()
  }
}

function New-BrowserPackage {
  param(
    [string]$Name,
    [string]$ManifestPath
  )

  $outDir = Join-Path $dist $Name
  New-CleanDir -Path $outDir
  Copy-BaseFiles -Destination $outDir
  Copy-Item -Path $ManifestPath -Destination (Join-Path $outDir "manifest.json") -Force

  $zipPath = Join-Path $dist "$Name.zip"
  New-NormalizedZip -SourceDir $outDir -ZipPath $zipPath
  Write-Host "Pacote gerado: $zipPath"
}

New-Item -ItemType Directory -Path $dist -Force | Out-Null

if ($Target -eq "chrome" -or $Target -eq "all") {
  New-BrowserPackage -Name "chrome" -ManifestPath $manifestChrome
}

if ($Target -eq "edge" -or $Target -eq "all") {
  New-BrowserPackage -Name "edge" -ManifestPath $manifestEdge
}

if ($Target -eq "firefox" -or $Target -eq "all") {
  New-BrowserPackage -Name "firefox" -ManifestPath $manifestFirefox
}

Write-Host "Concluido."
