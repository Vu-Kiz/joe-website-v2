#!/usr/bin/env bash
set -euo pipefail

##
# JOE Website v2 — Production CLI
#
# This script assumes:
#   - You are in a git clone of the repo (e.g. /home/joe-website-v2-prod)
#   - .env exists in the repo root (prod secrets, DB passwords, APP_URL, etc.)
#   - docker-compose.prod.yml defines services: db, backend, worker, frontend
#   - production is deployed from committed code only; no local editing on prod
##

# Root of the repo (one level up from scripts/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Prod env + compose
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.yml"

# Which branch prod tracks in GitHub (change to "main" later if you want)
GIT_BRANCH="${GIT_BRANCH:-dev}"

# Convenience alias for docker compose
DC="docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE}"

# The website's own services — deliberately excludes glitchtip/glitchtip-worker/
# glitchtip-db/glitchtip-redis. GlitchTip doesn't need to restart just because the
# website rebuilt, and recreating it gives it a new internal Docker IP that Nginx
# Proxy Manager's proxy_pass doesn't reliably re-resolve, which was causing a 502
# on glitchtip.swc-joe.com after every deploy (fixed by scoping recreate to just
# these services instead of the whole compose file).
WEBSITE_SERVICES="db meilisearch backend worker-xml worker-swc worker-search worker-payment worker-default scheduler frontend discord-bot phpmyadmin"

run_migrations_with_retry() {
  local attempts="${1:-20}"
  local delay_seconds="${2:-3}"
  local try=1

  while (( try <= attempts )); do
    if ${DC} exec backend php artisan migrate --force; then
      return 0
    fi

    if (( try == attempts )); then
      return 1
    fi

    echo "⏳ Database is not ready yet. Retrying migrations in ${delay_seconds}s (${try}/${attempts})..."
    sleep "${delay_seconds}"
    try=$((try + 1))
  done

  return 1
}

usage() {
  cat <<EOF
JOE Website v2 — PROD CLI

Usage:
  ./scripts/prod.sh up            Start prod stack (db + backend + frontend)
  ./scripts/prod.sh down          Stop prod stack
  ./scripts/prod.sh restart       Restart prod stack
  ./scripts/prod.sh refresh       Rebuild + recreate backend/worker/frontend
  ./scripts/prod.sh logs [svc]    Tail logs (default: backend)
  ./scripts/prod.sh ps            Show container status
  ./scripts/prod.sh pma           Show phpMyAdmin prod service info
  ./scripts/prod.sh queue-restart         Restart all Laravel queue workers
  ./scripts/prod.sh worker-xml-restart    Restart XML import worker
  ./scripts/prod.sh worker-swc-restart    Restart SWC sync worker
  ./scripts/prod.sh worker-search-restart Restart search index worker
  ./scripts/prod.sh worker-payment-restart Restart payment reconcile worker
  ./scripts/prod.sh worker-default-restart Restart default worker
  ./scripts/prod.sh scheduler-restart     Restart the Laravel scheduler container
  ./scripts/prod.sh recover-stuck-uploads Re-dispatch any uploads stuck in processing
  ./scripts/prod.sh warm-cache       Pre-warm DroidBrain options cache (all tabs)
  ./scripts/prod.sh reindex-dirty    Reindex any DroidBrain tabs still marked dirty
  ./scripts/prod.sh scout-import     Import all DroidBrain models into Meilisearch + backfill search flags

  ./scripts/prod.sh migrate       Run DB migrations (php artisan migrate --force)
  ./scripts/prod.sh optimize-clear Clear Laravel runtime caches
  ./scripts/prod.sh shell         Shell into backend container (bash)

  ./scripts/prod.sh glitchtip-setup   First-time GlitchTip setup: run Django migrations + create superuser
  ./scripts/prod.sh glitchtip-logs    Tail GlitchTip web container logs

  ./scripts/prod.sh pull          git fetch + git pull (branch: ${GIT_BRANCH})
  ./scripts/prod.sh deploy        Pull + build images + restart stack + migrate + queue restart

Examples:
  ./scripts/prod.sh up
  ./scripts/prod.sh logs
  ./scripts/prod.sh migrate
  ./scripts/prod.sh refresh
  ./scripts/prod.sh pull
  ./scripts/prod.sh deploy
  ./scripts/prod.sh pma

EOF
}

cmd="${1:-}"

if [[ -z "${cmd}" ]]; then
  usage
  exit 1
fi

