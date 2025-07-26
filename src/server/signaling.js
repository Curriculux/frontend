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
    console.log('🔧 Setting up socket handlers...');
    this.io.on('connection', (socket) => {
      console.log(`New connection: ${socket.id}`);
      console.log('🎯 Starting handler registration for', socket.id);

      try {
        // Test event handler - needs to be first
        socket.on('test-event', (data) => {
          console.log('🧪 Server: Received test event from', socket.id, ':', data);
        });
        console.log('📝 Registered test-event handler for', socket.id);

        socket.on('join-room', ({ roomId, userId, username, initialStreamState }) => {
          this.handleJoinRoom(socket, roomId, userId, username, initialStreamState);
        });
        console.log('📝 Registered join-room handler for', socket.id);

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

        // Whiteboard events for real-time collaboration
        socket.on('whiteboard-start', ({ roomId }) => {
          this.handleWhiteboardStart(socket, roomId);
        });

        socket.on('whiteboard-stop', ({ roomId }) => {
          this.handleWhiteboardStop(socket, roomId);
        });

        socket.on('whiteboard-draw', ({ roomId, drawingData }) => {
          this.handleWhiteboardDraw(socket, roomId, drawingData);
        });

        socket.on('whiteboard-clear', ({ roomId }) => {
          this.handleWhiteboardClear(socket, roomId);
        });

        socket.on('whiteboard-undo', ({ roomId }) => {
          this.handleWhiteboardUndo(socket, roomId);
        });

        socket.on('whiteboard-redo', ({ roomId }) => {
          this.handleWhiteboardRedo(socket, roomId);
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
      } catch (error) {
        console.error('❌ Error registering handlers for', socket.id, ':', error);
      }
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

  // Whiteboard collaboration handlers
  handleWhiteboardStart(socket, roomId) {
    console.log(`📋 Server: Received whiteboard-start from ${socket.id} in room ${roomId}`);
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(`❌ Server: Room ${roomId} not found`);
      return;
    }

    const participant = room.participants.get(socket.id);
    if (!participant) {
      console.log(`❌ Server: Participant ${socket.id} not found in room ${roomId}`);
      return;
    }

    console.log(`✅ Server: ${participant.username} started whiteboard in room ${roomId}`);
    
    // Set whiteboard state
    room.whiteboardActive = true;
    room.whiteboardHost = socket.id;
    room.whiteboardHostName = participant.username;
    
    // Notify all participants that whiteboard has started
    console.log(`📤 Server: Broadcasting whiteboard-started to room ${roomId}, hostName: ${participant.username}`);
    console.log(`👥 Server: Room ${roomId} has ${room.participants.size} participants:`, 
      Array.from(room.participants.values()).map(p => `${p.username} (${p.socketId})`));
    
    this.io.to(roomId).emit('whiteboard-started', {
      hostId: socket.id,
      hostName: participant.username
    });
  }

  handleWhiteboardStop(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    console.log(`${participant.username} stopped whiteboard in room ${roomId}`);
    
    // Clear whiteboard state
    room.whiteboardActive = false;
    room.whiteboardHost = null;
    room.whiteboardHostName = null;
    
    // Notify all participants that whiteboard has stopped
    this.io.to(roomId).emit('whiteboard-stopped', {
      stoppedBy: participant.username
    });
  }

  handleWhiteboardDraw(socket, roomId, drawingData) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Only allow the whiteboard host to draw, or if no host is set
    if (room.whiteboardHost && room.whiteboardHost !== socket.id) {
      return;
    }

    // Broadcast drawing data to all other participants
    socket.to(roomId).emit('whiteboard-draw-update', {
      drawingData,
      timestamp: Date.now()
    });
  }

  handleWhiteboardClear(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (!participant) return;

    // Only allow the whiteboard host to clear
    if (room.whiteboardHost && room.whiteboardHost !== socket.id) {
      return;
    }

    console.log(`${participant.username} cleared whiteboard in room ${roomId}`);
    
    // Broadcast clear event to all participants
    this.io.to(roomId).emit('whiteboard-cleared', {
      clearedBy: participant.username,
      timestamp: Date.now()
    });
  }

  handleWhiteboardUndo(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Only allow the whiteboard host to undo
    if (room.whiteboardHost && room.whiteboardHost !== socket.id) {
      return;
    }

    // Broadcast undo event to all participants
    socket.to(roomId).emit('whiteboard-undo-update', {
      timestamp: Date.now()
    });
  }

  handleWhiteboardRedo(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Only allow the whiteboard host to redo
    if (room.whiteboardHost && room.whiteboardHost !== socket.id) {
      return;
    }

    // Broadcast redo event to all participants
    socket.to(roomId).emit('whiteboard-redo-update', {
      timestamp: Date.now()
    });
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