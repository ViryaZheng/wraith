#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Wraith 网安 agent — 一键安装（macOS / Kali Linux 通用）
#
#   用法:  cd ~/Wraith && ./install.sh
#
# 817 技能库已【随包自带】(cybersec-skills/skills/)，离线即用。
# 本脚本只做两件事：检查 pi，把本目录作为 pi 包安装。
# ═══════════════════════════════════════════════════════════════
set -e

PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "▓▓▓ Wraith 安装开始 ▓▓▓"

# 1. 检查 pi
if ! command -v pi >/dev/null 2>&1; then
  echo "❌ 没找到 pi。请先安装 pi coding agent：https://pi.dev"
  echo "   （Kali 上通常: npm i -g @earendil-works/pi-coding-agent，需 Node ≥ 22）"
  exit 1
fi
echo "✅ pi: $(pi --version)"

# 2. 确认自带技能库
SKILLS="$PKG_DIR/cybersec-skills/skills"
if [ -d "$SKILLS" ]; then
  echo "✅ 技能库(自带): $(ls "$SKILLS" | wc -l | tr -d ' ') 个技能"
else
  echo "⚠️ 包内技能库缺失，从上游拉取到 ~/.pi/agent/cybersec-skills …"
  git clone --depth 1 https://github.com/mukul975/Anthropic-Cybersecurity-Skills \
    "$HOME/.pi/agent/cybersec-skills"
fi

# 3. 安装本包
echo "⇩ 安装 Wraith 包…"
pi install "$PKG_DIR"

echo ""
echo "▓▓▓ 完成 ▓▓▓ 直接敲  pi  进入 Wraith。"
echo "试试： /recon <目标>   /pwn <目标>   /report   （绿主题: /theme matrix）"
