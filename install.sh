#!/usr/bin/env bash
# =============================================================================
#  CaddyConfer – Automated Installation Script
#  Supports: Ubuntu/Debian and Rocky Linux/RHEL/CentOS/Fedora
#  Run as: bash install.sh
# =============================================================================

set -e

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╔═══════════════════════════════════════════════════╗"
    echo "  ║          CaddyConfer – Installation Script        ║"
    echo "  ║   Web UI for Caddy Server Configuration           ║"
    echo "  ╚═══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; }
step()    { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }
ask()     { echo -e "${YELLOW}[?]${NC} $1"; }

# Read input, stripping Windows \r characters (common in WSL)
read_input() {
    local varname="$1"
    read -r "$varname"
    eval "$varname=\${$varname//$'\\r'/}"
}

# --- Detect OS ---
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID="$ID"
        OS_NAME="$PRETTY_NAME"
    else
        error "Cannot detect operating system. /etc/os-release not found."
        exit 1
    fi

    case "$OS_ID" in
        ubuntu|debian|linuxmint|pop)
            PKG_MANAGER="apt"
            ;;
        rocky|rhel|centos|fedora|almalinux|ol)
            PKG_MANAGER="dnf"
            ;;
        *)
            warn "Unknown distribution: $OS_ID ($OS_NAME)"
            warn "Attempting to proceed – you may need to install dependencies manually."
            if command -v apt &>/dev/null; then
                PKG_MANAGER="apt"
            elif command -v dnf &>/dev/null; then
                PKG_MANAGER="dnf"
            elif command -v yum &>/dev/null; then
                PKG_MANAGER="yum"
            else
                error "No supported package manager found (apt/dnf/yum)."
                exit 1
            fi
            ;;
    esac
}

# --- Install system packages ---
install_system_deps() {
    step "Installing system dependencies ($PKG_MANAGER)"

    if [ "$PKG_MANAGER" = "apt" ]; then
        sudo apt update -qq
        sudo apt install -y -qq python3 python3-pip python3-venv curl >/dev/null 2>&1
        info "Installed: python3, python3-pip, python3-venv, curl"
    else
        sudo $PKG_MANAGER install -y -q python3 python3-pip curl >/dev/null 2>&1
        # venv module is usually included on RHEL/Rocky, but just in case:
        if ! python3 -m venv --help &>/dev/null; then
            sudo $PKG_MANAGER install -y -q python3-virtualenv >/dev/null 2>&1 || true
        fi
        info "Installed: python3, python3-pip, curl"
    fi

    # Verify Python
    if ! command -v python3 &>/dev/null; then
        error "Python3 installation failed. Please install Python 3.9+ manually."
        exit 1
    fi

    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
        error "Python 3.9+ required. Found: Python $PYTHON_VERSION"
        exit 1
    fi
    info "Python version: $PYTHON_VERSION ✓"
}

# --- Choose install directory ---
choose_install_dir() {
    step "Choosing installation directory"

    DEFAULT_DIR="/opt/caddyconfer"
    ask "Where should CaddyConfer be installed? [${DEFAULT_DIR}]: "
    read_input INSTALL_DIR
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_DIR}"

    if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/server.py" ]; then
        warn "Existing installation found at $INSTALL_DIR"
        ask "Overwrite? (y/N): "
        read_input OVERWRITE
        if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
            info "Keeping existing installation."
            SKIP_COPY=true
        fi
    fi

    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$(whoami):$(id -gn)" "$INSTALL_DIR"
    info "Install directory: $INSTALL_DIR"
}

