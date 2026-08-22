#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${BAKEOPS_ENV_FILE:-${ROOT_DIR}/.env.prod}"
BACKUP_FILE="${1:-}"
CONTAINER="${POSTGRES_CONTAINER:-BO-prod-postgres}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi
if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 /path/to/bakeops-YYYYmmdd-HHMMSS.sql.gz" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

echo "This will replace data in ${POSTGRES_DB} on ${CONTAINER}."
read -r -p 'Type RESTORE to continue: ' CONFIRM
[[ "${CONFIRM}" == "RESTORE" ]] || { echo "Restore cancelled."; exit 0; }

echo "Restoring ${BACKUP_FILE}..."
gzip -dc "${BACKUP_FILE}" \
  | docker exec -i "${CONTAINER}" psql \
      -U "${POSTGRES_USER}" \
      -d "${POSTGRES_DB}" \
      --set ON_ERROR_STOP=1

echo "Restore complete. Run the deployment script to apply migrations if needed."
