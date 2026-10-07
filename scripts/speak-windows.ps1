# Synthesizes a text file to a WAV file with the Windows speech engine (SAPI, offline).
param([string]$TextFile, [string]$OutFile, [int]$Rate = 0, [string]$Voice = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($Voice) { $synth.SelectVoice($Voice) }
$synth.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
$synth.SetOutputToWaveFile($OutFile)
$synth.Speak([IO.File]::ReadAllText($TextFile, [Text.Encoding]::UTF8))
$synth.Dispose()
