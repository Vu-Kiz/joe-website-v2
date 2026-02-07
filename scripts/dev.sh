set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.dev.yml"

DC="docker compose -f ${COMPOSE_FILE}"
BACKEND="backend"
FRONTEND="frontend"
DB="db"

usage() {
  cat <<USAGE
JOE Website v2 — Dev CLI

Usage:
  scripts/dev.sh up
  scripts/dev.sh down
  scripts/dev.sh restart
  scripts/dev.sh ps
  scripts/dev.sh logs [service]

  scripts/dev.sh shell
  scripts/dev.sh db-shell
  scripts/dev.sh pma

  scripts/dev.sh artisan <command>
  scripts/dev.sh migrate
  scripts/dev.sh migrate-fresh

  scripts/dev.sh composer <command>
  scripts/dev.sh npm <command>

Examples:
  scripts/dev.sh up
  scripts/dev.sh artisan route:list
  scripts/dev.sh migrate
  scripts/dev.sh npm run build
  scripts/dev.sh logs frontend
USAGE
}

cmd="${1:-}"

if [[ -z "$cmd" ]]; then
  usage
  exit 1
fi

case "$cmd" in
  up)
    ${DC} up -d --build
    ;;

  down)
    ${DC} down
    ;;

  restart)
    ${DC} down
    ${DC} up -d --build
    ;;

  ps)
    ${DC} ps
    ;;

  logs)
    service="${2:-${BACKEND}}"
    ${DC} logs -f "${service}"
    ;;

  shell)
    ${DC} exec -it "${BACKEND}" bash
    ;;

  db-shell)
    ${DC} exec -it "${DB}" mariadb -uPsycho -pAislynn1 joe_v2_dev
    ;;

  pma)
    echo "phpMyAdmin (dev): http://66.23.202.2:9013"
    ;;

  artisan)
    shift
    ${DC} exec -it "${BACKEND}" php artisan "$@"
    ;;

  migrate)
    ${DC} exec -it "${BACKEND}" php artisan migrate
    ;;

  migrate-fresh)
    ${DC} exec -it "${BACKEND}" php artisan migrate:fresh --seed
    ;;

  composer)
    shift
    ${DC} exec -it "${BACKEND}" composer "$@"
    ;;

  npm)
    shift
    ${DC} exec -it "${FRONTEND}" npm "$@"
    ;;

  *)
    echo "Unknown command: $cmd"
    usage
    exit 1
    ;;
esac
