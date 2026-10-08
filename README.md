# YT Watch Party — Final Web Release

A mobile-first YouTube Watch Party using Node.js, Express, Socket.IO and the official YouTube IFrame Player API.

## Included
- 6-character private rooms
- Shareable `/?party=ABC123` invite links
- Copy/share party link
- Host-only video loading and playback controls
- Server-timestamped sync with periodic guest drift correction
- Automatic host handoff
- Live participants and real-time chat
- Rename yourself
- Mobile-first UI
- Installable PWA shell
- `/health` endpoint
- Render deployment config

## Run
```bash
npm install
npm start
```
Open `http://localhost:3000`.

## Render
Create a Web Service from this repository. Build command: `npm install`. Start command: `npm start`. The included `render.yaml` can also be used with Render Blueprint deployment. Render supplies `PORT` automatically.

## GitHub structure
```text
package.json
server.js
render.yaml
README.md
public/
  index.html
  app.js
  styles.css
  manifest.webmanifest
  sw.js
  icon.svg
```

## Note
Rooms are held in server memory. For a large production service, add authentication, persistent/shared state (for example Redis), rate limiting and moderation. YouTube video playback is provided by the official YouTube player; videos are not downloaded or proxied.
