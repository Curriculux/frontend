import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.SIGNALING_PORT || '3001', 10);

interface Room {
  id: string;
  participants: Map<string, Participant>;
  hostId: string;
  createdAt: Date;
  recordingActive: boolean;
}

interface Participant {
  socketId: string;
  userId: string;
  username: string;
  joinedAt: Date;
  stream?: {
    video: boolean;
    audio: boolean;
  };
}

class SignalingServer {
  private io: Server;
  private rooms: Map<string, Room> = new Map();

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`New connection: ${socket.id}`);

      socket.on('join-room', ({ roomId, userId, username }) => {
        this.handleJoinRoom(socket, roomId, userId, username);
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

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleJoinRoom(socket: Socket, roomId: string, userId: string, username: string) {
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

    const room = this.rooms.get(roomId)!;
    
    // Add participant to room
    const participant: Participant = {
      socketId: socket.id,
      userId,
      username,
      joinedAt: new Date(),
      stream: { video: false, audio: false }
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

    console.log(`User ${username} joined room ${roomId}`);
  }

  private handleLeaveRoom(socket: Socket, roomId: string) {
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

  private handleSignal(socket: Socket, to: string, signal: any, from: string) {
    // Forward WebRTC signaling data between peers
    this.io.to(to).emit('signal', { signal, from });
  }

  private handleToggleStream(socket: Socket, roomId: string, streamType: 'video' | 'audio', enabled: boolean) {
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

  private handleStartRecording(socket: Socket, roomId: string) {
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

  private handleStopRecording(socket: Socket, roomId: string) {
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

  private handleDisconnect(socket: Socket) {
    // Find and leave all rooms
    this.rooms.forEach((room, roomId) => {
      if (room.participants.has(socket.id)) {
        this.handleLeaveRoom(socket, roomId);
      }
    });
    console.log(`Connection closed: ${socket.id}`);
  }

  public getRoomStats() {
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

// Export function to start the signaling server
export function startSignalingServer() {
  const server = createServer();
  const signalingServer = new SignalingServer(server);

  server.listen(port, () => {
    console.log(`> Signaling server ready on http://${hostname}:${port}`);
  });

  return signalingServer;
}

// If this file is run directly, start the server
if (require.main === module) {
  startSignalingServer();
} 