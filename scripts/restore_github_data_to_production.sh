#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${BAKEOPS_ENV_FILE:-${ROOT_DIR}/.env.prod}"
CONTAINER="${POSTGRES_CONTAINER:-BO-prod-postgres}"
BRANCH="${BAKEOPS_BRANCH:-main}"
TEMP_DUMP="$(mktemp)"

cleanup() {
  rm -f "${TEMP_DUMP}"
}
trap cleanup EXIT

cd "${ROOT_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing production environment file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

if [[ -n "$(git status --short)" ]]; then
  echo "Working tree is dirty; refusing to pull over local changes." >&2
  git status --short
  exit 1
fi

git fetch --prune origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

DATABASE_ARCHIVE="$(find "${ROOT_DIR}/backups/transfer" -maxdepth 1 -type f -name 'bakeops-*.sql.gz.enc' -print | sort | tail -n 1)"
if [[ -z "${DATABASE_ARCHIVE}" || ! -f "${DATABASE_ARCHIVE}" ]]; then
  echo "No encrypted database archive found in backups/transfer." >&2
  exit 1
fi

echo "Target: ${CONTAINER}/${POSTGRES_DB}"
echo "Archive: ${DATABASE_ARCHIVE}"
echo "A pre-restore backup will be created before replacing production data."
read -r -p "Type REPLACE-PRODUCTION-DATABASE to continue: " CONFIRM
if [[ "${CONFIRM}" != "REPLACE-PRODUCTION-DATABASE" ]]; then
  echo "Restore cancelled."
  exit 0
fi

BAKEOPS_ENV_FILE="${ENV_FILE}" \
  POSTGRES_CONTAINER="${CONTAINER}" \
  "${ROOT_DIR}/scripts/backup_database.sh"

read -r -s -p "Encryption password for ${DATABASE_ARCHIVE}: " TRANSFER_PASSWORD
echo

openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass pass:"${TRANSFER_PASSWORD}" \
  -in "${DATABASE_ARCHIVE}" \
  -out "${TEMP_DUMP}"

gzip -dc "${TEMP_DUMP}" \
  | docker exec -i "${CONTAINER}" psql \
      -U "${POSTGRES_USER}" \
      -d "${POSTGRES_DB}" \
      --set ON_ERROR_STOP=1

docker compose --env-file "${ENV_FILE}" \
  -f compose.prod.yaml exec -T backend \
  python manage.py migrate --noinput

echo "Production database replacement complete. Verify the application before announcing the update."
