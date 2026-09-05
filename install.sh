#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  Frontier Knight Labs — installer for one self-contained pi security agent.
#  Auto-detects whether this checkout is 🔴 Crimson Knight (offense) or 🔵 Azure Knight (defense).
#  Base pi stays untouched. Run with bash (not sh):  ./install.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -e

if [ -t 1 ]; then R=$'\e[0m'; B=$'\e[1m'; DIM=$'\e[2m'; GRN=$'\e[32m'; BLU=$'\e[36m'; YLW=$'\e[33m'; RED=$'\e[31m'
else R=""; B=""; DIM=""; GRN=""; BLU=""; YLW=""; RED=""; fi
ok()   { printf "  ${GRN}✔${R} %s\n" "$1"; }
info() { printf "  ${BLU}•${R} %s\n" "$1"; }
warn() { printf "  ${YLW}!${R} %s\n" "$1"; }
die()  { printf "  ${RED}✗${R} %s\n" "$1" >&2; exit 1; }

# 1. Locate this checkout & detect which agent it is ─────────────────────────────
SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
if   [ -f "$SRC/crimson/index.ts" ]; then NAME=crimson; ICON="🔴"; TEAM="red team · offense";  ACCENT="$GRN"
elif [ -f "$SRC/azure/index.ts"  ]; then NAME=azure;  ICON="🔵"; TEAM="blue team · defense"; ACCENT="$BLU"
else die "run this from a crimson or azure checkout (no $NAME/index.ts found)"; fi
UP=$(printf '%s' "$NAME" | tr '[:lower:]' '[:upper:]')

printf "\n  ${ACCENT}${B}%s  %s${R}  ${DIM}— a self-contained pi security agent · Frontier Knight Labs${R}\n\n" "$ICON" "$NAME"

# 2. Prerequisites ───────────────────────────────────────────────────────────────
command -v pi  >/dev/null 2>&1 || die "pi not found — install first: https://pi.dev (Node ≥ 22)"
command -v git >/dev/null 2>&1 || die "git not found — install git first"
ok "pi $(pi --version 2>/dev/null)"

# 3. Bundled skills (offline) ─────────────────────────────────────────────────────
sc=$(find "$SRC/$NAME/skills" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
[ "$sc" -gt 0 ] && ok "skills (bundled, offline): $sc" || warn "skills not found under $NAME/skills"

# 4. Isolated config (own theme; auth/models symlinked from plain pi) ─────────────
MAIN="$HOME/.pi/agent"; dir="$HOME/.pi-$NAME"; mkdir -p "$dir/themes"
cat > "$dir/settings.json" <<EOF
{
  "theme": "$NAME",
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-v4-flash",
  "defaultThinkingLevel": "high",
  "quietStartup": true
}
EOF
for f in auth.json models.json models-store.json trust.json; do
  [ -e "$MAIN/$f" ] && ln -sf "$MAIN/$f" "$dir/$f"
done
[ -f "$SRC/themes/$NAME.json" ] && ln -sf "$SRC/themes/$NAME.json" "$dir/themes/$NAME.json"
ok "$ICON $NAME  →  $dir"
[ -e "$MAIN/auth.json" ] || warn "no ~/.pi/agent/auth.json yet — run 'pi' once and sign in, or $NAME has no model"

# 5. Kali toolchain check + keys + optional Python fallback deps ──────────────────
info "checking Kali toolchain..."
TOOLS="nmap sqlmap hydra john hashcat netexec impacket-secretsdump nikto gobuster ffuf amass subfinder responder evil-winrm smbclient enum4linux msfconsole volatility yara zeek suricata tshark tcpdump chainsaw hayabusa clamav binwalk foremost autopsy"
present=""; missing=""
for t in $TOOLS; do command -v "$t" >/dev/null 2>&1 && present="$present $t" || missing="$missing $t"; done
ok "tools present: $(echo $present | wc -w | tr -d ' ')"
mc=$(echo $missing | wc -w | tr -d ' ')
[ "$mc" -gt 0 ] && warn "missing ($mc):$missing" && info "on Kali:  sudo apt install -y$missing"

mkdir -p "$HOME/.frontierknight"
if [ ! -f "$HOME/.frontierknight/keys.env" ] && [ -f "$SRC/keys.env.example" ]; then
  cp "$SRC/keys.env.example" "$HOME/.frontierknight/keys.env"
  ok "API keys template → ~/.frontierknight/keys.env  (optional; fill only what you need)"
else
  info "API keys: ~/.frontierknight/keys.env (kept)"
fi

if [ "${FK_PIP:-ask}" = "1" ]; then dopip=y
elif [ -t 0 ] && [ "${FK_PIP:-ask}" = "ask" ]; then
  printf "  ${BLU}?${R} install optional Python fallback deps now? (pip, ~2 min) [y/N] "; read -r dopip
else dopip=n; fi
case "$dopip" in
  [yY]*) info "pip install -r $NAME/requirements.txt"
         pip install -q -r "$SRC/$NAME/requirements.txt" 2>/dev/null && ok "Python deps installed" || warn "some pip deps failed (fine — native tools are primary)" ;;
  *) info "skipped optional Python deps — install later: pip install -r $NAME/requirements.txt" ;;
esac

# 6. Shell command (idempotent refresh) ──────────────────────────────────────────
RC="$HOME/.zshrc"; [ -n "$BASH_VERSION" ] && [ -z "$ZSH_VERSION" ] && RC="$HOME/.bashrc"
MARK="# ── Frontier Knight · $NAME ──"
existed=""
if grep -qF "$MARK" "$RC" 2>/dev/null; then
  existed=1
  awk -v m="$MARK" 'index($0,m){skip=3;next} skip>0{skip--;next} {print}' "$RC" > "$RC.fk.tmp" && mv "$RC.fk.tmp" "$RC"
fi
cat >> "$RC" <<EOF

$MARK  ($ICON $TEAM · plain pi stays clean)
export ${UP}_HOME="$SRC"
$NAME() { ( [ -f "\$HOME/.frontierknight/keys.env" ] && set -a && . "\$HOME/.frontierknight/keys.env" && set +a; PI_CODING_AGENT_DIR="\$HOME/.pi-$NAME" pi -ne -e "\$${UP}_HOME/$NAME/index.ts" "\$@" ); }
EOF
[ -n "$existed" ] && ok "refreshed ${B}$NAME${R} in $RC" || ok "added ${B}$NAME${R} to $RC"

# 7. Done ─────────────────────────────────────────────────────────────────────────
printf "\n${ACCENT}${B}  Installed.${R}  ${DIM}reload your shell:${R}  source $RC\n"
printf "  ${ACCENT}$NAME${R}  $ICON $TEAM   ·   ${DIM}update:${R} git -C \"$SRC\" pull\n\n"
