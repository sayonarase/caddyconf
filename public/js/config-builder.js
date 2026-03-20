/**
 * CaddyConfer – Configuration Builder
 * Generates valid Caddyfile syntax from the form state.
 */

class ConfigBuilder {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Main entry: build the entire Caddyfile from current form state.
     * Returns { config: string, errors: [], warnings: [] }
     */
    build() {
        this.errors = [];
        this.warnings = [];

        const hostname = this.val('hostname');
        if (!hostname) {
            this.errors.push(t('validation.hostname_required'));
            return { config: '', errors: this.errors, warnings: this.warnings };
        }

        // Validate hostname
        if (!this.isValidHostname(hostname)) {
            this.errors.push(t('validation.invalid_hostname_format'));
        }

        // Hostname FQDN format warning
        if (hostname) {
            const fqdnRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
            if (!fqdnRegex.test(hostname) && !hostname.includes(':') && hostname !== 'localhost') {
                this.warnings.push(t('validation.invalid_fqdn'));
            }
        }

        // Validate upstream addresses
        const upstreams = this.getUpstreams();
        upstreams.forEach(u => {
            if (u && !u.match(/^[a-zA-Z0-9._-]+(:\d{1,5})?$/) && !u.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?$/)) {
                this.warnings.push(t('validation.invalid_upstream') + ': ' + u);
            }
            const portMatch = u.match(/:(\d+)$/);
            if (portMatch) {
                const port = parseInt(portMatch[1]);
                if (port < 1 || port > 65535) {
                    this.errors.push(t('validation.invalid_port') + ': ' + u);
                }
            }
        });

        // Validate global option ports
        const httpPort = this.val('httpPort');
        const httpsPort = this.val('httpsPort');
        if (httpPort && (isNaN(httpPort) || parseInt(httpPort) < 1 || parseInt(httpPort) > 65535)) {
            this.errors.push(t('validation.invalid_http_port'));
        }
        if (httpsPort && (isNaN(httpsPort) || parseInt(httpsPort) < 1 || parseInt(httpsPort) > 65535)) {
            this.errors.push(t('validation.invalid_https_port'));
        }

        const parts = [];

        // Global options block
        const globalOpts = this.buildGlobalOptions();
        if (globalOpts) {
            parts.push(globalOpts);
            parts.push('');
        }

        // Site block
        const siteBlock = this.buildSiteBlock(hostname);
        parts.push(siteBlock);

