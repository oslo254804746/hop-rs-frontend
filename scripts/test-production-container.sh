#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)
BACKEND_DIR=${HOP_BACKEND_DIR:-"$PROJECT_DIR/../hop-rs"}
PANEL_IMAGE=${HOP_PANEL_IMAGE:-hop-panel-smoke:local}
BACKEND_IMAGE=${HOP_BACKEND_IMAGE:-hop-backend-smoke:local}
NETWORK="hop-smoke-$$"
BACKEND_CONTAINER="hop-smoke-backend-$$"
PANEL_CONTAINER="hop-smoke-panel-$$"
TEMP_DIR=$(mktemp -d)

cleanup() {
    docker rm -f "$PANEL_CONTAINER" "$BACKEND_CONTAINER" >/dev/null 2>&1 || true
    docker network rm "$NETWORK" >/dev/null 2>&1 || true
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

cat >"$TEMP_DIR/hop.yaml" <<'EOF'
listen: 0.0.0.0:2222
data_dir: /data
api:
  enabled: true
  listen: 0.0.0.0:8083
  token: smoke-token
EOF
chmod 0600 "$TEMP_DIR/hop.yaml"

docker build -t "$BACKEND_IMAGE" "$BACKEND_DIR"
docker build -t "$PANEL_IMAGE" "$PROJECT_DIR"
docker network create "$NETWORK" >/dev/null
docker run -d --name "$BACKEND_CONTAINER" --network "$NETWORK" --network-alias hop \
    -e HOP_CONFIG=/etc/hop/hop.yaml \
    -v "$TEMP_DIR/hop.yaml:/etc/hop/hop.yaml:ro" \
    "$BACKEND_IMAGE" hop-server --config /etc/hop/hop.yaml serve >/dev/null
docker run -d --name "$PANEL_CONTAINER" --network "$NETWORK" \
    -p 127.0.0.1::80 "$PANEL_IMAGE" >/dev/null

PANEL_PORT=$(docker port "$PANEL_CONTAINER" 80/tcp | sed 's/.*://')
PANEL_URL="http://127.0.0.1:$PANEL_PORT"

attempt=0
until curl --fail --silent --show-error "$PANEL_URL/" >"$TEMP_DIR/index.html"; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 40 ]; then
        docker logs "$PANEL_CONTAINER"
        exit 1
    fi
    sleep 0.25
done

grep -q '<div id="app"></div>' "$TEMP_DIR/index.html"
curl --fail --silent --show-error "$PANEL_URL/assets/nas" | grep -q '<div id="app"></div>'

status=$(curl --silent --output "$TEMP_DIR/unauthorized.json" --write-out '%{http_code}' \
    "$PANEL_URL/api/v1/status")
test "$status" = 401
grep -q unauthorized "$TEMP_DIR/unauthorized.json"

curl --fail --silent --show-error \
    --dump-header "$TEMP_DIR/status.headers" \
    --output "$TEMP_DIR/status.json" \
    -H 'Authorization: Bearer smoke-token' \
    "$PANEL_URL/api/v1/status"
grep -q '"status":"ok"' "$TEMP_DIR/status.json"
if grep -Fq 'smoke-token' "$TEMP_DIR/status.json"; then
    exit 1
fi
if grep -iq '^access-control-allow-origin:' "$TEMP_DIR/status.headers"; then
    exit 1
fi
if docker exec "$PANEL_CONTAINER" grep -R -Fq 'smoke-token' /usr/share/nginx/html /etc/nginx/conf.d; then
    exit 1
fi
if docker logs "$BACKEND_CONTAINER" 2>&1 | grep -Fq 'smoke-token'; then
    exit 1
fi
if docker logs "$PANEL_CONTAINER" 2>&1 | grep -Fq 'smoke-token'; then
    exit 1
fi

status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$PANEL_URL/api/not-proxied")
test "$status" = 404

test -z "$(docker port "$BACKEND_CONTAINER" 8083/tcp 2>/dev/null || true)"
docker stop "$BACKEND_CONTAINER" >/dev/null
status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --max-time 10 \
    -H 'Authorization: Bearer smoke-token' "$PANEL_URL/api/v1/status")
test "$status" = 502

printf 'Production container smoke test passed\n'
