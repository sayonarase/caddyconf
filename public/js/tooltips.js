/**
 * CaddyConfer – Tooltip descriptions for all Caddy options
 * Each entry provides a detailed explanation, and version notes where applicable.
 */
const TOOLTIPS = {
    // Load balancing policies
    lbPolicies: {
        round_robin: {
            title: 'Round Robin',
            desc: 'Fördelar trafik jämnt mellan alla backends i tur och ordning. Enklaste och vanligaste metoden.',
            version: ''
        },
        least_conn: {
            title: 'Least Connections',
            desc: 'Skickar trafik till den backend med minst aktiva anslutningar. Bra när backend-servrar har varierande kapacitet.',
            version: ''
        },
        first: {
            title: 'First Available',
            desc: 'Skickar alltid till den första tillgängliga backend i listan. Bra för primary/fallback-scenarier.',
            version: ''
        },
        random: {
            title: 'Random',
            desc: 'Väljer slumpmässigt bland alla tillgängliga backends. Enkelt och effektivt för homogena backends.',
            version: ''
        },
        ip_hash: {
            title: 'IP Hash',
            desc: 'Hashar klientens IP-adress för att konsistent välja samma backend. Ger "session stickiness" utan cookies.',
            version: ''
        },
        uri_hash: {
            title: 'URI Hash',
            desc: 'Hashar request-URI:n för att konsistent välja samma backend. Bra för caching-scenarier.',
            version: ''
        },
        cookie: {
            title: 'Cookie-baserad',
            desc: 'Använder en cookie för att konsistent dirigera samma klient till samma backend. Bäst för session-baserade applikationer.',
            version: ''
        },
        header: {
            title: 'Header-baserad',
            desc: 'Hashar ett angivet header-värde för att välja backend. Användbart för API-routing baserat på t.ex. tenant-ID.',
            version: ''
        },
        random_choose: {
            title: 'Random Choose (Power of Two)',
            desc: 'Väljer slumpmässigt N backends och sedan den med minst anslutningar. Ger bättre fördelning än ren random.',
            version: 'v2.4+'
        }
    },

    // Client auth modes
    clientAuthModes: {
        require_and_verify: {
            title: 'Kräv och verifiera',
            desc: 'Klienten MÅSTE presentera ett certifikat som är signerat av en betrodd CA. Mest säkert.'
        },
        require: {
            title: 'Kräv',
            desc: 'Klienten MÅSTE presentera ett certifikat, men det behöver inte vara signerat av en betrodd CA.'
        },
        request: {
            title: 'Begär',
            desc: 'Caddy begär ett klientcertifikat men det är valfritt. Anslutningen lyckas oavsett.'
        },
        verify_if_given: {
            title: 'Verifiera om tillhandahållet',
            desc: 'Om klienten presenterar ett certifikat, verifieras det. Om inget certifikat ges, tillåts anslutningen ändå.'
        }
    },

    // Common security headers explanations
    headers: {
        hsts: {
            name: 'Strict-Transport-Security',
            desc: 'Instruerar webbläsaren att ALLTID använda HTTPS för denna domän under angiven tid (max-age). "includeSubDomains" gäller även för underdomäner. "preload" tillåter att domänen läggs in i webbläsarens HSTS-preload-lista.',
            value: 'max-age=31536000; includeSubDomains; preload',
            risk: 'Om du stänger av HTTPS efter att ha aktiverat HSTS kan besökare inte nå din sajt.'
        },
        xFrameOptions: {
            name: 'X-Frame-Options',
            desc: 'Förhindrar att sidan visas i en iframe (clickjacking-skydd). DENY blockerar alla iframes, SAMEORIGIN tillåter enbart iframes från samma domän.',
            risk: 'Om din applikation använder iframes (t.ex. betalningssidor) kan DENY bryta funktionalitet.'
        },
        xContentType: {
            name: 'X-Content-Type-Options',
            desc: 'Förhindrar MIME-sniffing: webbläsaren litar enbart på den Content-Type som servern anger. Skyddar mot attacker där en fil med skadlig JavaScript maskeras som en bild.',
            value: 'nosniff'
        },
        referrerPolicy: {
            name: 'Referrer-Policy',
            desc: 'Kontrollerar vilken referrer-information som delas vid navigering till andra sajter. "strict-origin-when-cross-origin" är en bra balans: full URL inom samma domän, enbart origin vid cross-origin, ingen referrer vid nedgradering till HTTP.'
        },
        csp: {
            name: 'Content-Security-Policy',
            desc: 'Definierar exakt vilka resurser (skript, stilar, bilder, fonter etc.) som får laddas och varifrån. Det kraftfullaste skyddet mot XSS. Kräver noggrann konfiguration per applikation.',
            risk: 'Felkonfigurerad CSP kan blockera helt legitima resurser och bryta applikationen.'
        },
        permissionsPolicy: {
            name: 'Permissions-Policy',
            desc: 'Kontrollerar vilka webbläsar-API:er (kamera, mikrofon, geolocation, betalning etc.) sidan och dess iframes får använda. Ersätter den äldre Feature-Policy-headern.',
            version: 'Ersätter Feature-Policy'
        },
        xXssProtection: {
            name: 'X-XSS-Protection',
            desc: 'Kontrollerar webbläsarens inbyggda XSS-filter. Värdet "0" inaktiverar det, vilket rekommenderas om CSP används. Det inbyggda filtret kan ibland orsaka problem och moderna webbläsare förlitar sig på CSP istället.'
        },
        removeServer: {
            name: '-Server',
            desc: 'Tar bort Server-headern från svaret. Detta döljer vilken webbserver som körs, vilket ger ett extra lager av "security through obscurity". Ej avgörande men god praxis.'
        }
    },

    // Encoding
    encoding: {
        zstd: {
            name: 'Zstandard (zstd)',
            desc: 'Zstandard ger betydligt bättre komprimeringsgrad och snabbhet jämfört med gzip. Stöds av Chrome, Firefox, Edge och Safari (sedan 2023). Rekommenderad som förstahands-komprimering.'
        },
        gzip: {
            name: 'Gzip',
            desc: 'Den äldsta och mest universellt stödda komprimeringsmetoden. Fungerar i alla webbläsare och HTTP-klienter. Något långsammare och sämre komprimering än zstd.'
        }
    }
};

