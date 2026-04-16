# LG Sample Product Site — Full Stack + Queue-it

## Project Structure

```
/
├── public/
│   └── index.html                        ← Frontend (LG product page)
├── api/
│   ├── index.js                          ← Express app (Vercel serverless entry)
│   ├── queueitMiddleware.js              ← Queue-it validation middleware
│   └── queueitContextProvider.js        ← Adapts Express req/res for Queue-it SDK
├── config/
│   └── queueit_integration_config.json  ← ⚠️  REPLACE with real config from GO platform
├── vercel.json                           ← Routes all traffic through Express
└── package.json
```

## How Queue-it Works Here

Every request goes through `queueitMiddleware.js` **before** reaching any route:

```
Browser → Vercel → Express → [Queue-it check] → Route handler
                                 ↓ (if queued)
                           Waiting Room Page
```

If a user needs to queue, the middleware redirects them to Queue-it. Once they've
waited, Queue-it sends them back with a `queueittoken` in the URL. The connector
validates the token, sets a cookie, strips the token from the URL, and lets them through.

---

## Setup

### 1. Queue-it GO Platform (do this first)

1. Create a **Waiting Room** with an "Always visible" queue page
2. Add your domain to the waiting room's **Target Domains**
3. Create a **KnownUser QUEUE action** → Trigger: `All Pages (Queue-it)`
4. Go to **Integration → Overview** → **Publish**
5. Download the integration config file:
   - Click "Show/Hide instructions"
   - Click **Download** in the "Manually download..." tile
   - File will be named `[your-customer-id]_knownuser_integration_config.json`
6. **Replace** `config/queueit_integration_config.json` with this downloaded file

### 2. Set Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

| Variable             | Value                              |
|----------------------|------------------------------------|
| QUEUEIT_CUSTOMER_ID  | Your customer ID from GO platform  |
| QUEUEIT_SECRET_KEY   | Your 72-char secret key from GO    |

Or for local dev, create a `.env` file:
```
QUEUEIT_CUSTOMER_ID=your-customer-id
QUEUEIT_SECRET_KEY=your-72-char-secret
```

### 3. Install & Run Locally

```bash
npm install
npx vercel dev
```

Open `http://localhost:3000`

---

## Deploy to Vercel (Free)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/lg-site.git
git push -u origin main
```

Then:
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New Project** → Import your repo
3. Add the environment variables (QUEUEIT_CUSTOMER_ID, QUEUEIT_SECRET_KEY)
4. Click **Deploy**

---

## Troubleshooting Queue-it

- Waiting room not showing? Check that your domain is in the Waiting Room config
- Make sure you **Published** after creating the action in GO Platform
- Use an incognito window to avoid stale Queue-it cookies
- Check Vercel function logs for `[Queue-it]` messages
