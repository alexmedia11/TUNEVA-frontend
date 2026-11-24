# TUNEVA Frontend

Static frontend for TUNEVA. Deploy this project to Vercel.

The frontend calls `https://api.tunevaconnect.top` by default. If your backend uses another origin, set `window.TUNEVA_API_BASE` before `app.js` loads.

The referral signup URL uses the app hash route format `#signup?ref=CODE`. The signup page reads the referral query from the hash and keeps it through the signup request.

The homepage's videos are served by the backend from `/assets/film-0.mp4`, `/assets/film-1.mp4` and `/assets/film-2.mp4`.
