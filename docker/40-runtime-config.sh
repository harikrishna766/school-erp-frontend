#!/bin/sh
# Writes /config/app-config.json from environment variables so one image can be
# promoted through dev → staging → prod. Values are JSON-escaped.
set -eu

json_str() {
  # Escape backslash and double quote; reject control characters.
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\000-\037'
}

if [ -n "${TENANT_SLUG:-}" ]; then
  tenant="\"$(json_str "$TENANT_SLUG")\""
else
  tenant=null
fi

target=/usr/share/nginx/html/config/app-config.json
mkdir -p "$(dirname "$target")"
cat > "$target" <<JSON
{
  "apiBaseUrl": "$(json_str "${API_BASE_URL:-/api/v1}")",
  "wsUrl": "$(json_str "${WS_URL:-/}")",
  "defaultLanguage": "$(json_str "${DEFAULT_LANGUAGE:-en}")",
  "tenantSlug": $tenant
}
JSON
echo "runtime-config: wrote $target"
