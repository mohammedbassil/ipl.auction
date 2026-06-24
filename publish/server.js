const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const { FRANCHISES, PLAYERS } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ── Helper: get LAN IP so we can print shareable URLs ──────────────────────
function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// Serve static assets from the current directory
app.use(express.static(__dirname));

// API: return server's own origin so frontend builds correct room links
app.get('/api/server-info', (req, res) => {
  const origin = process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
  const lan = getLanIp();
  res.json({
    origin,
    localUrl: `http://localhost:${PORT}`,
    lanUrl: `http://${lan}:${PORT}`,
    port: PORT
  });
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/api/room/:roomId', (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) {
    return res.status(404).json({
      exists: false,
      message: 'Room not found'
    });
  }

  const origin = process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
  const takenTeamIds = Object.values(room.clients).map(c => c.teamId);
  res.json({
    exists: true,
    roomId: room.id,
    isPrivate: room.isPrivate,
    requiresPin: room.isPrivate,
    clientCount: Object.keys(room.clients).length,
    takenTeamIds,
    hostConnected: !!io.sockets.sockets.get(room.hostSocketId),
    joinUrl: `${origin}/?room=${room.id}`,
    privateJoinUrl: room.isPrivate ? `${origin}/?room=${room.id}&pin=${room.pin}` : null
  });
});

// Direct root route to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// In-memory Room State Registry
const rooms = {};

// Helper to initialize full game state for a room
function initializeRoomState(room) {
  room.phase = 'setup';
  room.isRtmPhase = false;
  room.activePoolIndex = 0;
  room.currentBidLakhs = 0;
  room.currentHighestBidderId = null;
  room.timerSeconds = 15;
  room.timeLimitSeconds = 15;
  room.isPaused = false;
  room.speed = 'normal';
  room.autoAdvance = true;
  room.selectedRetentions = {}; // teamId -> Array of playerIds
  room.selectedXIByTeam = {}; // teamId -> Array of selected playerIds for final XI slots
  room.timerIntervalId = null;

  // Initialize franchises
  room.franchises = FRANCHISES.map(f => ({
    id: f.id,
    name: f.name,
    short: f.short,
    color1: f.color1,
    color2: f.color2,
    remainingPurseLakhs: 12000, // starting ₹120 Cr
    rtmCardsLeft: 3,
    draftedPlayerIds: []
  }));

  // Parse and order players pool (same algorithm as frontend did previously)
  const rawPlayers = PLAYERS.map(p => ({
    ...p,
    status: 'available',
    soldPriceLakhs: 0,
    boughtBy: null,
    isRtm: false
  }));

  // 1. Marquee players (not uncapped, basePriceLakhs >= 150)
  const marquees = rawPlayers.filter(p => !p.isUncapped && p.basePriceLakhs >= 150);
  
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

  // Build ordered list
  const orderedPool = [];
  if (firstPlayer) {
    orderedPool.push(firstPlayer);
  }
  orderedPool.push(...remainingMarquees);
  orderedPool.push(...cappedBowlers);
  orderedPool.push(...uncappedPlayers);
  orderedPool.push(...restPlayers);

  // Truncate to maximum 350 players
  room.players = orderedPool.slice(0, 350);
}

// Bidding increment schedule
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

// Verify constraints
function canTeamBid(room, team, player, nextBid) {
  if (player.status !== 'available') return false;

  // 1. Squad capacity limit
  if (team.draftedPlayerIds.length >= 25) return false;

  // 2. Overseas limit
  if (player.isOverseas) {
    const squad = team.draftedPlayerIds.map(id => room.players.find(p => p.id === id));
    const overseasCount = squad.filter(p => p && p.isOverseas).length;
    if (overseasCount >= 8) return false;
  }

  // 3. Purse check
  if (team.remainingPurseLakhs < nextBid) return false;

  return true;
}

