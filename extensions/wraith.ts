/**
 * Wraith — 网络安全专用 agent 本体（一个 extension）
 *
 * 这是「一个 agent」：人设 + 快捷命令 + 10 个工具 + 817 技能检索，是一体的。
 * 皮肤（绿色 matrix 主题）是独立的一层，在 themes/matrix.json。
 *
 *   ▸ 工具引擎：把 Anthropic-Cybersecurity-Skills (817 个 SKILL.md) 通过分词
 *     倒排索引封装为 10 个 function-calling 工具，返回完整工作流（含真实命令）。
 *   ▸ agent 本体：红队人设（每轮注入 system prompt）+ 快捷命令 /recon /pwn /report。
 *
 * Skills 库: ~/.pi/agent/cybersec-skills/skills/
 * 来源: https://github.com/mukul975/Anthropic-Cybersecurity-Skills (Apache 2.0)
 *
 * 改名字：改下面的 AGENT_NAME。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TObject } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ═══════════════════════════════════════════════════════════════════════════════
// Agent 身份：名字 / 开场 banner / 红队人设
// ═══════════════════════════════════════════════════════════════════════════════

const AGENT_NAME = "WRAITH";

// 荧光绿电影黑客风 ASCII banner（配 matrix 主题）
const BANNER: string[] = [
  "",
  "  ██     ██ ██████   █████  ██ ████████ ██   ██",
  "  ██     ██ ██   ██ ██   ██ ██    ██    ██   ██",
  "  ██  █  ██ ██████  ███████ ██    ██    ███████",
  "  ██ ███ ██ ██   ██ ██   ██ ██    ██    ██   ██",
  "   ███ ███  ██   ██ ██   ██ ██    ██    ██   ██",
  "",
  "  ┌─[ RED TEAM // OFFENSIVE SECURITY AGENT ]─────────┐",
  "  │  10 tools · 817 skill workflows · authorized ops │",
  "  └──────────────────────────────────────────────────┘",
  "  wake the ghost:  /recon <目标>   /pwn <目标>   /report",
  "",
];

// 红队人设 —— 每一轮对话都注入到 system prompt
const PERSONA = `
═══════════════════════════════════════════════════════════════
你现在是 ${AGENT_NAME}，一个自主红队 / 渗透测试作战 Agent。

【身份】
你是一名资深攻击性安全专家（OSCP/OSEP 级别）。你思考问题的方式是攻击者视角：
资产测绘 → 攻击面枚举 → 漏洞识别 → 利用 → 提权 → 横向移动 → 权限维持 → 清理痕迹 → 出报告。

【交战规则 · Rules of Engagement】
- 你只在【获得明确授权】的目标上作业（授权渗透、内网靶场、CTF、自有资产、书面授权范围内）。
- 每次开始一个新目标前，先用一句话与用户确认这是授权范围内的目标。
- 绝不提供针对未授权真实目标的攻击、绝不做大规模无差别攻击、绝不协助逃避检测用于恶意目的。

【作战方式】
- 你手上有 10 个体系化工具：vulnerability_assessment / penetration_test / incident_response /
  threat_hunt / malware_analysis / cloud_security_audit / compliance_audit /
  security_hardening / detection_engineering / forensic_analysis。
  它们背后是 817 个真实工作流（Nmap、Burp、sqlmap、BloodHound、Metasploit、Volatility 等）。
- 用户说一个目标或需求时，主动选对工具、拿到工作流，再用 bash 一步步落地执行，边打边讲你在干什么。
- 输出风格：简洁、术语精准、像终端里的黑客。关键发现用要点列出。命令给完整可复制的。

【语言】默认用中文交流，命令和技术名词保留英文原文。
═══════════════════════════════════════════════════════════════
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SkillIndex — 分词倒排索引 + 加权搜索
// ═══════════════════════════════════════════════════════════════════════════════

// 技能库路径：优先包内 vendored（自包含，离线可用、拷走即用），
// 回退到 ~/.pi/agent/cybersec-skills（兼容旧安装 / install.sh 拉取的）。
// __dirname 在 pi 的 jiti 加载环境下可用，指向本文件所在的 extensions/ 目录。
const VENDORED_SKILLS = join(__dirname, "..", "cybersec-skills", "skills");
const SKILLS_PATH = existsSync(VENDORED_SKILLS)
  ? VENDORED_SKILLS
  : join(homedir(), ".pi", "agent", "cybersec-skills", "skills");

/** 加权关键词 */
interface WeightedTerm {
  term: string;
  weight: number; // 3 = 核心, 2 = 次要, 1 = 辅助
}

/** 搜索结果 */
interface SearchResult {
  dir: string;
  score: number;
  body: string | null;
}

class SkillIndex {
  /** dirName → 分词数组 */
  private segments: Map<string, string[]> = new Map();
  /** segment → 包含该 segment 的 dirName[] */
  private inverted: Map<string, string[]> = new Map();
  /** 所有 dirName */
  private allDirs: string[] = [];

  constructor(skillsPath: string) {
    this.build(skillsPath);
  }

  get count(): number {
    return this.allDirs.length;
  }

  /** 列出匹配任一关键词的技能 */
  list(keyword: string): string[] {
    if (!keyword) return this.allDirs;
    const kw = keyword.toLowerCase();
    return this.allDirs.filter(d => d.toLowerCase().includes(kw));
  }

