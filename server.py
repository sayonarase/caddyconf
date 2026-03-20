"""
CaddyConfer - Web UI for Caddy Server Reverse Proxy Configuration
"""

import os
import io
import json
import datetime
import shutil
import subprocess
import secrets
import time
import re
import posixpath
import bcrypt
import paramiko
from flask import Flask, request, jsonify, send_from_directory, send_file
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

app = Flask(__name__, static_folder='public', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIGS_DIR = os.path.join(BASE_DIR, 'configs')
CERTS_DIR = os.path.join(BASE_DIR, 'certs')

os.makedirs(CONFIGS_DIR, exist_ok=True)
os.makedirs(CERTS_DIR, exist_ok=True)

# Active SSH/SFTP sessions keyed by session ID
_ssh_sessions = {}  # session_id -> { 'ssh': SSHClient, 'sftp': SFTPClient, 'host': str, 'connected_at': float }


def _cleanup_ssh_sessions():
    """Close stale SSH sessions older than 30 minutes."""
    now = time.time()
    stale = [sid for sid, s in _ssh_sessions.items() if now - s['connected_at'] > 1800]
    for sid in stale:
        try:
            _ssh_sessions[sid]['sftp'].close()
            _ssh_sessions[sid]['ssh'].close()
        except:
            pass
        del _ssh_sessions[sid]


def _get_ssh_session(session_id):
    """Validate and return an active SSH session."""
    _cleanup_ssh_sessions()
    session = _ssh_sessions.get(session_id)
    if not session:
        return None, (jsonify({'error': 'SSH session not found or expired. Please reconnect.'}), 401)
    try:
        if not session['ssh'].get_transport().is_active():
            raise Exception('inactive')
    except:
        del _ssh_sessions[session_id]
        return None, (jsonify({'error': 'SSH connection lost. Please reconnect.'}), 401)
    return session, None


def _validate_remote_filename(remote_path, filename):
    """Validate that filename does not escape remote_path."""
    if not filename or '/' in filename or '\\' in filename or '..' in filename:
        return None
    remote_file = posixpath.join(remote_path, filename)
    normalized = posixpath.normpath(remote_file)
    if not normalized.startswith(remote_path.rstrip('/') + '/') and normalized != remote_path.rstrip('/'):
        return None
    return normalized


@app.route('/')
def index():
    return send_from_directory('public', 'index.html')


@app.route('/api/save-config', methods=['POST'])
def save_config():
    """Save a Caddyfile configuration to disk."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    hostname = data.get('hostname', '').strip()
    config_content = data.get('config', '').strip()

    if not hostname or not config_content:
        return jsonify({'error': 'Hostname and config content are required'}), 400

    # Sanitize hostname for filename
    safe_hostname = hostname.replace('*', '_wildcard_').replace(':', '_').replace('/', '_').replace('\\', '_').replace('..', '_')
    filename = f"{safe_hostname}.caddy"
    filepath = os.path.join(CONFIGS_DIR, filename)

    # Path containment check
    if not os.path.realpath(filepath).startswith(os.path.realpath(CONFIGS_DIR)):
        return jsonify({'error': 'Invalid hostname'}), 400

    # Backup old version if it exists
    if os.path.exists(filepath):
        history_dir = os.path.join(CONFIGS_DIR, 'history')
        os.makedirs(history_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
        backup_name = f"{filename}.{timestamp}.bak"
        shutil.copy2(filepath, os.path.join(history_dir, backup_name))

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(config_content)

    return jsonify({'success': True, 'filename': filename, 'path': filepath})


@app.route('/api/config-history/<path:filename>', methods=['GET'])
def config_history(filename):
    """Get version history for a specific config file."""
    if not filename.endswith('.caddy'):
        return jsonify({'error': 'Invalid filename'}), 400

    history_dir = os.path.join(CONFIGS_DIR, 'history')
    if not os.path.exists(history_dir):
        return jsonify({'versions': []})

    versions = []
    prefix = filename + '.'
    for f in sorted(os.listdir(history_dir), reverse=True):
        if f.startswith(prefix) and f.endswith('.bak'):
            timestamp_str = f[len(prefix):-4]  # Remove prefix and .bak
            filepath = os.path.join(history_dir, f)
            stat = os.stat(filepath)
            versions.append({
                'filename': f,
                'timestamp': timestamp_str,
                'size': stat.st_size,
            })

    return jsonify({'versions': versions[:20]})  # Last 20 versions


@app.route('/api/config-history-content/<path:filename>', methods=['GET'])
def config_history_content(filename):
    """Get content of a historical config version."""
    if not filename.endswith('.bak'):
        return jsonify({'error': 'Invalid filename'}), 400
    history_dir = os.path.join(CONFIGS_DIR, 'history')
    filepath = os.path.join(history_dir, filename)
    # Path containment check
    if not os.path.realpath(filepath).startswith(os.path.realpath(history_dir)):
        return jsonify({'error': 'Invalid filename'}), 400
    if not os.path.exists(filepath):
        return jsonify({'error': 'Not found'}), 404
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    return jsonify({'content': content, 'filename': filename})


@app.route('/api/list-configs', methods=['GET'])
def list_configs():
    """List saved configuration files."""
    files = []
    for f in os.listdir(CONFIGS_DIR):
        if f.endswith('.caddy'):
            filepath = os.path.join(CONFIGS_DIR, f)
            stat = os.stat(filepath)
            files.append({
                'filename': f,
                'size': stat.st_size,
                'modified': datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
    return jsonify({'configs': files})


@app.route('/api/download-config/<filename>', methods=['GET'])
def download_config(filename):
    """Download a saved configuration file."""
    if not filename.endswith('.caddy'):
        return jsonify({'error': 'Invalid filename'}), 400
    filepath = os.path.join(CONFIGS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    return send_file(filepath, as_attachment=True, download_name=filename)


@app.route('/api/generate-ca', methods=['POST'])
def generate_ca():
    """Generate a CA certificate for client certificate authentication."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    cn = data.get('cn', 'CaddyConfer CA')
    org = data.get('org', 'CaddyConfer')
    validity_days = int(data.get('validity_days', 3650))

    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=4096,
        backend=default_backend()
    )

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, org),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=validity_days))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, key_cert_sign=True, crl_sign=True,
                content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False,
                encipher_only=False, decipher_only=False
            ),
            critical=True
        )
        .sign(key, hashes.SHA256(), default_backend())
    )

    ca_name = cn.replace(' ', '_').lower()
    cert_path = os.path.join(CERTS_DIR, f"{ca_name}_ca.crt")
    key_path = os.path.join(CERTS_DIR, f"{ca_name}_ca.key")

    with open(cert_path, 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    with open(key_path, 'wb') as f:
        f.write(key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption()
        ))

    return jsonify({
        'success': True,
        'ca_cert': cert_path,
        'ca_key': key_path,
        'ca_cert_pem': cert.public_bytes(serialization.Encoding.PEM).decode(),
        'fingerprint': cert.fingerprint(hashes.SHA256()).hex(':')
    })


