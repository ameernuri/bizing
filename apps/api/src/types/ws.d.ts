declare module 'ws' {
  import type { EventEmitter } from 'node:events'
  import type { IncomingMessage } from 'node:http'
  import type { Duplex } from 'node:stream'

  export class WebSocket extends EventEmitter {
    static OPEN: number
    readyState: number
    send(data: string | Buffer): void
    close(): void
    on(event: 'message', listener: (data: Buffer) => void): this
    on(event: 'close', listener: () => void): this
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: { noServer?: boolean })
    handleUpgrade(
      req: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (socket: WebSocket) => void,
    ): void
    close(): void
  }
}

