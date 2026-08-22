#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${BAKEOPS_SOURCE_ENV_FILE:-${ROOT_DIR}/.env}"
CONTAINER="${POSTGRES_CONTAINER:-BO-postgres}"
BRANCH="${BAKEOPS_BRANCH:-main}"
TRANSFER_DIR="${ROOT_DIR}/backups/transfer"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DATABASE_DUMP="${TRANSFER_DIR}/bakeops-${TIMESTAMP}.sql.gz.enc"
TEMP_DUMP="$(mktemp)"

cleanup() {
  rm -f "${TEMP_DUMP}"
}
trap cleanup EXIT

cd "${ROOT_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing source environment file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

docker inspect "${CONTAINER}" >/dev/null
mkdir -p "${TRANSFER_DIR}"

echo "Exporting ${POSTGRES_DB} from ${CONTAINER}..."
docker exec "${CONTAINER}" pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  | gzip -9 > "${TEMP_DUMP}"

read -r -s -p "Encryption password for the database archive: " TRANSFER_PASSWORD
echo
read -r -s -p "Repeat encryption password: " TRANSFER_PASSWORD_CONFIRM
echo

if [[ -z "${TRANSFER_PASSWORD}" || "${TRANSFER_PASSWORD}" != "${TRANSFER_PASSWORD_CONFIRM}" ]]; then
  echo "Encryption passwords are empty or do not match." >&2
  exit 1
fi

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass pass:"${TRANSFER_PASSWORD}" \
  -in "${TEMP_DUMP}" \
  -out "${DATABASE_DUMP}"

shasum -a 256 "${DATABASE_DUMP}" > "${DATABASE_DUMP}.sha256"

# Runtime/test data files are intentionally included; environment files and raw backups are not.
# Stage tracked changes first, then add only untracked files accepted by .gitignore.
git add -u -- .
while IFS= read -r -d '' FILE_PATH; do
  git add -- "${FILE_PATH}"
done < <(git ls-files --others --exclude-standard -z)
git add -f "${DATABASE_DUMP}" "${DATABASE_DUMP}.sha256"

echo
git status --short
echo
read -r -p "Commit and push local data to origin/${BRANCH}? Type PUSH: " CONFIRM
if [[ "${CONFIRM}" != "PUSH" ]]; then
  echo "Cancelled. Staged files were left in the index for review."
  exit 0
fi

git commit -m "Sync local data ${TIMESTAMP}"
git push origin "${BRANCH}"

echo "Code and test data pushed. The database archive is encrypted; keep its password separately."
