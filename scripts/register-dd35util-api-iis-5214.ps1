Import-Module WebAdministration

$appPoolName = 'DD35UtilApi'
$siteName = 'DD35Util API'
$publishPath = 'D:\repos\DD35Utils\publish\DD35Util.Api'
$port = 5214

if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
    New-WebAppPool -Name $appPoolName | Out-Null
}

Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ''
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name processModel.identityType -Value 'ApplicationPoolIdentity'

if (-not (Test-Path "IIS:\Sites\$siteName")) {
    New-Website -Name $siteName -Port $port -PhysicalPath $publishPath -ApplicationPool $appPoolName | Out-Null
}
else {
    Set-ItemProperty "IIS:\Sites\$siteName" -Name physicalPath -Value $publishPath
    Set-ItemProperty "IIS:\Sites\$siteName" -Name applicationPool -Value $appPoolName

    $binding = Get-WebBinding -Name $siteName -Protocol http |
        Where-Object { $_.bindingInformation -eq "*:${port}:" }

    if (-not $binding) {
        New-WebBinding -Name $siteName -Protocol http -Port $port | Out-Null
    }
}

Start-Website -Name $siteName
Get-Website -Name $siteName
