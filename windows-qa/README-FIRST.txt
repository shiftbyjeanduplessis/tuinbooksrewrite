TUINBOOKS V2 — FIRST REAL BROWSER GATE

This package is SAFE DEMO QA only.
It does not execute any Supabase migration and does not write customer/staging data.

Run in PowerShell:

  cd $env:USERPROFILE\Downloads\TUINBOOKS-V2-M8-WINDOWS-QA
  powershell -ExecutionPolicy Bypass -File .\RUN-V2-DEMO-QA.ps1

The runner uses the Playwright installation already present at C:\TuinBooks-QA.
It opens Microsoft Edge, exercises the real v2 Schedule UI, and writes screenshots/results to .\evidence.

Do not apply Supabase migrations until this browser gate passes.
