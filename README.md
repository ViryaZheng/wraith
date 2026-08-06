# WRAITH 👻

> 红队渗透专用 pi agent。**一个本体**（人设 + 16 命令 + 10 工具 + 817 技能检索）+ **一层皮肤**（黑客帝国绿主题）。为 Kali Linux 打造。

Wraith 是给 [pi coding agent](https://pi.dev) 装的一个网络安全 agent 包。工具引擎把 [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)（817 个技能，Apache 2.0）通过分词倒排索引封装成 10 个工具，返回真实命令（Nmap / Burp / sqlmap / Metasploit / BloodHound / Volatility 等）交给 agent 执行；人设让它默认以红队攻击者视角作战；快捷命令把整条杀伤链变成一句话。

## 快速开始

**已装好的机器**：直接敲 `pi` 即可（本包已在 pi settings 里）。

**新机器 / Kali Linux**：
```bash
git clone <你的 Wraith 仓库> ~/Wraith      # 或直接把 ~/Wraith 拷过去
cd ~/Wraith && ./install.sh                 # 装包（817 技能库已随包自带，离线即用）
pi                                          # 进入 Wraith
```
> Kali 上工具（nmap/sqlmap/metasploit/bloodhound…）系统自带，Wraith 直接调用。需 pi + Node ≥ 22。

想要绿色黑客界面：在 pi 里执行 `/theme matrix`，或把 `~/.pi/agent/settings.json` 的 `"theme"` 设为 `"matrix"`。

## 命令速查（16 个）

**🎯 一键流**
| 命令 | 干嘛 | 背后 |
|------|------|------|
| `/pwn <目标>` | 全自动完整攻击链 | penetration_test 全阶段 |
| `/recon <目标>` | 侦察 / 资产测绘 | scanning · enumerate · recon |

**⚔️ 杀伤链分阶段**
| 命令 | 干嘛 | 背后 skills |
|------|------|------|
| `/scan <目标>` | 漏洞扫描 | web · sql · CVE |
| `/exploit [目标]` | 打点拿 shell | exploiting(34) |
| `/loot` | 搂凭据 / hash / 票据 | credential · kerberos · dpapi |
| `/climb` | 本地提权 | privilege-escalation(7) |
| `/pivot` | 横向移动 | lateral(9) |
| `/ghost` | 潜伏 / 持久化 | persistence(13) · evasion |
| `/cleanup` | 清理痕迹 | 清理阶段 |

**🎪 场景速攻**
| 命令 | 干嘛 | 背后 skills |
|------|------|------|
| `/web <url>` | 打站全套 | web(15) · sql · xss |
| `/ad <域>` | 打域全套 | active-directory(13) · kerberos · bloodhound |
| `/cloud <账号>` | 打云 | cloud(35) |
| `/phish <目标>` | 钓鱼社工 | phishing(17) |

**🧰 军火库 / 元命令**
| 命令 | 干嘛 |
|------|------|
| `/arsenal [关键词]` | 浏览 / 搜索 817 技能库 |
| `/report` | 一键出红队报告 |
| `/wraith` | 重亮绿色 banner |

承接类命令（`/loot` `/climb` `/pivot` `/ghost` `/cleanup` `/exploit`）自动复用上一次 `/recon` 或 `/pwn` 锁定的目标。也可以完全不用命令，直接大白话说"帮我打一下这个靶机 x.x.x.x"，agent 会自己选工具。

## 10 个工具

| 工具 | 覆盖 |
|------|------|
| `vulnerability_assessment` | CVE、OWASP Top 10、依赖审计、CVSS 评分 |
| `penetration_test` | 侦察 → 利用 → 提权 → 横向 → 持久化 → 清理 |
| `incident_response` | 检测 → 遏制 → 根除 → 恢复 → 复盘 |
| `threat_hunt` | 假设驱动狩猎：C2 信标、横向、持久化、外带 |
| `malware_analysis` | 静态 → 动态 → 逆向 → IOC 提取 |
| `cloud_security_audit` | IAM、存储桶、网络 ACL、K8s（AWS/Azure/GCP） |
| `compliance_audit` | ISO 27001、SOC 2、PCI DSS、HIPAA、GDPR、NIST、CMMC |
| `security_hardening` | OS/容器/网络/AD 加固（CIS Benchmark、STIG） |
| `detection_engineering` | Sigma、YARA、Splunk SPL、Elastic、Sentinel KQL、Suricata、Zeek |
| `forensic_analysis` | 磁盘、内存、网络、日志、注册表 — 时间线重建 |

## 架构

```
~/Wraith/   （一个自包含包，拷走即用）
├── extensions/wraith.ts       ← agent 本体：人设 + 16 命令 + 10 工具 + 倒排索引
├── cybersec-skills/skills/     ← 弹药库：817 个 SKILL.md（vendored，随包自带）
├── themes/matrix.json          ← 皮肤（可换）
├── install.sh                  ← 一键安装
└── package.json                ← pi 包声明
```

- **一个本体**：`wraith.ts` 里，人设（每轮注入 system prompt）、快捷命令、10 个工具、技能检索是一体的。
- **一层皮肤**：`matrix.json` 主题独立，随时可换或关掉。
- **弹药库自带**：817 技能库已 vendored 进 `cybersec-skills/skills/`（Apache 2.0），随包分发、离线可用。扩展用 `__dirname` 定位包内库，找不到才回退 `~/.pi/agent/cybersec-skills`。所以整个包拷到任何机器/Kali 都满血工作。
- **检索原理**：启动时把 817 个技能名按 `-` 分词建倒排索引；工具被调用时把结构化参数映射为加权关键词，精确 segment 命中 ×3、子串回退 ×1，返回得分最高的技能工作流原文。

## 交战规则

Wraith 的人设内置了 Rules of Engagement：只在**授权范围内**的目标作业（授权渗透 / 靶场 / CTF / 自有资产），每次开打前先确认授权，不协助针对未授权真实目标的攻击。请在合法授权下使用。

## License

MIT（扩展代码）。技能库 [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) 由其作者以 Apache 2.0 授权。
