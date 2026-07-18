/**
 * pi-cybersec — Cybersecurity Toolkit Extension for pi Coding Agent
 *
 * 10 function-calling tools that serve as structured entry points to
 * the Anthropic Cybersecurity Skills library (817 skills, Apache 2.0).
 *
 * Each tool dynamically loads the most relevant SKILL.md from the
 * cybersec-skills directory and returns its full workflow — including
 * real tool commands (Nessus, Volatility, Burp Suite, BloodHound, etc.)
 *
 * Requires: Anthropic-Cybersecurity-Skills installed at:
 *   ~/.pi/agent/cybersec-skills/  (default)
 *   or set CYBERSEC_SKILLS_PATH environment variable
 *
 * Source: https://github.com/mukul975/Anthropic-Cybersecurity-Skills
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ─── Skill loader ───────────────────────────────────────────────────────────

const DEFAULT_SKILLS_PATH = path.join(os.homedir(), ".pi", "agent", "cybersec-skills", "skills");

function getSkillsPath(): string {
  return process.env.CYBERSEC_SKILLS_PATH || DEFAULT_SKILLS_PATH;
}

/** Load a SKILL.md file and strip YAML frontmatter, returning the body */
function loadSkillBody(skillDir: string): string | null {
  const skillFile = path.join(getSkillsPath(), skillDir, "SKILL.md");
  try {
    const raw = fs.readFileSync(skillFile, "utf-8");
    // Strip YAML frontmatter (between --- markers)
    const parts = raw.split("---");
    if (parts.length >= 3) {
      return parts.slice(2).join("---").trim();
    }
    return raw.trim();
  } catch {
    return null;
  }
}

