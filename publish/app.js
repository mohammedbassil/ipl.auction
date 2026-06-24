// IPL Mega Auction 2025 - Backend & Database Engine

// Cache DOM Elements
const landingScreen = document.getElementById('landing-screen');
const retentionScreen = document.getElementById('retention-screen');
const auctionScreen = document.getElementById('auction-screen');
const resetAuctionBtn = document.getElementById('reset-auction-btn');
const statusPhaseIndicator = document.getElementById('status-phase-indicator');

const userTeamSelect = document.getElementById('user-team-select');
const timerLimitSelect = document.getElementById('timer-limit-select');
const timerLimitSelectActive = document.getElementById('timer-limit-select-active');

const startRetentionBtn = document.getElementById('start-retention-btn');
const confirmRetentionsBtn = document.getElementById('confirm-retentions-btn');
const autoRetainAllBtn = document.getElementById('auto-retain-all-btn');
const resetRetentionsBtn = document.getElementById('reset-retentions-btn');

const activePlayerName = document.getElementById('active-player-name');
const activePlayerRole = document.getElementById('active-player-role');
const activePlayerNationality = document.getElementById('active-player-nationality');
const activePlayerCountry = document.getElementById('active-player-country');
const activePlayerCappedStatus = document.getElementById('active-player-capped-status');
const activePlayerFormerTeam = document.getElementById('active-player-former-team');
const activePlayerCurrentBid = document.getElementById('active-player-current-bid');
const activePlayerTimer = document.getElementById('active-player-timer');
const activePlayerLeaderBanner = document.getElementById('active-player-leader-banner');
const activePlayerLeaderTeam = document.getElementById('active-player-leader-team');
const activePlayerProgressStats = document.getElementById('active-player-progress-stats');

const speedNormalBtn = document.getElementById('speed-normal-btn');
const speedFastBtn = document.getElementById('speed-fast-btn');
const speedInstantBtn = document.getElementById('speed-instant-btn');
const pauseTimerBtn = document.getElementById('pause-timer-btn');
const autoAdvanceCheck = document.getElementById('auto-advance-check');

const franchiseBidButtons = document.getElementById('franchise-bid-buttons');
const bidRaiseBtn = document.getElementById('bid-raise-btn');
const nextBidAmountLabel = document.getElementById('next-bid-amount-label');
const soldPlayerBtn = document.getElementById('sold-player-btn');
const unsoldPlayerBtn = document.getElementById('unsold-player-btn');

const liveAuctionLogFeed = document.getElementById('live-auction-log-feed');

const statTotalSpent = document.getElementById('stat-total-spent');
const statMostExpensive = document.getElementById('stat-most-expensive');
const statCheapestSold = document.getElementById('stat-cheapest-sold');
const statProgressCount = document.getElementById('stat-progress-count');
const statsSpendingLeaderboard = document.getElementById('stats-spending-leaderboard');

const searchInput = document.getElementById('player-pool-search');

// RTM Modal elements
const rtmPromptModal = document.getElementById('rtm-prompt-modal');
const rtmPlayerName = document.getElementById('rtm-player-name');
const rtmPlayerDetails = document.getElementById('rtm-player-details');
const rtmFormerTeamName = document.getElementById('rtm-former-team-name');
const rtmHighestBidVal = document.getElementById('rtm-highest-bid-val');
const rtmHighestBidderName = document.getElementById('rtm-highest-bidder-name');
const rtmActionButtonsBox = document.getElementById('rtm-action-buttons-box');
const rtmDeclineBtn = document.getElementById('rtm-decline-btn');
const rtmConfirmBtn = document.getElementById('rtm-confirm-btn');
const rtmAiThinking = document.getElementById('rtm-ai-thinking');
const rtmAiTeamName = document.getElementById('rtm-ai-team-name');

// Welcome Screen DOM Elements
const welcomeNameInput = document.getElementById('welcome-name-input');
const teamLogoGrid = document.getElementById('team-logo-grid');
const createRoomBtn = document.getElementById('create-room-btn');
const guestInvitePanel = document.getElementById('guest-invite-panel');
const inviteLobbyText = document.getElementById('invite-lobby-text');
const joinLobbyBtn = document.getElementById('join-lobby-btn');
const startMultiplayerBtn = document.getElementById('start-multiplayer-btn');
const clientWaitMessage = document.getElementById('client-wait-message');
const lobbyStatusContainer = document.getElementById('lobby-status-container');
const lobbyLinkInput = document.getElementById('lobby-link-input');
const copyLobbyBtn = document.getElementById('copy-lobby-btn');
const connectedPlayersList = document.getElementById('connected-players-list');
const recentRoomsPanel = document.getElementById('recent-rooms-panel');
const recentRoomsList = document.getElementById('recent-rooms-list');
const hostActionsRow = document.getElementById('host-actions-row');
const shareLobbyBtn = document.getElementById('share-lobby-btn');
const lobbyPrivacyBadge = document.getElementById('lobby-privacy-badge');
const lobbyPinDisplayGroup = document.getElementById('lobby-pin-display-group');
const lobbyPinValue = document.getElementById('lobby-pin-value');
const guestPinGroup = document.getElementById('guest-pin-group');
const guestPinInput = document.getElementById('guest-pin-input');

// State Variables
let franchises = [];
let players = [];
let orderedPool = [];
let activePoolIndex = 0;

let currentBidLakhs = 0;
let currentHighestBidderId = null;
let timerSeconds = 15;
let timeLimitSeconds = 15; // default 15s
let timerInterval = null;
let isPaused = false;
let speed = 'normal'; // 'normal' | 'fast' | 'instant'
let simulationMode = 'franchise'; // 'franchise' | 'spectator' | 'sandbox'
let userTeamId = 3; // KKR
let selectedRetentions = {}; // teamId -> Set of playerIds
let selectedXIByTeam = {}; // teamId -> Array of selected playerIds for final XI slots
let isRtmPhase = false;
let rtmResolutionPromise = null;

// Multiplayer state variables
let isMultiplayer = false;
let isHost = false;
let clientPlayers = []; // Connected players list: { peerId, name, teamId, isHost }
let myPeerId = "";
let activeRoomId = ""; // Stable room ID — never overwritten by socket reconnects
let phase = "setup"; // 'setup' | 'retention' | 'auction' | 'finished'
let autoAdvance = true;
let hostRoomPin = "";
let isPrivateRoom = false;
let activeLobbySession = null; // { type: 'host'|'guest', roomId, pin, isPrivate, playerName, teamId }

// ─────────────────────────────────────────────────────────────
//  Socket.io – single shared connection to the Node.js server
// ─────────────────────────────────────────────────────────────

// Always connect to port 3000 (the Node server), regardless of
// whether the page was opened via Live Server (5500) or directly.
const serverUrl = (() => {
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    return `http://${window.location.hostname}:3000`;
  }
  if (window.location.protocol === 'file:' || !window.location.hostname) {
    return 'http://localhost:3000';
  }
  return window.location.origin;
})();

const socket = io(serverUrl, { 
  autoConnect: true
});

// ── Shareable base URL (fetched from server so LAN IP is correct) ──────────
let shareBaseUrl = serverUrl;   // fallback — overridden below
let shareBaseUrlResolved = false;

async function resolveShareBaseUrl() {
  if (shareBaseUrlResolved) return shareBaseUrl;
  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  if (!isLocal) {
    shareBaseUrl = window.location.origin;
    shareBaseUrlResolved = true;
    return shareBaseUrl;
  }
  try {
    const response = await fetch(serverUrl + '/api/server-info');
    const info = await response.json();
    shareBaseUrl = info.lanUrl || info.localUrl || serverUrl;
    shareBaseUrlResolved = true;
    console.log('Shareable base URL:', shareBaseUrl);
  } catch (error) {
    console.warn('Unable to resolve shareable base URL, using fallback', error);
  }
  return shareBaseUrl;
}

resolveShareBaseUrl();

// ── Helper: normalize share base URLs and clean query params ─────────────────
function normalizeShareBaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    return rawUrl.replace(/\/$/, '');
  }
}

function extractRoomIdFromSearch(search) {
  if (!search) return null;
  const roomMatch = search.match(/[?&]room=([^&]+)/);
  if (!roomMatch) return null;
  let roomValue = decodeURIComponent(roomMatch[1]);
  const nestedIndex = roomValue.indexOf('/?room=');
  if (nestedIndex !== -1) {
    roomValue = roomValue.slice(0, nestedIndex);
  }
  return roomValue;
}

function extractPinFromSearch(search) {
  if (!search) return null;
  const pinMatch = search.match(/[?&]pin=([^&]+)/);
  return pinMatch ? decodeURIComponent(pinMatch[1]) : null;
}

// ── Helper: build a proper room join link ─────────────────────────────────
function buildRoomLink(roomId, pin) {
  const base = normalizeShareBaseUrl(shareBaseUrl || serverUrl);
  const url = new URL(base);
  url.searchParams.set('room', roomId);
  if (pin) {
    url.searchParams.set('pin', pin);
  } else {
    url.searchParams.delete('pin');
  }
  return url.toString();
}

// Attach all event listeners once the socket connects (also fires on reconnect)
socket.on('connect', () => {
  console.log('Connected to server. Socket ID:', socket.id);
  myPeerId = socket.id; // socket ID — used only for peer-to-peer routing
  updateConnectionBadge('connected');
  
  // Auto-register lobby session if active
  if (activeLobbySession) {
    if (activeLobbySession.type === 'host') {
      // FIX #1: Restore stable activeRoomId from session on reconnect
      // (prevents myPeerId overwrite from breaking broadcast roomId)
      activeRoomId = activeLobbySession.roomId;
      myPeerId = activeLobbySession.roomId; // keep myPeerId consistent for host
      socket.emit('host-create-room', {
        roomId: activeLobbySession.roomId,
        pin: activeLobbySession.pin,
        isPrivate: activeLobbySession.isPrivate,
        playerName: activeLobbySession.playerName,
        teamId: activeLobbySession.teamId
      });
    } else if (activeLobbySession.type === 'guest') {
      socket.emit('guest-join-room', {
        roomId: activeLobbySession.roomId,
        pin: activeLobbySession.pin,
        playerName: activeLobbySession.playerName,
        teamId: activeLobbySession.teamId
      });
    }
  }
});

socket.on('disconnect', () => {
  console.log('Socket disconnected from server.');
  updateConnectionBadge('disconnected');
});

// ── Guest: receives any broadcast from the host (STATE_SYNC, TRIGGER_EFFECT, RTM_REQUEST …)
socket.on('client-receive-message', ({ data }) => {
  handleClientMessage(data);
});

// ── Host: receives a routed message from a guest (TOGGLE_RETENTION, PLACE_BID, RTM_DECISION)
socket.on('host-receive-message', ({ fromSocketId, data }) => {
  if (!isHost) return;
  const replyFn = (msg) => {
    socket.emit('host-message-to-client', {
      roomId: myPeerId,
      targetSocketId: fromSocketId,
      data: msg
    });
  };
  handleHostMessage(fromSocketId, data, replyFn);
});

// ── Host: a guest disconnected – remove them from local clientPlayers list
socket.on('guest-disconnected', (peerId) => {
  if (!isHost) return;
  handleHostDisconnect(peerId);
});

// ── Both: server sends a fresh lobby player list whenever anyone joins/leaves
socket.on('lobby-update', ({ clientPlayers: updatedPlayers }) => {
  clientPlayers = updatedPlayers;
  updateLobbyPlayersUI();

  // If we are on the landing/welcome screen, update the franchise selector grid
  if (phase === 'setup') {
    const takenTeamIds = clientPlayers
      .filter(p => p.peerId !== socket.id)
      .map(p => p.teamId);
    renderFranchiseSelectorGrid(takenTeamIds);
  }
});

socket.on('change-team-ack', ({ success, teamId, error }) => {
  if (success) {
    userTeamId = teamId;
    userTeamSelect.value = teamId.toString();
  } else {
    alert(error || "Failed to switch team");
  }
});

// ── Guest: server tells guest whether the join was accepted or rejected
socket.on('join-ack', ({ success, teamId, error }) => {
  handleClientMessage({ type: 'JOIN_ACK', success, teamId, error });
});

// ── Host: server confirms room was registered
socket.on('host-create-ack', () => {
  console.log('Room registered on server:', myPeerId);
});

// ── Host: a new guest just connected – push full current game state to them immediately
socket.on('guest-joined', ({ guestSocketId }) => {
  if (!isHost || phase === 'setup') return;
  // Build the full state packet and send ONLY to this specific guest
  const retentionsObj = {};
  for (let tid in selectedRetentions) {
    retentionsObj[tid] = Array.from(selectedRetentions[tid]);
  }
  const stateMsg = {
    type: 'STATE_SYNC',
    state: {
      phase, isPrivateRoom, hostRoomPin, isRtmPhase,
      activePoolIndex, currentBidLakhs, currentHighestBidderId,
      timerSeconds, timeLimitSeconds, isPaused, speed, simulationMode,
      selectedRetentions: retentionsObj,
      clientPlayers,
      players: players.map(p => ({ id: p.id, status: p.status, soldPriceLakhs: p.soldPriceLakhs, boughtBy: p.boughtBy, isRtm: p.isRtm })),
      franchises: franchises.map(f => ({ id: f.id, remainingPurseLakhs: f.remainingPurseLakhs, rtmCardsLeft: f.rtmCardsLeft, draftedPlayerIds: f.draftedPlayerIds }))
    }
  };
  socket.emit('host-message-to-client', { roomId: myPeerId, targetSocketId: guestSocketId, data: stateMsg });
  logActivity('bid', 'New guest connected — full state synced.');
});

// ── Guest: host disconnected – show warning banner
socket.on('host-disconnected-warning', () => {
  logActivity('bid', '<strong style="color:var(--danger-color)">⚠ Host disconnected. Waiting for host to reconnect...</strong>');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err.message || err);
  updateConnectionBadge('connecting');
});

function updateConnectionBadge(state) {
  const dot = document.getElementById('connection-status-dot');
  const text = document.getElementById('connection-status-text');
  if (!dot || !text) return;
  
  if (state === 'connected') {
    dot.style.backgroundColor = '#10b981'; // Green
    dot.style.boxShadow = '0 0 8px #10b981';
    text.textContent = 'Connected';
  } else if (state === 'connecting') {
    dot.style.backgroundColor = '#f59e0b'; // Yellow
    dot.style.boxShadow = '0 0 8px #f59e0b';
    text.textContent = 'Connecting...';
  } else if (state === 'disconnected') {
    dot.style.backgroundColor = '#ef4444'; // Red
    dot.style.boxShadow = '0 0 8px #ef4444';
    text.textContent = 'Disconnected';
  }
}


// Sound Effects Generator (Web Audio API)
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function playSoldSound() {
  initAudio();
  if (!audioCtx) return;
  const playKnock = (time) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    gainNode.gain.setValueAtTime(0.5, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.start(time);
    osc.stop(time + 0.12);
  };
  const now = audioCtx.currentTime;
  playKnock(now);
  playKnock(now + 0.15);
}
function playUnsoldSound() {
  initAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.4);
  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.4);
}
function getFemaleVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  // Look for a recognisably female voice by name heuristics
  const femaleVoice = voices.find(v =>
    v.name.toLowerCase().includes('female') ||
    v.name.toLowerCase().includes('woman') ||
    v.name.toLowerCase().includes('samantha') ||
    v.name.toLowerCase().includes('victoria') ||
    v.name.toLowerCase().includes('karen') ||
    v.name.toLowerCase().includes('tessa') ||
    v.name.toLowerCase().includes('moira') ||
    v.name.toLowerCase().includes('veena') ||
    v.name.toLowerCase().includes('fiona') ||
    v.name.toLowerCase().includes('zira') ||
    v.name.toLowerCase().includes('hazel') ||
    (v.name.includes('Google') && v.lang === 'en-US' && !v.name.toLowerCase().includes('male'))
  );
  return femaleVoice || null;
}

function announceAuctionResult(text) {
  if (!voiceEnabled) return;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const femaleVoice = getFemaleVoice();
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.pitch = 1.2;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

function formatLakhsVoice(lakhs) {
  if (lakhs >= 100) return `${(lakhs / 100).toFixed(1)} crore rupees`;
  return `${lakhs} lakhs`;
}

function announcePlayerIntro(player) {
  const nationality = player.isOverseas
    ? `an overseas player from ${player.country}`
    : 'an Indian player';
  const cappedStatus = player.isUncapped ? 'uncapped' : 'capped';
  const text = `${player.name}. ${nationality}. ${player.role}. ${cappedStatus}. Base price ${formatLakhsVoice(player.basePriceLakhs)}.`;
  announceAuctionResult(text);
}

// Ensure voices are loaded before using them (Chrome lazy-loads voices)
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { /* voices ready */ };
}

// ─── Voice Announcer Toggle State ───
let voiceEnabled = true;

// Balloon celebration animations
function triggerBalloonCelebration() {
  const container = document.getElementById('balloon-container');
  if (!container) return;
  container.innerHTML = '';
  const numBalloons = 25;
  const colors = ['#FFD700', '#FFCC00', '#004BA0', '#CC0000', '#3A225D', '#E8548A', '#EF1C25', '#F7A721', '#FF69B4', '#32CD32', '#00FFFF'];
  for (let i = 0; i < numBalloons; i++) {
    const delay = Math.random() * 2;
    const xPos = Math.random() * 90 + 5;
    const size = Math.random() * 20 + 50;
    const height = size * 1.25;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const speedVal = Math.random() * 4 + 6;
    const swayX = (Math.random() * 100 - 50) + 'px';
    const swayRotate = (Math.random() * 20 - 10) + 'deg';
    
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    balloon.style.left = `${xPos}vw`;
    balloon.style.width = `${size}px`;
    balloon.style.height = `${height}px`;
    balloon.style.backgroundColor = color;
    balloon.style.borderColor = color;
    balloon.style.animationDuration = `${speedVal}s`;
    balloon.style.animationDelay = `${delay}s`;
    balloon.style.setProperty('--sway-x', swayX);
    balloon.style.setProperty('--sway-rotate', swayRotate);
    
    const string = document.createElement('div');
    string.className = 'balloon-string';
    balloon.appendChild(string);
    
    balloon.addEventListener('click', (e) => {
      e.stopPropagation();
      popBalloon(balloon, color);
    });
    container.appendChild(balloon);
  }
}
function popBalloon(balloon, color) {
  const rect = balloon.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  playPopSound();
  const numParticles = 12;
  const container = document.getElementById('balloon-container');
  for (let i = 0; i < numParticles; i++) {
    const particle = document.createElement('div');
    particle.className = 'balloon-burst-particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.backgroundColor = color;
    const angle = (i / numParticles) * Math.PI * 2;
    const distance = Math.random() * 40 + 30;
    const dx = Math.cos(angle) * distance + 'px';
    const dy = Math.sin(angle) * distance + 'px';
    particle.style.setProperty('--dx', dx);
    particle.style.setProperty('--dy', dy);
    container.appendChild(particle);
    setTimeout(() => { particle.remove(); }, 600);
  }
  balloon.remove();
}
function playPopSound() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.08);
  gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

