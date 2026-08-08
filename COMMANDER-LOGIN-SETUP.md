# Setting up Commander login (Frontier cAPI)

This only runs on your self-hosted instance (`server.js` on Termux + your
Cloudflare tunnel) — it can't work on the GitHub Pages mirror, since that's
static files only with no server behind it. The `commander.html` page
detects that and shows a friendly message there instead of breaking.

## 1. Register a Frontier app

1. Go to https://user.frontierstore.net/dev and log in with your Frontier account.
2. Create a new application.
3. Set its **redirect URI** to exactly:
   `https://<your-tunnel-domain>/auth/callback`
   (or `http://localhost:3000/auth/callback` while testing locally — must
   match character-for-character, including trailing slashes.)
4. Copy the **Client ID** it gives you. There's no client secret to worry
   about — this uses PKCE, which doesn't need one.

## 2. Configure your local `.env`

In the project folder:

```
cp .env.example .env
```

Then edit `.env` and fill in:

```
FRONTIER_CLIENT_ID=<the client ID from step 1>
FRONTIER_REDIRECT_URI=https://<your-tunnel-domain>/auth/callback
SESSION_SECRET=<any long random string>
```

Generate a `SESSION_SECRET` with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env` is already in `.gitignore` — it will never be committed or pushed
to GitHub, so your client ID stays off the public repo.

## 3. Install and run

```
npm install
npm start
```

Visit `/commander.html` on your tunnel URL and click **Login with
Frontier**. You'll be sent to Frontier's own login page, then bounced
back to `/auth/callback`, which exchanges the code for tokens (server-side
only) and redirects you to your fleet view.

## Notes

- Tokens are stored server-side in your session, not in a file — if you
  restart the server, everyone gets logged out and needs to log in again.
  For a small personal/faction site this is a reasonable trade-off; if you
  want persistence across restarts later, swap the default in-memory
  session store in `server.js` for a file- or SQLite-backed one.
- Frontier refresh tokens are valid for 25 days of inactivity before
  requiring a fresh login.
- Nothing here touches your existing Spansh proxy or fleet catalogue —
  they're untouched.
