#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.dev.yml"

DC="docker compose -f ${COMPOSE_FILE}"
BACKEND="backend"
FRONTEND="frontend"
DB="db"
GIT_BRANCH="dev"

usage() {
  cat <<USAGE
JOE Website v2 — Dev CLI

Usage:
  # Docker / services
  scripts/dev.sh up
  scripts/dev.sh down
  scripts/dev.sh restart
  scripts/dev.sh ps
  scripts/dev.sh logs [service]

  scripts/dev.sh shell
  scripts/dev.sh db-shell
  scripts/dev.sh pma

  # Laravel / backend
  scripts/dev.sh artisan <command>
  scripts/dev.sh migrate
  scripts/dev.sh migrate-fresh
  scripts/dev.sh composer <command>

  # Frontend / npm
  scripts/dev.sh npm <command>

  # Git helpers
  scripts/dev.sh git-status
  scripts/dev.sh git-commit ["message..."]

Examples:
  scripts/dev.sh up
  scripts/dev.sh artisan route:list
  scripts/dev.sh migrate
  scripts/dev.sh npm run build
  scripts/dev.sh logs frontend
  scripts/dev.sh git-status
  scripts/dev.sh git-commit "feat: add jobs API"
USAGE
}

cmd="${1:-}"

if [[ -z "$cmd" ]]; then
  usage
  exit 1
fi

case "$cmd" in
  # =========================
  # Docker / services
  # =========================
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
    # If you change DB user/pass in .env, update this:
    ${DC} exec -it "${DB}" mariadb -uPsycho -pAislynn1 joe_v2_dev
    ;;

  pma)
    echo "phpMyAdmin (dev): http://66.23.202.2:9013"
    ;;

  # =========================
  # Laravel / backend
  # =========================
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

  # =========================
  # Frontend / npm
  # =========================
  npm)
    shift
    ${DC} exec -it "${FRONTEND}" npm "$@"
    ;;

  # =========================
  # Git helpers
  # =========================
  git-status)
    (
      cd "${ROOT_DIR}"
      echo "▶ Git status (branch: ${GIT_BRANCH}):"
      git status
    )
    ;;

  git-commit)
    shift
    (
      cd "${ROOT_DIR}"

      # If a message was passed as args, use it; otherwise prompt.
      if [[ $# -gt 0 ]]; then
        MESSAGE="$*"
      else
        read -rp "▶ Enter commit message: " MESSAGE
      fi

      if [[ -z "${MESSAGE}" ]]; then
        echo "✖ Commit message cannot be empty" >&2
        exit 1
      fi

      echo "▶ Current git status:"
      git status
      echo

      read -rp "▶ Proceed with 'git add .' and commit? [y/N] " CONFIRM
      if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
        echo "✖ Aborted."
        exit 1
      fi

      echo "▶ Adding changes..."
      git add .

      echo "▶ Committing with message: ${MESSAGE}"
      git commit -m "${MESSAGE}"

      echo "▶ Pushing to origin/${GIT_BRANCH}..."
      git push origin "${GIT_BRANCH}"

      echo "✔ Done."
    )
    ;;

  *)
    echo "Unknown command: $cmd"
    usage
    exit 1
    ;;
esac