// ── PLACE BID SOUND ─────────────────────────────────────────────────────────
// A smoother, more engaging audio cue for every bid.
// Warm bell pulse + soft ascending tone for a satisfying auction feel.
function playBidSound(bidAmountLakhs) {
  initAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const scale = Math.min(1 + (bidAmountLakhs / 1500), 2.0);

  // Warm low pulse (soft coin tap)
  const pulse = audioCtx.createOscillator();
  const pulseGain = audioCtx.createGain();
  pulse.connect(pulseGain); pulseGain.connect(audioCtx.destination);
  pulse.type = 'triangle';
  pulse.frequency.setValueAtTime(180 * scale, t);
  pulse.frequency.exponentialRampToValueAtTime(80 * scale, t + 0.08);
  pulseGain.gain.setValueAtTime(0.32, t);
  pulseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  pulse.start(t); pulse.stop(t + 0.16);

  // Tender bell tone
  const bell = audioCtx.createOscillator();
  const bellGain = audioCtx.createGain();
  const bellFilter = audioCtx.createBiquadFilter();
  bell.connect(bellFilter); bellFilter.connect(bellGain); bellGain.connect(audioCtx.destination);
  bell.type = 'triangle';
  bellFilter.type = 'lowpass';
  bellFilter.frequency.setValueAtTime(1500, t);
  bell.frequency.setValueAtTime(720 * scale, t + 0.04);
  bell.frequency.exponentialRampToValueAtTime(960 * scale, t + 0.20);
  bellGain.gain.setValueAtTime(0, t + 0.04);
  bellGain.gain.linearRampToValueAtTime(0.18, t + 0.08);
  bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  bell.start(t + 0.04); bell.stop(t + 0.38);

  // Soft rising sparkle for a refined finish
  const sparkle = audioCtx.createOscillator();
  const sparkleGain = audioCtx.createGain();
  sparkle.connect(sparkleGain); sparkleGain.connect(audioCtx.destination);
  sparkle.type = 'sine';
  sparkle.frequency.setValueAtTime(1300 * scale, t + 0.10);
  sparkle.frequency.exponentialRampToValueAtTime(1700 * scale, t + 0.30);
  sparkleGain.gain.setValueAtTime(0, t + 0.10);
  sparkleGain.gain.linearRampToValueAtTime(0.12, t + 0.14);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  sparkle.start(t + 0.10); sparkle.stop(t + 0.32);
}

// Helper for guest clients: route action messages to host via server relay
function sendToHost(msg) {
  const roomId = extractRoomIdFromSearch(window.location.search);
  if (roomId) socket.emit('client-message', { roomId, data: msg });
}

// Helper for host: broadcast state to all guests via server relay
function broadcast(msg) {
  // FIX #1: Use activeRoomId (stable) instead of myPeerId (can be overwritten by socket.id on reconnect)
  const roomId = activeRoomId || myPeerId;
  socket.emit('host-broadcast', { roomId, data: msg });
}

function handleHostMessage(fromPeerId, data, replyFn) {
  // Note: JOIN is now handled by the centralized server (server.js).
  // The host receives TOGGLE_RETENTION, PLACE_BID, RTM_DECISION from guests via Socket.io relay.
  if (data.type === 'TOGGLE_RETENTION') {
    const teamSet = selectedRetentions[data.teamId];
    if (teamSet) {
      if (teamSet.has(data.playerId)) {
        teamSet.delete(data.playerId);
      } else {
        teamSet.add(data.playerId);
      }
      syncStateToClients();
      saveHostGameStateToLocalStorage();
      
      updateTeamRetentionCardUI(data.teamId);
      const card = document.getElementById('retention-franchise-grid').children[data.teamId];
      if (card) {
        card.querySelectorAll('.candidate-row').forEach(row => {
          const pId = parseInt(row.dataset.playerId);
          if (teamSet.has(pId)) {
            row.classList.add('selected');
          } else {
            row.classList.remove('selected');
          }
        });
      }
    }
  }
  else if (data.type === 'PLACE_BID') {
    const player = players[activePoolIndex];
    if (player.status === 'available' && canTeamBid(franchises.find(f => f.id === data.teamId), player, data.bidAmount) && currentHighestBidderId !== data.teamId) {
      executeBid(data.teamId, data.bidAmount);
      syncStateToClients();
      saveHostGameStateToLocalStorage();
    }
  }
  else if (data.type === 'RTM_DECISION') {
    if (rtmResolutionPromise) {
      rtmResolutionPromise(data.match);
    }
  }
}

function handleHostDisconnect(peerId) {
  const idx = clientPlayers.findIndex(p => p.peerId === peerId);
  if (idx !== -1) {
    const p = clientPlayers[idx];
    logActivity('bid', `Player <strong>${p.name}</strong> disconnected.`);
    clientPlayers.splice(idx, 1);
    // Server already broadcasts lobby-update; just refresh local host UI
    updateLobbyPlayersUI();
  }
}

function handleClientMessage(data) {
  if (data.type === 'JOIN_ACK') {
    if (data.success) {
      isMultiplayer = true;
      isHost = false;
      
      // Handle auto-assigned team ID from server
      if (data.teamId !== undefined) {
        userTeamId = data.teamId;
        userTeamSelect.value = data.teamId.toString();
        renderFranchiseSelectorGrid();
      }
      
      guestInvitePanel.style.display = 'none';
      document.getElementById('lobby-status-container').style.display = 'block';
      clientWaitMessage.style.display = 'block';
      const roomId = extractRoomIdFromSearch(window.location.search);
      const pin = extractPinFromSearch(window.location.search);
      const link = buildRoomLink(roomId, pin);
      document.getElementById('lobby-link-input').value = link;
      logActivity('bid', `Successfully joined lobby! Waiting for host to start retentions...`);
      
      // Update host/guest URL
      window.history.replaceState({ roomId }, '', link);

      saveRoomToHistory(roomId, false);
    } else {
      alert(`Failed to join lobby: ${data.error}`);
      
      // Reset active session and transition back to invite screen
      activeLobbySession = null;
      isMultiplayer = false;
      guestInvitePanel.style.display = 'block';
      document.getElementById('lobby-status-container').style.display = 'none';
      clientWaitMessage.style.display = 'none';
      
      joinLobbyBtn.disabled = false;
      joinLobbyBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Connect & Join Room';
      
      if (data.error && (data.error.includes('PIN') || data.error.includes('pin'))) {
        guestPinGroup.style.display = 'block';
      }
    }
  }
  else if (data.type === 'LOBBY_UPDATE') {
    clientPlayers = data.clientPlayers;
    updateLobbyPlayersUI();
  }
  else if (data.type === 'STATE_SYNC') {
    handleStateSync(data.state);
  }
  else if (data.type === 'RTM_REQUEST') {
    isRtmPhase = true;
    rtmPlayerName.textContent = data.player.name;
    rtmPlayerDetails.textContent = `${data.player.country} • ${data.player.role}`;
    rtmFormerTeamName.textContent = FRANCHISES[data.player.formerTeamId].short;
    rtmHighestBidVal.textContent = formatLakhs(data.currentBid);
    rtmHighestBidderName.textContent = FRANCHISES[currentHighestBidderId].short;
    rtmActionButtonsBox.style.display = 'flex';
    rtmAiThinking.style.display = 'none';
    rtmPromptModal.classList.add('active');
  }
  else if (data.type === 'TRIGGER_EFFECT') {
    if (data.effectType === 'sold') {
      playSoldSound();
      const teamName = FRANCHISES[data.boughtBy].name;
      const teamShort = FRANCHISES[data.boughtBy].short;
      const annText = data.isRtm 
        ? `${data.playerName} retained by ${teamName} for ${formatLakhs(data.amountLakhs)}!`
        : `${data.playerName} sold to ${teamName} for ${formatLakhs(data.amountLakhs)}!`;
      announceAuctionResult(annText);
      triggerBalloonCelebration();
      
      // Show visual celebration overlay on client screen too
      const overlay = document.getElementById('sold-celebration-overlay');
      const title = document.getElementById('celebration-title');
      const msg = document.getElementById('celebration-message');
      const price = document.getElementById('celebration-price');
      if (overlay) {
        title.textContent = `SOLD TO ${teamShort}`;
        msg.textContent = `Congratulations to ${teamName}!`;
        price.textContent = formatLakhs(data.amountLakhs);
        overlay.style.display = 'flex';
        setTimeout(() => {
          overlay.style.display = 'none';
        }, 2500);
      }
    } else if (data.effectType === 'unsold') {
      playUnsoldSound();
      announceAuctionResult(`${data.playerName} went unsold.`);
    }
  }
}

// LocalStorage history & state tracking
const LOCAL_STORAGE_HISTORY_KEY = 'ipl_auction_recent_rooms';
const LOCAL_STORAGE_STATE_PREFIX = 'ipl_auction_state_';

function saveRoomToHistory(roomId, isHost) {
  const historyStr = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
  let history = [];
  if (historyStr) {
    try {
      history = JSON.parse(historyStr);
    } catch(e) {}
  }
  const currentPin = isHost ? hostRoomPin : guestPinInput.value.trim();
  history = history.filter(item => item.roomId !== roomId);
  history.unshift({
    roomId: roomId,
    userName: welcomeNameInput.value.trim() || 'Owner',
    teamId: userTeamId,
    isHost: isHost,
    pin: currentPin,
    timestamp: Date.now()
  });
  if (history.length > 5) {
    history = history.slice(0, 5);
  }
  localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
  renderRecentRoomsList();
}

function renderRecentRoomsList() {
  recentRoomsList.innerHTML = '';
  const historyStr = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
  let history = [];
  if (historyStr) {
    try {
      history = JSON.parse(historyStr);
    } catch(e) {}
  }
  if (history.length === 0) {
    recentRoomsList.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.85rem; text-align: center; font-style: italic; padding: 0.4rem 0;">No active room history found.</div>';
    return;
  }
  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'recent-room-item';
    
    const meta = document.createElement('div');
    meta.className = 'recent-room-meta';
    
    const codeLine = document.createElement('div');
    codeLine.className = 'recent-room-code-line';
    const codeText = document.createElement('span');
    codeText.textContent = `Room: ${item.roomId.substring(0, 8)}`;
    codeLine.appendChild(codeText);
    
    const badge = document.createElement('span');
    badge.className = item.isHost ? 'recent-room-badge-host' : 'recent-room-badge-guest';
    badge.textContent = item.isHost ? 'HOST' : 'GUEST';
    codeLine.appendChild(badge);
    
    const teamSpan = document.createElement('span');
    teamSpan.style.cssText = 'font-size: 0.75rem; color: var(--accent-gold); font-weight: 700; margin-left: 0.5rem;';
    teamSpan.textContent = FRANCHISES[item.teamId].short;
    codeLine.appendChild(teamSpan);
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'recent-room-time';
    const date = new Date(item.timestamp);
    timeSpan.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    
    meta.appendChild(codeLine);
    meta.appendChild(timeSpan);
    
    const rejoinBtn = document.createElement('button');
    rejoinBtn.className = 'btn';
    rejoinBtn.style.padding = '0.4rem 0.8rem';
    rejoinBtn.style.fontSize = '0.8rem';
    rejoinBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Rejoin';
    rejoinBtn.onclick = () => rejoinRoom(item);
    
    row.appendChild(meta);
    row.appendChild(rejoinBtn);
    recentRoomsList.appendChild(row);
  });
}

function rejoinRoom(item) {
  welcomeNameInput.value = item.userName;
  userTeamId = item.teamId;
  userTeamSelect.value = item.teamId;
  renderFranchiseSelectorGrid();
  
  if (item.isHost) {
    isMultiplayer = true;
    isHost = true;
    resumeHostLobby(item.roomId);
  } else {
    isMultiplayer = true;
    isHost = false;
    guestInvitePanel.style.display = 'none';
    startRetentionBtn.style.display = 'none';
    createRoomBtn.style.display = 'none';
    lobbyStatusContainer.style.display = 'block';
    clientWaitMessage.style.display = 'block';

    const link = buildRoomLink(item.roomId, item.pin);
    lobbyLinkInput.value = link;

    lobbyPrivacyBadge.innerHTML = item.pin ? '<i class="fa-solid fa-lock" style="color: var(--accent-gold)"></i> Private' : '<i class="fa-solid fa-globe" style="color: var(--accent-gold)"></i> Public';
    if (item.pin) {
      lobbyPinDisplayGroup.style.display = 'block';
      lobbyPinValue.textContent = item.pin;
    } else {
      lobbyPinDisplayGroup.style.display = 'none';
    }

    // Set active guest session
    activeLobbySession = {
      type: 'guest',
      roomId: item.roomId,
      pin: item.pin || "",
      playerName: item.userName,
      teamId: item.teamId
    };

    if (socket.connected) {
      socket.emit('guest-join-room', {
        roomId: item.roomId,
        pin: item.pin || "",
        playerName: item.userName,
        teamId: item.teamId
      });
    } else {
      updateConnectionBadge('connecting');
    }
  }
}

function saveHostGameStateToLocalStorage() {
  if (!isHost || !myPeerId) return;
  const retentionsObj = {};
  for (let tid in selectedRetentions) {
    retentionsObj[tid] = Array.from(selectedRetentions[tid]);
  }
  const statePacket = {
    phase: phase,
    isPrivateRoom: isPrivateRoom,
    hostRoomPin: hostRoomPin,
    isRtmPhase: isRtmPhase,
    activePoolIndex: activePoolIndex,
    currentBidLakhs: currentBidLakhs,
    currentHighestBidderId: currentHighestBidderId,
    timerSeconds: timerSeconds,
    timeLimitSeconds: timeLimitSeconds,
    isPaused: isPaused,
    speed: speed,
    simulationMode: simulationMode,
    selectedRetentions: retentionsObj,
    clientPlayers: clientPlayers,
    players: players.map(p => ({
      id: p.id,
      status: p.status,
      soldPriceLakhs: p.soldPriceLakhs,
      boughtBy: p.boughtBy,
      isRtm: p.isRtm
    })),
    franchises: franchises.map(f => ({
      id: f.id,
      remainingPurseLakhs: f.remainingPurseLakhs,
      rtmCardsLeft: f.rtmCardsLeft,
      draftedPlayerIds: f.draftedPlayerIds
    })),
    selectedXIByTeam: selectedXIByTeam
  };
  localStorage.setItem(LOCAL_STORAGE_STATE_PREFIX + myPeerId, JSON.stringify(statePacket));
}

function loadHostGameStateFromLocalStorage(roomId) {
  const dataStr = localStorage.getItem(LOCAL_STORAGE_STATE_PREFIX + roomId);
  if (!dataStr) return false;
  try {
    const state = JSON.parse(dataStr);
    phase = state.phase;
    isPrivateRoom = state.isPrivateRoom || false;
    hostRoomPin = state.hostRoomPin || "";
    isRtmPhase = state.isRtmPhase || false;
    activePoolIndex = state.activePoolIndex;
    currentBidLakhs = state.currentBidLakhs;
    currentHighestBidderId = state.currentHighestBidderId;
    timerSeconds = state.timerSeconds;
    timeLimitSeconds = state.timeLimitSeconds;
    isPaused = state.isPaused;
    speed = state.speed;
    simulationMode = state.simulationMode;
    
    const hostPlayer = state.clientPlayers.find(p => p.isHost);
    if (hostPlayer) {
      clientPlayers = [hostPlayer];
    }
    
    state.players.forEach(sp => {
      const local = players.find(p => p.id === sp.id);
      if (local) {
        local.status = sp.status;
        local.soldPriceLakhs = sp.soldPriceLakhs;
        local.boughtBy = sp.boughtBy;
        local.isRtm = sp.isRtm;
      }
    });
    
    state.franchises.forEach(sf => {
      const local = franchises.find(f => f.id === sf.id);
      if (local) {
        local.remainingPurseLakhs = sf.remainingPurseLakhs;
        local.rtmCardsLeft = sf.rtmCardsLeft;
        local.draftedPlayerIds = sf.draftedPlayerIds;
      }
    });
    
    selectedRetentions = {};
    for (let tid in state.selectedRetentions) {
      selectedRetentions[tid] = new Set(state.selectedRetentions[tid]);
    }
    selectedXIByTeam = state.selectedXIByTeam || {};
    
    logActivity('bid', `Lobby state successfully restored from LocalStorage.`);
    return true;
  } catch(e) {
    console.error("Failed to restore local game state", e);
    return false;
  }
}

