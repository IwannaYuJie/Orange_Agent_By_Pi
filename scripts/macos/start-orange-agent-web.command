#!/bin/zsh
set -u

BASE_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PATH="${BASE_PATH}:${PATH}"

SCRIPT_PATH="${0:A}"
SCRIPT_DIR="${SCRIPT_PATH:h}"
DEFAULT_REPO_DIR="/Users/penghaoxiang/Documents/pi agent/pi"
REPO_DIR="${ORANGE_AGENT_REPO_DIR:-}"

if [[ -z "$REPO_DIR" ]]; then
  if [[ -f "${SCRIPT_DIR}/../../package.json" && -d "${SCRIPT_DIR}/../../packages/coding-agent" ]]; then
    REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
  elif [[ -d "$DEFAULT_REPO_DIR" ]]; then
    REPO_DIR="$DEFAULT_REPO_DIR"
  else
    REPO_DIR="$(pwd -P)"
  fi
fi

HOST="127.0.0.1"
PORT="${ORANGE_AGENT_WEB_PORT:-${PI_WEB_PORT:-42173}}"
URL="http://${HOST}:${PORT}"
LOG_DIR="${HOME}/Library/Logs/OrangeAgentByPi"
LOG_FILE="${LOG_DIR}/orange-agent-web.log"
STARTUP_TRIES="${ORANGE_AGENT_WEB_STARTUP_TRIES:-${PI_WEB_STARTUP_TRIES:-30}}"
UID_VALUE="$(id -u)"
LAUNCH_AGENT_LABEL="me.penghaoxiang.orange-agent-by-pi"
LEGACY_LAUNCH_AGENT_LABELS=("me.penghaoxiang.pi-web.orange-cat")
LAUNCH_AGENT_PLIST="${HOME}/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist"

print_line() {
  printf '%s\n' "------------------------------------------------------------"
}

status_msg() {
  printf '%-24s %s\n' "$1" "$2"
}

wait_for_orange_agent_web() {
  local tries="${1:-2}"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS --max-time 2 "${URL}/api/state" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

open_orange_agent_web() {
  /usr/bin/open "$URL" >/dev/null 2>&1 || true
}

schedule_terminal_close() {
  if [[ "${TERM_PROGRAM:-}" != "Apple_Terminal" ]]; then
    return 0
  fi

  local tty_name
  tty_name="$(tty)"

  /usr/bin/nohup /usr/bin/osascript \
    -e 'delay 0.6' \
    -e 'tell application "Terminal"' \
    -e 'repeat with terminalWindow in windows' \
    -e 'repeat with terminalTab in tabs of terminalWindow' \
    -e "if tty of terminalTab is \"${tty_name}\" then close terminalTab" \
    -e 'end repeat' \
    -e 'end repeat' \
    -e 'end tell' >/dev/null 2>&1 &
}

plist_string() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '    <string>%s</string>\n' "$value"
}

write_launch_agent_plist() {
  local node_bin="$1"
  local -a command
  mkdir -p "${HOME}/Library/LaunchAgents"

  if [[ -f "${REPO_DIR}/packages/coding-agent/src/web/cli.ts" ]]; then
    command=("$node_bin" --import tsx "${REPO_DIR}/packages/coding-agent/src/web/cli.ts" --port "$PORT" --cwd "$REPO_DIR")
  else
    command=("$node_bin" "${REPO_DIR}/packages/coding-agent/dist/web/cli.js" --port "$PORT" --cwd "$REPO_DIR")
  fi

  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0">'
    printf '%s\n' '<dict>'
    printf '%s\n' '  <key>Label</key>'
    plist_string "$LAUNCH_AGENT_LABEL"
    printf '%s\n' '  <key>ProgramArguments</key>'
    printf '%s\n' '  <array>'
    for arg in "${command[@]}"; do
      plist_string "$arg"
    done
    printf '%s\n' '  </array>'
    printf '%s\n' '  <key>WorkingDirectory</key>'
    plist_string "$REPO_DIR"
    printf '%s\n' '  <key>EnvironmentVariables</key>'
    printf '%s\n' '  <dict>'
    printf '%s\n' '    <key>PATH</key>'
    plist_string "$BASE_PATH"
    printf '%s\n' '  </dict>'
    printf '%s\n' '  <key>RunAtLoad</key>'
    printf '%s\n' '  <true/>'
    printf '%s\n' '  <key>StandardOutPath</key>'
    plist_string "$LOG_FILE"
    printf '%s\n' '  <key>StandardErrorPath</key>'
    plist_string "$LOG_FILE"
    printf '%s\n' '</dict>'
    printf '%s\n' '</plist>'
  } > "$LAUNCH_AGENT_PLIST"

  {
    printf '\n[%s] Launching Orange Agent Web\n' "$(date '+%Y-%m-%d %H:%M:%S')"
    printf 'LaunchAgent: %s\n' "$LAUNCH_AGENT_LABEL"
    printf 'Command:'
    printf ' %q' "${command[@]}"
    printf '\n'
  } >> "$LOG_FILE"
}

