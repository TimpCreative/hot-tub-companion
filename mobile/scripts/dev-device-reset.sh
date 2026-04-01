#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TENANT="${1:-htctest}"
DEVICE_ID="${DEVICE_ID:-}"
APP_BUNDLE_ID="${APP_BUNDLE_ID:-com.hottubcompanion.${TENANT}}"
METRO_PORT="${METRO_PORT:-8081}"
METRO_HOST="${METRO_HOST:-192.168.4.22}"

if [[ -z "$DEVICE_ID" ]]; then
  echo "Set DEVICE_ID to your iPhone UDID before running this script."
  echo "Example: DEVICE_ID=00008140-000C20593A62801C npm run dev:device:htctest"
  exit 1
fi

cd "$ROOT_DIR"

echo "Starting fresh Metro for tenant '$TENANT'..."
pkill -f "expo start --dev-client --host lan --clear" >/dev/null 2>&1 || true
pkill -f "node .*scripts/with-tenant.js ${TENANT} npx expo start --dev-client --host lan --clear" >/dev/null 2>&1 || true

env -u CI node scripts/with-tenant.js "$TENANT" npx expo start --dev-client --host lan --clear > /tmp/hottub-metro-device.log 2>&1 &
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
  echo "Metro failed to start. Check /tmp/hottub-metro-device.log"
  exit 1
fi

DEEPLINK="com.hottubcompanion.${TENANT}://expo-development-client/?url=http%3A%2F%2F${METRO_HOST}%3A${METRO_PORT}"

echo
echo "Metro is ready for your phone."
echo "Tenant: $TENANT"
echo "Bundle ID: $APP_BUNDLE_ID"
echo "Device ID: $DEVICE_ID"
echo "Open this URL on the device if HTC Test does not reconnect automatically:"
echo "$DEEPLINK"
echo
echo "Tip: fully close HTC Test on the phone before reopening it."
echo "Keep this terminal running while you test. Press Ctrl+C to stop Metro."

wait "$METRO_PID"
