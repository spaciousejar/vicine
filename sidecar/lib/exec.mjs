// exec helper with output size caps, shared by the sidecar server.
import { execFile } from "node:child_process"

export function execFileFile(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { maxBuffer: 8e6, killSignal: "SIGKILL", ...opts },
      (err, stdout, stderr) => {
        if (err) {
          err.message = `${cmd} failed: ${String(stderr || err.message).slice(0, 300)}`
          reject(err)
        } else resolve(stdout)
      }
    )
  })
}
