import { spawn } from 'node:child_process'
import net from 'node:net'
import { collabConfig } from '../config'

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(true))
    })
  })
}

async function main() {
  const [wsAvailable, healthAvailable] = await Promise.all([
    canListen(collabConfig.port),
    canListen(collabConfig.healthPort),
  ])

  if (!wsAvailable || !healthAvailable) {
    const occupied = [
      !wsAvailable ? `ws:${collabConfig.port}` : null,
      !healthAvailable ? `health:${collabConfig.healthPort}` : null,
    ]
      .filter(Boolean)
      .join(', ')

    console.log(
      `[canvascii-collab] skipped local dev watcher because ${occupied} is already in use. ` +
        `If the Docker stack is up, this is expected. Use "pnpm --filter @bizing/canvascii-collab dev:local" with overridden ports if you want a second local instance.`,
    )
    process.exit(0)
  }

  const child = spawn(process.platform === 'win32' ? 'tsx.cmd' : 'tsx', ['watch', 'src/server.ts'], {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })

  child.on('error', (error) => {
    console.error('[canvascii-collab] failed to launch local dev watcher', error)
    process.exit(1)
  })
}

void main()
