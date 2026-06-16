$prev=""
while ($true) {
  cd "C:\Users\user\Documents\baseball_app\mobile"
  $line = npx eas build:view 89325cdc-2517-43ef-bce3-cdf16dddc2e8 2>&1 | Out-String
  $status = "unknown"
  if ($line -match 'Status\s+(.*)') { $status = $matches[1].Trim() }
  if ($status -ne $prev) { Write-Output "iOS build: $status"; $prev = $status }
  if ($status -eq "finished" -or $status -eq "errored" -or $status -eq "cancelled") { break }
  Start-Sleep -Seconds 45
}
