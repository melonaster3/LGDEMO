# Queue-it Iframe Client

*Last updated: 2026-04-09*

A browser client for integrating Queue-it virtual waiting rooms into your web application. The waiting room is rendered inside an iframe — either as a fullscreen overlay or a centered modal dialog.

## Files

| File | Format | Use case |
|------|--------|----------|
| `index.js` | UMD | `<script>` tag, RequireJS, CommonJS |
| `index.esm.js` | ES Module | `import` statements, bundlers |

The client has **zero runtime dependencies** — it only uses browser APIs.

## Prerequisites

### Bring Your Own CDN (BYO CDN)

This client renders the waiting room inside an iframe on your page. For the iframe to detect the queue redirect and extract the token, the waiting room content must be served on the **same domain** as your application. This requires a Bring Your Own CDN setup, where your CDN proxies Queue-it waiting room traffic under your own domain. Contact Queue-it support if you have not yet configured this.

### Queue-it JavaScript Client

The Queue-it JavaScript client must be set up on the page. Include the following scripts before using the iframe client:

```html
<script type="text/javascript" src="//static.queue-it.net/script/queueclient.js"></script>
<script
  data-queueit-intercept="true"
  data-queueit-c="your-customer-id"
  data-queueit-host="your-cdn-domain.com"
  data-queueit-queuepathprefix="your-queue-path-prefix"
  type="text/javascript"
  src="//static.queue-it.net/script/queueconfigloader.js">
</script>
```

