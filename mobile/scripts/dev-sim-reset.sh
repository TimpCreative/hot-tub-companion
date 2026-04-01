#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TENANT="${1:-htctest}"
DEVICE_UDID="${SIMULATOR_UDID:-FE9A2D6D-6A3F-4329-97BE-966F0B10ACFC}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:-com.hottubcompanion.${TENANT}}"
METRO_PORT="${METRO_PORT:-8081}"
METRO_HOST="${METRO_HOST:-192.168.4.22}"

cd "$ROOT_DIR"

echo "Starting fresh Metro for tenant '$TENANT'..."
pkill -f "expo start --dev-client --host lan --clear" >/dev/null 2>&1 || true
pkill -f "node .*scripts/with-tenant.js ${TENANT} npx expo start --dev-client --host lan --clear" >/dev/null 2>&1 || true

env -u CI node scripts/with-tenant.js "$TENANT" npx expo start --dev-client --host lan --clear > /tmp/hottub-metro.log 2>&1 &
METRO_PID=$!

cleanup() {
  if ps -p "$METRO_PID" >/dev/null 2>&1; then
    echo "Stopping Metro (pid $METRO_PID)..."
    kill "$METRO_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Waiting for Metro on port $METRO_PORT..."
for _ in {1..30}; do
  if lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Metro failed to start. Check /tmp/hottub-metro.log"
  exit 1
fi

echo "Recycling simulator app..."
xcrun simctl boot "$DEVICE_UDID" >/dev/null 2>&1 || true
xcrun simctl terminate "$DEVICE_UDID" "$APP_BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl launch "$DEVICE_UDID" "$APP_BUNDLE_ID" >/dev/null

DEEPLINK="com.hottubcompanion.${TENANT}://expo-development-client/?url=http%3A%2F%2F${METRO_HOST}%3A${METRO_PORT}"
echo "Opening dev client URL..."
xcrun simctl openurl "$DEVICE_UDID" "$DEEPLINK"

echo
echo "HTC simulator dev session is ready."
echo "Tenant: $TENANT"
echo "Bundle ID: $APP_BUNDLE_ID"
echo "Simulator UDID: $DEVICE_UDID"
echo "Metro log: /tmp/hottub-metro.log"
echo
echo "Keep this terminal running while you test. Press Ctrl+C to stop Metro."

wait "$METRO_PID"
