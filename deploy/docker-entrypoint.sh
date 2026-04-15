#!/bin/sh
# FindIt Docker Entrypoint
# Generates config.json from environment variables at container start

CONFIG_FILE="/usr/share/nginx/html/config.json"

cat > "$CONFIG_FILE" <<EOF
{
  "libraryName": "${FINDIT_LIBRARY_NAME:-My Library}",
  "papiBaseUrl": "${FINDIT_PAPI_BASE_URL:-}",
  "papiAccessId": "${FINDIT_PAPI_ACCESS_ID:-}",
  "papiAccessKey": "${FINDIT_PAPI_ACCESS_KEY:-}",
  "papiLangId": "${FINDIT_PAPI_LANG_ID:-1033}",
  "papiAppId": "${FINDIT_PAPI_APP_ID:-100}",
  "papiOrgId": "${FINDIT_PAPI_ORG_ID:-1}",
  "vegaBaseUrl": "${FINDIT_VEGA_BASE_URL:-}",
  "vegaDeepLinkPattern": "${FINDIT_VEGA_DEEP_LINK:-}",
  "syndeticsBaseUrl": "${FINDIT_SYNDETICS_URL:-https://syndetics.com/index.aspx}",
  "rangesJsonUrl": "${FINDIT_RANGES_URL:-/data/ranges.json}",
  "defaultMap": "${FINDIT_DEFAULT_MAP:-/maps/floor1.jpg}",
  "brandColor": "${FINDIT_BRAND_COLOR:-#00697f}",
  "logoUrl": "${FINDIT_LOGO_URL:-}",
  "auth": {
    "provider": "${FINDIT_AUTH_PROVIDER:-google}",
    "oidcIssuer": "${FINDIT_OIDC_ISSUER:-https://accounts.google.com}",
    "clientId": "${FINDIT_OAUTH_CLIENT_ID:-}",
    "clientSecret": "${FINDIT_OAUTH_CLIENT_SECRET:-}",
    "redirectUri": "${FINDIT_OAUTH_REDIRECT_URI:-}",
    "allowedDomain": "${FINDIT_ALLOWED_DOMAIN:-}"
  },
  "floors": [
    {
      "id": "${FINDIT_FLOOR1_ID:-1f}",
      "label": "${FINDIT_FLOOR1_LABEL:-1st Floor}",
      "map": "${FINDIT_FLOOR1_MAP:-/maps/floor1.jpg}"
    },
    {
      "id": "${FINDIT_FLOOR2_ID:-2f}",
      "label": "${FINDIT_FLOOR2_LABEL:-2nd Floor}",
      "map": "${FINDIT_FLOOR2_MAP:-/maps/floor2.jpg}"
    }
  ]
}
EOF

echo "[FindIt] Config generated at $CONFIG_FILE"
echo "[FindIt] Library: ${FINDIT_LIBRARY_NAME:-My Library}"
echo "[FindIt] PAPI: ${FINDIT_PAPI_BASE_URL:-not configured}"
echo "[FindIt] Starting nginx..."

exec "$@"