// AI Bidding Engine Strategy & Calculations
function calculateValuation(room, team, player) {
  if (team.draftedPlayerIds.length >= 25) return 0;
  
  const squad = team.draftedPlayerIds.map(id => room.players.find(p => p.id === id));
  const overseasCount = squad.filter(p => p && p.isOverseas).length;
  if (player.isOverseas && overseasCount >= 8) return 0;
  if (team.remainingPurseLakhs < player.basePriceLakhs) return 0;

  // Roster Roles counts
  const roleCounts = {
    'WK-Batter': squad.filter(p => p && p.role === 'WK-Batter').length,
    'Batter': squad.filter(p => p && p.role === 'Batter').length,
    'All-Rounder': squad.filter(p => p && p.role === 'All-Rounder').length,
    'Bowler': squad.filter(p => p && (p.role === 'Fast Bowler' || p.role === 'Spin Bowler')).length
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

// Broadcast updated lobby/player sync details
function sendLobbyUpdate(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const clientPlayers = Object.entries(room.clients).map(([socketId, client]) => ({
    peerId: socketId,
    name: client.name,
    teamId: client.teamId,
    isHost: client.isHost
  }));

  io.to(roomId).emit('lobby-update', { clientPlayers });
}

// Broadcast game state to all room sockets
function syncRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const clientPlayers = Object.entries(room.clients).map(([socketId, client]) => ({
    peerId: socketId,
    name: client.name,
    teamId: client.teamId,
    isHost: client.isHost
  }));

  const statePayload = {
    phase: room.phase,
    isPrivateRoom: room.isPrivate,
    hostRoomPin: room.pin,
    isRtmPhase: room.isRtmPhase,
    activePoolIndex: room.activePoolIndex,
    currentBidLakhs: room.currentBidLakhs,
    currentHighestBidderId: room.currentHighestBidderId,
    timerSeconds: room.timerSeconds,
    timeLimitSeconds: room.timeLimitSeconds,
    isPaused: room.isPaused,
    speed: room.speed,
    simulationMode: 'franchise',
    selectedRetentions: room.selectedRetentions,
    selectedXIByTeam: room.selectedXIByTeam,
    clientPlayers: clientPlayers,
    players: room.players.map(p => ({
      id: p.id,
      status: p.status,
      soldPriceLakhs: p.soldPriceLakhs,
      boughtBy: p.boughtBy,
      isRtm: p.isRtm
    })),
    franchises: room.franchises.map(f => ({
      id: f.id,
      remainingPurseLakhs: f.remainingPurseLakhs,
      rtmCardsLeft: f.rtmCardsLeft,
      draftedPlayerIds: f.draftedPlayerIds
    }))
  };

  io.to(roomId).emit('client-receive-message', { data: { type: 'STATE_SYNC', state: statePayload } });
}

// Main server timer countdown execution loop
function startServerTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  clearInterval(room.timerIntervalId);
  if (room.phase !== 'auction' || room.isPaused || room.isRtmPhase) return;

  if (room.speed === 'instant') {
    resolveActivePlayerInstant(roomId);
    return;
  }

  const intervalTime = room.speed === 'fast' ? 200 : 1000;

  room.timerIntervalId = setInterval(() => {
    const r = rooms[roomId];
    if (!r) {
      clearInterval(room.timerIntervalId);
      return;
    }

    if (!r.isPaused && !r.isRtmPhase) {
      r.timerSeconds--;
      syncRoomState(roomId);

      if (r.timerSeconds > 0) {
        triggerAIBids(roomId);
      } else {
        clearInterval(r.timerIntervalId);
        resolveActivePlayer(roomId);
      }
    }
  }, intervalTime);
}

// Execute a single validated bid
function executeBid(roomId, teamId, bidAmount) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players[room.activePoolIndex];
  if (!player || player.status !== 'available') return;

  room.currentBidLakhs = bidAmount;
  room.currentHighestBidderId = teamId;
  room.timerSeconds = room.timeLimitSeconds;

  // Broadcast the bid updates
  io.to(roomId).emit('client-receive-message', {
    data: {
      type: 'STATE_SYNC_PARTIAL',
      currentBidLakhs: room.currentBidLakhs,
      currentHighestBidderId: room.currentHighestBidderId,
      timerSeconds: room.timerSeconds
    }
  });

  syncRoomState(roomId);
  startServerTimer(roomId);
}

