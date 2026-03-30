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
  ./scripts/prod.sh queue-restart Restart Laravel queue workers

  ./scripts/prod.sh migrate       Run DB migrations (php artisan migrate --force)
  ./scripts/prod.sh optimize-clear Clear Laravel runtime caches
  ./scripts/prod.sh shell         Shell into backend container (bash)

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
    echo "▶ Starting prod stack (db + backend + worker + frontend)..."
    ${DC} up -d --build --remove-orphans
    ;;

  down)
    echo "▶ Stopping prod stack..."
    ${DC} down
    ;;

  restart)
    echo "▶ Restarting prod stack..."
    ${DC} up -d --build --force-recreate --remove-orphans
    ;;

  refresh)
    echo "▶ Rebuilding and recreating backend + worker + frontend..."
    ${DC} up -d --build --force-recreate --remove-orphans backend worker frontend
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
    echo "▶ Restarting Laravel queue workers..."
    ${DC} exec backend php artisan queue:restart
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
      echo "▶ Step 1/5: git fetch + pull..."
      git fetch origin
      git pull origin "${GIT_BRANCH}"

      echo "▶ Step 2/5: docker compose build (backend + frontend)..."
      ${DC} build

      echo "▶ Step 3/5: restart stack..."
      ${DC} up -d --force-recreate --remove-orphans

      echo "▶ Step 4/5: run database migrations..."
      run_migrations_with_retry

      echo "▶ Step 5/5: restart queue workers..."
      ${DC} exec backend php artisan optimize:clear
      ${DC} exec backend php artisan queue:restart
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
