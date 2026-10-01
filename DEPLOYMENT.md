# Vercel frontend deployment

The frontend server proxies `/api`, `/media`, `/uploads` and `/health` to
`https://jintemo-backend-new.vercel.app` by default. Browser API requests stay on
the frontend domain, including HttpOnly session cookies.

To override the backend, set `API_PROXY_TARGET` in the frontend Vercel project's
Environment Variables for Production and Preview:

```text
API_PROXY_TARGET=https://jintemo-backend-new.vercel.app
```

Use the origin without `/api`. An existing value overrides the default, so
update any stale value. Redeploy the frontend after updating the code or
environment variables. No backend deployment is needed for this proxy fix.

The gateway omits its own frontend Origin on upstream requests. Foreign origins
are forwarded for the backend's CORS checks. Local Vite development continues
to use the backend on port 5000.

After deployment, check `/health`, `/api/catalog`, `/api/settings`,
`/api/content`, and `/media/hero-room.jpg` on the frontend domain. They should
return 200. `/api/auth/me` returns 401 until the browser has signed in.
