const { createServer } = require('http');
const { Server } = require('socket.io');

const port = parseInt(process.env.SIGNALING_PORT || '3001', 10);

class SignalingServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });

    this.rooms = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`New connection: ${socket.id}`);

      socket.on('join-room', ({ roomId, userId, username, initialStreamState }) => {
        this.handleJoinRoom(socket, roomId, userId, username, initialStreamState);
      });

      socket.on('leave-room', ({ roomId }) => {
        this.handleLeaveRoom(socket, roomId);
      });

      socket.on('signal', ({ to, signal, from }) => {
        this.handleSignal(socket, to, signal, from);
      });

      socket.on('toggle-stream', ({ roomId, streamType, enabled }) => {
        this.handleToggleStream(socket, roomId, streamType, enabled);
      });

      socket.on('start-recording', ({ roomId }) => {
        this.handleStartRecording(socket, roomId);
      });

      socket.on('stop-recording', ({ roomId }) => {
        this.handleStopRecording(socket, roomId);
      });

      socket.on('sync-my-stream-state', ({ targetParticipant, roomId, streamState }) => {
        this.handleSyncStreamState(socket, targetParticipant, roomId, streamState);
      });

      socket.on('stream-updated', ({ roomId }) => {
        this.handleStreamUpdated(socket, roomId);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  handleJoinRoom(socket, roomId, userId, username, initialStreamState) {
    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        hostId: userId,
        createdAt: new Date(),
        recordingActive: false
      });
    }

    const room = this.rooms.get(roomId);
    
    // Add participant to room with initial stream state
    const participant = {
      socketId: socket.id,
      userId,
      username,
      joinedAt: new Date(),
      stream: initialStreamState || { video: false, audio: false }
    };
    
    room.participants.set(socket.id, participant);
    socket.join(roomId);

    // Notify the joining user of existing participants
    const existingParticipants = Array.from(room.participants.values())
      .filter(p => p.socketId !== socket.id)
      .map(p => ({
        socketId: p.socketId,
        userId: p.userId,
        username: p.username,
        stream: p.stream
      }));

    socket.emit('room-joined', {
      participants: existingParticipants,
      isHost: room.hostId === userId,
      recordingActive: room.recordingActive
    });

    // Notify existing participants of new user
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      username,
      stream: participant.stream
    });

    // Request existing participants to send their current stream states to the new user
    socket.to(roomId).emit('sync-stream-states', {
      newParticipantId: socket.id
    });

    console.log(`User ${username} joined room ${roomId} with stream state:`, participant.stream);
    console.log(`Room ${roomId} now has ${room.participants.size} participants`);
    
    // Log all participants for debugging
    const allParticipants = Array.from(room.participants.values()).map(p => ({
      username: p.username,
      socketId: p.socketId,
      stream: p.stream
    }));
    console.log('All participants in room:', allParticipants);
  }

  handleLeaveRoom(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    // Remove participant
    room.participants.delete(socket.id);
    socket.leave(roomId);

    // Notify others
    socket.to(roomId).emit('user-left', {
      socketId: socket.id,
      userId: participant.userId
    });

    // Clean up empty rooms
    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    } else if (room.hostId === participant.userId) {
      // Transfer host to next participant
      const nextHost = room.participants.values().next().value;
      if (nextHost) {
        room.hostId = nextHost.userId;
        this.io.to(roomId).emit('host-changed', { newHostId: nextHost.userId });
      }
    }

    console.log(`User ${participant.username} left room ${roomId}`);
  }

  handleSignal(socket, to, signal, from) {
    // Forward WebRTC signaling data between peers
    this.io.to(to).emit('signal', { signal, from });
  }

  handleToggleStream(socket, roomId, streamType, enabled) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant || !participant.stream) return;

    participant.stream[streamType] = enabled;

    // Notify all participants
    socket.to(roomId).emit('stream-toggled', {
      socketId: socket.id,
      streamType,
      enabled
    });
  }

  handleStartRecording(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant || participant.userId !== room.hostId) {
      socket.emit('error', { message: 'Only the host can start recording' });
      return;
    }

    room.recordingActive = true;
    this.io.to(roomId).emit('recording-started');
    console.log(`Recording started in room ${roomId}`);
  }

  handleStopRecording(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant || participant.userId !== room.hostId) {
      socket.emit('error', { message: 'Only the host can stop recording' });
      return;
    }

    room.recordingActive = false;
    this.io.to(roomId).emit('recording-stopped');
    console.log(`Recording stopped in room ${roomId}`);
  }

  handleSyncStreamState(socket, targetParticipant, roomId, streamState) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    // Update participant's stream state
    participant.stream = streamState;

    // Send stream state to the target participant
    this.io.to(targetParticipant).emit('participant-stream-synced', {
      socketId: socket.id,
      userId: participant.userId,
      username: participant.username,
      streamState: streamState
    });
  }

  handleStreamUpdated(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    console.log(`📺 Stream updated by ${participant.username}, notifying other participants`);

    // Notify all other participants that this user's stream has been updated
    socket.to(roomId).emit('participant-stream-refreshed', {
      socketId: socket.id,
      userId: participant.userId,
      username: participant.username
    });
  }

  handleDisconnect(socket) {
    // Find and leave all rooms
    this.rooms.forEach((room, roomId) => {
      if (room.participants.has(socket.id)) {
        this.handleLeaveRoom(socket, roomId);
      }
    });
    console.log(`Connection closed: ${socket.id}`);
  }

  getRoomStats() {
    return {
      roomCount: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values())
        .reduce((sum, room) => sum + room.participants.size, 0),
      rooms: Array.from(this.rooms.entries()).map(([id, room]) => ({
        id,
        participantCount: room.participants.size,
        createdAt: room.createdAt,
        recordingActive: room.recordingActive
      }))
    };
  }
}

// Start the signaling server
const server = createServer();
const signalingServer = new SignalingServer(server);

server.listen(port, () => {
  console.log(`> Signaling server ready on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
}); 