// Render Franchise grid selector on welcome page
function renderFranchiseSelectorGrid(takenTeamIds = []) {
  teamLogoGrid.innerHTML = '';
  FRANCHISES.forEach(f => {
    const isTaken = takenTeamIds.includes(f.id);
    const card = document.createElement('div');
    card.className = 'team-logo-card';
    if (isTaken) {
      card.classList.add('taken');
      card.style.opacity = '0.4';
      card.style.pointerEvents = 'none';
      card.style.cursor = 'not-allowed';
      
      const takenLabel = document.createElement('span');
      takenLabel.textContent = 'TAKEN';
      takenLabel.style.cssText = 'position:absolute; top:2px; right:2px; font-size:9px; background:var(--danger-color); color:#fff; padding:1px 4px; border-radius:3px; font-weight:700;';
      card.appendChild(takenLabel);
    } else if (userTeamId === f.id) {
      card.classList.add('selected');
    }
    card.dataset.teamId = f.id;
    
    const circle = document.createElement('div');
    circle.className = 'team-logo-circle';
    circle.style.backgroundColor = f.color1;
    circle.style.borderColor = f.color2;
    circle.textContent = f.short;
    
    const name = document.createElement('div');
    name.className = 'team-logo-name';
    name.textContent = f.name.replace('Royal Challengers ', 'RCB ').replace('Sunrisers ', 'SRH ').replace('Lucknow Super ', 'LSG ').replace('Gujarat ', 'GT ');
    
    card.appendChild(circle);
    card.appendChild(name);
    
    if (!isTaken) {
      card.onclick = () => {
        if (isMultiplayer) {
          const roomId = isHost ? myPeerId : extractRoomIdFromSearch(window.location.search);
          socket.emit('change-team', { roomId, teamId: f.id });
        } else {
          teamLogoGrid.querySelectorAll('.team-logo-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          userTeamId = f.id;
          userTeamSelect.value = f.id;
        }
      };
    }
    
    teamLogoGrid.appendChild(card);
  });
}

// Broadcast full game state to all connected guests
function syncStateToClients() {
  if (!isHost) return;
  saveHostGameStateToLocalStorage();
  const retentionsObj = {};
  for (let tid in selectedRetentions) {
    retentionsObj[tid] = Array.from(selectedRetentions[tid]);
  }
  broadcast({
    type: 'STATE_SYNC',
    state: {
      phase: phase,
      isPrivateRoom: isPrivateRoom,
      hostRoomPin: hostRoomPin,
      isRtmPhase: isRtmPhase,
      activePoolIndex: activePoolIndex,
      currentBidLakhs: currentBidLakhs,
      currentHighestBidderId: currentHighestBidderId,
      timerSeconds: timerSeconds,
      timeLimitSeconds: timeLimitSeconds,
      isPaused: isPaused,
      speed: speed,
      simulationMode: simulationMode,
      selectedRetentions: retentionsObj,
      selectedXIByTeam: selectedXIByTeam,
      clientPlayers: clientPlayers,
      players: players.map(p => ({
        id: p.id,
        status: p.status,
        soldPriceLakhs: p.soldPriceLakhs,
        boughtBy: p.boughtBy,
        isRtm: p.isRtm
      })),
      franchises: franchises.map(f => ({
        id: f.id,
        remainingPurseLakhs: f.remainingPurseLakhs,
        rtmCardsLeft: f.rtmCardsLeft,
        draftedPlayerIds: f.draftedPlayerIds
      }))
    }
  });
}



function resumeHostLobby(roomId) {
  const success = loadHostGameStateFromLocalStorage(roomId);
  if (!success) {
    const hName = welcomeNameInput.value.trim() || 'Host';
    clientPlayers = [{
      peerId: socket.id,
      name: `${hName} (Host)`,
      teamId: userTeamId,
      isHost: true
    }];
  }

  myPeerId = roomId;
  activeRoomId = roomId; // FIX #1: Also set stable room ID on resume

  let link;
  if (isPrivateRoom) {
    lobbyPrivacyBadge.innerHTML = '<i class="fa-solid fa-lock" style="color: var(--accent-gold)"></i> Private';
    lobbyPinDisplayGroup.style.display = 'block';
    lobbyPinValue.textContent = hostRoomPin;
    link = buildRoomLink(roomId, hostRoomPin);
  } else {
    lobbyPrivacyBadge.innerHTML = '<i class="fa-solid fa-globe" style="color: var(--accent-gold)"></i> Public';
    lobbyPinDisplayGroup.style.display = 'none';
    lobbyPinValue.textContent = '-';
    link = buildRoomLink(roomId, '');
  }
  document.getElementById('lobby-link-input').value = link;

  // Update the browser URL with room parameters so that refreshing or sharing the address bar works
  window.history.replaceState({ roomId }, '', link);
  
  updateLobbyPlayersUI();
  saveRoomToHistory(roomId, true);
  
  if (phase === 'retention') {
    switchScreen('retention-screen');
    statusPhaseIndicator.style.display = 'inline-flex';
    statusPhaseIndicator.textContent = 'RETENTION PHASE';
    franchises.forEach(f => updateTeamRetentionCardUI(f.id));
  } else if (phase === 'auction') {
    switchScreen('auction-screen');
    resetAuctionBtn.style.display = 'inline-flex';
    statusPhaseIndicator.style.display = 'inline-flex';
    statusPhaseIndicator.textContent = 'LIVE AUCTION';
    populateFranchiseBidButtons();
    updateActivePlayerCardUI();
    updateUpcomingPlayersUI();
    updatePurseSpendingLeaderboardUI();
    updateHighestPaidLeaderboardUI();
    updateFranchiseBoardUI();
    renderPlayerRegistry();
    validateBidButtons();
    startTimer();
  } else {
    switchScreen('landing-screen');
    lobbyStatusContainer.style.display = 'block';
  }
  logActivity('bid', `Lobby state resumed. Room Code: <strong>${roomId}</strong>`);

  // Set active host session
  const hName = welcomeNameInput.value.trim() || 'Host';
  activeLobbySession = {
    type: 'host',
    roomId: roomId,
    pin: hostRoomPin,
    isPrivate: isPrivateRoom,
    playerName: hName + " (Host)",
    teamId: userTeamId
  };

  if (socket.connected) {
    socket.emit('host-create-room', {
      roomId: roomId,
      pin: hostRoomPin,
      isPrivate: isPrivateRoom,
      playerName: hName + " (Host)",
      teamId: userTeamId
    });
  } else {
    updateConnectionBadge('connecting');
  }
}


// Guest: join an existing room on the server
function initClientPeer(roomId, playerName, teamId, pin) {
  myPeerId = socket.id;
  socket.emit('guest-join-room', { roomId, pin, playerName, teamId });
}

// Lobby players UI sync helper
function updateLobbyPlayersUI() {
  connectedPlayersList.innerHTML = '';
  if (clientPlayers.length === 0) {
    connectedPlayersList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; font-style: italic; padding: 0.4rem 0;">Waiting for friends to join...</div>';
    return;
  }
  clientPlayers.forEach(p => {
    const row = document.createElement('div');
    row.className = 'lobby-player-row';
    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    meta.appendChild(nameSpan);
    if (p.isHost) {
      const hostB = document.createElement('span');
      hostB.className = 'player-host-badge';
      hostB.textContent = 'HOST';
      meta.appendChild(hostB);
    }
    const teamB = document.createElement('span');
    teamB.className = 'player-role-badge';
    teamB.textContent = FRANCHISES[p.teamId].short;
    teamB.style.backgroundColor = FRANCHISES[p.teamId].color1;
    teamB.style.color = '#fff';
    teamB.style.textShadow = '1px 1px 1px rgba(0,0,0,0.6)';
    row.appendChild(meta);
    row.appendChild(teamB);
    connectedPlayersList.appendChild(row);
  });
}

// Sync client UI elements from state sync packet
let clientTimerInterval = null;
function startClientLocalTimer() {
  clearInterval(clientTimerInterval);
  if (isPaused || isRtmPhase || timerSeconds <= 0 || phase !== 'auction') return;
  const intervalTime = speed === 'fast' ? 200 : 1000;
  clientTimerInterval = setInterval(() => {
    if (!isPaused && !isRtmPhase && timerSeconds > 0) {
      timerSeconds--;
      updateTimerUI();
    } else {
      clearInterval(clientTimerInterval);
    }
  }, intervalTime);
}

function handleStateSync(state) {
  phase = state.phase;
  isPrivateRoom = state.isPrivateRoom || false;
  hostRoomPin = state.hostRoomPin || "";
  isRtmPhase = state.isRtmPhase || false;
  activePoolIndex = state.activePoolIndex;
  currentBidLakhs = state.currentBidLakhs;
  currentHighestBidderId = state.currentHighestBidderId;
  timerSeconds = state.timerSeconds;
  timeLimitSeconds = state.timeLimitSeconds;
  isPaused = state.isPaused;
  speed = state.speed;
  simulationMode = state.simulationMode;
  clientPlayers = state.clientPlayers;

  // Removed top-level RTM check to handle it fully at the end

  // Guests must also be marked as multiplayer when receiving a STATE_SYNC
  if (!isHost) {
    isMultiplayer = true;
    startClientLocalTimer();
  }

  // FIX #2: Bootstrap guest player pool if empty — guests need full player data from PLAYERS constant
  // The server only sends delta (id, status, price) — full metadata lives in the static PLAYERS DB
  if (players.length === 0 && typeof PLAYERS !== 'undefined' && PLAYERS.length > 0) {
    console.log('[STATE_SYNC] Guest player pool is empty — bootstrapping from PLAYERS database...');
    initializePlayerPool();
  }

  const orderedPlayers = [];
  state.players.forEach(sp => {
    const local = players.find(p => p.id === sp.id);
    if (local) {
      local.status = sp.status;
      local.soldPriceLakhs = sp.soldPriceLakhs;
      local.boughtBy = sp.boughtBy;
      local.isRtm = sp.isRtm;
      orderedPlayers.push(local);
    } else {
      // FIX #2: Fallback — find in PLAYERS constant and merge in status data
      const base = (typeof PLAYERS !== 'undefined') && PLAYERS.find(p => p.id === sp.id);
      if (base) {
        orderedPlayers.push({
          ...base,
          status: sp.status,
          soldPriceLakhs: sp.soldPriceLakhs,
          boughtBy: sp.boughtBy,
          isRtm: sp.isRtm
        });
      }
    }
  });
  // FIX #2: Only replace if we got data — don't wipe existing pool if merge yields nothing
  if (orderedPlayers.length > 0) players = orderedPlayers;

  state.franchises.forEach(sf => {
    const local = franchises.find(f => f.id === sf.id);
    if (local) {
      local.remainingPurseLakhs = sf.remainingPurseLakhs;
      local.rtmCardsLeft = sf.rtmCardsLeft;
      local.draftedPlayerIds = sf.draftedPlayerIds;
    }
  });

  selectedRetentions = {};
  for (let tid in state.selectedRetentions) {
    selectedRetentions[tid] = new Set(state.selectedRetentions[tid]);
  }
  // FIX #2: Ensure all franchise slots exist even if not in server payload
  if (franchises && franchises.length > 0) {
    franchises.forEach(f => {
      if (!selectedRetentions[f.id]) selectedRetentions[f.id] = new Set();
    });
  }

  // Toggle speed control UI and host-only actions for guest clients
  const confirmBtn = document.getElementById('confirm-retentions-btn');
  const autoRetainBtn = document.getElementById('auto-retain-all-btn');
  const resetRetBtn = document.getElementById('reset-retentions-btn');
  const waitMsg = document.getElementById('guest-retention-wait-message');

  if (isMultiplayer && !isHost) {
    speedNormalBtn.disabled = true;
    speedFastBtn.disabled = true;
    speedInstantBtn.disabled = true;
    pauseTimerBtn.disabled = true;
    autoAdvanceCheck.disabled = true;
    timerLimitSelectActive.disabled = true;
    hostActionsRow.style.display = 'none';

    if (confirmBtn) confirmBtn.style.display = 'none';
    if (autoRetainBtn) autoRetainBtn.style.display = 'none';
    if (resetRetBtn) resetRetBtn.style.display = 'none';
    if (waitMsg) waitMsg.style.display = 'inline-flex';
  } else {
    speedNormalBtn.disabled = false;
    speedFastBtn.disabled = false;
    speedInstantBtn.disabled = false;
    pauseTimerBtn.disabled = false;
    autoAdvanceCheck.disabled = false;
    timerLimitSelectActive.disabled = false;
    hostActionsRow.style.display = 'flex';

    if (confirmBtn) confirmBtn.style.display = 'inline-flex';
    if (autoRetainBtn) autoRetainBtn.style.display = 'inline-flex';
    if (resetRetBtn) resetRetBtn.style.display = 'inline-flex';
    if (waitMsg) waitMsg.style.display = 'none';
  }

  if (startMultiplayerBtn) {
    startMultiplayerBtn.style.display = (isMultiplayer && isHost && phase === 'setup') ? 'block' : 'none';
  }

  if (phase === 'setup') {
    switchScreen('landing-screen');
    updateLobbyPlayersUI();
    // FIX #6: Reassert guest waiting-room UI state when synced back to setup phase
    if (isMultiplayer && !isHost) {
      if (clientWaitMessage) clientWaitMessage.style.display = 'block';
      if (startMultiplayerBtn) startMultiplayerBtn.style.display = 'none';
    }
  } else if (phase === 'retention') {
    // FIX #2 + #3: Auto-initialize guest retention grid if never rendered
    const retentionGrid = document.getElementById('retention-franchise-grid');
    if (retentionGrid && retentionGrid.children.length === 0 && franchises.length > 0) {
      console.log('[STATE_SYNC] Guest retention grid not rendered — initializing now...');
      switchScreen('retention-screen');
      statusPhaseIndicator.style.display = 'inline-flex';
      statusPhaseIndicator.textContent = 'RETENTION PHASE';
      initRetentionScreen();
      // Re-apply server retention selections after grid renders
      franchises.forEach(f => {
        const card = retentionGrid.children[f.id];
        const teamSet = selectedRetentions[f.id];
        if (card && teamSet) {
          card.querySelectorAll('.candidate-row').forEach(row => {
            const pId = parseInt(row.dataset.playerId);
            row.classList.toggle('selected', teamSet.has(pId));
          });
          updateTeamRetentionCardUI(f.id);
        }
      });
    } else {
      switchScreen('retention-screen');
      franchises.forEach(f => {
        updateTeamRetentionCardUI(f.id);
        const card = retentionGrid ? retentionGrid.children[f.id] : null;
        if (card) {
          card.querySelectorAll('.candidate-row').forEach(row => {
            const pId = parseInt(row.dataset.playerId);
            if (selectedRetentions[f.id] && selectedRetentions[f.id].has(pId)) {
              row.classList.add('selected');
            } else {
              row.classList.remove('selected');
            }
          });
        }
      });
    }
  } else if (phase === 'auction') {
    if (landingScreen.classList.contains('active') || retentionScreen.classList.contains('active')) {
      switchScreen('auction-screen');
      populateFranchiseBidButtons();
      resetAuctionBtn.style.display = 'inline-flex';
      statusPhaseIndicator.style.display = 'inline-flex';
      statusPhaseIndicator.textContent = 'LIVE AUCTION';
    }
    updateActivePlayerCardUI();
    updateUpcomingPlayersUI();
    updatePurseSpendingLeaderboardUI();
    updateHighestPaidLeaderboardUI();
    updateFranchiseBoardUI();
    renderPlayerRegistry();
    validateBidButtons();
  } else if (phase === 'finished') {
    endAuction();
  }

  // Authoritative server-synced RTM modal resolution
  if (isRtmPhase) {
    const player = players[activePoolIndex];
    if (player) {
      rtmPlayerName.textContent = player.name;
      rtmPlayerDetails.textContent = `${player.country} • ${player.role}`;
      rtmFormerTeamName.textContent = franchises[player.formerTeamId].short;
      rtmHighestBidVal.textContent = formatLakhs(currentBidLakhs);
      
      const leaderTeam = franchises.find(f => f.id === currentHighestBidderId);
      rtmHighestBidderName.textContent = leaderTeam ? leaderTeam.short : '-';

      const isFormerTeamMine = (player.formerTeamId === userTeamId);
      if (isFormerTeamMine) {
        rtmActionButtonsBox.style.display = 'flex';
        rtmAiThinking.style.display = 'none';
      } else {
        rtmActionButtonsBox.style.display = 'none';
        rtmAiThinking.style.display = 'flex';
        
        const humanOwner = clientPlayers.find(p => p.teamId === player.formerTeamId);
        if (humanOwner) {
          rtmAiTeamName.textContent = `${franchises[player.formerTeamId].short} (${humanOwner.name})`;
        } else {
          rtmAiTeamName.textContent = `${franchises[player.formerTeamId].short} (AI)`;
        }
      }
      rtmPromptModal.classList.add('active');
    }
  } else {
    rtmPromptModal.classList.remove('active');
  }
}


// Initialization
function initApp() {
  isMultiplayer = false;
  isHost = false;
  clientPlayers = [];
  myPeerId = socket.id || "";
  phase = "setup";
  selectedXIByTeam = {};
  
  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const networkGuide = document.getElementById('network-guide');
  if (networkGuide) {
    networkGuide.style.display = isLocal ? 'block' : 'none';
  }

  lobbyStatusContainer.style.display = 'none';
  startRetentionBtn.style.display = 'block';
  createRoomBtn.style.display = 'block';
  guestInvitePanel.style.display = 'none';
  clientWaitMessage.style.display = 'none';
  joinLobbyBtn.disabled = false;
  joinLobbyBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Connect & Join Room';

  // Reset states
  franchises = FRANCHISES.map(f => ({
    id: f.id,
    name: f.name,
    short: f.short,
    color1: f.color1,
    color2: f.color2,
    remainingPurseLakhs: 12000, // starting ₹120 Cr
    rtmCardsLeft: 3,
    draftedPlayerIds: []
  }));

  // Parse and order players pool
  initializePlayerPool();

  activePoolIndex = 0;
  currentBidLakhs = 0;
  currentHighestBidderId = null;
  isPaused = false;
  speed = 'normal';
  isRtmPhase = false;

  // Sync Timer Limit selectors
  timeLimitSeconds = parseInt(timerLimitSelect.value);
  timerLimitSelectActive.value = timerLimitSelect.value;
  timerSeconds = timeLimitSeconds;

  // Setup UI components
  initRetentionScreen();
  renderPlayerRegistry();
  setupFilterListeners();
  renderFranchiseSelectorGrid();
  renderRecentRoomsList();
  
  // Show landing
  switchScreen('landing-screen');
  resetAuctionBtn.style.display = 'none';
  statusPhaseIndicator.style.display = 'none';

  // Clear log
  liveAuctionLogFeed.innerHTML = '<div class="log-item"><i class="fa-solid fa-circle-check" style="color: var(--success-color)"></i> Auction simulator initiated successfully.</div>';
}

function initializePlayerPool() {
  const rawPlayers = PLAYERS.map(p => ({
    ...p,
    status: 'available',
    soldPriceLakhs: 0,
    boughtBy: null,
    isRtm: false
  }));

  // 1. Marquee players (not uncapped, basePriceLakhs >= 150)
  const marquees = rawPlayers.filter(p => !p.isUncapped && p.basePriceLakhs >= 150);
  
  // Pick a random marquee player to be the absolute first player
  let firstPlayer = null;
  let remainingMarquees = [...marquees];
  if (marquees.length > 0) {
    const randIdx = Math.floor(Math.random() * marquees.length);
    firstPlayer = marquees[randIdx];
    remainingMarquees.splice(randIdx, 1);
  }

  const marqueeIds = new Set(marquees.map(p => p.id));
  const nonMarquees = rawPlayers.filter(p => !marqueeIds.has(p.id));

  // 2. Bowlers (Capped bowlers, not marquee)
  const cappedBowlers = nonMarquees.filter(p => !p.isUncapped && (p.role === 'Fast Bowler' || p.role === 'Spin Bowler'));
  const cappedBowlerIds = new Set(cappedBowlers.map(p => p.id));

  // 3. Uncapped players
  const uncappedPlayers = nonMarquees.filter(p => p.isUncapped);
  const uncappedIds = new Set(uncappedPlayers.map(p => p.id));

  // 4. Rest of the pool (Capped batters, WK, AR, not marquee)
  const restPlayers = nonMarquees.filter(p => !cappedBowlerIds.has(p.id) && !uncappedIds.has(p.id));

  // Build the ordered pool
  orderedPool = [];
  if (firstPlayer) {
    orderedPool.push(firstPlayer);
  }
  orderedPool.push(...remainingMarquees);
  orderedPool.push(...cappedBowlers);
  orderedPool.push(...uncappedPlayers);
  orderedPool.push(...restPlayers);

  // Truncate to ensure at most 350 players
  if (orderedPool.length > 350) {
    orderedPool = orderedPool.slice(0, 350);
  }

  players = orderedPool;
}

// Navigation Helper
function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// Phase 1: Retentions Screen Code
function initRetentionScreen() {
  const grid = document.getElementById('retention-franchise-grid');
  grid.innerHTML = '';
  selectedRetentions = {};

  franchises.forEach(f => {
    selectedRetentions[f.id] = new Set();
    const teamFormerPlayers = PLAYERS.filter(p => p.formerTeamId === f.id && p.country !== 'Pakistan');

    const card = document.createElement('div');
    card.className = 'team-retention-card';
    card.style.borderColor = f.color1;

    const header = document.createElement('div');
    header.className = 'team-header-bar';

    const badge = document.createElement('div');
    badge.className = 'team-badge-circle';
    badge.style.backgroundColor = f.color1;
    badge.style.borderColor = f.color2;
    badge.textContent = f.short;

    const info = document.createElement('div');
    info.className = 'team-info-block';

    const name = document.createElement('div');
    name.className = 'team-retention-name';
    name.textContent = f.name;

    const purseText = document.createElement('div');
    purseText.className = 'team-retention-purse';
    purseText.id = `retention-purse-${f.id}`;
    purseText.textContent = formatPurse(12000);

    info.appendChild(name);
    info.appendChild(purseText);
    header.appendChild(badge);
    header.appendChild(info);

    const indicators = document.createElement('div');
    indicators.className = 'retention-status-indicators';
    indicators.innerHTML = `
      <div class="status-badge" style="grid-column: span 1; justify-content: center; gap: 0.5rem;">
        <span>Retained:</span><strong id="retention-count-${f.id}">0/3</strong>
      </div>
      <div class="status-badge" style="grid-column: span 1; justify-content: center; gap: 0.5rem;">
        <span>RTM Cards:</span><strong id="retention-rtm-${f.id}">3</strong>
      </div>
    `;

    const candidatesList = document.createElement('div');
    candidatesList.className = 'retention-candidates-list';

    teamFormerPlayers.forEach(p => {
      const row = document.createElement('div');
      row.className = 'candidate-row';
      row.dataset.playerId = p.id;
      row.dataset.teamId = f.id;

      const meta = document.createElement('div');
      meta.className = 'candidate-meta';

      const pName = document.createElement('span');
      pName.className = 'candidate-name';
      pName.textContent = p.name;

      const badges = document.createElement('div');
      badges.className = 'candidate-badges';

      if (p.isOverseas) {
        const b = document.createElement('span');
        b.className = 'badge-tag badge-overseas';
        b.textContent = 'OS';
        badges.appendChild(b);
      }
      if (p.isUncapped) {
        const b = document.createElement('span');
        b.className = 'badge-tag badge-uncapped';
        b.textContent = 'Uncapped';
        badges.appendChild(b);
      } else {
        const b = document.createElement('span');
        b.className = 'badge-tag badge-capped';
        b.textContent = 'Capped';
        badges.appendChild(b);
      }

      meta.appendChild(pName);
      meta.appendChild(badges);

      const price = document.createElement('span');
      price.className = 'candidate-price';
      price.textContent = formatLakhs(p.basePriceLakhs);

      row.appendChild(meta);
      row.appendChild(price);

      row.onclick = () => toggleRetention(f.id, p.id, row);
      candidatesList.appendChild(row);
    });

    card.appendChild(header);
    card.appendChild(indicators);
    card.appendChild(candidatesList);
    grid.appendChild(card);
  });
}

function getRetentionCostAndRtm(retainedList) {
  let totalCostLakhs = 0;
  const costs = [1600, 1200, 800];
  retainedList.forEach((p, idx) => {
    totalCostLakhs += costs[idx] || 0;
  });

  const rtmLeft = Math.max(0, 3 - retainedList.length);

  return {
    cost: totalCostLakhs,
    rtm: rtmLeft,
    cappedCount: retainedList.filter(p => !p.isUncapped).length,
    uncappedCount: retainedList.filter(p => p.isUncapped).length
  };
}

function toggleRetention(teamId, playerId, rowElement) {
  if (isMultiplayer) {
    if (!isHost && teamId !== userTeamId) {
      alert("You cannot edit retentions for another franchise!");
      return;
    }
    const roomId = isHost ? myPeerId : extractRoomIdFromSearch(window.location.search);
    socket.emit('toggle-retention', { roomId, teamId, playerId });
    return;
  }

  const teamSet = selectedRetentions[teamId];

  if (teamSet.has(playerId)) {
    teamSet.delete(playerId);
    rowElement.classList.remove('selected');
  } else {
    const retainedList = Array.from(teamSet).map(id => PLAYERS.find(p => p.id === id));

    if (retainedList.length >= 3) {
      alert("Maximum of 3 retentions allowed per franchise!");
      return;
    }

    teamSet.add(playerId);
    rowElement.classList.add('selected');
  }

  updateTeamRetentionCardUI(teamId);
}

function updateTeamRetentionCardUI(teamId) {
  const teamSet = selectedRetentions[teamId];
  if (!teamSet) return; // FIX #3: Guard against uninitialized state (crashes guests who never called initRetentionScreen)
  const retainedList = Array.from(teamSet).map(id => PLAYERS.find(p => p.id === id));
  const stats = getRetentionCostAndRtm(retainedList);
  const purseLakhs = 12000 - stats.cost;

  document.getElementById(`retention-purse-${teamId}`).textContent = formatPurse(purseLakhs);
  document.getElementById(`retention-count-${teamId}`).textContent = `${retainedList.length}/3`;
  document.getElementById(`retention-rtm-${teamId}`).textContent = stats.rtm;
}

function autoRetainAllAITeams() {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('auto-retain-ai-teams', { roomId: myPeerId });
    return;
  }

  franchises.forEach(f => {
    if (simulationMode === 'franchise' && f.id === userTeamId) return;

    const teamSet = selectedRetentions[f.id];
    teamSet.clear();

    const former = PLAYERS.filter(p => p.formerTeamId === f.id && p.country !== 'Pakistan');
    
    const candidates = [...former].sort((a, b) => b.basePriceLakhs - a.basePriceLakhs);
    const numToRetain = Math.min(candidates.length, Math.floor(Math.random() * 3) + 1); // 1 to 3
    for (let i = 0; i < numToRetain; i++) {
      if (candidates[i]) teamSet.add(candidates[i].id);
    }

    const card = document.getElementById('retention-franchise-grid').children[f.id];
    if (card) {
      card.querySelectorAll('.candidate-row').forEach(row => {
        const pId = parseInt(row.dataset.playerId);
        if (teamSet.has(pId)) {
          row.classList.add('selected');
        } else {
          row.classList.remove('selected');
        }
      });
    }

    updateTeamRetentionCardUI(f.id);
  });
}

