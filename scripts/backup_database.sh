#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${BAKEOPS_ENV_FILE:-${ROOT_DIR}/.env.prod}"
OUTPUT_DIR="${1:-/var/backups/bakeops}"
CONTAINER="${POSTGRES_CONTAINER:-BO-prod-postgres}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

DATABASE="${POSTGRES_DB}"
USER_NAME="${POSTGRES_USER}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${OUTPUT_DIR}/bakeops-${TIMESTAMP}.sql.gz"

mkdir -p "${OUTPUT_DIR}"

echo "Backing up ${DATABASE} from ${CONTAINER} to ${OUTPUT_FILE}"
docker exec "${CONTAINER}" pg_dump --clean --if-exists --no-owner --no-privileges -U "${USER_NAME}" -d "${DATABASE}" \
  | gzip -9 > "${OUTPUT_FILE}"

sha256sum "${OUTPUT_FILE}" | tee "${OUTPUT_FILE}.sha256"
echo "Backup complete. Keep production backups encrypted and outside GitHub."
