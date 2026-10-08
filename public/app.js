const socket = io();

let player = null;
let playerReady = false;
let isHost = false;
let partyState = null;
let applyingRemote = false;
let syncTimer = null;

const $ = id => document.getElementById(id);

function show(id) {
  $(id).classList.remove("hidden");
}
function hide(id) {
  $(id).classList.add("hidden");
}
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function saveName() {
  return ($("nameInput").value || "").trim() || "Guest";
}

function extractVideoId(input) {
  const value = String(input || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0];
    if (url.hostname.includes("youtube.com")) {
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      const i = parts.findIndex(x => ["embed", "shorts", "live"].includes(x));
      if (i >= 0 && parts[i + 1]) return parts[i + 1];
    }
  } catch {}
  return null;
}

function createPlayer(videoId = "") {
  if (!window.YT || !YT.Player) return;
  if (player) {
    player.destroy();
    player = null;
  }
  player = new YT.Player("player", {
    videoId,
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      onReady: () => {
        playerReady = true;
        applyState();
      },
      onStateChange: event => {
        if (!isHost || applyingRemote) return;
        if (event.data === YT.PlayerState.PLAYING) {
          sendSync();
        } else if (event.data === YT.PlayerState.PAUSED) {
          sendSync();
        }
      }
    }
  });
}

window.onYouTubeIframeAPIReady = () => {
  if ($("partyScreen") && !$("partyScreen").classList.contains("hidden")) createPlayer();
};

function showParty(state) {
  partyState = state;
  hide("homeScreen");
  show("partyScreen");
  $("leaveBtn").classList.remove("hidden");
  $("copyCodeBtn").firstChild.textContent = state.code + " ";
  renderParticipants(state);
  setHost(state.hostId === socket.id);
  if (!player && window.YT) createPlayer(state.videoId || "");
  applyState();
}

function setHost(value) {
  isHost = value;
  $("roleBadge").textContent = value ? "Host" : "Guest";
  value ? show("hostControls") : hide("hostControls");
  $("videoInput").disabled = !value;
}

function renderParticipants(state) {
  $("count").textContent = state.participants.length;
  $("participants").innerHTML = state.participants.map(p => `
    <div class="person">
      <div class="avatar">${escapeHtml(p.name.slice(0,1).toUpperCase())}</div>
      <div class="person-name">${escapeHtml(p.name)}</div>
      ${p.isHost ? '<div class="host-dot">HOST</div>' : ''}
    </div>
  `).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

function applyState() {
  if (!partyState || !playerReady || !player) return;

  const videoId = partyState.videoId;
  if (!videoId) {
    $("playerPlaceholder").classList.remove("hidden");
    return;
  }

  $("playerPlaceholder").classList.add("hidden");

  const currentId = player.getVideoData?.().video_id;
  if (currentId !== videoId) {
    applyingRemote = true;
    player.cueVideoById(videoId);
    setTimeout(() => {
      if (!player) return;
      player.seekTo(partyState.position || 0, true);
      if (partyState.playing) player.playVideo();
      else player.pauseVideo();
      applyingRemote = false;
    }, 400);
    return;
  }

  const desired = Number(partyState.position || 0);
  const actual = Number(player.getCurrentTime?.() || 0);
  if (Math.abs(actual - desired) > 1.8) {
    applyingRemote = true;
    player.seekTo(desired, true);
    setTimeout(() => applyingRemote = false, 250);
  }

  applyingRemote = true;
  if (partyState.playing && player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo();
  if (!partyState.playing && player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
  setTimeout(() => applyingRemote = false, 250);
}

function sendSync() {
  if (!isHost || !player || !playerReady || !partyState?.videoId) return;
  socket.emit("party:sync", {
    videoId: partyState.videoId,
    position: player.getCurrentTime(),
    playing: player.getPlayerState() === YT.PlayerState.PLAYING
  });
}

$("createBtn").onclick = () => {
  $("homeError").textContent = "";
  socket.emit("party:create", { name: saveName() }, result => {
    if (!result.ok) {
      $("homeError").textContent = result.error || "Could not create party.";
      return;
    }
    showParty(result.state);
    toast(`Party ${result.code} created`);
  });
};

$("joinBtn").onclick = () => {
  $("homeError").textContent = "";
  const code = $("codeInput").value.trim().toUpperCase();
  if (code.length !== 6) {
    $("homeError").textContent = "Enter the 6-character party code.";
    return;
  }
  socket.emit("party:join", { code, name: saveName() }, result => {
    if (!result.ok) {
      $("homeError").textContent = result.error || "Could not join party.";
      return;
    }
    showParty(result.state);
    toast(`Joined ${result.code}`);
  });
};

$("leaveBtn").onclick = () => {
  socket.emit("party:leave");
  partyState = null;
  playerReady = false;
  if (player) {
    player.destroy();
    player = null;
  }
  hide("partyScreen");
  show("homeScreen");
  hide("leaveBtn");
};

$("loadBtn").onclick = () => {
  const id = extractVideoId($("videoInput").value);
  if (!id) {
    toast("That doesn't look like a YouTube video URL.");
    return;
  }
  socket.emit("party:load", { videoId: id });
};

$("playBtn").onclick = () => {
  if (!isHost || !player) return;
  player.playVideo();
  setTimeout(sendSync, 150);
};

$("pauseBtn").onclick = () => {
  if (!isHost || !player) return;
  player.pauseVideo();
  setTimeout(sendSync, 150);
};

$("syncBtn").onclick = () => {
  if (!isHost) return;
  sendSync();
  toast("Playback synced");
};

$("copyCodeBtn").onclick = async () => {
  if (!partyState) return;
  try {
    await navigator.clipboard.writeText(partyState.code);
    toast("Party code copied");
  } catch {
    toast(partyState.code);
  }
};

$("chatForm").onsubmit = e => {
  e.preventDefault();
  const input = $("chatInput");
  const text = input.value.trim();
  if (!text) return;
  socket.emit("party:message", { text });
  input.value = "";
};

$("nameInput").addEventListener("keydown", e => {
  if (e.key === "Enter") $("createBtn").click();
});
$("codeInput").addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

socket.on("party:state", state => {
  partyState = state;
  renderParticipants(state);
  setHost(state.hostId === socket.id);
  applyState();
});

socket.on("party:host", ({ isHost: host }) => {
  setHost(host);
  toast(host ? "You are now the host" : "Host changed");
});

socket.on("chat:message", message => {
  const row = document.createElement("div");
  row.className = "msg";
  row.innerHTML = `<div class="msg-name">${escapeHtml(message.name)}</div><div class="msg-text">${escapeHtml(message.text)}</div>`;
  $("messages").appendChild(row);
  $("messages").scrollTop = $("messages").scrollHeight;
});

socket.on("connect", () => {
  // Socket reconnects do not automatically rejoin; the user can rejoin from home.
});

setInterval(() => {
  if (isHost && playerReady && partyState?.videoId) sendSync();
}, 3000);