function clearAllRetentions() {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('clear-all-retentions', { roomId: myPeerId });
    return;
  }

  franchises.forEach(f => {
    selectedRetentions[f.id].clear();
    const card = document.getElementById('retention-franchise-grid').children[f.id];
    if (card) {
      card.querySelectorAll('.candidate-row').forEach(row => row.classList.remove('selected'));
    }
    updateTeamRetentionCardUI(f.id);
  });
}

// Bidding increments
function getBidIncrement(currentBid) {
  if (currentBid === 0) return 0;
  if (currentBid >= 1000) return 100; // +1 Cr for >=10 Cr
  if (currentBid >= 500) return 50;   // +50 L for 5 Cr to 10 Cr
  if (currentBid >= 200) return 20;   // +20 L for 2 Cr to 5 Cr
  if (currentBid >= 100) return 10;   // +10 L for 1 Cr to 2 Cr
  return 5;                           // +5 L for <1 Cr
}

function getNextBidAmount(currentBid, basePrice) {
  if (currentBid === 0) return basePrice;
  return currentBid + getBidIncrement(currentBid);
}

// Strict Budget & Squad Constraints Validations
function canTeamBid(team, player, nextBid) {
  if (player.status !== 'available') return false;

  // 1. Roster cap <= 25 players
  if (team.draftedPlayerIds.length >= 25) return false;

  // 2. Overseas limit <= 8 players
  if (player.isOverseas) {
    const squad = team.draftedPlayerIds.map(id => players.find(p => p.id === id));
    const overseasCount = squad.filter(p => p.isOverseas).length;
    if (overseasCount >= 8) return false;
  }

  // 3. Purse check (deductions must leave enough)
  if (team.remainingPurseLakhs < nextBid) return false;

  return true;
}

// AI Bidding Engine Strategy & Calculations
function calculateValuation(team, player) {
  if (team.draftedPlayerIds.length >= 25) return 0;
  
  const squad = team.draftedPlayerIds.map(id => players.find(p => p.id === id));
  const overseasCount = squad.filter(p => p.isOverseas).length;
  if (player.isOverseas && overseasCount >= 8) return 0;
  if (team.remainingPurseLakhs < player.basePriceLakhs) return 0;

  // Roster Roles counts
  const roleCounts = {
    'WK-Batter': squad.filter(p => p.role === 'WK-Batter').length,
    'Batter': squad.filter(p => p.role === 'Batter').length,
    'All-Rounder': squad.filter(p => p.role === 'All-Rounder').length,
    'Bowler': squad.filter(p => p.role === 'Fast Bowler' || p.role === 'Spin Bowler').length
  };

  const genericRole = (player.role === 'Fast Bowler' || player.role === 'Spin Bowler') ? 'Bowler' : player.role;
  const count = roleCounts[genericRole] || 0;

  // Role demand multipliers
  let roleMultiplier = 1.0;
  if (genericRole === 'WK-Batter') {
    roleMultiplier = count === 0 ? 2.5 : (count === 1 ? 1.2 : 0.4);
  } else if (genericRole === 'Batter') {
    roleMultiplier = count < 3 ? 2.0 : (count < 5 ? 1.3 : 0.6);
  } else if (genericRole === 'All-Rounder') {
    roleMultiplier = count < 2 ? 1.8 : (count < 4 ? 1.1 : 0.5);
  } else if (genericRole === 'Bowler') {
    roleMultiplier = count < 4 ? 2.2 : (count < 7 ? 1.4 : 0.7);
  }

  // Capped / Uncapped / Marquee Value Adjustments
  let tierWeight = 1.0;
  if (player.isUncapped) {
    tierWeight = 0.8;
  } else {
    tierWeight = player.basePriceLakhs >= 150 ? 2.5 : 1.4;
  }

  // Purse budget weight (more purse left = bid more aggressively)
  const pursePct = team.remainingPurseLakhs / 12000;
  const purseFactor = 0.85 + pursePct * 0.7; // ranges between 0.85 and 1.55

  // Combine weights with natural random noise (+/- 25%)
  const noise = 0.75 + Math.random() * 0.5;
  let finalValuation = player.basePriceLakhs * roleMultiplier * tierWeight * purseFactor * noise;

  // Ensure logical thresholds
  finalValuation = Math.max(player.basePriceLakhs, finalValuation);
  finalValuation = Math.min(team.remainingPurseLakhs, finalValuation);

  return Math.round(finalValuation);
}

// Active Bid Buttons disable validation
function validateBidButtons() {
  const nextBid = getNextBidAmount(currentBidLakhs, players[activePoolIndex].basePriceLakhs);
  const player = players[activePoolIndex];

  // Validate the central Place Bid button
  if (simulationMode === 'franchise') {
    const userTeam = franchises.find(f => f.id === userTeamId);
    const userCanBid = canTeamBid(userTeam, player, nextBid) && (currentHighestBidderId !== userTeamId);
    bidRaiseBtn.disabled = !userCanBid;
  } else if (simulationMode === 'spectator') {
    bidRaiseBtn.disabled = true; // no manual action in spectator
  } else {
    // Sandbox mode
    bidRaiseBtn.disabled = true; // sandbox uses individual team buttons
  }

  // Validate individual team bid buttons in the dashboard grid
  const buttons = franchiseBidButtons.querySelectorAll('.bid-action-btn');
  buttons.forEach(btn => {
    const teamId = parseInt(btn.dataset.teamId);
    const team = franchises.find(f => f.id === teamId);
    
    // Disable if disqualified OR if team is already the leading bidder
    const disqualified = !canTeamBid(team, player, nextBid);
    const isLeader = (currentHighestBidderId === teamId);
    
    // Disallow clicking other teams' buttons in Franchise Mode
    const userRestricted = (simulationMode === 'franchise' && teamId !== userTeamId);
    const spectatorRestricted = (simulationMode === 'spectator');

    btn.disabled = disqualified || isLeader || userRestricted || spectatorRestricted;
  });
}

// Render Franchise quick-bid buttons grid
function populateFranchiseBidButtons() {
  franchiseBidButtons.innerHTML = '';
  franchises.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'bid-action-btn';
    btn.dataset.teamId = f.id;
    btn.style.borderColor = f.color1;
    btn.innerHTML = `
      ${f.short}
      <span id="bid-purse-btn-${f.id}">${formatPurse(f.remainingPurseLakhs)}</span>
    `;
    btn.onclick = () => placeManualBid(f.id);
    franchiseBidButtons.appendChild(btn);
  });
}

function placeManualBid(teamId) {
  const player = players[activePoolIndex];
  if (player.status !== 'available') return;
  const nextBid = getNextBidAmount(currentBidLakhs, player.basePriceLakhs);
  
  if (isMultiplayer) {
    if (simulationMode === 'franchise' && teamId !== userTeamId) return;
    const roomId = isHost ? myPeerId : extractRoomIdFromSearch(window.location.search);
    socket.emit('place-bid', { roomId, teamId, bidAmount: nextBid });
    return;
  }

  if (isPaused) {
    togglePauseTimer();
  }

  executeBid(teamId, nextBid);
}

function executeBid(teamId, bidAmount) {
  const player = players[activePoolIndex];
  if (player.status !== 'available') return;

  currentBidLakhs = bidAmount;
  currentHighestBidderId = teamId;

  // Reset timer
  timerSeconds = timeLimitSeconds;

  const team = franchises.find(f => f.id === teamId);

  // ── SUPER BID SOUND ─────────────────────────────────────────
  playBidSound(bidAmount);

  // Log activity
  logActivity('bid', `<strong>${team.short}</strong> bid ${formatLakhs(bidAmount)}`);

  // Animate bid pulse
  activePlayerCurrentBid.classList.remove('current-bid-value');
  void activePlayerCurrentBid.offsetWidth;
  activePlayerCurrentBid.classList.add('current-bid-value');

  updateActivePlayerCardUI();
  validateBidButtons();

  if (!isMultiplayer || isHost) {
    startTimer();
    scheduleAIReaction();
  }
}

let aiReactionTimeout = null;
function scheduleAIReaction() {
  if (speed === 'instant') return;
  clearTimeout(aiReactionTimeout);
  const delay = Math.random() * 1200 + 600; // reaction stagger 0.6s to 1.8s
  aiReactionTimeout = setTimeout(() => {
    if (!isPaused && !isRtmPhase && phase === 'auction' && timerSeconds > 0) {
      triggerAIBidExecution();
    }
  }, delay);
}

function triggerAIBidExecution() {
  const player = players[activePoolIndex];
  const nextBid = getNextBidAmount(currentBidLakhs, player.basePriceLakhs);
  
  const eligibleAIs = franchises.filter(f => {
    if (simulationMode === 'franchise' && f.id === userTeamId) return false;
    if (isMultiplayer && isHost) {
      const isClientControlled = clientPlayers.some(p => p.teamId === f.id);
      if (isClientControlled) return false;
    }
    if (f.id === currentHighestBidderId) return false;
    return canTeamBid(f, player, nextBid);
  });

  const biddingAIs = eligibleAIs.filter(team => {
    const valuation = calculateValuation(team, player);
    return valuation >= nextBid;
  });

  if (biddingAIs.length > 0) {
    const randomTeam = biddingAIs[Math.floor(Math.random() * biddingAIs.length)];
    executeBid(randomTeam.id, nextBid);
    if (isHost) {
      syncStateToClients();
    }
  }
}

function logActivity(type, text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `
    <span class="log-tag ${type}">${type}</span> 
    <span class="log-time">${time}</span>
    ${text}
  `;
  liveAuctionLogFeed.appendChild(item);
  liveAuctionLogFeed.scrollTop = liveAuctionLogFeed.scrollHeight;
}

// Live Auction Loop & Phase 2 Management
function startLiveAuctionPhase() {
  phase = 'auction';
  switchScreen('auction-screen');
  resetAuctionBtn.style.display = 'inline-flex';
  statusPhaseIndicator.style.display = 'inline-flex';
  statusPhaseIndicator.textContent = 'LIVE AUCTION';

  // Render static elements
  populateFranchiseBidButtons();
  updateUpcomingPlayersUI();
  updateHighestPaidLeaderboardUI();
  updatePurseSpendingLeaderboardUI();
  updateFranchiseBoardUI();

  // Load first player
  loadActivePlayer();
}

