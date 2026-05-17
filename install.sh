#!/bin/bash
set -euo pipefail

REPO_URL="https://github.com/a1baseai/a1zap-admin-agent-cli.git"
ARCHIVE_URL="https://github.com/a1baseai/a1zap-admin-agent-cli/archive/refs/heads/main.tar.gz"
INSTALL_ROOT="${A1ZAP_ADMIN_AGENT_INSTALL_ROOT:-$HOME/.a1zap}"
INSTALL_DIR="$INSTALL_ROOT/admin-agent-cli"
BIN_DIR="${A1ZAP_ADMIN_AGENT_BIN_DIR:-$HOME/.local/bin}"

info() {
  printf '%s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$2 is required"
}

node_major() {
  node -v | sed 's/^v//' | cut -d. -f1
}

download_package() {
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_ROOT"

  if [ -n "${A1ZAP_ADMIN_AGENT_INSTALL_SOURCE_DIR:-}" ]; then
    [ -d "$A1ZAP_ADMIN_AGENT_INSTALL_SOURCE_DIR" ] || fail "A1ZAP_ADMIN_AGENT_INSTALL_SOURCE_DIR does not exist"
    mkdir -p "$INSTALL_DIR"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a \
        --exclude ".git" \
        --exclude "node_modules" \
        "$A1ZAP_ADMIN_AGENT_INSTALL_SOURCE_DIR"/ "$INSTALL_DIR"/
    else
      cp -R "$A1ZAP_ADMIN_AGENT_INSTALL_SOURCE_DIR"/. "$INSTALL_DIR"
      rm -rf "$INSTALL_DIR/.git" "$INSTALL_DIR/node_modules"
    fi
    return
  fi

  if command -v git >/dev/null 2>&1; then
    if git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1; then
      return
    fi
    rm -rf "$INSTALL_DIR"
  fi

  require_command curl "curl"
  require_command tar "tar"
  local archive_dir="$INSTALL_ROOT/a1zap-admin-agent-cli-main"
  rm -rf "$archive_dir"
  curl -fsSL "$ARCHIVE_URL" | tar xz -C "$INSTALL_ROOT"
  mv "$archive_dir" "$INSTALL_DIR"
}

require_command node "Node.js 18+"
require_command npm "npm"

if [ "$(node_major)" -lt 18 ]; then
  fail "Node.js 18+ is required; found $(node -v)"
fi

info "Installing A1Zap Admin Agent CLI..."
download_package

cd "$INSTALL_DIR"

if [ ! -f "dist/cli.js" ]; then
  info "Building CLI..."
  npm install --silent
  npm run build --silent
fi

mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/a1zap-admin-agent.js" "$BIN_DIR/a1zap-admin-agent"
chmod +x "$INSTALL_DIR/bin/a1zap-admin-agent.js"

info "Installed a1zap-admin-agent to $BIN_DIR/a1zap-admin-agent"
info ""
info "Configure a key:"
info "  a1zap-admin-agent config set a1zap_admin_..."

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    info ""
    info "Add this to your shell PATH if needed:"
    info "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac
