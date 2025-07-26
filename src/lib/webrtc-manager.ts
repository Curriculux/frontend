import { io, Socket } from 'socket.io-client';
import SimplePeer, { SignalData } from 'simple-peer';
import RecordRTC from 'recordrtc';

export interface Participant {
  socketId: string;
  userId: string;
  username: string;
  stream?: MediaStream;
  peer?: SimplePeer;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

export interface WebRTCConfig {
  signalingServerUrl: string;
  roomId: string;
  userId: string;
  username: string;
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (socketId: string) => void;
  onStreamUpdated?: (socketId: string, stream: MediaStream) => void;
  onError?: (error: Error) => void;
  onRecordingStatusChanged?: (isRecording: boolean) => void;
  onWhiteboardStateChanged?: (active: boolean, hostName?: string) => void;
  onWhiteboardDrawUpdate?: (drawingData: any) => void;
  onWhiteboardCleared?: () => void;
  onWhiteboardUndo?: () => void;
  onWhiteboardRedo?: () => void;
}

export class WebRTCManager {
  private socket: Socket | null = null;
  private localStream: MediaStream | null = null;
  private participants: Map<string, Participant> = new Map();
  private config: WebRTCConfig;
  private isHost: boolean = false;
  private recorder: RecordRTC | null = null;
  private recordedChunks: Blob[] = [];
  private mixedStream: MediaStream | null = null;

  constructor(config: WebRTCConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      console.log('🎥 Getting user media...');
      // Get user media first
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('✅ User media obtained');

      console.log('🔗 Connecting to signaling server:', this.config.signalingServerUrl);
      // Connect to signaling server
      this.socket = io(this.config.signalingServerUrl, {
        transports: ['websocket'],
        autoConnect: false
      });

      // Debug: Log all received events
      const originalOn = this.socket.on.bind(this.socket);
      this.socket.on = function(event: string, listener: any) {
        return originalOn(event, (...args: any[]) => {
          if (event.includes('whiteboard')) {
            console.log(`📨 Received socket event: ${event}`, args);
          }
          return listener(...args);
        });
      };

      // Wait for socket connection
      console.log('🔗 Connecting to signaling server:', this.config.signalingServerUrl);
      this.socket.connect();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'));
        }, 10000); // 10 second timeout

        this.socket!.on('connect', () => {
          console.log('✅ Socket connected:', this.socket!.id);
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error);
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.setupSocketHandlers();

      console.log('🏠 Joining room:', this.config.roomId);
      // Join room with initial stream state
      this.socket.emit('join-room', {
        roomId: this.config.roomId,
        userId: this.config.userId,
        username: this.config.username,
        initialStreamState: {
          video: this.localStream.getVideoTracks().length > 0 && this.localStream.getVideoTracks()[0].enabled,
          audio: this.localStream.getAudioTracks().length > 0 && this.localStream.getAudioTracks()[0].enabled
        }
      });
      
      console.log('✅ WebRTC Manager connection complete');
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('room-joined', ({ participants, isHost, recordingActive }) => {
      this.isHost = isHost;
      
      console.log(`Joined room. ${participants.length} existing participants:`, participants.map((p: any) => p.username));
      
      // First, notify the UI about existing participants so they appear in the participant list
      participants.forEach((participant: any) => {
        console.log('Adding existing participant to UI:', participant.username);
        this.config.onParticipantJoined?.(participant);
      });

      // Create peer connections for existing participants (new joiner doesn't initiate)
      participants.forEach((participant: any) => {
        console.log('Creating peer connection to existing participant:', participant.username);
        // Add a small delay to ensure proper initialization
        setTimeout(() => {
          this.createPeerConnection(participant, false); // New joiner waits for offers
        }, 50);
      });

      // Send initial stream state to all participants
      if (this.localStream) {
        const videoEnabled = this.localStream.getVideoTracks().length > 0 && this.localStream.getVideoTracks()[0].enabled;
        const audioEnabled = this.localStream.getAudioTracks().length > 0 && this.localStream.getAudioTracks()[0].enabled;
        
        this.socket!.emit('toggle-stream', {
          roomId: this.config.roomId,
          streamType: 'video',
          enabled: videoEnabled
        });
        
        this.socket!.emit('toggle-stream', {
          roomId: this.config.roomId,
          streamType: 'audio',
          enabled: audioEnabled
        });
      }

      if (recordingActive) {
        this.config.onRecordingStatusChanged?.(true);
      }
    });

    this.socket.on('user-joined', (participant: any) => {
      console.log('New user joined, creating peer connection as initiator:', participant.username);
      // Give a small delay to ensure the new user is ready
      setTimeout(() => {
        this.createPeerConnection(participant, true); // Existing users should initiate to new users
      }, 100);
      this.config.onParticipantJoined?.(participant);
    });

    this.socket.on('user-left', ({ socketId }) => {
      this.removeParticipant(socketId);
      this.config.onParticipantLeft?.(socketId);
    });

    this.socket.on('signal', ({ signal, from }) => {
      const participant = this.participants.get(from);
      if (participant?.peer) {
        console.log(`Received signal from ${participant.username}:`, signal.type);
        try {
          participant.peer.signal(signal);
        } catch (error) {
          console.error(`Error processing signal from ${participant.username}:`, error);
        }
      } else {
        console.warn('Received signal from unknown participant:', from);
      }
    });

    this.socket.on('stream-toggled', ({ socketId, streamType, enabled }) => {
      const participant = this.participants.get(socketId);
      if (participant) {
        console.log(`🎛️ ${participant.username} toggled ${streamType} to ${enabled}`);
        if (streamType === 'video') {
          participant.videoEnabled = enabled;
        } else {
          participant.audioEnabled = enabled;
        }
        
        // Notify the UI that participant state has changed
        // Note: onParticipantUpdated callback removed, using onStreamUpdated instead
        if (participant.stream) {
          this.config.onStreamUpdated?.(socketId, participant.stream);
        }
      }
    });

    this.socket.on('participant-stream-refreshed', ({ socketId, username }) => {
      console.log(`📺 ${username} updated their stream, refreshing UI`);
      const participant = this.participants.get(socketId);
      if (participant && participant.stream) {
        // Trigger a UI refresh for this participant's stream
        this.config.onStreamUpdated?.(socketId, participant.stream);
      }
    });

    this.socket.on('recording-started', () => {
      this.config.onRecordingStatusChanged?.(true);
    });

    this.socket.on('recording-stopped', () => {
      this.config.onRecordingStatusChanged?.(false);
    });

    this.socket.on('host-changed', ({ newHostId }) => {
      this.isHost = newHostId === this.config.userId;
    });

    // Whiteboard event handlers
    this.socket.on('whiteboard-started', ({ hostName }) => {
      console.log('📋 Received whiteboard-started event:', { hostName });
      this.config.onWhiteboardStateChanged?.(true, hostName);
    });

    this.socket.on('whiteboard-stopped', ({ stoppedBy }) => {
      console.log('📋 Received whiteboard-stopped event:', { stoppedBy });
      this.config.onWhiteboardStateChanged?.(false);
    });

    this.socket.on('whiteboard-draw-update', ({ drawingData }) => {
      console.log('✏️ Received whiteboard-draw-update event:', drawingData.type);
      this.config.onWhiteboardDrawUpdate?.(drawingData);
    });

    this.socket.on('whiteboard-cleared', () => {
      console.log('🧹 Received whiteboard-cleared event');
      this.config.onWhiteboardCleared?.();
    });

    this.socket.on('whiteboard-undo-update', () => {
      console.log('↩️ Received whiteboard-undo-update event');
      this.config.onWhiteboardUndo?.();
    });

    this.socket.on('whiteboard-redo-update', () => {
      console.log('🔄 Received whiteboard-redo-update event');
      this.config.onWhiteboardRedo?.();
    });

    this.socket.on('sync-stream-states', ({ newParticipantId }) => {
      // Send current stream state to the new participant
      if (this.localStream) {
        const videoEnabled = this.localStream.getVideoTracks().length > 0 && this.localStream.getVideoTracks()[0].enabled;
        const audioEnabled = this.localStream.getAudioTracks().length > 0 && this.localStream.getAudioTracks()[0].enabled;
        
        // Send to the specific new participant
        this.socket!.emit('sync-my-stream-state', {
          targetParticipant: newParticipantId,
          roomId: this.config.roomId,
          streamState: {
            video: videoEnabled,
            audio: audioEnabled
          }
        });
      }
    });

    this.socket.on('participant-stream-synced', ({ socketId, userId, username, streamState }) => {
      const participant = this.participants.get(socketId);
      if (participant) {
        participant.videoEnabled = streamState.video;
        participant.audioEnabled = streamState.audio;
        console.log(`Synced stream state for ${username}:`, streamState);
      }
    });

    this.socket.on('error', ({ message }) => {
      this.config.onError?.(new Error(message));
    });
  }