# --- Copy files ---
copy_files() {
    if [ "${SKIP_COPY:-false}" = "true" ]; then
        info "Skipping file copy (keeping existing files)"
        return
    fi

    step "Copying CaddyConfer files"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ ! -f "$SCRIPT_DIR/server.py" ]; then
        error "Cannot find server.py in $SCRIPT_DIR"
        error "Run this script from the CaddyConfer directory."
        exit 1
    fi

    # Copy all project files
    cp -f "$SCRIPT_DIR/server.py" "$INSTALL_DIR/"
    cp -f "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"
    [ -f "$SCRIPT_DIR/installguide.txt" ] && cp -f "$SCRIPT_DIR/installguide.txt" "$INSTALL_DIR/"
    [ -f "$SCRIPT_DIR/RELEASE_NOTES.md" ] && cp -f "$SCRIPT_DIR/RELEASE_NOTES.md" "$INSTALL_DIR/"

    # Copy public directory
    mkdir -p "$INSTALL_DIR/public/css" "$INSTALL_DIR/public/js"
    cp -f "$SCRIPT_DIR/public/index.html" "$INSTALL_DIR/public/"
    cp -f "$SCRIPT_DIR/public/css/style.css" "$INSTALL_DIR/public/css/"
    cp -f "$SCRIPT_DIR/public/js/"*.js "$INSTALL_DIR/public/js/"

    # Create data directories
    mkdir -p "$INSTALL_DIR/configs" "$INSTALL_DIR/certs"

    info "Files copied to $INSTALL_DIR"
}

# --- Set up virtual environment and install Python packages ---
setup_venv() {
    step "Setting up Python virtual environment"

    cd "$INSTALL_DIR"

    if [ -d "venv" ]; then
        info "Virtual environment already exists, updating packages..."
    else
        python3 -m venv venv
        info "Virtual environment created"
    fi

    source venv/bin/activate

    # Upgrade pip silently
    pip install --upgrade pip --quiet 2>/dev/null

    # Install dependencies
    pip install --quiet flask cryptography bcrypt paramiko 2>/dev/null
    info "Installed: Flask, cryptography, bcrypt, paramiko"

    # Verify all imports work
    python3 -c "import flask; import cryptography; import bcrypt; import paramiko; print('All packages OK')" 2>/dev/null
    if [ $? -eq 0 ]; then
        info "All Python packages verified ✓"
    else
        error "Package verification failed. Try: pip install -r requirements.txt"
        exit 1
    fi

    deactivate
}

# --- Set up systemd service ---
setup_service() {
    step "Setting up systemd service (optional)"

    ask "Would you like to run CaddyConfer as a system service? (Y/n): "
    read_input SETUP_SERVICE
    SETUP_SERVICE="${SETUP_SERVICE:-Y}"

    if [[ ! "$SETUP_SERVICE" =~ ^[Yy]$ ]]; then
        info "Skipping service setup. Start manually with:"
        echo "    cd $INSTALL_DIR && source venv/bin/activate && python3 server.py"
        return
    fi

    # Choose port
    ask "Which port should CaddyConfer listen on? [5555]: "
    read_input PORT
    PORT="${PORT:-5555}"

    # Choose user
    if id "www-data" &>/dev/null; then
        DEFAULT_USER="www-data"
    elif id "nginx" &>/dev/null; then
        DEFAULT_USER="nginx"
    else
        DEFAULT_USER="$(whoami)"
    fi
    ask "Which user should the service run as? [${DEFAULT_USER}]: "
    read_input SERVICE_USER
    SERVICE_USER="${SERVICE_USER:-$DEFAULT_USER}"

    # Make sure the user can access the install dir
    sudo chown -R "$SERVICE_USER:$(id -gn "$SERVICE_USER")" "$INSTALL_DIR"

    # Write the service file
    SERVICE_FILE="/etc/systemd/system/caddyconfer.service"
    sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=CaddyConfer - Caddy Configuration Generator
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/python server.py
Restart=always
RestartSec=5
Environment=FLASK_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    # If non-default port, patch server.py
    if [ "$PORT" != "5555" ]; then
        sed -i "s/port=5555/port=${PORT}/" "$INSTALL_DIR/server.py"
        info "Port set to $PORT"
    fi

    # Set production mode
    sed -i "s/debug=True/debug=False/" "$INSTALL_DIR/server.py"

    sudo systemctl daemon-reload
    sudo systemctl enable caddyconfer --quiet
    sudo systemctl start caddyconfer

    # Verify it started
    sleep 2
    if sudo systemctl is-active --quiet caddyconfer; then
        info "CaddyConfer service is running ✓"
        info "URL: http://$(hostname -I | awk '{print $1}'):${PORT}"
    else
        error "Service failed to start. Check: sudo journalctl -u caddyconfer -n 20"
    fi

    echo ""
    info "Service management commands:"
    echo "    sudo systemctl status caddyconfer    # Check status"
    echo "    sudo systemctl restart caddyconfer   # Restart"
    echo "    sudo systemctl stop caddyconfer      # Stop"
    echo "    sudo journalctl -u caddyconfer -f    # View logs"
}