function loadActivePlayer() {
  // Find next available player
  while (activePoolIndex < players.length && players[activePoolIndex].status !== 'available') {
    activePoolIndex++;
  }

  if (activePoolIndex >= players.length) {
    endAuction();
    return;
  }

  const player = players[activePoolIndex];
  currentBidLakhs = 0;
  currentHighestBidderId = null;
  timerSeconds = timeLimitSeconds;

  logActivity('bid', `Bidding started for <strong>${player.name}</strong> (Base: ${formatLakhs(player.basePriceLakhs)})`);

  updateActivePlayerCardUI();
  updateUpcomingPlayersUI();
  validateBidButtons();

  // Announce the player with female voice (delay slightly so card animation is visible)
  setTimeout(() => announcePlayerIntro(player), 300);

  // Restart timer ticks
  isPaused = false;
  pauseTimerBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
  startTimer();
}

// ESPN Cricinfo player ID map — real headshot photos
const CRICINFO_ID_MAP = {
  // Indian Players
  "Rishabh Pant":            253655,
  "Sanju Samson":            258237,
  "Ishan Kishan":            720471,
  "Dhruv Jurel":             1125970,
  "KS Bharat":               422108,
  "Dinesh Karthik":          28927,
  "Jitesh Sharma":           1174058,
  "Anuj Rawat":              1151042,
  "Virat Kohli":             253802,
  "Rohit Sharma":            34102,
  "Shubman Gill":            1151254,
  "KL Rahul":                422108,
  "Shreyas Iyer":            642519,
  "Suryakumar Yadav":        476034,
  "Yashasvi Jaiswal":        1151269,
  "Sai Sudharsan":           1151276,
  "Abhishek Sharma":         1151274,
  "Ruturaj Gaikwad":         725404,
  "Devdutt Padikkal":        1151259,
  "Prithvi Shaw":            1159027,
  "Mayank Agarwal":          549192,
  "Manish Pandey":           253758,
  "Sarfaraz Khan":           727335,
  "Tilak Varma":             1151266,
  "Riyan Parag":             1151260,
  "Rajat Patidar":           720469,
  "Nitish Rana":             719985,
  "Rinku Singh":             1161934,
  "Prabhsimran Singh":       1151264,
  "Hardik Pandya":           625371,
  "Ravindra Jadeja":         234675,
  "Axar Patel":              554691,
  "Washington Sundar":       1151258,
  "Shivam Dube":             1151277,
  "Krunal Pandya":           625370,
  "Venkatesh Iyer":          1151253,
  "Shahbaz Ahmed":           1151278,
  "Vijay Shankar":           422253,
  "Nitish Kumar Reddy":      1151268,
  "Deepak Hooda":            549191,
  "Shashank Singh":          1161933,
  "Jasprit Bumrah":          625383,
  "Mohammed Shami":          493773,
  "Arshdeep Singh":          1151252,
  "Bhuvneshwar Kumar":       255881,
  "T Natarajan":             680612,
  "Deepak Chahar":           612371,
  "Shardul Thakur":          586357,
  "Umesh Yadav":             253798,
  "Harshal Patel":           422137,
  "Navdeep Saini":           714614,
  "Mukesh Kumar":            1151275,
  "Avesh Khan":              720474,
  "Akash Deep":              1151262,
  "Yash Dayal":              1151267,
  "Prasidh Krishna":         674222,
  "Mohsin Khan":             1151272,
  "Tushar Deshpande":        706953,
  "Khaleel Ahmed":           700291,
  "Umran Malik":             1151261,
  "Mohit Sharma":            461437,
  "Jaydev Unadkat":          298152,
  "Yuzvendra Chahal":        588394,
  "Kuldeep Yadav":           564921,
  "Ravichandran Ashwin":     59382,
  "Rahul Chahar":            1151280,
  "Ravi Bishnoi":            1151279,
  "Varun Chakaravarthy":     714611,
  "Wriddhiman Saha":         44838,
  "Rahul Tripathi":          553966,
  "R Sai Kishore":           720475,
  "Simarjeet Singh":         1174057,
  "Yash Dayal":              1151267,
  // Overseas — Australia
  "Pat Cummins":             433358,
  "Mitchell Starc":          390733,
  "Josh Hazlewood":          489889,
  "Travis Head":             430246,
  "David Warner":            219889,
  "Glenn Maxwell":           420736,
  "Cameron Green":           1151300,
  "Marcus Stoinis":          623834,
  "Mitchell Marsh":          272201,
  "Nathan Ellis":            1151298,
  "Spencer Johnson":         1234567,
  "Josh Philippe":           1151299,
  "Jake Fraser-McGurk":      1151301,
  "Matthew Short":           1151302,
  "Steve Smith":             267192,
  "Alex Carey":              845523,
  "Matthew Wade":            313388,
  // England
  "Jos Buttler":             308967,
  "Ben Stokes":              356996,
  "Jofra Archer":            669855,
  "Mark Wood":               308072,
  "Sam Curran":              1151320,
  "Liam Livingstone":        783194,
  "Jonny Bairstow":          297626,
  "Phil Salt":               1151321,
  "Moeen Ali":               299855,
  "Chris Woakes":            262011,
  "Adil Rashid":             228767,
  "Will Jacks":              1151322,
  "Rehan Ahmed":             1174061,
  "Chris Jordan":            354452,
  // South Africa
  "Heinrich Klaasen":        322845,
  "Quinton de Kock":         529761,
  "Faf du Plessis":          44827,
  "David Miller":            311592,
  "Aiden Markram":           670280,
  "Kagiso Rabada":           793463,
  "Anrich Nortje":           888203,
  "Rilee Rossouw":           321778,
  "Tristan Stubbs":          1151325,
  "Dewald Brevis":           1174060,
  "Marco Jansen":            1174063,
  "Gerald Coetzee":          1151326,
  "Tabraiz Shamsi":          584793,
  "Lungi Ngidi":             714398,
  "Ryan Rickelton":          1151327,
  // West Indies
  "Nicholas Pooran":         717516,
  "Andre Russell":           311592,
  "Sunil Narine":            239774,
  "Kieron Pollard":          48045,
  "Jason Holder":            579776,
  "Rovman Powell":           779048,
  "Shimron Hetmyer":         861678,
  "Kyle Mayers":             891846,
  "Alzarri Joseph":          861679,
  "Romario Shepherd":        1151340,
  "Evin Lewis":              718340,
  // New Zealand
  "Kane Williamson":         277906,
  "Trent Boult":             325012,
  "Lockie Ferguson":         826521,
  "Rachin Ravindra":         1151345,
  "Devon Conway":            697750,
  "Finn Allen":              1151344,
  "Daryl Mitchell":          796608,
  "Matt Henry":              580878,
  "Mitchell Santner":        582175,
  "Glenn Phillips":          1151346,
  // Sri Lanka
  "Wanindu Hasaranga":       721340,
  "Matheesha Pathirana":     1174062,
  "Maheesh Theekshana":      1151356,
  "Dushmantha Chameera":     498478,
  "Kusal Mendis":            584894,
  "Pathum Nissanka":         1151355,
  // Afghanistan
  "Rashid Khan":             793463,
  "Mohammad Nabi":           285047,
  "Mujeeb Ur Rahman":        1151360,
  "Noor Ahmad":              1174065,
  "Naveen-ul-Haq":           836734,
  "Fazalhaq Farooqi":        1151361,
  "Rahmanullah Gurbaz":      1151362,
  // Pakistan
  "Babar Azam":              348144,
  "Mohammad Rizwan":         490456,
  "Shaheen Afridi":          947513,
  "Haris Rauf":              1151370,
  "Naseem Shah":             1151371,
  "Shadab Khan":             798374,
  "Saim Ayub":               1174070,
  // Bangladesh
  "Mustafizur Rahman":       756665,
  "Shakib Al Hasan":         56143,
  "Taskin Ahmed":            731438,
  "Litton Das":              661635,
  "Towhid Hridoy":           1151375,
  // Zimbabwe
  "Sikandar Raza":           131540,
  "Blessing Muzarabani":     1151380,
  // Singapore
  "Tim David":               1151385,
};

function getPlayerPhotoUrl(player) {
  // Local override folder (place custom photos in publish/player_photos/)
  const LOCAL_PLAYER_PHOTOS = {
    "Trent Boult": "player_photos/trent_boult.jpg"
  };
  const local = LOCAL_PLAYER_PHOTOS[player.name];
  if (local) {
    return local; // relative path served from the publish/ root
  }

  const cricId = CRICINFO_ID_MAP[player.name];
  if (cricId) {
    // Primary: ESPN Cricinfo player headshot (official CDN)
    return `https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/${Math.floor(cricId/1000)*1000}/${cricId}.jpg`;
  }
  return null;
}

// Multi-source fallback: try Cricbuzz CDN if ESPN fails
function getPlayerPhotoFallbackUrl(player) {
  const cbId = CRICBUZZ_ID_MAP[player.name];
  if (cbId) {
    return `https://img1.cricbuzz.com/a/img/v1/75x75/i1/c${cbId}/i.jpg`;
  }
  return null;
}

// Cricbuzz ID map for additional fallback coverage
const CRICBUZZ_ID_MAP = {
  "Virat Kohli":         1413,
  "Rohit Sharma":        1560,
  "Jasprit Bumrah":      5058,
  "Hardik Pandya":       5074,
  "Ravindra Jadeja":     1446,
  "Suryakumar Yadav":    8180,
  "KL Rahul":            5765,
  "Shubman Gill":        10671,
  "Rishabh Pant":        13616,
  "Sanju Samson":        6773,
  "Yashasvi Jaiswal":    20140,
  "Mohammed Shami":      4320,
  "Arshdeep Singh":      19270,
  "Axar Patel":          7770,
  "Yuzvendra Chahal":    4330,
  "Kuldeep Yadav":       9688,
  "Shreyas Iyer":        8228,
  "Rashid Khan":         14280,
  "Pat Cummins":         9428,
  "Mitchell Starc":      6356,
  "Jos Buttler":         4952,
  "David Warner":        5403,
  "Glenn Maxwell":       9512,
  "Ben Stokes":          7678,
  "Jofra Archer":        15601,
  "Kagiso Rabada":       14567,
  "Trent Boult":         9294,
  "Sunil Narine":        8212,
  "Andre Russell":       5983,
  "Babar Azam":          28235,
  "Shaheen Afridi":      26038,
  "Nicholas Pooran":     13015,
  "Wanindu Hasaranga":   21267,
  "Travis Head":         10124,
  "Faf du Plessis":      6748,
  "Kane Williamson":     9554,
  "Sam Curran":          19541,
  "Liam Livingstone":    15419,
  "Shimron Hetmyer":     15375,
  "Ruturaj Gaikwad":     19896,
  "Tilak Varma":         20367,
  "Rinku Singh":         20250,
  "Nitish Kumar Reddy":  20447,
};

function showPlayerPhotoPlaceholder(imgEl, player) {
  if (imgEl) imgEl.style.display = 'none';
  const ph = document.getElementById('active-player-photo-placeholder');
  if (ph) {
    const parts = player.name.split(' ');
    const initials = parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : player.name.substring(0, 2);
    ph.textContent = initials.toUpperCase();
    // BW style for uncapped, color style for capped
    if (player.isUncapped) {
      ph.style.background = 'linear-gradient(135deg, #2a2a2e, #1a1a1e)';
      ph.style.color = 'rgba(255,255,255,0.25)';
      ph.style.filter = 'grayscale(100%)';
    } else {
      ph.style.background = 'linear-gradient(135deg, #1a1a3e, #0a0a2e)';
      ph.style.color = 'rgba(212,175,55,0.5)';
      ph.style.filter = 'none';
    }
    ph.style.display = 'flex';
  }
}

function updateActivePlayerCardUI() {
  const player = players[activePoolIndex];
  activePlayerName.textContent = player.name;
  
  // Update player photo — try ESPN CDN first, then Cricbuzz, then initials
  const photoEl = document.getElementById('active-player-photo');
  const placeholderEl = document.getElementById('active-player-photo-placeholder');
  const primaryUrl = getPlayerPhotoUrl(player);
  const fallbackUrl = getPlayerPhotoFallbackUrl(player);
  if (photoEl) {
    if (primaryUrl) {
      photoEl.src = primaryUrl;
      photoEl.style.display = 'block';
      if (placeholderEl) placeholderEl.style.display = 'none';
      photoEl.onerror = () => {
        // Try Cricbuzz fallback
        if (fallbackUrl) {
          photoEl.src = fallbackUrl;
          photoEl.onerror = () => showPlayerPhotoPlaceholder(photoEl, player);
        } else {
          showPlayerPhotoPlaceholder(photoEl, player);
        }
      };
    } else if (fallbackUrl) {
      photoEl.src = fallbackUrl;
      photoEl.style.display = 'block';
      if (placeholderEl) placeholderEl.style.display = 'none';
      photoEl.onerror = () => showPlayerPhotoPlaceholder(photoEl, player);
    } else {
      photoEl.style.display = 'none';
      showPlayerPhotoPlaceholder(null, player);
    }
  }
  
  // Format role
  const isBowler = (player.role === 'Fast Bowler' || player.role === 'Spin Bowler');
  activePlayerRole.textContent = isBowler ? 'BOWLER' : player.role;
  activePlayerNationality.innerHTML = player.isOverseas 
    ? '<i class="fa-solid fa-plane-departure" style="color: var(--accent-gold);"></i> OVERSEAS' 
    : 'INDIAN';
  activePlayerCountry.textContent = player.country;
  activePlayerCappedStatus.textContent = player.isUncapped ? 'UNCAPPED' : 'CAPPED';
  activePlayerFormerTeam.textContent = `Former Team: ${FRANCHISES[player.formerTeamId].short}`;

  // Current Bid
  if (currentBidLakhs === 0) {
    activePlayerCurrentBid.textContent = formatLakhs(player.basePriceLakhs);
    document.getElementById('current-bid-label').textContent = 'BASE PRICE';
  } else {
    activePlayerCurrentBid.textContent = formatLakhs(currentBidLakhs);
    document.getElementById('current-bid-label').textContent = 'CURRENT BID';
  }

  // Highest Bidder Banner
  if (currentHighestBidderId !== null) {
    const leaderTeam = franchises.find(f => f.id === currentHighestBidderId);
    activePlayerLeaderBanner.style.display = 'block';
    activePlayerLeaderBanner.innerHTML = `
      Highest Bidder: <span class="current-leader-team" style="background: ${leaderTeam.color1}; color: #fff;">${leaderTeam.short}</span>
    `;
  } else {
    activePlayerLeaderBanner.style.display = 'block';
    activePlayerLeaderBanner.textContent = 'No bids placed yet';
  }

  // Timer label
  updateTimerUI();

  // Next bid amount on gavel button
  const nextBid = getNextBidAmount(currentBidLakhs, player.basePriceLakhs);
  nextBidAmountLabel.textContent = formatLakhs(nextBid);

  // Active player index progress stats
  const completedCount = players.filter(p => p.status !== 'available').length;
  activePlayerProgressStats.textContent = `Player ${completedCount + 1} of ${players.length}`;
}

// ─── Countdown Sound Engine ─────────────────────────────────────────────────
// Plays a specific beep character for each timer stage:
//   > 5s  : soft neutral tick  (low-pitch short click)
//   3–5s  : rising urgency     (mid-pitch double beep)
//   1–2s  : sharp red alert    (high-pitch rapid beep)
//   0s    : final hammer slam  (heavy thud burst)