@app.route('/api/generate-client-cert', methods=['POST'])
def generate_client_cert():
    """Generate a client certificate signed by a CA."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    cn = data.get('cn', 'Client')
    org = data.get('org', 'CaddyConfer')
    validity_days = int(data.get('validity_days', 365))
    ca_cert_path = data.get('ca_cert_path', '')
    ca_key_path = data.get('ca_key_path', '')

    if not ca_cert_path or not ca_key_path:
        return jsonify({'error': 'CA certificate and key paths are required'}), 400

    if not os.path.exists(ca_cert_path) or not os.path.exists(ca_key_path):
        return jsonify({'error': 'CA certificate or key file not found'}), 404

    # Load CA
    with open(ca_cert_path, 'rb') as f:
        ca_cert = x509.load_pem_x509_certificate(f.read(), default_backend())
    with open(ca_key_path, 'rb') as f:
        ca_key = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())

    # Generate client key
    client_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )

    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, org),
    ])

    client_cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(client_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=validity_days))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, content_commitment=False,
                key_encipherment=True, data_encipherment=False,
                key_agreement=False, key_cert_sign=False,
                crl_sign=False, encipher_only=False, decipher_only=False
            ),
            critical=True
        )
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]),
            critical=False
        )
        .sign(ca_key, hashes.SHA256(), default_backend())
    )

    client_name = cn.replace(' ', '_').lower()
    cert_path = os.path.join(CERTS_DIR, f"{client_name}_client.crt")
    key_path = os.path.join(CERTS_DIR, f"{client_name}_client.key")

    with open(cert_path, 'wb') as f:
        f.write(client_cert.public_bytes(serialization.Encoding.PEM))

    with open(key_path, 'wb') as f:
        f.write(client_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption()
        ))

    # Also create PFX/PKCS12
    pfx_path = os.path.join(CERTS_DIR, f"{client_name}_client.pfx")
    pfx_data = pkcs12.serialize_key_and_certificates(
        name=cn.encode(),
        key=client_key,
        cert=client_cert,
        cas=[ca_cert],
        encryption_algorithm=serialization.NoEncryption()
    )
    with open(pfx_path, 'wb') as f:
        f.write(pfx_data)

    return jsonify({
        'success': True,
        'client_cert': cert_path,
        'client_key': key_path,
        'client_pfx': pfx_path,
        'client_cert_pem': client_cert.public_bytes(serialization.Encoding.PEM).decode(),
        'fingerprint': client_cert.fingerprint(hashes.SHA256()).hex(':')
    })


@app.route('/api/list-certs', methods=['GET'])
def list_certs():
    """List generated certificates."""
    files = []
    for f in sorted(os.listdir(CERTS_DIR)):
        filepath = os.path.join(CERTS_DIR, f)
        stat = os.stat(filepath)
        files.append({
            'filename': f,
            'size': stat.st_size,
            'modified': datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    return jsonify({'certs': files})


@app.route('/api/download-cert/<filename>', methods=['GET'])
def download_cert(filename):
    """Download a certificate file."""
    safe_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-')
    if not all(c in safe_chars for c in filename):
        return jsonify({'error': 'Invalid filename'}), 400
    filepath = os.path.join(CERTS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    return send_file(filepath, as_attachment=True, download_name=filename)


# ============================================================
# Caddy version check (periodic, cached)
# ============================================================
_caddy_version_cache = {'version': None, 'checked_at': None, 'url': None, 'doc_updates': []}

@app.route('/api/caddy-version', methods=['GET'])
def caddy_version():
    """Check latest Caddy version from GitHub releases API."""
    import urllib.request
    import time

    global _caddy_version_cache

    # Cache for 30 minutes
    if (_caddy_version_cache['checked_at'] and
            time.time() - _caddy_version_cache['checked_at'] < 1800):
        return jsonify({
            'latest_version': _caddy_version_cache['version'],
            'release_notes_url': _caddy_version_cache['url'],
            'checked_at': datetime.datetime.fromtimestamp(
                _caddy_version_cache['checked_at']).isoformat(),
            'doc_updates': _caddy_version_cache['doc_updates'],
            'cached': True
        })

    try:
        req = urllib.request.Request(
            'https://api.github.com/repos/caddyserver/caddy/releases/latest',
            headers={'User-Agent': 'CaddyConfer/1.1', 'Accept': 'application/vnd.github+json'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            version = data.get('tag_name', '').lstrip('v')
            html_url = data.get('html_url', '')

            _caddy_version_cache['version'] = version
            _caddy_version_cache['url'] = html_url
            _caddy_version_cache['checked_at'] = time.time()

            # Check documentation repo for recent changes
            doc_updates = []
            try:
                doc_req = urllib.request.Request(
                    'https://api.github.com/repos/caddyserver/website/commits?per_page=5',
                    headers={'User-Agent': 'CaddyConfer/1.1', 'Accept': 'application/vnd.github+json'}
                )
                with urllib.request.urlopen(doc_req, timeout=10) as doc_resp:
                    commits = json.loads(doc_resp.read().decode())
                    for c in commits:
                        msg = c.get('commit', {}).get('message', '')
                        date = c.get('commit', {}).get('committer', {}).get('date', '')
                        if msg and date:
                            doc_updates.append({'message': msg.split('\n')[0], 'date': date})
            except Exception:
                pass

            _caddy_version_cache['doc_updates'] = doc_updates

            return jsonify({
                'latest_version': version,
                'release_notes_url': html_url,
                'checked_at': datetime.datetime.fromtimestamp(
                    _caddy_version_cache['checked_at']).isoformat(),
                'doc_updates': doc_updates,
                'cached': False
            })
    except Exception as e:
        return jsonify({
            'latest_version': _caddy_version_cache.get('version'),
            'error': str(e),
            'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'doc_updates': []
        })


@app.route('/api/read-config/<filename>', methods=['GET'])
def read_config(filename):
    """Read a saved configuration file's content."""
    if not filename.endswith('.caddy'):
        return jsonify({'error': 'Invalid filename'}), 400
    filepath = os.path.join(CONFIGS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    return jsonify({'filename': filename, 'content': content})


@app.route('/api/hash-password', methods=['POST'])
def hash_password():
    """Hash a plaintext password with bcrypt for use in Caddy basicauth."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    password = data.get('password', '')
    if not password:
        return jsonify({'error': 'No password provided'}), 400
    if len(password) > 72:
        return jsonify({'error': 'Password too long (max 72 characters for bcrypt)'}), 400
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=14))
    return jsonify({'hash': hashed.decode('utf-8')})


@app.route('/api/git-push', methods=['POST'])
def git_push():
    """Push configuration files to a git remote."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    remote_url = data.get('remote_url', '').strip()
    branch = data.get('branch', 'main').strip() or 'main'
    commit_message = data.get('commit_message', 'Update Caddy configuration').strip() or 'Update Caddy configuration'
    files = data.get('files', [])

    # Validate file list
    if files:
        safe_pattern = re.compile(r'^[a-zA-Z0-9._-]+$')
        for f in files:
            if not safe_pattern.match(f):
                return jsonify({'success': False, 'error': f'Invalid filename in files list: {f}'}), 400

    if not remote_url:
        return jsonify({'success': False, 'error': 'Remote URL is required'}), 400

    try:
        output_lines = []

        # git init if not already a repo
        if not os.path.isdir(os.path.join(CONFIGS_DIR, '.git')):
            r = subprocess.run(['git', 'init'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=30)
            output_lines.append(r.stdout + r.stderr)

        # Set remote
        r = subprocess.run(['git', 'remote', 'get-url', 'origin'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            r = subprocess.run(['git', 'remote', 'set-url', 'origin', remote_url], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=10)
        else:
            r = subprocess.run(['git', 'remote', 'add', 'origin', remote_url], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=10)
        output_lines.append(r.stdout + r.stderr)

        # git add
        if files:
            r = subprocess.run(['git', 'add'] + files, cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=30)
        else:
            r = subprocess.run(['git', 'add', '*.caddy'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=30)
            if r.returncode != 0:
                r = subprocess.run(['git', 'add', '.'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=30)
        output_lines.append(r.stdout + r.stderr)

        # git commit
        r = subprocess.run(['git', 'commit', '-m', commit_message, '--allow-empty'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=30)
        output_lines.append(r.stdout + r.stderr)

        # git push
        r = subprocess.run(['git', 'push', '-u', 'origin', branch], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=60)
        output_lines.append(r.stdout + r.stderr)

        if r.returncode != 0:
            return jsonify({'success': False, 'error': r.stderr or r.stdout, 'output': '\n'.join(output_lines)})

        return jsonify({'success': True, 'output': '\n'.join(output_lines)})

    except subprocess.TimeoutExpired:
        return jsonify({'success': False, 'error': 'Git command timed out'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/git-status', methods=['GET'])
def git_status():
    """Check git status of the configs directory."""
    result = {
        'is_repo': False,
        'remote_url': None,
        'branch': None,
        'status': ''
    }

    if not os.path.isdir(os.path.join(CONFIGS_DIR, '.git')):
        return jsonify(result)

    result['is_repo'] = True

    try:
        r = subprocess.run(['git', 'remote', 'get-url', 'origin'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            result['remote_url'] = r.stdout.strip()
    except Exception:
        pass

    try:
        r = subprocess.run(['git', 'branch', '--show-current'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            result['branch'] = r.stdout.strip()
    except Exception:
        pass

    try:
        r = subprocess.run(['git', 'status', '--short'], cwd=CONFIGS_DIR, capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            result['status'] = r.stdout.strip()
    except Exception:
        pass

    return jsonify(result)


@app.route('/api/release-notes', methods=['GET'])
def release_notes():
    """Return release notes content."""
    notes_path = os.path.join(BASE_DIR, 'RELEASE_NOTES.md')
    if not os.path.exists(notes_path):
        return jsonify({'error': 'Release notes not found'}), 404
    with open(notes_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return jsonify({'content': content})


# ============================================================
# SSH / SFTP endpoints
# ============================================================

@app.route('/api/ssh/connect', methods=['POST'])
def ssh_connect():
    """Connect to a remote server via SSH and open an SFTP channel."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    host = data.get('host', '').strip()
    port = int(data.get('port', 22))
    username = data.get('username', '').strip()
    auth_type = data.get('auth_type', 'password')
    password = data.get('password', '')
    private_key_str = data.get('private_key', '')
    key_passphrase = data.get('key_passphrase', '') or None
    remote_path = data.get('remote_path', '/etc/caddy/conf.d').strip()

    if not host or not username:
        return jsonify({'error': 'Host and username are required'}), 400

    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.WarningPolicy())

        if auth_type == 'key' and private_key_str:
            key_file = io.StringIO(private_key_str)
            try:
                pkey = paramiko.RSAKey.from_private_key(key_file, password=key_passphrase)
            except paramiko.ssh_exception.SSHException:
                key_file.seek(0)
                try:
                    pkey = paramiko.Ed25519Key.from_private_key(key_file, password=key_passphrase)
                except:
                    key_file.seek(0)
                    pkey = paramiko.ECDSAKey.from_private_key(key_file, password=key_passphrase)
            ssh.connect(host, port=port, username=username, pkey=pkey, timeout=10)
        else:
            ssh.connect(host, port=port, username=username, password=password, timeout=10)

        sftp = ssh.open_sftp()

        # Get host key fingerprint for display
        transport = ssh.get_transport()
        host_key = transport.get_remote_server_key()
        fingerprint = ':'.join(f'{b:02x}' for b in host_key.get_fingerprint())
        key_type = host_key.get_name()

        # Verify remote path exists
        try:
            sftp.stat(remote_path)
        except FileNotFoundError:
            ssh.close()
            return jsonify({'error': f'Remote path not found: {remote_path}'}), 400

        session_id = secrets.token_hex(16)
        _ssh_sessions[session_id] = {
            'ssh': ssh,
            'sftp': sftp,
            'host': host,
            'username': username,
            'remote_path': remote_path,
            'connected_at': time.time()
        }

        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': f'Connected to {host} as {username}',
            'host_fingerprint': fingerprint,
            'host_key_type': key_type
        })
    except paramiko.AuthenticationException:
        return jsonify({'error': 'Authentication failed. Check username and password/key.'}), 401
    except paramiko.SSHException as e:
        return jsonify({'error': f'SSH error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Connection failed: {str(e)}'}), 500


@app.route('/api/ssh/disconnect', methods=['POST'])
def ssh_disconnect():
    """Disconnect an active SSH session."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    session_id = data.get('session_id', '')

    session = _ssh_sessions.pop(session_id, None)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    try:
        session['sftp'].close()
        session['ssh'].close()
    except:
        pass

    return jsonify({'success': True, 'message': 'Disconnected'})


@app.route('/api/ssh/list-files', methods=['POST'])
def ssh_list_files():
    """List .caddy and .conf files in the remote path."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    session_id = data.get('session_id', '')

    session, err = _get_ssh_session(session_id)
    if err:
        return err

    try:
        sftp = session['sftp']
        remote_path = session['remote_path']
        files = []
        for attr in sftp.listdir_attr(remote_path):
            if attr.filename.endswith('.caddy') or attr.filename.endswith('.conf'):
                files.append({
                    'filename': attr.filename,
                    'size': attr.st_size,
                    'modified': datetime.datetime.fromtimestamp(attr.st_mtime).isoformat()
                })
        return jsonify({'files': files, 'remote_path': remote_path})
    except Exception as e:
        return jsonify({'error': f'Failed to list files: {str(e)}'}), 500


@app.route('/api/ssh/download-file', methods=['POST'])
def ssh_download_file():
    """Download a file from the remote server via SFTP."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    session_id = data.get('session_id', '')
    filename = data.get('filename', '').strip()

    if not filename:
        return jsonify({'error': 'Filename is required'}), 400

    session, err = _get_ssh_session(session_id)
    if err:
        return err

    try:
        sftp = session['sftp']
        remote_file = _validate_remote_filename(session['remote_path'], filename)
        if not remote_file:
            return jsonify({'error': 'Invalid filename'}), 400
        with sftp.open(remote_file, 'r') as f:
            content = f.read().decode('utf-8')
        return jsonify({'filename': filename, 'content': content})
    except Exception as e:
        return jsonify({'error': f'Failed to download file: {str(e)}'}), 500


@app.route('/api/ssh/upload-file', methods=['POST'])
def ssh_upload_file():
    """Upload a file to the remote server via SFTP."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    session_id = data.get('session_id', '')
    filename = data.get('filename', '').strip()
    content = data.get('content', '')

    if not filename:
        return jsonify({'error': 'Filename is required'}), 400

    session, err = _get_ssh_session(session_id)
    if err:
        return err

    try:
        sftp = session['sftp']
        remote_file = _validate_remote_filename(session['remote_path'], filename)
        if not remote_file:
            return jsonify({'error': 'Invalid filename'}), 400
        with sftp.open(remote_file, 'w') as f:
            f.write(content)
        return jsonify({'success': True, 'message': f'Uploaded {filename}', 'remote_file': remote_file})
    except Exception as e:
        return jsonify({'error': f'Failed to upload file: {str(e)}'}), 500


@app.route('/api/ssh/validate-config', methods=['POST'])
def ssh_validate_config():
    """Run caddy validate on the remote server via SSH."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    session_id = data.get('session_id', '')

    session, err = _get_ssh_session(session_id)
    if err:
        return err

    try:
        ssh = session['ssh']
        stdin, stdout, stderr = ssh.exec_command('caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile', timeout=15)
        exit_code = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8') + stderr.read().decode('utf-8')
        return jsonify({'valid': exit_code == 0, 'output': output.strip()})
    except Exception as e:
        return jsonify({'error': f'Validation failed: {str(e)}'}), 500


@app.route('/api/ssh/reload-caddy', methods=['POST'])
def ssh_reload_caddy():
    """Reload Caddy on the remote server via SSH."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    session_id = data.get('session_id', '')

    session, err = _get_ssh_session(session_id)
    if err:
        return err

    try:
        ssh = session['ssh']
        stdin, stdout, stderr = ssh.exec_command('systemctl reload caddy', timeout=15)
        exit_code = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8') + stderr.read().decode('utf-8')
        return jsonify({'success': exit_code == 0, 'output': output.strip()})
    except Exception as e:
        return jsonify({'error': f'Reload failed: {str(e)}'}), 500


if __name__ == '__main__':
    import os
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    print("=" * 60)
    print("  CaddyConfer - Caddy Reverse Proxy Configuration UI")
    print("  http://localhost:5555")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5555, debug=debug_mode)