  /** 加权搜索：返回按分数降序排列的结果 */
  search(terms: WeightedTerm[]): SearchResult[] {
    if (terms.length === 0) return [];

    const seen = new Set<string>();
    const candidates: Map<string, number> = new Map();

    for (const { term, weight } of terms) {
      const t = term.toLowerCase();

      // 1. 精确 segment 匹配 (高分)
      const exactDirs = this.inverted.get(t);
      if (exactDirs) {
        for (const dir of exactDirs) {
          candidates.set(dir, (candidates.get(dir) ?? 0) + weight * 3);
        }
        // 检查是否所有 term 都命中了同一个 dir
        // seen 用于追踪跨 term 的候选
      }

      // 2. 子串匹配 (低分，仅对未通过 segment 命中的 dir)
      for (const dir of this.allDirs) {
        if (candidates.has(dir)) continue; // 已有 segment 匹配，不要降级
        if (dir.toLowerCase().includes(t)) {
          candidates.set(dir, (candidates.get(dir) ?? 0) + weight * 1);
        }
      }
    }

    // 收集结果并加载 body
    const results: SearchResult[] = [];
    for (const [dir, score] of candidates) {
      if (score === 0) continue;
      const body = this.loadBody(dir);
      if (body) {
        results.push({ dir, score, body });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private build(skillsPath: string): void {
    if (!existsSync(skillsPath)) return;

    const dirs = readdirSync(skillsPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    this.allDirs = dirs;

    for (const dir of dirs) {
      const segs = dir.toLowerCase().split("-");
      this.segments.set(dir, segs);
      for (const seg of segs) {
        const list = this.inverted.get(seg);
        if (list) {
          list.push(dir);
        } else {
          this.inverted.set(seg, [dir]);
        }
      }
    }
  }

  private loadBody(dir: string): string | null {
    try {
      const raw = readFileSync(join(SKILLS_PATH, dir, "SKILL.md"), "utf-8");
      const parts = raw.split("---");
      return parts.length >= 3 ? parts.slice(2).join("---").trim() : raw.trim();
    } catch {
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 工具工厂 — 每个工具共享同一套搜索 → 格式化 → 返回逻辑
// ═══════════════════════════════════════════════════════════════════════════════

interface ToolConfig {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
  parameters: TObject;
  /** 把工具参数映射为加权关键词 */
  buildKeywords: (params: Record<string, unknown>) => WeightedTerm[];
}

function formatOutput(
  title: string,
  result: SearchResult,
  params: Record<string, unknown>,
): string {
  return [
    `## ${title}`,
    ``,
    `**Loaded skill:** \`${result.dir}\` (score: ${result.score})`,
    `**Parameters:** ${JSON.stringify(params)}`,
    ``,
    `---`,
    ``,
    result.body,
    ``,
    `---`,
    `> 📚 Source: [Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) (Apache 2.0)`,
  ].join("\n");
}

function formatNoMatch(
  title: string,
  params: Record<string, unknown>,
  terms: WeightedTerm[],
): string {
  const searched = terms.map(t => t.term).join(", ");
  return [
    `## ${title}`,
    ``,
    `**Parameters:** ${JSON.stringify(params)}`,
    ``,
    `> ⚠️ No matching skill found. Searched: ${searched}`,
    ``,
    `### Troubleshooting`,
    `- Try more specific keywords`,
    `- Use \`/cybersec-list <keyword>\` to browse available skills`,
    `- Ensure the skills library is installed:`,
    `\`\`\`bash`,
    `git clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills ~/.pi/agent/cybersec-skills`,
    `\`\`\``,
  ].join("\n");
}

function registerSkillTool(
  pi: ExtensionAPI,
  index: SkillIndex,
  config: ToolConfig,
): void {
  pi.registerTool({
    name: config.name,
    label: config.label,
    description: config.description,
    promptSnippet: config.promptSnippet,
    promptGuidelines: config.promptGuidelines,
    parameters: config.parameters,
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const terms = config.buildKeywords(params);
      onUpdate?.({
        content: [{ type: "text", text: `Searching 817 skills (${terms.map(t => t.term).join(", ")})...` }],
      });

      const results = index.search(terms);
      const best = results[0];

      if (!best) {
        return {
          content: [{ type: "text", text: formatNoMatch(config.label, params, terms) }],
          details: { ...params, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatOutput(config.label, best, params) }],
        details: { ...params, skillFound: true, skillDir: best.dir, score: best.score },
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 枚举定义
// ═══════════════════════════════════════════════════════════════════════════════

// ── 共用 ─────────────────────────────────────────────────────────────────────
const SEVERITY = ["critical", "high", "medium", "low", "all"] as const;

// ── vulnerability_assessment ─────────────────────────────────────────────────
const VULN_SCOPE = ["web_app", "api", "network", "container", "mobile", "dependency", "config", "secret", "cloud"] as const;
const VULN_FRAMEWORK = ["owasp_top10", "cwe_top25", "nist", "cis", "custom"] as const;

// ── penetration_test ─────────────────────────────────────────────────────────
const PENTEST_PHASE = ["recon", "scanning", "exploitation", "privilege_escalation", "lateral_movement", "persistence", "exfiltration", "cleanup", "full"] as const;
const PENTEST_ENV = ["web", "internal_network", "active_directory", "cloud", "mobile"] as const;
const PENTEST_FW = ["mitre_attack", "ptes", "owasp", "nist"] as const;

// ── incident_response ────────────────────────────────────────────────────────
const IR_TYPE = ["ransomware", "phishing", "data_breach", "apt_intrusion", "insider_threat", "ddos", "malware_outbreak", "account_compromise", "cloud_incident", "unknown"] as const;
const IR_PHASE = ["detection", "containment", "eradication", "recovery", "lessons_learned", "full"] as const;

// ── threat_hunt ──────────────────────────────────────────────────────────────
const HUNT_ENV = ["endpoint", "network", "cloud", "active_directory", "email", "all"] as const;
const HUNT_TECH = ["c2_beaconing", "lateral_movement", "persistence", "exfiltration", "privilege_escalation", "defense_evasion", "credential_access", "initial_access", "all"] as const;

// ── malware_analysis ─────────────────────────────────────────────────────────
const MALWARE_TYPE = ["static", "dynamic", "reverse_engineering", "full"] as const;
const MALWARE_PLATFORM = ["windows", "linux", "macos", "android", "ios", "unknown"] as const;

// ── cloud_security_audit ─────────────────────────────────────────────────────
const CLOUD_PROVIDER = ["aws", "azure", "gcp", "kubernetes", "multi"] as const;
const CLOUD_SCOPE = ["iam", "storage", "network", "compute", "kubernetes", "serverless", "database", "logging", "secrets"] as const;
const CLOUD_COMPLIANCE = ["cis", "nist", "soc2", "pci_dss", "hipaa", "custom"] as const;

// ── compliance_audit ─────────────────────────────────────────────────────────
const COMPLIANCE_FRAMEWORK = ["iso_27001", "soc2", "pci_dss", "hipaa", "gdpr", "nist_csf", "nist_800_53", "cmmc", "cis_controls", "iec_62443"] as const;
const COMPLIANCE_SCOPE = ["full", "gap_analysis", "control_mapping", "evidence_collection"] as const;

// ── security_hardening ───────────────────────────────────────────────────────
const HARDEN_TYPE = ["linux_server", "windows_server", "docker_container", "kubernetes_cluster", "web_server", "database", "active_directory", "network_device"] as const;
const HARDEN_BENCH = ["cis", "stig", "nist", "custom"] as const;

// ── detection_engineering ────────────────────────────────────────────────────
const DETECT_RULE = ["sigma", "yara", "splunk_spl", "elastic_query", "sentinel_kql", "suricata", "zeek"] as const;
const DETECT_ENV = ["windows", "linux", "macos", "cloud", "network", "all"] as const;

// ── forensic_analysis ────────────────────────────────────────────────────────
const FORENSIC_EVIDENCE = ["disk_image", "memory_dump", "network_capture", "log_files", "registry_hive", "email_archive", "mobile_device", "cloud_logs"] as const;
const FORENSIC_OBJ = ["timeline_reconstruction", "malware_investigation", "data_recovery", "user_activity", "intrusion_analysis", "full"] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 关键词构建器 — 每个工具的 buildKeywords 函数
// ═══════════════════════════════════════════════════════════════════════════════

/** 辅助：把下划线分隔的字符串拆分为搜索 token（去除常见停用词） */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[-_]/)
    .filter(t => t.length > 0 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "to", "for", "with",
  "is", "at", "by", "from", "as", "into", "be", "it", "its",
]);

/** 把关键词映射为加权词条。
 *  下划线分隔的词会被拆分为多个 token，各自保留相同权重。 */
function w(weight: number, ...keywords: string[]): WeightedTerm[] {
  return keywords.flatMap(kw => tokenize(kw).map(t => ({ term: t, weight })));
}

// 权重常量
const W_PRIMARY = 3;   // 框架名、事件类型、核心技术
const W_SECONDARY = 2; // 范围、阶段、平台
const W_AUX = 1;       // 环境、合规、辅助词

// ── 1. vulnerability_assessment ────────────────────────────────────────────

const scopeMap: Record<string, string[]> = {
  web_app:      ["web-application", "pentest", "scanning", "xss", "sql-injection", "nikto", "burp"],
  api:          ["api-security", "api", "graphql", "rest", "fuzzing"],
  network:      ["network", "nmap", "nessus", "openvas", "infrastructure"],
  container:    ["container", "docker", "trivy", "grype", "kubernetes"],
  mobile:       ["mobile", "android", "ios", "frida"],
  dependency:   ["dependency", "sca", "snyk", "supply-chain", "sbom"],
  config:       ["misconfiguration", "cis-benchmark", "hardening", "auditing"],
  secret:       ["secret", "gitleaks", "trufflehog", "credential"],
  cloud:        ["cloud", "aws", "azure", "gcp", "scout-suite"],
};

function kwVuln(params: Record<string, unknown>): WeightedTerm[] {
  const scope = params.scope as string[];
  const framework = params.framework as string | undefined;
  const severity = params.severity as string | undefined;

  const terms: WeightedTerm[] = [];
  // scope → secondary
  for (const s of scope) {
    terms.push(...w(W_SECONDARY, ...(scopeMap[s] ?? [s])));
  }
  // framework → primary (e.g. "owasp")
  if (framework) terms.push(...w(W_PRIMARY, framework));
  // severity → auxiliary
  if (severity && severity !== "all") terms.push(...w(W_AUX, severity));
  // fallback
  if (terms.length === 0) terms.push(...w(W_PRIMARY, "vulnerability-scanning"));
  return terms;
}

// ── 2. penetration_test ────────────────────────────────────────────────────

const phaseMap: Record<string, string[]> = {
  recon:              ["reconnaissance", "osint", "enumeration", "subdomain", "dns"],
  scanning:           ["scanning", "nmap", "nessus", "vulnerability-scanning"],
  exploitation:       ["exploitation", "exploiting", "metasploit", "sqlmap"],
  privilege_escalation: ["privilege-escalation", "privesc", "token", "suid"],
  lateral_movement:   ["lateral-movement", "wmiexec", "pass-the-hash", "netexec"],
  persistence:        ["persistence", "backdoor", "scheduled-task", "registry"],
  exfiltration:       ["exfiltration", "dns-tunneling", "icmp"],
  cleanup:            ["cleanup", "log", "anti-forensics"],
  full:               ["penetration-test", "red-team", "full-scope"],
};

const pentestEnvMap: Record<string, string[]> = {
  web:               ["web-application", "burp", "owasp", "zap"],
  internal_network:  ["internal-network", "lateral-movement", "netexec"],
  active_directory:  ["active-directory", "kerberoasting", "bloodhound", "dcsync"],
  cloud:             ["cloud", "aws", "azure", "gcp", "pacu"],
  mobile:            ["mobile", "android", "ios", "frida"],
};

function kwPentest(params: Record<string, unknown>): WeightedTerm[] {
  const phase = params.phase as string | undefined;
  const env = params.environment as string | undefined;

  const terms: WeightedTerm[] = [];
  if (phase && phase !== "full") {
    terms.push(...w(W_PRIMARY, ...(phaseMap[phase] ?? [phase])));
  } else {
    terms.push(...w(W_PRIMARY, "penetration-test"));
  }
  if (env) terms.push(...w(W_SECONDARY, ...(pentestEnvMap[env] ?? [env])));
  return terms;
}

// ── 3. incident_response ───────────────────────────────────────────────────

const irTypeMap: Record<string, string[]> = {
  ransomware:          ["ransomware", "recovery", "encryption", "decryptor"],
  phishing:            ["phishing", "email", "spearphishing", "bec"],
  data_breach:         ["data-breach", "exfiltration", "dlp", "leak"],
  apt_intrusion:       ["apt", "advanced-persistent", "threat-actor", "nation-state"],
  insider_threat:      ["insider-threat", "insider", "ueba", "dlp"],
  ddos:                ["ddos", "denial-of-service", "cloudflare", "scrubbing"],
  malware_outbreak:    ["malware", "outbreak", "containment", "eradication"],
  account_compromise:  ["account-compromise", "credential", "oauth", "session"],
  cloud_incident:      ["cloud-incident", "cloud-forensics", "cloudtrail", "guardduty"],
  unknown:             ["incident-response", "triage", "investigation"],
};

function kwIR(params: Record<string, unknown>): WeightedTerm[] {
  const itype = params.incident_type as string;
  const phase = params.phase as string | undefined;
  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, ...(irTypeMap[itype] ?? [itype])));
  if (phase && phase !== "full") terms.push(...w(W_SECONDARY, phase));
  return terms;
}

// ── 4. threat_hunt ─────────────────────────────────────────────────────────

const huntTechMap: Record<string, string[]> = {
  c2_beaconing:        ["beaconing", "c2", "command-and-control", "cobalt-strike"],
  lateral_movement:    ["lateral-movement", "wmi", "dcom", "netexec"],
  persistence:         ["persistence", "registry", "scheduled-task", "wmi-event"],
  exfiltration:        ["exfiltration", "dns-tunneling", "data-staging"],
  privilege_escalation: ["privilege-escalation", "privesc", "token"],
  defense_evasion:     ["defense-evasion", "timestomping", "lolbins"],
  credential_access:   ["credential-dumping", "mimikatz", "dcsync", "lsass"],
  initial_access:      ["initial-access", "phishing", "spearphishing", "exploit"],
  all:                 ["threat-hunt", "hunting", "detection"],
};

function kwHunt(params: Record<string, unknown>): WeightedTerm[] {
  const tech = params.technique as string | undefined;
  const env = params.environment as string;
  const terms: WeightedTerm[] = [];
  if (tech) {
    terms.push(...w(W_PRIMARY, ...(huntTechMap[tech] ?? [tech])));
  } else {
    terms.push(...w(W_PRIMARY, "threat-hunt"));
  }
  terms.push(...w(W_AUX, env));
  return terms;
}

// ── 5. malware_analysis ────────────────────────────────────────────────────

const malTypeMap: Record<string, string[]> = {
  static:              ["static-malware-analysis", "pe-studio", "yara", "triage"],
  dynamic:             ["dynamic-analysis", "sandbox", "cuckoo", "cape", "any-run"],
  reverse_engineering: ["reverse-engineering", "ghidra", "jadx", "dnspy", "ida"],
  full:                ["malware-analysis", "malware"],
};

const malPlatMap: Record<string, string[]> = {
  windows: ["windows", "pe", "dotnet", "powershell"],
  linux:   ["linux", "elf"],
  macos:   ["macos", "mach-o"],
  android: ["android", "apk", "jadx"],
  ios:     ["ios", "frida"],
  unknown: [],
};

function kwMalware(params: Record<string, unknown>): WeightedTerm[] {
  const atype = params.analysis_type as string | undefined;
  const plat = params.platform as string | undefined;
  const terms: WeightedTerm[] = [];
  if (atype) {
    terms.push(...w(W_PRIMARY, ...(malTypeMap[atype] ?? [atype])));
  } else {
    terms.push(...w(W_PRIMARY, "malware"));
  }
  if (plat && plat !== "unknown") {
    terms.push(...w(W_SECONDARY, ...(malPlatMap[plat] ?? [plat])));
  }
  return terms;
}

// ── 6. cloud_security_audit ────────────────────────────────────────────────

const cloudScopeMap: Record<string, string[]> = {
  iam:        ["iam", "permissions", "privilege-escalation", "identity", "role"],
  storage:    ["storage", "s3", "bucket", "misconfiguration", "blob"],
  network:    ["network", "vpc", "firewall", "security-group", "acl"],
  compute:    ["compute", "ec2", "vm", "instance"],
  kubernetes: ["kubernetes", "k8s", "eks", "aks", "gke", "rbac", "pod"],
  serverless: ["serverless", "lambda", "function", "azure-function"],
  database:   ["database", "rds", "encryption", "cosmos"],
  logging:    ["logging", "cloudtrail", "audit-log", "monitoring"],
  secrets:    ["secrets", "kms", "vault", "key-management"],
};

function kwCloud(params: Record<string, unknown>): WeightedTerm[] {
  const provider = params.provider as string;
  const scope = params.scope as string[];
  const compliance = params.compliance as string | undefined;

  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, provider));
  for (const s of scope) {
    terms.push(...w(W_SECONDARY, ...(cloudScopeMap[s] ?? [s])));
  }
  if (compliance) terms.push(...w(W_AUX, compliance));
  return terms;
}

// ── 7. compliance_audit ────────────────────────────────────────────────────

const compFwMap: Record<string, string[]> = {
  iso_27001:    ["iso", "27001", "isms"],
  soc2:         ["soc2", "soc-2", "trust-services"],
  pci_dss:      ["pci-dss", "pci", "payment-card"],
  hipaa:        ["hipaa", "healthcare", "phi"],
  gdpr:         ["gdpr", "data-protection", "privacy"],
  nist_csf:     ["nist-csf", "nist", "maturity", "framework"],
  nist_800_53:  ["nist", "800-53", "rmf", "controls"],
  cmmc:         ["cmmc"],
  cis_controls: ["cis", "benchmark", "controls"],
  iec_62443:    ["iec-62443", "ics", "ot", "industrial"],
};

function kwCompliance(params: Record<string, unknown>): WeightedTerm[] {
  const fw = params.framework as string;
  const scope = params.scope as string | undefined;

  const terms: WeightedTerm[] = [];
  // 框架名 → primary，拆分为独立 token（iso + 27001 各自匹配）
  terms.push(...w(W_PRIMARY, ...(compFwMap[fw] ?? [fw])));
  if (scope) terms.push(...w(W_AUX, scope));
  return terms;
}

// ── 8. security_hardening ──────────────────────────────────────────────────

const hardenTypeMap: Record<string, string[]> = {
  linux_server:       ["linux", "hardening", "cis-benchmark", "endpoint"],
  windows_server:     ["windows", "hardening", "cis-benchmark", "endpoint"],
  docker_container:   ["docker", "container", "hardening", "daemon"],
  kubernetes_cluster: ["kubernetes", "k8s", "hardening", "pod-security"],
  web_server:         ["web-server", "nginx", "apache", "iis", "hardening"],
  database:           ["database", "hardening", "encryption"],
  active_directory:   ["active-directory", "ldap", "tiered-model"],
  network_device:     ["network", "firewall", "segmentation", "pfsense"],
};

function kwHarden(params: Record<string, unknown>): WeightedTerm[] {
  const ttype = params.target_type as string;
  const bench = params.benchmark as string | undefined;

  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, ...(hardenTypeMap[ttype] ?? [ttype])));
  if (bench) terms.push(...w(W_SECONDARY, bench));
  return terms;
}

// ── 9. detection_engineering ───────────────────────────────────────────────

const detectRuleMap: Record<string, string[]> = {
  sigma:        ["sigma", "detection-rule", "siem"],
  yara:         ["yara", "malware", "detection"],
  splunk_spl:   ["splunk", "spl", "siem"],
  elastic_query: ["elastic", "kql", "eql", "hunting"],
  sentinel_kql: ["sentinel", "kql", "azure"],
  suricata:     ["suricata", "ids", "network"],
  zeek:         ["zeek", "network", "traffic-analysis"],
};

function kwDetection(params: Record<string, unknown>): WeightedTerm[] {
  const technique = params.technique as string;
  const ruleType = params.rule_type as string;
  const env = params.environment as string | undefined;

  const terms: WeightedTerm[] = [];
  // MITRE technique ID → primary (e.g. "T1059" and "001")
  terms.push(...w(W_SECONDARY, technique));
  // rule_type (sigma, yara, splunk...) → primary — this IS the "what"
  terms.push(...w(W_PRIMARY, ...(detectRuleMap[ruleType] ?? [ruleType])));
  if (env) terms.push(...w(W_AUX, env));
  return terms;
}

// ── 10. forensic_analysis ──────────────────────────────────────────────────

const forenEvidenceMap: Record<string, string[]> = {
  disk_image:     ["disk", "forensics", "autopsy", "image", "file-carving"],
  memory_dump:    ["memory", "volatility", "dump", "rekall", "lime"],
  network_capture: ["network", "pcap", "wireshark", "zeek", "tshark"],
  log_files:      ["log", "forensics", "audit", "syslog", "event-log"],
  registry_hive:  ["registry", "windows", "artifact", "eric-zimmerman"],
  email_archive:  ["email", "pst", "phishing", "header"],
  mobile_device:  ["mobile", "cellebrite", "android", "ios"],
  cloud_logs:     ["cloud", "cloudtrail", "athena", "azure-activity"],
};

const forenObjMap: Record<string, string[]> = {
  timeline_reconstruction: ["timeline", "plaso", "timesketch"],
  malware_investigation:   ["malware", "investigation", "reverse-engineering"],
  data_recovery:           ["data-recovery", "recovery", "carving"],
  user_activity:           ["user-activity", "browser", "usb"],
  intrusion_analysis:      ["intrusion", "breach", "compromise"],
  full:                    ["forensic", "forensics"],
};

function kwForensic(params: Record<string, unknown>): WeightedTerm[] {
  const etype = params.evidence_type as string;
  const obj = params.objective as string | undefined;

  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, ...(forenEvidenceMap[etype] ?? [etype])));
  if (obj) terms.push(...w(W_SECONDARY, ...(forenObjMap[obj] ?? [obj])));
  return terms;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extension 入口
// ═══════════════════════════════════════════════════════════════════════════════

export default function cybersec(pi: ExtensionAPI) {
  const skillsAvailable = existsSync(SKILLS_PATH);
  const index = skillsAvailable ? new SkillIndex(SKILLS_PATH) : new SkillIndex("");

  // ── 注册 10 个工具 ──────────────────────────────────────────────────────

  const tools: ToolConfig[] = [
    {
      name: "vulnerability_assessment",
      label: "Vulnerability Assessment",
      description:
        "对目标系统进行全面的漏洞评估：CVE 扫描、OWASP Top 10 检测、依赖审计、配置审查、CVSS 评分。" +
        "覆盖 Web 应用、网络、容器、API、移动端。自动匹配最相关的安全技能。",
      promptSnippet: "Scan target for vulnerabilities — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 vulnerability_assessment 对目标进行漏洞评估时，指定 target 和 scope",
      ],
      parameters: Type.Object({
        target: Type.String({ description: "评估目标：目录路径、URL、IP 地址、容器镜像名" }),
        scope: Type.Array(StringEnum(VULN_SCOPE), { description: "评估范围" }),
        severity: Type.Optional(StringEnum(SEVERITY)),
        framework: Type.Optional(StringEnum(VULN_FRAMEWORK)),
      }),
      buildKeywords: kwVuln,
    },
    {
      name: "penetration_test",
      label: "Penetration Test",
      description:
        "执行体系化渗透测试：信息收集 → 漏洞利用 → 权限提升 → 横向移动 → 持久化 → 清理痕迹。" +
        "覆盖 Web、内网、AD、云、移动端。",
      promptSnippet: "Execute penetration test — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 penetration_test 执行渗透测试时，指定 target 和 phase",
      ],
      parameters: Type.Object({
        target: Type.String({ description: "渗透目标：IP、域名、URL 或 IP 范围" }),
        phase: Type.Optional(StringEnum(PENTEST_PHASE)),
        environment: Type.Optional(StringEnum(PENTEST_ENV)),
        framework: Type.Optional(StringEnum(PENTEST_FW)),
      }),
      buildKeywords: kwPentest,
    },
    {
      name: "incident_response",
      label: "Incident Response",
      description:
        "安全事件响应工作流：检测确认 → 遏制 → 根除 → 恢复 → 事后总结。" +
        "覆盖勒索软件、钓鱼、数据泄露、APT 入侵等场景。",
      promptSnippet: "Execute incident response workflow — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 incident_response 处理安全事件时，指定 incident_type 和 phase",
      ],
      parameters: Type.Object({
        incident_type: StringEnum(IR_TYPE, { description: "事件类型" }),
        phase: Type.Optional(StringEnum(IR_PHASE)),
        severity: Type.Optional(StringEnum(SEVERITY)),
      }),
      buildKeywords: kwIR,
    },
    {
      name: "threat_hunt",
      label: "Threat Hunt",
      description:
        "主动威胁狩猎：假设驱动、IOC 搜索、行为分析、异常检测。" +
        "覆盖 C2 信标、横向移动、权限维持、数据窃取等 TTP。",
      promptSnippet: "Proactive threat hunting — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 threat_hunt 进行威胁狩猎时，指定 environment 和 technique",
      ],
      parameters: Type.Object({
        environment: StringEnum(HUNT_ENV, { description: "狩猎环境" }),
        technique: Type.Optional(StringEnum(HUNT_TECH)),
        hypothesis: Type.Optional(Type.String()),
        time_range: Type.Optional(Type.String()),
      }),
      buildKeywords: kwHunt,
    },
    {
      name: "malware_analysis",
      label: "Malware Analysis",
      description:
        "恶意软件分析工作流：静态分析 → 动态分析 → 逆向工程 → IOC 提取 → 家族归类。" +
        "覆盖 PE/ELF/Mach-O、宏病毒、脚本、移动端。",
      promptSnippet: "Analyze malware samples — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 malware_analysis 分析恶意软件时，指定 sample_path 和 analysis_type",
      ],
      parameters: Type.Object({
        sample_path: Type.String({ description: "恶意软件样本路径或哈希值" }),
        analysis_type: Type.Optional(StringEnum(MALWARE_TYPE)),
        platform: Type.Optional(StringEnum(MALWARE_PLATFORM)),
      }),
      buildKeywords: kwMalware,
    },
    {
      name: "cloud_security_audit",
      label: "Cloud Security Audit",
      description:
        "云安全审计：IAM 权限审查、存储桶配置、网络 ACL、K8s 安全、Serverless 安全。" +
        "覆盖 AWS、Azure、GCP。",
      promptSnippet: "Audit cloud security — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 cloud_security_audit 审计云环境时，指定 provider 和 scope",
      ],
      parameters: Type.Object({
        provider: StringEnum(CLOUD_PROVIDER, { description: "云提供商" }),
        scope: Type.Array(StringEnum(CLOUD_SCOPE), { description: "审计范围" }),
        compliance: Type.Optional(StringEnum(CLOUD_COMPLIANCE)),
      }),
      buildKeywords: kwCloud,
    },
    {
      name: "compliance_audit",
      label: "Compliance Audit",
      description:
        "合规审计与治理：ISO 27001、SOC 2、PCI DSS、HIPAA、GDPR、NIST CSF、CMMC。" +
        "差距分析、控制映射、证据收集。",
      promptSnippet: "Audit compliance against frameworks — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 compliance_audit 进行合规审计时，指定 framework 和 scope",
      ],
      parameters: Type.Object({
        framework: StringEnum(COMPLIANCE_FRAMEWORK, { description: "合规框架" }),
        scope: Type.Optional(StringEnum(COMPLIANCE_SCOPE)),
        target_system: Type.Optional(Type.String()),
      }),
      buildKeywords: kwCompliance,
    },
    {
      name: "security_hardening",
      label: "Security Hardening",
      description:
        "系统安全加固：OS 加固、容器加固、网络加固、应用加固、AD 加固。" +
        "基于 CIS Benchmark、STIG、最佳实践。",
      promptSnippet: "Harden systems — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 security_hardening 加固系统时，指定 target 和 benchmark",
      ],
      parameters: Type.Object({
        target: Type.String({ description: "加固目标：系统路径、容器名、服务名" }),
        target_type: StringEnum(HARDEN_TYPE, { description: "目标类型" }),
        benchmark: Type.Optional(StringEnum(HARDEN_BENCH)),
      }),
      buildKeywords: kwHarden,
    },
    {
      name: "detection_engineering",
      label: "Detection Engineering",
      description:
        "检测工程：Sigma/YARA 规则编写、SIEM 用例设计、告警调优、SOAR 剧本。" +
        "基于 MITRE ATT&CK 映射。",
      promptSnippet: "Build detection rules — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 detection_engineering 构建检测时，指定 technique 和 rule_type",
      ],
      parameters: Type.Object({
        technique: Type.String({ description: "MITRE ATT&CK 技术 ID，如 T1059.001、T1003.001" }),
        rule_type: StringEnum(DETECT_RULE, { description: "规则类型" }),
        environment: Type.Optional(StringEnum(DETECT_ENV)),
      }),
      buildKeywords: kwDetection,
    },
    {
      name: "forensic_analysis",
      label: "Forensic Analysis",
      description:
        "数字取证分析：磁盘取证、内存取证、网络取证、日志分析、时间线重建。" +
        "覆盖 Windows/Linux/macOS。",
      promptSnippet: "Perform digital forensics — matches best cybersec skill automatically",
      promptGuidelines: [
        "使用 forensic_analysis 进行取证时，指定 evidence_type 和 target",
      ],
      parameters: Type.Object({
        evidence_type: StringEnum(FORENSIC_EVIDENCE, { description: "证据类型" }),
        target: Type.String({ description: "证据文件路径" }),
        objective: Type.Optional(StringEnum(FORENSIC_OBJ)),
      }),
      buildKeywords: kwForensic,
    },
  ];

  for (const tool of tools) {
    registerSkillTool(pi, index, tool);
  }

  // ── /cybersec-list 命令 ─────────────────────────────────────────────────

  pi.registerCommand("arsenal", {
    description: "🧰 军火库：浏览 / 搜索 817 个技能（可加关键词）",
    handler: async (args, ctx) => {
      if (!skillsAvailable) {
        ctx.ui.notify(
          `Skills library not found at ${SKILLS_PATH}.\n\n` +
          `Install with:\n` +
          `git clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills ${join(SKILLS_PATH, "..")}`,
          "error",
        );
        return;
      }

      const keyword = args?.trim() || "";
      const results = index.list(keyword);

      if (results.length === 0) {
        ctx.ui.notify(`No skills found matching "${keyword}"`, "info");
        return;
      }

      ctx.ui.notify(
        `${results.length} skills${keyword ? ` matching "${keyword}"` : ""}:\n` +
        results.slice(0, 30).join("\n") +
        (results.length > 30 ? `\n... and ${results.length - 30} more` : ""),
        "info",
      );
    },
  });

  // ── Agent 本体：人设 + 快捷命令 + 开场 ───────────────────────────────────

  let currentTarget = "";
  const refreshStatus = (ctx: any) => {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("wraith", `▓ ${AGENT_NAME} ▓ 目标: ${currentTarget || "未锁定"}`);
  };

  // 每一轮把红队人设注入 system prompt
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    return { systemPrompt: event.systemPrompt + "\n" + PERSONA };
  });

  // 开场：banner + 状态栏 + 技能库状态
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget("wraith-banner", BANNER);
    refreshStatus(ctx);
    ctx.ui.notify(
      skillsAvailable
        ? `${AGENT_NAME} 上线 · 授权红队模式 · ${index.count} 个技能就绪`
        : `${AGENT_NAME} 上线 · ⚠️ 技能库未找到（跑 ./install.sh 修复）`,
      skillsAvailable ? "info" : "warning",
    );
  });

  // ── 快捷命令（红队黑话）：每条 = 一句预设好的作战指令 ──────────────────
  // build(target) 生成发给自己的指令。needTarget 的命令没给目标就提示用法；
  // 承接类命令（提权/横向等）自动复用上一次锁定的 currentTarget。
  const RoE = "先用一句话与我确认这是授权范围内的目标，然后";
  const RED_OPS: Array<{
    name: string; desc: string; hint: string; needTarget: boolean;
    build: (t: string) => string;
  }> = [
    // 🎯 一键流
    { name: "pwn", desc: "🎯 全自动完整攻击链", hint: "<目标>", needTarget: true,
      build: t => `对授权目标 ${t} 发起完整渗透。${RoE}用 penetration_test 按 侦察→漏洞识别→利用→提权→横向移动→清理 逐阶段推进，每阶段选对工具、拿工作流、用 bash 落地，边打边汇报。` },
    { name: "recon", desc: "🛰️ 侦察 / 资产测绘", hint: "<目标>", needTarget: true,
      build: t => `锁定目标 ${t}。${RoE}用 penetration_test 的侦察阶段：枚举资产、开放端口与服务指纹、子域名/目录、技术栈，发现用要点整理并给出攻击面建议。` },
    // ⚔️ 杀伤链分阶段
    { name: "scan", desc: "🔍 漏洞扫描", hint: "<目标>", needTarget: true,
      build: t => `对授权目标 ${t} 做漏洞评估：用 vulnerability_assessment 扫 Web 漏洞、CVE、依赖与配置，按 CVSS 排序输出可利用点。` },
    { name: "exploit", desc: "💥 打点拿 shell", hint: "[目标]", needTarget: false,
      build: t => `对 ${t} 发起利用：用 penetration_test 的利用阶段，针对已发现漏洞选择 exploit（Metasploit / 手工 PoC）拿下初始立足点，给出完整命令。` },
    { name: "loot", desc: "💰 搂凭据 / hash / 票据", hint: "", needTarget: false,
      build: t => `在 ${t} 上做凭据窃取：用 penetration_test 抓取本地/域凭据、hash、Kerberos 票据、DPAPI/浏览器密钥，列出获取到的凭据与用途。` },
    { name: "climb", desc: "⬆️ 本地提权", hint: "", needTarget: false,
      build: t => `在 ${t} 上做权限提升：用 penetration_test 枚举提权路径（内核/服务/配置错误/SUID 等）并给出可落地的提权 exploit。` },
    { name: "pivot", desc: "↔️ 横向移动", hint: "", needTarget: false,
      build: t => `从 ${t} 横向移动：用 penetration_test 做横向（pass-the-hash / 票据、远程执行、跳板），扩大战果并画出已控主机拓扑。` },
    { name: "ghost", desc: "👻 潜伏 / 持久化", hint: "", needTarget: false,
      build: t => `在 ${t} 上建立持久化并隐蔽：用 penetration_test 部署持久化（计划任务/服务/后门）并做检测规避，说明触发方式与隐蔽性。` },
    { name: "cleanup", desc: "🧹 清理痕迹", hint: "", needTarget: false,
      build: t => `对 ${t} 做痕迹清理：用 penetration_test 的清理阶段，清理日志/文件/持久化残留，列出清理项与残留风险。` },
    // 🎪 场景速攻
    { name: "web", desc: "🕸️ 打站全套", hint: "<url>", needTarget: true,
      build: t => `对授权目标 ${t} 做 Web 渗透全套：${RoE}先 vulnerability_assessment 找 Web 漏洞，再 penetration_test 针对 SQLi/XSS/文件上传/反序列化等逐个验证利用。` },
    { name: "ad", desc: "🏰 打域全套 (AD)", hint: "<域/DC>", needTarget: true,
      build: t => `对授权域 ${t} 做 AD 渗透：${RoE}用 penetration_test 做域侦察(BloodHound)、Kerberos 攻击(AS-REP/Kerberoasting)、ACL 滥用、DCSync，画出到 Domain Admin 的攻击路径。` },
    { name: "cloud", desc: "☁️ 打云 (AWS/Azure/GCP)", hint: "<账号/环境>", needTarget: true,
      build: t => `对授权云环境 ${t} 做云安全评估：用 cloud_security_audit 审 IAM、存储桶、网络 ACL、K8s，找可利用的错误配置与提权路径。` },
    { name: "phish", desc: "🎣 钓鱼社工", hint: "<目标>", needTarget: true,
      build: t => `针对授权目标 ${t} 设计钓鱼/社工方案：${RoE}用 penetration_test 的 phishing 相关技能，产出话术、载荷投递与凭据捕获方案（仅授权演练）。` },
  ];

  for (const op of RED_OPS) {
    pi.registerCommand(op.name, {
      description: `${op.desc}${op.hint ? "  " + op.hint : ""}`,
      handler: async (args, ctx) => {
        const t = (args || "").trim() || currentTarget;
        if (!t) {
          ctx.ui.notify(
            op.needTarget ? `用法: /${op.name} ${op.hint}` : `还没锁定目标，先 /recon <目标> 或 /pwn <目标>`,
            "warning",
          );
          return;
        }
        currentTarget = t; refreshStatus(ctx);
        pi.sendUserMessage(op.build(t));
      },
    });
  }

  // 📄 /report —— 一键出红队报告
  pi.registerCommand("report", {
    description: "📄 汇总本次发现，出红队报告",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage(
        `把本次会话到目前为止的所有发现整理成一份红队渗透报告：` +
        `执行摘要、攻击路径、漏洞清单（含严重级别与 CVSS）、复现步骤、修复建议。用中文，markdown 排版。`
      );
    },
  });

  // 🟢 /wraith —— 重新亮 banner
  pi.registerCommand("wraith", {
    description: "🟢 重新显示 Wraith banner",
    handler: async (_args, ctx) => {
      if (ctx.hasUI) ctx.ui.setWidget("wraith-banner", BANNER);
    },
  });

  // /arsenal 军火库命令见上方（列出/搜索技能库）
}