// Evaluate AI bids during the tick countdown
function triggerAIBids(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players[room.activePoolIndex];
  if (!player || player.status !== 'available') return;

  const nextBid = getNextBidAmount(room.currentBidLakhs, player.basePriceLakhs);

  // Stagger bids: 35% chance per tick to keep simulation pacing natural
  if (Math.random() > 0.35) return;

  const humanTeamIds = Object.values(room.clients).map(c => c.teamId);

  const eligibleAIs = room.franchises.filter(f => {
    if (humanTeamIds.includes(f.id)) return false;
    if (f.id === room.currentHighestBidderId) return false;
    return canTeamBid(room, f, player, nextBid);
  });

  const biddingAIs = eligibleAIs.filter(team => {
    const valuation = calculateValuation(room, team, player);
    return valuation >= nextBid;
  });

  if (biddingAIs.length > 0) {
    const randomTeam = biddingAIs[Math.floor(Math.random() * biddingAIs.length)];
    executeBid(roomId, randomTeam.id, nextBid);
  }
}

// Resolve timer expiration or manual Sold declaration
function resolveActivePlayer(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players[room.activePoolIndex];
  if (!player) return;

  if (room.currentHighestBidderId === null) {
    declareUnsold(roomId);
    return;
  }

  const formerTeam = room.franchises.find(f => f.id === player.formerTeamId);
  const highestBidder = room.franchises.find(f => f.id === room.currentHighestBidderId);
  const isPakistani = player.country === 'Pakistan';

  // Check RTM eligibility
  const rtmEligible = !isPakistani &&
                      formerTeam.id !== highestBidder.id && 
                      formerTeam.rtmCardsLeft > 0 && 
                      room.currentBidLakhs >= 100 && room.currentBidLakhs <= 1000 &&
                      canTeamBid(room, formerTeam, player, room.currentBidLakhs);

  if (rtmEligible) {
    room.isRtmPhase = true;
    room.isPaused = true;
    clearInterval(room.timerIntervalId);

    // Check if the former team is controlled by a connected guest client
    const clientForFormerTeam = Object.entries(room.clients).find(
      ([sid, client]) => client.teamId === formerTeam.id
    );

    if (clientForFormerTeam) {
      const formerTeamSocketId = clientForFormerTeam[0];
      io.to(formerTeamSocketId).emit('client-receive-message', {
        data: {
          type: 'RTM_REQUEST',
          player: { name: player.name, country: player.country, role: player.role, formerTeamId: player.formerTeamId },
          currentBid: room.currentBidLakhs
        }
      });
      syncRoomState(roomId);
    } else {
      resolveRTMForAI(roomId, formerTeam, player);
    }
  } else {
    declareSold(roomId, room.currentHighestBidderId, room.currentBidLakhs, false);
  }
}

// Run AI strategy calculations for RTM matches
function resolveRTMForAI(roomId, formerTeam, player) {
  const room = rooms[roomId];
  if (!room) return;

  const valuation = calculateValuation(room, formerTeam, player);
  const matchBid = valuation >= room.currentBidLakhs;

  const delay = room.speed === 'fast' ? 500 : (room.speed === 'instant' ? 0 : 2000);

  if (delay > 0) {
    room.isRtmPhase = true;
    room.isPaused = true;
    clearInterval(room.timerIntervalId);
    
    io.to(roomId).emit('rtm-ai-thinking', {
      formerTeamId: formerTeam.id,
      playerName: player.name,
      currentBid: room.currentBidLakhs
    });

    setTimeout(() => {
      const currentRoom = rooms[roomId];
      if (!currentRoom) return;
      currentRoom.isRtmPhase = false;
      currentRoom.isPaused = false;
      if (matchBid) {
        declareSold(roomId, formerTeam.id, currentRoom.currentBidLakhs, true);
      } else {
        declareSold(roomId, currentRoom.currentHighestBidderId, currentRoom.currentBidLakhs, false);
      }
    }, delay);
  } else {
    room.isRtmPhase = false;
    room.isPaused = false;
    if (matchBid) {
      declareSold(roomId, formerTeam.id, room.currentBidLakhs, true);
    } else {
      declareSold(roomId, room.currentHighestBidderId, room.currentBidLakhs, false);
    }
  }
}

