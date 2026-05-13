#!/usr/bin/env pwsh
# ============================================================
# run_migrations.ps1
# Applies all Budget Tracker migrations to the Docker PostgreSQL.
# Run from the project root: .\run_migrations.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "`n🔍 Checking Docker container..." -ForegroundColor Cyan
$container = docker ps --format "{{.Names}}" | Where-Object { $_ -match "budget_tracker_db" }
if (-not $container) {
    Write-Host "⚠️  Container 'budget_tracker_db' not found. Starting via docker-compose..." -ForegroundColor Yellow
    Set-Location "backend"
    docker-compose up -d
    Set-Location ".."
    Start-Sleep -Seconds 8
}

Write-Host "✅ Container ready." -ForegroundColor Green

# ── Migration 001 (idempotent — safe to re-apply) ───────────────────
Write-Host "`n📄 Applying migration 001_initial_schema.sql..." -ForegroundColor Cyan
Get-Content "backend\migrations\001_initial_schema.sql" -Raw | docker exec -i budget_tracker_db psql -U budget_user -d budget_db
Write-Host "✅ Migration 001 complete." -ForegroundColor Green

# ── Migration 002 (idempotent — safe to re-apply) ───────────────────
Write-Host "`n📄 Applying migration 002_veridian_ledger_schema.sql..." -ForegroundColor Cyan
Get-Content "backend\migrations\002_veridian_ledger_schema.sql" -Raw | docker exec -i budget_tracker_db psql -U budget_user -d budget_db
Write-Host "✅ Migration 002 complete." -ForegroundColor Green

# ── Migration 003 (new — type fix + idempotent table creates) ───────
Write-Host "`n📄 Applying migration 003_missing_tables_and_type_fix.sql..." -ForegroundColor Cyan
Get-Content "backend\migrations\003_missing_tables_and_type_fix.sql" -Raw | docker exec -i budget_tracker_db psql -U budget_user -d budget_db
Write-Host "✅ Migration 003 complete." -ForegroundColor Green

# ── Verify tables exist ──────────────────────────────────────────────
Write-Host "`n🔎 Verifying tables in database..." -ForegroundColor Cyan
docker exec budget_tracker_db psql -U budget_user -d budget_db -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"

Write-Host "`n🎉 All migrations applied successfully!" -ForegroundColor Green
Write-Host "   Required tables: users, streaks, transactions, buckets, income_sources, expenses, garden_flowers" -ForegroundColor DarkGray