        const config = parts.join('\n');
        return { config, errors: this.errors, warnings: this.warnings };
    }

    /**
     * Build the global options block { ... }
     */
    buildGlobalOptions() {
        const lines = [];
        const email = this.val('adminEmail');
        const httpPort = this.val('httpPort');
        const httpsPort = this.val('httpsPort');
        const autoHttps = this.checked('autoHttps');
        const gracePeriod = this.val('gracePeriod');
        const tlsMode = this.val('tlsMode');
        const zerosslApiKey = this.val('zerosslApiKey');
        const zerosslMacKey = this.val('zerosslMacKey');

        // Timeouts
        const readTimeout = this.val('timeoutRead');
        const writeTimeout = this.val('timeoutWrite');
        const idleTimeout = this.val('timeoutIdle');

        if (email) lines.push(`\temail ${email}`);
        if (httpPort && httpPort !== '80') lines.push(`\thttp_port ${httpPort}`);
        if (httpsPort && httpsPort !== '443') lines.push(`\thttps_port ${httpsPort}`);
        if (!autoHttps) lines.push(`\tauto_https off`);
        if (gracePeriod) lines.push(`\tgrace_period ${gracePeriod}`);

        // ZeroSSL API key in global options
        if (tlsMode === 'zerossl_api' && zerosslApiKey) {
            lines.push('');
            lines.push('\tacme_ca https://acme.zerossl.com/v2/DV90');
            lines.push(`\tacme_eab {`);
            lines.push(`\t\tkey_id  ${zerosslApiKey}`);
            lines.push(`\t\tmac_key ${zerosslMacKey || zerosslApiKey}`);
            lines.push(`\t}`);
        }

        // ZeroSSL with Let's Encrypt fallback in global options
        if (tlsMode === 'zerossl_fallback' && zerosslApiKey) {
            lines.push('');
            lines.push('\t# Primary: ZeroSSL');
            lines.push('\tacme_issuer zerossl {');
            lines.push(`\t\teab {`);
            lines.push(`\t\t\tkey_id  ${zerosslApiKey}`);
            lines.push(`\t\t\tmac_key ${zerosslMacKey || zerosslApiKey}`);
            lines.push(`\t\t}`);
            lines.push('\t}');
            lines.push('\t# Fallback: Let\'s Encrypt');
            lines.push('\tacme_issuer letsencrypt');
        }

        // Server options (timeouts + trusted_proxies)
        const timeoutLines = [];
        if (readTimeout) timeoutLines.push(`\t\t\tread_timeout ${readTimeout}`);
        if (writeTimeout) timeoutLines.push(`\t\t\twrite_timeout ${writeTimeout}`);
        if (idleTimeout) timeoutLines.push(`\t\t\tidle_timeout ${idleTimeout}`);

        // Trusted proxies (global - Feature 4)
        const globalTrustedProxies = this.getGlobalTrustedProxies();

        const hasServerBlock = timeoutLines.length > 0 || globalTrustedProxies;

        if (hasServerBlock) {
            lines.push('');
            lines.push('\tservers {');
            if (timeoutLines.length > 0) {
                lines.push('\t\ttimeouts {');
                timeoutLines.forEach(l => lines.push(l));
                lines.push('\t\t}');
            }
            if (globalTrustedProxies) {
                lines.push(`\t\ttrusted_proxies static ${globalTrustedProxies}`);
            }
            lines.push('\t}');
        }

        if (lines.length === 0) return '';

        return '{\n' + lines.join('\n') + '\n}';
    }

    /**
     * Get trusted proxies IP ranges for global config (Feature 4)
     */
    getGlobalTrustedProxies() {
        if (!this.checked('enableGlobalTrustedProxies')) return '';
        const preset = this.val('globalTrustedProxiesPreset');
        if (preset === 'private') {
            return '10.0.0.0/8 172.16.0.0/12 192.168.0.0/16';
        } else if (preset === 'cloudflare') {
            return '173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22';
        } else if (preset === 'custom') {
            const custom = this.val('globalTrustedProxiesCustomInput');
            if (custom) {
                return custom.split(',').map(s => s.trim()).filter(s => s).join(' ');
            }
        }
        return '';
    }

    /**
     * Build the site block: hostname { ... }
     */
    buildSiteBlock(hostname) {
        const directives = [];

        // TLS
        const tlsBlock = this.buildTlsBlock();
        if (tlsBlock) directives.push(tlsBlock);

        // Logging
        const logBlock = this.buildLogBlock(hostname);
        if (logBlock) directives.push(logBlock);

        // Encoding
        const encodeBlock = this.buildEncodeBlock();
        if (encodeBlock) directives.push(encodeBlock);

        // Headers
        const headerBlock = this.buildHeaderBlock();
        if (headerBlock) directives.push(headerBlock);

        // CORS headers
        const corsBlock = this.buildCorsBlock();
        if (corsBlock) directives.push(corsBlock);

        // Redirects (Feature 1)
        const redirectBlock = this.buildRedirectBlock();
        if (redirectBlock) directives.push(redirectBlock);

        // Request body max size
        const requestBody = this.buildRequestBodyBlock();
        if (requestBody) directives.push(requestBody);

        // Basic Auth
        const basicAuth = this.buildBasicAuthBlock();
        if (basicAuth) directives.push(basicAuth);

        // IP access control + reverse proxy
        const ipAccess = this.checked('enableIpAccess');
        const allowedIps = this.val('allowedIps');
        const ipMode = this.val('ipAccessMode');
        const ipDenyMessage = this.val('ipDenyMessage') || 'Access denied';
        const ipDenyStatus = this.val('ipDenyStatusCode') || '403';

        // Keycloak / forward_auth
        const forwardAuthBlock = this.buildForwardAuthBlock();
        if (forwardAuthBlock) directives.push(forwardAuthBlock);

        // Path-based routing (handle/handle_path blocks before main reverse_proxy)
        const pathRoutingBlock = this.buildPathRoutingBlock();
        if (pathRoutingBlock) directives.push(pathRoutingBlock);

        const proxyBlock = this.buildReverseProxyBlock();

        if (ipAccess && allowedIps) {
            const ips = allowedIps.split('\n').map(ip => ip.trim()).filter(ip => ip);
            if (ips.length > 0) {
                if (ipMode === 'blacklist') {
                    // Blacklist: block these IPs
                    directives.push(`\t@blocked remote_ip ${ips.join(' ')}`);
                    directives.push(`\trespond @blocked "${ipDenyMessage}" ${ipDenyStatus}`);
                    if (proxyBlock) {
                        directives.push('');
                        directives.push(proxyBlock);
                    }
                } else {
                    // Whitelist: allow only these IPs
                    directives.push(`\t@allowed remote_ip ${ips.join(' ')}`);
                    if (proxyBlock) {
                        const handleProxy = proxyBlock.replace(/^\t/gm, '\t\t');
                        directives.push(`\thandle @allowed {`);
                        directives.push(handleProxy);
                        directives.push(`\t}`);
                    }
                    directives.push('');
                    directives.push(`\trespond "${ipDenyMessage}" ${ipDenyStatus}`);
                }
            } else {
                if (proxyBlock) directives.push(proxyBlock);
            }
        } else {
            if (proxyBlock) directives.push(proxyBlock);
        }

        // Error pages (Feature 2) - after proxy block
        const errorPagesBlock = this.buildErrorPagesBlock();
        if (errorPagesBlock) directives.push(errorPagesBlock);

        if (directives.length === 0) {
            this.warnings.push(t('validation.no_site_config'));
        }

        const body = directives.join('\n\n');
        return `${hostname} {\n${body}\n}`;
    }

    /**
     * Build the tls directive
     */
    buildTlsBlock() {
        const mode = this.val('tlsMode');
        const minVersion = this.val('tlsMinVersion');
        const cipherSuites = this.selectedValues('tlsCipherSuites');
        const clientAuth = this.checked('enableClientAuth');
        const clientAuthMode = this.val('clientAuthMode');
        const trustedCa = this.val('trustedCaCert');

        // Auto mode with no extras
        if (mode === 'auto' && !minVersion && cipherSuites.length === 0 && !clientAuth) {
            return ''; // Caddy handles it automatically
        }

        const lines = [];

        if (mode === 'cert_key') {
            const cert = this.val('tlsCertPath');
            const key = this.val('tlsKeyPath');
            if (!cert || !key) {
                this.errors.push(t('validation.tls_cert_key_required'));
                return '';
            }
            lines.push(`\ttls ${cert} ${key}`);

            // If there are sub-options, we need a block
            if (minVersion || cipherSuites.length > 0 || clientAuth) {
                // Actually for Caddyfile, tls cert key with sub-directives needs special handling
                // We use tls { cert ... key ... } format instead
                lines.length = 0; // clear
                lines.push('\ttls {');
                lines.push(`\t\tcertificates ${cert} ${key}`);
                if (minVersion) lines.push(`\t\tprotocols ${minVersion}`);
                if (cipherSuites.length > 0) lines.push(`\t\tciphers ${cipherSuites.join(' ')}`);
                if (clientAuth) {
                    lines.push('\t\tclient_auth {');
                    lines.push(`\t\t\tmode ${clientAuthMode}`);
                    if (trustedCa) lines.push(`\t\t\ttrusted_ca_cert_file ${trustedCa}`);
                    lines.push('\t\t}');
                }
                lines.push('\t}');
            }
        } else if (mode === 'internal') {
            if (clientAuth || minVersion || cipherSuites.length > 0) {
                lines.push('\ttls internal {');
                if (minVersion) lines.push(`\t\tprotocols ${minVersion}`);
                if (cipherSuites.length > 0) lines.push(`\t\tciphers ${cipherSuites.join(' ')}`);
                if (clientAuth) {
                    lines.push('\t\tclient_auth {');
                    lines.push(`\t\t\tmode ${clientAuthMode}`);
                    if (trustedCa) lines.push(`\t\t\ttrusted_ca_cert_file ${trustedCa}`);
                    lines.push('\t\t}');
                }
                lines.push('\t}');
            } else {
                lines.push('\ttls internal');
            }
        } else {
            // auto, zerossl_api, or zerossl_fallback – build tls block if needed
            const needsBlock = minVersion || cipherSuites.length > 0 || clientAuth;
            if (needsBlock) {
                lines.push('\ttls {');
                if (minVersion) lines.push(`\t\tprotocols ${minVersion}`);
                if (cipherSuites.length > 0) lines.push(`\t\tciphers ${cipherSuites.join(' ')}`);
                if (clientAuth) {
                    lines.push('\t\tclient_auth {');
                    lines.push(`\t\t\tmode ${clientAuthMode}`);
                    if (trustedCa) lines.push(`\t\t\ttrusted_ca_cert_file ${trustedCa}`);
                    lines.push('\t\t}');
                }
                lines.push('\t}');
            }
        }

        return lines.join('\n');
    }

    /**
     * Build the log directive
     */
    buildLogBlock(hostname) {
        if (!this.checked('enableLogging')) return '';

        const output = this.val('logOutput');
        const format = this.val('logFormat');
        const level = this.val('logLevel');

        const lines = ['\tlog {'];

        if (output === 'file') {
            let filePath = this.val('logFilePath');
            if (!filePath) {
                // Generate default
                filePath = `/var/log/caddy/${hostname.replace(/[^a-zA-Z0-9.-]/g, '_')}.log`;
                this.warnings.push(`Loggsökväg ej angiven – standard: ${filePath}`);
            }
            const rollSize = this.val('logRollSize');
            const rollKeep = this.val('logRollKeep');
            const rollKeepFor = this.val('logRollKeepFor');
            const localTime = this.checked('logRollLocalTime');

            lines.push(`\t\toutput file ${filePath} {`);
            if (rollSize) lines.push(`\t\t\troll_size ${rollSize}`);
            if (rollKeep) lines.push(`\t\t\troll_keep ${rollKeep}`);
            if (rollKeepFor) lines.push(`\t\t\troll_keep_for ${rollKeepFor}`);
            if (localTime) lines.push(`\t\t\troll_local_time`);
            lines.push('\t\t}');
        } else {
            lines.push(`\t\toutput ${output}`);
        }

        if (format) lines.push(`\t\tformat ${format}`);
        if (level && level !== 'INFO') lines.push(`\t\tlevel ${level}`);

        lines.push('\t}');
        return lines.join('\n');
    }

    /**
     * Build the encode directive
     */
    buildEncodeBlock() {
        if (!this.checked('enableEncode')) return '';

        const zstd = this.checked('encodeZstd');
        const gzip = this.checked('encodeGzip');
        const minLength = this.val('encodeMinLength');

        if (!zstd && !gzip) {
            this.warnings.push(t('validation.compression_no_method'));
            return '';
        }

        const methods = [];
        if (zstd) methods.push('zstd');
        if (gzip) methods.push('gzip');

        if (minLength) {
            const lines = ['\tencode {'];
            methods.forEach(m => lines.push(`\t\t${m}`));
            lines.push(`\t\tminimum_length ${minLength}`);
            lines.push('\t}');
            return lines.join('\n');
        }

        return `\tencode ${methods.join(' ')}`;
    }

    /**
     * Build the header directive
     */
    buildHeaderBlock() {
        const headerLines = [];

        // Security headers
        if (this.checked('headerHSTS')) {
            headerLines.push(`\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains; preload"`);
        }
        if (this.checked('headerXFrameOptions')) {
            const val = this.val('headerXFrameOptionsValue');
            headerLines.push(`\t\tX-Frame-Options "${val}"`);
        }
        if (this.checked('headerXContentType')) {
            headerLines.push(`\t\tX-Content-Type-Options "nosniff"`);
        }
        if (this.checked('headerReferrerPolicy')) {
            const val = this.val('headerReferrerPolicyValue');
            headerLines.push(`\t\tReferrer-Policy "${val}"`);
        }
        if (this.checked('headerCSP')) {
            const val = window.buildCspValue ? window.buildCspValue() : '';
            if (val) headerLines.push(`\t\tContent-Security-Policy "${val}"`);
        }
        if (this.checked('headerPermissionsPolicy')) {
            const val = window.buildPpValue ? window.buildPpValue() : '';
            if (val) headerLines.push(`\t\tPermissions-Policy "${val}"`);
        }
        if (this.checked('headerRemoveServer')) {
            headerLines.push(`\t\t-Server`);
        }

        // Custom headers (dropdown-based)
        const customRows = document.querySelectorAll('#customHeaders .custom-header-row');
        customRows.forEach(row => {
            const action = row.querySelector('.header-action-select').value;
            const nameSelect = row.querySelector('.header-name-select');
            const customNameInput = row.querySelector('.header-custom-name');
            const name = (nameSelect && nameSelect.value === 'custom')
                ? (customNameInput ? customNameInput.value.trim() : '')
                : (nameSelect ? nameSelect.value : '');
            const value = row.querySelector('.header-value-input').value.trim();
            if (name) {
                if (action === 'delete') {
                    headerLines.push(`\t\t-${name}`);
                } else if (action === 'add') {
                    headerLines.push(`\t\t+${name} "${value}"`);
                } else if (action === 'defer') {
                    headerLines.push(`\t\tdefer`);
                    headerLines.push(`\t\t${name} "${value}"`);
                } else {
                    headerLines.push(`\t\t${name} "${value}"`);
                }
            }
        });

        if (headerLines.length === 0) return '';

        return '\theader {\n' + headerLines.join('\n') + '\n\t}';
    }

    /**
     * Build request_body block
     */
    buildRequestBodyBlock() {
        const maxSize = this.val('requestBodyMaxSize');
        if (!maxSize) return '';
        return `\trequest_body {\n\t\tmax_size ${maxSize}\n\t}`;
    }

    /**
     * Build basicauth block
     */
    buildBasicAuthBlock() {
        if (!this.checked('enableBasicAuth')) return '';
        const t = window.t;

        const rows = document.querySelectorAll('#basicAuthUsers .basic-auth-row');
        const users = [];
        let hasUnhashed = false;
        rows.forEach(row => {
            const username = (row.querySelector('.basic-auth-username') || {}).value?.trim();
            const hash = (row.querySelector('.basic-auth-hash') || {}).value?.trim();
            const password = (row.querySelector('.basic-auth-password') || {}).value?.trim();
            if (username && hash) {
                users.push({ username, hash });
            } else if (username && password && !hash) {
                hasUnhashed = true;
            }
        });

        if (hasUnhashed) {
            this.warnings.push(t('rec.basic_auth_unhashed_warning'));
        }

        if (users.length === 0) {
            this.warnings.push(t('rec.basic_auth_no_users'));
            return '';
        }

        const lines = ['\tbasicauth {'];
        users.forEach(u => {
            lines.push(`\t\t${u.username} ${u.hash}`);
        });
        lines.push('\t}');
        return lines.join('\n');
    }

    /**
     * Build forward_auth block for Keycloak
     */
    buildForwardAuthBlock() {
        if (!this.checked('enableKeycloak')) return '';

        const keycloakUrl = this.val('keycloakUrl');
        const keycloakUri = this.val('keycloakUri');

        if (!keycloakUrl) {
            this.errors.push(t('validation.keycloak_no_endpoint'));
            return '';
        }

        const lines = [`\tforward_auth ${keycloakUrl} {`];

        if (keycloakUri) {
            lines.push(`\t\turi ${keycloakUri}`);
        }

        // Collect copy_headers
        const copyHeaders = [];
        if (this.checked('kcHeaderRemoteUser')) copyHeaders.push('X-Forwarded-User');
        if (this.checked('kcHeaderRemoteEmail')) copyHeaders.push('X-Forwarded-Email');
        if (this.checked('kcHeaderRemoteGroups')) copyHeaders.push('X-Forwarded-Groups');
        if (this.checked('kcHeaderAuthorization')) copyHeaders.push('Authorization');

        const customHeaders = this.val('keycloakCustomCopyHeaders');
        if (customHeaders) {
            customHeaders.split(',').map(h => h.trim()).filter(h => h).forEach(h => copyHeaders.push(h));
        }

        if (copyHeaders.length > 0) {
            lines.push('\t\tcopy_headers {');
            copyHeaders.forEach(h => lines.push(`\t\t\t${h}`));
            lines.push('\t\t}');
        }

        lines.push('\t}');
        return lines.join('\n');
    }

    /**
     * Build the reverse_proxy directive
     */
    buildReverseProxyBlock() {
        const upstreams = this.getUpstreams();
        if (upstreams.length === 0) {
            this.warnings.push(t('validation.no_upstream'));
            return '';
        }

        // Validate upstream formats
        upstreams.forEach(u => {
            if (u.includes('://')) {
                this.warnings.push(`Backend "${u}" innehåller protokoll (://). Caddy förväntar enbart host:port.`);
            }
        });

        const lines = [];
        const hasSubDirectives = this.hasProxySubDirectives(upstreams.length);

        if (!hasSubDirectives) {
            lines.push(`\treverse_proxy ${upstreams.join(' ')}`);
        } else {
            lines.push(`\treverse_proxy ${upstreams.join(' ')} {`);

            // Load balancing
            if (upstreams.length > 1) {
                const lbPolicy = this.val('lbPolicy');
                if (lbPolicy && lbPolicy !== 'round_robin') {
                    if (lbPolicy === 'cookie') {
                        const cookieName = this.val('lbCookieName') || 'lb';
                        lines.push(`\t\tlb_policy cookie ${cookieName}`);
                    } else if (lbPolicy === 'header') {
                        const headerName = this.val('lbHeaderName');
                        if (headerName) {
                            lines.push(`\t\tlb_policy header ${headerName}`);
                        } else {
                            lines.push(`\t\tlb_policy header`);
                            this.warnings.push(t('validation.lb_header_no_name'));
                        }
                    } else if (lbPolicy === 'random_choose') {
                        const count = this.val('lbRandomChooseCount') || '2';
                        lines.push(`\t\tlb_policy random_choose ${count}`);
                    } else {
                        lines.push(`\t\tlb_policy ${lbPolicy}`);
                    }
                }

                const tryDuration = this.val('lbTryDuration');
                const tryInterval = this.val('lbTryInterval');
                if (tryDuration) lines.push(`\t\tlb_try_duration ${tryDuration}`);
                if (tryInterval) lines.push(`\t\tlb_try_interval ${tryInterval}`);
            }

            // Health checks
            if (this.checked('enableHealthCheck')) {
                const healthUri = this.val('healthUri');
                const healthPort = this.val('healthPort');
                const healthInterval = this.val('healthInterval');
                const healthTimeout = this.val('healthTimeout');
                const healthStatus = this.val('healthStatus');
                const healthBody = this.val('healthBody');

                lines.push('');
                lines.push('\t\t# Aktiv hälsokontroll');
                if (healthUri) lines.push(`\t\thealth_uri ${healthUri}`);
                if (healthPort) lines.push(`\t\thealth_port ${healthPort}`);
                if (healthInterval) lines.push(`\t\thealth_interval ${healthInterval}`);
                if (healthTimeout) lines.push(`\t\thealth_timeout ${healthTimeout}`);
                if (healthStatus) lines.push(`\t\thealth_status ${healthStatus}`);
                if (healthBody) lines.push(`\t\thealth_body "${healthBody}"`);
            }

            // Passive health checks
            if (this.checked('enablePassiveHealth')) {
                const failDuration = this.val('passiveFailDuration');
                const maxFails = this.val('passiveMaxFails');
                const unhealthyLatency = this.val('passiveUnhealthyLatency');
                const unhealthyStatus = this.val('passiveUnhealthyStatus');

                lines.push('');
                lines.push('\t\t# Passiv hälsokontroll');
                if (failDuration) lines.push(`\t\tfail_duration ${failDuration}`);
                if (maxFails) lines.push(`\t\tmax_fails ${maxFails}`);
                if (unhealthyLatency) lines.push(`\t\tunhealthy_latency ${unhealthyLatency}`);
                if (unhealthyStatus) {
                    unhealthyStatus.split(/\s+/).forEach(s => {
                        lines.push(`\t\tunhealthy_status ${s.trim()}`);
                    });
                }
            }

            // Proxy headers
            if (this.checked('proxyHeaderXRealIp')) {
                lines.push('');
                lines.push('\t\theader_up X-Real-IP {remote_host}');
            }

            // Custom header_up (dropdown-based)
            const headerUpRows = document.querySelectorAll('#proxyCustomHeadersUp .proxy-header-row');
            headerUpRows.forEach(row => {
                const nameSelect = row.querySelector('.proxy-header-name-select');
                const customInput = row.querySelector('.proxy-header-custom-name');
                const rawName = nameSelect
                    ? (nameSelect.value === 'custom' ? (customInput ? customInput.value.trim() : '') : nameSelect.value)
                    : '';
                const value = row.querySelector('.proxy-header-value') ? row.querySelector('.proxy-header-value').value.trim() : '';
                if (rawName) {
                    if (rawName.startsWith('-')) {
                        lines.push(`\t\theader_up ${rawName}`);
                    } else if (value) {
                        lines.push(`\t\theader_up ${rawName} "${value}"`);
                    } else {
                        lines.push(`\t\theader_up ${rawName}`);
                    }
                }
            });

            // Custom header_down (dropdown-based)
            const headerDownRows = document.querySelectorAll('#proxyCustomHeadersDown .proxy-header-row');
            headerDownRows.forEach(row => {
                const nameSelect = row.querySelector('.proxy-header-name-select');
                const customInput = row.querySelector('.proxy-header-custom-name');
                const rawName = nameSelect
                    ? (nameSelect.value === 'custom' ? (customInput ? customInput.value.trim() : '') : nameSelect.value)
                    : '';
                const value = row.querySelector('.proxy-header-value') ? row.querySelector('.proxy-header-value').value.trim() : '';
                if (rawName) {
                    if (rawName.startsWith('-')) {
                        lines.push(`\t\theader_down ${rawName}`);
                    } else if (value) {
                        lines.push(`\t\theader_down ${rawName} "${value}"`);
                    } else {
                        lines.push(`\t\theader_down ${rawName}`);
                    }
                }
            });

            // Transport
            if (this.checked('transportTls')) {
                lines.push('');
                lines.push('\t\ttransport http {');
                lines.push('\t\t\ttls');
                if (this.checked('transportTlsInsecure')) {
                    lines.push('\t\t\ttls_insecure_skip_verify');
                }
                const sni = this.val('transportTlsServerName');
                if (sni) lines.push(`\t\t\ttls_server_name ${sni}`);
                const caCert = this.val('transportTlsCaCert');
                if (caCert) lines.push(`\t\t\ttls_trusted_ca_certs ${caCert}`);
                lines.push('\t\t}');
            }

            // Misc
            const flushInterval = this.val('flushInterval');
            if (flushInterval) lines.push(`\t\tflush_interval ${flushInterval}`);

            if (this.checked('bufferRequests')) lines.push('\t\tbuffer_requests');
            if (this.checked('bufferResponses')) lines.push('\t\tbuffer_responses');

            const maxBuffer = this.val('maxBufferSize');
            if (maxBuffer) lines.push(`\t\tmax_buffer_size ${maxBuffer}`);

            // Trusted proxies
            const trustedProxies = this.val('trustedProxies');
            if (trustedProxies) {
                lines.push(`\t\ttrusted_proxies ${trustedProxies}`);
            }

            lines.push('\t}');
        }

        return lines.join('\n');
    }

    /**
     * Build redirect directives (Feature 1)
     */
    buildRedirectBlock() {
        const rows = document.querySelectorAll('#redirectRules .redirect-rule-row');
        const lines = [];
        rows.forEach(row => {
            const from = (row.querySelector('.redirect-from') || {}).value?.trim();
            const to = (row.querySelector('.redirect-to') || {}).value?.trim();
            const status = (row.querySelector('.redirect-status') || {}).value || '301';
            if (from && to) {
                lines.push(`\tredir ${from} ${to} ${status}`);
            }
        });
        return lines.join('\n');
    }

    /**
     * Build handle_errors block (Feature 2)
     */
    buildErrorPagesBlock() {
        if (!this.checked('enableErrorPages')) return '';
        const rows = document.querySelectorAll('#errorPageRules .error-page-row');
        const rules = [];
        rows.forEach(row => {
            const status = (row.querySelector('.error-page-status') || {}).value?.trim();
            const message = (row.querySelector('.error-page-message') || {}).value?.trim();
            if (status && message) {
                rules.push({ status, message });
            }
        });
        if (rules.length === 0) return '';

        const lines = ['\thandle_errors {'];
        rules.forEach(r => {
            lines.push(`\t\t@${r.status} expression {err.status_code} == ${r.status}`);
            lines.push(`\t\trespond @${r.status} "${r.message}" ${r.status}`);
        });
        lines.push('\t}');
        return lines.join('\n');
    }

    /**
     * Check if proxy block needs sub-directives (and thus needs { })
     */
    hasProxySubDirectives(upstreamCount) {
        if (upstreamCount > 1) return true;
        if (this.checked('enableHealthCheck')) return true;
        if (this.checked('enablePassiveHealth')) return true;
        if (this.checked('proxyHeaderXRealIp')) return true;
        if (this.checked('transportTls')) return true;
        if (this.val('flushInterval')) return true;
        if (this.checked('bufferRequests')) return true;
        if (this.checked('bufferResponses')) return true;
        if (this.val('maxBufferSize')) return true;
        if (this.val('trustedProxies')) return true;
        if (document.querySelectorAll('#proxyCustomHeadersUp .proxy-header-row').length > 0) return true;
        if (document.querySelectorAll('#proxyCustomHeadersDown .proxy-header-row').length > 0) return true;
        return false;
    }

    /**
     * Get upstream addresses from the form
     */
    getUpstreams() {
        const inputs = document.querySelectorAll('.upstream-address');
        const upstreams = [];
        inputs.forEach(input => {
            const val = input.value.trim();
            if (val) upstreams.push(val);
        });
        return upstreams;
    }

    // -- Utility methods --

    val(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    checked(id) {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    }

    selectedValues(id) {
        const el = document.getElementById(id);
        if (!el) return [];
        return Array.from(el.selectedOptions).map(o => o.value);
    }

    isValidHostname(hostname) {
        // Allow wildcards, ports, and standard FQDNs
        if (hostname.startsWith(':')) return true; // port-only
        const pattern = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?[a-zA-Z]{2,}(:\d+)?$/;
        return pattern.test(hostname);
    }

    /**
     * Build CORS header directives
     */
    buildCorsBlock() {
        if (!this.checked('enableCors')) return '';

        const lines = [];
        const originMode = this.val('corsOriginMode');

        if (originMode === 'all') {
            lines.push('\theader Access-Control-Allow-Origin "*"');
        } else if (originMode === 'custom') {
            const customOrigins = this.val('corsCustomOrigins');
            if (customOrigins) {
                lines.push(`\theader Access-Control-Allow-Origin "${customOrigins.trim()}"`);
            }
        }
        // 'same' origin = no Access-Control-Allow-Origin header needed

        // Methods
        const methods = [];
        document.querySelectorAll('.cors-method-checkbox:checked').forEach(cb => {
            methods.push(cb.value);
        });
        if (methods.length > 0) {
            lines.push(`\theader Access-Control-Allow-Methods "${methods.join(', ')}"`);
        }

        // Headers
        const allowHeaders = this.val('corsAllowHeaders');
        if (allowHeaders) {
            lines.push(`\theader Access-Control-Allow-Headers "${allowHeaders.trim()}"`);
        }

        // Credentials
        if (this.checked('corsAllowCredentials')) {
            lines.push('\theader Access-Control-Allow-Credentials "true"');
        }

        // Max Age
        const maxAge = this.val('corsMaxAge');
        if (maxAge) {
            lines.push(`\theader Access-Control-Max-Age "${maxAge}"`);
        }

        return lines.length > 0 ? lines.join('\n') : '';
    }

    /**
     * Build path-based routing blocks (handle / handle_path)
     */
    buildPathRoutingBlock() {
        if (!this.checked('enablePathRouting')) return '';

        const ruleRows = document.querySelectorAll('#pathRoutingRules .path-rule-row');
        if (ruleRows.length === 0) return '';

        const blocks = [];

        ruleRows.forEach(row => {
            const path = row.querySelector('.path-rule-path') ? row.querySelector('.path-rule-path').value.trim() : '';
            const matchType = row.querySelector('.path-rule-match') ? row.querySelector('.path-rule-match').value : 'path_prefix';
            const dest = row.querySelector('.path-rule-dest') ? row.querySelector('.path-rule-dest').value.trim() : '';
            const stripPrefix = row.querySelector('.path-rule-strip') ? row.querySelector('.path-rule-strip').checked : false;

            if (!path || !dest) return;

            let pathPattern = path;
            if (matchType === 'path_prefix' && !pathPattern.endsWith('*')) {
                pathPattern = pathPattern.endsWith('/') ? pathPattern + '*' : pathPattern + '/*';
            }

            if (matchType === 'not') {
                blocks.push(`\t@not_${path.replace(/[^a-zA-Z0-9]/g, '')} not path ${pathPattern}`);
                blocks.push(`\thandle @not_${path.replace(/[^a-zA-Z0-9]/g, '')} {`);
                blocks.push(`\t\treverse_proxy ${dest}`);
                blocks.push('\t}');
            } else {
                const directive = stripPrefix ? 'handle_path' : 'handle';
                blocks.push(`\t${directive} ${pathPattern} {`);
                blocks.push(`\t\treverse_proxy ${dest}`);
                blocks.push('\t}');
            }
        });

        return blocks.length > 0 ? blocks.join('\n') : '';
    }

    /**
     * Generate recommendations based on current configuration state.
     * Returns array of { type: 'suggest'|'warning'|'conflict'|'good', title, detail }
     */
    getRecommendations() {
        const t = window.t;
        const recs = [];
        const hostname = this.val('hostname');
        if (!hostname) return recs;

        const upstreams = this.getUpstreams();
        const hasProxy = upstreams.length > 0;

        // === SECURITY HEADERS ===
        if (hasProxy) {
            const missingSecHeaders = [];
            if (!this.checked('headerHSTS')) missingSecHeaders.push(t('rec.missing_hsts'));
            if (!this.checked('headerXContentType')) missingSecHeaders.push(t('rec.missing_xcontent'));
            if (!this.checked('headerXFrameOptions')) missingSecHeaders.push(t('rec.missing_xframe'));
            if (!this.checked('headerReferrerPolicy')) missingSecHeaders.push(t('rec.missing_referrer'));

            if (missingSecHeaders.length > 0) {
                recs.push({
                    type: 'suggest',
                    id: 'fix-security-headers',
                    title: t('rec.security_headers_title'),
                    detail: t('rec.security_headers_detail') + ' ' + missingSecHeaders.join(', ') + '.',
                    actionLabel: t('rec.security_headers_action'),
                    action: 'enableSecurityHeaders'
                });
            }

            if (!this.checked('headerRemoveServer')) {
                recs.push({
                    type: 'suggest',
                    id: 'fix-remove-server',
                    title: t('rec.remove_server_title'),
                    detail: t('rec.remove_server_detail'),
                    actionLabel: t('rec.remove_server_action'),
                    action: 'enableRemoveServer'
                });
            }
        }

        // === ENCODING ===
        if (hasProxy && !this.checked('enableEncode')) {
            recs.push({
                type: 'suggest',
                id: 'fix-encoding',
                title: t('rec.encoding_title'),
                detail: t('rec.encoding_detail'),
                actionLabel: t('rec.encoding_action'),
                action: 'enableEncoding'
            });
        }

        // === LOGGING ===
        if (hasProxy && !this.checked('enableLogging')) {
            recs.push({
                type: 'suggest',
                id: 'fix-logging',
                title: t('rec.logging_title'),
                detail: t('rec.logging_detail'),
                actionLabel: t('rec.logging_action'),
                action: 'enableLogging'
            });
        }

        // === TLS ===
        const tlsMode = this.val('tlsMode');
        if (tlsMode === 'internal') {
            recs.push({
                type: 'warning',
                id: 'warn-internal-tls',
                title: t('rec.internal_tls_title'),
                detail: t('rec.internal_tls_detail'),
                actionLabel: t('rec.internal_tls_action'),
                action: 'switchToAutoTls'
            });
        }

        // === TRANSPORT INSECURE ===
        if (this.checked('transportTlsInsecure')) {
            recs.push({
                type: 'conflict',
                id: 'fix-transport-insecure',
                title: t('rec.transport_insecure_title'),
                detail: t('rec.transport_insecure_detail'),
                actionLabel: t('rec.transport_insecure_action'),
                action: 'disableInsecureTransport'
            });
        }

        // === LOAD BALANCING ===
        if (upstreams.length > 1) {
            if (!this.checked('enableHealthCheck') && !this.checked('enablePassiveHealth')) {
                recs.push({
                    type: 'warning',
                    id: 'fix-health-check',
                    title: t('rec.health_check_title'),
                    detail: t('rec.health_check_detail'),
                    actionLabel: t('rec.health_check_action'),
                    action: 'enableHealthCheck'
                });
            }
            const lbPolicy = this.val('lbPolicy');
            if (lbPolicy === 'ip_hash' && this.checked('enableKeycloak')) {
                recs.push({
                    type: 'warning',
                    id: 'fix-lb-policy',
                    title: t('rec.lb_ip_keycloak_title'),
                    detail: t('rec.lb_ip_keycloak_detail'),
                    actionLabel: t('rec.lb_ip_keycloak_action'),
                    action: 'switchLbCookie'
                });
            }
        } else if (upstreams.length === 0 && hostname) {
            recs.push({
                type: 'warning',
                id: 'warn-no-upstream',
                title: t('rec.no_upstream_title'),
                detail: t('rec.no_upstream_detail'),
                actionLabel: t('rec.no_upstream_action'),
                action: 'scrollToProxy'
            });
        }

        // === BASIC AUTH without TLS ===
        if (this.checked('enableBasicAuth') && !this.checked('autoHttps') && tlsMode === 'auto') {
            recs.push({
                type: 'conflict',
                id: 'fix-auth-no-tls',
                title: t('rec.auth_no_tls_title'),
                detail: t('rec.auth_no_tls_detail'),
                actionLabel: t('rec.auth_no_tls_action'),
                action: 'enableAutoHttps'
            });
        }

        // === KEYCLOAK without proxy ===
        if (this.checked('enableKeycloak') && !hasProxy) {
            recs.push({
                type: 'conflict',
                id: 'warn-keycloak-no-proxy',
                title: t('rec.keycloak_no_proxy_title'),
                detail: t('rec.keycloak_no_proxy_detail'),
                actionLabel: t('rec.keycloak_no_proxy_action'),
                action: 'scrollToProxy'
            });
        }

        // === CLIENT AUTH ===
        if (this.checked('enableClientAuth')) {
            const trustedCa = this.val('trustedCaCert');
            const mode = this.val('clientAuthMode');
            if ((mode === 'require_and_verify' || mode === 'verify_if_given') && !trustedCa) {
                recs.push({
                    type: 'conflict',
                    id: 'warn-client-auth-no-cert',
                    title: t('rec.client_auth_no_cert_title'),
                    detail: t('rec.client_auth_no_cert_detail'),
                    actionLabel: t('rec.client_auth_no_cert_action'),
                    action: 'scrollToClientAuth'
                });
            }
        }

        // === GOOD CONFIGURATIONS ===
        if (this.checked('headerHSTS') && this.checked('headerXContentType') && this.checked('headerXFrameOptions') && this.checked('headerReferrerPolicy')) {
            recs.push({
                type: 'good',
                id: 'good-security',
                title: t('rec.good_security_title'),
                detail: t('rec.good_security_detail')
            });
        }

        if (this.checked('enableEncode') && (this.checked('encodeZstd') || this.checked('encodeGzip'))) {
            recs.push({
                type: 'good',
                id: 'good-encoding',
                title: t('rec.good_encoding_title'),
                detail: t('rec.good_encoding_detail')
            });
        }

        if (upstreams.length > 1 && (this.checked('enableHealthCheck') || this.checked('enablePassiveHealth'))) {
            recs.push({
                type: 'good',
                id: 'good-health',
                title: t('rec.good_health_title'),
                detail: t('rec.good_health_detail')
            });
        }

        if (this.checked('enableLogging')) {
            recs.push({
                type: 'good',
                id: 'good-logging',
                title: t('rec.good_logging_title'),
                detail: t('rec.good_logging_detail')
            });
        }

        if (hasProxy && upstreams.length === 1 && hostname && !recs.some(r => r.type === 'conflict')) {
            recs.push({
                type: 'good',
                id: 'good-basic',
                title: t('rec.good_basic_title'),
                detail: t('rec.good_basic_detail')
            });
        }

        return recs;
    }
}

// Export for use in app.js
window.ConfigBuilder = ConfigBuilder;