function playCountdownTick(secondsLeft) {
  initAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;

  if (secondsLeft > 5) {
    // Soft neutral tick — quiet, woody knock
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 8) * 0.18;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.6, t);
    src.connect(g);
    g.connect(audioCtx.destination);
    src.start(t);

  } else if (secondsLeft > 2) {
    // Urgency double-beep — two short ascending tones
    [0, 0.12].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.connect(g); g.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520 + i * 80, t + offset);
      g.gain.setValueAtTime(0, t + offset);
      g.gain.linearRampToValueAtTime(0.35, t + offset + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.11);
      osc.start(t + offset);
      osc.stop(t + offset + 0.12);
    });

  } else if (secondsLeft > 0) {
    // Sharp red-alert — fast high triple blip
    [0, 0.08, 0.16].forEach(offset => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.connect(g); g.connect(audioCtx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t + offset);
      g.gain.setValueAtTime(0, t + offset);
      g.gain.linearRampToValueAtTime(0.22, t + offset + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.07);
      osc.start(t + offset);
      osc.stop(t + offset + 0.08);
    });

  } else {
    // Final hammer slam — deep thud + high crack
    // Deep thud
    const osc1 = audioCtx.createOscillator();
    const g1   = audioCtx.createGain();
    osc1.connect(g1); g1.connect(audioCtx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(140, t);
    osc1.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    g1.gain.setValueAtTime(0.7, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc1.start(t); osc1.stop(t + 0.36);

    // High crack
    const osc2 = audioCtx.createOscillator();
    const g2   = audioCtx.createGain();
    osc2.connect(g2); g2.connect(audioCtx.destination);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(600, t);
    osc2.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    g2.gain.setValueAtTime(0.4, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc2.start(t); osc2.stop(t + 0.2);
  }
}

function updateTimerUI() {
  activePlayerTimer.textContent = `${timerSeconds}s`;

  // Remove all stage classes first
  activePlayerTimer.classList.remove('timer-warning', 'timer-normal', 'timer-urgent', 'timer-critical');

  if (timerSeconds <= 0) {
    activePlayerTimer.classList.add('timer-critical');
  } else if (timerSeconds <= 2) {
    activePlayerTimer.classList.add('timer-critical');
  } else if (timerSeconds <= 5) {
    activePlayerTimer.classList.add('timer-urgent');
  } else {
    activePlayerTimer.classList.add('timer-normal');
  }
}

// Bidding timer intervals
function startTimer() {
  clearInterval(timerInterval);
  if (isMultiplayer) return; // Server runs multiplayer game timer loop

  if (speed === 'instant') {
    resolveActivePlayerInstant();
    return;
  }

  const intervalTime = speed === 'fast' ? 200 : 1000;

  timerInterval = setInterval(() => {
    if (!isPaused && !isRtmPhase) {
      timerSeconds--;

      if (isHost) syncStateToClients();

      updateTimerUI();

      // Play the stage-specific countdown sound (skip in fast/instant mode to avoid spam)
      if (speed === 'normal') {
        playCountdownTick(timerSeconds);
      } else if (speed === 'fast' && timerSeconds <= 2) {
        playCountdownTick(timerSeconds); // still play the final slam even in fast mode
      }

      // Trigger AI bidding checks periodically
      if (timerSeconds > 0) {
        triggerAIBids();
      } else {
        clearInterval(timerInterval);
        resolveActivePlayer();
      }
    }
  }, intervalTime);
}

function triggerAIBids() {
  const player = players[activePoolIndex];
  const nextBid = getNextBidAmount(currentBidLakhs, player.basePriceLakhs);
  
  // 35% chance per tick to keep auction moving since ticks are slower (1s)
  if (Math.random() > 0.35) return;

  const eligibleAIs = franchises.filter(f => {
    if (simulationMode === 'franchise' && f.id === userTeamId) return false;
    if (isMultiplayer && isHost) {
      const isClientControlled = clientPlayers.some(p => p.teamId === f.id);
      if (isClientControlled) return false;
    }
    if (f.id === currentHighestBidderId) return false;
    return canTeamBid(f, player, nextBid);
  });

  const biddingAIs = eligibleAIs.filter(team => {
    const valuation = calculateValuation(team, player);
    return valuation >= nextBid;
  });

  if (biddingAIs.length > 0) {
    const randomTeam = biddingAIs[Math.floor(Math.random() * biddingAIs.length)];
    executeBid(randomTeam.id, nextBid);
    if (isHost) {
      syncStateToClients();
    }
  }
}

// RTM Verification & Execution Logic
function resolveActivePlayer() {
  const player = players[activePoolIndex];
  
  if (currentHighestBidderId === null) {
    declareUnsold();
    return;
  }

  const formerTeam = franchises.find(f => f.id === player.formerTeamId);
  const highestBidder = franchises.find(f => f.id === currentHighestBidderId);
  const isPakistani = player.country === 'Pakistan';

  const rtmEligible = !isPakistani &&
                      formerTeam.id !== highestBidder.id && 
                      formerTeam.rtmCardsLeft > 0 && 
                      currentBidLakhs >= 100 && currentBidLakhs <= 1000 &&
                      canTeamBid(formerTeam, player, currentBidLakhs);

  if (rtmEligible) {
    isRtmPhase = true;
    isPaused = true;
    clearInterval(timerInterval);

    const guestPlayer = clientPlayers.find(p => p.teamId === formerTeam.id && !p.isHost);

    if (guestPlayer && isHost) {
      // Send RTM_REQUEST directly to the guest controlling the former team via Socket.io
      socket.emit('host-message-to-client', {
        roomId: myPeerId,
        targetSocketId: guestPlayer.peerId,
        data: {
          type: 'RTM_REQUEST',
          player: { name: player.name, country: player.country, role: player.role, formerTeamId: player.formerTeamId },
          currentBid: currentBidLakhs
        }
      });
      
      rtmResolutionPromise = (match) => {
        isRtmPhase = false;
        declareSold(match ? formerTeam.id : currentHighestBidderId, currentBidLakhs, match);
      };
      
      logActivity('rtm', `Waiting for <strong>${formerTeam.short}</strong> (${guestPlayer.name}) to decide on RTM...`);
      rtmPlayerName.textContent = player.name;
      rtmPlayerDetails.textContent = `${player.country} • ${player.role}`;
      rtmFormerTeamName.textContent = formerTeam.short;
      rtmHighestBidVal.textContent = formatLakhs(currentBidLakhs);
      rtmHighestBidderName.textContent = franchises.find(f => f.id === currentHighestBidderId).short;
      rtmActionButtonsBox.style.display = 'none';
      rtmAiThinking.style.display = 'flex';
      rtmAiTeamName.textContent = `${formerTeam.short} (${guestPlayer.name})`;
      rtmPromptModal.classList.add('active');
    } else if (simulationMode === 'franchise' && formerTeam.id === userTeamId) {
      openRtmPromptUser();
    } else {
      resolveRTMForAI(formerTeam, player);
    }
  } else {
    declareSold(currentHighestBidderId, currentBidLakhs, false);
  }
}

function openRtmPromptUser() {
  const player = players[activePoolIndex];
  const bidder = franchises.find(f => f.id === currentHighestBidderId);
  
  rtmPlayerName.textContent = player.name;
  rtmPlayerDetails.textContent = `${player.country} • ${player.role}`;
  rtmFormerTeamName.textContent = franchises.find(f => f.id === player.formerTeamId).short;
  rtmHighestBidVal.textContent = formatLakhs(currentBidLakhs);
  rtmHighestBidderName.textContent = bidder.short;

  rtmActionButtonsBox.style.display = 'flex';
  rtmAiThinking.style.display = 'none';
  rtmPromptModal.classList.add('active');
}

// User decline RTM click
document.getElementById('rtm-decline-btn').onclick = () => {
  rtmPromptModal.classList.remove('active');
  isRtmPhase = false;
  if (isMultiplayer) {
    const roomId = isHost ? myPeerId : extractRoomIdFromSearch(window.location.search);
    socket.emit('rtm-decision', { roomId, teamId: players[activePoolIndex].formerTeamId, match: false });
  } else {
    declareSold(currentHighestBidderId, currentBidLakhs, false);
  }
};

// User match RTM click
document.getElementById('rtm-confirm-btn').onclick = () => {
  rtmPromptModal.classList.remove('active');
  isRtmPhase = false;
  if (isMultiplayer) {
    const roomId = isHost ? myPeerId : extractRoomIdFromSearch(window.location.search);
    socket.emit('rtm-decision', { roomId, teamId: players[activePoolIndex].formerTeamId, match: true });
  } else {
    declareSold(players[activePoolIndex].formerTeamId, currentBidLakhs, true);
  }
};

function resolveRTMForAI(formerTeam, player) {
  const valuation = calculateValuation(formerTeam, player);
  const matchBid = valuation >= currentBidLakhs;

  rtmPlayerName.textContent = player.name;
  rtmPlayerDetails.textContent = `${player.country} • ${player.role}`;
  rtmFormerTeamName.textContent = formerTeam.short;
  rtmHighestBidVal.textContent = formatLakhs(currentBidLakhs);
  rtmHighestBidderName.textContent = franchises.find(f => f.id === currentHighestBidderId).short;

  rtmActionButtonsBox.style.display = 'none';
  rtmAiThinking.style.display = 'flex';
  rtmAiTeamName.textContent = formerTeam.short;
  rtmPromptModal.classList.add('active');

  const delay = speed === 'fast' ? 500 : (speed === 'instant' ? 0 : 2000);

  setTimeout(() => {
    rtmPromptModal.classList.remove('active');
    isRtmPhase = false;
    if (matchBid) {
      declareSold(formerTeam.id, currentBidLakhs, true);
    } else {
      declareSold(currentHighestBidderId, currentBidLakhs, false);
    }
  }, delay);
}

function resolveActivePlayerInstant() {
  const player = players[activePoolIndex];
  
  // Fast bidding iterations
  let nextBid = getNextBidAmount(currentBidLakhs, player.basePriceLakhs);
  let biddingActive = true;

  while (biddingActive) {
    const eligibleAIs = franchises.filter(f => {
      if (simulationMode === 'franchise' && f.id === userTeamId) return false;
      if (f.id === currentHighestBidderId) return false;
      return canTeamBid(f, player, nextBid);
    });

    const interested = eligibleAIs.filter(team => calculateValuation(team, player) >= nextBid);

    if (interested.length > 0) {
      const chosen = interested[Math.floor(Math.random() * interested.length)];
      currentBidLakhs = nextBid;
      currentHighestBidderId = chosen.id;
      nextBid = getNextBidAmount(currentBidLakhs, player.basePriceLakhs);
    } else {
      biddingActive = false;
    }
  }

  // Resolve sold/unsold directly without delays
  resolveActivePlayer();
}

function declareSold(teamId, amountLakhs, usedRtm) {
  const player = players[activePoolIndex];
  const team = franchises.find(f => f.id === teamId);

  // Apply state updates
  player.status = usedRtm ? 'retained' : 'sold';
  player.soldPriceLakhs = amountLakhs;
  player.boughtBy = teamId;
  player.isRtm = usedRtm;

  team.remainingPurseLakhs -= amountLakhs;
  team.draftedPlayerIds.push(player.id);
  if (usedRtm) {
    team.rtmCardsLeft--;
  }

  // Sync clients with effects
  if (isHost) {
    broadcast({
      type: 'TRIGGER_EFFECT',
      effectType: 'sold',
      playerName: player.name,
      boughtBy: teamId,
      amountLakhs: amountLakhs,
      isRtm: usedRtm
    });
  }

  // Play local sound, speech, and balloons
  playSoldSound();
  const annText = usedRtm 
    ? `${player.name} retained by ${team.name} for ${formatLakhs(amountLakhs)}!`
    : `${player.name} sold to ${team.name} for ${formatLakhs(amountLakhs)}!`;
  announceAuctionResult(annText);
  triggerBalloonCelebration();

  // Log and reload UI
  if (usedRtm) {
    logActivity('rtm', `<strong>${team.short}</strong> matches and retains <strong>${player.name}</strong> for ${formatLakhs(amountLakhs)}!`);
  } else {
    logActivity('sold', `<strong>${player.name}</strong> sold to <strong>${team.short}</strong> for ${formatLakhs(amountLakhs)}`);
  }

  updateLiveAnalyticsUI();
  updateUpcomingPlayersUI();
  updatePurseSpendingLeaderboardUI();
  updateHighestPaidLeaderboardUI();
  updateFranchiseBoardUI();
  renderPlayerRegistry();

  rtmPromptModal.classList.remove('active');

  if (isHost) {
    syncStateToClients();
  }

  advanceNextPlayerDelay();
}

function declareUnsold() {
  const player = players[activePoolIndex];
  player.status = 'unsold';

  // Sync clients with effects
  if (isHost) {
    broadcast({
      type: 'TRIGGER_EFFECT',
      effectType: 'unsold',
      playerName: player.name
    });
  }

  playUnsoldSound();
  announceAuctionResult(`${player.name} is unsold.`);

  logActivity('unsold', `<strong>${player.name}</strong> went unsold`);

  updateLiveAnalyticsUI();
  updateUpcomingPlayersUI();
  updateFranchiseBoardUI();
  renderPlayerRegistry();

  if (isHost) {
    syncStateToClients();
  }

  advanceNextPlayerDelay();
}

function advanceNextPlayerDelay() {
  clearInterval(timerInterval);

  if (autoAdvance) {
    const activePlayer = players[activePoolIndex];
    const isSold = activePlayer && (activePlayer.status === 'sold' || activePlayer.status === 'retained');
    const delay = (isSold && speed !== 'instant') ? 4500 : 0;

    if (isSold && speed !== 'instant') {
      const team = franchises.find(f => f.id === activePlayer.boughtBy);
      const overlay = document.getElementById('sold-celebration-overlay');
      const title = document.getElementById('celebration-title');
      const msg = document.getElementById('celebration-message');
      const price = document.getElementById('celebration-price');

      if (overlay && team) {
        title.textContent = `SOLD TO ${team.short}`;
        msg.textContent = `Congratulations to ${team.name}!`;
        price.textContent = formatLakhs(activePlayer.soldPriceLakhs);
        overlay.style.display = 'flex';
      }
    }

    setTimeout(() => {
      const overlay = document.getElementById('sold-celebration-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
      activePoolIndex++;
      
      if (isHost) {
        syncStateToClients();
      }
      
      loadActivePlayer();
    }, delay);
  } else {
    // Wait for manual trigger
    bidRaiseBtn.disabled = true;
  }
}

// Manual trigger controls when autoAdvance is unchecked
soldPlayerBtn.onclick = () => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('sold-player', { roomId: myPeerId });
  } else {
    if (currentHighestBidderId !== null && players[activePoolIndex].status === 'available') {
      resolveActivePlayer();
    }
  }
};

unsoldPlayerBtn.onclick = () => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('unsold-player', { roomId: myPeerId });
  } else {
    if (players[activePoolIndex].status === 'available') {
      declareUnsold();
    }
  }
};

// Start retentions confirmations
confirmRetentionsBtn.onclick = () => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('lock-retentions', { roomId: myPeerId });
    return;
  }

  franchises.forEach(f => {
    const teamSet = selectedRetentions[f.id] || new Set();
    const retainedIds = Array.from(teamSet);
    const retainedPlayersList = retainedIds.map(id => PLAYERS.find(p => p.id === id));
    
    const stats = getRetentionCostAndRtm(retainedPlayersList);
    f.remainingPurseLakhs = 12000 - stats.cost;
    f.rtmCardsLeft = stats.rtm;

    const costs = [1600, 1200, 800];
    
    retainedPlayersList.forEach((p, index) => {
      const livePlayerRef = players.find(lp => lp.id === p.id);
      if (livePlayerRef) {
        livePlayerRef.status = 'retained';
        livePlayerRef.soldPriceLakhs = costs[index] || 0;
        livePlayerRef.boughtBy = f.id;
      }
      f.draftedPlayerIds.push(p.id);
    });
  });

  phase = 'auction';
  startLiveAuctionPhase();
};

function endAuction() {
  phase = 'finished';
  clearInterval(timerInterval);
  statusPhaseIndicator.textContent = 'AUCTION COMPLETED';
  logActivity('sold', '<strong>AUCTION COMPLETED!</strong> All players processed.');
  
  activePlayerName.textContent = 'AUCTION COMPLETE';
  activePlayerRole.textContent = 'NONE';
  activePlayerCappedStatus.textContent = '';
  activePlayerTimer.textContent = '00:00';
  activePlayerLeaderBanner.textContent = 'Final squads compiled.';
  
  bidRaiseBtn.disabled = true;
  franchiseBidButtons.querySelectorAll('button').forEach(b => b.disabled = true);
}

// Real-Time Analytics UI widgets
function updateLiveAnalyticsUI() {
  const soldPlayers = players.filter(p => p.status === 'sold' || p.status === 'retained');
  
  // Total Spent
  const totalSpentLakhs = soldPlayers.reduce((sum, p) => sum + p.soldPriceLakhs, 0);
  statTotalSpent.textContent = formatPurse(totalSpentLakhs);

  // Most Expensive
  if (soldPlayers.length > 0) {
    const mostExp = [...soldPlayers].sort((a, b) => b.soldPriceLakhs - a.soldPriceLakhs)[0];
    const team = franchises.find(f => f.id === mostExp.boughtBy);
    statMostExpensive.innerHTML = `${mostExp.name}<br><span style="color: var(--accent-gold); font-size: 0.85rem;">${formatLakhs(mostExp.soldPriceLakhs)} (${team.short})</span>`;
  } else {
    statMostExpensive.textContent = '-';
  }

  // Cheapest
  const pureSoldPlayers = players.filter(p => p.status === 'sold');
  if (pureSoldPlayers.length > 0) {
    const cheapest = [...pureSoldPlayers].sort((a, b) => a.soldPriceLakhs - b.soldPriceLakhs)[0];
    const team = franchises.find(f => f.id === cheapest.boughtBy);
    statCheapestSold.innerHTML = `${cheapest.name}<br><span style="color: var(--accent-gold); font-size: 0.85rem;">${formatLakhs(cheapest.soldPriceLakhs)} (${team.short})</span>`;
  } else {
    statCheapestSold.textContent = '-';
  }

  // Progress
  const processed = players.filter(p => p.status !== 'available').length;
  statProgressCount.textContent = `${processed} / ${players.length} Players Resolved`;
}

// Filters listeners
function setupFilterListeners() {
  document.querySelectorAll('.filter-group').forEach(group => {
    group.querySelectorAll('.filter-btn').forEach(btn => {
      btn.onclick = () => {
        group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Extract active filter options
        const role = btn.dataset.filterRole;
        const origin = btn.dataset.filterOrigin;
        const type = btn.dataset.filterType;
        const status = btn.dataset.filterStatus;

        if (role) activeRoleFilter = role;
        if (origin) activeOriginFilter = origin;
        if (type) activeTypeFilter = type;
        if (status) activeStatusFilter = status;

        renderPlayerRegistry();
      };
    });
  });

  searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    renderPlayerRegistry();
  };
}

let activeRoleFilter = 'all';
let activeOriginFilter = 'all';
let activeTypeFilter = 'all';
let activeStatusFilter = 'all';
let searchQuery = '';

