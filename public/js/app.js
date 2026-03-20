/**
 * CaddyConfer – Main Application Logic
 * Handles UI interactions, live preview, validation, and export.
 */

document.addEventListener('DOMContentLoaded', () => {
    const builder = new ConfigBuilder();
    let generatedCaPath = null;
    let generatedCaKeyPath = null;

    // ========================================================
    // Live Preview – update on any input change
    // ========================================================
    function updatePreview() {
        const result = builder.build();
        const previewEl = document.getElementById('configPreview');
        const badgeEl = document.getElementById('validationBadge');
        const messagesEl = document.getElementById('validationMessages');

        if (result.config) {
            previewEl.innerHTML = syntaxHighlight(result.config);
        } else {
            previewEl.innerHTML = `<span class="comment">${t('js.preview_empty')}</span>`;
        }

        // Update validation badge and messages
        messagesEl.innerHTML = '';

        if (result.errors.length > 0) {
            badgeEl.className = 'badge bg-danger';
            badgeEl.textContent = `${result.errors.length} ${t('js.errors_count')}`;
            result.errors.forEach(err => {
                messagesEl.innerHTML += `<div class="validation-msg error"><i class="fas fa-times-circle me-1"></i>${err}</div>`;
            });
        } else if (result.warnings.length > 0) {
            badgeEl.className = 'badge bg-warning text-dark';
            badgeEl.textContent = `${result.warnings.length} ${t('js.warnings_count')}`;
            result.warnings.forEach(warn => {
                messagesEl.innerHTML += `<div class="validation-msg warning"><i class="fas fa-exclamation-triangle me-1"></i>${warn}</div>`;
            });
        } else if (result.config) {
            badgeEl.className = 'badge bg-success';
            badgeEl.textContent = t('js.valid_config');
            messagesEl.innerHTML = `<div class="validation-msg success"><i class="fas fa-check-circle me-1"></i>${t('js.config_looks_good')}</div>`;
        } else {
            badgeEl.className = 'badge bg-secondary';
            badgeEl.textContent = t('js.waiting_input');
        }

        // Update recommendations
        updateRecommendations();
    }

    function updateRecommendations() {
        const recs = builder.getRecommendations();
        const listEl = document.getElementById('recommendationsList');
        const countEl = document.getElementById('recommendationCount');

        if (!recs || recs.length === 0) {
            listEl.innerHTML = `<div class="p-3 text-muted small">${t('js.no_recommendations')}</div>`;
            countEl.textContent = '0';
            countEl.className = 'badge bg-secondary';
            return;
        }

        const iconMap = {
            suggest: '<i class="fas fa-lightbulb rec-icon text-primary"></i>',
            warning: '<i class="fas fa-exclamation-triangle rec-icon text-warning"></i>',
            conflict: '<i class="fas fa-times-circle rec-icon text-danger"></i>',
            good: '<i class="fas fa-check-circle rec-icon text-success"></i>'
        };

        listEl.innerHTML = recs.map(r => `
            <div class="recommendation-item rec-${r.type}">
                ${iconMap[r.type] || ''}<span class="rec-title">${r.title}</span>
                <span class="rec-detail">${r.detail}</span>
                ${r.action ? `<button class="btn btn-sm btn-outline-primary mt-1 rec-action-btn" data-action="${r.action}"><i class="fas fa-magic me-1"></i>${r.actionLabel || t('js.fix_action')}</button>` : ''}
            </div>
        `).join('');

        // Attach action button handlers
        listEl.querySelectorAll('.rec-action-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                executeRecAction(this.dataset.action);
            });
        });

        const conflicts = recs.filter(r => r.type === 'conflict').length;
        const warnings = recs.filter(r => r.type === 'warning').length;
        const suggestions = recs.filter(r => r.type === 'suggest').length;
        const goods = recs.filter(r => r.type === 'good').length;

        countEl.textContent = recs.length;
        if (conflicts > 0) {
            countEl.className = 'badge bg-danger';
        } else if (warnings > 0) {
            countEl.className = 'badge bg-warning text-dark';
        } else if (suggestions > 0) {
            countEl.className = 'badge bg-info';
        } else {
            countEl.className = 'badge bg-success';
        }
    }

    // Recommendation action handlers
    function executeRecAction(actionName) {
        const actions = {
            enableSecurityHeaders: () => {
                ['headerHSTS', 'headerXContentType', 'headerXFrameOptions', 'headerReferrerPolicy'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
                });
                openAccordionSection(5);
            },
            enableRemoveServer: () => {
                const el = document.getElementById('headerRemoveServer');
                if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
                openAccordionSection(5);
            },
            enableEncoding: () => {
                const el = document.getElementById('enableEncode');
                if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
                // Also enable gzip as default
                const gz = document.getElementById('encodeGzip');
                if (gz && !gz.checked) { gz.checked = true; gz.dispatchEvent(new Event('change')); }
                openAccordionSection(7);
            },
            enableLogging: () => {
                const el = document.getElementById('enableLogging');
                if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
                openAccordionSection(8);
            },
            switchToAutoTls: () => {
                const el = document.getElementById('tlsMode');
                if (el) { el.value = 'auto'; el.dispatchEvent(new Event('change')); }
                openAccordionSection(2);
            },
            disableInsecureTransport: () => {
                const el = document.getElementById('transportTlsInsecure');
                if (el && el.checked) { el.checked = false; el.dispatchEvent(new Event('change')); }
            },
            enableHealthCheck: () => {
                const el = document.getElementById('enableHealthCheck');
                if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
                openAccordionSection(3);
            },
            switchLbCookie: () => {
                const el = document.getElementById('lbPolicy');
                if (el) { el.value = 'cookie'; el.dispatchEvent(new Event('change')); }
                openAccordionSection(3);
            },
            enableAutoHttps: () => {
                const el = document.getElementById('autoHttps');
                if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
                openAccordionSection(1);
            },
            scrollToProxy: () => {
                openAccordionSection(3);
                const el = document.getElementById('upstream1');
                if (el) el.focus();
            },
            scrollToClientAuth: () => {
                openAccordionSection(10);
                const el = document.getElementById('trustedCaCert');
                if (el) el.focus();
            }
        };

        if (actions[actionName]) {
            actions[actionName]();
            updatePreview();
        }
    }

    function openAccordionSection(index) {
        const accordions = document.querySelectorAll('#configAccordion .accordion-item');
        if (accordions[index]) {
            const btn = accordions[index].querySelector('.accordion-button');
            const collapse = accordions[index].querySelector('.accordion-collapse');
            if (btn && collapse && !collapse.classList.contains('show')) {
                btn.click();
            }
            setTimeout(() => accordions[index].scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        }
    }

    // Simple syntax highlighting for Caddyfile
    function syntaxHighlight(config) {
        return config
            .split('\n')
            .map(line => {
                // Comments
                if (line.trim().startsWith('#')) {
                    return `<span class="comment">${escapeHtml(line)}</span>`;
                }
                let escaped = escapeHtml(line);
                // Directives (first word at indent level)
                escaped = escaped.replace(/^(\s*)(tls|log|header|encode|reverse_proxy|forward_auth|basicauth|request_body|handle_errors|handle_path|handle|respond|redir|@\w+|import)\b/, '$1<span class="directive">$2</span>');
                // Sub-directives / keywords
                escaped = escaped.replace(/\b(output|format|level|protocols|ciphers|client_auth|mode|trusted_ca_cert_file|lb_policy|health_uri|health_port|health_interval|health_timeout|health_status|health_body|header_up|header_down|transport|tls_insecure_skip_verify|tls_server_name|tls_trusted_ca_certs|flush_interval|buffer_requests|buffer_responses|max_buffer_size|trusted_proxies|roll_size|roll_keep|roll_keep_for|roll_local_time|fail_duration|max_fails|unhealthy_request_count|unhealthy_status|lb_try_duration|lb_try_interval|minimum_length|max_size|email|http_port|https_port|auto_https|acme_ca|acme_eab|key_id|mac_key|grace_period|servers|timeouts|read_timeout|write_timeout|idle_timeout|remote_ip|certificates|internal|uri|copy_headers|expression|err\.status_code|static)\b/g, '<span class="keyword">$1</span>');
                // Quoted strings
                escaped = escaped.replace(/"([^"]*)"/g, '"<span class="string">$1</span>"');
                return escaped;
            })
            .join('\n');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ========================================================
    // Attach event listeners for live preview
    // ========================================================
    function attachLivePreview() {
        // All inputs, selects, checkboxes
        document.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        });
    }

    attachLivePreview();

    // ========================================================
    // TLS mode toggle
    // ========================================================
    document.getElementById('tlsMode').addEventListener('change', function () {
        document.querySelectorAll('.tls-sub-section').forEach(s => s.classList.add('d-none'));
        if (this.value === 'zerossl_api' || this.value === 'zerossl_fallback') {
            document.getElementById('zerosslApiSection').classList.remove('d-none');
        } else if (this.value === 'cert_key') {
            document.getElementById('certKeySection').classList.remove('d-none');
        }
        updatePreview();
    });

    // Show ZeroSSL section on load (since zerossl_api is now default)
    document.getElementById('zerosslApiSection').classList.remove('d-none');

    // ========================================================
    // Client Auth toggle
    // ========================================================
    document.getElementById('enableClientAuth').addEventListener('change', function () {
        document.getElementById('clientAuthOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    document.getElementById('clientAuthMode').addEventListener('change', function () {
        const desc = document.getElementById('clientAuthModeDesc');
        const info = window.TOOLTIPS.clientAuthModes[this.value];
        if (info) desc.textContent = info.desc;
        updatePreview();
    });

    // ========================================================
    // Logging toggle
    // ========================================================
    document.getElementById('enableLogging').addEventListener('change', function () {
        document.getElementById('loggingOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    document.getElementById('logOutput').addEventListener('change', function () {
        document.getElementById('logFileOptions').style.display = this.value === 'file' ? 'block' : 'none';
        updatePreview();
    });

    // ========================================================
    // Encode toggle
    // ========================================================
    document.getElementById('enableEncode').addEventListener('change', function () {
        document.getElementById('encodeOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    // ========================================================
    // Upstream management
    // ========================================================
    document.getElementById('addUpstream').addEventListener('click', () => {
        const list = document.getElementById('upstreamList');
        const row = document.createElement('div');
        row.className = 'input-group mb-2 upstream-row';
        row.innerHTML = `
            <span class="input-group-text"><i class="fas fa-server"></i></span>
            <input type="text" class="form-control upstream-address" placeholder="t.ex. 127.0.0.1:8080 eller backend:3000">
            <button class="btn btn-outline-danger remove-upstream-btn" type="button"><i class="fas fa-times"></i></button>
        `;
        list.appendChild(row);
        attachUpstreamEvents(row);
        row.querySelector('input').addEventListener('input', updatePreview);
        checkLoadBalancingVisibility();
        updatePreview();
    });

    function attachUpstreamEvents(row) {
        row.querySelector('.remove-upstream-btn').addEventListener('click', () => {
            if (document.querySelectorAll('.upstream-row').length > 1) {
                row.remove();
                checkLoadBalancingVisibility();
                updatePreview();
            }
        });
    }

    // Attach to initial row
    document.querySelectorAll('.upstream-row').forEach(row => attachUpstreamEvents(row));

    function checkLoadBalancingVisibility() {
        const count = document.querySelectorAll('.upstream-address').length;
        const upstreamValues = Array.from(document.querySelectorAll('.upstream-address')).filter(i => i.value.trim()).length;
        document.getElementById('loadBalancingSection').classList.toggle('d-none', upstreamValues < 2);
    }

    // Check on any upstream change
    document.getElementById('upstreamList').addEventListener('input', checkLoadBalancingVisibility);

    // ========================================================
    // Load balancing policy descriptions
    // ========================================================
    document.getElementById('lbPolicy').addEventListener('change', function () {
        const desc = document.getElementById('lbPolicyDesc');
        const info = window.TOOLTIPS.lbPolicies[this.value];
        if (info) {
            desc.innerHTML = info.desc + (info.version ? ` <span class="badge bg-info">${info.version}</span>` : '');
        }

        // Show/hide sub-options
        document.getElementById('lbCookieOptions').classList.toggle('d-none', this.value !== 'cookie');
        document.getElementById('lbHeaderOptions').classList.toggle('d-none', this.value !== 'header');
        document.getElementById('lbRandomChooseOptions').classList.toggle('d-none', this.value !== 'random_choose');
        updatePreview();
    });

    // ========================================================
    // Health check toggle
    // ========================================================
    document.getElementById('enableHealthCheck').addEventListener('change', function () {
        document.getElementById('healthCheckOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    document.getElementById('enablePassiveHealth').addEventListener('change', function () {
        document.getElementById('passiveHealthOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    // ========================================================
    // Transport TLS toggle
    // ========================================================
    document.getElementById('transportTls').addEventListener('change', function () {
        document.getElementById('transportTlsOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    // ========================================================
    // CSP Builder
    // ========================================================
    const cspCheckbox = document.getElementById('headerCSP');
    const cspBuilder = document.getElementById('cspBuilder');
    const cspDirectivesContainer = document.getElementById('cspDirectives');

    cspCheckbox.addEventListener('change', function () {
        cspBuilder.classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    function getCspDirectiveRowHtml() {
        const directives = window.CSP_DIRECTIVES || {};
        let options = '<option value="">-- Välj typ --</option>';
        for (const [key, info] of Object.entries(directives)) {
            options += `<option value="${key}">${key}</option>`;
        }
        return `
            <div class="csp-directive-row">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <select class="form-select form-select-sm csp-directive-select" style="max-width:220px;">${options}</select>
                    <button type="button" class="btn btn-sm btn-outline-danger csp-remove-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="csp-desc"></div>
                <div class="csp-values-area mt-1 d-none"></div>
            </div>`;
    }

    function attachCspDirectiveEvents(row) {
        const sel = row.querySelector('.csp-directive-select');
        const desc = row.querySelector('.csp-desc');
        const valuesArea = row.querySelector('.csp-values-area');

        sel.addEventListener('change', function () {
            const directives = window.CSP_DIRECTIVES || {};
            const info = directives[this.value];
            if (info) {
                desc.textContent = info.description;
                if (info.noValue) {
                    valuesArea.classList.add('d-none');
                    valuesArea.innerHTML = '';
                } else {
                    valuesArea.classList.remove('d-none');
                    let chipsHtml = '';
                    (info.commonValues || []).forEach(v => {
                        chipsHtml += `<span class="csp-value-chip" data-value="${v}">${v}</span>`;
                    });
                    chipsHtml += `<input type="text" class="form-control form-control-sm d-inline-block mt-1 csp-custom-value" style="max-width:250px;" placeholder="Ytterligare domäner (t.ex. https://cdn.example.com)">`;
                    valuesArea.innerHTML = chipsHtml;
                    valuesArea.querySelectorAll('.csp-value-chip').forEach(chip => {
                        chip.addEventListener('click', function () {
                            this.classList.toggle('active');
                            updateCspPreview();
                            updatePreview();
                        });
                    });
                    valuesArea.querySelector('.csp-custom-value').addEventListener('input', () => {
                        updateCspPreview();
                        updatePreview();
                    });
                }
            } else {
                desc.textContent = '';
                valuesArea.classList.add('d-none');
                valuesArea.innerHTML = '';
            }
            updateCspPreview();
            updatePreview();
        });

        row.querySelector('.csp-remove-btn').addEventListener('click', () => {
            row.remove();
            updateCspPreview();
            updatePreview();
        });
    }

    function updateCspPreview() {
        const preview = document.getElementById('cspPreview');
        const previewText = document.getElementById('cspPreviewText');
        const val = buildCspValue();
        if (val) {
            preview.style.display = '';
            previewText.textContent = val;
        } else {
            preview.style.display = 'none';
        }
    }

    function buildCspValue() {
        const directives = window.CSP_DIRECTIVES || {};
        const parts = [];
        document.querySelectorAll('#cspDirectives .csp-directive-row').forEach(row => {
            const sel = row.querySelector('.csp-directive-select');
            const directive = sel.value;
            if (!directive) return;
            const info = directives[directive];
            if (info && info.noValue) {
                parts.push(directive);
            } else {
                const activeChips = row.querySelectorAll('.csp-value-chip.active');
                const values = Array.from(activeChips).map(c => c.dataset.value);
                const customInput = row.querySelector('.csp-custom-value');
                if (customInput && customInput.value.trim()) {
                    customInput.value.trim().split(/\s+/).forEach(v => values.push(v));
                }
                if (values.length > 0) {
                    parts.push(directive + ' ' + values.join(' '));
                }
            }
        });
        return parts.join('; ');
    }

    // Make buildCspValue globally accessible for config-builder
    window.buildCspValue = buildCspValue;

    document.getElementById('addCspDirective').addEventListener('click', () => {
        const row = document.createElement('div');
        row.innerHTML = getCspDirectiveRowHtml();
        const directiveRow = row.firstElementChild;
        cspDirectivesContainer.appendChild(directiveRow);
        attachCspDirectiveEvents(directiveRow);
    });

    // ========================================================
    // Permissions-Policy Builder
    // ========================================================
    const ppCheckbox = document.getElementById('headerPermissionsPolicy');
    const ppBuilder = document.getElementById('ppBuilder');
    const ppFeaturesContainer = document.getElementById('ppFeatures');

    ppCheckbox.addEventListener('change', function () {
        ppBuilder.classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    function getPpFeatureRowHtml() {
        const features = window.PERMISSIONS_POLICY_FEATURES || {};
        let options = '<option value="">-- Välj funktion --</option>';
        for (const [key, info] of Object.entries(features)) {
            options += `<option value="${key}">${key}</option>`;
        }
        return `
            <div class="pp-feature-row">
                <select class="form-select form-select-sm pp-feature-select" style="max-width:200px;">${options}</select>
                <select class="form-select form-select-sm pp-value-select" style="max-width:180px;">
                    <option value="()">Blockerad</option>
                    <option value="(self)">Bara denna sida</option>
                    <option value="*">Alla</option>
                    <option value="custom">Egen...</option>
                </select>
                <input type="text" class="form-control form-control-sm pp-custom-value d-none" style="max-width:180px;" placeholder="t.ex. https://example.com">
                <span class="pp-desc"></span>
                <button type="button" class="btn btn-sm btn-outline-danger pp-remove-btn"><i class="fas fa-times"></i></button>
            </div>`;
    }

    function attachPpFeatureEvents(row) {
        const featureSel = row.querySelector('.pp-feature-select');
        const valueSel = row.querySelector('.pp-value-select');
        const customInput = row.querySelector('.pp-custom-value');
        const desc = row.querySelector('.pp-desc');

        featureSel.addEventListener('change', function () {
            const features = window.PERMISSIONS_POLICY_FEATURES || {};
            const info = features[this.value];
            desc.textContent = info ? info.description : '';
            updatePpPreview();
            updatePreview();
        });

        valueSel.addEventListener('change', function () {
            customInput.classList.toggle('d-none', this.value !== 'custom');
            updatePpPreview();
            updatePreview();
        });

        customInput.addEventListener('input', () => {
            updatePpPreview();
            updatePreview();
        });

        row.querySelector('.pp-remove-btn').addEventListener('click', () => {
            row.remove();
            updatePpPreview();
            updatePreview();
        });
    }

    function updatePpPreview() {
        const preview = document.getElementById('ppPreview');
        const previewText = document.getElementById('ppPreviewText');
        const val = buildPpValue();
        if (val) {
            preview.style.display = '';
            previewText.textContent = val;
        } else {
            preview.style.display = 'none';
        }
    }

    function buildPpValue() {
        const parts = [];
        document.querySelectorAll('#ppFeatures .pp-feature-row').forEach(row => {
            const feature = row.querySelector('.pp-feature-select').value;
            if (!feature) return;
            const valueSel = row.querySelector('.pp-value-select');
            let value = valueSel.value;
            if (value === 'custom') {
                const customVal = row.querySelector('.pp-custom-value').value.trim();
                value = customVal ? `(${customVal})` : '()';
            }
            parts.push(`${feature}=${value}`);
        });
        return parts.join(', ');
    }

    // Make buildPpValue globally accessible for config-builder
    window.buildPpValue = buildPpValue;

    document.getElementById('addPpFeature').addEventListener('click', () => {
        const row = document.createElement('div');
        row.innerHTML = getPpFeatureRowHtml();
        const featureRow = row.firstElementChild;
        ppFeaturesContainer.appendChild(featureRow);
        attachPpFeatureEvents(featureRow);
    });

    // ========================================================
    // Custom headers management (dropdown-based)
    // ========================================================
    function getHeaderDropdownHtml() {
        return `
            <div class="col-2">
                <select class="form-select form-select-sm header-action-select">
                    <option value="set">Sätt</option>
                    <option value="add">Lägg till</option>
                    <option value="delete">Ta bort</option>
                    <option value="defer">Defer</option>
                </select>
            </div>
            <div class="col-4">
                <select class="form-select form-select-sm header-name-select">
                    <option value="">-- Välj header --</option>
                    <optgroup label="Caching">
                        <option value="Cache-Control">Cache-Control</option>
                        <option value="Pragma">Pragma</option>
                        <option value="Vary">Vary</option>
                        <option value="ETag">ETag</option>
                    </optgroup>
                    <optgroup label="Säkerhet">
                        <option value="X-Permitted-Cross-Domain-Policies">X-Permitted-Cross-Domain-Policies</option>
                        <option value="Cross-Origin-Opener-Policy">Cross-Origin-Opener-Policy</option>
                        <option value="Cross-Origin-Embedder-Policy">Cross-Origin-Embedder-Policy</option>
                        <option value="Cross-Origin-Resource-Policy">Cross-Origin-Resource-Policy</option>
                    </optgroup>
                    <optgroup label="Proxy / Forwarding">
                        <option value="X-Forwarded-For">X-Forwarded-For</option>
                        <option value="X-Forwarded-Proto">X-Forwarded-Proto</option>
                        <option value="X-Forwarded-Host">X-Forwarded-Host</option>
                        <option value="X-Real-IP">X-Real-IP</option>
                    </optgroup>
                    <optgroup label="Innehåll">
                        <option value="Content-Type">Content-Type</option>
                        <option value="Content-Disposition">Content-Disposition</option>
                        <option value="Content-Language">Content-Language</option>
                        <option value="Accept-Encoding">Accept-Encoding</option>
                    </optgroup>
                    <optgroup label="CORS">
                        <option value="Access-Control-Allow-Origin">Access-Control-Allow-Origin</option>
                        <option value="Access-Control-Allow-Methods">Access-Control-Allow-Methods</option>
                        <option value="Access-Control-Allow-Headers">Access-Control-Allow-Headers</option>
                        <option value="Access-Control-Max-Age">Access-Control-Max-Age</option>
                        <option value="Access-Control-Allow-Credentials">Access-Control-Allow-Credentials</option>
                    </optgroup>
                    <optgroup label="Övrigt">
                        <option value="X-Robots-Tag">X-Robots-Tag</option>
                        <option value="X-DNS-Prefetch-Control">X-DNS-Prefetch-Control</option>
                        <option value="X-Download-Options">X-Download-Options</option>
                        <option value="custom">✏️ Egen header...</option>
                    </optgroup>
                </select>
                <input type="text" class="form-control form-control-sm mt-1 d-none header-custom-name" placeholder="Eget header-namn">
            </div>
            <div class="col-5">
                <select class="form-select form-select-sm header-value-preset-select d-none mb-1">
                    <option value="">📋 Välj vanligt värde...</option>
                </select>
                <div class="form-text small header-value-preset-desc d-none"></div>
                <input type="text" class="form-control form-control-sm header-value-input" placeholder="Värde">
                <div class="form-text small header-description-text"></div>
            </div>
            <div class="col-1">
                <button class="btn btn-sm btn-outline-danger remove-header-btn"><i class="fas fa-times"></i></button>
            </div>
        `;
    }

    function attachHeaderRowEvents(row) {
        const nameSelect = row.querySelector('.header-name-select');
        const customInput = row.querySelector('.header-custom-name');
        const descText = row.querySelector('.header-description-text');
        const presetSelect = row.querySelector('.header-value-preset-select');
        const presetDesc = row.querySelector('.header-value-preset-desc');
        const valueInput = row.querySelector('.header-value-input');

        nameSelect.addEventListener('change', function () {
            if (this.value === 'custom') {
                customInput.classList.remove('d-none');
                descText.textContent = '';
                presetSelect.classList.add('d-none');
                presetDesc.classList.add('d-none');
            } else {
                customInput.classList.add('d-none');
                customInput.value = '';
                const desc = window.HEADER_DESCRIPTIONS ? window.HEADER_DESCRIPTIONS[this.value] : '';
                descText.textContent = desc || '';
                // Populate value preset dropdown
                const presets = window.HEADER_VALUE_PRESETS ? window.HEADER_VALUE_PRESETS[this.value] : null;
                if (presets && presets.length > 0) {
                    presetSelect.innerHTML = '<option value="">📋 Välj vanligt värde...</option>' +
                        presets.map((p, i) => `<option value="${i}">${p.label}</option>`).join('') +
                        '<option value="custom_val">✏️ Eget värde...</option>';
                    presetSelect.classList.remove('d-none');
                    presetDesc.classList.add('d-none');
                    presetDesc.textContent = '';
                    // Auto-select first preset as suggestion
                    valueInput.placeholder = presets[0].value;
                } else {
                    presetSelect.classList.add('d-none');
                    presetDesc.classList.add('d-none');
                    presetDesc.textContent = '';
                    valueInput.placeholder = 'Värde';
                }
            }
            updatePreview();
        });

        presetSelect.addEventListener('change', function () {
            const headerName = nameSelect.value;
            const presets = window.HEADER_VALUE_PRESETS ? window.HEADER_VALUE_PRESETS[headerName] : null;
            if (this.value === '' || this.value === 'custom_val') {
                presetDesc.classList.add('d-none');
                if (this.value === 'custom_val') {
                    valueInput.value = '';
                    valueInput.placeholder = 'Skriv ditt eget värde...';
                    valueInput.focus();
                }
            } else if (presets) {
                const idx = parseInt(this.value);
                const preset = presets[idx];
                if (preset) {
                    valueInput.value = preset.value;
                    presetDesc.textContent = '💡 ' + preset.description;
                    presetDesc.classList.remove('d-none');
                }
            }
            updatePreview();
        });

        customInput.addEventListener('input', updatePreview);
        valueInput.addEventListener('input', updatePreview);
        row.querySelector('.header-action-select').addEventListener('change', updatePreview);
        row.querySelector('.remove-header-btn').addEventListener('click', () => {
            row.remove();
            updatePreview();
        });
    }

    // Attach events to initial header row
    document.querySelectorAll('#customHeaders .custom-header-row').forEach(row => attachHeaderRowEvents(row));

    document.getElementById('addCustomHeader').addEventListener('click', () => {
        const container = document.getElementById('customHeaders');
        const row = document.createElement('div');
        row.className = 'row custom-header-row mb-2';
        row.innerHTML = getHeaderDropdownHtml();
        container.appendChild(row);
        attachHeaderRowEvents(row);
        updatePreview();
    });

    // Proxy header_up / header_down (dropdown-based)
    function getProxyHeaderDropdownHtml(direction) {
        const isUp = direction === 'up';
        const headers = isUp ? window.PROXY_HEADER_UP_DESCRIPTIONS : window.PROXY_HEADER_DOWN_DESCRIPTIONS;
        const options = Object.keys(headers || {}).map(h =>
            `<option value="${h}">${h}</option>`
        ).join('');

        return `
            <div class="col-5">
                <select class="form-select form-select-sm proxy-header-name-select">
                    <option value="">-- Välj header --</option>
                    ${isUp ? `
                    <optgroup label="Vanliga upstream-headers">
                        <option value="X-Real-IP">X-Real-IP</option>
                        <option value="X-Forwarded-For">X-Forwarded-For</option>
                        <option value="X-Forwarded-Proto">X-Forwarded-Proto</option>
                        <option value="X-Forwarded-Host">X-Forwarded-Host</option>
                        <option value="X-Request-ID">X-Request-ID</option>
                        <option value="Host">Host</option>
                        <option value="X-Forwarded-Method">X-Forwarded-Method</option>
                        <option value="X-Forwarded-Uri">X-Forwarded-Uri</option>
                        <option value="Authorization">Authorization</option>
                        <option value="X-Forwarded-Ssl">X-Forwarded-Ssl</option>
                    </optgroup>
                    <optgroup label="Ta bort headers">
                        <option value="-X-Forwarded-For">-X-Forwarded-For (ta bort)</option>
                        <option value="-X-Forwarded-Proto">-X-Forwarded-Proto (ta bort)</option>
                        <option value="-X-Forwarded-Host">-X-Forwarded-Host (ta bort)</option>
                    </optgroup>
                    ` : `
                    <optgroup label="Ta bort headers från svar">
                        <option value="-Server">-Server (ta bort)</option>
                        <option value="-X-Powered-By">-X-Powered-By (ta bort)</option>
                        <option value="-Via">-Via (ta bort)</option>
                    </optgroup>
                    <optgroup label="Sätt/override headers">
                        <option value="Strict-Transport-Security">Strict-Transport-Security</option>
                        <option value="X-Frame-Options">X-Frame-Options</option>
                        <option value="X-Content-Type-Options">X-Content-Type-Options</option>
                        <option value="Referrer-Policy">Referrer-Policy</option>
                        <option value="Cache-Control">Cache-Control</option>
                        <option value="X-Request-ID">X-Request-ID</option>
                        <option value="Access-Control-Allow-Origin">Access-Control-Allow-Origin</option>
                    </optgroup>
                    `}
                    <optgroup label="Egen">
                        <option value="custom">✏️ Egen header...</option>
                    </optgroup>
                </select>
                <input type="text" class="form-control form-control-sm mt-1 d-none proxy-header-custom-name" placeholder="Eget header-namn">
            </div>
            <div class="col-6">
                <select class="form-select form-select-sm proxy-header-value-preset d-none mb-1">
                    <option value="">📋 Välj vanligt värde...</option>
                </select>
                <div class="form-text small proxy-header-value-preset-desc d-none"></div>
                <input type="text" class="form-control form-control-sm proxy-header-value" placeholder="${isUp ? 'Värde (t.ex. {remote_host})' : 'Värde'}">
                <div class="form-text small proxy-header-desc"></div>
            </div>
            <div class="col-1">
                <button class="btn btn-sm btn-outline-danger remove-proxy-header-btn"><i class="fas fa-times"></i></button>
            </div>
        `;
    }

    function attachProxyHeaderRowEvents(row, direction) {
        const nameSelect = row.querySelector('.proxy-header-name-select');
        const customInput = row.querySelector('.proxy-header-custom-name');
        const descText = row.querySelector('.proxy-header-desc');
        const descs = direction === 'up' ? window.PROXY_HEADER_UP_DESCRIPTIONS : window.PROXY_HEADER_DOWN_DESCRIPTIONS;
        const presetSelect = row.querySelector('.proxy-header-value-preset');
        const presetDesc = row.querySelector('.proxy-header-value-preset-desc');
        const valueInput = row.querySelector('.proxy-header-value');
        const valuePresets = direction === 'up' ? window.PROXY_HEADER_UP_VALUE_PRESETS : window.PROXY_HEADER_DOWN_VALUE_PRESETS;

        nameSelect.addEventListener('change', function () {
            if (this.value === 'custom') {
                customInput.classList.remove('d-none');
                descText.textContent = '';
                presetSelect.classList.add('d-none');
                presetDesc.classList.add('d-none');
            } else {
                customInput.classList.add('d-none');
                customInput.value = '';
                descText.textContent = (descs && descs[this.value]) || '';
                // Populate value presets
                const presets = valuePresets ? valuePresets[this.value] : null;
                if (presets && presets.length > 0) {
                    presetSelect.innerHTML = '<option value="">📋 Välj vanligt värde...</option>' +
                        presets.map((p, i) => `<option value="${i}">${p.label}</option>`).join('') +
                        '<option value="custom_val">✏️ Eget värde...</option>';
                    presetSelect.classList.remove('d-none');
                    presetDesc.classList.add('d-none');
                    // Auto-fill first preset if value is empty
                    if (!valueInput.value) {
                        valueInput.value = presets[0].value;
                        presetSelect.value = '0';
                        presetDesc.textContent = '💡 ' + presets[0].description;
                        presetDesc.classList.remove('d-none');
                    }
                } else {
                    presetSelect.classList.add('d-none');
                    presetDesc.classList.add('d-none');
                }
            }
            updatePreview();
        });

        presetSelect.addEventListener('change', function () {
            const headerName = nameSelect.value;
            const presets = valuePresets ? valuePresets[headerName] : null;
            if (this.value === '' || this.value === 'custom_val') {
                presetDesc.classList.add('d-none');
                if (this.value === 'custom_val') {
                    valueInput.value = '';
                    valueInput.placeholder = 'Skriv ditt eget värde...';
                    valueInput.focus();
                }
            } else if (presets) {
                const idx = parseInt(this.value);
                const preset = presets[idx];
                if (preset) {
                    valueInput.value = preset.value;
                    presetDesc.textContent = '💡 ' + preset.description;
                    presetDesc.classList.remove('d-none');
                }
            }
            updatePreview();
        });

        customInput.addEventListener('input', updatePreview);
        valueInput.addEventListener('input', updatePreview);
        row.querySelector('.remove-proxy-header-btn').addEventListener('click', () => {
            row.remove();
            updatePreview();
        });
    }

    function addProxyHeaderRow(containerId) {
        const direction = containerId.includes('Up') ? 'up' : 'down';
        const container = document.getElementById(containerId);
        const row = document.createElement('div');
        row.className = 'row proxy-header-row mb-2';
        row.innerHTML = getProxyHeaderDropdownHtml(direction);
        container.appendChild(row);
        attachProxyHeaderRowEvents(row, direction);
        updatePreview();
    }

    document.getElementById('addHeaderUp').addEventListener('click', () => addProxyHeaderRow('proxyCustomHeadersUp'));
    document.getElementById('addHeaderDown').addEventListener('click', () => addProxyHeaderRow('proxyCustomHeadersDown'));

    // ========================================================
    // Basic Auth toggle
    // ========================================================
    document.getElementById('enableBasicAuth').addEventListener('change', function () {
        document.getElementById('basicAuthSection').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    document.getElementById('addBasicAuthUser').addEventListener('click', () => {
        const container = document.getElementById('basicAuthUsers');
        const row = document.createElement('div');
        row.className = 'basic-auth-row mb-3 p-2 border rounded';
        row.innerHTML = `
            <div class="row mb-2">
                <div class="col-5">
                    <label class="form-label form-label-sm mb-1">${t('section9.basic_auth_user_label')}</label>
                    <input type="text" class="form-control form-control-sm basic-auth-username" placeholder="${t('section9.basic_auth_user_placeholder')}">
                </div>
                <div class="col-5">
                    <label class="form-label form-label-sm mb-1">${t('section9.basic_auth_plainpass_label')}</label>
                    <div class="input-group input-group-sm">
                        <input type="password" class="form-control form-control-sm basic-auth-password" placeholder="${t('section9.basic_auth_plainpass_placeholder')}">
                        <button class="btn btn-outline-secondary btn-toggle-pass" type="button" title="Visa/dölj"><i class="fas fa-eye"></i></button>
                    </div>
                </div>
                <div class="col-2 d-flex align-items-end">
                    <button class="btn btn-sm btn-primary hash-password-btn w-100">${t('section9.btn_hash')}</button>
                </div>
            </div>
            <div class="basic-auth-hash-display d-none">
                <label class="form-label form-label-sm mb-1 text-muted">${t('section9.basic_auth_hash_label')}</label>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control form-control-sm basic-auth-hash font-monospace" readonly>
                    <button class="btn btn-outline-success btn-sm" disabled><i class="fas fa-check"></i></button>
                </div>
            </div>
            <div class="col-12 mt-1 text-end">
                <button class="btn btn-sm btn-outline-danger remove-auth-btn"><i class="fas fa-times me-1"></i><span>${t('section9.btn_remove_user')}</span></button>
            </div>
        `;
        container.appendChild(row);
        attachBasicAuthEvents(row);
        updatePreview();
    });

    function attachBasicAuthEvents(row) {
        // Hash button
        const hashBtn = row.querySelector('.hash-password-btn');
        if (hashBtn) {
            hashBtn.addEventListener('click', async () => {
                const passInput = row.querySelector('.basic-auth-password');
                const password = passInput.value.trim();
                if (!password) {
                    alert(t('section9.alert_enter_password'));
                    return;
                }
                hashBtn.disabled = true;
                hashBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    const resp = await fetch('/api/hash-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });
                    const data = await resp.json();
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                    const hashDisplay = row.querySelector('.basic-auth-hash-display');
                    const hashInput = row.querySelector('.basic-auth-hash');
                    hashInput.value = data.hash;
                    hashDisplay.classList.remove('d-none');
                    hashBtn.classList.remove('btn-primary');
                    hashBtn.classList.add('btn-success');
                    hashBtn.innerHTML = '<i class="fas fa-check me-1"></i>' + t('section9.btn_hashed');
                    updatePreview();
                } catch (e) {
                    alert(t('section9.alert_hash_error'));
                } finally {
                    hashBtn.disabled = false;
                }
            });
        }

        // Toggle password visibility
        const toggleBtn = row.querySelector('.btn-toggle-pass');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const passInput = row.querySelector('.basic-auth-password');
                const isPass = passInput.type === 'password';
                passInput.type = isPass ? 'text' : 'password';
                toggleBtn.querySelector('i').className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }

        // Re-hash when password changes (reset hash)
        const passInput = row.querySelector('.basic-auth-password');
        if (passInput) {
            passInput.addEventListener('input', () => {
                const hashDisplay = row.querySelector('.basic-auth-hash-display');
                const hashInput = row.querySelector('.basic-auth-hash');
                if (hashInput && hashInput.value) {
                    hashInput.value = '';
                    hashDisplay.classList.add('d-none');
                    const hashBtn2 = row.querySelector('.hash-password-btn');
                    hashBtn2.classList.remove('btn-success');
                    hashBtn2.classList.add('btn-primary');
                    hashBtn2.textContent = t('section9.btn_hash');
                    updatePreview();
                }
            });
        }

        // Remove button
        const removeBtn = row.querySelector('.remove-auth-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                const rows = document.querySelectorAll('#basicAuthUsers .basic-auth-row');
                if (rows.length > 1) {
                    row.remove();
                    updatePreview();
                }
            });
        }

        // Username input
        const userInput = row.querySelector('.basic-auth-username');
        if (userInput) userInput.addEventListener('input', updatePreview);
    }

    // Attach events to initial row
    document.querySelectorAll('#basicAuthUsers .basic-auth-row').forEach(row => {
        attachBasicAuthEvents(row);
    });

    // ========================================================
    // IP Access toggle
    // ========================================================
    document.getElementById('enableIpAccess').addEventListener('change', function () {
        document.getElementById('ipAccessSection').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    // ========================================================
    // Generic remove button helper
    // ========================================================
    function attachRemoveBtn(row, selector) {
        row.querySelector(selector).addEventListener('click', () => {
            row.remove();
            updatePreview();
        });
    }

    // ========================================================
    // Certificate Generation
    // ========================================================
    document.getElementById('btnGenerateCa').addEventListener('click', async () => {
        const btn = document.getElementById('btnGenerateCa');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Skapar...';

        try {
            const resp = await fetch('/api/generate-ca', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cn: document.getElementById('caCn').value,
                    org: document.getElementById('caOrg').value,
                    validity_days: document.getElementById('caValidity').value
                })
            });
            const data = await resp.json();
            if (data.success) {
                generatedCaPath = data.ca_cert;
                generatedCaKeyPath = data.ca_key;
                document.getElementById('caResult').className = 'alert alert-success small';
                document.getElementById('caResult').innerHTML = `
                    <strong>CA skapad!</strong><br>
                    Cert: <code>${data.ca_cert}</code><br>
                    Nyckel: <code>${data.ca_key}</code><br>
                    Fingerprint: <code>${data.fingerprint}</code>
                `;
                document.getElementById('btnGenerateClient').disabled = false;
                // Auto-fill trusted CA path
                document.getElementById('trustedCaCert').value = data.ca_cert;
                updatePreview();
            } else {
                document.getElementById('caResult').className = 'alert alert-danger small';
                document.getElementById('caResult').textContent = data.error || 'Fel vid skapande av CA';
            }
        } catch (err) {
            document.getElementById('caResult').className = 'alert alert-danger small';
            document.getElementById('caResult').textContent = t('js.network_error') + err.message;
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-certificate me-1"></i>Skapa CA';
    });

    document.getElementById('btnGenerateClient').addEventListener('click', async () => {
        const btn = document.getElementById('btnGenerateClient');
        btn.disabled = true;

        try {
            const resp = await fetch('/api/generate-client-cert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cn: document.getElementById('clientCn').value,
                    org: document.getElementById('clientOrg').value,
                    validity_days: document.getElementById('clientValidity').value,
                    ca_cert_path: generatedCaPath,
                    ca_key_path: generatedCaKeyPath
                })
            });
            const data = await resp.json();
            const resultEl = document.getElementById('clientCertResult');
            if (data.success) {
                resultEl.className = 'alert alert-success small';
                resultEl.innerHTML = `
                    <strong>Klientcertifikat skapat!</strong><br>
                    Cert: <code>${data.client_cert}</code><br>
                    Nyckel: <code>${data.client_key}</code><br>
                    PFX: <code>${data.client_pfx}</code><br>
                    Fingerprint: <code>${data.fingerprint}</code>
                `;
            } else {
                resultEl.className = 'alert alert-danger small';
                resultEl.textContent = data.error || 'Fel vid skapande av klientcertifikat';
            }
        } catch (err) {
            document.getElementById('clientCertResult').className = 'alert alert-danger small';
            document.getElementById('clientCertResult').textContent = t('js.network_error') + err.message;
        }

        btn.disabled = false;
    });

    // ========================================================
    // Export: Download
    // ========================================================
    document.getElementById('btnDownload').addEventListener('click', () => {
        const result = builder.build();
        if (result.errors.length > 0) {
            alert(t('js.config_has_errors'));
            return;
        }
        const hostname = document.getElementById('hostname').value.trim();
        if (!hostname) {
            alert(t('js.enter_hostname'));
            return;
        }
        const safeHostname = hostname.replace(/\*/g, '_wildcard_').replace(/:/g, '_');
        const filename = `${safeHostname}.caddy`;
        const blob = new Blob([result.config], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });

    // ========================================================
    // Export: Save to server
    // ========================================================
    document.getElementById('btnSaveServer').addEventListener('click', async () => {
        const result = builder.build();
        if (result.errors.length > 0) {
            alert(t('js.config_has_errors'));
            return;
        }
        const hostname = document.getElementById('hostname').value.trim();
        if (!hostname) {
            alert(t('js.enter_hostname'));
            return;
        }

        try {
            const resp = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostname, config: result.config })
            });
            const data = await resp.json();
            const resultEl = document.getElementById('saveResult');
            if (data.success) {
                resultEl.innerHTML = `<div class="alert alert-success small"><i class="fas fa-check me-1"></i>${t('js.saved_as')} <code>${data.filename}</code></div>`;
                loadSavedConfigs();
            } else {
                resultEl.innerHTML = `<div class="alert alert-danger small">${data.error}</div>`;
            }
        } catch (err) {
            document.getElementById('saveResult').innerHTML = `<div class="alert alert-danger small">${t('js.network_error')}${err.message}</div>`;
        }
    });

    // ========================================================
    // Export: Copy to clipboard
    // ========================================================
    document.getElementById('btnCopyConfig').addEventListener('click', () => {
        const result = builder.build();
        if (result.config) {
            navigator.clipboard.writeText(result.config).then(() => {
                const btn = document.getElementById('btnCopyConfig');
                btn.innerHTML = `<i class="fas fa-check me-1"></i>${t('js.copied')}`;
                setTimeout(() => {
                    btn.innerHTML = `<i class="fas fa-copy me-1"></i>${t('js.copy_to_clipboard')}`;
                }, 2000);
            });
        }
    });

    document.getElementById('btnCopyPreview').addEventListener('click', () => {
        const result = builder.build();
        if (result.config) {
            navigator.clipboard.writeText(result.config);
        }
    });

    // ========================================================
    // CORS toggle and options
    // ========================================================
    document.getElementById('enableCors').addEventListener('change', function () {
        document.getElementById('corsOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    document.getElementById('corsOriginMode').addEventListener('change', function () {
        document.getElementById('corsCustomOriginSection').classList.toggle('d-none', this.value !== 'custom');
        updatePreview();
    });

    document.getElementById('addCorsHeaderPreset').addEventListener('click', function () {
        const preset = document.getElementById('corsHeaderPreset').value;
        if (!preset) return;
        const input = document.getElementById('corsAllowHeaders');
        const current = input.value.trim();
        if (current && !current.split(',').map(s => s.trim()).includes(preset)) {
            input.value = current + ', ' + preset;
        } else if (!current) {
            input.value = preset;
        }
        document.getElementById('corsHeaderPreset').value = '';
        updatePreview();
    });

    // ========================================================
    // WebSocket info visibility
    // ========================================================
    function updateWebsocketInfo() {
        const wsInfo = document.getElementById('websocketInfo');
        if (!wsInfo) return;
        const hasUpstream = Array.from(document.querySelectorAll('.upstream-address')).some(input => input.value.trim() !== '');
        wsInfo.classList.toggle('d-none', !hasUpstream);
    }

    document.getElementById('upstreamList').addEventListener('input', updateWebsocketInfo);
    document.getElementById('upstreamList').addEventListener('change', updateWebsocketInfo);

    // ========================================================
    // Path-based routing toggle and rules
    // ========================================================
    document.getElementById('enablePathRouting').addEventListener('change', function () {
        document.getElementById('pathRoutingOptions').classList.toggle('d-none', !this.checked);
        updatePreview();
    });

    function createPathRuleRow() {
        const row = document.createElement('div');
        row.className = 'path-rule-row card card-body mb-2 p-2';
        row.innerHTML = `
            <div class="row g-2 align-items-end">
                <div class="col-md-3">
                    <label class="form-label small" data-i18n="section_proxy.path_routing_path_label">${t('section_proxy.path_routing_path_label')}</label>
                    <input type="text" class="form-control form-control-sm path-rule-path" data-i18n-placeholder="section_proxy.path_routing_path_placeholder" placeholder="${t('section_proxy.path_routing_path_placeholder')}">
                </div>
                <div class="col-md-3">
                    <label class="form-label small" data-i18n="section_proxy.path_routing_match_label">${t('section_proxy.path_routing_match_label')}</label>
                    <select class="form-select form-select-sm path-rule-match">
                        <option value="path_prefix">${t('section_proxy.path_routing_match_prefix')}</option>
                        <option value="path">${t('section_proxy.path_routing_match_exact')}</option>
                        <option value="not">${t('section_proxy.path_routing_match_not')}</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label small" data-i18n="section_proxy.path_routing_dest_label">${t('section_proxy.path_routing_dest_label')}</label>
                    <input type="text" class="form-control form-control-sm path-rule-dest" data-i18n-placeholder="section_proxy.path_routing_dest_placeholder" placeholder="${t('section_proxy.path_routing_dest_placeholder')}">
                </div>
                <div class="col-md-2">
                    <div class="form-check form-check-sm">
                        <input class="form-check-input path-rule-strip" type="checkbox" checked>
                        <label class="form-check-label small" data-i18n="section_proxy.path_routing_strip_label">${t('section_proxy.path_routing_strip_label')}</label>
                    </div>
                </div>
                <div class="col-md-1">
                    <button class="btn btn-sm btn-outline-danger remove-path-rule-btn" type="button" title="${t('section_proxy.path_routing_remove_rule')}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        row.querySelector('.remove-path-rule-btn').addEventListener('click', function () {
            row.remove();
            updatePreview();
        });
        row.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        });
        return row;
    }

    document.getElementById('addPathRule').addEventListener('click', function () {
        const container = document.getElementById('pathRoutingRules');
        container.appendChild(createPathRuleRow());
        updatePreview();
    });

    // ========================================================
    // Hostname change -> auto-fill log path
    // ========================================================
    let logPathManuallyEdited = false;
    document.getElementById('logFilePath').addEventListener('focus', () => { logPathManuallyEdited = true; });

    document.getElementById('hostname').addEventListener('input', function () {
        if (!logPathManuallyEdited) {
            const hostname = this.value.trim();
            if (hostname) {
                const safeName = hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
                document.getElementById('logFilePath').value = `/var/log/caddy/${safeName}.log`;
            }
        }
        updatePreview();
    });

    // Set default log path on load
    (function() {
        const hostname = document.getElementById('hostname').value.trim();
        if (hostname) {
            const safeName = hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
            document.getElementById('logFilePath').value = `/var/log/caddy/${safeName}.log`;
        }
    })();

    // ========================================================
    // Keycloak / Forward Auth toggle
    // ========================================================
    const kcToggle = document.getElementById('enableKeycloak');
    if (kcToggle) {
        kcToggle.addEventListener('change', function () {
            document.getElementById('keycloakOptions').classList.toggle('d-none', !this.checked);
            updatePreview();
        });
    }

    // ========================================================
    // Open existing .caddy file (file upload)
    // ========================================================
    document.getElementById('btnLoadFile').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            openRawEditor(file.name, content);
        };
        reader.readAsText(file);
        this.value = ''; // reset for re-upload
    });

    // ========================================================
    // Raw config editor (open, edit, save)
    // ========================================================
    function openRawEditor(filename, content) {
        document.getElementById('rawEditorCard').classList.remove('d-none');
        document.getElementById('rawEditorFilename').textContent = filename;
        document.getElementById('rawEditorContent').value = content;
        document.getElementById('rawEditorCard').scrollIntoView({ behavior: 'smooth' });
    }

    document.getElementById('btnCloseRawEditor').addEventListener('click', () => {
        document.getElementById('rawEditorCard').classList.add('d-none');
    });

    document.getElementById('btnSaveRawEditor').addEventListener('click', async () => {
        const filename = document.getElementById('rawEditorFilename').textContent;
        const content = document.getElementById('rawEditorContent').value;
        // Extract hostname from filename (remove .caddy extension)
        const hostname = filename.replace(/\.caddy$/, '');

        try {
            const resp = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostname, config: content })
            });
            const data = await resp.json();
            if (data.success) {
                alert(`${t('js.saved_as')} ${data.filename}`);
                loadSavedConfigs();
            } else {
                alert(t('js.network_error') + (data.error || t('js.unknown_error')));
            }
        } catch (err) {
            alert(t('js.network_error') + err.message);
        }
    });

    // ========================================================
    // Caddy version check (periodic)
    // ========================================================
    async function checkCaddyVersion() {
        const badgeEl = document.getElementById('caddyVersionBadge');
        const footerEl = document.getElementById('footerCaddyVersion');
        const locale = window.currentLang === 'en' ? 'en-GB' : 'sv-SE';
        try {
            const resp = await fetch('/api/caddy-version');
            const data = await resp.json();
            if (data.latest_version) {
                badgeEl.className = 'badge bg-success';
                badgeEl.innerHTML = `<i class="fas fa-check-circle me-1"></i>Caddy ${data.latest_version}`;
                badgeEl.title = `${t('js.latest_version')}: ${data.latest_version} (${t('js.checked_at')}: ${new Date(data.checked_at).toLocaleString(locale)})`;
                if (footerEl) footerEl.textContent = `${t('js.latest_caddy')}: ${data.latest_version}`;
                if (data.release_notes_url) {
                    badgeEl.onclick = () => window.open(data.release_notes_url, '_blank');
                }
                if (data.doc_updates && data.doc_updates.length > 0) {
                    badgeEl.innerHTML += ` <span class="badge bg-warning text-dark ms-1" title="${t('js.new_docs_available')}">DOC</span>`;
                }
            } else {
                badgeEl.className = 'badge bg-warning text-dark';
                badgeEl.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>${t('js.could_not_fetch_version')}`;
                if (footerEl) footerEl.textContent = t('js.could_not_check_version');
            }
        } catch (err) {
            badgeEl.className = 'badge bg-secondary';
            badgeEl.innerHTML = `<i class="fas fa-wifi me-1"></i>${t('js.offline_no_check')}`;
            if (footerEl) footerEl.textContent = t('js.offline');
        }
    }

    // Check version on load and every 30 minutes
    checkCaddyVersion();
    setInterval(checkCaddyVersion, 30 * 60 * 1000);

    document.getElementById('caddyVersionBadge').addEventListener('click', checkCaddyVersion);

    // ========================================================
    // Saved configs list (with edit button)
    // ========================================================
    async function loadSavedConfigs() {
        try {
            const resp = await fetch('/api/list-configs');
            const data = await resp.json();
            const listEl = document.getElementById('savedConfigsList');

            if (data.configs.length === 0) {
                listEl.innerHTML = `<div class="list-group-item text-muted small">${t('js.no_saved_configs')}</div>`;
                return;
            }

            listEl.innerHTML = data.configs.map(c => `
                <div class="list-group-item saved-config-item flex-column align-items-stretch">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="config-name">${escapeHtml(c.filename)}</span>
                            <small class="text-muted ms-2">${formatSize(c.size)}</small>
                        </div>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-info btn-history-config" data-filename="${escapeHtml(c.filename)}" title="${t('history.title')}">
                                <i class="fas fa-history"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning btn-edit-config" data-filename="${escapeHtml(c.filename)}" title="${t('js.edit_tooltip')}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <a href="/api/download-config/${encodeURIComponent(c.filename)}" class="btn btn-sm btn-outline-primary" title="${t('js.download_tooltip')}">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    </div>
                    <div class="history-panel d-none mt-2" id="history-${escapeHtml(c.filename).replace(/\./g, '-')}"></div>
                </div>
            `).join('');

            // Attach edit handlers
            listEl.querySelectorAll('.btn-edit-config').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const filename = btn.dataset.filename;
                    try {
                        const resp = await fetch(`/api/download-config/${encodeURIComponent(filename)}`);
                        const text = await resp.text();
                        openRawEditor(filename, text);
                    } catch (err) {
                        alert(t('js.could_not_load_file') + err.message);
                    }
                });
            });

            // Attach history handlers
            listEl.querySelectorAll('.btn-history-config').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const filename = btn.dataset.filename;
                    const panelId = 'history-' + filename.replace(/\./g, '-');
                    const panel = document.getElementById(panelId);
                    if (!panel) return;

                    // Toggle visibility
                    if (!panel.classList.contains('d-none')) {
                        panel.classList.add('d-none');
                        return;
                    }
                    panel.classList.remove('d-none');
                    panel.innerHTML = `<small class="text-muted">${t('history.title')}...</small>`;

                    try {
                        const resp = await fetch(`/api/config-history/${encodeURIComponent(filename)}`);
                        const data = await resp.json();
                        if (!data.versions || data.versions.length === 0) {
                            panel.innerHTML = `<small class="text-muted">${t('history.no_versions')}</small>`;
                            return;
                        }
                        panel.innerHTML = `<strong class="small">${t('history.title')}</strong>` +
                            data.versions.map(v => {
                                const ts = v.timestamp.replace('-', ' ');
                                return `<div class="d-flex justify-content-between align-items-center small py-1 border-top">
                                    <span>${t('history.version_from')} ${ts} <span class="text-muted">(${formatSize(v.size)})</span></span>
                                    <button class="btn btn-sm btn-outline-secondary btn-restore-version py-0 px-2" data-history-file="${escapeHtml(v.filename)}">${t('history.restore')}</button>
                                </div>`;
                            }).join('');

                        panel.querySelectorAll('.btn-restore-version').forEach(rbtn => {
                            rbtn.addEventListener('click', async () => {
                                const histFile = rbtn.dataset.historyFile;
                                try {
                                    const r = await fetch(`/api/config-history-content/${encodeURIComponent(histFile)}`);
                                    const d = await r.json();
                                    if (d.content) {
                                        openRawEditor(filename, d.content);
                                    }
                                } catch (e) {
                                    alert(t('js.network_error') + e.message);
                                }
                            });
                        });
                    } catch (err) {
                        panel.innerHTML = `<small class="text-danger">${t('js.network_error')}</small>`;
                    }
                });
            });
        } catch (err) {
            document.getElementById('savedConfigsList').innerHTML =
                `<div class="list-group-item text-danger small">${t('js.could_not_load_configs')}</div>`;
        }
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        return (bytes / 1024).toFixed(1) + ' KB';
    }

    document.getElementById('btnRefreshConfigs').addEventListener('click', loadSavedConfigs);

    // ========================================================
    // Feature 4: Global Trusted Proxies toggle
    // ========================================================
    const globalTpToggle = document.getElementById('enableGlobalTrustedProxies');
    if (globalTpToggle) {
        globalTpToggle.addEventListener('change', function () {
            document.getElementById('globalTrustedProxiesOptions').classList.toggle('d-none', !this.checked);
            updatePreview();
        });
    }

    const globalTpPreset = document.getElementById('globalTrustedProxiesPreset');
    if (globalTpPreset) {
        globalTpPreset.addEventListener('change', function () {
            document.getElementById('globalTrustedProxiesCustom').classList.toggle('d-none', this.value !== 'custom');
            updatePreview();
        });
    }

    // ========================================================
    // Feature 2: Error Pages toggle and management
    // ========================================================
    const errorPagesToggle = document.getElementById('enableErrorPages');
    if (errorPagesToggle) {
        errorPagesToggle.addEventListener('change', function () {
            document.getElementById('errorPagesSection').classList.toggle('d-none', !this.checked);
            updatePreview();
        });
    }

    function attachErrorPageRowEvents(row) {
        row.querySelector('.remove-error-page-btn').addEventListener('click', () => {
            if (document.querySelectorAll('#errorPageRules .error-page-row').length > 1) {
                row.remove();
                updatePreview();
            }
        });
        row.querySelector('.error-page-status').addEventListener('change', updatePreview);
        row.querySelector('.error-page-message').addEventListener('input', updatePreview);
    }

    // Attach to initial error page row
    document.querySelectorAll('#errorPageRules .error-page-row').forEach(row => attachErrorPageRowEvents(row));

    const addErrorPageBtn = document.getElementById('addErrorPage');
    if (addErrorPageBtn) {
        addErrorPageBtn.addEventListener('click', () => {
            const container = document.getElementById('errorPageRules');
            const row = document.createElement('div');
            row.className = 'row error-page-row mb-2 align-items-center';
            row.innerHTML = `
                <div class="col-3">
                    <label class="form-label form-label-sm mb-1">${t('section8.error_status_label')}</label>
                    <select class="form-select form-select-sm error-page-status">
                        <option value="404">404 – Not Found</option>
                        <option value="500">500 – Internal Server Error</option>
                        <option value="502">502 – Bad Gateway</option>
                        <option value="503">503 – Service Unavailable</option>
                        <option value="504">504 – Gateway Timeout</option>
                    </select>
                </div>
                <div class="col-7">
                    <label class="form-label form-label-sm mb-1">${t('section8.error_message_label')}</label>
                    <input type="text" class="form-control form-control-sm error-page-message" placeholder="${t('section8.error_message_placeholder')}">
                </div>
                <div class="col-2 d-flex align-items-end">
                    <button class="btn btn-sm btn-outline-danger remove-error-page-btn"><i class="fas fa-times"></i></button>
                </div>
            `;
            container.appendChild(row);
            attachErrorPageRowEvents(row);
            updatePreview();
        });
    }

    // ========================================================
    // Feature 3: Body Limit toggle + dropdown
    // ========================================================
    const bodyLimitToggle = document.getElementById('enableBodyLimit');
    if (bodyLimitToggle) {
        bodyLimitToggle.addEventListener('change', function () {
            document.getElementById('bodyLimitSection').classList.toggle('d-none', !this.checked);
            syncBodyLimitValue();
            updatePreview();
        });
    }

    const bodyLimitPreset = document.getElementById('bodyLimitPreset');
    if (bodyLimitPreset) {
        bodyLimitPreset.addEventListener('change', function () {
            document.getElementById('bodyLimitCustomGroup').classList.toggle('d-none', this.value !== 'custom');
            syncBodyLimitValue();
            updatePreview();
        });
    }

    const bodyLimitCustom = document.getElementById('bodyLimitCustom');
    if (bodyLimitCustom) {
        bodyLimitCustom.addEventListener('input', function () {
            syncBodyLimitValue();
            updatePreview();
        });
    }

    function syncBodyLimitValue() {
        const enabled = document.getElementById('enableBodyLimit') && document.getElementById('enableBodyLimit').checked;
        const hidden = document.getElementById('requestBodyMaxSize');
        if (!enabled || !hidden) {
            if (hidden) hidden.value = '';
            return;
        }
        const preset = document.getElementById('bodyLimitPreset').value;
        if (preset === 'custom') {
            hidden.value = (document.getElementById('bodyLimitCustom') || {}).value || '';
        } else {
            hidden.value = preset;
        }
    }

    // ========================================================
    // Feature 1: Redirect rules management
    // ========================================================
    function attachRedirectRowEvents(row) {
        row.querySelector('.remove-redirect-btn').addEventListener('click', () => {
            if (document.querySelectorAll('#redirectRules .redirect-rule-row').length > 1) {
                row.remove();
                updatePreview();
            }
        });
        row.querySelector('.redirect-from').addEventListener('input', updatePreview);
        row.querySelector('.redirect-to').addEventListener('input', updatePreview);
        row.querySelector('.redirect-status').addEventListener('change', updatePreview);
    }

    // Attach to initial redirect row
    document.querySelectorAll('#redirectRules .redirect-rule-row').forEach(row => attachRedirectRowEvents(row));

    const addRedirectBtn = document.getElementById('addRedirect');
    if (addRedirectBtn) {
        addRedirectBtn.addEventListener('click', () => {
            const container = document.getElementById('redirectRules');
            const row = document.createElement('div');
            row.className = 'row redirect-rule-row mb-2 align-items-end';
            row.innerHTML = `
                <div class="col-md-3">
                    <label class="form-label form-label-sm mb-1">${t('section11.from_label')}</label>
                    <input type="text" class="form-control form-control-sm redirect-from" placeholder="${t('section11.from_placeholder')}">
                </div>
                <div class="col-md-3">
                    <label class="form-label form-label-sm mb-1">${t('section11.to_label')}</label>
                    <input type="text" class="form-control form-control-sm redirect-to" placeholder="${t('section11.to_placeholder')}">
                </div>
                <div class="col-md-4">
                    <label class="form-label form-label-sm mb-1">${t('section11.status_label')}</label>
                    <select class="form-select form-select-sm redirect-status">
                        <option value="301">${t('section11.status_301')}</option>
                        <option value="302">${t('section11.status_302')}</option>
                        <option value="307">${t('section11.status_307')}</option>
                        <option value="308">${t('section11.status_308')}</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button class="btn btn-sm btn-outline-danger remove-redirect-btn"><i class="fas fa-times"></i></button>
                </div>
            `;
            container.appendChild(row);
            attachRedirectRowEvents(row);
            updatePreview();
        });
    }

    // ========================================================
    // Preset / Template system
    // ========================================================
    function applyPreset(presetName) {
        // Reset all checkboxes and inputs first
        document.querySelectorAll('#configAccordion input[type="checkbox"]').forEach(cb => {
            // Preserve some defaults
            if (cb.id === 'autoHttps') { cb.checked = true; return; }
            if (cb.id === 'encodeZstd' || cb.id === 'encodeGzip') return; // handled per preset
            cb.checked = false;
        });

        switch (presetName) {
            case 'simple':
                // Just hostname + one backend, nothing else
                document.getElementById('hostname').focus();
                break;

            case 'secure':
                // Enable security headers, compression, logging
                document.getElementById('enableLogging').checked = true;
                document.getElementById('loggingOptions').classList.remove('d-none');
                document.getElementById('enableEncode').checked = true;
                document.getElementById('encodeOptions').classList.remove('d-none');
                document.getElementById('encodeZstd').checked = true;
                document.getElementById('encodeGzip').checked = true;
                document.getElementById('headerHSTS').checked = true;
                document.getElementById('headerXFrameOptions').checked = true;
                document.getElementById('headerXContentType').checked = true;
                document.getElementById('headerReferrerPolicy').checked = true;
                document.getElementById('headerRemoveServer').checked = true;
                document.getElementById('hostname').focus();
                break;

            case 'loadbalanced':
                // Secure + multiple upstreams + health checks
                document.getElementById('enableLogging').checked = true;
                document.getElementById('loggingOptions').classList.remove('d-none');
                document.getElementById('enableEncode').checked = true;
                document.getElementById('encodeOptions').classList.remove('d-none');
                document.getElementById('encodeZstd').checked = true;
                document.getElementById('encodeGzip').checked = true;
                document.getElementById('headerHSTS').checked = true;
                document.getElementById('headerXFrameOptions').checked = true;
                document.getElementById('headerXContentType').checked = true;
                document.getElementById('headerReferrerPolicy').checked = true;
                document.getElementById('headerRemoveServer').checked = true;
                // Add a second upstream row
                document.getElementById('addUpstream').click();
                // Enable health checks
                document.getElementById('enableHealthCheck').checked = true;
                document.getElementById('healthCheckOptions').classList.remove('d-none');
                document.getElementById('hostname').focus();
                break;

            case 'blank':
                // Everything off
                document.getElementById('hostname').focus();
                break;
        }

        // Trigger all change events
        document.querySelectorAll('#configAccordion input, #configAccordion select').forEach(el => {
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        updatePreview();
    }

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', function () {
            applyPreset(this.dataset.preset);
            // Briefly highlight the chosen button
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Welcome card hide
    const hideWelcomeCheckbox = document.getElementById('hideWelcome');
    if (hideWelcomeCheckbox) {
        if (localStorage.getItem('caddyconfer_hide_welcome') === 'true') {
            document.getElementById('welcomeCard').classList.add('d-none');
        }
        hideWelcomeCheckbox.addEventListener('change', function () {
            if (this.checked) {
                document.getElementById('welcomeCard').classList.add('d-none');
                localStorage.setItem('caddyconfer_hide_welcome', 'true');
            } else {
                localStorage.removeItem('caddyconfer_hide_welcome');
            }
        });
    }

    // ========================================================
    // Language toggle
    // ========================================================
    const langToggleBtn = document.getElementById('langToggle');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            const newLang = window.currentLang === 'sv' ? 'en' : 'sv';
            setLanguage(newLang);
        });
    }

    // ========================================================
    // Dark mode toggle
    // ========================================================
    const darkModeBtn = document.getElementById('btnDarkMode');
    const savedTheme = localStorage.getItem('caddyconfer-theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        darkModeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    darkModeBtn.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.body.removeAttribute('data-theme');
            darkModeBtn.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('caddyconfer-theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            darkModeBtn.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('caddyconfer-theme', 'dark');
        }
    });

    window.addEventListener('languageChanged', () => {
        updatePreview();
        updateRecommendations();
        loadSavedConfigs();
        checkCaddyVersion();
    });

    // ========================================================
    // Git Push & Status
    // ========================================================
    document.getElementById('btnGitPush')?.addEventListener('click', async () => {
        const remoteUrl = document.getElementById('gitRemoteUrl').value.trim();
        const branch = document.getElementById('gitBranch').value.trim() || 'main';
        const commitMessage = document.getElementById('gitCommitMessage').value.trim() || 'Update Caddy configuration';
        const resultEl = document.getElementById('gitResult');

        if (!remoteUrl) {
            resultEl.innerHTML = `<div class="alert alert-warning mt-2">${t('git.error_no_remote')}</div>`;
            return;
        }

        resultEl.innerHTML = `<div class="alert alert-info mt-2"><i class="fas fa-spinner fa-spin me-1"></i>${t('git.pushing')}</div>`;

        try {
            const resp = await fetch('/api/git-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remote_url: remoteUrl, branch, commit_message: commitMessage })
            });
            const data = await resp.json();
            if (data.success) {
                resultEl.innerHTML = `<div class="alert alert-success mt-2"><i class="fas fa-check-circle me-1"></i>${t('git.push_success')}</div>`;
            } else {
                resultEl.innerHTML = `<div class="alert alert-danger mt-2"><i class="fas fa-times-circle me-1"></i>${data.error || t('git.push_error')}</div>`;
            }
        } catch (e) {
            resultEl.innerHTML = `<div class="alert alert-danger mt-2">${t('git.push_error')}: ${e.message}</div>`;
        }
    });

    document.getElementById('btnGitStatus')?.addEventListener('click', async () => {
        const resultEl = document.getElementById('gitResult');
        resultEl.innerHTML = `<div class="alert alert-info mt-2"><i class="fas fa-spinner fa-spin me-1"></i>${t('git.checking')}</div>`;
        try {
            const resp = await fetch('/api/git-status');
            const data = await resp.json();
            let html = '<div class="alert alert-info mt-2">';
            html += `<strong>${t('git.status_title')}</strong><br>`;
            html += `${t('git.status_repo')}: ${data.is_repo ? '✅' : '❌'}<br>`;
            if (data.remote_url) html += `${t('git.status_remote')}: ${data.remote_url}<br>`;
            if (data.branch) html += `${t('git.status_branch')}: ${data.branch}<br>`;
            if (data.status) html += `<pre class="mb-0 mt-1" style="font-size:0.8em">${data.status}</pre>`;
            html += '</div>';
            resultEl.innerHTML = html;
        } catch (e) {
            resultEl.innerHTML = `<div class="alert alert-danger mt-2">${t('git.status_error')}: ${e.message}</div>`;
        }
    });

    // ========================================================
    // Release Notes
    // ========================================================
    document.getElementById('releaseNotesModal')?.addEventListener('show.bs.modal', async () => {
        const container = document.getElementById('releaseNotesContent');
        container.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin me-1"></i> Loading...</div>';
        try {
            const resp = await fetch('/api/release-notes');
            const data = await resp.json();
            if (data.content) {
                // Simple markdown to HTML conversion
                let html = data.content
                    .replace(/^### (.+)$/gm, '<h5 class="mt-3">$1</h5>')
                    .replace(/^## (.+)$/gm, '<h4 class="mt-4 mb-2 border-bottom pb-1">$1</h4>')
                    .replace(/^# (.+)$/gm, '<h3 class="mt-4 mb-3">$1</h3>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.+?)`/g, '<code>$1</code>')
                    .replace(/^- (.+)$/gm, '<li>$1</li>')
                    .replace(/^---$/gm, '<hr>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/<\/li>\n<li>/g, '</li><li>');
                // Wrap consecutive <li> in <ul>
                html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');
                container.innerHTML = `<div class="release-notes-rendered">${html}</div>`;
            } else {
                container.innerHTML = '<div class="alert alert-warning">Release notes not found.</div>';
            }
        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger">Failed to load release notes: ${e.message}</div>`;
        }
    });

    // ========================================================
    // SSH Server Management
    // ========================================================
    let sshSessionId = null;

    // Toggle auth method fields
    document.querySelectorAll('input[name="sshAuthType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const isKey = document.getElementById('sshAuthKey').checked;
            document.getElementById('sshPasswordFields').classList.toggle('d-none', isKey);
            document.getElementById('sshKeyFields').classList.toggle('d-none', !isKey);
        });
    });

    // Upload key file
    document.getElementById('btnUploadKey')?.addEventListener('click', () => {
        document.getElementById('sshKeyFileInput').click();
    });
    document.getElementById('sshKeyFileInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('sshPrivateKey').value = ev.target.result;
            };
            reader.readAsText(file);
        }
    });

    // Connect
    document.getElementById('btnSshConnect')?.addEventListener('click', async () => {
        const host = document.getElementById('sshHost').value.trim();
        const port = parseInt(document.getElementById('sshPort').value) || 22;
        const username = document.getElementById('sshUsername').value.trim();
        const remotePath = document.getElementById('sshRemotePath').value.trim();
        const authType = document.querySelector('input[name="sshAuthType"]:checked').value;
        const resultEl = document.getElementById('sshConnectResult');
        
        if (!host || !username) {
            resultEl.innerHTML = `<div class="alert alert-warning">${t('ssh.error_host_user')}</div>`;
            return;
        }
        if (!remotePath) {
            resultEl.innerHTML = `<div class="alert alert-warning">${t('ssh.error_remote_path')}</div>`;
            return;
        }
        
        const payload = { host, port, username, auth_type: authType, remote_path: remotePath };
        if (authType === 'password') {
            payload.password = document.getElementById('sshPassword').value;
        } else {
            payload.private_key = document.getElementById('sshPrivateKey').value;
            payload.key_passphrase = document.getElementById('sshKeyPassphrase').value;
        }
        
        resultEl.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-1"></i>${t('ssh.connecting')}</div>`;
        
        try {
            const resp = await fetch('/api/ssh/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await resp.json();
            if (data.success) {
                sshSessionId = data.session_id;
                document.getElementById('sshConnectForm').classList.add('d-none');
                document.getElementById('sshConnectedPanel').classList.remove('d-none');
                document.getElementById('sshConnectedInfo').textContent = `${username}@${host}:${port} — ${remotePath}`;
                document.getElementById('sshStatusBadge').className = 'badge bg-success';
                document.getElementById('sshStatusBadge').textContent = t('ssh.status_connected');
                resultEl.innerHTML = '';
                // Load file list
                loadSshFiles();
            } else {
                resultEl.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle me-1"></i>${data.error}</div>`;
            }
        } catch (e) {
            resultEl.innerHTML = `<div class="alert alert-danger">${t('ssh.connect_error')}: ${e.message}</div>`;
        }
    });

    // Disconnect
    document.getElementById('btnSshDisconnect')?.addEventListener('click', async () => {
        if (!sshSessionId) return;
        try {
            await fetch('/api/ssh/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sshSessionId })
            });
        } catch (e) { /* ignore */ }
        sshSessionId = null;
        document.getElementById('sshConnectForm').classList.remove('d-none');
        document.getElementById('sshConnectedPanel').classList.add('d-none');
        document.getElementById('sshStatusBadge').className = 'badge bg-secondary';
        document.getElementById('sshStatusBadge').textContent = t('ssh.status_disconnected');
        document.getElementById('sshFileList').innerHTML = '';
    });

    // Load remote files
    async function loadSshFiles() {
        if (!sshSessionId) return;
        const tbody = document.getElementById('sshFileList');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>`;
        try {
            const resp = await fetch('/api/ssh/list-files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sshSessionId })
            });
            const data = await resp.json();
            if (data.files && data.files.length > 0) {
                tbody.innerHTML = data.files.map(f => `
                    <tr>
                        <td><i class="fas fa-file-code me-1 text-muted"></i>${f.filename}</td>
                        <td class="text-muted small">${(f.size / 1024).toFixed(1)} KB</td>
                        <td class="text-muted small">${f.modified || ''}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary ssh-download-btn" data-filename="${f.filename}" title="${t('ssh.btn_download')}">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-info ssh-edit-btn ms-1" data-filename="${f.filename}" title="${t('ssh.btn_edit')}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
                // Attach download handlers
                tbody.querySelectorAll('.ssh-download-btn').forEach(btn => {
                    btn.addEventListener('click', () => downloadSshFile(btn.dataset.filename));
                });
                tbody.querySelectorAll('.ssh-edit-btn').forEach(btn => {
                    btn.addEventListener('click', () => editSshFile(btn.dataset.filename));
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center">${t('ssh.no_files')}</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-danger">${e.message}</td></tr>`;
        }
    }

    async function downloadSshFile(filename) {
        if (!sshSessionId) return;
        try {
            const resp = await fetch('/api/ssh/download-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sshSessionId, filename })
            });
            const data = await resp.json();
            if (data.content) {
                // Save locally and show in raw editor
                const blob = new Blob([data.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
                document.getElementById('sshActionResult').innerHTML = 
                    `<div class="alert alert-success alert-sm mt-2"><i class="fas fa-check me-1"></i>${t('ssh.downloaded')}: ${filename}</div>`;
            }
        } catch (e) {
            document.getElementById('sshActionResult').innerHTML = 
                `<div class="alert alert-danger mt-2">${e.message}</div>`;
        }
    }

    async function editSshFile(filename) {
        if (!sshSessionId) return;
        const resultEl = document.getElementById('sshActionResult');
        resultEl.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-1"></i>${t('ssh.loading_file')}</div>`;
        try {
            const resp = await fetch('/api/ssh/download-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sshSessionId, filename })
            });
            const data = await resp.json();
            if (data.content !== undefined) {
                // Show in raw editor
                const editorCard = document.getElementById('rawEditorCard');
                editorCard.classList.remove('d-none');
                document.getElementById('rawEditorFilename').textContent = `[SSH] ${filename}`;
                document.getElementById('rawEditorContent').value = data.content;
                // Override save button to upload via SSH
                const saveBtn = document.getElementById('btnSaveRawEditor');
                const newSave = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSave, saveBtn);
                newSave.addEventListener('click', async () => {
                    const content = document.getElementById('rawEditorContent').value;
                    try {
                        const uploadResp = await fetch('/api/ssh/upload-file', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ session_id: sshSessionId, filename, content })
                        });
                        const uploadData = await uploadResp.json();
                        if (uploadData.success) {
                            resultEl.innerHTML = `<div class="alert alert-success"><i class="fas fa-check me-1"></i>${t('ssh.file_saved')}: ${filename}</div>`;
                            loadSshFiles();
                        } else {
                            resultEl.innerHTML = `<div class="alert alert-danger">${uploadData.error}</div>`;
                        }
                    } catch (e) {
                        resultEl.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
                    }
                });
                editorCard.scrollIntoView({ behavior: 'smooth' });
                resultEl.innerHTML = '';
            }
        } catch (e) {
            resultEl.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
        }
    }

    // Refresh file list
    document.getElementById('btnSshRefresh')?.addEventListener('click', loadSshFiles);

    // Upload current config
    document.getElementById('btnSshUploadCurrent')?.addEventListener('click', async () => {
        if (!sshSessionId) return;
        const resultEl = document.getElementById('sshActionResult');
        const hostname = document.getElementById('hostname')?.value.trim();
        const config = document.getElementById('configPreview')?.textContent;
        if (!hostname || !config) {
            resultEl.innerHTML = `<div class="alert alert-warning">${t('ssh.error_no_config')}</div>`;
            return;
        }
        const filename = hostname.replace('*', '_wildcard_').replace(':', '_') + '.caddy';
        resultEl.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-1"></i>${t('ssh.uploading')}</div>`;
        try {
            const resp = await fetch('/api/ssh/upload-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sshSessionId, filename, content: config })
            });
            const data = await resp.json();
            if (data.success) {
                resultEl.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-1"></i>${t('ssh.upload_success')}: ${filename} — ${t('ssh.validating')}</div>`;
                loadSshFiles();
                // Auto-validate after upload
                try {
                    const valResp = await fetch('/api/ssh/validate-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: sshSessionId })
                    });
                    const valData = await valResp.json();
                    if (valData.valid) {
                        resultEl.innerHTML = `<div class="alert alert-success">
                            <i class="fas fa-check-circle me-1"></i>${t('ssh.upload_success')}: ${filename}<br>
                            <i class="fas fa-check-circle me-1"></i>${t('ssh.config_valid')}<br>
                            <pre class="mt-1 mb-2" style="font-size:0.8em">${valData.output || ''}</pre>
                            <button class="btn btn-warning btn-sm mt-1" id="btnSshReloadAfterValidate">
                                <i class="fas fa-redo me-1"></i>${t('ssh.btn_activate')}
                            </button>
                        </div>`;
                        document.getElementById('btnSshReloadAfterValidate')?.addEventListener('click', async () => {
                            resultEl.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-1"></i>${t('ssh.reloading')}</div>`;
                            try {
                                const rlResp = await fetch('/api/ssh/reload-caddy', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ session_id: sshSessionId })
                                });
                                const rlData = await rlResp.json();
                                if (rlData.success) {
                                    resultEl.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle me-1"></i>${t('ssh.reload_success')}</div>`;
                                } else {
                                    resultEl.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle me-1"></i>${rlData.error}</div>`;
                                }
                            } catch (rlErr) {
                                resultEl.innerHTML = `<div class="alert alert-danger">${rlErr.message}</div>`;
                            }
                        });
                    } else {
                        resultEl.innerHTML = `<div class="alert alert-warning">
                            <i class="fas fa-check me-1"></i>${t('ssh.upload_success')}: ${filename}<br>
                            <i class="fas fa-times-circle me-1"></i>${t('ssh.config_invalid')}<br>
                            <pre class="mt-1 mb-0" style="font-size:0.8em">${valData.output || ''}</pre>
                        </div>`;
                    }
                } catch (valErr) {
                    resultEl.innerHTML = `<div class="alert alert-warning">
                        <i class="fas fa-check me-1"></i>${t('ssh.upload_success')}: ${filename}<br>
                        <i class="fas fa-exclamation-triangle me-1"></i>${t('ssh.validate_error')}: ${valErr.message}
                    </div>`;
                }
            } else {
                resultEl.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            }
        } catch (e) {
            resultEl.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
        }
    });

    // Validate config on remote
    document.getElementById('btnSshValidate')?.addEventListener('click', async () => {
        if (!sshSessionId) return;
        const resultEl = document.getElementById('sshActionResult');
        resultEl.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-1"></i>${t('ssh.validating')}</div>`;
        try {
            const resp = await fetch('/api/ssh/validate-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sshSessionId })
            });
            const data = await resp.json();
            if (data.valid) {
                resultEl.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle me-1"></i>${t('ssh.config_valid')}</div>`;
            } else {
                resultEl.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle me-1"></i>${t('ssh.config_invalid')}<pre class="mt-1 mb-0" style="font-size:0.8em">${data.output}</pre></div>`;
            }
        } catch (e) {
            resultEl.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
        }
    });

    // Reload Caddy
    document.getElementById('btnSshReload')?.addEventListener('click', async () => {
        if (!sshSessionId) return;
        const resultEl = document.getElementById('sshActionResult');
        if (!confirm(t('ssh.confirm_reload'))) return;
        resultEl.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-1"></i>${t('ssh.reloading')}</div>`;
        try {
            const resp = await fetch('/api/ssh/reload-caddy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sshSessionId })
            });
            const data = await resp.json();
            if (data.success) {
                resultEl.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle me-1"></i>${t('ssh.reload_success')}</div>`;
            } else {
                resultEl.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle me-1"></i>${data.error}<pre class="mt-1 mb-0" style="font-size:0.8em">${data.output || ''}</pre></div>`;
            }
        } catch (e) {
            resultEl.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
        }
    });

    // ========================================================
    // Initialize
    // ========================================================
    loadSavedConfigs();
    updatePreview();
});