/** Search skills directory for the best match given keywords */
function findBestSkill(keywords: string[]): { dir: string; body: string } | null {
  const basePath = getSkillsPath();
  if (!fs.existsSync(basePath)) return null;

  const dirs = fs.readdirSync(basePath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  // Score each directory by keyword match count
  const scored = dirs.map(dir => {
    const lower = dir.toLowerCase();
    const score = keywords.reduce((s, kw) => s + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
    return { dir, score };
  });

  scored.sort((a, b) => b.score - a.score);

  for (const { dir, score } of scored) {
    if (score === 0) continue;
    const body = loadSkillBody(dir);
    if (body) return { dir, body };
  }

  return null;
}

/** List all skill directories that match any of the given keywords */
function listMatchingSkills(keywords: string[]): string[] {
  const basePath = getSkillsPath();
  if (!fs.existsSync(basePath)) return [];

  return fs.readdirSync(basePath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => {
      const lower = name.toLowerCase();
      return keywords.some(kw => lower.includes(kw.toLowerCase()));
    });
}

// ─── Shared enums ───────────────────────────────────────────────────────────

const SeverityEnum = StringEnum(["critical", "high", "medium", "low", "all"] as const);

// ─── 1. vulnerability_assessment ────────────────────────────────────────────

const VULN_SCOPES = [
  "web_app", "api", "network", "container",
  "mobile", "dependency", "config", "secret", "cloud",
] as const;

const VULN_FRAMEWORKS = ["owasp_top10", "cwe_top25", "nist", "cis", "custom"] as const;

// ─── 2. penetration_test ────────────────────────────────────────────────────

const PENTEST_PHASES = [
  "recon", "scanning", "exploitation", "privilege_escalation",
  "lateral_movement", "persistence", "exfiltration", "cleanup", "full",
] as const;

const PENTEST_ENVS = [
  "web", "internal_network", "active_directory", "cloud", "mobile",
] as const;

const PENTEST_FRAMEWORKS = ["mitre_attack", "ptes", "owasp", "nist"] as const;

// ─── 3. incident_response ───────────────────────────────────────────────────

const INCIDENT_TYPES = [
  "ransomware", "phishing", "data_breach", "apt_intrusion",
  "insider_threat", "ddos", "malware_outbreak",
  "account_compromise", "cloud_incident", "unknown",
] as const;

const IR_PHASES = [
  "detection", "containment", "eradication",
  "recovery", "lessons_learned", "full",
] as const;

// ─── 4. threat_hunt ─────────────────────────────────────────────────────────

const HUNT_ENVS = [
  "endpoint", "network", "cloud", "active_directory", "email", "all",
] as const;

const HUNT_TECHNIQUES = [
  "c2_beaconing", "lateral_movement", "persistence",
  "exfiltration", "privilege_escalation", "defense_evasion",
  "credential_access", "initial_access", "all",
] as const;

// ─── 5. malware_analysis ────────────────────────────────────────────────────

const MALWARE_TYPES = ["static", "dynamic", "reverse_engineering", "full"] as const;
const MALWARE_PLATFORMS = ["windows", "linux", "macos", "android", "ios", "unknown"] as const;

// ─── 6. cloud_security_audit ────────────────────────────────────────────────

const CLOUD_PROVIDERS = ["aws", "azure", "gcp", "kubernetes", "multi"] as const;
const CLOUD_SCOPES = [
  "iam", "storage", "network", "compute",
  "kubernetes", "serverless", "database", "logging", "secrets",
] as const;
const CLOUD_COMPLIANCE = ["cis", "nist", "soc2", "pci_dss", "hipaa", "custom"] as const;

// ─── 7. compliance_audit ────────────────────────────────────────────────────

const COMPLIANCE_FRAMEWORKS = [
  "iso_27001", "soc2", "pci_dss", "hipaa", "gdpr",
  "nist_csf", "nist_800_53", "cmmc", "cis_controls", "iec_62443",
] as const;

const COMPLIANCE_SCOPES = [
  "full", "gap_analysis", "control_mapping", "evidence_collection",
] as const;

// ─── 8. security_hardening ──────────────────────────────────────────────────

const HARDENING_TARGETS = [
  "linux_server", "windows_server", "docker_container",
  "kubernetes_cluster", "web_server", "database",
  "active_directory", "network_device",
] as const;

const HARDENING_BENCHMARKS = ["cis", "stig", "nist", "custom"] as const;

// ─── 9. detection_engineering ───────────────────────────────────────────────

const DETECTION_RULE_TYPES = [
  "sigma", "yara", "splunk_spl", "elastic_query",
  "sentinel_kql", "suricata", "zeek",
] as const;

const DETECTION_ENVS = [
  "windows", "linux", "macos", "cloud", "network", "all",
] as const;

// ─── 10. forensic_analysis ─────────────────────────────────────────────────

const FORENSIC_EVIDENCE_TYPES = [
  "disk_image", "memory_dump", "network_capture", "log_files",
  "registry_hive", "email_archive", "mobile_device", "cloud_logs",
] as const;

const FORENSIC_OBJECTIVES = [
  "timeline_reconstruction", "malware_investigation",
  "data_recovery", "user_activity", "intrusion_analysis", "full",
] as const;

// ─── Helper: format skill output ────────────────────────────────────────────

function formatSkillOutput(
  title: string,
  skill: { dir: string; body: string },
  params: Record<string, unknown>,
): string {
  return [
    `## ${title}`,
    ``,
    `**Loaded skill:** \`${skill.dir}\``,
    `**Parameters:** ${JSON.stringify(params)}`,
    ``,
    `---`,
    ``,
    skill.body,
    ``,
    `---`,
    `> 📚 Skill source: [Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) (Apache 2.0)`,
  ].join("\n");
}

function formatNoSkillFound(title: string, params: Record<string, unknown>, searched: string[]): string {
  return [
    `## ${title}`,
    ``,
    `**Parameters:** ${JSON.stringify(params)}`,
    ``,
    `> ⚠️ No matching skill found in \`${getSkillsPath()}\``,
    `> Searched for: ${searched.join(", ")}`,
    ``,
    `### Install the skills library:`,
    `\`\`\`bash`,
    `git clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills ~/.pi/agent/cybersec-skills`,
    `\`\`\``,
  ].join("\n");
}

// ─── Extension entry point ──────────────────────────────────────────────────

export default function cybersecExtension(pi: ExtensionAPI) {
  const skillsPath = getSkillsPath();
  const skillsAvailable = fs.existsSync(skillsPath);

  // ── 1. vulnerability_assessment ─────────────────────────────────────────

  pi.registerTool({
    name: "vulnerability_assessment",
    label: "Vulnerability Assessment",
    description:
      "对目标系统进行全面的漏洞评估：CVE 扫描、OWASP Top 10 检测、依赖审计、配置审查、CVSS 评分。" +
      "覆盖 Web 应用、网络、容器、API、移动端。自动加载 Anthropic Cybersecurity Skills 中的相关技能。",
    promptSnippet: "Scan target for vulnerabilities — loads relevant cybersec skill workflow",
    promptGuidelines: [
      "使用 vulnerability_assessment 对目标进行漏洞评估时，指定 target 和 scope",
    ],
    parameters: Type.Object({
      target: Type.String({ description: "评估目标：目录路径、URL、IP 地址、容器镜像名" }),
      scope: Type.Array(StringEnum(VULN_SCOPES), { description: "评估范围" }),
      severity: Type.Optional(SeverityEnum),
      framework: Type.Optional(StringEnum(VULN_FRAMEWORKS)),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { target, scope, severity, framework } = params;

      // Map scope to skill search keywords
      const scopeKeywords: Record<string, string[]> = {
        web_app: ["web-application", "penetration-test", "scanning", "xss", "sql-injection"],
        api: ["api-security", "api-fuzzing", "graphql", "rest"],
        network: ["network", "nmap", "scanning-infrastructure", "nessus"],
        container: ["container", "docker", "trivy", "kubernetes"],
        mobile: ["mobile", "android", "ios"],
        dependency: ["dependency", "sca", "snyk", "supply-chain", "sbom"],
        config: ["misconfiguration", "cis-benchmark", "hardening", "auditing"],
        secret: ["secret", "gitleaks", "trufflehog", "credential"],
        cloud: ["cloud", "aws", "azure", "gcp", "scout-suite"],
      };

      const keywords = scope.flatMap(s => scopeKeywords[s] ?? [s]);
      if (framework === "owasp_top10") keywords.push("owasp");
      if (severity) keywords.push(severity);

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill (keywords: ${keywords.join(", ")})...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Vulnerability Assessment", params, keywords) }],
          details: { target, scope, severity, framework, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Vulnerability Assessment", skill, params) }],
        details: { target, scope, severity, framework, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 2. penetration_test ─────────────────────────────────────────────────

  pi.registerTool({
    name: "penetration_test",
    label: "Penetration Test",
    description:
      "执行体系化渗透测试：信息收集 → 漏洞利用 → 权限提升 → 横向移动 → 持久化 → 清理痕迹。" +
      "覆盖 Web、内网、AD、云、移动端。自动加载对应技能。",
    promptSnippet: "Execute penetration test — loads relevant cybersec skill workflow",
    promptGuidelines: [
      "使用 penetration_test 执行渗透测试时，指定 target 和 phase",
    ],
    parameters: Type.Object({
      target: Type.String({ description: "渗透目标：IP、域名、URL 或 IP 范围" }),
      phase: Type.Optional(StringEnum(PENTEST_PHASES)),
      environment: Type.Optional(StringEnum(PENTEST_ENVS)),
      framework: Type.Optional(StringEnum(PENTEST_FRAMEWORKS)),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { target, phase, environment, framework } = params;

      const phaseKeywords: Record<string, string[]> = {
        recon: ["reconnaissance", "osint", "enumeration", "subdomain", "dns"],
        scanning: ["scanning", "nmap", "nessus", "vulnerability-scanning"],
        exploitation: ["exploitation", "exploiting", "metasploit", "sqlmap"],
        privilege_escalation: ["privilege-escalation", "privesc", "lazagne"],
        lateral_movement: ["lateral-movement", "wmiexec", "pass-the"],
        persistence: ["persistence", "backdoor", "scheduled-task"],
        exfiltration: ["exfiltration", "data-exfiltration", "dns-tunneling"],
        cleanup: ["cleanup", "log", "anti-forensics"],
        full: ["penetration-test", "red-team", "full-scope"],
      };

      const envKeywords: Record<string, string[]> = {
        web: ["web-application", "pentest", "burp"],
        internal_network: ["internal-network", "active-directory", "lateral"],
        active_directory: ["active-directory", "ad", "kerberoasting", "bloodhound"],
        cloud: ["cloud", "aws", "azure", "gcp", "pacu"],
        mobile: ["mobile", "android", "ios", "frida"],
      };

      const keywords = [
        ...(phase ? (phaseKeywords[phase] ?? [phase]) : ["penetration-test"]),
        ...(environment ? (envKeywords[environment] ?? [environment]) : []),
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Penetration Test", params, keywords) }],
          details: { target, phase, environment, framework, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Penetration Test", skill, params) }],
        details: { target, phase, environment, framework, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 3. incident_response ────────────────────────────────────────────────

  pi.registerTool({
    name: "incident_response",
    label: "Incident Response",
    description:
      "安全事件响应工作流：检测确认 → 遏制 → 根除 → 恢复 → 事后总结。" +
      "覆盖勒索软件、钓鱼、数据泄露、APT 入侵等场景。",
    promptSnippet: "Execute incident response workflow — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 incident_response 处理安全事件时，指定 incident_type 和 phase",
    ],
    parameters: Type.Object({
      incident_type: StringEnum(INCIDENT_TYPES, { description: "事件类型" }),
      phase: Type.Optional(StringEnum(IR_PHASES)),
      severity: Type.Optional(SeverityEnum),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { incident_type, phase, severity } = params;

      const typeKeywords: Record<string, string[]> = {
        ransomware: ["ransomware", "recovery", "encryption"],
        phishing: ["phishing", "email", "spearphishing", "business-email-compromise"],
        data_breach: ["data-breach", "exfiltration", "dlp"],
        apt_intrusion: ["apt", "advanced-persistent", "threat-actor"],
        insider_threat: ["insider-threat", "insider", "ueba"],
        ddos: ["ddos", "denial-of-service", "cloudflare"],
        malware_outbreak: ["malware", "outbreak", "containment", "eradication"],
        account_compromise: ["account-compromise", "credential", "oauth"],
        cloud_incident: ["cloud-incident", "cloud-forensics", "cloudtrail"],
        unknown: ["incident-response", "triage", "investigation"],
      };

      const keywords = [
        ...(typeKeywords[incident_type] ?? [incident_type]),
        ...(phase ? [phase] : []),
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Incident Response", params, keywords) }],
          details: { incident_type, phase, severity, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Incident Response", skill, params) }],
        details: { incident_type, phase, severity, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 4. threat_hunt ──────────────────────────────────────────────────────

  pi.registerTool({
    name: "threat_hunt",
    label: "Threat Hunt",
    description:
      "主动威胁狩猎：假设驱动、IOC 搜索、行为分析、异常检测。" +
      "覆盖 C2 信标、横向移动、权限维持、数据窃取等 TTP。",
    promptSnippet: "Proactive threat hunting — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 threat_hunt 进行威胁狩猎时，指定 environment 和 technique",
    ],
    parameters: Type.Object({
      environment: StringEnum(HUNT_ENVS, { description: "狩猎环境" }),
      technique: Type.Optional(StringEnum(HUNT_TECHNIQUES)),
      hypothesis: Type.Optional(Type.String()),
      time_range: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { environment, technique, hypothesis, time_range } = params;

      const techniqueKeywords: Record<string, string[]> = {
        c2_beaconing: ["beaconing", "c2", "command-and-control", "cobalt-strike"],
        lateral_movement: ["lateral-movement", "wmi", "dcom"],
        persistence: ["persistence", "registry", "scheduled-task", "wmi"],
        exfiltration: ["exfiltration", "dns-tunneling", "data-staging"],
        privilege_escalation: ["privilege-escalation", "privesc"],
        defense_evasion: ["defense-evasion", "timestomping", "living-off-the-land"],
        credential_access: ["credential-dumping", "mimikatz", "dcsync"],
        initial_access: ["initial-access", "phishing", "spearphishing"],
        all: ["threat-hunt", "hunting"],
      };

      const keywords = [
        ...(technique ? (techniqueKeywords[technique] ?? [technique]) : ["threat-hunt"]),
        environment,
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Threat Hunt", params, keywords) }],
          details: { environment, technique, hypothesis, time_range, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Threat Hunt", skill, params) }],
        details: { environment, technique, hypothesis, time_range, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 5. malware_analysis ─────────────────────────────────────────────────

  pi.registerTool({
    name: "malware_analysis",
    label: "Malware Analysis",
    description:
      "恶意软件分析工作流：静态分析 → 动态分析 → 逆向工程 → IOC 提取 → 家族归类。" +
      "覆盖 PE/ELF/Mach-O、宏病毒、脚本、移动端。",
    promptSnippet: "Analyze malware samples — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 malware_analysis 分析恶意软件时，指定 sample_path 和 analysis_type",
    ],
    parameters: Type.Object({
      sample_path: Type.String({ description: "恶意软件样本路径或哈希值" }),
      analysis_type: Type.Optional(StringEnum(MALWARE_TYPES)),
      platform: Type.Optional(StringEnum(MALWARE_PLATFORMS)),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { sample_path, analysis_type, platform } = params;

      const typeKeywords: Record<string, string[]> = {
        static: ["static-malware-analysis", "pe-studio", "yara", "triage"],
        dynamic: ["dynamic-analysis", "sandbox", "cuckoo", "any-run", "cape"],
        reverse_engineering: ["reverse-engineering", "ghidra", "jadx", "dnspy"],
        full: ["malware-analysis", "malware"],
      };

      const platformKeywords: Record<string, string[]> = {
        windows: ["windows", "pe", "dotnet", "powershell"],
        linux: ["linux", "elf"],
        macos: ["macos", "mach-o"],
        android: ["android", "apk", "jadx"],
        ios: ["ios", "frida"],
        unknown: [],
      };

      const keywords = [
        ...(analysis_type ? (typeKeywords[analysis_type] ?? [analysis_type]) : ["malware"]),
        ...(platform ? (platformKeywords[platform] ?? [platform]) : []),
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Malware Analysis", params, keywords) }],
          details: { sample_path, analysis_type, platform, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Malware Analysis", skill, params) }],
        details: { sample_path, analysis_type, platform, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 6. cloud_security_audit ─────────────────────────────────────────────

  pi.registerTool({
    name: "cloud_security_audit",
    label: "Cloud Security Audit",
    description:
      "云安全审计：IAM 权限审查、存储桶配置、网络 ACL、K8s 安全、Serverless 安全。" +
      "覆盖 AWS、Azure、GCP。",
    promptSnippet: "Audit cloud security — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 cloud_security_audit 审计云环境时，指定 provider 和 scope",
    ],
    parameters: Type.Object({
      provider: StringEnum(CLOUD_PROVIDERS, { description: "云提供商" }),
      scope: Type.Array(StringEnum(CLOUD_SCOPES), { description: "审计范围" }),
      compliance: Type.Optional(StringEnum(CLOUD_COMPLIANCE)),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { provider, scope, compliance } = params;

      const scopeKeywords: Record<string, string[]> = {
        iam: ["iam", "permissions", "privilege-escalation", "identity"],
        storage: ["storage", "s3", "bucket", "misconfiguration"],
        network: ["network", "vpc", "firewall", "security-group"],
        compute: ["compute", "ec2", "vm", "instance"],
        kubernetes: ["kubernetes", "k8s", "eks", "aks", "gke", "rbac"],
        serverless: ["serverless", "lambda", "function"],
        database: ["database", "rds", "encryption"],
        logging: ["logging", "cloudtrail", "audit-log", "monitoring"],
        secrets: ["secrets", "kms", "vault", "key-management"],
      };

      const keywords = [
        provider,
        ...scope.flatMap(s => scopeKeywords[s] ?? [s]),
        ...(compliance ? [compliance] : []),
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Cloud Security Audit", params, keywords) }],
          details: { provider, scope, compliance, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Cloud Security Audit", skill, params) }],
        details: { provider, scope, compliance, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 7. compliance_audit ─────────────────────────────────────────────────

  pi.registerTool({
    name: "compliance_audit",
    label: "Compliance Audit",
    description:
      "合规审计与治理：ISO 27001、SOC 2、PCI DSS、HIPAA、GDPR、NIST CSF、CMMC。" +
      "差距分析、控制映射、证据收集。",
    promptSnippet: "Audit compliance against frameworks — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 compliance_audit 进行合规审计时，指定 framework 和 scope",
    ],
    parameters: Type.Object({
      framework: StringEnum(COMPLIANCE_FRAMEWORKS, { description: "合规框架" }),
      scope: Type.Optional(StringEnum(COMPLIANCE_SCOPES)),
      target_system: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { framework, scope, target_system } = params;

      const frameworkKeywords: Record<string, string[]> = {
        iso_27001: ["iso-27001", "isms"],
        soc2: ["soc2", "soc-2"],
        pci_dss: ["pci-dss", "pci"],
        hipaa: ["hipaa"],
        gdpr: ["gdpr", "data-protection"],
        nist_csf: ["nist-csf", "nist", "maturity"],
        nist_800_53: ["nist-800-53", "rmf"],
        cmmc: ["cmmc"],
        cis_controls: ["cis", "benchmark"],
        iec_62443: ["iec-62443", "ics", "ot"],
      };

      const keywords = [
        ...(frameworkKeywords[framework] ?? [framework]),
        ...(scope ? [scope] : []),
        "compliance",
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Compliance Audit", params, keywords) }],
          details: { framework, scope, target_system, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Compliance Audit", skill, params) }],
        details: { framework, scope, target_system, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 8. security_hardening ───────────────────────────────────────────────

  pi.registerTool({
    name: "security_hardening",
    label: "Security Hardening",
    description:
      "系统安全加固：OS 加固、容器加固、网络加固、应用加固、AD 加固。" +
      "基于 CIS Benchmark、STIG、最佳实践。",
    promptSnippet: "Harden systems — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 security_hardening 加固系统时，指定 target 和 benchmark",
    ],
    parameters: Type.Object({
      target: Type.String({ description: "加固目标：系统路径、容器名、服务名" }),
      target_type: StringEnum(HARDENING_TARGETS, { description: "目标类型" }),
      benchmark: Type.Optional(StringEnum(HARDENING_BENCHMARKS)),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { target, target_type, benchmark } = params;

      const typeKeywords: Record<string, string[]> = {
        linux_server: ["linux", "hardening", "cis-benchmark", "endpoint"],
        windows_server: ["windows", "hardening", "cis-benchmark", "endpoint"],
        docker_container: ["docker", "container", "hardening", "daemon"],
        kubernetes_cluster: ["kubernetes", "k8s", "hardening", "pod-security"],
        web_server: ["web-server", "nginx", "apache", "iis", "hardening"],
        database: ["database", "hardening", "encryption"],
        active_directory: ["active-directory", "ad", "tiered-model", "ldap"],
        network_device: ["network", "firewall", "segmentation", "pfsense"],
      };

      const keywords = [
        ...(typeKeywords[target_type] ?? [target_type]),
        ...(benchmark ? [benchmark] : ["hardening"]),
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Security Hardening", params, keywords) }],
          details: { target, target_type, benchmark, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Security Hardening", skill, params) }],
        details: { target, target_type, benchmark, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 9. detection_engineering ────────────────────────────────────────────

  pi.registerTool({
    name: "detection_engineering",
    label: "Detection Engineering",
    description:
      "检测工程：Sigma/YARA 规则编写、SIEM 用例设计、告警调优、SOAR 剧本。" +
      "基于 MITRE ATT&CK 映射。",
    promptSnippet: "Build detection rules — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 detection_engineering 构建检测时，指定 technique 和 rule_type",
    ],
    parameters: Type.Object({
      technique: Type.String({ description: "MITRE ATT&CK 技术 ID，如 T1059.001、T1003.001" }),
      rule_type: StringEnum(DETECTION_RULE_TYPES, { description: "规则类型" }),
      environment: Type.Optional(StringEnum(DETECTION_ENVS)),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { technique, rule_type, environment } = params;

      const ruleKeywords: Record<string, string[]> = {
        sigma: ["sigma", "detection-rule", "splunk"],
        yara: ["yara", "malware", "detection"],
        splunk_spl: ["splunk", "spl", "siem"],
        elastic_query: ["elastic", "kql", "eql", "hunting"],
        sentinel_kql: ["sentinel", "kql", "azure"],
        suricata: ["suricata", "ids", "network"],
        zeek: ["zeek", "network", "traffic-analysis"],
      };

      const keywords = [
        technique,
        ...(ruleKeywords[rule_type] ?? [rule_type]),
        ...(environment ? [environment] : []),
        "detection",
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Detection Engineering", params, keywords) }],
          details: { technique, rule_type, environment, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Detection Engineering", skill, params) }],
        details: { technique, rule_type, environment, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── 10. forensic_analysis ───────────────────────────────────────────────

  pi.registerTool({
    name: "forensic_analysis",
    label: "Forensic Analysis",
    description:
      "数字取证分析：磁盘取证、内存取证、网络取证、日志分析、时间线重建。" +
      "覆盖 Windows/Linux/macOS。",
    promptSnippet: "Perform digital forensics — loads relevant cybersec skill",
    promptGuidelines: [
      "使用 forensic_analysis 进行取证时，指定 evidence_type 和 target",
    ],
    parameters: Type.Object({
      evidence_type: StringEnum(FORENSIC_EVIDENCE_TYPES, { description: "证据类型" }),
      target: Type.String({ description: "证据文件路径" }),
      objective: Type.Optional(StringEnum(FORENSIC_OBJECTIVES)),
    }),
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const { evidence_type, target, objective } = params;

      const evidenceKeywords: Record<string, string[]> = {
        disk_image: ["disk", "forensics", "autopsy", "image", "file-carving"],
        memory_dump: ["memory", "volatility", "dump", "rekall"],
        network_capture: ["network", "pcap", "wireshark", "zeek", "tshark"],
        log_files: ["log", "forensics", "audit", "syslog", "event-log"],
        registry_hive: ["registry", "windows", "artifact", "eric-zimmerman"],
        email_archive: ["email", "pst", "phishing", "header"],
        mobile_device: ["mobile", "cellebrite", "android", "ios"],
        cloud_logs: ["cloud", "cloudtrail", "athena", "azure-activity"],
      };

      const keywords = [
        ...(evidenceKeywords[evidence_type] ?? [evidence_type]),
        ...(objective ? [objective] : ["forensic"]),
      ];

      onUpdate?.({ content: [{ type: "text", text: `Searching for best-matching skill...` }] });

      const skill = findBestSkill(keywords);

      if (!skill) {
        return {
          content: [{ type: "text", text: formatNoSkillFound("Forensic Analysis", params, keywords) }],
          details: { evidence_type, target, objective, skillFound: false },
        };
      }

      return {
        content: [{ type: "text", text: formatSkillOutput("Forensic Analysis", skill, params) }],
        details: { evidence_type, target, objective, skillFound: true, skillDir: skill.dir },
      };
    },
  });

  // ── /cybersec-list command ──────────────────────────────────────────────

  pi.registerCommand("cybersec-list", {
    description: "List available cybersecurity skills matching a keyword",
    handler: async (args, ctx) => {
      if (!skillsAvailable) {
        ctx.ui.notify(
          `Skills library not found at ${skillsPath}. Clone it first:\n` +
          `git clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills ${skillsPath}/..`,
          "error",
        );
        return;
      }

      const keyword = args?.trim() || "";
      const skills = keyword
        ? listMatchingSkills([keyword])
        : fs.readdirSync(skillsPath, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

      if (skills.length === 0) {
        ctx.ui.notify(`No skills found matching "${keyword}"`, "info");
        return;
      }

      ctx.ui.notify(
        `${skills.length} skills${keyword ? ` matching "${keyword}"` : ""}:\n` +
        skills.slice(0, 20).join("\n") +
        (skills.length > 20 ? `\n... and ${skills.length - 20} more` : ""),
        "info",
      );
    },
  });

  // ── Startup notification ─────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (skillsAvailable) {
      const count = fs.readdirSync(skillsPath, { withFileTypes: true })
        .filter(d => d.isDirectory()).length;
      ctx.ui.notify(
        `🛡️ pi-cybersec loaded — 10 tools + ${count} skills from Anthropic-Cybersecurity-Skills`,
        "info",
      );
    } else {
      ctx.ui.notify(
        `🛡️ pi-cybersec loaded — 10 tools (skills library not found at ${skillsPath})`,
        "warning",
      );
    }
  });
}
