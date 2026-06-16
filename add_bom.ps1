$path = "c:\Users\user\Documents\baseball_app\ticket_prices.csv"
$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "BOM already exists"
} else {
    $bom = [byte[]](0xEF,0xBB,0xBF)
    [System.IO.File]::WriteAllBytes($path, $bom + $bytes)
    Write-Host "BOM added"
}