// Make globally available
window.TOOLTIPS = TOOLTIPS;

/**
 * Descriptions for common HTTP headers used in the dropdown.
 */
const HEADER_DESCRIPTIONS = {
    // Caching
    'Cache-Control': 'Styr cachning i webbläsare och mellanlagrande proxyer. T.ex. "no-cache", "max-age=3600", "public".',
    'Pragma': 'Äldre HTTP/1.0 cachning-direktiv. Använd "no-cache" för bakåtkompatibilitet med gamla klienter.',
    'Vary': 'Anger vilka request-headers som påverkar cachningen. T.ex. "Accept-Encoding" för att separera gzip-cache.',
    'ETag': 'Unik identifierare för en resursversion. Används för conditional requests och effektiv caching.',

    // Security
    'X-Permitted-Cross-Domain-Policies': 'Kontrollerar om Flash/Acrobat får ladda data cross-domain. "none" blockerar allt.',
    'Cross-Origin-Opener-Policy': 'Isolerar browsing-kontexten. "same-origin" förhindrar att andra sidor interagerar via window.opener.',
    'Cross-Origin-Embedder-Policy': 'Kräver att inbäddade resurser har CORS eller COEP. "require-corp" aktiverar cross-origin isolation.',
    'Cross-Origin-Resource-Policy': 'Kontrollerar vilka origins som får bädda in resursen. "same-origin", "same-site" eller "cross-origin".',

    // Proxy
    'X-Forwarded-For': 'Klientens ursprungliga IP-adress. Caddy sätter denna automatiskt, använd för override.',
    'X-Forwarded-Proto': 'Protokollet klienten använde (http/https). Caddy sätter denna automatiskt.',
    'X-Forwarded-Host': 'Ursprunglig Host-header från klienten. Caddy sätter denna automatiskt.',
    'X-Real-IP': 'Klientens riktiga IP-adress. Alternativ till X-Forwarded-For för backends som förväntar denna header.',

    // Content
    'Content-Type': 'MIME-typ för svaret, t.ex. "application/json", "text/html; charset=utf-8".',
    'Content-Disposition': 'Styr om svaret visas inline eller som nedladdning. T.ex. "attachment; filename=fil.pdf".',
    'Content-Language': 'Anger språket för resursen. T.ex. "sv", "en-US".',
    'Accept-Encoding': 'Anger vilka komprimeringsmetoder som accepteras. T.ex. "gzip, deflate, br".',

    // CORS
    'Access-Control-Allow-Origin': 'Anger vilka origins som tillåts göra cross-origin requests. "*" för alla, eller specifik origin.',
    'Access-Control-Allow-Methods': 'HTTP-metoder som tillåts vid cross-origin requests. T.ex. "GET, POST, PUT, DELETE, OPTIONS".',
    'Access-Control-Allow-Headers': 'Request-headers som tillåts vid cross-origin requests. T.ex. "Authorization, Content-Type".',
    'Access-Control-Max-Age': 'Tid i sekunder som preflight-resultat cachas. T.ex. "86400" (24 timmar).',
    'Access-Control-Allow-Credentials': 'Om cookies/credentials tillåts vid cross-origin requests. "true" eller utelämna.',

    // Other
    'X-Robots-Tag': 'Styr sökmotorindexering utan robots.txt. T.ex. "noindex, nofollow" för att dölja sidan.',
    'X-DNS-Prefetch-Control': 'Styr DNS-prefetching i webbläsaren. "off" förbättrar integritet, "on" förbättrar prestanda.',
    'X-Download-Options': '"noopen" förhindrar IE från att öppna nedladdade filer direkt (säkerhetsskydd).',
};

