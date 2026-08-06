# Wraith + Aegis

两个**物理独立、各自自包含的 pi 网安 agent 产品**,配一个一键安装器:🔴 **Wraith**(红队/进攻)+ 🔵 **Aegis**(蓝队/防守)。普通 `pi` 保持纯净。项目在 `~/Wraith`。

> 私有仓库：https://github.com/ViryaZheng/wraith ｜ 版本：**v0.3.0**
> 产品定位对标 [oh-my-pi](https://github.com/can1357/oh-my-pi)（can1357 的 pi 增强分叉）——**仅作质量标杆,不占用其品牌**。底座仍是 plain pi。

## PROGRESS

**Current**（2026-08-06，v0.3.0）：在 v0.2.0（物理拆两独立体 + 四项能力升级）基础上做了**代码清爽化 + 一键安装器**，两个产品都功能验证通过：
- **代码清爽化**：每个产品从 ~900 行单文件拆成**三个专注文件**（各自独立、零共享）：`index.ts`(身份+记忆+命令) / `tools.ts`(工具+关键词映射+同义词+队伍过滤) / `skill-index.ts`(通用检索引擎)。`skill-index.ts` 两份内容相同但各存一份（保物理独立）。
- **命令精简**：`/list` 并入 `/arsenal`（无参=当前阶段技能、有参=子串搜；`/find`=语义搜）。命令 12→**11**。
- **工具文案精简**：删冗余 `promptGuidelines`；**保留 `description` + `promptSnippet`**——查过 pi 源码，`promptSnippet` 决定工具在系统提示 "Available tools" 里的可见性，删了模型会看不见工具。
- **一键安装器**：`install.sh` 做成对标 oh-my-pi 那种精致度——品牌 banner、彩色输出、可 `curl \| sh` 远程自 clone、装两个独立产品、保持 pi 纯净。

关键定调（用户反复强调，避免再跑偏）：
- **两个独立 agent = 两个独立产品，零共享代码**；明确**否掉**"抽共享 core/ 框架"。
- oh-my-pi 是 can1357 的真实项目，用户**只拿它当质量标杆**（"参考"），**不改名、不占用其品牌**，底座不换（仍 plain pi）。曾一度把包名/门面误改成 "Oh My Pi"，已全部回退成 Wraith/Aegis。

**Next**（后续可选，别加复杂度）：
- 仓库私有，`curl \| sh` 一键装对外人不可用；要真正对外一键装需把仓库转公开。
- 加第三个 agent：复制一个三文件文件夹改内容，再在 `install.sh` 的 `for pair` 循环 + shell 函数各加一行。

**Known outstanding**：
- 独立配置目录的 `auth.json` 靠软链共享 `~/.pi/agent/auth.json`；新机器必须先登录过 pi，否则软链断。
- `~/.zshrc` 里可能残留旧版 shell 块；install.sh 会 warn 提醒删旧块（重复定义时 bash 取后者，功能不受影响）。新块 marker 是 `# ── Wraith + Aegis ──`。

## Architecture

```
~/Wraith/  (仓库，装两个独立 agent 产品)
├── wraith/               🔴 红队产品（完整独立）
│   ├── index.ts          ·  身份/人设/9阶段杀伤链 + 持久记忆(证据链+loot台账) + 命令 + 注册
│   ├── tools.ts          ·  7 个进攻工具 + 枚举 + 关键词映射 + 红队 SYNONYMS + teamFilter
│   └── skill-index.ts    ·  通用检索引擎(SkillIndex 倒排+同义词展开 / tokenize / w / registerSkillTool)
├── aegis/                🔵 蓝队产品（同样三文件结构，8 工具 + ioc 台账 + 蓝队词表/过滤）
├── cybersec-skills/skills/   817 个 SKILL.md（vendored，离线，两产品只读共用）
├── themes/               matrix.json(🔴) · aegis.json(🔵)
├── install.sh            一键安装器（彩色 banner / 远程自 clone / 独立配置）
├── README.md             GitHub 门面（Wraith + Aegis 品牌）
└── CLAUDE.md             本文件
```

- **三文件协作**：`index.ts` 从 `./skill-index` 拿引擎、从 `./tools` 拿 `TOOLS`/`SYNONYMS`/`teamFilter`，构造 `new SkillIndex(SKILLS_PATH, teamFilter, SYNONYMS)`，注册工具 + 人设注入 + 命令。`tools.ts` 依赖 `./skill-index` 的 `w`/`W_*`/类型。两个 agent 的 `skill-index.ts` 内容一致但各存一份（独立）。
- **主线**：红 9 阶段 RECON→…→REPORT（对齐 MITRE）；蓝 8 阶段 DETECT→…→REPORT。`/engage`→`/next` 一阶段一停。
- **技能库定位**：`skill-index.ts` 用 `__dirname` 找 `../cybersec-skills/skills`，回退 `~/.pi/agent/cybersec-skills`。

## Run

```bash
cd ~/Wraith && ./install.sh    # 建独立配置、软链主题、写 wraith/aegis 命令
source ~/.zshrc
wraith    # 🔴 红队（绿）      aegis  # 🔵 蓝队（蓝）      pi  # ⚪ 普通 pi，未改动
git -C ~/Wraith pull           # 更新
```

进 agent 后：`/engage <目标>`→`/next`→`/report`；记忆 `/log` `/loot`(红)|`/ioc`(蓝) `/evidence` `/reset`；技能 `/find <自然语言>` `/arsenal [词]`；`/help` `/phases`。

**改代码后离线验证**（不真跑 pi、不耗 API）：软链 pi 内置 node_modules 进 `~/Wraith/node_modules`，用 jiti 加载 `<agent>/index.ts` + mock 一个 `pi` 对象调 `tool.execute`/`command.handler`。内置 modules 路径见 Handoff。

## Known Limits

- 工具返回"工作流文本 + 真实命令"，真正执行靠 agent 用 bash——需人在场、给授权目标。
- 效果依赖底层模型（当前 deepseek-v4-flash）。
- 两产品各写各的 `.wraith.json` / `.aegis.json`（在启动目录），互不冲突，已进 `.gitignore`。

## Handoff

- **改某个产品**：只动它自己的文件夹三文件，另一个完全不受影响。人设/主线在 `index.ts` 顶部常量；工具在 `tools.ts` 的 `TOOLS`；语义词在 `tools.ts` 的 `SYNONYMS`；队伍 skill 过滤在 `tools.ts` 的 `BLUE_SUBDOMAINS` + `teamFilter`。
- **加新工具**：往 `tools.ts` 的 `TOOLS` 加一项（`name/label/description/promptSnippet/parameters/buildKeywords`）+ 对应 `buildKeywords` 和关键词映射。**必须给 `promptSnippet`**，否则模型看不见该工具。
- **持久状态**：`.wraith.json`/`.aegis.json` 写在**启动 agent 的工作目录**。
- **shell / 配置**：`~/.zshrc` 的 `# ── Wraith + Aegis ──` 块定义 `wraith`/`aegis` + `WRAITH_HOME`；独立配置在 `~/.pi-wraith` / `~/.pi-aegis`。
- **认证**：deepseek key 在 `~/.pi/agent/auth.json`，两独立配置软链它。
- **pi 内置 node_modules（离线验证用）**：`/opt/homebrew/Cellar/pi-coding-agent/<版本>/libexec/lib/node_modules/@earendil-works/pi-coding-agent/node_modules`（含 jiti/typebox/pi-ai）。
- 搬新机器/Kali：`curl \| sh` 远程装（需仓库可访问），或拷 `~/Wraith` 整个文件夹跑 `./install.sh`。
