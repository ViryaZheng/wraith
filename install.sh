#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Wraith (red team) + Aegis (blue team) — two security agents for pi.
# One shared engine, two agent folders.  macOS / Kali.  Plain `pi` stays clean.
#
#   cd ~/Wraith && ./install.sh   then:  source ~/.zshrc
# ═══════════════════════════════════════════════════════════════
set -e
PKG="$(cd "$(dirname "$0")" && pwd)"
MAIN="$HOME/.pi/agent"
echo "▓▓▓ Wraith + Aegis install ▓▓▓"

# 1. pi present?
command -v pi >/dev/null 2>&1 || { echo "❌ pi not found — install first: https://pi.dev (Node ≥ 22)"; exit 1; }
echo "✅ pi $(pi --version)"

# 2. bundled 817-skill library
S="$PKG/cybersec-skills/skills"
if [ -d "$S" ]; then echo "✅ skills (bundled): $(ls "$S" | wc -l | tr -d ' ')";
else echo "⚠️ cloning skills → $MAIN/cybersec-skills"; git clone --depth 1 https://github.com/mukul975/Anthropic-Cybersecurity-Skills "$MAIN/cybersec-skills"; fi

# 3. isolated config dir per agent (own theme so the header color matches; shared auth/models)
for pair in "wraith:matrix" "aegis:aegis"; do
  name=${pair%%:*}; theme=${pair##*:}; dir="$HOME/.pi-$name"
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
  echo "✅ config $dir (theme=$theme)"
done

# 4. shell commands wraith / aegis (idempotent)
RC="$HOME/.zshrc"; [ -n "$BASH_VERSION" ] && RC="$HOME/.bashrc"
if ! grep -q 'PI_CODING_AGENT_DIR="\$HOME/.pi-wraith"' "$RC" 2>/dev/null; then
  cat >> "$RC" <<EOF

# ── Wraith (red team) / Aegis (blue team) security agents ──
wraith() { PI_CODING_AGENT_DIR="\$HOME/.pi-wraith" pi -ne -e "$PKG/wraith/index.ts" "\$@"; }
aegis()  { PI_CODING_AGENT_DIR="\$HOME/.pi-aegis" pi -ne -e "$PKG/aegis/index.ts" "\$@"; }
EOF
  echo "✅ added wraith/aegis to $RC"
else
  echo "✅ wraith/aegis already in $RC"
fi

echo ""
echo "▓▓▓ done ▓▓▓  run:  source $RC   then:  wraith  or  aegis   (plain 'pi' stays clean)"