unload_launch_agent_label() {
  local label="$1"
  if launchctl print "gui/${UID_VALUE}/${label}" >/dev/null 2>&1; then
    launchctl bootout "gui/${UID_VALUE}/${label}" >/dev/null 2>&1 || true
    sleep 1
  fi
}

unload_launch_agents() {
  unload_launch_agent_label "$LAUNCH_AGENT_LABEL"
  for legacy_label in "${LEGACY_LAUNCH_AGENT_LABELS[@]}"; do
    unload_launch_agent_label "$legacy_label"
  done
}

launch_orange_agent_web() {
  local node_bin
  node_bin="$(command -v node)"

  write_launch_agent_plist "$node_bin"
  unload_launch_agents

  if ! launchctl bootstrap "gui/${UID_VALUE}" "$LAUNCH_AGENT_PLIST" >/dev/null 2>&1; then
    status_msg "LaunchAgent" "bootstrap failed"
    return 1
  fi

  launchctl kickstart -k "gui/${UID_VALUE}/${LAUNCH_AGENT_LABEL}" >/dev/null 2>&1 || true
  status_msg "LaunchAgent" "$LAUNCH_AGENT_LABEL"
}

listener_pids() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

wait_for_port_to_close() {
  for _ in {1..10}; do
    if [[ -z "$(listener_pids)" ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

stop_existing_orange_agent_web() {
  local pids
  unload_launch_agents
  pids="$(listener_pids)"
  if [[ -z "$pids" ]]; then
    status_msg "Orange Agent Web" "no listener found"
    return 0
  fi

  status_msg "Orange Agent Web" "stopping PID $(echo "$pids" | tr '\n' ' ')"
  kill ${(f)pids} >/dev/null 2>&1 || true

  if wait_for_port_to_close; then
    status_msg "Orange Agent Web" "stopped"
    return 0
  fi

  status_msg "Orange Agent Web" "force stopping"
  kill -9 ${(f)pids} >/dev/null 2>&1 || true
  wait_for_port_to_close
}

clear
print_line
echo "Starting Orange Agent Web workspace"
print_line

if [[ ! -d "$REPO_DIR" ]]; then
  status_msg "Project" "not found: ${REPO_DIR}"
  print_line
  read -r "?Press Enter to close..." || true
  exit 1
fi

cd "$REPO_DIR" || exit 1
mkdir -p "$LOG_DIR"

status_msg "Project" "$REPO_DIR"
status_msg "URL" "$URL"
status_msg "Log" "$LOG_FILE"
print_line

if wait_for_orange_agent_web 1; then
  status_msg "Orange Agent Web" "already running, restarting"
  stop_existing_orange_agent_web || {
    print_line
    echo "Could not stop the existing Orange Agent Web process."
    print_line
    read -r "?Press Enter to close..." || true
    exit 1
  }
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  status_msg "Port ${PORT}" "occupied, but Orange Agent Web did not respond"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
  print_line
  echo "Close the process above or choose another port with ORANGE_AGENT_WEB_PORT."
  print_line
  read -r "?Press Enter to close..." || true
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  status_msg "Node.js" "not found"
  print_line
  echo "Install Node.js first, then double-click this launcher again."
  print_line
  read -r "?Press Enter to close..." || true
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  status_msg "npm" "not found"
  print_line
  echo "Install npm first, then double-click this launcher again."
  print_line
  read -r "?Press Enter to close..." || true
  exit 1
fi

status_msg "Node.js" "$(node --version)"
status_msg "npm" "$(npm --version)"

if [[ ! -d "${REPO_DIR}/node_modules" ]]; then
  print_line
  echo "Installing dependencies with npm install --ignore-scripts..."
  npm install --ignore-scripts || {
    print_line
    echo "Dependency install failed. Check the output above."
    print_line
    read -r "?Press Enter to close..." || true
    exit 1
  }
fi

print_line
echo "Launching Orange Agent Web..."
print_line

if ! launch_orange_agent_web; then
  print_line
  echo "Could not load the Orange Agent Web LaunchAgent."
  print_line
  read -r "?Press Enter to close..." || true
  exit 1
fi

status_msg "Orange Agent Web" "waiting for startup"
if ! wait_for_orange_agent_web "$STARTUP_TRIES"; then
  status_msg "Orange Agent Web" "startup timed out"
  print_line
  echo "Last log lines:"
  tail -n 40 "$LOG_FILE" || true
  print_line
  echo "Orange Agent Web did not become ready. Check the log above."
  print_line
  read -r "?Press Enter to close..." || true
  exit 1
fi

status_msg "Orange Agent Web" "ready"
open_orange_agent_web

print_line
echo "Orange Agent Web is running in the background."
echo "This launcher window will close automatically."
print_line
schedule_terminal_close
exit 0
