param(
    [int]$Port = 4173,
    [switch]$OpenBrowser
)

$pythonCommand = $null

if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCommand = @('py', '-m', 'http.server', $Port, '--bind', '127.0.0.1')
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCommand = @('python', '-m', 'http.server', $Port, '--bind', '127.0.0.1')
} else {
    throw 'Python was not found in PATH. Install Python or run the site with another static server.'
}

$localUrl = "http://127.0.0.1:$Port/"
Write-Host "Serving qr-navigation at $localUrl"
Write-Host 'Press Ctrl+C to stop the local server.'

if ($OpenBrowser) {
    Start-Process $localUrl | Out-Null
}

& $pythonCommand[0] $pythonCommand[1] $pythonCommand[2] $pythonCommand[3] $pythonCommand[4] $pythonCommand[5]