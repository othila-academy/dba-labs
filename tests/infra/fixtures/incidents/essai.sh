# shellcheck shell=bash
# Incident de test : il raconte, puis interroge pg avec les fonctions de scripts/db.
info "14:02 — essai"
run_psql postgres -tAc 'select 42'