function renderPlayerRegistry() {
  const grid = document.getElementById('player-registry-grid');
  grid.innerHTML = '';

  const filtered = players.filter(p => {
    if (activeRoleFilter !== 'all') {
      if (activeRoleFilter === 'Fast Bowler' || activeRoleFilter === 'Spin Bowler') {
        if (p.role !== activeRoleFilter) return false;
      } else {
        if (p.role !== activeRoleFilter) return false;
      }
    }
    if (activeOriginFilter !== 'all') {
      if (activeOriginFilter === 'indian' && p.isOverseas) return false;
      if (activeOriginFilter === 'overseas' && !p.isOverseas) return false;
    }
    if (activeTypeFilter !== 'all') {
      if (activeTypeFilter === 'capped' && p.isUncapped) return false;
      if (activeTypeFilter === 'uncapped' && !p.isUncapped) return false;
    }
    if (activeStatusFilter !== 'all') {
      if (p.status !== activeStatusFilter) return false;
    }
    if (searchQuery) {
      if (!p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">No players match the criteria.</div>';
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = `pool-player-card ${p.status}`;
    
    const head = document.createElement('div');
    head.className = 'pool-card-header';
    
    const pid = document.createElement('span');
    pid.className = 'pool-player-id';
    pid.textContent = `#${p.id}`;
    
    const statusTag = document.createElement('span');
    statusTag.className = `pool-status-tag ${p.status}`;
    statusTag.textContent = p.status;

    head.appendChild(pid);
    head.appendChild(statusTag);

    const name = document.createElement('div');
    name.className = 'pool-player-name';
    name.textContent = p.name;

    const details = document.createElement('div');
    details.className = 'pool-player-role';
    details.textContent = `${p.country} • ${p.role}`;

    const price = document.createElement('div');
    price.className = 'pool-player-price';
    if (p.status === 'sold' || p.status === 'retained') {
      price.textContent = `${formatLakhs(p.soldPriceLakhs)} (Sold)`;
    } else {
      price.textContent = `Base: ${formatLakhs(p.basePriceLakhs)}`;
    }

    card.appendChild(head);
    card.appendChild(name);
    card.appendChild(details);
    card.appendChild(price);
    grid.appendChild(card);
  });
}

function updateUpcomingPlayersUI() {
  const upcomingList = document.getElementById('upcoming-players-list');
  upcomingList.innerHTML = '';

  const upcoming = players.slice(activePoolIndex + 1).filter(p => p.status === 'available').slice(0, 5);

  if (upcoming.length === 0) {
    upcomingList.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem; text-align: center;">No upcoming players</div>';
    return;
  }

  upcoming.forEach(p => {
    const item = document.createElement('div');
    item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.85rem; border: 1px solid var(--border-color);';

    const text = document.createElement('div');
    text.style.cssText = 'display: flex; flex-direction: column; overflow: hidden;';
    
    const name = document.createElement('span');
    name.style.cssText = 'font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;';
    name.textContent = p.name;
    
    const sub = document.createElement('span');
    sub.style.cssText = 'font-size: 0.7rem; color: var(--text-secondary);';
    sub.textContent = `${p.isOverseas ? 'OS' : 'IND'} • ${p.role}`;

    text.appendChild(name);
    text.appendChild(sub);

    const price = document.createElement('span');
    price.style.cssText = 'font-weight: 700; color: var(--accent-gold);';
    price.textContent = formatLakhs(p.basePriceLakhs);

    item.appendChild(text);
    item.appendChild(price);
    upcomingList.appendChild(item);
  });
}

function updateHighestPaidLeaderboardUI() {
  const list = document.getElementById('highest-paid-leaderboard');
  list.innerHTML = '';

  const sold = players.filter(p => (p.status === 'sold' || p.status === 'retained') && p.soldPriceLakhs > 0)
                      .sort((a, b) => b.soldPriceLakhs - a.soldPriceLakhs)
                      .slice(0, 10);

  if (sold.length === 0) {
    list.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem; text-align: center;">No players bought yet.</div>';
    return;
  }

  sold.forEach((p, idx) => {
    const team = franchises.find(f => f.id === p.boughtBy);
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; background: rgba(255,255,255,0.02); padding: 0.4rem 0.6rem; border-radius: 5px; margin-bottom: 0.3rem; border: 1px solid var(--border-color);';

    const content = document.createElement('div');
    content.style.cssText = 'display: flex; align-items: center; gap: 0.4rem; overflow: hidden;';

    const rank = document.createElement('span');
    rank.style.cssText = 'font-weight: 700; color: var(--accent-gold); width: 12px;';
    rank.textContent = `${idx + 1}`;

    const name = document.createElement('span');
    name.style.cssText = 'font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 125px;';
    name.textContent = p.name;

    const badge = document.createElement('span');
    badge.style.cssText = `font-size: 0.65rem; font-weight: 800; padding: 0.1rem 0.3rem; border-radius: 3px; background: ${team.color1}; color: #fff; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);`;
    badge.textContent = team.short;

    content.appendChild(rank);
    content.appendChild(name);
    content.appendChild(badge);

    const price = document.createElement('span');
    price.style.cssText = 'font-weight: 800; color: #fff;';
    price.textContent = formatLakhs(p.soldPriceLakhs);

    row.appendChild(content);
    row.appendChild(price);
    list.appendChild(row);
  });
}

function updatePurseSpendingLeaderboardUI() {
  const list = document.getElementById('stats-spending-leaderboard');
  list.innerHTML = '';

  const sorted = [...franchises].sort((a, b) => b.remainingPurseLakhs - a.remainingPurseLakhs); // most spending first

  sorted.forEach(f => {
    const spent = 12000 - f.remainingPurseLakhs;
    const pct = (spent / 12000) * 100;

    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom: 0.5rem;';

    const details = document.createElement('div');
    details.style.cssText = 'display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600;';

    const label = document.createElement('span');
    label.textContent = f.short;

    const val = document.createElement('span');
    val.style.color = 'var(--accent-gold)';
    val.textContent = `${formatPurse(f.remainingPurseLakhs)}`;

    details.appendChild(label);
    details.appendChild(val);

    const barOuter = document.createElement('div');
    barOuter.className = 'leaderboard-bar-outer';

    const barInner = document.createElement('div');
    barInner.className = 'leaderboard-bar-inner';
    barInner.style.backgroundColor = f.color1;
    barInner.style.width = `${pct}%`;

    barOuter.appendChild(barInner);
    row.appendChild(details);
    row.appendChild(barOuter);
    list.appendChild(row);
  });
}

function updateFranchiseBoardUI() {
  const list = document.getElementById('teams-dashboard-list');
  list.innerHTML = '';

  franchises.forEach(f => {
    const item = document.createElement('div');
    item.className = 'team-list-item';
    
    if (simulationMode === 'franchise' && f.id === userTeamId) {
      item.classList.add('selected-user');
    }

    item.onclick = () => showSquadModal(f.id);

    const badge = document.createElement('div');
    badge.className = 'team-badge-circle';
    badge.style.backgroundColor = f.color1;
    badge.style.borderColor = f.color2;
    badge.textContent = f.short;

    const meta = document.createElement('div');
    meta.className = 'team-meta-info';

    const name = document.createElement('div');
    name.className = 'team-name-short';
    name.textContent = f.name;

    if (simulationMode === 'franchise' && f.id === userTeamId) {
      name.innerHTML += ' <span style="font-size: 0.65rem; color: var(--accent-gold); border: 1px solid var(--accent-gold); padding: 1px 4px; border-radius: 3px; font-weight: 800; font-family: Space Grotesk;">USER</span>';
    }

    const purseText = document.createElement('div');
    purseText.className = 'team-list-purse';
    purseText.textContent = formatPurse(f.remainingPurseLakhs);

    const squad = f.draftedPlayerIds.map(id => players.find(p => p.id === id));
    const size = squad.length;
    const overseas = squad.filter(p => p.isOverseas).length;

    const stats = document.createElement('div');
    stats.className = 'team-list-stats';
    stats.innerHTML = `
      <span>SLOTS: ${size}/25</span>
      <span>OS: ${overseas}/8</span>
      <span>RTM: ${f.rtmCardsLeft}</span>
    `;

    meta.appendChild(name);
    meta.appendChild(purseText);
    meta.appendChild(stats);

    item.appendChild(badge);
    item.appendChild(meta);
    list.appendChild(item);
  });
}

// Squad viewer modal controls
function showSquadModal(teamId) {
  const team = franchises.find(f => f.id === teamId);
  if (!team) return;

  // Header
  document.getElementById('squad-modal-team-title').textContent = team.name;
  const badge = document.getElementById('squad-modal-badge');
  badge.textContent = team.short;
  badge.style.background = team.color1;
  badge.style.color = '#fff';
  badge.style.borderColor = team.color2;

  const teamSquad = team.draftedPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean);
  const size     = teamSquad.length;
  const overseas = teamSquad.filter(p => p.isOverseas).length;
  const spent    = 12000 - team.remainingPurseLakhs;
  const xi       = getProjectedPlayingXI(teamSquad);

  // KPI tiles
  document.getElementById('squad-modal-purse').textContent      = formatPurse(team.remainingPurseLakhs);
  document.getElementById('squad-modal-squad-size').textContent  = `${size} / 25`;
  document.getElementById('squad-modal-overseas').textContent    = `${overseas} / 8`;
  document.getElementById('squad-modal-rtm').textContent         = team.rtmCardsLeft;
  document.getElementById('squad-modal-spent').textContent       = formatPurse(spent);
  document.getElementById('squad-modal-xi-status').textContent   = `${xi.length} / 11`;

  // colour KPI tiles based on limits
  const sizeEl = document.getElementById('squad-modal-squad-size');
  sizeEl.style.color = size >= 25 ? 'var(--danger-color)' : size >= 20 ? 'var(--warning-color)' : '#fff';
  const osEl = document.getElementById('squad-modal-overseas');
  osEl.style.color = overseas >= 8 ? 'var(--danger-color)' : overseas >= 6 ? 'var(--warning-color)' : '#fff';

  // ── Role buckets ────────────────────────────────────────────────────────
  const wk   = teamSquad.filter(p => p.role === 'WK-Batter');
  const bat  = teamSquad.filter(p => p.role === 'Batter');
  const ar   = teamSquad.filter(p => p.role === 'All-Rounder');
  const bowl = teamSquad.filter(p => p.role === 'Fast Bowler' || p.role === 'Spin Bowler');

  // Update tab labels with counts
  const tabs = document.querySelectorAll('.squad-tab');
  tabs.forEach(t => {
    const m = { xi:`🏟️ Playing XI`, wk:`🧤 WK (${wk.length})`, bat:`🏏 Batters (${bat.length})`, ar:`⚡ All-Rounders (${ar.length})`, bowl:`🎯 Bowlers (${bowl.length})`, full:`📋 Full Squad (${size})` };
    if (m[t.dataset.tab]) t.textContent = m[t.dataset.tab];
  });

  // ── Render role list tabs ────────────────────────────────────────────────
  renderRoleList('squad-list-wk',   wk,   team);
  renderRoleList('squad-list-bat',  bat,  team);
  renderRoleList('squad-list-ar',   ar,   team);
  renderRoleList('squad-list-bowl', bowl, team);
  renderFullSquadList('squad-modal-players-list', teamSquad, team);

  // Prepare manual XI builder state and UI
  selectedXIByTeam[team.id] = (selectedXIByTeam[team.id] || []).filter(id => team.draftedPlayerIds.includes(id));
  buildXISelectionPanel(team, teamSquad);

  // ── Playing XI ───────────────────────────────────────────────────────────
  updatePlayingXIUI(teamSquad, team);

  // Reset to XI tab
  document.querySelectorAll('.squad-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.squad-tab-content').forEach(p => p.style.display = 'none');
  const xiTab = document.querySelector('.squad-tab[data-tab="xi"]');
  if (xiTab) xiTab.classList.add('active');
  const xiPanel = document.getElementById('squad-tab-xi');
  if (xiPanel) xiPanel.style.display = 'block';

  document.getElementById('squad-viewer-modal').classList.add('active');
}

function getManualXIForTeam(team, teamSquad) {
  const selectedIds = selectedXIByTeam[team.id] || [];
  return selectedIds
    .map(id => teamSquad.find(p => p.id === id))
    .filter(Boolean)
    .slice(0, 11);
}

function buildXISelectionPanel(team, teamSquad) {
  const poolEl = document.getElementById('xi-squad-draggable-pool');
  const selectedIds = new Set(selectedXIByTeam[team.id] || []);
  poolEl.innerHTML = '';

  const availablePlayers = teamSquad
    .filter(p => !selectedIds.has(p.id))
    .sort((a, b) => b.soldPriceLakhs - a.soldPriceLakhs);

  if (availablePlayers.length === 0) {
    poolEl.innerHTML = '<div class="squad-empty-msg">No draftable players remain outside your XI.</div>';
  } else {
    availablePlayers.forEach(p => {
      const row = document.createElement('div');
      row.className = 'squad-player-row xi-drag-item';
      row.draggable = true;
      row.dataset.playerId = p.id;
      row.innerHTML = `
        <div class="squad-player-info">
          <span class="squad-player-name-text">${p.name}</span>
          <div class="squad-player-meta-badges">${makeBadges(p)}</div>
        </div>
        <span style="font-weight:700;color:var(--accent-gold);">${formatLakhs(p.soldPriceLakhs)}</span>
      `;
      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', String(p.id));
        e.dataTransfer.effectAllowed = 'move';
      });
      poolEl.appendChild(row);
    });
  }

  const resetBtn = document.getElementById('xi-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      selectedXIByTeam[team.id] = [];
      buildXISelectionPanel(team, teamSquad);
      updatePlayingXIUI(teamSquad, team);
    };
  }

  renderXISelectionGrid(team, teamSquad);
}

function renderXISelectionGrid(team, teamSquad) {
  const grid = document.getElementById('playing-xi-slots-grid');
  grid.innerHTML = '';

  const roleClr = { WK:'#D4AF37', BAT:'#10B981', AR:'#3B82F6', BOWL:'#EF4444' };
  const selectedPlayers = getManualXIForTeam(team, teamSquad);

  for (let index = 0; index < 11; index++) {
    const player = selectedPlayers[index] || null;
    const card = document.createElement('div');
    card.className = `xi-card ${player ? 'xi-card-filled' : ''}`;
    card.dataset.slotIndex = String(index);
    card.addEventListener('dragover', e => e.preventDefault());
    card.addEventListener('drop', e => {
      e.preventDefault();
      const playerId = parseInt(e.dataTransfer.getData('text/plain'));
      if (!Number.isNaN(playerId)) {
        assignPlayerToXI(team, teamSquad, playerId, index);
      }
    });

    const playerRole = player ? (player.role === 'WK-Batter' ? 'WK' : player.role === 'Batter' ? 'BAT' : player.role === 'All-Rounder' ? 'AR' : 'BOWL') : null;
    const clr = playerRole ? roleClr[playerRole] : '#4B5563';
    const icon = playerRole ? (playerRole === 'WK' ? '🧤' : playerRole === 'BAT' ? '🏏' : playerRole === 'AR' ? '⚡' : '🎯') : '👤';
    const roleLbl = playerRole ? playerRole : `SLOT ${index + 1}`;

    if (player) {
      const initials = player.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      card.innerHTML = `
        <div class="xi-card-slot-lbl" style="background:${clr};color:#000;">${icon} ${roleLbl}</div>
        <div class="xi-card-photo"><div class="xi-card-initials">${initials}</div></div>
        <div class="xi-card-name">${player.name}</div>
        <div class="xi-card-meta">
          ${player.isOverseas ? '<span class="xi-os-badge">OS</span>' : ''}
          <span class="xi-card-price">${formatLakhs(player.soldPriceLakhs)}</span>
        </div>
      `;
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', String(player.id));
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('click', () => {
        removePlayerFromXI(team.id, player.id, teamSquad);
      });
    } else {
      card.innerHTML = `
        <div class="xi-card-slot-lbl" style="background:${clr};color:#fff;">${icon} ${roleLbl}</div>
        <div class="xi-card-photo xi-card-empty-photo"><span style="font-size:1.6rem;opacity:0.2;">${icon}</span></div>
        <div class="xi-card-name xi-empty-name">EMPTY SLOT</div>
        <div class="xi-card-meta" style="color:rgba(255,255,255,0.2);font-size:0.65rem;">Drop a player here</div>
      `;
    }
    grid.appendChild(card);
  }
}

function assignPlayerToXI(team, teamSquad, playerId, slotIndex) {
  selectedXIByTeam[team.id] = selectedXIByTeam[team.id] || [];
  const selectedIds = selectedXIByTeam[team.id];
  const validPlayer = teamSquad.find(p => p.id === playerId);
  if (!validPlayer) return;

  const existingIndex = selectedIds.indexOf(playerId);
  if (existingIndex !== -1) {
    selectedIds.splice(existingIndex, 1);
  }

  selectedIds[slotIndex] = playerId;
  selectedXIByTeam[team.id] = selectedIds.filter(id => id != null);
  if (selectedXIByTeam[team.id].length > 11) {
    selectedXIByTeam[team.id] = selectedXIByTeam[team.id].slice(0, 11);
  }

  buildXISelectionPanel(team, teamSquad);
  updatePlayingXIUI(teamSquad, team);
}

function removePlayerFromXI(teamId, playerId, teamSquad) {
  selectedXIByTeam[teamId] = selectedXIByTeam[teamId] || [];
  const idx = selectedXIByTeam[teamId].indexOf(playerId);
  if (idx !== -1) {
    selectedXIByTeam[teamId].splice(idx, 1);
    buildXISelectionPanel(franchises.find(f => f.id === teamId), teamSquad);
    updatePlayingXIUI(teamSquad, franchises.find(f => f.id === teamId));
  }
}

function makeBadges(p) {
  let html = '';
  if (p.isOverseas) html += `<span class="badge-tag badge-overseas">OS</span>`;
  if (p.isUncapped) html += `<span class="badge-tag badge-uncapped">Uncapped</span>`;
  else              html += `<span class="badge-tag badge-capped">Capped</span>`;
  if (p.status === 'retained') html += `<span class="badge-tag badge-rtm-gold">Retained</span>`;
  else if (p.isRtm)            html += `<span class="badge-tag badge-rtm-gold">RTM</span>`;
  return html;
}

function renderRoleList(containerId, list, team) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (list.length === 0) {
    el.innerHTML = '<div class="squad-empty-msg">No players in this category yet.</div>';
    return;
  }
  // Sort by price desc
  [...list].sort((a,b) => b.soldPriceLakhs - a.soldPriceLakhs).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'squad-role-row';
    row.style.borderLeftColor = team.color1;
    row.innerHTML = `
      <div class="squad-role-num">${i+1}</div>
      <div class="squad-role-info">
        <div class="squad-role-name">${p.name}</div>
        <div class="squad-role-sub">${p.country} &bull; ${p.role} &bull; ${makeBadges(p)}</div>
      </div>
      <div class="squad-role-price">${formatLakhs(p.soldPriceLakhs)}</div>
    `;
    el.appendChild(row);
  });
}

function renderFullSquadList(containerId, squad, team) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (squad.length === 0) {
    el.innerHTML = '<div class="squad-empty-msg">No players drafted yet.</div>';
    return;
  }
  const groups = [
    { title:'🧤 Wicket Keepers', list: squad.filter(p=>p.role==='WK-Batter') },
    { title:'🏏 Batters',        list: squad.filter(p=>p.role==='Batter') },
    { title:'⚡ All-Rounders',   list: squad.filter(p=>p.role==='All-Rounder') },
    { title:'🎯 Fast Bowlers',   list: squad.filter(p=>p.role==='Fast Bowler') },
    { title:'🌀 Spin Bowlers',   list: squad.filter(p=>p.role==='Spin Bowler') },
  ];
  groups.forEach(g => {
    if (!g.list.length) return;
    const hdr = document.createElement('div');
    hdr.className = 'squad-group-header';
    hdr.textContent = `${g.title} (${g.list.length})`;
    el.appendChild(hdr);
    [...g.list].sort((a,b)=>b.soldPriceLakhs-a.soldPriceLakhs).forEach(p => {
      const row = document.createElement('div');
      row.className = 'squad-player-row';
      row.innerHTML = `
        <div class="squad-player-info">
          <span class="squad-player-name-text">${p.name}</span>
          <div class="squad-player-meta-badges">${makeBadges(p)}</div>
        </div>
        <span style="font-weight:700;color:var(--accent-gold);">${formatLakhs(p.soldPriceLakhs)}</span>
      `;
      el.appendChild(row);
    });
  });
}

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('active');
};

// ── Playing XI builder ─────────────────────────────────────────────────────
function getProjectedPlayingXI(squad) {
  const sorted = [...squad].sort((a, b) => b.soldPriceLakhs - a.soldPriceLakhs);
  const xi = [];
  let osCount = 0;

  for (const p of sorted) {
    if (xi.length >= 11) break;
    if (p.isOverseas) {
      if (osCount < 4) {
        xi.push(p);
        osCount++;
      }
    } else {
      xi.push(p);
    }
  }

  return xi;
}

