# Publishes Prep Kitchen to GitHub Pages and tells open copies that an update is ready.
# Usage: .\publish.ps1 -Notes "What changed, shown in the update banner" -Message "Commit message"
param(
  [Parameter(Mandatory = $true)][string]$Notes,
  [string]$Message = $Notes
)
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location $PSScriptRoot

$version = Get-Date -Format 'yyyy.MM.dd.HHmm'
$utf8 = New-Object System.Text.UTF8Encoding $false

$html = [IO.File]::ReadAllText("$PSScriptRoot\index.html")
$html = [regex]::Replace($html, "const APP_VERSION = '[^']*';", "const APP_VERSION = '$version';")
[IO.File]::WriteAllText("$PSScriptRoot\index.html", $html, $utf8)

$json = [ordered]@{ version = $version; notes = $Notes } | ConvertTo-Json
[IO.File]::WriteAllText("$PSScriptRoot\version.json", $json, $utf8)

git add -A
git commit -q -m $Message
git push -q
Write-Output "Published version $version"

for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep 5
  $status = gh api repos/jackjbennett/prep-kitchen/pages/builds/latest --jq .status
  if ($status -eq 'built' -or $status -eq 'errored') { break }
}
Write-Output "GitHub Pages: $status"
