const MESSAGE_TYPES = {
    QUEUE_PASSED: 'queue-passed',
    QUEUE_ERROR: 'queue-error',
};
const API_TIMEOUT = 10000;
const SDK_VERSION = 'js-queue-iframe-sdk-1.0.0';

class IframeMessenger {
    constructor(origin = window.location.origin) {
        this.iframe = null;
        this.listeners = new Map();
        this.origin = origin;
        this.setupMessageListener();
    }
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            console.log('Received message:', event.data, 'from origin:', event.origin);
            if (event.origin !== this.origin) {
                console.warn(`Ignoring message from untrusted origin: ${event.origin}, expected: ${this.origin}`);
                return;
            }
            const { type, payload } = event.data;
            this.emit(type, payload || {});
        });
    }
    /**
     * Collapse the container with display:none and remember original inline display.
     * - Stores two data attributes:
     *   - data-lib-had-inline-display: "1" if there was an inline display value, else "0"
     *   - data-lib-orig-display: original inline display value (could be '', but we only use it when had-inline-display==="1")
     *   - data-lib-collapsed: "1" when collapsed by library
     */
    collapseContainer(container) {
        if (!container.dataset.libHadInlineDisplay) {
            container.dataset.libHadInlineDisplay = container.style.display ? '1' : '0';
        }
        if (!container.dataset.libOrigDisplay && container.dataset.libHadInlineDisplay === '1') {
            container.dataset.libOrigDisplay = container.style.display;
        }
        container.style.display = 'none';
        container.dataset.libCollapsed = '1';
        container.style.position = '';
        container.style.inset = '';
        container.style.width = '';
        container.style.height = '';
        container.style.background = '';
        container.style.zIndex = '';
        container.style.placeItems = '';
        // Restore page scroll in case we disabled it
        document.body.style.overflow = '';
    }
    /**
     * Expand the container by restoring to a visible display value.
     * Logic:
     *   - If we previously collapsed it (data-lib-collapsed==="1"):
     *       * If it originally had an inline display, restore exactly that.
     *       * Else, clear inline display (''), letting CSS compute it.
     *       * If still computed as 'none', force a safe visible default ('block').
     *   - If we didn't collapse it, do nothing.
     */
    expandContainer(container) {
        if (container.dataset.libCollapsed !== '1') {
            // Not collapsed by us; don't interfere
            return;
        }
        const hadInline = container.dataset.libHadInlineDisplay === '1';
        const orig = container.dataset.libOrigDisplay ?? '';
        if (hadInline) {
            // Restore the exact inline display that existed before our first collapse
            container.style.display = orig;
        }
        else {
            // No original inline display: remove our inline override and let CSS win
            container.style.display = '';
        }
        // If CSS (author styles) still hides it, force a visible fallback
        if (getComputedStyle(container).display === 'none') {
            // Sensible default; if your customers need 'flex' or 'grid', you can make this configurable
            container.style.display = 'block';
        }
        // Clear the collapsed flag
        delete container.dataset.libCollapsed;
    }
    createIframe(src, containerId, isModal) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        // Uncollapse before adding the iframe
        this.expandContainer(container);
        // Clear previous content and styles
        container.innerHTML = '';
        // Ensure the page behind doesn't scroll while overlay is open
        const originalBodyOverflow = document.body.style.overflow;
        const existing = container.querySelector('iframe');
        if (existing)
            existing.remove();
        this.iframe = document.createElement('iframe');
        this.iframe.addEventListener('load', () => {
            try {
                const url = this.iframe.contentWindow.location.href;
                const urlObj = new URL(url);
                const hasParam = urlObj.searchParams.has('queueittoken');
                if (hasParam) {
                    console.log("Closing iframe. Param detected:", 'queueittoken');
                    const queueSuccessResponse = ({
                        Token: urlObj.searchParams.get('queueittoken'),
                        Source: 'Queue'
                    });
                    this.emit(MESSAGE_TYPES.QUEUE_PASSED, queueSuccessResponse);
                    this.iframe.remove();
                    document.body.style.overflow = originalBodyOverflow || '';
                    this.collapseContainer(container);
                }
                console.log('Iframe navigated:', url);
            }
            catch {
                console.log('Cross-origin navigation detected');
            }
        });
        // iframe styling 
        Object.assign(this.iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            backgroundColor: 'transparent',
        });
        // Sandbox permissions
        this.iframe.sandbox.add('allow-scripts');
        this.iframe.sandbox.add('allow-same-origin');
        this.iframe.sandbox.add('allow-forms');
        this.iframe.sandbox.add('allow-popups');
        if (isModal) {
            Object.assign(container.style, {
                position: 'fixed',
                inset: '0', // top:0; right:0; bottom:0; left:0;
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.2)', // 20% dim
                zIndex: '9999',
                display: 'grid',
                placeItems: 'center', // center contents
            });
            // Create a modal wrapper for the iframe
            const modal = document.createElement('div');
            Object.assign(modal.style, {
                width: 'min(900px, 95vw)',
                height: 'min(700px, 85vh)',
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                position: 'relative',
            });
            // // Optional close button (you can wire this to a cancel action)
            // const closeBtn = document.createElement('button');
            // closeBtn.textContent = '×';
            // Object.assign(closeBtn.style, {
            //   position: 'absolute',
            //   top: '8px',
            //   right: '12px',
            //   background: 'transparent',
            //   border: 'none',
            //   fontSize: '28px',
            //   lineHeight: '28px',
            //   cursor: 'pointer',
            //   color: '#333',
            // });
            // closeBtn.addEventListener('click', () => {
            //   this.destroy();                 // remove iframe + listeners
            //   this.collapseContainer(container);
            // });
            document.body.style.overflow = 'hidden';
            // modal.appendChild(closeBtn);
            modal.appendChild(this.iframe);
            container.appendChild(modal);
        }
        else {
            // Make container fullscreen with 80% opacity background
            Object.assign(container.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.8)', // 80% opacity black
                zIndex: '9999',
            });
            container.appendChild(this.iframe);
        }
        this.iframe.src = src;
        return this.iframe;
    }
    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(callback);
        // Return unsubscribe function
        return () => {
            this.listeners.get(type)?.delete(callback);
        };
    }
    emit(type, payload) {
        const callbacks = this.listeners.get(type);
        if (callbacks) {
            callbacks.forEach(callback => callback(payload));
        }
    }
    destroy() {
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }
        this.listeners.clear();
    }
}