function updatePlayingXIUI(squad, team) {
  const grid = document.getElementById('playing-xi-slots-grid');
  grid.innerHTML = '';

  const manualXI = getManualXIForTeam(team, squad);
  const xi        = manualXI.length > 0 ? manualXI : getProjectedPlayingXI(squad);
  const os        = xi.filter(p => p.isOverseas).length;
  const ind       = xi.length - os;
  const bar       = document.getElementById('playing-xi-validation-status');

  document.getElementById('squad-modal-xi-status').textContent = `${xi.length} / 11`;

  if (xi.length === 0) {
    bar.innerHTML = '<span style="color:var(--text-secondary)">No players drafted yet — buy players to build your XI.</span>';
  } else if (xi.length < 11) {
    bar.innerHTML = `<span style="color:var(--warning-color)">⚠ Incomplete XI (${xi.length}/11). Select ${11-xi.length} more players from the squad.</span>`;
  } else {
    const valid = os <= 4 && ind >= 7;
    bar.innerHTML = valid
      ? `<span style="color:var(--success-color)">✅ Valid XI — ${ind} Indians, ${os} Overseas (Max 4 OS)</span>`
      : `<span style="color:var(--danger-color)">❌ Invalid XI — ${os} overseas or fewer than 7 Indians.</span>`;
  }

  const roleClr = { WK:'#D4AF37', BAT:'#10B981', AR:'#3B82F6', BOWL:'#EF4444' };

  for (let i = 0; i < 11; i++) {
    const p = xi[i];
    const playerRole = p ? (p.role === 'WK-Batter' ? 'WK' : p.role === 'Batter' ? 'BAT' : p.role === 'All-Rounder' ? 'AR' : 'BOWL') : null;
    const clr = playerRole ? roleClr[playerRole] : '#4B5563';
    const icon = playerRole ? (playerRole === 'WK' ? '🧤' : playerRole === 'BAT' ? '🏏' : playerRole === 'AR' ? '⚡' : '🎯') : '👤';
    const roleLbl = playerRole ? playerRole : `Slot ${i + 1}`;

    const card = document.createElement('div');
    card.className = `xi-card ${p ? 'xi-card-filled' : ''}`;
    card.style.setProperty('--role-clr', clr);
    if (team) card.style.setProperty('--team-clr', team.color1);

    if (p) {
      const photoUrl = getPlayerPhotoUrl ? getPlayerPhotoUrl(p) : null;
      const initials = p.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
      card.innerHTML = `
        <div class="xi-card-slot-lbl" style="background:${clr};color:#000;">${icon} ${roleLbl}</div>
        <div class="xi-card-photo">
          ${photoUrl
            ? `<img src="${photoUrl}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="xi-card-initials" style="display:none;">${initials}</div>`
            : `<div class="xi-card-initials">${initials}</div>`}
        </div>
        <div class="xi-card-name">${p.name}</div>
        <div class="xi-card-meta">
          ${p.isOverseas ? '<span class="xi-os-badge">OS</span>' : ''}
          <span class="xi-card-price">${formatLakhs(p.soldPriceLakhs)}</span>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="xi-card-slot-lbl" style="background:${clr};color:#fff;">${icon} ${roleLbl}</div>
        <div class="xi-card-photo xi-card-empty-photo">
          <span style="font-size:1.6rem;opacity:0.2;">${icon}</span>
        </div>
        <div class="xi-card-name xi-empty-name">Slot ${i + 1}</div>
        <div class="xi-card-meta" style="color:rgba(255,255,255,0.2);font-size:0.65rem;">EMPTY SLOT</div>
      `;
    }
    grid.appendChild(card);
  }
}

// Configuration Screen Handlers
startRetentionBtn.onclick = () => {
  // Read Setup selections
  userTeamId = parseInt(userTeamSelect.value);
  simulationMode = 'franchise';
  timeLimitSeconds = parseInt(timerLimitSelect.value);
  timerLimitSelectActive.value = timerLimitSelect.value;
  timerSeconds = timeLimitSeconds;

  phase = 'retention';
  
  if (isHost) {
    const me = clientPlayers.find(p => p.isHost);
    if (me) {
      me.teamId = userTeamId;
      me.name = (welcomeNameInput.value.trim() || 'Host') + " (Host)";
    }
    syncStateToClients();
  }

  // Phase transitions
  switchScreen('retention-screen');
  statusPhaseIndicator.style.display = 'inline-flex';
  statusPhaseIndicator.textContent = 'RETENTION PHASE';
  initRetentionScreen();
};

autoRetainAllBtn.onclick = () => autoRetainAllAITeams();
resetRetentionsBtn.onclick = () => clearAllRetentions();

// Live auction controls
speedNormalBtn.onclick = () => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('speed-change', { roomId: myPeerId, speed: 'normal' });
  } else {
    speed = 'normal';
    speedNormalBtn.classList.add('active');
    speedFastBtn.classList.remove('active');
    speedInstantBtn.classList.remove('active');
    startTimer();
  }
};

speedFastBtn.onclick = () => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('speed-change', { roomId: myPeerId, speed: 'fast' });
  } else {
    speed = 'fast';
    speedNormalBtn.classList.remove('active');
    speedFastBtn.classList.add('active');
    speedInstantBtn.classList.remove('active');
    startTimer();
  }
};

speedInstantBtn.onclick = () => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('speed-change', { roomId: myPeerId, speed: 'instant' });
  } else {
    speed = 'instant';
    speedNormalBtn.classList.remove('active');
    speedFastBtn.classList.remove('active');
    speedInstantBtn.classList.add('active');
    startTimer();
  }
};

function togglePauseTimer() {
  isPaused = !isPaused;
  pauseTimerBtn.innerHTML = isPaused 
    ? '<i class="fa-solid fa-play"></i> Resume' 
    : '<i class="fa-solid fa-pause"></i> Pause';
  
  if (isPaused) {
    logActivity('bid', 'Bidding paused by admin');
  } else {
    logActivity('bid', 'Bidding resumed');
  }
}
pauseTimerBtn.onclick = () => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('pause-toggle', { roomId: myPeerId });
  } else {
    togglePauseTimer();
  }
};

autoAdvanceCheck.onchange = (e) => {
  if (isMultiplayer) {
    if (!isHost) return;
    socket.emit('auto-advance-toggle', { roomId: myPeerId, autoAdvance: e.target.checked });
  } else {
    autoAdvance = e.target.checked;
  }
};

// Configurable Timer selectors syncing
timerLimitSelect.onchange = (e) => {
  timeLimitSeconds = parseInt(e.target.value);
  timerLimitSelectActive.value = e.target.value;
  if (currentBidLakhs === 0) {
    timerSeconds = timeLimitSeconds;
    updateTimerUI();
  }
};

timerLimitSelectActive.onchange = (e) => {
  timeLimitSeconds = parseInt(e.target.value);
  timerLimitSelect.value = e.target.value;
  
  // If active player has no bids, update timer instantly
  if (currentBidLakhs === 0) {
    timerSeconds = timeLimitSeconds;
    updateTimerUI();
  }
  logActivity('bid', `Time limit changed to ${e.target.options[e.target.selectedIndex].text} per player.`);
};

// Gavel Raise Button
bidRaiseBtn.onclick = () => {
  placeManualBid(userTeamId);
};

resetAuctionBtn.onclick = () => {
  if (confirm("Are you sure you want to reset the simulator? All data will be lost.")) {
    if (isMultiplayer) {
      if (!isHost) return;
      socket.emit('reset-room', { roomId: myPeerId });
    } else {
      clearInterval(timerInterval);
      initApp();
    }
  }
};

// Create Room Button
createRoomBtn.onclick = () => {
  isMultiplayer = true;
  isHost = true;
  simulationMode = 'franchise';
  userTeamId = parseInt(userTeamSelect.value);
  timeLimitSeconds = parseInt(timerLimitSelect.value);
  timerSeconds = timeLimitSeconds;

  // We instantly generate the roomId locally
  const localRoomId = 'room_' + Math.floor(100000 + Math.random() * 900000);
  myPeerId = localRoomId;
  activeRoomId = localRoomId; // FIX #1: Set stable room ID — survives socket reconnects

  // Set the privacy and pin
  const privacyVal = document.querySelector('input[name="room-privacy"]:checked').value;
  isPrivateRoom = (privacyVal === 'private');
  hostRoomPin = isPrivateRoom ? Math.floor(1000 + Math.random() * 9000).toString() : "";

  // Set the active session object
  const hName = welcomeNameInput.value.trim() || 'Host';
  activeLobbySession = {
    type: 'host',
    roomId: localRoomId,
    pin: hostRoomPin,
    isPrivate: isPrivateRoom,
    playerName: hName,
    teamId: userTeamId
  };

  // Hide action buttons, show lobby details
  startRetentionBtn.style.display = 'none';
  createRoomBtn.style.display = 'none';
  lobbyStatusContainer.style.display = 'block';
  startMultiplayerBtn.style.display = 'block';
  clientWaitMessage.style.display = 'none';

  if (isPrivateRoom) {
    lobbyPrivacyBadge.innerHTML = '<i class="fa-solid fa-lock" style="color: var(--accent-gold)"></i> Private';
    lobbyPinDisplayGroup.style.display = 'block';
    lobbyPinValue.textContent = hostRoomPin;
  } else {
    lobbyPrivacyBadge.innerHTML = '<i class="fa-solid fa-globe" style="color: var(--accent-gold)"></i> Public';
    lobbyPinDisplayGroup.style.display = 'none';
    lobbyPinValue.textContent = '-';
  }

  // Resolve share URL and setup initial host lobby UI in the background
  (async () => {
    await resolveShareBaseUrl();
    const link = buildRoomLink(localRoomId, isPrivateRoom ? hostRoomPin : '');
    lobbyLinkInput.value = link;
    window.history.replaceState({ roomId: localRoomId }, '', link);
    
    clientPlayers = [{
      peerId: socket.id || 'connecting',
      name: `${hName} (Host)`,
      teamId: userTeamId,
      isHost: true
    }];
    updateLobbyPlayersUI();
    saveRoomToHistory(localRoomId, true);
    saveHostGameStateToLocalStorage();
  })();

  // Trigger emit if socket is already connected, else wait for background connection
  if (socket.connected) {
    socket.emit('host-create-room', {
      roomId: localRoomId,
      pin: hostRoomPin,
      isPrivate: isPrivateRoom,
      playerName: hName + " (Host)",
      teamId: userTeamId
    });
  } else {
    updateConnectionBadge('connecting');
  }
};

// Start Multiplayer Button (Host only)
startMultiplayerBtn.onclick = () => {
  if (clientPlayers.length < 2) {
    if (!confirm("Starting multiplayer with only yourself. Do you want to proceed?")) {
      return;
    }
  }
  
  phase = 'retention';
  timeLimitSeconds = parseInt(timerLimitSelect.value);
  timerSeconds = timeLimitSeconds;
  
  if (isHost) {
    const me = clientPlayers.find(p => p.isHost);
    if (me) {
      me.teamId = userTeamId;
      me.name = (welcomeNameInput.value.trim() || 'Host') + " (Host)";
    }
    // FIX #4/#5: Notify server that retention phase has started
    // This ensures reconnecting guests get correct phase from server, not stale 'setup'
    const roomIdForRetention = activeRoomId || myPeerId;
    socket.emit('start-retention', { roomId: roomIdForRetention });
    syncStateToClients();
  }

  switchScreen('retention-screen');
  statusPhaseIndicator.style.display = 'inline-flex';
  statusPhaseIndicator.textContent = 'RETENTION PHASE';
  initRetentionScreen();
};

// Lobby Guest Join click binding
joinLobbyBtn.onclick = () => {
  const name = welcomeNameInput.value.trim() || 'Guest';
  const code = extractRoomIdFromSearch(window.location.search);
  const teamId = parseInt(userTeamSelect.value);
  const pin = guestPinInput.value.trim();
  
  if (!name) {
    alert("Please enter your name.");
    return;
  }
  if (!code) {
    alert("No room code found in URL to join.");
    return;
  }
  
  // Transition UI instantly to the lobby screen!
  isMultiplayer = true;
  isHost = false;
  guestInvitePanel.style.display = 'none';
  lobbyStatusContainer.style.display = 'block';
  clientWaitMessage.style.display = 'block';
  
  const link = buildRoomLink(code, pin);
  lobbyLinkInput.value = link;
  window.history.replaceState({ roomId: code }, '', link);

  // Set active guest session
  activeLobbySession = {
    type: 'guest',
    roomId: code,
    pin: pin,
    playerName: name,
    teamId: teamId
  };

  // Trigger emit if socket is already connected
  if (socket.connected) {
    socket.emit('guest-join-room', { roomId: code, pin, playerName: name, teamId });
  } else {
    updateConnectionBadge('connecting');
  }

  saveRoomToHistory(code, false);
};

// Clipboard copying link click binding
copyLobbyBtn.onclick = () => {
  const input = document.getElementById('lobby-link-input');
  input.select();
  document.execCommand('copy');
  
  const originalText = copyLobbyBtn.innerHTML;
  copyLobbyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
  setTimeout(() => {
    copyLobbyBtn.innerHTML = originalText;
  }, 2000);
};

// Share lobby link button click binding
shareLobbyBtn.onclick = async () => {
  const link = lobbyLinkInput.value;
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'IPL Mega Auction Lobby',
        text: 'Join my IPL Mega Auction room!',
        url: link
      });
    } catch (e) {
      console.log('Error sharing:', e);
    }
  } else {
    // Fallback: Copy to clipboard
    lobbyLinkInput.select();
    document.execCommand('copy');
    alert('Share option not fully supported on this browser. Invite link copied to clipboard instead!');
  }
};

// Run initialize on load
initApp();

// ── URL param detection: auto-show guest join panel ──────────────────────
const _roomParam  = extractRoomIdFromSearch(window.location.search);
const _pinParam   = extractPinFromSearch(window.location.search);

if (_roomParam) {
  const isLocalDevelopment = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const currentPort = window.location.port;

  if (isLocalDevelopment && currentPort && currentPort !== '3000') {
    // Auto-redirect only for local dev to the Node server port.
    const correctUrl = `http://${window.location.hostname}:3000/?room=${encodeURIComponent(_roomParam)}${_pinParam ? '&pin=' + encodeURIComponent(_pinParam) : ''}`;
    window.location.replace(correctUrl);
  } else {
    // Auto-resume if the user was the host of this room in history
    const historyStr = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    let history = [];
    if (historyStr) {
      try {
        history = JSON.parse(historyStr);
      } catch(e) {}
    }
    const matchedRoom = history.find(item => item.roomId === _roomParam);
    if (matchedRoom && matchedRoom.isHost) {
      welcomeNameInput.value = matchedRoom.userName;
      userTeamId = matchedRoom.teamId;
      userTeamSelect.value = matchedRoom.teamId.toString();
      renderFranchiseSelectorGrid();
      isMultiplayer = true;
      isHost = true;
      resumeHostLobby(_roomParam);
    } else {
      // Transition UI instantly to the guest lobby screen!
      startRetentionBtn.style.display = 'none';
      createRoomBtn.style.display = 'none';
      guestInvitePanel.style.display = 'none';
      lobbyStatusContainer.style.display = 'block';
      clientWaitMessage.style.display = 'block';

      const name = welcomeNameInput.value.trim() || ("Guest_" + Math.floor(1000 + Math.random() * 9000));
      welcomeNameInput.value = name;

      const link = buildRoomLink(_roomParam, _pinParam);
      lobbyLinkInput.value = link;

      lobbyPrivacyBadge.innerHTML = _pinParam ? '<i class="fa-solid fa-lock" style="color: var(--accent-gold)"></i> Private' : '<i class="fa-solid fa-globe" style="color: var(--accent-gold)"></i> Public';
      if (_pinParam) {
        lobbyPinDisplayGroup.style.display = 'block';
        lobbyPinValue.textContent = _pinParam;
      } else {
        lobbyPinDisplayGroup.style.display = 'none';
      }

      // Set active guest session
      activeLobbySession = {
        type: 'guest',
        roomId: _roomParam,
        pin: _pinParam || "",
        playerName: name,
        teamId: userTeamId
      };

      // Trigger emit if socket is already connected, else wait for connect event
      if (socket.connected) {
        socket.emit('guest-join-room', {
          roomId: _roomParam,
          pin: _pinParam || "",
          playerName: name,
          teamId: userTeamId
        });
      } else {
        updateConnectionBadge('connecting');
      }
    }
  }
}

// ─── Network Mode: LAN vs Tunnel ───────────────────────────────────────────
let currentNetMode = 'lan';

window.switchNetMode = function(mode) {
  currentNetMode = mode;
  document.getElementById('net-lan-btn').classList.toggle('active', mode === 'lan');
  document.getElementById('net-tunnel-btn').classList.toggle('active', mode === 'tunnel');
  document.getElementById('net-lan-info').style.display  = mode === 'lan'    ? 'block' : 'none';
  document.getElementById('net-tunnel-info').style.display = mode === 'tunnel' ? 'block' : 'none';
};

window.applyTunnelUrl = function() {
  const inp = document.getElementById('tunnel-url-input');
  const base = (inp.value || '').trim();
  if (!base) return;
  shareBaseUrl = normalizeShareBaseUrl(base);
  // Rebuild the current room link with tunnel base
  const roomId = myPeerId;
  if (roomId) {
    const link = buildRoomLink(roomId, isPrivateRoom ? hostRoomPin : '');
    document.getElementById('lobby-link-input').value = link;
    logActivity('bid', `Tunnel URL applied. Share this link: <strong>${link}</strong>`);
  }
};

// ─── Voice Announcer Toggle ───
const voiceToggleBtn = document.getElementById('voice-toggle-btn');
if (voiceToggleBtn) {
  voiceToggleBtn.onclick = () => {
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
      voiceToggleBtn.classList.remove('voice-off');
      voiceToggleBtn.innerHTML = '<i class="fa-solid fa-microphone" style="color: var(--accent-gold);"></i> Voice';
    } else {
      voiceToggleBtn.classList.add('voice-off');
      voiceToggleBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i> Voice Off';
      window.speechSynthesis && window.speechSynthesis.cancel();
    }
  };
}
