# Plays an audio file and obeys a control file: "play", "pause" or "stop".
param([string]$Audio, [string]$Control)
Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]$Audio)
for ($i = 0; $i -lt 50 -and -not $player.NaturalDuration.HasTimeSpan; $i++) { Start-Sleep -Milliseconds 100 }
$player.Play()
$state = 'play'
while ($true) {
  Start-Sleep -Milliseconds 150
  $wanted = if (Test-Path $Control) { (Get-Content $Control -Raw).Trim() } else { 'play' }
  if ($wanted -eq 'stop') { break }
  if ($wanted -ne $state) {
    if ($wanted -eq 'pause') { $player.Pause() } else { $player.Play() }
    $state = $wanted
  }
  if ($state -eq 'play' -and $player.NaturalDuration.HasTimeSpan -and $player.Position -ge $player.NaturalDuration.TimeSpan) { break }
}
$player.Stop()
$player.Close()
