$body = '{"context":{"client":{"clientName":"WEB","clientVersion":"2.20250101.00.00","hl":"en"}},"videoId":"JGwWNGJdvx8","playlistId":"RDJGwWNGJdvx8"}'
$r = Invoke-WebRequest -Uri "https://www.youtube.com/youtubei/v1/next?prettyPrint=false" -Method Post -ContentType "application/json" -Body $body -UseBasicParsing
$j = $r.Content | ConvertFrom-Json
$items = $j.contents.twoColumnWatchNextResults.playlist.playlist.contents
"count: " + $items.Count
$items | Select-Object -First 4 | ForEach-Object { $v = $_.playlistPanelVideoRenderer; "$($v.videoId) | $($v.title.simpleText) | $($v.shortBylineText.runs[0].text) | $($v.lengthText.simpleText)" }
"---lrclib"
$l = Invoke-WebRequest -Uri "https://lrclib.net/api/get?artist_name=Ed%20Sheeran&track_name=Shape%20of%20You&duration=234" -UseBasicParsing -Headers @{Origin="http://tauri.localhost"}
"CORS: " + $l.Headers["Access-Control-Allow-Origin"]
($l.Content | ConvertFrom-Json).syncedLyrics.Substring(0,120)
