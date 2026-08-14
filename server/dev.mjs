import { spawn } from 'node:child_process'
import process from 'node:process'

const children = [
  spawn(process.execPath, ['server/fundFlowCollector.mjs'], { stdio: 'inherit' }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { stdio: 'inherit' }),
]

let closing = false
function shutdown(signal = 'SIGTERM') {
  if (closing) return
  closing = true
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
  setTimeout(() => process.exit(0), 500).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

for (const child of children) {
  child.on('exit', (code) => {
    if (!closing && code && code !== 0) {
      shutdown()
      process.exitCode = code
    }
  })
}