  private createPeerConnection(participantData: any, initiator: boolean): void {
    if (!this.localStream || !this.socket) {
      console.warn('Cannot create peer connection: missing stream or socket');
      return;
    }

    // Don't create duplicate connections
    if (this.participants.has(participantData.socketId)) {
      console.log('Peer connection already exists for', participantData.username);
      return;
    }

    console.log(`Creating peer connection with ${participantData.username}, initiator: ${initiator}`);

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ]
      }
    });

    const participant: Participant = {
      socketId: participantData.socketId,
      userId: participantData.userId,
      username: participantData.username,
      peer,
      videoEnabled: participantData.stream?.video || false,
      audioEnabled: participantData.stream?.audio || false
    };

    this.participants.set(participantData.socketId, participant);

    peer.on('signal', (signal) => {
      console.log(`Sending signal to ${participantData.username}:`, signal.type);
      this.socket!.emit('signal', {
        to: participantData.socketId,
        signal,
        from: this.socket!.id
      });
    });

    peer.on('stream', (stream) => {
      console.log(`Received stream from ${participantData.username}`);
      participant.stream = stream;
      this.config.onStreamUpdated?.(participantData.socketId, stream);
      this.updateMixedStream();
    });

    peer.on('connect', () => {
      console.log(`✅ Successfully connected to ${participantData.username}`);
      // Force a stream update to ensure UI reflects the connection
      if (participant.stream) {
        this.config.onStreamUpdated?.(participantData.socketId, participant.stream);
      }
    });

    peer.on('error', (error) => {
      console.error(`Peer connection error with ${participantData.username}:`, error);
      this.config.onError?.(error);
    });

    peer.on('close', () => {
      console.log(`Connection closed with ${participantData.username}`);
      this.removeParticipant(participantData.socketId);
    });
  }

  private removeParticipant(socketId: string): void {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.peer?.destroy();
      this.participants.delete(socketId);
      this.updateMixedStream();
    }
  }

  private updateMixedStream(): void {
    // Only create mixed stream during recording to save resources
    if (!this.recorder) {
      return;
    }

    console.log('🔄 Updating mixed stream for recording...');
    this.createMixedStream();
  }

  private createMixedStream(): void {
    try {
      console.log('🎬 Creating mixed stream for recording...');
      
      // Create a mixed stream for recording
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      
      // Add local audio
      if (this.localStream) {
        const localAudioTracks = this.localStream.getAudioTracks();
        if (localAudioTracks.length > 0) {
          console.log('🎵 Adding local audio to mixed stream');
          const localSource = audioContext.createMediaStreamSource(
            new MediaStream([localAudioTracks[0]])
          );
          localSource.connect(audioDestination);
        }
      }

      // Add participant audio
      this.participants.forEach(participant => {
        if (participant.stream && participant.audioEnabled) {
          const audioTracks = participant.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            console.log(`🎵 Adding ${participant.username} audio to mixed stream`);
            const source = audioContext.createMediaStreamSource(
              new MediaStream([audioTracks[0]])
            );
            source.connect(audioDestination);
          }
        }
      });

      // Create canvas for video mixing
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d')!;

      // Function to draw all video streams
      const drawVideos = () => {
        if (!this.recorder) return; // Stop drawing if recording stopped

        // Clear canvas with black background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Track if we draw anything to ensure canvas has content
        let drewSomething = false;

        // First, check if whiteboard is active and draw it as background
        const whiteboardCanvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (whiteboardCanvas && whiteboardCanvas !== canvas) {
          try {
            // Draw whiteboard as background
            ctx.drawImage(whiteboardCanvas, 0, 0, canvas.width, canvas.height);
            console.log('🎨 Drew whiteboard to recording canvas');
            drewSomething = true;
          } catch (error) {
            console.warn('❌ Could not draw whiteboard:', error);
          }
        }

        const videos: HTMLVideoElement[] = [];
        
        // Get existing video elements from the page instead of creating new ones
        const existingVideos = document.querySelectorAll('video');
        console.log(`🔍 Found ${existingVideos.length} video elements on page`);
        
        // Add videos that are actually playing and have video content
        existingVideos.forEach((video, index) => {
          console.log(`🎥 Video ${index}: size=${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}, paused=${video.paused}, srcObject=${!!video.srcObject}`);
          
          if (video.srcObject && 
              video.videoWidth > 0 && 
              video.videoHeight > 0 && 
              video.readyState >= 2 && 
              !video.paused) {
            videos.push(video);
            console.log(`✅ Video ${index} is active and added to recording`);
          } else {
            console.log(`❌ Video ${index} not suitable for recording`);
          }
        });
        
        // If no existing videos found, create temporary ones and add to DOM
        if (videos.length === 0) {
          console.log('⚠️ No existing video elements found, creating temporary ones...');
          
          // Add local video if available
          if (this.localStream && this.localStream.getVideoTracks().length > 0 && 
              this.localStream.getVideoTracks()[0].enabled) {
            console.log('🎥 Creating temporary local video element for recording');
            const localVideo = document.createElement('video');
            localVideo.srcObject = this.localStream;
            localVideo.muted = true;
            localVideo.playsInline = true;
            localVideo.autoplay = true;
            localVideo.style.position = 'absolute';
            localVideo.style.top = '-9999px'; // Hide off-screen
            document.body.appendChild(localVideo);
            
            // Wait for video to load, then add to videos array
            localVideo.addEventListener('loadeddata', () => {
              if (localVideo.videoWidth > 0 && localVideo.videoHeight > 0) {
                videos.push(localVideo);
                console.log('✅ Local video loaded and added');
              }
            });
          }

          // Add participant videos if available
          this.participants.forEach(participant => {
            if (participant.stream && participant.videoEnabled && 
                participant.stream.getVideoTracks().length > 0) {
              console.log(`🎥 Creating temporary video element for ${participant.username}`);
              const video = document.createElement('video');
              video.srcObject = participant.stream;
              video.muted = true;
              video.playsInline = true;
              video.autoplay = true;
              video.style.position = 'absolute';
              video.style.top = '-9999px'; // Hide off-screen
              document.body.appendChild(video);
              
              // Wait for video to load, then add to videos array
              video.addEventListener('loadeddata', () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  videos.push(video);
                  console.log(`✅ ${participant.username} video loaded and added`);
                }
              });
            }
          });
        }

        // Calculate grid layout for videos (overlay on top of whiteboard if present)
        const count = videos.length;
        console.log(`🎬 Recording frame: found ${count} video elements to draw`);
        
        if (count === 0) {
          // If no videos but we have whiteboard, that's ok - just show whiteboard
          if (!whiteboardCanvas || whiteboardCanvas === canvas) {
            // Draw a placeholder frame when no videos or whiteboard are available
            ctx.fillStyle = '#333333';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Meeting Recording', canvas.width / 2, canvas.height / 2 - 40);
            ctx.font = '24px Arial';
            ctx.fillText('No video streams active', canvas.width / 2, canvas.height / 2 + 20);
            drewSomething = true;
          } else {
            drewSomething = true; // Whiteboard was drawn
          }
          
          return;
        }

        // If we have videos, create a grid layout
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        
        // Declare variables for layout
        let cellWidth: number, cellHeight: number;
        let offsetX: number = 0, offsetY: number = 0;
        
        if (whiteboardCanvas && whiteboardCanvas !== canvas) {
          // Videos as small overlays on the whiteboard
          const overlaySize = Math.min(canvas.width, canvas.height) * 0.2; // 20% of canvas size
          cellWidth = overlaySize;
          cellHeight = overlaySize;
          offsetX = canvas.width - (cols * cellWidth) - 20; // Position in top-right
          offsetY = 20;
        } else {
          // Full-size grid layout when no whiteboard
          cellWidth = canvas.width / cols;
          cellHeight = canvas.height / rows;
          offsetX = 0;
          offsetY = 0;
        }

        videos.forEach((video, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = offsetX + (col * cellWidth);
          const y = offsetY + (row * cellHeight);

          // Draw video maintaining aspect ratio
          const videoAspect = video.videoWidth / video.videoHeight || 1;
          const cellAspect = cellWidth / cellHeight;
          
          let drawWidth = cellWidth;
          let drawHeight = cellHeight;
          let drawOffsetX = 0;
          let drawOffsetY = 0;

          if (videoAspect > cellAspect) {
            drawHeight = cellWidth / videoAspect;
            drawOffsetY = (cellHeight - drawHeight) / 2;
          } else {
            drawWidth = cellHeight * videoAspect;
            drawOffsetX = (cellWidth - drawWidth) / 2;
          }

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            try {
              ctx.drawImage(video, x + drawOffsetX, y + drawOffsetY, drawWidth, drawHeight);
              console.log(`🎬 Drew video ${index + 1}/${count} (${video.videoWidth}x${video.videoHeight})`);
              drewSomething = true;
            } catch (error) {
              console.warn(`❌ Error drawing video ${index + 1}:`, error);
              // Draw placeholder for failed video
              ctx.fillStyle = '#666666';
              ctx.fillRect(x, y, cellWidth, cellHeight);
              ctx.fillStyle = '#ffffff';
              ctx.font = '16px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('Video Error', x + cellWidth/2, y + cellHeight/2);
              drewSomething = true;
            }
          } else {
            // Draw placeholder for video that's not ready
            ctx.fillStyle = '#444444';
            ctx.fillRect(x, y, cellWidth, cellHeight);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', x + cellWidth/2, y + cellHeight/2);
            console.log(`⏳ Video ${index + 1} not ready (${video.videoWidth}x${video.videoHeight})`);
            drewSomething = true;
          }
        });

        // If nothing was drawn, draw a simple frame to ensure canvas produces data
        if (!drewSomething) {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.font = '32px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Recording...', canvas.width / 2, canvas.height / 2);
          console.log('📹 Drew fallback frame to ensure canvas has content');
        }
      };

      // Start continuous drawing loop
      const drawLoop = () => {
        drawVideos();
        requestAnimationFrame(drawLoop);
      };
      
      drawLoop();

      // Create mixed stream
      const canvasStream = canvas.captureStream(30);
      
      console.log('🎬 Canvas stream created:', {
        videoTracks: canvasStream.getVideoTracks().length,
        audioTracks: canvasStream.getAudioTracks().length,
        active: canvasStream.active,
        canvasStreamTracks: canvasStream.getVideoTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });
      
      this.mixedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);

      console.log('✅ Mixed stream created:', {
        videoTracks: this.mixedStream.getVideoTracks().length,
        audioTracks: this.mixedStream.getAudioTracks().length,
        active: this.mixedStream.active,
        canvasSize: `${canvas.width}x${canvas.height}`,
        videoTrackDetails: this.mixedStream.getVideoTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState
        })),
        audioTrackDetails: this.mixedStream.getAudioTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });
    } catch (error) {
      console.error('❌ Error creating mixed stream:', error);
      this.mixedStream = null;
    }
  }

  async toggleVideo(enabled: boolean): Promise<void> {
    if (!this.localStream || !this.socket) return;

    console.log('🎥 WebRTC toggleVideo called, enabled:', enabled);

    if (enabled) {
      // If we're turning video on, we need to get a new video track if none exists
      const videoTracks = this.localStream.getVideoTracks();
      console.log('🎥 Current video tracks:', videoTracks.length, 'enabled states:', videoTracks.map(t => t.enabled));
      
      if (videoTracks.length === 0 || videoTracks.every(track => !track.enabled)) {
        console.log('🎥 Getting new video track...');
        try {
          // Get new video stream
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            }
          });
          
          const videoTrack = videoStream.getVideoTracks()[0];
          
          // Remove old disabled tracks first
          videoTracks.forEach(track => {
            this.localStream!.removeTrack(track);
            track.stop();
          });
          
          this.localStream.addTrack(videoTrack);
          console.log('🎥 Added new video track to local stream');
          
          // Notify UI about stream update (for local video preview)
          // Force a refresh of the local video element
          this.config.onStreamUpdated?.('local', this.localStream);
          console.log('🎥 Notified UI about local stream update');
          
          // Replace track in all peer connections
          this.participants.forEach(participant => {
            if (participant.peer && (participant.peer as any)._pc) {
              const senders = (participant.peer as any)._pc.getSenders();
              const videoSender = senders.find((s: RTCRtpSender) => 
                s.track?.kind === 'video'
              );
              if (videoSender) {
                console.log('🎥 Replacing video track for peer:', participant.username);
                videoSender.replaceTrack(videoTrack);
              } else {
                // Add track if no video sender exists
                console.log('🎥 Adding video track for peer:', participant.username);
                (participant.peer as any)._pc.addTrack(videoTrack, this.localStream);
              }
            }
          });
          
          // Notify other participants that our stream has been updated
          // This will trigger them to update their UI with the new video track
          this.socket.emit('stream-updated', {
            roomId: this.config.roomId
          });
        } catch (error) {
          console.error('Failed to get video track:', error);
          return;
        }
      } else {
        // Just enable existing tracks
        console.log('🎥 Enabling existing video tracks');
        videoTracks.forEach(track => {
          track.enabled = true;
        });
        // Still notify UI in case video element needs refresh
        this.config.onStreamUpdated?.('local', this.localStream);
      }
    } else {
      // Disable video tracks
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = false;
      });
    }

    this.socket.emit('toggle-stream', {
      roomId: this.config.roomId,
      streamType: 'video',
      enabled
    });
  }

  async toggleAudio(enabled: boolean): Promise<void> {
    if (!this.localStream || !this.socket) return;

    if (enabled) {
      // If we're turning audio on, we need to get a new audio track if none exists
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        try {
          // Get new audio stream
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          
          const audioTrack = audioStream.getAudioTracks()[0];
          this.localStream.addTrack(audioTrack);
          
          // Notify UI about stream update (for local audio state)
          // Force a refresh of the local video element
          this.config.onStreamUpdated?.('local', this.localStream);
          
          // Replace track in all peer connections
          this.participants.forEach(participant => {
            if (participant.peer && (participant.peer as any)._pc) {
              const senders = (participant.peer as any)._pc.getSenders();
              const audioSender = senders.find((s: RTCRtpSender) => 
                s.track?.kind === 'audio'
              );
              if (audioSender) {
                audioSender.replaceTrack(audioTrack);
              } else {
                // Add track if no audio sender exists
                (participant.peer as any)._pc.addTrack(audioTrack, this.localStream);
              }
            }
          });
        } catch (error) {
          console.error('Failed to get audio track:', error);
          return;
        }
      } else {
        // Just enable existing tracks
        audioTracks.forEach(track => {
          track.enabled = true;
        });
      }
    } else {
      // Disable audio tracks
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = false;
      });
    }

    this.socket.emit('toggle-stream', {
      roomId: this.config.roomId,
      streamType: 'audio',
      enabled
    });
  }

  // Recording controls
  private recordingStartTime: number = 0;
  
    async startRecording(): Promise<void> {
    this.recordingStartTime = Date.now();
    try {
      console.log('🎥 Starting meeting recording...');
      
      // Create the mixed stream that includes all participants and whiteboard
      this.createMixedStream();
      
      // Wait longer for mixed stream and video elements to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let streamToRecord: MediaStream;
      
      // Check if mixed stream is working properly
      if (this.mixedStream && this.mixedStream.active && 
          this.mixedStream.getVideoTracks().length > 0 &&
          this.mixedStream.getVideoTracks()[0].readyState === 'live') {
        console.log('✅ Using mixed stream for recording (all participants + whiteboard)');
        streamToRecord = this.mixedStream;
      } else {
        console.log('⚠️ Mixed stream not working properly, using local stream as fallback');
        console.log('Mixed stream details:', {
          exists: !!this.mixedStream,
          active: this.mixedStream?.active,
          videoTracks: this.mixedStream?.getVideoTracks().length || 0,
          videoTrackState: this.mixedStream?.getVideoTracks()[0]?.readyState || 'none'
        });
        
        if (this.localStream && this.localStream.active) {
          streamToRecord = this.localStream;
        } else {
          throw new Error('No active streams available for recording');
        }
      }

      // Initialize RecordRTC with the selected stream
      console.log('🎬 Initializing RecordRTC with stream:', {
        videoTracks: streamToRecord.getVideoTracks().length,
        audioTracks: streamToRecord.getAudioTracks().length,
        streamActive: streamToRecord.active
      });

      // Simple RecordRTC initialization - keep it simple and working
      console.log('🎬 Initializing RecordRTC...');
      this.recorder = new RecordRTC(streamToRecord, {
        type: 'video'
      });

      this.recorder.startRecording();
      console.log('✅ Local recording started - please record for at least 3 seconds');
      
      // Verify recording actually started
      setTimeout(() => {
        if (this.recorder) {
          console.log('🔍 Recording status check after 3 seconds:', {
            state: this.recorder.getState(),
            streamActive: streamToRecord.active,
            videoTracks: streamToRecord.getVideoTracks().length,
            audioTracks: streamToRecord.getAudioTracks().length
          });
        }
      }, 3000);
      
      // Notify other participants
      if (this.socket) {
        this.socket.emit('start-recording', { roomId: this.config.roomId });
      }
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) {
        reject(new Error('No active recording to stop'));
        return;
      }

      // Check recording duration
      const recordingDuration = Date.now() - this.recordingStartTime;
      console.log('🛑 Stopping local recording after', recordingDuration, 'ms');
      
      if (recordingDuration < 1000) {
        console.warn('⚠️ Recording duration is very short (', recordingDuration, 'ms)');
      }

      this.recorder.stopRecording(() => {
        try {
          const blob = this.recorder!.getBlob();
          console.log('📹 Recording blob details:', {
            type: blob.type,
            size: blob.size,
            isBlob: blob instanceof Blob,
            constructor: blob.constructor.name
          });
          
          // Validate the blob before resolving
          if (!blob || !(blob instanceof Blob)) {
            console.error('❌ Invalid blob returned from recorder:', blob);
            reject(new Error('Recording failed: Invalid blob data'));
            return;
          }
          
          if (blob.size === 0) {
            console.error('❌ Empty blob returned from recorder');
            reject(new Error('Recording failed: No data captured'));
            return;
          }
          
          console.log('✅ Recording stopped successfully, blob size:', blob.size);
          
          // Clean up recorder
          this.recorder = null;
          
          // Clean up mixed stream
          if (this.mixedStream) {
            this.mixedStream.getTracks().forEach(track => track.stop());
            this.mixedStream = null;
          }
          
          // Notify other participants
          if (this.socket) {
            this.socket.emit('stop-recording', { roomId: this.config.roomId });
          }
          
          resolve(blob);
        } catch (error) {
          console.error('❌ Error processing recording blob:', error);
          reject(new Error(`Recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });
  }

  // Whiteboard controls
  startWhiteboard(): void {
    if (this.socket) {
      console.log('📋 Starting whiteboard in room:', this.config.roomId);
      console.log('📡 Socket connected:', this.socket.connected);
      console.log('🌐 Socket connecting to:', this.config.signalingServerUrl);
      console.log('🆔 Socket ID:', this.socket.id);
      
      // Test: Send a basic test event first
      console.log('🧪 Testing basic server communication...');
      this.socket.emit('test-event', { message: 'Hello from client', socketId: this.socket.id });
      
      this.socket.emit('whiteboard-start', { roomId: this.config.roomId });
    } else {
      console.log('❌ No socket available for whiteboard start');
    }
  }

  stopWhiteboard(): void {
    if (this.socket) {
      console.log('📋 Stopping whiteboard in room:', this.config.roomId);
      this.socket.emit('whiteboard-stop', { roomId: this.config.roomId });
    }
  }

  sendWhiteboardDraw(drawingData: any): void {
    if (this.socket) {
      console.log('✏️ Sending whiteboard draw:', drawingData.type);
      this.socket.emit('whiteboard-draw', { 
        roomId: this.config.roomId, 
        drawingData 
      });
    }
  }

  clearWhiteboard(): void {
    if (this.socket) {
      console.log('🧹 Clearing whiteboard in room:', this.config.roomId);
      this.socket.emit('whiteboard-clear', { roomId: this.config.roomId });
    }
  }

  undoWhiteboard(): void {
    if (this.socket) {
      console.log('↩️ Undoing whiteboard in room:', this.config.roomId);
      this.socket.emit('whiteboard-undo', { roomId: this.config.roomId });
    }
  }

  redoWhiteboard(): void {
    if (this.socket) {
      console.log('🔄 Redoing whiteboard in room:', this.config.roomId);
      this.socket.emit('whiteboard-redo', { roomId: this.config.roomId });
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Get current constraints
    const constraints = videoTrack.getConstraints();
    const currentFacingMode = constraints.facingMode || 'user';
    
    // Toggle facing mode
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    // Get new stream with different camera
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: newFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    // Replace video track
    const newVideoTrack = newStream.getVideoTracks()[0];
    const sender = this.participants.forEach(participant => {
      if (participant.peer) {
        const senders = (participant.peer as any)._pc?.getSenders();
        const videoSender = senders?.find((s: RTCRtpSender) => 
          s.track?.kind === 'video'
        );
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack);
        }
      }
    });

    // Update local stream
    this.localStream.removeTrack(videoTrack);
    this.localStream.addTrack(newVideoTrack);
    videoTrack.stop();
  }

  async getAvailableDevices(): Promise<{
    videoDevices: MediaDeviceInfo[];
    audioDevices: MediaDeviceInfo[];
  }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      videoDevices: devices.filter(device => device.kind === 'videoinput'),
      audioDevices: devices.filter(device => device.kind === 'audioinput')
    };
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  isHostUser(): boolean {
    return this.isHost;
  }

  disconnect(): void {
    // Stop recording if active
    if (this.recorder) {
      this.recorder.stopRecording();
    }

    // Close all peer connections
    this.participants.forEach(participant => {
      participant.peer?.destroy();
    });
    this.participants.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
} 