// Execute player transaction and broadcast animations/sounds
function declareSold(roomId, teamId, amountLakhs, usedRtm) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players[room.activePoolIndex];
  const team = room.franchises.find(f => f.id === teamId);

  player.status = usedRtm ? 'retained' : 'sold';
  player.soldPriceLakhs = amountLakhs;
  player.boughtBy = teamId;
  player.isRtm = usedRtm;

  team.remainingPurseLakhs -= amountLakhs;
  team.draftedPlayerIds.push(player.id);
  if (usedRtm) {
    team.rtmCardsLeft--;
  }

  // Trigger animations and sounds on all clients
  io.to(roomId).emit('client-receive-message', {
    data: {
      type: 'TRIGGER_EFFECT',
      effectType: 'sold',
      playerName: player.name,
      boughtBy: teamId,
      amountLakhs: amountLakhs,
      isRtm: usedRtm
    }
  });

  room.isRtmPhase = false;
  syncRoomState(roomId);
  advanceNextPlayerDelay(roomId);
}

// Declare current player unsold
function declareUnsold(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players[room.activePoolIndex];
  player.status = 'unsold';

  io.to(roomId).emit('client-receive-message', {
    data: {
      type: 'TRIGGER_EFFECT',
      effectType: 'unsold',
      playerName: player.name
    }
  });

  syncRoomState(roomId);
  advanceNextPlayerDelay(roomId);
}

// Handle transition spacing before loading the next player card
function advanceNextPlayerDelay(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  clearInterval(room.timerIntervalId);

  if (room.autoAdvance) {
    const activePlayer = room.players[room.activePoolIndex];
    const isSold = activePlayer && (activePlayer.status === 'sold' || activePlayer.status === 'retained');
    const delay = (isSold && room.speed !== 'instant') ? 4500 : 0;

    setTimeout(() => {
      const currentRoom = rooms[roomId];
      if (!currentRoom) return;

      currentRoom.activePoolIndex++;
      loadActivePlayer(roomId);
    }, delay);
  }
}

// Load next available player card
function loadActivePlayer(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  while (room.activePoolIndex < room.players.length && room.players[room.activePoolIndex].status !== 'available') {
    room.activePoolIndex++;
  }

  if (room.activePoolIndex >= room.players.length) {
    endAuction(roomId);
    return;
  }

  room.currentBidLakhs = 0;
  room.currentHighestBidderId = null;
  room.timerSeconds = room.timeLimitSeconds;
  room.isPaused = false;
  room.isRtmPhase = false;

  syncRoomState(roomId);
  startServerTimer(roomId);
}

// Complete auction
function endAuction(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.phase = 'finished';
  clearInterval(room.timerIntervalId);
  syncRoomState(roomId);
}

