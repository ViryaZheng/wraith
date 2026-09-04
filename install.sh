#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  Wraith + Aegis — one-command installer for two independent pi security agents.
#
#    🔴 Wraith (red team, offense)   ·   🔵 Aegis (blue team, defense)
#
#  Two separate products, one clean install. Plain `pi` stays untouched.
#
#  Remote:  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ViryaZheng/wraith/main/install.sh)"
#  Local:   cd ~/Wraith && ./install.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -e

# ── colors (only if stdout is a tty) ──
if [ -t 1 ]; then
  R=$'\e[0m'; B=$'\e[1m'; DIM=$'\e[2m'
  GRN=$'\e[32m'; BLU=$'\e[36m'; YLW=$'\e[33m'; RED=$'\e[31m'
else
  R=""; B=""; DIM=""; GRN=""; BLU=""; YLW=""; RED=""
fi
ok()   { printf "  ${GRN}✔${R} %s\n" "$1"; }
info() { printf "  ${BLU}•${R} %s\n" "$1"; }
warn() { printf "  ${YLW}!${R} %s\n" "$1"; }
die()  { printf "  ${RED}✗${R} %s\n" "$1" >&2; exit 1; }

banner() {
  printf "\n"
  printf "  ${GRN}${B}██     ██ ██████   █████  ██ ████████ ██   ██${R}   ${DIM}+${R}   ${BLU}${B} █████  ███████  ██████  ██ ███████${R}\n"
  printf "  ${GRN}${B}██  █  ██ ██████  ███████ ██    ██    ███████${R}   ${DIM}·${R}   ${BLU}${B}███████ █████   ██   ███ ██ ███████${R}\n"
  printf "  ${GRN}${B} ███ ███  ██   ██ ██   ██ ██    ██    ██   ██${R}   ${DIM}·${R}   ${BLU}${B}██   ██ ███████  ██████  ██ ███████${R}\n"
  printf "     ${GRN}🔴 Wraith · red team${R}   ${DIM}two independent pi security agents${R}   ${BLU}Aegis · blue team 🔵${R}\n\n"
}

banner

# 1. Prerequisites ──────────────────────────────────────────────────────────────
command -v pi  >/dev/null 2>&1 || die "pi not found — install first: https://pi.dev (Node ≥ 22)"
command -v git >/dev/null 2>&1 || die "git not found — install git first"
ok "pi $(pi --version 2>/dev/null)"

# 2. Locate the package (run-in-place) or fetch it (remote curl install) ─────────
REPO="${WRAITH_REPO:-https://github.com/ViryaZheng/wraith.git}"
WRAITH_HOME="${WRAITH_HOME:-$HOME/Wraith}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"

if [ -n "$SRC" ] && [ -f "$SRC/wraith/index.ts" ]; then
  PKG="$SRC"                                   # running from a checkout
  info "using local checkout: $PKG"
else
  if [ -d "$WRAITH_HOME/.git" ]; then
    info "updating existing install at $WRAITH_HOME"
    git -C "$WRAITH_HOME" pull --ff-only >/dev/null 2>&1 || warn "git pull failed (offline?) — using existing copy"
  else
    info "cloning $REPO → $WRAITH_HOME"
    git clone --depth 1 "$REPO" "$WRAITH_HOME" || die "clone failed (private repo? need access) — or copy the folder manually"
  fi
  PKG="$WRAITH_HOME"
fi