class QueueManager {
    get queueItAcceptedCookieName() {
        return `QueueITAccepted-SDFrts345E-V3_${this.config.waitingRoomId}`;
    }
    constructor(config) {
        this.unsubscribers = [];
        this.config = {
            skipIfCookieExist: true,
            ...config,
        };
        this.origin = `https://${this.config.waitingRoomDomain}`;
        this.messenger = new IframeMessenger(this.origin);
    }
    /**
     * Main entry point: Enqueue user and show waiting room
     */
    async start() {
        try {
            // Setup event listeners for iframe messages
            this.setupListeners();
            if (this.config.skipIfCookieExist && this.isCookieValid(this.queueItAcceptedCookieName, { clockSkewSeconds: 5 })) {
                this.emit(MESSAGE_TYPES.QUEUE_PASSED, { Source: 'Cookie' });
                return;
            }
            const enqueueResponse = await this.callQueueApi();
            console.log('Enqueue Response:', enqueueResponse);
            if (enqueueResponse && enqueueResponse.QueueitToken) {
                const message = {
                    Token: enqueueResponse.QueueitToken,
                    Source: 'SafetyNet',
                };
                this.emit(MESSAGE_TYPES.QUEUE_PASSED, message);
                return;
            }
            // Create and display iframe
            this.messenger.createIframe(enqueueResponse.QueueUrl, this.config.iframeContainerId, this.config.isModal ?? false);
            // Wait for iframe to be ready
        }
        catch (error) {
            console.log('QueueManager start error:', error);
            const message = {
                Message: error instanceof Error ? error.message : 'Unknown error'
            };
            this.emit(MESSAGE_TYPES.QUEUE_ERROR, message);
        }
    }
    /**
     * Call Queue-it API to enqueue user
     */
    async callQueueApi() {
        const enqueueUrl = this.getEnqueueUrl();
        const body = this.getJsonBody();
        const timestamp = this.getISO8601String();
        console.log(`QueueManager API call ${timestamp}: ${enqueueUrl}: ${JSON.stringify(body)}`);
        const response = await this.fetchWithTimeout(enqueueUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }, API_TIMEOUT);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Queue enqueue failed: ${response.statusText} - ${errorText}`);
        }
        console.log(`QueueManager API response ${timestamp}: ${response.status}`);
        return response.json();
    }
    /**
     * Get ISO8601 formatted date string
     */
    getISO8601String() {
        const now = new Date();
        return now.toISOString();
    }
    /**
     * Build the enqueue API URL following Android SDK pattern
     */
    getEnqueueUrl() {
        const sanitizedPrefix = this.sanitizeQueuePathPrefix(this.config.queuePathPrefix);
        const path = `${sanitizedPrefix}api/mobileapp/queue/${this.config.customerId}/${this.config.waitingRoomId}/enqueue`;
        const url = new URL(`${this.origin}/${path}`);
        return url.toString();
    }
    /**
     * Sanitize queue path prefix
     */
    sanitizeQueuePathPrefix(prefix) {
        if (!prefix || !this.config.waitingRoomDomain) {
            return '';
        }
        let sanitized = prefix;
        if (sanitized.startsWith('/')) {
            sanitized = sanitized.substring(1);
        }
        if (sanitized.endsWith('/')) {
            sanitized = sanitized.substring(0, sanitized.length - 1);
        }
        if (sanitized.length === 0) {
            return '';
        }
        return sanitized + '/';
    }
    /**
     * Build request body matching Android SDK format
     */
    getJsonBody() {
        const body = {
            userAgent: 'myUserAgant/1.0',
            sdkVersion: SDK_VERSION
        };
        if (this.config.enqueueToken) {
            body.enqueueToken = this.config.enqueueToken;
        }
        return body;
    }
    /**
     * Setup listeners for iframe messages
     */
    setupListeners() {
        const unsubQueuePassed = this.messenger.on(MESSAGE_TYPES.QUEUE_PASSED, (payload) => {
            this.handleQueuePassed(payload);
            this.unsubscribers.forEach(unsub => unsub());
        });
        const unsubQueueError = this.messenger.on(MESSAGE_TYPES.QUEUE_ERROR, (payload) => {
            this.handleQueueError(payload);
            this.unsubscribers.forEach(unsub => unsub());
        });
        this.unsubscribers.push(unsubQueuePassed, unsubQueueError);
    }
    /**
     * Handle queue passed event: set cookies and call callback
     */
    handleQueuePassed(payload) {
        const response = payload;
        this.config.onQueuePassed?.(response);
    }
    /**
     * Handle queue error
     */
    handleQueueError(payload) {
        const error = payload;
        console.log('handleQueueError :', error.Message);
        this.config.onQueueError?.(error);
    }
    emit(eventName, data) {
        console.log('Emit event:', eventName, data);
        window.postMessage({ type: eventName, payload: data }, this.origin);
    }
    /** Read a cookie by name (URL-decoded). */
    getCookie(name) {
        const pattern = `; ${document.cookie}`;
        const parts = pattern.split(`; ${encodeURIComponent(name)}=`);
        if (parts.length === 2) {
            const value = parts.pop().split(';').shift();
            return value ? decodeURIComponent(value) : null;
        }
        return null;
    }
    isCookieValid(cookieName, options) {
        const { clockSkewSeconds = 0 } = options ?? {};
        const raw = this.getCookie(cookieName);
        if (!raw)
            return false;
        if (this.config.cookieValidityMinutes == null)
            return true;
        const issueTime = this.tryGetIssueTimeSeconds(raw);
        if (issueTime == null)
            return false;
        const expirySeconds = issueTime + this.config.cookieValidityMinutes * 60;
        return this.notExpired(expirySeconds, clockSkewSeconds);
    }
    /**
     * Parses a URL-encoded key=value cookie value and extracts IssueTime
     * as seconds since epoch.
     *
     * Cookie value format (after URL-decoding by getCookie):
     *   EventId=iframetest&QueueId=da63bb06-...&IssueTime=1775634933&Hash=...
     */
    tryGetIssueTimeSeconds(cookieValue) {
        const params = new URLSearchParams(cookieValue);
        const issueTime = params.get('IssueTime');
        if (!issueTime)
            return null;
        const n = Number(issueTime);
        return Number.isFinite(n) ? n : null;
    }
    /**
     * Returns true if "now" is strictly before the provided expiry (in seconds),
     * factoring in an optional negative clock skew tolerance (seconds).
     */
    notExpired(expirySeconds, skewSeconds = 0) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        return nowSeconds < (expirySeconds - skewSeconds);
    }
    /**
     * Fetch with timeout
     */
    fetchWithTimeout(url, options, timeoutMs) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs))
        ]);
    }
    /**
     * Cleanup and destroy
     */
    destroy() {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
        this.messenger.destroy();
    }
}

export { IframeMessenger, MESSAGE_TYPES, QueueManager };
