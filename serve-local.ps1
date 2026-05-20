param(
    [int]$Port = 4173,
    [switch]$OpenBrowser,
    [string]$BindAddress = '0.0.0.0'
)

$pythonCommand = $null

if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCommand = @('py', '-m', 'http.server', $Port, '--bind', $BindAddress)
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCommand = @('python', '-m', 'http.server', $Port, '--bind', $BindAddress)
} else {
    throw 'Python was not found in PATH. Install Python or run the site with another static server.'
}

$localUrl = "http://127.0.0.1:$Port/"
Write-Host "Serving qr-navigation at $localUrl"
if ($BindAddress -eq '0.0.0.0') {
    $lanAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -ExpandProperty IPAddress -Unique

    foreach ($lanAddress in $lanAddresses) {
        Write-Host "LAN URL: http://$lanAddress`:$Port/"
    }
}
Write-Host 'Press Ctrl+C to stop the local server.'

if ($OpenBrowser) {
    Start-Process $localUrl | Out-Null
}

& $pythonCommand[0] $pythonCommand[1] $pythonCommand[2] $pythonCommand[3] $pythonCommand[4] $pythonCommand[5]