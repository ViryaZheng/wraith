# Wraith + Aegis

两个**物理独立、各自自包含的 pi 网安 agent 产品**,配一个一键安装器:🔴 **Wraith**(红队/进攻)+ 🔵 **Aegis**(蓝队/防守)。普通 `pi` 保持纯净。项目在 `~/Wraith`。

> 私有仓库：https://github.com/ViryaZheng/wraith ｜ 版本：**v0.5.0**
> 产品定位对标 [oh-my-pi](https://github.com/can1357/oh-my-pi)（can1357 的 pi 增强分叉）——**仅作质量标杆,不占用其品牌**。底座仍是 plain pi。

## PROGRESS

**Current**（2026-09-04，v0.5.0）：**从"念说明书"升级为"真执行"的 agent**（B 级：真执行、用户控节奏；离线 harness 全验证通过，红蓝对称）。核心五步：
- **检索用上 frontmatter**（`skill-index.ts`）：原来只切目录名建倒排；现在 `build()` 解析每篇 SKILL.md 的 frontmatter，把 `description`/`tags`/`subdomain`/`mitre_attack` 分级进索引（folder-name×3、meta×2、ATT&CK 精确×4、子串×1），`getMeta()` 缓存供工具用。`/find T1003` 可按 ATT&CK 技术号命中。新增 `SkillMeta` 接口 + `parseFrontmatter()`。
- **工具从"返回文本"变"执行链"**（`skill-index.ts` 的 `registerSkillTool`/`formatOutput`）：命中 skill 后跑 `preflight()`——从 skill 正文提取引用到的 Kali 工具名，`command -v` 逐个检测（**关键坑：`for` 循环末尾工具未装会让整条命令非零退出，execSync 抛异常吞掉 stdout；用 `; true` 兜底**），输出 = skill 正文 + 环境预检报告（present/missing + apt 提示）+ **EXECUTE 指令**（要模型用 bash 真跑、读真实输出、别只贴命令）。`details` 带 `toolsPresent/toolsMissing`。
- **人格强化 + 授权门**（`index.ts`）：PERSONA 加"EXECUTE, don't narrate"+"未授权前不动手"；`/engage` 改**两步授权门**——`/engage <目标>` 只锁定+要求授权（phase=-1、authorized=false、0 条消息），第二次 `/engage`（无参）确认授权才 phase=0 跑起来；`State` 加 `authorized`，`memoryDigest` 每轮显示授权状态，`/reset` 一并清。命令数仍 **11**（没加新命令）。
- **Kali 适配**：新增 `wraith/requirements.txt`/`aegis/requirements.txt`（agent.py 回退依赖，可选装，从脚本 import 实扫映射 pip 名）+ `keys.env.example`（外部服务 API key，实扫脚本 env 变量名后精选）。`install.sh` 加 Kali 工具链检测（present/missing + apt 提示）、可选 `pip install`、拷 `keys.env` 到 `~/.wraith/`；shell 函数改成**子 shell 里 source `~/.wraith/keys.env`** 再起 pi（不污染交互 env）；shell 块改为**每次刷新**（awk 删旧块再追加），旧用户重装能拿到新函数、幂等无重复。
- **分享打磨**：README 重定位为"在 Kali 上真执行 skill"，补依赖/keys/授权说明；package.json 0.4.0→0.5.0。

**离线验证跑法**（本次踩坑记牢）：harness 用 jiti 加载 `<agent>/index.ts` + mock pi 对象。**必须 `node --preserve-symlinks --preserve-symlinks-main`**——否则 node 把 `node_modules` 软链解析成 realpath 后找不到 typebox/pi-ai。preflight 用 `child_process` 真跑，离线也能测。

<details><summary>历史（v0.4.0，2026-08-06）</summary>

在 v0.2.0（拆两独立体 + 四项能力）、v0.3.0（代码清爽化 + 一键安装器）基础上，**把 817 技能库物理切分到两个产品**，两个产品都功能验证通过：
- **技能物理切分**（v0.4.0）：原来是**一个共享 `cybersec-skills/`**、运行时按 subdomain 过滤；现在按 subdomain **物理分流**到 `wraith/skills`(447 红) 和 `aegis/skills`(370 蓝)，删除共享目录。**红队连磁盘上都不背蓝队技能**，启动也不再扫全部 817。切分干净（817=447+370，零 null-subdomain、零重叠）。每个 `skills/` 带一份 Apache 2.0 `LICENSE`+`NOTICE.md`。副作用：`SkillIndex` 去掉了 `subFilter`/`readSubdomain`/`teamFilter`/`BLUE_SUBDOMAINS`，引擎更简。
- **代码清爽化**（v0.3.0）：每个产品从 ~900 行单文件拆成**三个专注文件**：`index.ts`(身份+记忆+命令) / `tools.ts`(工具+关键词映射+同义词) / `skill-index.ts`(检索引擎)。三份文件各自独立、零共享。
- **命令精简**：`/list` 并入 `/arsenal`。命令 12→**11**。
- **工具文案精简**：删冗余 `promptGuidelines`；**保留 `promptSnippet`**（pi 源码证实它决定工具在系统提示里的可见性，删了模型看不见）。
- **一键安装器**：`install.sh` 精致化——品牌 banner、彩色输出、可 `curl \| sh` 远程自 clone、装两个独立产品、保持 pi 纯净。

</details>

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
│   ├── tools.ts          ·  7 个进攻工具 + 枚举 + 关键词映射 + 红队 SYNONYMS
│   ├── skill-index.ts    ·  检索引擎(SkillIndex 倒排+同义词展开 / tokenize / w / registerSkillTool)
│   └── skills/           ·  447 个红队 SKILL.md（vendored，离线）+ LICENSE/NOTICE
├── aegis/                🔵 蓝队产品（同结构：3 文件 + 自己的 skills/）
│   └── skills/           ·  370 个蓝队 SKILL.md
├── themes/               wraith.json(🔴) · aegis.json(🔵)
├── install.sh            一键安装器（彩色 banner / 远程自 clone / 独立配置）
├── README.md             GitHub 门面（Wraith + Aegis 品牌）
└── CLAUDE.md             本文件
```

- **三文件协作**：`index.ts` 从 `./skill-index` 拿引擎、从 `./tools` 拿 `TOOLS`/`SYNONYMS`，构造 `new SkillIndex(SKILLS_PATH, SYNONYMS)`，注册工具 + 人设注入 + 命令。`tools.ts` 依赖 `./skill-index` 的 `w`/`W_*`/类型。两个 agent 的 `skill-index.ts` 内容一致但各存一份（独立）。
- **主线**：红 9 阶段 RECON→…→REPORT（对齐 MITRE）；蓝 8 阶段 DETECT→…→REPORT。`/engage`→`/next` 一阶段一停。
- **技能库定位**：`skill-index.ts` 用 `__dirname` 找**本产品自己的 `./skills`**（红 447 / 蓝 370，已物理分好，无运行时过滤）。加技能就往对应 `skills/` 丢 SKILL.md 文件夹。

## Run

```bash
cd ~/Wraith && ./install.sh    # 建独立配置、软链主题、写 wraith/aegis 命令
source ~/.zshrc
wraith    # 🔴 红队（绿）      aegis  # 🔵 蓝队（蓝）      pi  # ⚪ 普通 pi，未改动
git -C ~/Wraith pull           # 更新
```

进 agent 后：`/engage <目标>`→`/next`→`/report`；记忆 `/log` `/loot`(红)|`/ioc`(蓝) `/evidence` `/reset`；技能 `/find <自然语言>` `/arsenal [词]`；`/help` `/phases`。

**改代码后离线验证**（不真跑 pi、不耗 API）：软链 pi 内置 node_modules 进 `~/Wraith/node_modules`，用 jiti 加载 `<agent>/index.ts` + mock 一个 `pi` 对象调 `tool.execute`/`command.handler`。**跑 harness 必须带 `node --preserve-symlinks --preserve-symlinks-main`**，否则软链被解析成 realpath 后找不到 typebox/pi-ai。内置 modules 路径见 Handoff。

## Known Limits

- 工具返回"skill 正文 + 预检 + EXECUTE 指令"，真正执行靠 agent 用 pi 内置 bash（复用 pi 权限门做安全阀）——需人在场、`/engage` 两步确认授权、目标须授权。
- **执行通道刻意走 pi bash，不在工具里自建执行沙箱**（复用权限确认、危险命令有门、省超时/交互处理）。工具内只跑只读 `command -v` 预检。
- 效果依赖底层模型（当前 deepseek-v4-flash）。模型越强，"读真实输出→决定下一步"越好。
- preflight 只按 `COMMON_TOOLS` 精选清单匹配 skill 正文里的工具名——不在清单里的工具不会被检测（漏报，不影响执行）。
- 两产品各写各的 `.wraith.json` / `.aegis.json`（在启动目录），互不冲突，已进 `.gitignore`。

## Handoff

- **改某个产品**：只动它自己的文件夹（三文件 + `skills/`），另一个完全不受影响。人设/主线在 `index.ts` 顶部常量；工具在 `tools.ts` 的 `TOOLS`；语义词在 `tools.ts` 的 `SYNONYMS`；技能就是 `skills/` 下的 SKILL.md 文件夹（无运行时过滤，红蓝已物理分开）。
- **加新工具**：往 `tools.ts` 的 `TOOLS` 加一项（`name/label/description/promptSnippet/parameters/buildKeywords`）+ 对应 `buildKeywords` 和关键词映射。**必须给 `promptSnippet`**，否则模型看不见该工具。
- **持久状态**：`.wraith.json`/`.aegis.json` 写在**启动 agent 的工作目录**。
- **shell / 配置**：`~/.zshrc` 的 `# ── Wraith + Aegis ──` 块定义 `wraith`/`aegis` + `WRAITH_HOME`；独立配置在 `~/.pi-wraith` / `~/.pi-aegis`。
- **认证**：deepseek key 在 `~/.pi/agent/auth.json`，两独立配置软链它。
- **执行/预检/授权**：执行链在 `skill-index.ts` 的 `registerSkillTool`→`formatOutput`；预检在 `preflight()`/`extractTools()`/`COMMON_TOOLS`（加新工具名往这里加）；授权门在 `index.ts` 的 `/engage` 两步 + `State.authorized` + `memoryDigest`。
- **可选依赖 / API key**：`<agent>/requirements.txt`（agent.py 回退依赖，从脚本 import 扫出）；`keys.env.example`→装到 `~/.wraith/keys.env`，shell 函数在子 shell 里 source 它。都可选，缺了 native 命令照跑。
- **pi 内置 node_modules（离线验证用）**：`/opt/homebrew/Cellar/pi-coding-agent/<版本>/libexec/lib/node_modules/@earendil-works/pi-coding-agent/node_modules`（含 jiti/typebox/pi-ai）。
- 搬新机器/Kali：`curl \| sh` 远程装（需仓库可访问），或拷 `~/Wraith` 整个文件夹跑 `./install.sh`。