case "${cmd}" in
  up)
    echo "▶ Starting prod stack (db + backend + workers + scheduler + frontend)..."
    ${DC} up -d --build --remove-orphans ${WEBSITE_SERVICES}
    ;;

  down)
    echo "▶ Stopping prod stack..."
    ${DC} down
    ;;

  restart)
    echo "▶ Restarting prod stack (website services only — not GlitchTip)..."
    ${DC} up -d --build --force-recreate --remove-orphans ${WEBSITE_SERVICES}
    ;;

  refresh)
    echo "▶ Rebuilding and recreating website services (not GlitchTip)..."
    ${DC} up -d --build --force-recreate --remove-orphans ${WEBSITE_SERVICES}
    ;;

  logs)
    service="${2:-backend}"
    echo "▶ Tailing logs for service: ${service}"
    ${DC} logs -f "${service}"
    ;;

  ps)
    echo "▶ Showing container status..."
    ${DC} ps
    ;;

  pma)
    echo "▶ phpMyAdmin prod service: joe_phpmyadmin_v2_prod"
    echo "  Expose it through Nginx Proxy Manager or inspect with:"
    echo "  ${DC} ps"
    ;;

  queue-restart)
    echo "▶ Restarting all Laravel queue workers..."
    ${DC} exec backend php artisan queue:restart
    ;;

  worker-xml-restart)
    echo "▶ Restarting XML import worker..."
    ${DC} restart worker-xml
    ;;

  worker-swc-restart)
    echo "▶ Restarting SWC sync worker..."
    ${DC} restart worker-swc
    ;;

  worker-search-restart)
    echo "▶ Restarting search index worker..."
    ${DC} restart worker-search
    ;;

  worker-payment-restart)
    echo "▶ Restarting payment reconcile worker..."
    ${DC} restart worker-payment
    ;;

  worker-default-restart)
    echo "▶ Restarting default worker..."
    ${DC} restart worker-default
    ;;

  scheduler-restart)
    echo "▶ Restarting Laravel scheduler container..."
    ${DC} restart scheduler
    ;;

  glitchtip-setup)
    echo "▶ Running GlitchTip first-time setup..."
    echo "  Step 1/2: running Django migrations..."
    ${DC} run --rm glitchtip ./manage.py migrate
    echo "  Step 2/2: creating superuser (follow the prompts)..."
    ${DC} run --rm glitchtip ./manage.py createsuperuser
    echo "✔ GlitchTip setup complete. Visit https://glitchtip.swc-joe.com to finish configuration."
    ;;

  glitchtip-logs)
    echo "▶ Tailing GlitchTip logs..."
    ${DC} logs -f glitchtip
    ;;

  recover-stuck-uploads)
    echo "▶ Re-dispatching stuck DroidBrain uploads..."
    ${DC} exec backend php artisan droidbrain:recover-stuck-uploads
    ;;

  warm-cache)
    echo "▶ Warming DroidBrain options cache..."
    ${DC} exec backend php artisan droidbrain:warm-cache
    ;;

  reindex-dirty)
    echo "▶ Reindexing dirty DroidBrain tabs..."
    ${DC} exec backend php artisan droidbrain:reindex-dirty
    ;;

  scout-import)
    echo "▶ Importing all DroidBrain models into Meilisearch..."
    ${DC} exec backend php artisan scout:import "App\Models\DroidBrainShip"
    ${DC} exec backend php artisan scout:import "App\Models\DroidBrainVehicle"
    ${DC} exec backend php artisan scout:import "App\Models\DroidBrainCity"
    ${DC} exec backend php artisan scout:import "App\Models\DroidBrainNpc"
    ${DC} exec backend php artisan scout:import "App\Models\DroidBrainPlanet"
    ${DC} exec backend php artisan scout:import "App\Models\DroidBrainStation"
    echo "▶ Importing Galactic Archive models into Meilisearch..."
    ${DC} exec backend php artisan scout:import "App\Models\Swc\SwcPlanet"
    ${DC} exec backend php artisan scout:import "App\Models\Swc\SwcSystem"
    ${DC} exec backend php artisan scout:import "App\Models\Swc\SwcSector"
    echo "▶ Backfilling search record flags from Meilisearch..."
    ${DC} exec backend php artisan droidbrain:backfill-search-record-flags-from-meili
    echo "✔ Scout import complete."
    ;;

  migrate)
    echo "▶ Running Laravel migrations in production (--force)..."
    run_migrations_with_retry
    ;;

  optimize-clear)
    echo "▶ Clearing Laravel runtime caches..."
    ${DC} exec backend php artisan optimize:clear
    ;;

  shell)
    echo "▶ Opening shell in backend container..."
    ${DC} exec backend bash
    ;;

  pull)
    echo "▶ Pulling latest code from GitHub (branch: ${GIT_BRANCH})..."
    (
      cd "${ROOT_DIR}"
      git fetch origin
      git pull origin "${GIT_BRANCH}"
    )
    echo "✔ Git pull complete."
    ;;

  deploy)
    echo "▶ Deploying latest version from GitHub (branch: ${GIT_BRANCH})..."
    (
      cd "${ROOT_DIR}"
      echo "▶ Step 1/7: git fetch + pull..."
      git fetch origin
      git pull origin "${GIT_BRANCH}"

      echo "▶ Step 2/7: build images and restart website services (not GlitchTip)..."
      ${DC} up -d --build --force-recreate --remove-orphans ${WEBSITE_SERVICES}

      echo "▶ Step 3/7: run database migrations..."
      run_migrations_with_retry

      echo "▶ Step 4/7: sync Scout index settings..."
      ${DC} exec backend php artisan scout:sync-index-settings

      echo "▶ Step 5/7: restart queue workers and scheduler..."
      ${DC} exec backend php artisan optimize:clear
      ${DC} exec backend php artisan queue:restart
      ${DC} restart worker-xml worker-swc worker-search worker-payment worker-default scheduler

      echo "▶ Step 6/7: reindex any dirty DroidBrain tabs..."
      ${DC} exec backend php artisan droidbrain:reindex-dirty

      echo "▶ Step 7/7: warm DroidBrain options cache..."
      ${DC} exec backend php artisan droidbrain:warm-cache
    )
    echo "✔ Deploy complete."
    ;;

  *)
    echo "Unknown command: ${cmd}"
    echo
    usage
    exit 1
    ;;
esac
