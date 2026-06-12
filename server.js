const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

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
  const lan = getLanIp();
  res.json({
    localUrl:  `http://localhost:${PORT}`,
    lanUrl:    `http://${lan}:${PORT}`,
    port:      PORT
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) {
    return res.status(404).json({
      exists: false,
      message: 'Room not found'
    });
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    exists: true,
    roomId: room.id,
    isPrivate: room.isPrivate,
    requiresPin: room.isPrivate,
    clientCount: Object.keys(room.clients).length,
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
// Structure:
// rooms[roomId] = {
//   id: roomId,
//   pin: pinCode,
//   isPrivate: boolean,
//   hostSocketId: string,
//   clients: {
//     [socketId]: { name, teamId, isHost }
//   }
// }
const rooms = {};

// Helper to broadcast lobby player updates
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

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Host creates (or resumes) a room
  socket.on('host-create-room', ({ roomId, pin, isPrivate, playerName, teamId }) => {
    console.log(`Host creating/resuming room: ${roomId} (Private: ${isPrivate})`);
    
    // Joint the room socket channel
    socket.join(roomId);

    // If room already exists, we resume/overwrite host connection details (reconnection scenario)
    if (rooms[roomId]) {
      rooms[roomId].hostSocketId = socket.id;
      // Re-register or update host client record
      rooms[roomId].clients[socket.id] = {
        name: playerName + " (Host)",
        teamId: teamId,
        isHost: true
      };
      
      // Clean up any stale records from old host socket
      Object.keys(rooms[roomId].clients).forEach(sid => {
        if (sid !== socket.id && rooms[roomId].clients[sid].isHost) {
          delete rooms[roomId].clients[sid];
        }
      });
    } else {
      // Create new room registry entry
      rooms[roomId] = {
        id: roomId,
        pin: pin || "",
        isPrivate: !!isPrivate,
        hostSocketId: socket.id,
        clients: {
          [socket.id]: {
            name: playerName + " (Host)",
            teamId: teamId,
            isHost: true
          }
        }
      };
    }

    socket.emit('host-create-ack', { success: true });
    sendLobbyUpdate(roomId);
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
    const existingClientSocketId = Object.keys(room.clients).find(sid => room.clients[sid].teamId === teamId);
    if (existingClientSocketId) {
      const existingClient = room.clients[existingClientSocketId];
      // If same name, it's a reconnection. Replace old socket.
      if (existingClient.name === playerName) {
        console.log(`Reconnection detected for team ${teamId} (${playerName}). Replacing socket ${existingClientSocketId} with ${socket.id}`);
        const oldSocket = io.sockets.sockets.get(existingClientSocketId);
        if (oldSocket) {
          oldSocket.leave(roomId);
        }
        delete room.clients[existingClientSocketId];
      } else {
        socket.emit('join-ack', { success: false, error: 'Franchise is already controlled by another player!' });
        return;
      }
    }

    // Add guest client to room channel
    socket.join(roomId);

    // Record guest client
    room.clients[socket.id] = {
      name: playerName,
      teamId: teamId,
      isHost: false
    };

    socket.emit('join-ack', { success: true });
    sendLobbyUpdate(roomId);
    
    // Notify host that a new guest joined so it can push current game state
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('guest-joined', { guestSocketId: socket.id });
    }
    
    console.log(`Guest ${playerName} successfully joined room: ${roomId}`);
  });

  // 3. Client sends a action message directly to host
  socket.on('client-message', ({ roomId, data }) => {
    const room = rooms[roomId];
    if (room && room.hostSocketId) {
      io.to(room.hostSocketId).emit('host-receive-message', {
        fromSocketId: socket.id,
        data: data
      });
    }
  });

  // 4. Host replies directly to a specific guest client
  socket.on('host-message-to-client', ({ roomId, targetSocketId, data }) => {
    io.to(targetSocketId).emit('client-receive-message', { data });
  });

  // 5. Host broadcasts a sync/effect action to the entire room
  socket.on('host-broadcast', ({ roomId, data }) => {
    // We send to all sockets in roomId room except the sender (the host)
    socket.to(roomId).emit('client-receive-message', { data });
  });

  // Handle socket disconnects
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);

    // Scan rooms for this socket
    for (const roomId in rooms) {
      const room = rooms[roomId];
      
      // If host disconnected
      if (room.hostSocketId === socket.id) {
        console.log(`Host disconnected from room: ${roomId}`);
        // Notify guest clients in the room
        socket.to(roomId).emit('host-disconnected-warning');
        
        // Remove host from client registry
        delete room.clients[socket.id];
        sendLobbyUpdate(roomId);
        
        // If there are zero active clients left in the lobby, delete the room
        if (Object.keys(room.clients).length === 0) {
          console.log(`Cleaning up empty room: ${roomId}`);
          delete rooms[roomId];
        }
      } 
      // If guest disconnected
      else if (room.clients[socket.id]) {
        console.log(`Guest ${room.clients[socket.id].name} disconnected from room: ${roomId}`);
        
        // Remove player from host registry via direct socket trigger
        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit('guest-disconnected', socket.id);
        }

        delete room.clients[socket.id];
        sendLobbyUpdate(roomId);

        // Clean up room if completely empty
        if (Object.keys(room.clients).length === 0) {
          console.log(`Cleaning up empty room: ${roomId}`);
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
