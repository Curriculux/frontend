declare module 'simple-peer' {
  export interface Options {
    initiator?: boolean;
    channelConfig?: RTCDataChannelInit;
    channelName?: string;
    config?: RTCConfiguration;
    offerOptions?: RTCOfferOptions;
    answerOptions?: RTCAnswerOptions;
    sdpTransform?: (sdp: string) => string;
    stream?: MediaStream;
    streams?: MediaStream[];
    trickle?: boolean;
    allowHalfTrickle?: boolean;
    wrtc?: any;
    objectMode?: boolean;
  }

  export interface SignalData {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
    candidate?: RTCIceCandidate;
    transceiverRequest?: any;
    renegotiate?: boolean;
  }

  export default class SimplePeer {
    constructor(opts?: Options);
    
    signal(data: SignalData): void;
    send(data: string | Buffer | ArrayBuffer | Blob): void;
    addStream(stream: MediaStream): void;
    removeStream(stream: MediaStream): void;
    addTrack(track: MediaStreamTrack, stream: MediaStream): void;
    removeTrack(track: MediaStreamTrack, stream: MediaStream): void;
    replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream): void;
    destroy(err?: Error): void;
    
    on(event: 'signal', listener: (data: SignalData) => void): this;
    on(event: 'connect', listener: () => void): this;
    on(event: 'data', listener: (data: Buffer) => void): this;
    on(event: 'stream', listener: (stream: MediaStream) => void): this;
    on(event: 'track', listener: (track: MediaStreamTrack, stream: MediaStream) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    
    connected: boolean;
    destroyed: boolean;
  }

  export { SimplePeer };
  export const SimplePeer: typeof SimplePeer;
} 