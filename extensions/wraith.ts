/**
 * Wraith — the network-security agent body (a single pi extension).
 *
 * This is "one agent": persona + fast commands + 10 tools + 817-skill retrieval, unified.
 * The skin (green matrix theme) is a separate layer in themes/matrix.json.
 *
 *   - Tool engine: wraps Anthropic-Cybersecurity-Skills (817 SKILL.md) via a tokenized
 *     inverted index into 10 function-calling tools returning full workflows (real commands).
 *   - Agent body: red-team persona (injected into the system prompt each turn) + fast
 *     commands /pwn /recon /report.
 *
 * Skills library: ~/.pi/agent/cybersec-skills/skills/
 * Source: https://github.com/mukul975/Anthropic-Cybersecurity-Skills (Apache 2.0)
 *
 * To rename the agent, change AGENT_NAME below.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TObject } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ═══════════════════════════════════════════════════════════════════════════════
// Two agents, one engine.  RED = Wraith (offense)  ·  BLUE = Aegis (defense).
// Switch at runtime with /wraith or /aegis — also swaps the theme (matrix/aegis).
// ═══════════════════════════════════════════════════════════════════════════════

interface Phase { id: string; name: string; brief: string; order: string; probe: string; }
interface Identity { name: string; theme: string; banner: string[]; persona: string; phases: Phase[]; }

const RED: Identity = {
  name: "WRAITH",
  theme: "matrix",
  banner: [
    "  ██     ██ ██████   █████  ██ ████████ ██   ██",
    "  ██     ██ ██   ██ ██   ██ ██    ██    ██   ██",
    "  ██  █  ██ ██████  ███████ ██    ██    ███████",
    "  ██ ███ ██ ██   ██ ██   ██ ██    ██    ██   ██",
    "   ███ ███  ██   ██ ██   ██ ██    ██    ██   ██",
    "  RED TEAM · 9-phase kill chain · /engage <target> · /aegis",
  ],
  persona: `
═══════════════════════════════════════════════════════════════
You are WRAITH, an autonomous red-team / penetration-testing agent.

[Identity]
You are a senior offensive security expert (OSCP/OSEP level). You think like an attacker:
asset mapping -> enumeration -> vuln identification -> exploitation -> privilege escalation
-> lateral movement -> persistence -> cleanup -> reporting.

[Rules of Engagement]
- Operate ONLY on explicitly authorized targets (authorized pentests, lab ranges, CTFs, your
  own assets, or targets within a written scope). Confirm authorization in one line first.
- Never help attack unauthorized real targets, never run mass/indiscriminate attacks, and
  never help evade detection for malicious purposes.

[How you operate]
- 10 structured tools backed by 817 real workflows (Nmap, Burp, sqlmap, BloodHound, Metasploit,
  Volatility, etc.). Pick the right tool, pull its workflow, execute via bash, narrate as you go.
- The user may just talk naturally ("grab the creds", "escalate to root", "pivot to the DC").

[Engagement flow — one phase at a time, user-paced]
Main line: RECON -> ACCESS -> EXECUTE -> PERSIST -> ESCALATE -> CREDS -> LATERAL -> IMPACT -> REPORT. Work ONE phase at a time:
finish it, summarize findings as bullets, then STOP and wait for /next. Never race ahead.

[Style] Concise, precise, like a hacker in a terminal. Bullet findings. Full copy-pasteable commands.
[Language] English. Keep tool names and technical terms verbatim.
═══════════════════════════════════════════════════════════════
`,
  phases: [
    { id: "RECON", name: "Recon", probe: "reconnaissance scanning enumeration nmap subdomain discovery",
      brief: "map the attack surface — hosts, ports, services, subdomains, tech stack (T1046/T1595/T1083)",
      order: "Use the recon phase of penetration_test. ENUMERATE ONLY — no exploitation yet." },
    { id: "ACCESS", name: "Initial Access", probe: "exploitation web-application phishing initial-access exploit",
      brief: "get the first foothold — exploit public apps, phishing, valid accounts (T1190/T1566/T1078)",
      order: "Use vulnerability_assessment, then the exploitation phase of penetration_test, to gain initial access." },
    { id: "EXECUTE", name: "Execution", probe: "command execution powershell scripting payload",
      brief: "run code on the foothold — command/script execution, payloads (T1059)",
      order: "Use penetration_test to establish reliable code execution / a stable shell." },
    { id: "PERSIST", name: "Persistence", probe: "persistence backdoor webshell scheduled-task service registry",
      brief: "survive reboots — webshell, scheduled task, service, account (T1505.003/T1053)",
      order: "Use penetration_test to install persistence; note trigger and stealth." },
    { id: "ESCALATE", name: "Priv Esc", probe: "privilege-escalation privesc token process-injection suid kernel",
      brief: "become admin/root — kernel/service/misconfig, process injection (T1068/T1055)",
      order: "Use penetration_test to enumerate privesc paths and escalate." },
    { id: "CREDS", name: "Credentials", probe: "credential-access dumping mimikatz kerberoasting hash brute-force lsass",
      brief: "harvest secrets — OS/AD creds, hashes, tickets, brute force (T1003/T1110/T1557)",
      order: "Use penetration_test for credential access; list creds obtained and their use." },
    { id: "LATERAL", name: "Lateral", probe: "lateral-movement pass-the-hash remote-execution pivot active-directory",
      brief: "spread — pass-the-hash/tickets, remote exec, pivot, cloud accounts (T1021/T1078.004)",
      order: "Use penetration_test for lateral movement; map controlled hosts and reach the objective." },
    { id: "IMPACT", name: "Exfil / Impact", probe: "exfiltration collection cloud-storage ransomware encryption impact",
      brief: "the objective — exfiltrate data or demonstrate impact (T1530/T1537/T1486)",
      order: "Use penetration_test to stage/exfiltrate data or demonstrate impact (authorized scope only)." },
    { id: "REPORT", name: "Report", probe: "report reporting documentation",
      brief: "compile the red-team report",
      order: "Compile findings: executive summary, attack path, vulns (severity+CVSS), repro steps, remediation. English, markdown." },
  ],
};

const BLUE: Identity = {
  name: "AEGIS",
  theme: "aegis",
  banner: [
    "   █████  ███████  ██████  ██ ███████",
    "  ██   ██ ██      ██       ██ ██     ",
    "  ███████ █████   ██   ███ ██ ███████",
    "  ██   ██ ██      ██    ██ ██      ██",
    "  ██   ██ ███████  ██████  ██ ███████",
    "  BLUE TEAM · 8-phase defense · /engage <host> · /wraith",
  ],
  persona: `
═══════════════════════════════════════════════════════════════
You are AEGIS, an autonomous blue-team / defensive-security agent.

[Identity]
You are a senior SOC analyst & DFIR responder. You think like a defender:
detect -> triage -> contain -> investigate/hunt -> eradicate & recover -> report & harden.

[Mission]
- Protect authorized environments: detect intrusions, respond to incidents, hunt threats, do
  forensics, and harden. Assume good-faith defense of the user's own / authorized systems.
- Be evidence-driven: tie every conclusion to logs, IOCs, artifacts. Call out false positives.

[How you operate]
- 10 structured tools backed by 817 real workflows (Sigma, YARA, Splunk, Volatility, Zeek,
  Velociraptor, etc.). Pick the right tool, pull its workflow, execute via bash, narrate as you go.
- The user may just talk naturally ("triage this alert", "hunt for C2 beacons", "carve the memory dump").

[Response flow — one phase at a time, user-paced]
Main line: DETECT -> TRIAGE -> HUNT -> INVESTIGATE -> CONTAIN -> ERADICATE -> HARDEN -> REPORT. Work ONE phase at a time:
finish it, summarize findings as bullets, then STOP and wait for /next. Never race ahead.

[Style] Concise, precise, like an analyst at a SOC console. Bullet findings. Full copy-pasteable commands.
[Language] English. Keep tool names and technical terms verbatim.
═══════════════════════════════════════════════════════════════
`,
  phases: [
    { id: "DETECT", name: "Detect", probe: "detection-engineering siem sigma detection alert anomaly",
      brief: "spot the suspicious activity — alerts, anomalies, IOCs, affected assets",
      order: "Use detection_engineering / threat_hunt to characterize the signal and scope impact. OBSERVE ONLY." },
    { id: "TRIAGE", name: "Triage", probe: "incident-response triage soc severity classification",
      brief: "assess severity, confirm true vs false positive, determine blast radius",
      order: "Use incident_response triage: classify, rate severity, map impacted systems." },
    { id: "HUNT", name: "Hunt", probe: "threat-hunting hunting ioc behavioral c2 beaconing",
      brief: "proactively find the adversary everywhere — hypotheses, IOCs, TTPs",
      order: "Use threat_hunt: run hypotheses, search IOCs/TTPs, find every affected host." },
    { id: "INVESTIGATE", name: "Investigate", probe: "forensics dfir memory disk timeline artifact investigation",
      brief: "forensics & root cause — timeline, patient zero, how they got in",
      order: "Use forensic_analysis: disk/memory/log forensics, build the timeline, find root cause." },
    { id: "CONTAIN", name: "Contain", probe: "containment isolation block quarantine incident-response",
      brief: "stop the spread without destroying evidence — isolate, block IOCs, cut C2",
      order: "Use incident_response containment: isolate hosts, block IOCs, preserve evidence." },
    { id: "ERADICATE", name: "Eradicate", probe: "eradication recovery remediation malware-removal restore",
      brief: "remove the threat and recover — kill footholds, restore, validate clean",
      order: "Use incident_response eradication/recovery: remove footholds, restore systems, verify." },
    { id: "HARDEN", name: "Harden", probe: "hardening cis-benchmark zero-trust mitigation patch",
      brief: "prevent recurrence — patch the entry vector, harden configs, tighten controls",
      order: "Use security_hardening: patch, harden configs (CIS/STIG/zero-trust), add detections." },
    { id: "REPORT", name: "Report", probe: "report reporting lessons-learned documentation",
      brief: "compile the incident report",
      order: "Compile: executive summary, timeline, IOCs, root cause, impact, remediation & lessons. English, markdown." },
  ],
};

// Split the 817 skills by team: blue keeps defensive / ops / forensics subdomains,
// red keeps the rest (offense + technical domains). Skills with no subdomain go to both.
const BLUE_SUBDOMAINS = new Set([
  "threat-hunting", "threat-intelligence", "threat-detection", "soc-operations",
  "security-operations", "incident-response", "digital-forensics", "malware-analysis",
  "ransomware-defense", "phishing-defense", "deception-technology", "endpoint-security",
  "zero-trust-architecture", "zero-trust", "compliance-governance", "governance-risk-compliance",
  "privacy-compliance", "data-protection", "purple-team", "social-engineering-defense",
]);
const teamFilter = (team: "red" | "blue") =>
  (sub: string): boolean => team === "blue" ? BLUE_SUBDOMAINS.has(sub) : !BLUE_SUBDOMAINS.has(sub);

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

// Read the `subdomain:` field from a SKILL.md frontmatter (used for the red/blue skill split).
function readSubdomain(path: string): string | null {
  try {
    const m = readFileSync(path, "utf-8").match(/^subdomain:\s*(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

class SkillIndex {
  /** dirName → 分词数组 */
  private segments: Map<string, string[]> = new Map();
  /** segment → 包含该 segment 的 dirName[] */
  private inverted: Map<string, string[]> = new Map();
  /** 所有 dirName */
  private allDirs: string[] = [];

  constructor(skillsPath: string, subFilter?: (sub: string) => boolean) {
    this.build(skillsPath, subFilter);
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

  private build(skillsPath: string, subFilter?: (sub: string) => boolean): void {
    if (!existsSync(skillsPath)) return;

    let dirs = readdirSync(skillsPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // Optional team filter: keep only skills whose SKILL.md subdomain passes.
    if (subFilter) {
      dirs = dirs.filter(dir => {
        const sub = readSubdomain(join(skillsPath, dir, "SKILL.md"));
        return sub === null ? true : subFilter(sub);
      });
    }

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
  // Pick side from env: WRAITH_TEAM=blue -> Aegis (defense), otherwise Wraith (offense).
  const team: "red" | "blue" = process.env.WRAITH_TEAM === "blue" ? "blue" : "red";
  const ID = team === "blue" ? BLUE : RED;

  const skillsAvailable = existsSync(SKILLS_PATH);
  const index = skillsAvailable ? new SkillIndex(SKILLS_PATH, teamFilter(team)) : new SkillIndex("");

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
    description: "🧰 Arsenal: browse / search the 817-skill library (keyword optional)",
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
  let currentPhase = -1;   // -1 = not engaged; 0..N-1 = current phase index

  // Phases come from the active identity (RED = attack chain, BLUE = defense chain).
  const PHASES = ID.phases;

  const refreshStatus = (ctx: any) => {
    if (!ctx.hasUI) return;
    const phase = currentPhase >= 0
      ? `Phase ${currentPhase + 1}/${PHASES.length} · ${PHASES[currentPhase].name}`
      : "idle";
    ctx.ui.setStatus("wraith", `▓ ${ID.name} ▓ ${phase} · ${currentTarget || "no target"}`);
  };

  // Drive one phase, then stop and wait for the user's /next.
  const runPhase = (ctx: any) => {
    const p = PHASES[currentPhase];
    refreshStatus(ctx);
    const last = currentPhase === PHASES.length - 1;
    pi.sendUserMessage(
      `[Engagement on ${currentTarget} — Phase ${currentPhase + 1}/${PHASES.length}: ${p.name}]\n` +
      `Goal: ${p.brief}.\n${p.order}\n` +
      (last
        ? "This is the final phase — produce the report now."
        : `Do ONLY this phase. When done, summarize findings as bullets, then STOP and tell the user to run /next for the ${PHASES[currentPhase + 1].name} phase. Do not advance on your own.`)
    );
  };

  // Inject the red-team persona into the system prompt every turn
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    return { systemPrompt: event.systemPrompt + "\n" + ID.persona };
  });

  // On start: animated banner reveal (line by line) + status + skills status
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setTheme?.(ID.theme);   // force this team's theme (red=matrix green, blue=aegis blue)
    let i = 0;
    const reveal = () => {
      ctx.ui.setWidget("wraith-banner", ID.banner.slice(0, i));
      if (i < ID.banner.length) { i++; setTimeout(reveal, 70); return; }
      refreshStatus(ctx);
      ctx.ui.notify(
        skillsAvailable
          ? `${ID.name} online · ${team === "blue" ? "defensive" : "authorized red-team"} mode · ${index.count} skills ready`
          : `${ID.name} online · ⚠️ skills library not found (run ./install.sh)`,
        skillsAvailable ? "info" : "warning",
      );
    };
    reveal();
  });

  // ── Commands: one main line, walked step by step. /engage starts it, /next advances. ──
  const HELP: string[] = [
    "",
    `  ${ID.name} — ${team === "blue" ? "blue-team" : "red-team"} agent. One target, one main line, one step at a time.`,
    "",
    "  The engagement:",
    "    /engage <target>   start — lock target, run Phase 1 (Recon), then stop",
    "    /next              advance one phase  (Recon->Scan->Exploit->Escalate->Expand->Report)",
    "    /report            jump straight to the report",
    "",
    "  Anytime:",
    "    /arsenal [kw]      browse the 817-skill library",
    "    /help              this help",
    "",
    `  You can also just talk:  "grab the creds"   "escalate to root"   "pivot to the DC"`,
    "  Rule of engagement: authorized targets only.",
    "",
  ];

  // 🎯 /engage — start the engagement at Phase 1 (Recon)
  pi.registerCommand("engage", {
    description: "🎯 Start an engagement  <target>",
    handler: async (args, ctx) => {
      const t = (args || "").trim() || currentTarget;
      if (!t) { ctx.ui.notify("Usage: /engage <target>   e.g. /engage 10.0.0.5", "warning"); return; }
      currentTarget = t; currentPhase = 0;
      runPhase(ctx);
    },
  });

  // ⏭️ /next — advance to the next phase
  pi.registerCommand("next", {
    description: "⏭️ Advance to the next phase",
    handler: async (_args, ctx) => {
      if (currentPhase < 0 || !currentTarget) {
        ctx.ui.notify("No engagement running. Start with /engage <target>.", "warning"); return;
      }
      if (currentPhase >= PHASES.length - 1) {
        ctx.ui.notify("Engagement complete. Use /report, or /engage <target> for a new one.", "info"); return;
      }
      currentPhase += 1;
      runPhase(ctx);
    },
  });

  // 📄 /report — jump to the report phase
  pi.registerCommand("report", {
    description: "📄 Write the red-team report",
    handler: async (_args, ctx) => {
      currentPhase = PHASES.length - 1;
      if (!currentTarget) currentTarget = "this engagement";
      runPhase(ctx);
    },
  });

  // ❓ /help — how to use Wraith
  pi.registerCommand("help", {
    description: "❓ How to use this agent",
    handler: async (_args, ctx) => { ctx.ui.notify(HELP.join("\n"), "info"); },
  });

  // 🗺️ /phases — show the whole main line and where you are
  pi.registerCommand("phases", {
    description: "🗺️ Show all phases of the main line",
    handler: async (_args, ctx) => {
      const lines = PHASES.map((p, i) => {
        const mark = i === currentPhase ? "▶" : " ";
        return ` ${mark} ${i + 1}. ${p.name} — ${p.brief}`;
      });
      ctx.ui.notify([`${ID.name} main line (${PHASES.length} phases):`, ...lines].join("\n"), "info");
    },
  });

  // 📇 /list — list skills for the current phase, or /list <keyword>
  pi.registerCommand("list", {
    description: "📇 List skills for this phase (or /list <keyword>)",
    handler: async (args, ctx) => {
      const kw = (args || "").trim();
      const probe = currentPhase >= 0 ? PHASES[currentPhase].probe : "";
      const words = (kw || probe).split(/\s+/).filter(Boolean);
      const hits = [...new Set(words.flatMap(word => index.list(word)))].sort();
      if (hits.length === 0) { ctx.ui.notify(`No skills found${kw ? ` for "${kw}"` : ""}.`, "info"); return; }
      const label = kw ? `"${kw}"` : (currentPhase >= 0 ? `Phase ${currentPhase + 1} · ${PHASES[currentPhase].name}` : "current phase");
      ctx.ui.notify(
        `${hits.length} skills for ${label}:\n` +
        hits.slice(0, 30).join("\n") + (hits.length > 30 ? `\n... and ${hits.length - 30} more` : ""),
        "info",
      );
    },
  });

  // /arsenal command is defined above (browse/search the skills library)
}
