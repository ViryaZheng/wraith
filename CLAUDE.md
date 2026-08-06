# Wraith + Aegis

双网安 agent 包，跑在 [pi](https://pi.dev) 上：🔴 **Wraith**（红队/进攻）+ 🔵 **Aegis**（蓝队/防守）。**两个物理独立、各自自包含的 agent**，共享同一份离线技能库。普通 `pi` 保持纯净。

> 私有仓库：https://github.com/ViryaZheng/wraith ｜ 版本：**v0.2.0**

## PROGRESS

**Current**（2026-08-06，v0.2.0）：**已从"共享引擎"物理拆成两套独立代码并全部功能验证通过**。`engine/wraith.ts` 已删除；`wraith/index.ts` 和 `aegis/index.ts` 现在各是一份完整、自包含的 pi 扩展（`export default function(pi)`），互不 import，可独立演进。本次四项升级全部落地：
- ①**工具描述全英文化 + 扩红队工具**：红队从 3 个扩到 **7 个**（新增 `exploit_development` / `password_attack` / `c2_operations` / `social_engineering`）；蓝队 8 个。所有 `description`/`promptGuidelines`/参数说明改英文。
- ②**轻量语义检索**：每个文件内置离线 `SYNONYMS` 同义词表（creds→credential/hash…、dc→domain-controller/ad…），在 `SkillIndex.search()` 里按降权展开；新增 `/find <自然语言>` 语义搜命令。**不上 embedding，保持离线自包含**。
- ③**长程任务状态 / 证据链**：`State{target,phase,evidence,loot/iocs}` 持久化到工作目录 `.wraith.json` / `.aegis.json`，**重启可续**；每轮通过 `before_agent_start` 把 memory digest 注入系统提示（PentestGPT PTT 思路）。命令 `/log` `/evidence` `/reset`。
- ④**各自专属能力**：红队 `/loot`（战利品台账：缴获的 cred/host/shell），蓝队 `/ioc`（IOC 台账）。

验证方式：用 pi 内置 jiti 按相同方式加载两个扩展 + mock `pi` 跑功能测试——红 7 工具、蓝 8 工具全部命中真实且相关的技能，`/find`、`/loot`、`/ioc`、证据链均通过。技能分流：**红 447 + 蓝 370 = 817**。

**Next**（后续可选）：
- 误报验证仍靠人工把关（全行业通病）。
- 同义词表是手工小表（红/蓝各约 20 条）；若要更强可扩条目，仍无需联网。
- `/loot` `/ioc` 目前是纯文本条目；如需结构化（区分 host/cred/hash）可加类型字段，但会变复杂——非必要不做。

**Known outstanding**：
- 独立配置目录的 `auth.json` 靠软链共享 `~/.pi/agent/auth.json`；新机器必须先登录过 pi，否则软链断。
- `package.json` 的 `version` 已改 `0.2.0`（历史上曾写 3.0.0，属旧内部号，已纠正为对齐产品版本）。

## Architecture

```
~/Wraith/
├── wraith/index.ts      🔴 红队：完整独立 agent（7 工具 + 红人设 + 9 阶段杀伤链 + 447 技能 + loot 台账）
├── aegis/index.ts       🔵 蓝队：完整独立 agent（8 工具 + 蓝人设 + 8 阶段防御链 + 370 技能 + ioc 台账）
├── cybersec-skills/skills/   817 个 SKILL.md（vendored，离线自包含，Apache 2.0，两 agent 共用只读库）
├── themes/matrix.json   🔴 绿   ·   themes/aegis.json 🔵 冰蓝
├── install.sh           建独立配置、软链主题、写 shell 命令
├── README.md            GitHub 门面（面向用户）
└── CLAUDE.md            本文件（面向接手/开发）
```

每个 `index.ts` 内部结构（红蓝同构，只是内容不同）：Identity 常量（NAME/THEME/BANNER/PERSONA/PHASES）→ 队伍 skill 过滤（`BLUE_SUBDOMAINS` + red/blueFilter）→ `SYNONYMS` 语义表 → `SkillIndex`（倒排索引 + 同义词展开搜索）→ 工具工厂（`registerSkillTool`）→ 各工具枚举/关键词映射/`buildKeywords` → 持久化 memory（`State` + load/save + `memoryDigest`）→ `export default function(pi)` 注册工具 + 人设注入 + 命令。

- **主线**：红 9 阶段 RECON→ACCESS→EXECUTE→PERSIST→ESCALATE→CREDS→LATERAL→IMPACT→REPORT（对齐 MITRE）；蓝 8 阶段 DETECT→TRIAGE→HUNT→INVESTIGATE→CONTAIN→ERADICATE→HARDEN→REPORT。`/engage`→`/next` 一阶段一停。
- **工具分队**：红纯进攻、蓝纯防御，`cloud_security_audit` 两边都有（红看攻击路径 / 蓝看配置姿态）。
- **技能库定位**：`__dirname` 找 `../cybersec-skills/skills`，回退 `~/.pi/agent/cybersec-skills`。

## Run

```bash
cd ~/Wraith && ./install.sh    # 建独立配置、软链主题、写 wraith/aegis 命令
source ~/.zshrc
wraith    # 🔴 红队（绿）
aegis     # 🔵 蓝队（蓝）
pi        # ⚪ 普通 pi，未改动
```

进 agent 后：`/engage <目标>` 开局 → `/next` 逐阶段推进 → `/report`。记忆：`/log <发现>`、`/loot`(红)/`/ioc`(蓝)、`/evidence`、`/reset`。技能：`/find <自然语言>`（语义搜）、`/arsenal <词>`、`/list`、`/phases`、`/help`。

**改代码后离线验证**（无需真跑 pi，无需消耗 API）：
```bash
cd ~/Wraith
ln -sfn "$(pi_bundled_node_modules)" node_modules   # 见下方 Handoff 的绝对路径
# 用 jiti 加载 wraith/index.ts 与 aegis/index.ts，mock 一个 pi 对象，调用 tool.execute / command.handler
rm node_modules
```

## Known Limits

- 工具返回的是"工作流文本 + 真实命令"，真正执行靠 agent 用 bash——需人在场、给授权目标。
- 效果依赖底层模型（当前 deepseek-v4-flash）。
- 红蓝独立命令/独立配置/独立状态文件，本就不该同时跑同一目录（会各写各的 `.wraith.json`/`.aegis.json`，互不冲突）。
- `--theme` 只加载不激活；header 主题靠各配置目录 `settings.theme`，agent 内容再由 `ctx.ui.setTheme` 兜底。

## Handoff

- **改某一个 agent**：只动它自己的 `index.ts`，另一个完全不受影响（这就是物理拆分的意义）。名字/颜色/人设/主线全在文件顶部的常量区；工具在 `export default` 里的 `tools` 数组；语义词在 `SYNONYMS`；队伍 skill 过滤在 `BLUE_SUBDOMAINS` + `red/blueFilter`。
- **持久状态文件**：`.wraith.json` / `.aegis.json` 写在**启动 agent 时的工作目录**（= 用户的交战目录），已加进 `.gitignore`。
- **两个 shell 命令**在 `~/.zshrc`；两个独立配置在 `~/.pi-wraith` / `~/.pi-aegis`（各 `settings.json` 的 theme + 软链 auth/models）。
- **认证**：deepseek key 在 `~/.pi/agent/auth.json`，两个独立配置软链它。
- **pi 内置 node_modules（离线验证用）**：`/opt/homebrew/Cellar/pi-coding-agent/<版本>/libexec/lib/node_modules/@earendil-works/pi-coding-agent/node_modules`（含 jiti/typebox/pi-ai，软链进 `~/Wraith/node_modules` 即可让 jiti 解析导入）。
- **pi 扩展文档**（本机）：同上 Cellar 目录下的 `docs/`（extensions.md / themes.md / packages.md）。
- 搬新机器/Kali：拷 `~/Wraith` 整个文件夹 → `./install.sh`（技能库已自带，Kali 上 nmap/sqlmap 等系统自带）。