Replace `data-queueit-c` with your customer ID, `data-queueit-host` with your Waiting Room domain, and `data-queueit-queuepathprefix` with your queue path prefix. See [Configuration](#configuration) for more details on these values.

## Quick Start

### Script Tag (UMD)

```html
<div id="queueContainerId"></div>

<script src="index.js"></script>
<script>
  var qm = new QueueItSdk.QueueManager({
    customerId: 'your-customer-id',
    waitingRoomId: 'your-waiting-room-id',
    iframeContainerId: 'queueContainerId',
    waitingRoomDomain: 'your-cdn-domain.com',
    queuePathPrefix: 'your-queue-path-prefix',
    onQueuePassed: function (result) {
      // The user has passed the queue — send the token to your backend via the x-queueittoken header
      fetch('/your-protected-endpoint', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-queueittoken': result.Token },
      });
    },
    onQueueError: function (error) {
      console.error('Queue error:', error.Message);
    },
  });

  // Call qm.start() in place of your protected action (e.g. a form submit)
  var form = document.getElementById('protectedForm');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    qm.start();
  });
</script>
```

### ES Module

```html
<div id="queueContainerId"></div>

<script type="module">
  import { QueueManager } from './index.esm.js';

  const qm = new QueueManager({
    customerId: 'your-customer-id',
    waitingRoomId: 'your-waiting-room-id',
    iframeContainerId: 'queueContainerId',
    waitingRoomDomain: 'your-cdn-domain.com',
    queuePathPrefix: 'your-queue-path-prefix',
    onQueuePassed: (result) => {
      // The user has passed the queue — send the token to your backend via the x-queueittoken header
      fetch('/your-protected-endpoint', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-queueittoken': result.Token },
      });
    },
    onQueueError: (error) => {
      console.error('Queue error:', error.Message);
    },
  });

  // Call qm.start() in place of your protected action (e.g. a form submit)
  const form = document.getElementById('protectedForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    qm.start();
  });
</script>
```

## Integration Flow

Call `qm.start()` at the point where you would normally perform your protected action (e.g. submitting a form, starting a checkout). The protected action itself should be moved into the `onQueuePassed` callback, so it only executes after the user has passed through the queue.

## Configuration

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `customerId` | `string` | Yes | — | Your Queue-it customer ID |
| `waitingRoomId` | `string` | Yes | — | The Queue-it waiting room ID |
| `waitingRoomDomain` | `string` | Yes | - | The domain for the waiting room |
| `queuePathPrefix` | `string` | No | — | Path prefix for the waiting room domain used for the Bring Your Own CDN setup |
| `iframeContainerId` | `string` | Yes | — | ID of the DOM element where the waiting room iframe will render |
| `isModal` | `boolean` | No | `false` | `true` = centered modal with backdrop, `false` = fullscreen overlay |
| `enqueueToken` | `string` | No | — | Enqueue token for token-based queue access |
| `skipIfCookieExist` | `boolean` | No | `true` | Skip the queue if a valid `QueueITAccepted-SDFrts345E-V3_{waitingRoomId}` cookie already exists. Requires `cookieValidityMinutes` when enabled. |
| `cookieValidityMinutes` | `number` | Conditional | — | Cookie validity duration in minutes. Required when `skipIfCookieExist` is `true`. The SDK checks that the cookie's `IssueTime` plus this value has not elapsed. |
| `onQueuePassed` | `function` | No | — | Called when the user passes the queue (see below) |
| `onQueueError` | `function` | No | — | Called when a queue error occurs (see below) |

## Callbacks

### `onQueuePassed(result)`

Called when the user has passed through the queue. The `result` object contains:

- `Token` (`string`) — The Queue-it token. Pass this to your backend in the `x-queueittoken` header for server-side validation.
- `Source` (`'Cookie' | 'SafetyNet' | 'Queue'`) — How the token was obtained:
  - `Cookie` — A valid `QueueITAccepted-SDFrts345E-V3_{waitingRoomId}` cookie was found (queue was skipped)
  - `SafetyNet` — The enqueue API returned a token immediately (no wait required)
  - `Queue` — The user waited in the queue and was passed through

### `onQueueError(error)`

Called when something goes wrong. The `error` object contains:

- `Message` (`string`) — Description of the error

## Waiting Room Target URL

The waiting room's **Target URL** must point to a path on the **same domain** as your application. For example:

```
https://example.com/queue-redirect
```

**Important:** The target URL must point to an existing page that returns a valid response (e.g. an empty 200 page). If the URL returns a 404 or error, the error page will briefly flash inside the iframe during the redirect before the client can intercept it. The page does not need to serve any meaningful content — a minimal empty HTML response is sufficient.

The client intercepts the iframe redirect to this URL, extracts the queue token from it, and communicates the result back to the host page via the `onQueuePassed` callback. The queue runs inside an iframe on the same page, so the standard Queue-it target URL redirect behavior does not apply.

## Server-Side Token Validation

The client-side iframe integration alone is not sufficient to protect your resource. Since a user could disable the JavaScript listener and bypass the queue, you **must** set up server-side validation as well.

Configure a **KnownUser Queue action** that triggers on the endpoint receiving the protected request (e.g. the form's POST endpoint). The Queue-it JavaScript client included in the [Prerequisites](#queue-it-javascript-client) will intercept the request and inject the necessary headers for the server-side KnownUser connector to validate. This ensures that even if the client-side queue is bypassed, the server will reject requests without a valid queue token.

When making the request from `onQueuePassed`, include the token in the `x-queueittoken` header and set `credentials: 'include'` so the Queue-it accepted cookie is forwarded with the request:

```js
fetch('/your-protected-endpoint', {
  method: 'POST',
  credentials: 'include',
  headers: { 'x-queueittoken': result.Token },
});
```

The server-side KnownUser connector reads this header to validate the token.

### Protected endpoint domain requirements

The protected endpoint must be on the **same domain or a subdomain** of the page hosting the SDK. The `credentials: 'include'` option tells the browser to include cookies in the request, but cookies are only sent if the request URL matches the cookie's domain scope. If the endpoint is on a different domain entirely, the cookie will not be forwarded.

When configuring the KnownUser Queue action, make sure the Configurations **cookie domain** setting matches your setup:

- **Same domain** (e.g. `example.com` → `example.com/api`) — no special configuration needed
- **Subdomain** (e.g. `www.example.com` → `api.example.com`) — set the cookie domain to `.example.com` so the cookie is shared across subdomains

## Display Modes

The `iframeContainerId` element must exist in your HTML before calling `start()`. The client takes over this element to display the waiting room.

- **Fullscreen overlay** (`isModal: false`, default) — The container becomes a fixed fullscreen overlay with a dark background.
- **Modal** (`isModal: true`) — The container becomes a fixed overlay with a centered card (max 900x700px) and a dimmed backdrop.

In both modes, the container is automatically hidden once the user passes the queue.

## Cleanup

Call `qm.destroy()` to remove the iframe and clean up event listeners if you need to tear down the queue before it completes.