window.HEADER_DESCRIPTIONS = HEADER_DESCRIPTIONS;

/**
 * CSP (Content-Security-Policy) directive definitions with descriptions and common values.
 */
const CSP_DIRECTIVES = {
    'default-src': {
        description: 'Standardregel – gäller för alla resurstyper där ingen specifik regel är satt.',
        commonValues: ["'self'", "'none'", "https:", "data:"],
        noValue: false
    },
    'script-src': {
        description: 'Varifrån JavaScript-kod får laddas och köras.',
        commonValues: ["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
        noValue: false
    },
    'style-src': {
        description: 'Varifrån CSS-stilmallar får laddas.',
        commonValues: ["'self'", "'none'", "'unsafe-inline'", "https:"],
        noValue: false
    },
    'img-src': {
        description: 'Varifrån bilder får laddas.',
        commonValues: ["'self'", "'none'", "data:", "https:", "blob:"],
        noValue: false
    },
    'font-src': {
        description: 'Varifrån typsnitt (fonts) får laddas.',
        commonValues: ["'self'", "data:", "https:"],
        noValue: false
    },
    'connect-src': {
        description: 'Vilka servrar sidan får ansluta till (API-anrop, WebSocket, fetch).',
        commonValues: ["'self'", "https:", "wss:"],
        noValue: false
    },
    'frame-src': {
        description: 'Varifrån iframes får laddas på sidan.',
        commonValues: ["'self'", "'none'", "https:"],
        noValue: false
    },
    'object-src': {
        description: 'Varifrån plugin-objekt (Flash, Java-applets) får laddas. Rekommendation: alltid "none".',
        commonValues: ["'none'"],
        noValue: false
    },
    'media-src': {
        description: 'Varifrån video- och ljudfiler får laddas.',
        commonValues: ["'self'", "https:", "blob:"],
        noValue: false
    },
    'base-uri': {
        description: 'Vilka URL:er som får användas i HTML-taggen <base>. Begränsar bas-URL manipulation.',
        commonValues: ["'self'", "'none'"],
        noValue: false
    },
    'form-action': {
        description: 'Vilka URL:er som HTML-formulär får skicka data till.',
        commonValues: ["'self'", "'none'"],
        noValue: false
    },
    'frame-ancestors': {
        description: 'Vilka sidor som får bädda in denna sida i en iframe. Ersätter X-Frame-Options.',
        commonValues: ["'self'", "'none'"],
        noValue: false
    },
    'worker-src': {
        description: 'Varifrån Web Workers och Service Workers får laddas.',
        commonValues: ["'self'", "'none'", "blob:"],
        noValue: false
    },
    'child-src': {
        description: 'Varifrån underordnade browsing-kontexter (iframes, workers) får laddas.',
        commonValues: ["'self'", "'none'"],
        noValue: false
    },
    'manifest-src': {
        description: 'Varifrån app-manifest (PWA) får laddas.',
        commonValues: ["'self'"],
        noValue: false
    },
    'upgrade-insecure-requests': {
        description: 'Uppgraderar automatiskt alla HTTP-förfrågningar till HTTPS. Inget värde behövs.',
        commonValues: [],
        noValue: true
    },
    'block-all-mixed-content': {
        description: 'Blockerar allt HTTP-innehåll (bilder, skript) på HTTPS-sidor. Inget värde behövs.',
        commonValues: [],
        noValue: true
    }
};

window.CSP_DIRECTIVES = CSP_DIRECTIVES;

/**
 * Permissions-Policy feature definitions with descriptions.
 * Values: () = blockerad, (self) = bara denna sida, * = alla
 */
const PERMISSIONS_POLICY_FEATURES = {
    'camera': { description: 'Tillgång till enhetens kamera (t.ex. för videomöten).' },
    'microphone': { description: 'Tillgång till enhetens mikrofon (t.ex. för röstinspelning).' },
    'geolocation': { description: 'Tillgång till platsdata via GPS eller nätverk.' },
    'fullscreen': { description: 'Tillåt att sidan kan gå i fullskärmsläge.' },
    'autoplay': { description: 'Tillåt automatisk uppspelning av video och ljud.' },
    'payment': { description: 'Tillgång till Payment Request API för betalningar.' },
    'usb': { description: 'Tillgång till USB-enheter via WebUSB.' },
    'accelerometer': { description: 'Tillgång till enhetens accelerometer-sensor.' },
    'gyroscope': { description: 'Tillgång till enhetens gyroskop-sensor.' },
    'magnetometer': { description: 'Tillgång till enhetens magnetometer (kompass).' },
    'display-capture': { description: 'Tillåt skärminspelning och skärmdelning.' },
    'screen-wake-lock': { description: 'Förhindra att skärmen slocknar/låser sig.' },
    'picture-in-picture': { description: 'Tillåt bild-i-bild-läge för videospelaren.' },
    'xr-spatial-tracking': { description: 'Tillgång till XR (AR/VR) rumslig spårning.' },
    'interest-cohort': { description: 'Blockera Googles FLoC/Topics API (annonsspårning). Rekommenderas blockera.' },
    'serial': { description: 'Tillgång till seriella portar (t.ex. Arduino).' },
    'bluetooth': { description: 'Tillgång till Bluetooth-enheter via Web Bluetooth.' },
    'hid': { description: 'Tillgång till HID-enheter (tangentbord, möss, spelkontroller).' }
};

window.PERMISSIONS_POLICY_FEATURES = PERMISSIONS_POLICY_FEATURES;

/**
 * Common preset values for headers in the custom header dropdown.
 * Each header maps to an array of { value, label, description }.
 */
const HEADER_VALUE_PRESETS = {
    'Cache-Control': [
        { value: 'no-store, no-cache, must-revalidate', label: 'Ingen cache (strikt)', description: 'Inget cachas – alltid ny data från servern.' },
        { value: 'no-cache', label: 'Validera alltid', description: 'Cache tillåts men webbläsaren kontrollerar med servern varje gång.' },
        { value: 'public, max-age=3600', label: 'Publik cache 1 timme', description: 'Alla (webbläsare + proxyer) får cacha i 1 timme.' },
        { value: 'public, max-age=86400', label: 'Publik cache 24 timmar', description: 'Alla får cacha i 24 timmar.' },
        { value: 'public, max-age=604800, immutable', label: 'Lång cache 1 vecka', description: 'För statiska filer som aldrig ändras (bilder, CSS, JS med hash).' },
        { value: 'private, no-cache', label: 'Privat + validera', description: 'Bara användarens webbläsare får cacha, med validering.' },
    ],
    'Pragma': [
        { value: 'no-cache', label: 'no-cache', description: 'HTTP/1.0-kompatibel cache-blockering. Använd tillsammans med Cache-Control.' },
    ],
    'Vary': [
        { value: 'Accept-Encoding', label: 'Accept-Encoding', description: 'Cacha separat beroende på komprimeringsformat (gzip, br).' },
        { value: 'Accept-Encoding, Accept-Language', label: 'Encoding + Språk', description: 'Cacha separat per komprimering och språk.' },
        { value: 'Origin', label: 'Origin', description: 'Cacha separat per avsändardomän (viktigt för CORS).' },
    ],
    'X-Permitted-Cross-Domain-Policies': [
        { value: 'none', label: 'none (blockera allt)', description: 'Blockera alla cross-domain-policyfiler (Flash, PDF).' },
        { value: 'master-only', label: 'master-only', description: 'Tillåt bara master-policyfilen i rotmappen.' },
    ],
    'Cross-Origin-Opener-Policy': [
        { value: 'same-origin', label: 'same-origin (säkrast)', description: 'Isolerar sidan helt från andra origins.' },
        { value: 'same-origin-allow-popups', label: 'same-origin-allow-popups', description: 'Isolerad men tillåter kommunikation med popups.' },
        { value: 'unsafe-none', label: 'unsafe-none (standard)', description: 'Ingen isolering – webbläsarens standardbeteende.' },
    ],
    'Cross-Origin-Embedder-Policy': [
        { value: 'require-corp', label: 'require-corp', description: 'Kräver att alla inbäddade resurser har CORP-header.' },
        { value: 'credentialless', label: 'credentialless', description: 'Laddar cross-origin-resurser utan cookies/credentials.' },
        { value: 'unsafe-none', label: 'unsafe-none (standard)', description: 'Ingen begränsning – webbläsarens standardbeteende.' },
    ],
    'Cross-Origin-Resource-Policy': [
        { value: 'same-origin', label: 'same-origin (strikt)', description: 'Bara exakt samma origin får använda resursen.' },
        { value: 'same-site', label: 'same-site', description: 'Samma toppdomän (site) får använda resursen.' },
        { value: 'cross-origin', label: 'cross-origin (öppen)', description: 'Alla domäner får använda resursen.' },
    ],
    'Content-Type': [
        { value: 'text/html; charset=utf-8', label: 'HTML (UTF-8)', description: 'HTML-sida med UTF-8-tecken.' },
        { value: 'application/json', label: 'JSON', description: 'JSON-data (vanligt för API:er).' },
        { value: 'text/plain; charset=utf-8', label: 'Ren text', description: 'Oformaterad text.' },
    ],
    'Content-Disposition': [
        { value: 'inline', label: 'Visa i webbläsaren', description: 'Visa innehållet direkt i webbläsaren.' },
        { value: 'attachment', label: 'Ladda ner som fil', description: 'Tvinga nedladdning av filen.' },
    ],
    'Content-Language': [
        { value: 'sv', label: 'Svenska', description: 'Markera innehållet som svenskspråkigt.' },
        { value: 'en', label: 'Engelska', description: 'Markera innehållet som engelskspråkigt.' },
        { value: 'en-US', label: 'Engelska (US)', description: 'Markera som amerikansk engelska.' },
    ],
    'Accept-Encoding': [
        { value: 'gzip, deflate, br', label: 'Alla vanliga', description: 'Acceptera gzip, deflate och Brotli-komprimering.' },
        { value: 'gzip, deflate', label: 'Utan Brotli', description: 'Acceptera gzip och deflate (utan Brotli).' },
    ],
    // Proxy / Forwarding headers with Caddy placeholders
    'X-Forwarded-For': [
        { value: '{remote_host}', label: '{remote_host} (klientens IP)', description: 'Caddy-platshållare: besökarens riktiga IP-adress. Best practice för proxy.' },
        { value: '{http.request.header.X-Forwarded-For}', label: 'Befintligt värde (vidarebefordra)', description: 'Vidarebefordra befintligt X-Forwarded-For från uppströms proxy.' },
    ],
    'X-Forwarded-Proto': [
        { value: '{scheme}', label: '{scheme} (http/https)', description: 'Caddy-platshållare: protokollet besökaren använde (http eller https).' },
    ],
    'X-Forwarded-Host': [
        { value: '{host}', label: '{host} (originaldomän)', description: 'Caddy-platshållare: domännamnet besökaren skrev i webbläsaren.' },
        { value: '{hostport}', label: '{hostport} (domän:port)', description: 'Caddy-platshållare: domännamn med port.' },
    ],
    'X-Real-IP': [
        { value: '{remote_host}', label: '{remote_host} (klientens IP)', description: 'Caddy-platshållare: besökarens riktiga IP-adress.' },
    ],
    'Access-Control-Allow-Origin': [
        { value: '*', label: '* (alla domäner)', description: 'Tillåt alla domäner. ⚠️ Kan vara en säkerhetsrisk.' },
        { value: '{header.Origin}', label: '{header.Origin} (spegling)', description: 'Caddy-platshållare: spegla avsändarens origin (dynamisk CORS).' },
    ],
    'Access-Control-Allow-Methods': [
        { value: 'GET, POST, OPTIONS', label: 'GET + POST', description: 'Vanligaste metoderna för webbapplikationer.' },
        { value: 'GET, POST, PUT, DELETE, OPTIONS', label: 'Alla CRUD-metoder', description: 'Alla vanliga REST API-metoder.' },
        { value: 'GET, OPTIONS', label: 'Bara läsning', description: 'Skrivskyddat – bara GET-förfrågningar.' },
    ],
    'Access-Control-Allow-Headers': [
        { value: 'Content-Type, Authorization', label: 'Content-Type + Auth', description: 'Vanligaste headers för API-anrop med autentisering.' },
        { value: 'Content-Type, Authorization, X-Requested-With', label: 'Standard + AJAX', description: 'Inkluderar AJAX-identifiering (X-Requested-With).' },
        { value: '*', label: '* (alla headers)', description: 'Tillåt alla request-headers.' },
    ],
    'Access-Control-Max-Age': [
        { value: '3600', label: '1 timme', description: 'CORS preflight-svar cachas i 1 timme (3600 sek).' },
        { value: '86400', label: '24 timmar', description: 'CORS preflight-svar cachas i 24 timmar.' },
        { value: '600', label: '10 minuter', description: 'CORS preflight-svar cachas i 10 minuter.' },
    ],
    'Access-Control-Allow-Credentials': [
        { value: 'true', label: 'true (tillåt)', description: 'Tillåt att cookies och autentisering skickas med i CORS-förfrågningar.' },
    ],
    'X-Robots-Tag': [
        { value: 'noindex, nofollow', label: 'Ingen indexering', description: 'Sökmotorer ska varken indexera sidan eller följa dess länkar.' },
        { value: 'noindex', label: 'Bara noindex', description: 'Sökmotorer ska inte indexera, men får följa länkar.' },
        { value: 'none', label: 'none (blockera allt)', description: 'Ingen indexering, inga länkar följs, ingen cache.' },
    ],
    'X-DNS-Prefetch-Control': [
        { value: 'off', label: 'off (integritet)', description: 'Inaktivera DNS-prefetch – bättre integritetsskydd.' },
        { value: 'on', label: 'on (prestanda)', description: 'Aktivera DNS-prefetch – snabbare sidladdning.' },
    ],
    'X-Download-Options': [
        { value: 'noopen', label: 'noopen', description: 'Förhindra att nedladdade filer öppnas direkt i webbläsaren (IE-skydd).' },
    ],
    'ETag': [
        { value: '', label: '(Tom – tas bort)', description: 'Ta bort ETag-headern.' },
    ],
};

window.HEADER_VALUE_PRESETS = HEADER_VALUE_PRESETS;

/**
 * Descriptions for common proxy header_up / header_down headers.
 */
const PROXY_HEADER_UP_DESCRIPTIONS = {
    'X-Real-IP': 'Skickar klientens riktiga IP till backend. Värde: {remote_host}',
    'X-Forwarded-For': 'Klientens IP-kedja. Caddy sätter automatiskt, använd för override. Värde: {remote_host}',
    'X-Forwarded-Proto': 'Protokollet (http/https) som klienten använde. Värde: {scheme}',
    'X-Forwarded-Host': 'Ursprungligt hostname från klienten. Värde: {host}',
    'X-Request-ID': 'Unikt ID per request för spårning/loggkorrelering. Värde: {uuid}',
    'Host': 'Override av Host-headern till backend. Användbart om backend kräver specifikt hostname.',
    'X-Forwarded-Method': 'HTTP-metoden (GET, POST etc.) som klienten använde. Värde: {method}',
    'X-Forwarded-Uri': 'Ursprunglig URI från klienten. Värde: {uri}',
    'Authorization': 'Vidarebefordra eller override:a Authorization-headern till backend.',
    'X-Forwarded-Ssl': 'Indikerar SSL-status. Vanligt värde: "on" om HTTPS.',
    '-X-Forwarded-For': '(Ta bort) Tar bort X-Forwarded-For headern innan den skickas till backend.',
    '-X-Forwarded-Proto': '(Ta bort) Tar bort X-Forwarded-Proto headern.',
    '-X-Forwarded-Host': '(Ta bort) Tar bort X-Forwarded-Host headern.',
};

const PROXY_HEADER_DOWN_DESCRIPTIONS = {
    '-Server': 'Tar bort Server-headern från backend-svaret för att dölja server-information.',
    '-X-Powered-By': 'Tar bort X-Powered-By-headern (avslöjar t.ex. PHP-version, Express etc.).',
    '-Via': 'Tar bort Via-headern som kan avslöja proxy-kedjan.',
    'Strict-Transport-Security': 'Lägger till/override:ar HSTS i svaret. Värde: max-age=31536000',
    'X-Frame-Options': 'Lägger till clickjacking-skydd i svaret. Värde: DENY eller SAMEORIGIN',
    'X-Content-Type-Options': 'Förhindrar MIME-sniffing. Värde: nosniff',
    'Referrer-Policy': 'Kontrollerar referrer-information. Värde: strict-origin-when-cross-origin',
    'Cache-Control': 'Override:ar cachning från backend. T.ex. "no-store" eller "public, max-age=3600".',
    'X-Request-ID': 'Vidarebefordra request-ID till klienten för felsökning.',
    'Access-Control-Allow-Origin': 'Lägger till CORS-header i svaret. Värde: * eller specifik origin.',
};

window.PROXY_HEADER_UP_DESCRIPTIONS = PROXY_HEADER_UP_DESCRIPTIONS;
window.PROXY_HEADER_DOWN_DESCRIPTIONS = PROXY_HEADER_DOWN_DESCRIPTIONS;

/**
 * Value presets for proxy header_up headers.
 */
const PROXY_HEADER_UP_VALUE_PRESETS = {
    'X-Real-IP': [
        { value: '{remote_host}', label: '{remote_host} (klientens IP)', description: 'Skickar besökarens riktiga IP-adress till servern.' },
    ],
    'X-Forwarded-For': [
        { value: '{remote_host}', label: '{remote_host} (klientens IP)', description: 'Klientens IP läggs till i kedjan av IP-adresser.' },
    ],
    'X-Forwarded-Proto': [
        { value: '{scheme}', label: '{scheme} (http eller https)', description: 'Anger om besökaren använde http eller https.' },
    ],
    'X-Forwarded-Host': [
        { value: '{host}', label: '{host} (originaldomän)', description: 'Domännamnet som besökaren skrev in.' },
    ],
    'X-Request-ID': [
        { value: '{uuid}', label: '{uuid} (unikt per förfrågan)', description: 'Skapar ett unikt ID per besök – bra för felsökning i loggar.' },
    ],
    'Host': [
        { value: '{upstream_hostport}', label: '{upstream_hostport} (serverns adress)', description: 'Skickar destinationsserverns adress som Host-header.' },
        { value: '{host}', label: '{host} (originaldomän)', description: 'Behåll besökarens originaldomän som Host.' },
    ],
    'X-Forwarded-Method': [
        { value: '{method}', label: '{method} (GET, POST, etc.)', description: 'HTTP-metoden som besökaren använde.' },
    ],
    'X-Forwarded-Uri': [
        { value: '{uri}', label: '{uri} (sökvägen)', description: 'Den fullständiga sökvägen som besökaren begärde.' },
    ],
    'Authorization': [
        { value: 'Bearer {header.Authorization}', label: 'Vidarebefordra token', description: 'Skickar vidare besökarens inloggningstoken till servern.' },
    ],
    'X-Forwarded-Ssl': [
        { value: 'on', label: 'on', description: 'Talar om för servern att anslutningen är krypterad.' },
    ],
};

/**
 * Value presets for proxy header_down headers.
 */
const PROXY_HEADER_DOWN_VALUE_PRESETS = {
    'Strict-Transport-Security': [
        { value: 'max-age=31536000; includeSubDomains; preload', label: 'Strikt HSTS (1 år + preload)', description: 'Tvinga HTTPS i 1 år, inkludera subdomäner, och registrera för preload.' },
        { value: 'max-age=31536000; includeSubDomains', label: 'HSTS 1 år', description: 'Tvinga HTTPS i 1 år och inkludera subdomäner.' },
        { value: 'max-age=86400', label: 'HSTS 24 timmar (test)', description: 'Kort HSTS-period – bra för testning.' },
    ],
    'X-Frame-Options': [
        { value: 'DENY', label: 'DENY (blockera helt)', description: 'Sidan får inte visas i en iframe – skyddar mot clickjacking.' },
        { value: 'SAMEORIGIN', label: 'SAMEORIGIN', description: 'Bara din egen domän får visa sidan i en iframe.' },
    ],
    'X-Content-Type-Options': [
        { value: 'nosniff', label: 'nosniff', description: 'Förhindra att webbläsaren gissar filtyp – skyddar mot attacker.' },
    ],
    'Referrer-Policy': [
        { value: 'strict-origin-when-cross-origin', label: 'strict-origin-when-cross-origin (rekommenderat)', description: 'Skickar bara domännamn (inte sökväg) till andra sajter.' },
        { value: 'no-referrer', label: 'no-referrer (striktast)', description: 'Skicka aldrig referrer-information – bästa integritetsskyddet.' },
        { value: 'same-origin', label: 'same-origin', description: 'Skicka bara referrer till din egen domän.' },
    ],
    'Cache-Control': [
        { value: 'no-store, no-cache, must-revalidate', label: 'Ingen cache (strikt)', description: 'Inget cachas – alltid ny data från servern.' },
        { value: 'public, max-age=3600', label: 'Publik cache 1 timme', description: 'Alla får cacha svaret i 1 timme.' },
        { value: 'public, max-age=86400', label: 'Publik cache 24 timmar', description: 'Alla får cacha svaret i 24 timmar.' },
    ],
    'X-Request-ID': [
        { value: '{upstream_hostport}', label: '{upstream_hostport}', description: 'Vidarebefordra server-ID till klienten för felsökning.' },
    ],
    'Access-Control-Allow-Origin': [
        { value: '*', label: '* (alla domäner)', description: 'Tillåt alla domäner. ⚠️ Kan vara en säkerhetsrisk.' },
    ],
};

window.PROXY_HEADER_UP_VALUE_PRESETS = PROXY_HEADER_UP_VALUE_PRESETS;
window.PROXY_HEADER_DOWN_VALUE_PRESETS = PROXY_HEADER_DOWN_VALUE_PRESETS;