// Solve player bidding instantly (Instant Mode)
function resolveActivePlayerInstant(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players[room.activePoolIndex];
  if (!player || player.status !== 'available') return;

  let nextBid = getNextBidAmount(room.currentBidLakhs, player.basePriceLakhs);
  let biddingActive = true;
  const humanTeamIds = Object.values(room.clients).map(c => c.teamId);

  while (biddingActive) {
    const eligibleAIs = room.franchises.filter(f => {
      if (humanTeamIds.includes(f.id)) return false;
      if (f.id === room.currentHighestBidderId) return false;
      return canTeamBid(room, f, player, nextBid);
    });

    const interested = eligibleAIs.filter(team => calculateValuation(room, team, player) >= nextBid);

    if (interested.length > 0) {
      const chosen = interested[Math.floor(Math.random() * interested.length)];
      room.currentBidLakhs = nextBid;
      room.currentHighestBidderId = chosen.id;
      nextBid = getNextBidAmount(room.currentBidLakhs, player.basePriceLakhs);
    } else {
      biddingActive = false;
    }
  }

  resolveActivePlayer(roomId);
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Host creates (or resumes) a room
  socket.on('host-create-room', ({ roomId, pin, isPrivate, playerName, teamId }) => {
    console.log(`Host creating/resuming room: ${roomId} (Private: ${isPrivate})`);
    
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        pin: pin || "",
        isPrivate: !!isPrivate,
        hostSocketId: socket.id,
        clients: {}
      };
      initializeRoomState(rooms[roomId]);
    } else {
      rooms[roomId].hostSocketId = socket.id;
    }

    rooms[roomId].clients[socket.id] = {
      name: playerName + " (Host)",
      teamId: teamId,
      isHost: true
    };

    socket.emit('host-create-ack', { success: true });
    sendLobbyUpdate(roomId);
    syncRoomState(roomId);
  });

  // 2. Guest joins an existing room
  socket.on('guest-join-room', ({ roomId, pin, playerName, teamId }) => {
    console.log(`Guest ${playerName} attempting to join room: ${roomId}`);
    
    const room = rooms[roomId];
    if (!room) {
      socket.emit('join-ack', { success: false, error: 'Room does not exist!' });
      return;
    }

    // Verify PIN for private rooms
    if (room.isPrivate && room.pin !== pin) {
      socket.emit('join-ack', { success: false, error: 'Incorrect Room PIN! Please enter the correct PIN.' });
      return;
    }

    // Check if team is already controlled by another player
    let assignedTeamId = teamId;
    const existingClientSocketId = Object.keys(room.clients).find(sid => room.clients[sid].teamId === teamId);
    if (existingClientSocketId) {
      const existingClient = room.clients[existingClientSocketId];
      if (existingClient.name === playerName) {
        console.log(`Reconnection detected for team ${teamId} (${playerName}). Replacing socket ${existingClientSocketId} with ${socket.id}`);
        const oldSocket = io.sockets.sockets.get(existingClientSocketId);
        if (oldSocket) {
          oldSocket.leave(roomId);
        }
        delete room.clients[existingClientSocketId];
      } else {
        const takenTeamIds = Object.values(room.clients).map(c => c.teamId);
        let firstAvailable = 0;
        while (firstAvailable < 10 && takenTeamIds.includes(firstAvailable)) {
          firstAvailable++;
        }
        if (firstAvailable < 10) {
          console.log(`Team ${teamId} is taken. Auto-assigning guest ${playerName} to free team ${firstAvailable}`);
          assignedTeamId = firstAvailable;
        } else {
          socket.emit('join-ack', { success: false, error: 'Room is full! All 10 franchises are controlled.' });
          return;
        }
      }
    }

    socket.join(roomId);

    room.clients[socket.id] = {
      name: playerName,
      teamId: assignedTeamId,
      isHost: false
    };

    socket.emit('join-ack', { success: true, teamId: assignedTeamId });
    sendLobbyUpdate(roomId);
    syncRoomState(roomId);
  });

  // Client requests team change
  socket.on('change-team', ({ roomId, teamId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const isTaken = Object.entries(room.clients).some(
      ([sid, client]) => sid !== socket.id && client.teamId === teamId
    );

    if (isTaken) {
      socket.emit('change-team-ack', { success: false, error: 'Franchise is already selected by another user!' });
      return;
    }

    if (room.clients[socket.id]) {
      room.clients[socket.id].teamId = teamId;
      socket.emit('change-team-ack', { success: true, teamId });
      sendLobbyUpdate(roomId);
      syncRoomState(roomId);
    }
  });

  // Client toggles single retention candidate
  socket.on('toggle-retention', ({ roomId, teamId, playerId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'setup') return;

    if (!room.selectedRetentions[teamId]) {
      room.selectedRetentions[teamId] = [];
    }

    const index = room.selectedRetentions[teamId].indexOf(playerId);
    if (index !== -1) {
      room.selectedRetentions[teamId].splice(index, 1);
    } else {
      if (room.selectedRetentions[teamId].length >= 3) return;
      room.selectedRetentions[teamId].push(playerId);
    }

    syncRoomState(roomId);
  });

  // Client requests AI teams to auto-retain candidates
  socket.on('auto-retain-ai-teams', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'setup') return;

    const humanTeamIds = Object.values(room.clients).map(c => c.teamId);

    room.franchises.forEach(f => {
      if (humanTeamIds.includes(f.id)) return;

      room.selectedRetentions[f.id] = [];
      const former = room.players.filter(p => p.formerTeamId === f.id && p.country !== 'Pakistan');
      const candidates = [...former].sort((a, b) => b.basePriceLakhs - a.basePriceLakhs);
      const numToRetain = Math.min(candidates.length, Math.floor(Math.random() * 3) + 1); // 1 to 3
      for (let i = 0; i < numToRetain; i++) {
        if (candidates[i]) {
          room.selectedRetentions[f.id].push(candidates[i].id);
        }
      }
    });

    syncRoomState(roomId);
  });

  // Clear all selections
  socket.on('clear-all-retentions', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'setup') return;

    room.franchises.forEach(f => {
      room.selectedRetentions[f.id] = [];
    });

    syncRoomState(roomId);
  });

  // FIX #4: Host signals start of retention phase to the server
  // This ensures reconnecting guests receive phase:'retention' from server, not stale 'setup'
  socket.on('start-retention', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'setup') return;
    // Security: only the host can advance the phase
    if (room.hostSocketId !== socket.id) return;
    room.phase = 'retention';
    console.log(`Room ${roomId} → retention phase started by host`);
    syncRoomState(roomId);
  });

  // Lock retentions and trigger live auction phase
  socket.on('lock-retentions', ({ roomId }) => {
    const room = rooms[roomId];
    // FIX #4: Accept 'retention' phase (not just 'setup') since we now track it properly
    if (!room || (room.phase !== 'setup' && room.phase !== 'retention')) return;

    room.franchises.forEach(f => {
      const retainedIds = room.selectedRetentions[f.id] || [];
      const retainedPlayersList = retainedIds.map(id => room.players.find(p => p.id === id));
      
      let costLakhs = 0;
      const costs = [1600, 1200, 800];
      retainedPlayersList.forEach((p, idx) => {
        costLakhs += costs[idx] || 0;
      });

      const rtmCount = Math.max(0, 3 - retainedPlayersList.length);
      f.remainingPurseLakhs = 12000 - costLakhs;
      f.rtmCardsLeft = rtmCount;

      retainedPlayersList.forEach((p, index) => {
        if (p) {
          p.status = 'retained';
          p.soldPriceLakhs = costs[index] || 0;
          p.boughtBy = f.id;
        }
      });
      f.draftedPlayerIds = [...retainedIds];
    });

    room.phase = 'auction';
    syncRoomState(roomId);
    loadActivePlayer(roomId);
  });

  // Handle manual/guest placement of bids
  socket.on('place-bid', ({ roomId, teamId, bidAmount }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'auction') return;

    const player = room.players[room.activePoolIndex];
    if (!player) return;

    const expectedNextBid = getNextBidAmount(room.currentBidLakhs, player.basePriceLakhs);
    if (bidAmount < expectedNextBid) return;

    const team = room.franchises.find(f => f.id === teamId);
    if (!team || !canTeamBid(room, team, player, bidAmount)) return;

    executeBid(roomId, teamId, bidAmount);
  });

  // Handle RTM response matching decisions
  socket.on('rtm-decision', ({ roomId, teamId, match }) => {
    const room = rooms[roomId];
    if (!room || !room.isRtmPhase) return;

    const player = room.players[room.activePoolIndex];
    if (!player || player.formerTeamId !== teamId) return;

    room.isRtmPhase = false;
    room.isPaused = false;

    if (match) {
      declareSold(roomId, teamId, room.currentBidLakhs, true);
    } else {
      declareSold(roomId, room.currentHighestBidderId, room.currentBidLakhs, false);
    }
  });

  // Timer speed change
  socket.on('speed-change', ({ roomId, speed }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.speed = speed;
    syncRoomState(roomId);
    if (room.phase === 'auction') {
      startServerTimer(roomId);
    }
  });

  // Timer pause toggle
  socket.on('pause-toggle', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.isPaused = !room.isPaused;
    syncRoomState(roomId);
    if (room.phase === 'auction') {
      if (room.isPaused) {
        clearInterval(room.timerIntervalId);
      } else {
        startServerTimer(roomId);
      }
    }
  });

  // Auto-advance toggle
  socket.on('auto-advance-toggle', ({ roomId, autoAdvance }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.autoAdvance = !!autoAdvance;
    syncRoomState(roomId);
  });

  // Declare unsold
  socket.on('unsold-player', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'auction') return;
    declareUnsold(roomId);
  });

  // Declare sold manually (when autoAdvance is unchecked)
  socket.on('sold-player', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'auction') return;
    if (room.currentHighestBidderId !== null) {
      resolveActivePlayer(roomId);
    }
  });

  // Reset entire simulator
  socket.on('reset-room', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    initializeRoomState(room);
    syncRoomState(roomId);
  });

  // Handle client-to-host and client-to-client relay fallback messages for backward compatibility
  socket.on('client-message', ({ roomId, data }) => {
    const room = rooms[roomId];
    if (room && room.hostSocketId) {
      io.to(room.hostSocketId).emit('host-receive-message', {
        fromSocketId: socket.id,
        data: data
      });
    }
  });

  socket.on('host-message-to-client', ({ roomId, targetSocketId, data }) => {
    io.to(targetSocketId).emit('client-receive-message', { data });
  });

  socket.on('host-broadcast', ({ roomId, data }) => {
    socket.to(roomId).emit('client-receive-message', { data });
  });

  // Handle socket disconnects
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      
      if (room.clients[socket.id]) {
        console.log(`User ${room.clients[socket.id].name} disconnected from room: ${roomId}`);
        delete room.clients[socket.id];
        
        sendLobbyUpdate(roomId);
        syncRoomState(roomId);

        // Terminate timer and wipe room metadata if all users disconnect
        if (Object.keys(room.clients).length === 0) {
          console.log(`Wiping empty room state: ${roomId}`);
          clearInterval(room.timerIntervalId);
          delete rooms[roomId];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const lan = getLanIp();
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║         IPL MEGA AUCTION — SERVER RUNNING            ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  Local:   http://localhost:${PORT}                      ║`);
  console.log(`║  LAN:     http://${lan}:${PORT}                 ║`);
  console.log(`║                                                      ║`);
  console.log(`║  Share the LAN link with friends on same WiFi.       ║`);
  console.log(`║  For internet play: run  npx localtunnel --port ${PORT}  ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
});

// Keep-Alive routine
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  const intervalMs = 10 * 60 * 1000; // 10 minutes
  setInterval(() => {
    try {
      const url = `${RENDER_URL.replace(/\/$/, '')}/ping`;
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        console.log(`[Keep-Alive] Ping success: ${res.statusCode}`);
      }).on('error', (err) => {
        console.warn(`[Keep-Alive] Ping error: ${err.message}`);
      });
    } catch (e) {
      console.warn(`[Keep-Alive] Ping routine error: ${e.message}`);
    }
  }, intervalMs);
}