# --- Configure firewall ---
setup_firewall() {
    step "Configuring firewall (optional)"

    ACTUAL_PORT="${PORT:-5555}"

    ask "Open port ${ACTUAL_PORT} in the firewall? (y/N): "
    read_input OPEN_FW
    if [[ ! "$OPEN_FW" =~ ^[Yy]$ ]]; then
        info "Skipping firewall configuration"
        return
    fi

    if command -v firewall-cmd &>/dev/null; then
        # firewalld (Rocky, RHEL, Fedora)
        sudo firewall-cmd --permanent --add-port="${ACTUAL_PORT}/tcp" --quiet
        sudo firewall-cmd --reload --quiet
        info "Firewalld: port ${ACTUAL_PORT}/tcp opened"
    elif command -v ufw &>/dev/null; then
        # ufw (Ubuntu)
        sudo ufw allow "${ACTUAL_PORT}/tcp" >/dev/null 2>&1
        info "UFW: port ${ACTUAL_PORT}/tcp allowed"
    else
        warn "No firewall tool detected. You may need to open port ${ACTUAL_PORT} manually."
    fi
}

# --- Verify installation ---
verify_installation() {
    step "Verifying installation"

    ACTUAL_PORT="${PORT:-5555}"

    # Check if server responds
    RETRIES=5
    for i in $(seq 1 $RETRIES); do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${ACTUAL_PORT}/" 2>/dev/null | grep -q "200"; then
            info "CaddyConfer is responding on http://localhost:${ACTUAL_PORT} ✓"

            # Quick API test
            HASH_TEST=$(curl -s -X POST "http://localhost:${ACTUAL_PORT}/api/hash-password" \
                -H "Content-Type: application/json" \
                -d '{"password":"test"}' 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('hash','')[:4])" 2>/dev/null || echo "")
            if [ "$HASH_TEST" = '$2b$' ]; then
                info "Password hashing API working ✓"
            fi
            return
        fi
        sleep 1
    done

    warn "Server not responding yet. It may still be starting up."
    warn "Try: curl http://localhost:${ACTUAL_PORT}/"
}

# =============================================================================
#  MAIN
# =============================================================================

print_banner

echo -e "${BOLD}This script will:${NC}"
echo "  1. Install system dependencies (Python 3, pip, curl)"
echo "  2. Copy CaddyConfer files to your chosen directory"
echo "  3. Create a Python virtual environment"
echo "  4. Install Python packages (Flask, cryptography, bcrypt)"
echo "  5. Optionally set up a systemd service"
echo "  6. Optionally configure the firewall"
echo ""

ask "Continue with installation? (Y/n): "
read_input CONTINUE
CONTINUE="${CONTINUE:-Y}"
if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 0
fi

detect_os
info "Detected OS: $OS_NAME (package manager: $PKG_MANAGER)"

install_system_deps
choose_install_dir
copy_files
setup_venv
setup_service
setup_firewall
verify_installation

# =============================================================================
#  DONE
# =============================================================================

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║        CaddyConfer installation complete! ✓       ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

ACTUAL_PORT="${PORT:-5555}"
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
echo -e "  ${BOLD}Access CaddyConfer:${NC}"
echo -e "    Local:   ${CYAN}http://localhost:${ACTUAL_PORT}${NC}"
[ -n "$IP_ADDR" ] && echo -e "    Network: ${CYAN}http://${IP_ADDR}:${ACTUAL_PORT}${NC}"
echo ""
echo -e "  ${BOLD}Files:${NC}"
echo -e "    Install dir:  $INSTALL_DIR"
echo -e "    Configs:      $INSTALL_DIR/configs/"
echo -e "    Certificates: $INSTALL_DIR/certs/"
echo ""
echo -e "  ${BOLD}Manual start:${NC}"
echo "    cd $INSTALL_DIR"
echo "    source venv/bin/activate"
echo "    python3 server.py"
echo ""
