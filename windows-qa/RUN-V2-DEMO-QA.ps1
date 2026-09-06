param([int]$Port=5178,[switch]$Headless)
$ErrorActionPreference='Stop'
$here=Split-Path -Parent $MyInvocation.MyCommand.Path
$dist=Join-Path $here 'dist'
$tools=Join-Path $here 'tools'
$evidence=Join-Path $here 'evidence'
if(!(Test-Path $dist)){throw "Missing dist folder: $dist"}
if(!(Get-Command node -ErrorAction SilentlyContinue)){throw 'Node.js is required.'}
$pw='C:\TuinBooks-QA\node_modules\playwright'
if(!(Test-Path $pw)){throw 'Playwright was not found at C:\TuinBooks-QA\node_modules\playwright. Keep your existing TuinBooks-QA installation in place.'}
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
Get-ChildItem $evidence -File -ErrorAction SilentlyContinue | Remove-Item -Force
$serverLog=Join-Path $evidence 'SERVER.log'
$serverErr=Join-Path $evidence 'SERVER-ERR.log'
$server=Start-Process -FilePath node -ArgumentList @((Join-Path $tools 'serve-v2.cjs'),$dist,$Port) -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr -PassThru -WindowStyle Hidden
try{
  $ready=$false
  for($i=0;$i -lt 30;$i++){
    try{$r=Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/?demo=1" -TimeoutSec 1;if($r.StatusCode -eq 200){$ready=$true;break}}catch{}
    Start-Sleep -Milliseconds 150
  }
  if(!$ready){throw "Local v2 server did not start. See $serverLog"}
  $env:TUINBOOKS_PLAYWRIGHT_MODULE=$pw
  if($Headless){$env:TB_QA_HEADLESS='1'}else{Remove-Item Env:TB_QA_HEADLESS -ErrorAction SilentlyContinue}
  Write-Host '============================================================' -ForegroundColor Cyan
  Write-Host 'TUINBOOKS V2 - REAL EDGE DEMO QA' -ForegroundColor Cyan
  Write-Host '============================================================' -ForegroundColor Cyan
  Write-Host "Target: http://127.0.0.1:$Port/?demo=1"
  Write-Host 'No Supabase writes. Current staging is not modified.' -ForegroundColor Yellow
  & node (Join-Path $tools 'qa-v2-demo.cjs') "http://127.0.0.1:$Port" $evidence
  $exit=$LASTEXITCODE
  Write-Host "`nEvidence: $evidence"
  if($exit -ne 0){throw "V2 demo QA did not pass. Exit code $exit"}
  Write-Host '`nREAL BROWSER DEMO QA PASSED.' -ForegroundColor Green
} finally {
  if($server -and !$server.HasExited){Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue}
}
