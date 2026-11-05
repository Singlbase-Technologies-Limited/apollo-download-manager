# Upgrades the 0.1.x Windows install, named "Velocity Download Manager V2", with this installer on a
# clean runner, and checks one install and one Apps & features entry remain, with the data and the
# browser keys kept (#347, docs/PACKAGING.md). Run from the Windows installer workflow:
#
#   pwsh scripts/package-upgrade-test.ps1 <old setup.exe> <new setup.exe>
#
# It writes a marker into V2's data folder and a browser key, as a user's install has, before the
# upgrade. Each step prints PASS or stops the script with FAIL.
param([Parameter(Mandatory)] [string] $Old, [Parameter(Mandatory)] [string] $New)
$ErrorActionPreference = 'Stop'

$uninstall = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$oldName = 'Velocity Download Manager V2'
$newName = 'Apollo Download Manager'
$data = Join-Path $env:APPDATA 'com.velocity.downloadmanager.v2'
$chrome = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.velocity.download_manager_v2'
$v1Key = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.velocity.download_manager'

function Fail([string] $message) { Write-Error "FAIL: $message"; exit 1 }
function Install([string] $setup) {
  $p = Start-Process -FilePath $setup -ArgumentList '/S' -Wait -PassThru
  if ($p.ExitCode -ne 0) { Fail "$setup exited with $($p.ExitCode)" }
}
function Entries { @(Get-ChildItem $uninstall | Where-Object { $_.PSChildName -in @($oldName, $newName) }) }
function Folder([string] $name) { (Get-ItemProperty "$uninstall\$name").InstallLocation.Trim('"') }

Write-Output "== Install the old version: $Old"
Install $Old
if (-not (Test-Path "$uninstall\$oldName")) { Fail "no '$oldName' entry" }
$oldDir = Folder $oldName
New-Item -ItemType Directory -Force $data | Out-Null
Set-Content -Path (Join-Path $data 'upgrade-marker') -Value kept
New-Item -Force $chrome | Out-Null
Set-ItemProperty $chrome -Name '(default)' -Value (Join-Path $data 'chrome-manifest.json')
New-Item -Force $v1Key | Out-Null
Set-ItemProperty $v1Key -Name '(default)' -Value 'C:\v1\manifest.json'
Write-Output "PASS: '$oldName' installed in $oldDir, with data and a browser key"

Write-Output "== Install the new version over it: $New"
Install $New
$entries = Entries
if ($entries.Count -ne 1 -or $entries[0].PSChildName -ne $newName) { Fail "Apps & features has: $($entries.PSChildName -join ', ')" }
$newDir = Folder $newName
if (-not (Test-Path (Join-Path $newDir 'velocity-desktop-v2.exe'))) { Fail "no app in $newDir" }
if (Test-Path $oldDir) { Fail "the old folder $oldDir is still there: $((Get-ChildItem $oldDir).Name -join ', ')" }
Write-Output "PASS: one entry, '$newName', in $newDir; the old folder is gone"

$startMenu = [Environment]::GetFolderPath('Programs')
if (Test-Path (Join-Path $startMenu "$oldName.lnk")) { Fail 'the old Start menu shortcut is still there' }
if (Test-Path 'HKCU:\Software\Velocity Project\Velocity Download Manager V2') { Fail "the old installer key is still there" }
Write-Output 'PASS: the old shortcut and installer key are gone'

if ((Get-Content (Join-Path $data 'upgrade-marker')) -ne 'kept') { Fail 'the data folder changed' }
if (-not (Test-Path $chrome)) { Fail "V2's browser key is gone" }
if ((Get-ItemProperty $v1Key).'(default)' -ne 'C:\v1\manifest.json') { Fail "V1's browser key changed" }
Write-Output "PASS: the data and V2's browser key stayed, and V1's key is untouched"
