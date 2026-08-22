#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY_URL="${BAKEOPS_REPOSITORY_URL:-https://github.com/WebShell-Hello/BakeOps.git}"
BRANCH="${BAKEOPS_BRANCH:-main}"
APP_DIR="${BAKEOPS_APP_DIR:-/opt/bakeops}"
COMPOSE_FILE="compose.prod.yaml"
ENV_FILE=".env.prod"

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  ${SUDO} mkdir -p "${APP_DIR}"
  ${SUDO} chown -R "${USER}:$(id -g)" "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPOSITORY_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" fetch --prune origin "${BRANCH}"
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
fi

cd "${APP_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${APP_DIR}/${ENV_FILE}. Copy ${ENV_FILE}.example and fill production secrets first." >&2
  exit 1
fi

${SUDO} docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config >/dev/null
${SUDO} docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build
${SUDO} docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans
${SUDO} docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T backend python manage.py migrate --noinput
${SUDO} docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo "Deployment complete. Verify HTTPS and application health manually."
