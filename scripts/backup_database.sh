#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-${ROOT_DIR}/backups/local}"
CONTAINER="${POSTGRES_CONTAINER:-BO-postgres}"
DATABASE="${POSTGRES_DB:-bakeops}"
USER_NAME="${POSTGRES_USER:-bakeops}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${OUTPUT_DIR}/bakeops-${TIMESTAMP}.sql.gz"

mkdir -p "${OUTPUT_DIR}"

echo "Backing up ${DATABASE} from ${CONTAINER} to ${OUTPUT_FILE}"
docker exec "${CONTAINER}" pg_dump --clean --if-exists --no-owner --no-privileges -U "${USER_NAME}" "${DATABASE}" \
  | gzip -9 > "${OUTPUT_FILE}"

sha256sum "${OUTPUT_FILE}" | tee "${OUTPUT_FILE}.sha256"
echo "Backup complete. Keep production backups encrypted and outside GitHub."
