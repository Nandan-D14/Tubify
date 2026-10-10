Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$s = $mgr.GetSessions() | Where-Object { $_.SourceAppUserModelId -like 'tubify*' } | Select-Object -First 1
if (-not $s) { "no tubify session"; exit }
$c = $s.GetPlaybackInfo().Controls
"controls: play=$($c.IsPlayEnabled) next=$($c.IsNextEnabled) prev=$($c.IsPreviousEnabled) seek=$($c.IsPlaybackPositionEnabled)"
"before: " + $s.GetTimelineProperties().Position + " / " + $s.GetTimelineProperties().EndTime
$ok = Await ($s.TryChangePlaybackPositionAsync([TimeSpan]::FromSeconds(42).Ticks)) ([bool])
"seek request accepted: $ok"
Start-Sleep -Milliseconds 2000
"after: " + $s.GetTimelineProperties().Position + " | status " + $s.GetPlaybackInfo().PlaybackStatus
