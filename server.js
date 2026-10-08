const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function cleanName(name) {
  return String(name || "Guest").trim().slice(0, 24) || "Guest";
}

function cleanVideoId(id) {
  return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
}

function roomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function roomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    videoId: room.videoId,
    position: room.playing ? room.position + Math.max(0, (Date.now() - room.updatedAt) / 1000) : room.position,
    playing: room.playing,
    updatedAt: room.updatedAt,
    messages: room.messages.slice(-60),
    participants: [...room.participants.values()].map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId
    }))
  };
}

function broadcastState(room) {
  io.to(room.code).emit("party:state", roomState(room));
}

function createRoom() {
  const code = roomCode();
  const room = {
    code,
    hostId: null,
    videoId: "",
    position: 0,
    playing: false,
    updatedAt: Date.now(),
    participants: new Map(),
    messages: []
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(String(code || "").trim().toUpperCase());
}

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;

  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;

  if (!room) return;

  room.participants.delete(socket.id);

  if (room.hostId === socket.id) {
    const next = room.participants.values().next().value;
    room.hostId = next ? next.id : null;
    if (next) io.to(next.id).emit("party:host", { isHost: true });
  }

  if (room.participants.size === 0) {
    rooms.delete(code);
  } else {
    broadcastState(room);
  }
}

io.on("connection", socket => {
  socket.on("party:create", ({ name } = {}, callback) => {
    leaveRoom(socket);
    const room = createRoom();
    const participant = { id: socket.id, name: cleanName(name) };
    room.participants.set(socket.id, participant);
    room.hostId = socket.id;
    socket.join(room.code);
    socket.data.roomCode = room.code;

    callback?.({ ok: true, code: room.code, state: roomState(room) });
  });

  socket.on("party:join", ({ code, name } = {}, callback) => {
    leaveRoom(socket);
    const room = getRoom(code);

    if (!room) {
      callback?.({ ok: false, error: "Party not found. Check the code." });
      return;
    }

    room.participants.set(socket.id, {
      id: socket.id,
      name: cleanName(name)
    });

    socket.join(room.code);
    socket.data.roomCode = room.code;
    callback?.({ ok: true, code: room.code, state: roomState(room) });
    broadcastState(room);
  });

  socket.on("party:leave", () => leaveRoom(socket));

  socket.on("party:sync", ({ videoId, position, playing } = {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    room.videoId = cleanVideoId(videoId);
    room.position = Math.max(0, Number(position) || 0);
    room.playing = Boolean(playing);
    room.updatedAt = Date.now();
    broadcastState(room);
  });

  socket.on("party:load", ({ videoId } = {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    room.videoId = cleanVideoId(videoId);
    room.position = 0;
    room.playing = false;
    room.updatedAt = Date.now();
    broadcastState(room);
  });

  socket.on("party:message", ({ text } = {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.participants.has(socket.id)) return;

    const message = String(text || "").trim().slice(0, 500);
    if (!message) return;

    const participant = room.participants.get(socket.id);
    io.to(code).emit("chat:message", {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: participant.name,
      text: message,
      at: Date.now()
    });
  });

  socket.on("party:name", ({ name } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.participants.has(socket.id)) return;
    room.participants.get(socket.id).name = cleanName(name);
    broadcastState(room);
  });

  socket.on("party:message", ({ text } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.participants.has(socket.id)) return;
    const value = String(text || "").trim().slice(0, 500);
    if (!value) return;
    const person = room.participants.get(socket.id);
    const message = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: person.name, text: value, at: Date.now() };
    room.messages.push(message);
    room.messages = room.messages.slice(-60);
    io.to(room.code).emit("chat:message", message);
  });

  socket.on("party:rename", ({ name } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.participants.has(socket.id)) return;
    room.participants.get(socket.id).name = cleanName(name);
    broadcastState(room);
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

server.listen(PORT, () => {
  console.log(`YT Watch Party running at http://localhost:${PORT}`);
});