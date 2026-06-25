Import-Module WebAdministration

$appPoolName = 'DD35UtilApi'
$siteName = 'Default Web Site'
$appName = 'dd35util-api'
$publishPath = 'D:\repos\DD35Utils\publish\DD35Util.Api'

if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
    New-WebAppPool -Name $appPoolName | Out-Null
}

Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ''
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name processModel.identityType -Value 'ApplicationPoolIdentity'

$appPath = "IIS:\Sites\$siteName\$appName"
if (-not (Test-Path $appPath)) {
    New-WebApplication -Site $siteName -Name $appName -PhysicalPath $publishPath -ApplicationPool $appPoolName | Out-Null
}
else {
    Set-ItemProperty $appPath -Name physicalPath -Value $publishPath
    Set-ItemProperty $appPath -Name applicationPool -Value $appPoolName
}

Get-WebApplication -Site $siteName | Where-Object { $_.path -eq "/$appName" }
