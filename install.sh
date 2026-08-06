#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Wraith (red team) + Aegis (blue team) security agents for pi.
# One engine, two agents, picked by the `wraith` / `aegis` commands.
# macOS / Kali Linux.  Plain `pi` stays clean.
#
#   cd ~/Wraith && ./install.sh   then:  source ~/.zshrc
# ═══════════════════════════════════════════════════════════════
set -e

PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_DIR="$HOME/.pi/agent"
echo "▓▓▓ Wraith + Aegis install ▓▓▓"

# 1. pi present?
command -v pi >/dev/null 2>&1 || { echo "❌ pi not found — install pi first: https://pi.dev (needs Node ≥ 22)"; exit 1; }
echo "✅ pi: $(pi --version)"

# 2. vendored 817-skill library (self-contained; clone only if missing)
SKILLS="$PKG_DIR/cybersec-skills/skills"
if [ -d "$SKILLS" ]; then
  echo "✅ skills (bundled): $(ls "$SKILLS" | wc -l | tr -d ' ')"
else
  echo "⚠️ bundled skills missing — cloning to $PI_DIR/cybersec-skills"
  git clone --depth 1 https://github.com/mukul975/Anthropic-Cybersecurity-Skills "$PI_DIR/cybersec-skills"
fi

# 3. link themes into pi's discovery path so setTheme() finds them by name
mkdir -p "$PI_DIR/themes"
ln -sf "$PKG_DIR/themes/matrix.json" "$PI_DIR/themes/matrix.json"
ln -sf "$PKG_DIR/themes/aegis.json"  "$PI_DIR/themes/aegis.json"
echo "✅ themes linked: matrix (red), aegis (blue)"

# 4. shell commands  wraith / aegis  (idempotent)
RC="$HOME/.zshrc"; [ -n "$BASH_VERSION" ] && RC="$HOME/.bashrc"
EXT="$PKG_DIR/extensions/wraith.ts"
if ! grep -q "WRAITH_TEAM=red" "$RC" 2>/dev/null; then
  cat >> "$RC" <<EOF

# ── Wraith (red team) / Aegis (blue team) security agents ──
wraith() { WRAITH_TEAM=red  pi -ne -e "$EXT" --theme matrix "\$@"; }
aegis()  { WRAITH_TEAM=blue pi -ne -e "$EXT" --theme aegis  "\$@"; }
EOF
  echo "✅ added wraith/aegis functions to $RC"
else
  echo "✅ wraith/aegis already present in $RC"
fi

echo ""
echo "▓▓▓ done ▓▓▓  run:  source $RC   then:  wraith   or   aegis"
echo "(plain 'pi' stays a clean coding agent)"
