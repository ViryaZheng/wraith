# Wraith + Aegis

双网安 agent 包，跑在 [pi](https://pi.dev) 上：🔴 **Wraith**（红队/进攻）+ 🔵 **Aegis**（蓝队/防守）。一个共享引擎、两个 agent 文件夹。普通 `pi` 保持纯净。

> 私有仓库：https://github.com/ViryaZheng/wraith

## PROGRESS

**Current**（2026-08-06）：分文件夹重构已完成并 push。`wraith/` 和 `aegis/` 两个薄入口调用共享 `engine/wraith.ts`，team 由入口硬编码（不再靠 env）。红蓝三层已彻底分开：人设 / skills（红447/蓝370，按 subdomain）/ 工具（红=进攻3个、蓝=防御8个、cloud 共享）。每个 agent 用独立配置目录（`~/.pi-wraith` / `~/.pi-aegis`，各自 theme，header 颜色已一致）。banner 精简 6 行常驻。

**Next**（后续优化，按优先级）：
- 引擎里 10 个工具的 `description` 仍是中文；agent 输出已英文，但工具描述可扫成英文（`engine/wraith.ts` 的 tools 数组，行 ~760-935）
- 红队工具偏少（仅 3 个）；可评估是否把 `malware_analysis` 等给红队（分析缴获样本）
- skills 检索是关键词倒排索引；可升级为语义检索（embedding RAG），但会牺牲"离线自包含"
- 无长程任务状态 / 证据链（PentestGPT PTT 思路）；长渗透可能"忘全局"

**Known outstanding**：
- 误报验证靠人工把关（全行业通病，HexStrike 等也没有）
- 独立配置目录的 `auth.json` 靠软链共享 `~/.pi/agent/auth.json`；新机器必须先登录过 pi，否则软链断

## Architecture

```
~/Wraith/
├── wraith/index.ts      🔴 红队入口 → registerAgent(pi, "red")
├── aegis/index.ts       🔵 蓝队入口 → registerAgent(pi, "blue")
├── engine/wraith.ts     共享引擎：10 工具 + 倒排索引 + 9/8 阶段主线 + RED/BLUE identity
├── cybersec-skills/skills/   817 个 SKILL.md（vendored，离线自包含，Apache 2.0）
├── themes/matrix.json   🔴 绿   ·   themes/aegis.json 🔵 冰蓝
├── install.sh           建独立配置、软链主题、写 shell 命令
├── README.md            GitHub 门面（面向用户）
└── CLAUDE.md            本文件（面向接手/开发）
```

- **红蓝分离三层**：人设（RED/BLUE identity）+ skills（`teamFilter` 按 subdomain）+ 工具（`TEAM_TOOLS` 映射）。
- **主线**：红队 9 阶段 RECON→ACCESS→EXECUTE→PERSIST→ESCALATE→CREDS→LATERAL→IMPACT→REPORT（对齐 MITRE）；蓝队 8 阶段 DETECT→TRIAGE→HUNT→INVESTIGATE→CONTAIN→ERADICATE→HARDEN→REPORT。逐步交互：`/engage`→`/next` 一阶段一停。
- **技能库定位**：`engine/wraith.ts` 用 `__dirname` 找 `../cybersec-skills/skills`，回退 `~/.pi/agent/cybersec-skills`。

## Run

```bash
cd ~/Wraith && ./install.sh    # 装：建独立配置、软链主题、写 wraith/aegis 命令
source ~/.zshrc
wraith    # 🔴 红队（绿）
aegis     # 🔵 蓝队（蓝）
pi        # ⚪ 普通 pi，未改动
```

进 agent 后：`/engage <目标>` 开局 → `/next` 逐阶段推进 → `/report`。其它：`/list`（当前阶段的招）`/phases`（全流程）`/arsenal <词>`（搜库）`/help`。

改开发时直接测：`PI_CODING_AGENT_DIR="$HOME/.pi-wraith" pi -ne -e ~/Wraith/wraith/index.ts -p "..."`

## Known Limits

- 工具返回的是"工作流文本 + 真实命令"，真正执行靠 agent 用 bash——需人在场、给授权目标。
- 效果依赖底层模型（当前 deepseek-v4-flash）。
- 红蓝不能在同一个会话同时激活（各自独立命令、独立配置，本就不该同时跑）。
- `--theme` 只加载不激活；header 主题靠各配置目录的 `settings.theme`，agent 内容再由 `ctx.ui.setTheme` 兜底。

## Handoff

- **改 agent 名字/颜色/人设/主线**：全在 `engine/wraith.ts` 顶部的 `RED` / `BLUE` identity 对象。
- **改工具分队**：`engine/wraith.ts` 的 `TEAM_TOOLS` 映射（red/blue/both）。
- **改 skills 分队**：`BLUE_SUBDOMAINS` 集合 + `teamFilter`。
- **两个 shell 命令**在 `~/.zshrc`；两个独立配置在 `~/.pi-wraith` / `~/.pi-aegis`（各 `settings.json` 的 theme + 软链 auth/models + 各自主题）。
- **认证**：deepseek key 在 `~/.pi/agent/auth.json`，两个独立配置软链它。
- **pi 扩展文档**（本机）：`/opt/homebrew/Cellar/pi-coding-agent/<版本>/libexec/.../docs/`（extensions.md / themes.md / packages.md / environment-variables.md）。
- 搬新机器/Kali：拷 `~/Wraith` 整个文件夹 → `./install.sh`（技能库已自带，Kali 上 nmap/sqlmap 等系统自带）。