# 3. Bundled skill libraries (each product ships only its own team's skills) ─────
MAIN="$HOME/.pi/agent"
rc=$(find "$PKG/wraith/skills" -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
bc=$(find "$PKG/aegis/skills"  -maxdepth 1 -type d 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
if [ "$rc" -gt 0 ] && [ "$bc" -gt 0 ]; then ok "skills (bundled, offline): 🔴 $rc red · 🔵 $bc blue";
else warn "skills not bundled — expected wraith/skills and aegis/skills in the repo"; fi

# 4. Isolated config per agent (own theme so the header color matches; shared auth/models) ──
for pair in "wraith:wraith:🔴" "aegis:aegis:🔵"; do
  name=${pair%%:*}; rest=${pair#*:}; theme=${rest%%:*}; icon=${rest##*:}; dir="$HOME/.pi-$name"
  mkdir -p "$dir/themes"
  cat > "$dir/settings.json" <<EOF
{
  "lastChangelogVersion": "0.82.1",
  "theme": "$theme",
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-v4-flash",
  "defaultThinkingLevel": "high",
  "quietStartup": true
}
EOF
  for f in auth.json models.json models-store.json trust.json; do
    [ -e "$MAIN/$f" ] && ln -sf "$MAIN/$f" "$dir/$f"
  done
  ln -sf "$PKG/themes/$theme.json" "$dir/themes/$theme.json"
  ok "$icon $name  →  $dir  (theme: $theme)"
done

# 5. Kali toolchain check + API keys + optional Python fallback deps ─────────────
info "checking Kali toolchain (skills prefer these native tools)..."
CORE_TOOLS="nmap sqlmap hydra john hashcat netexec impacket-secretsdump nikto gobuster ffuf amass subfinder responder evil-winrm smbclient enum4linux msfconsole"
BLUE_TOOLS="volatility yara zeek suricata tshark tcpdump chainsaw hayabusa clamav binwalk foremost autopsy"
present=""; missing=""
for t in $CORE_TOOLS $BLUE_TOOLS; do
  if command -v "$t" >/dev/null 2>&1; then present="$present $t"; else missing="$missing $t"; fi
done
ok "Kali tools present: $(echo $present | wc -w | tr -d ' ')"
mc=$(echo $missing | wc -w | tr -d ' ')
[ "$mc" -gt 0 ] && warn "missing ($mc):$missing" && info "on Kali:  sudo apt install -y$missing"

# API keys (optional) — template to ~/.wraith/keys.env; the shell commands source it
mkdir -p "$HOME/.wraith"
if [ ! -f "$HOME/.wraith/keys.env" ] && [ -f "$PKG/keys.env.example" ]; then
  cp "$PKG/keys.env.example" "$HOME/.wraith/keys.env"
  ok "API keys template → ~/.wraith/keys.env  (optional; fill only what you need)"
else
  info "API keys: ~/.wraith/keys.env (kept)"
fi

# Optional Python fallback deps for scripts/agent.py (Kali-native commands are primary)
if [ "${WRAITH_PIP:-ask}" = "1" ]; then dopip=y
elif [ -t 0 ] && [ "${WRAITH_PIP:-ask}" = "ask" ]; then
  printf "  ${BLU}?${R} install optional Python fallback deps now? (pip, ~2-3 min) [y/N] "; read -r dopip
else dopip=n; fi
case "$dopip" in
  [yY]*) for a in wraith aegis; do
           info "pip install -r $a/requirements.txt"
           pip install -q -r "$PKG/$a/requirements.txt" 2>/dev/null && ok "$a Python deps installed" || warn "$a: some pip deps failed (fine — native tools are primary)"
         done ;;
  *) info "skipped optional Python deps — install later: pip install -r wraith/requirements.txt" ;;
esac

# 6. Shell commands: wraith / aegis (idempotent) ─────────────────────────────────
RC="$HOME/.zshrc"; [ -n "$BASH_VERSION" ] && RC="$HOME/.bashrc"
# migration: a pre-installer block used a different marker — tell the user to drop it.
grep -qF "# ── Wraith (red team) / Aegis (blue team) security agents ──" "$RC" 2>/dev/null &&
  warn "found an old install block in $RC — remove it to avoid duplicate wraith()/aegis() definitions"
MARK="# ── Wraith + Aegis ──"
existed=""
# Always refresh the block so re-running installs the current wraith()/aegis() definitions.
if grep -qF "$MARK" "$RC" 2>/dev/null; then
  existed=1
  awk -v m="$MARK" 'index($0,m){skip=3; next} skip>0{skip--; next} {print}' "$RC" > "$RC.wraith.tmp" && mv "$RC.wraith.tmp" "$RC"
fi
cat >> "$RC" <<EOF

$MARK  (🔴 Wraith red team · 🔵 Aegis blue team · plain pi stays clean)
export WRAITH_HOME="$PKG"
wraith() { ( [ -f "\$HOME/.wraith/keys.env" ] && set -a && . "\$HOME/.wraith/keys.env" && set +a; PI_CODING_AGENT_DIR="\$HOME/.pi-wraith" pi -ne -e "\$WRAITH_HOME/wraith/index.ts" "\$@" ); }
aegis()  { ( [ -f "\$HOME/.wraith/keys.env" ] && set -a && . "\$HOME/.wraith/keys.env" && set +a; PI_CODING_AGENT_DIR="\$HOME/.pi-aegis"  pi -ne -e "\$WRAITH_HOME/aegis/index.ts"  "\$@" ); }
EOF
[ -n "$existed" ] && ok "refreshed ${B}wraith${R} / ${B}aegis${R} in $RC" || ok "added ${B}wraith${R} / ${B}aegis${R} to $RC"

# 7. Done ─────────────────────────────────────────────────────────────────────────
printf "\n${GRN}${B}  Installed.${R}  ${DIM}reload your shell:${R}  source $RC\n\n"
printf "  ${GRN}wraith${R}   🔴 red team   — 9-phase kill chain, 7 offensive tools\n"
printf "  ${BLU}aegis${R}    🔵 blue team  — 8-phase defense, 8 defensive tools\n"
printf "  ${DIM}pi${R}       ⚪ stays a clean coding agent   ·   update later:${R} git -C \"$PKG\" pull\n\n"
