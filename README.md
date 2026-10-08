# YT Watch Party — Web App

A mobile-first YouTube Watch Party built with Node.js, Express and Socket.IO.

## Features

- Create a private 6-character party
- Join from another phone or computer
- YouTube IFrame playback
- Host loads videos from a YouTube URL or video ID
- Host play/pause/seek synchronization
- Automatic playback correction for guests
- Live participant list
- Real-time party chat
- Host handoff when the host leaves
- Responsive mobile UI
- No Android Studio, Kotlin or Gradle required

## Requirements

- Node.js 18+
- A modern browser
- Internet access for the YouTube IFrame Player API

## Run locally

```bash
npm install
npm start
```

Then open:

http://localhost:3000

## Test with friends on the same Wi-Fi

Find the computer's local IP address.

Windows:

```bat
ipconfig
```

Look for an IPv4 address such as `192.168.1.20`.

Friends on the same Wi-Fi can open:

```text
http://192.168.1.20:3000
```

If Windows Firewall asks, allow Node.js on your private network.

## Deploy online

This app needs a Node.js server with WebSocket support. Deploy the folder to a Node-compatible host and set the `PORT` environment variable if your provider requires it.

The app is intentionally server-rendered/static on the frontend and uses Socket.IO for real-time room state.

## Important YouTube note

This app uses the official YouTube IFrame Player API. It does not download, proxy, or redistribute YouTube videos.

For a production deployment, add authentication, rate limiting, persistent storage if needed, moderation controls, and HTTPS.