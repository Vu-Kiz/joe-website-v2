#!/usr/bin/env bash
set -euo pipefail

##
# JOE Website v2 — Production CLI
#
# This script assumes:
#   - You are in a git clone of the repo (e.g. /home/joe-website-v2-prod)
#   - .env exists in the repo root (prod secrets, DB passwords, APP_URL, etc.)
#   - docker-compose.prod.yml defines services: db, backend, frontend
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

usage() {
  cat <<EOF
JOE Website v2 — PROD CLI

Usage:
  ./scripts/prod.sh up            Start prod stack (db + backend + frontend)
  ./scripts/prod.sh down          Stop prod stack
  ./scripts/prod.sh restart       Restart prod stack
  ./scripts/prod.sh logs [svc]    Tail logs (default: backend)
  ./scripts/prod.sh ps            Show container status
  ./scripts/prod.sh queue-restart Restart Laravel queue workers

  ./scripts/prod.sh migrate       Run DB migrations (php artisan migrate --force)
  ./scripts/prod.sh shell         Shell into backend container (bash)

  ./scripts/prod.sh pull          git fetch + git pull (branch: ${GIT_BRANCH})
  ./scripts/prod.sh deploy        Pull + build images + restart stack

Examples:
  ./scripts/prod.sh up
  ./scripts/prod.sh logs
  ./scripts/prod.sh migrate
  ./scripts/prod.sh pull
  ./scripts/prod.sh deploy

EOF
}

cmd="${1:-}"

if [[ -z "${cmd}" ]]; then
  usage
  exit 1
fi

case "${cmd}" in
  up)
    echo "▶ Starting prod stack (db + backend + frontend)..."
    ${DC} up -d
    ;;

  down)
    echo "▶ Stopping prod stack..."
    ${DC} down
    ;;

  restart)
    echo "▶ Restarting prod stack..."
    ${DC} down
    ${DC} up -d
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

  queue-restart)
    echo "▶ Restarting Laravel queue workers..."
    ${DC} exec backend php artisan queue:restart
    ;;

  migrate)
    echo "▶ Running Laravel migrations in production (--force)..."
    ${DC} exec backend php artisan migrate --force
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
      echo "▶ Step 1/3: git fetch + pull..."
      git fetch origin
      git pull origin "${GIT_BRANCH}"

      echo "▶ Step 2/3: docker compose build (backend + frontend)..."
      ${DC} build

      echo "▶ Step 3/3: restart stack..."
      ${DC} down --remove-orphans
      ${DC} up -d
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
