# CaddyConfer — Release Notes

## About CaddyConfer

**CaddyConfer** is a web-based configuration generator for [Caddy server](https://caddyserver.com/) reverse proxy configurations. It provides an intuitive UI for building production-ready Caddyfiles without manually writing configuration syntax.

**Tech stack:** Python / Flask backend · Vanilla HTML / CSS / JavaScript frontend · Bootstrap 5 (CDN)

## How to Read These Release Notes

Each version entry includes a **version number**, **release subtitle**, and a detailed list of changes. Features are grouped logically and highlighted in **bold**. Technical requirements (e.g., minimum Caddy version) are noted where applicable.

Versions follow [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**.

---

## v1.6.0 — Security Hardening & Bug Fixes

Comprehensive security audit performed by two independent AI code reviewers (Claude Sonnet 4.6 and GPT-5.4). All identified issues have been resolved.

### Critical Fixes

- **Path traversal in save-config** — Hostnames containing `../` or path separators could write files outside the `configs/` directory. Now strips `/`, `\`, `..` from hostnames and validates the resolved path stays within `CONFIGS_DIR`.
- **Path traversal in config-history-content** — The `<path:filename>` route parameter allowed reading arbitrary files on the server. Now requires `.bak` extension and validates path containment within the history directory.

### High Severity Fixes

- **SFTP path traversal** — Filenames sent to SSH download/upload could escape the configured remote directory using `../`. New `_validate_remote_filename()` helper using `posixpath` rejects any traversal attempts.
- **SSH host key verification** — `AutoAddPolicy` (which silently accepts any host key, enabling MITM attacks) replaced with `WarningPolicy`. The server now returns the remote host's **fingerprint** and **key type** on connect so users can verify identity.
- **ZeroSSL EAB bug** — Both `key_id` and `mac_key` were set to the same value (the API key). ZeroSSL requires two distinct values. Added a new **"ZeroSSL EAB MAC Key"** input field. Generated config now uses the correct separate values. Includes i18n support (SV/EN).

### Medium Severity Fixes

- **Invalid JSON crash protection** — All 12 POST endpoints now return a clean `400` error (`"Invalid or missing JSON body"`) instead of crashing with `500 AttributeError` when the request body is missing or malformed.
- **Git files list validation** — Filenames passed to `git add` are now validated with a strict regex (`^[a-zA-Z0-9._-]+$`). Path separators, traversal segments, and git flags are rejected.
- **Wrong Caddy directive** — Passive health check latency was emitted as `unhealthy_request_count` (expects an integer) instead of `unhealthy_latency` (expects a duration). Fixed to generate valid Caddyfile syntax.
- **Docker production server** — Docker image now uses **gunicorn** (`gunicorn --bind 0.0.0.0:5555 --workers 2 --timeout 120`) instead of Flask's built-in development server. Added `gunicorn>=21.0` to `requirements.txt`.
- **install.sh dependency drift** — Hardcoded `pip install flask cryptography bcrypt paramiko` replaced with `pip install -r requirements.txt` to prevent future divergence between install script and requirements file.

### i18n Improvements

- **Validation messages fully internationalized** — All 8 hardcoded Swedish validation/warning strings in `config-builder.js` now use the `t()` i18n function. Messages display correctly in both Swedish and English depending on selected language.
  - `validation.hostname_required`, `validation.invalid_hostname_format`, `validation.tls_cert_key_required`, `validation.no_site_config`, `validation.compression_no_method`, `validation.keycloak_no_endpoint`, `validation.no_upstream`, `validation.lb_header_no_name`

---

## v1.5.0 — Documentation Links

- **Inline Caddy documentation links** — Every configuration section now includes a direct link (📖) to the relevant page on [caddyserver.com/docs](https://caddyserver.com/docs). 22 links total covering all main sections and sub-features (load balancing, health checks, transport, basic auth, mTLS, etc.).
- **Sub-feature links** — Compact book-icon links placed next to specific settings like load balancing policy, health check options, proxy headers, trusted proxies, error pages, forward auth, and client certificates.

---

## v1.4.0 — SSH/SFTP Deployment & UI Polish

### SSH/SFTP Remote Server Management

- **Deploy via SSH** — New modal for connecting to a remote Caddy server via SSH/SFTP. Features:
  - Connect with **password** or **SSH key** authentication (with passphrase support)
  - Configurable **remote config directory** (default: `/etc/caddy/conf.d`)
  - **List, download, and edit** remote `.caddy` configuration files
  - **Upload current config** directly to the remote server
  - **Validate config** — runs `caddy validate` on the remote server and shows output
  - **Activate config** — if validation passes, a "Reload Caddy" button appears to run `systemctl reload caddy`
  - Automatic **session cleanup** (30 min timeout)
  - **Security notice** in UI reminding users that credentials pass through the CaddyConfer server
- **Backend:** Python `paramiko` library for SSH/SFTP. Session-based with `secrets.token_hex()` IDs.

### UI Improvements

- **Export button row** — Download, Save, Copy, Push to Git, and Deploy via SSH are now all buttons in a single row. Git and SSH open modals for their respective forms.
- **Release Notes in-app** — New "Release Notes" button in the navbar opens a modal displaying this document with basic markdown rendering.
- **Updated installation docs** — `installguide.txt` and `install.sh` updated with `paramiko` dependency, new file structure, and SSH/Git feature descriptions.

---

## v1.3.0 — UX Improvements & Git Integration

- **Logging enabled by default** — The logging checkbox is now checked on page load and log options are visible immediately. The section badge has been changed from *"Optional"* to *"Recommended"*.
- **Advanced Features section** — Keycloak SSO and Client Certificate authentication have been combined into a single *"Advanced Features"* accordion section, reducing visual clutter for typical users.
- **Git push integration** — New feature to push configuration files directly to a Git repository. Includes fields for remote URL, branch, and commit message. The backend uses `subprocess` to execute git commands. A status check displays the current repository state.
- **Release notes** — This document is now shipped with the project and will be continuously updated with each version.

---

## v1.2.1 — Section Reorder

- **Logical section reordering** — All 13 accordion sections have been reorganized into a logical configuration flow:

  | # | Section | Group |
  |---|---------|-------|
  | 1 | Site (hostname) | Basics |
  | 2 | Global settings | Basics |
  | 3 | TLS / Certificates | Basics |
  | 4 | Reverse Proxy | Traffic & Routing |
  | 5 | Redirects | Traffic & Routing |
  | 6 | Security Headers | Security |
  | 7 | CORS | Security |
  | 8 | Encoding / Compression | Security |
  | 9 | Logging | Monitoring |
  | 10 | Extra Settings | Monitoring |
  | 11 | Keycloak / Forward Auth | Authentication |
  | 12 | Client Certificate (mTLS) | Authentication |
  | 13 | Live Preview | Export |

- **Updated recommendation references** — All step references in the recommendation engine (both Swedish and English strings) have been updated to reflect the new section order.
- **Updated navigation indices** — All `openAccordionSection()` calls now use the correct indices.

---

## v1.2.0 — New Features Batch

Ten new features and improvements:

- **Redirects section** — Configure HTTP redirects with path, target URL, and HTTP status code.
- **Custom error pages** — Define custom responses for error codes `404`, `500`, `502`, and `503`.
- **Request body size limit** — Set `max_size` to restrict uploaded content size.
- **Trusted proxies** — Configure `trusted_proxies` so Caddy correctly processes `X-Forwarded-*` headers from upstream load balancers or CDNs.
- **CORS configuration** — Full Cross-Origin Resource Sharing setup including allowed origins, methods, headers, credentials, and `max-age`.
- **WebSocket info** — Informational section explaining Caddy's automatic WebSocket proxying (no additional configuration required).
- **Path-based routing** — Route different URL paths to different backend servers.
- **Enhanced validation** — FQDN format checking, port range validation (1–65535), and upstream address validation.
- **Dark mode** — Full dark theme with a toggle button. Preference is persisted in `localStorage`.
- **Config history** — Automatic versioning on every save; the last 20 versions are viewable in the UI.

### Removed

- **X-XSS-Protection header option removed** — This header is deprecated in all modern browsers and has been removed from the security headers section.

---

## v1.1.0 — Internationalization & Security

Major feature additions focused on multi-language support and security hardening.

### Internationalization

- **Full i18n support** — Complete Swedish and English language support with **400+ translation keys** covering every UI label, tooltip, validation message, and recommendation string.
- **Language switcher** — Toggle between Swedish (`sv`) and English (`en`) at any time. The selected language is persisted in `localStorage`.
- **Recommendation translations** — All 50+ recommendation strings now use the i18n system (previously hardcoded in Swedish).
- **Default language changed to English.**

### Security

- **bcrypt password hashing** — Basic auth passwords are now hashed with bcrypt (14 rounds) via the `/api/hash-password` endpoint, replacing plaintext storage. Hashes use the Caddy-compatible `$2b$` format.
- **Password UI redesign** — New *Hash* button, eye-toggle for password visibility, and automatic re-hashing when the password value changes.

### TLS

- **ZeroSSL + Let's Encrypt fallback** — New TLS option that generates dual `acme_issuer` blocks for automatic failover between ZeroSSL and Let's Encrypt. *Requires Caddy v2.7+.*
- **Default TLS mode changed** — The default certificate mode has been changed from *"Automatic (Let's Encrypt)"* to *"ZeroSSL with API key"*.
- **ZeroSSL global hint** — Added help text explaining that the API key field can be left empty if the key is already set in the global Caddyfile.

### Deployment

- **Linux installation script (`install.sh`)** — Automated installer supporting:
  - Ubuntu / Debian (`apt`)
  - Rocky / RHEL / CentOS / Fedora (`dnf`)
  - systemd service creation
  - Python virtual environment setup
  - Firewall configuration
  - WSL compatibility via `read_input()` wrapper

---

## v1.0.0 — Initial Release

The first complete version of CaddyConfer, delivering all core functionality for generating Caddy reverse proxy configurations through a web interface.

### Web Interface

- **Accordion-based UI** — 11 collapsible sections covering every aspect of a Caddy reverse proxy configuration.
- **Welcome card** — Landing card with three preset templates: *Basic*, *Secure*, and *Performance*.
- **Live preview** — Real-time Caddyfile preview with syntax highlighting.
- **Validation engine** — Inline error and warning messages for invalid or incomplete configurations.
- **Recommendations engine** — Actionable suggestions with auto-fix buttons to improve the generated configuration.
- **Swedish UI** — All labels, tooltips, and help-explainer texts in Swedish.

### Configuration Sections

- **Hostname** — FQDN input with format validation.
- **Global settings** — `auto_https`, admin API toggle, `http_port`, `https_port`.
- **TLS / Certificates** — Five certificate modes:
  - Automatic (Let's Encrypt)
  - ZeroSSL with API key
  - Manual certificate and key file paths
  - PFX / PKCS#12
  - Internal (self-signed test certificate)
- **Client certificate authentication (mTLS)** — CA and client certificate generation for mutual TLS.
- **Logging** — Output targets (`file` / `stdout` / `stderr`), format (`json` / `console`), log levels, and log rolling by size, days, and keep count. Default log path: `/var/log/caddy/<fqdn>.log`.
- **Security headers** — HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`, Content-Security-Policy builder, Permissions-Policy builder, and custom headers with presets.
- **Compression / Encoding** — `gzip` and `zstd` support.
- **Reverse proxy** — Upstream server management, `header_up` / `header_down` with dropdown selections and descriptions, load balancing policies, health checks, and transport settings.
- **Extra settings** — IP whitelist/blacklist with custom block messages, basic authentication, rate limiting, request body size limits, and timeouts.
- **Keycloak / Forward Auth** — Integration with Keycloak for SSO via Caddy's `forward_auth` directive.

### File Management

- **Save / Load / Download** — Configurations stored on the server in the `configs/` directory.
- **FQDN-based filenames** — Files saved as `<fqdn>.caddy`.

### Backend Features

- **Certificate generation** — Generate CA, client, and PFX certificates via the Python `cryptography` library.
- **Caddy version check** — Fetches the latest Caddy release from the GitHub Releases API.
- **Caddy documentation monitoring** — Detects updates to Caddy's official documentation.
