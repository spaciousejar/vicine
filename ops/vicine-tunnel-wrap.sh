#!/usr/bin/env bash
# Self-healing quick tunnel: on every (re)start it publishes the fresh
# trycloudflare URL to Vercel (env update + redeploy) automatically.
set -u
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:$PATH"
LOG=/tmp/vicine-tunnel-wrap.log

log() { echo "$(date +%T) $*" >> "$LOG"; }

cd /home/spacious/vicine-web || exit 1

cloudflared tunnel --no-autoupdate --url http://localhost:7777 2>&1 |
while IFS= read -r line; do
  case "$line" in
    *trycloudflare.com*)
      NEWURL=$(echo "$line" | grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" | head -1)
      [ -z "$NEWURL" ] && continue
      log "tunnel up: $NEWURL"
      OLDURL=$(cat /tmp/vicine-current-url 2>/dev/null || echo "")
      if [ "$NEWURL" = "$OLDURL" ]; then continue; fi
      echo "$NEWURL" > /tmp/vicine-current-url
      log "updating vercel env..."
      cd /home/spacious/vicine-web
      npx vercel env rm SUBS_SIDECAR_URL production --yes >/dev/null 2>&1
      echo "$NEWURL" | npx vercel env add SUBS_SIDECAR_URL production >/dev/null 2>&1
      if [ $? -eq 0 ]; then
        log "env set; redeploying..."
        OUT=$(npx vercel redeploy https://vicine-eight.vercel.app 2>&1 | tail -1)
        log "redeploy: $OUT"
      else
        log "env update FAILED"
      fi
      ;;
  esac
done
