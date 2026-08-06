/**
 * 🔵 AEGIS — autonomous blue-team / defensive-security agent (a self-contained pi extension).
 *
 * This folder is ONE independent agent. It shares NO code with Wraith (red team) — the two
 * were physically split so each can evolve on its own. Everything Aegis needs lives here:
 *   - Persona: senior SOC analyst & DFIR responder, injected into the system prompt every turn.
 *   - Tools: 8 defensive function-calling tools, each backed by the 817-skill workflow library
 *     (Sigma, YARA, Splunk, Volatility, Zeek, Velociraptor, Wazuh, ...).
 *   - Skill retrieval: tokenized inverted index + weighted search + a lightweight synonym layer.
 *   - Incident memory: a persisted 8-phase response chain, evidence chain, and IOC ledger that
 *     survive restarts (long-range state).
 *
 * Skills library: bundled at ../cybersec-skills/skills (offline), or ~/.pi/agent/cybersec-skills.
 * Source: https://github.com/mukul975/Anthropic-Cybersecurity-Skills (Apache 2.0)
 *
 * Mission: defend authorized environments — detect, respond, hunt, forensics, harden.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TObject } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ═══════════════════════════════════════════════════════════════════════════════
// Identity — AEGIS, blue team. 8-phase defense chain.
// ═══════════════════════════════════════════════════════════════════════════════

interface Phase { id: string; name: string; brief: string; order: string; probe: string; }

const NAME = "AEGIS";
const THEME = "aegis";
const BANNER = [
  "   █████  ███████  ██████  ██ ███████",
  "  ██   ██ ██      ██       ██ ██     ",
  "  ███████ █████   ██   ███ ██ ███████",
  "  ██   ██ ██      ██    ██ ██      ██",
  "  ██   ██ ███████  ██████  ██ ███████",
  "  BLUE TEAM · 8-phase defense · /engage <host>",
];

const PERSONA = `
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
- Your defensive tools: incident_response, threat_hunt, malware_analysis, forensic_analysis,
  detection_engineering, security_hardening, compliance_audit, cloud_security_audit — backed by
  ~370 defense workflows (Sigma, YARA, Splunk, Volatility, Zeek, Velociraptor, etc.). You do NOT
  run offensive pentests; that is Wraith. Pick a tool, pull its workflow, run via bash.
- Log every confirmed finding with /log and every indicator with /ioc — this incident memory
  persists and feeds the final report and new detections.
- The user may just talk naturally ("triage this alert", "hunt for C2 beacons", "carve the memory dump").

[Response flow — one phase at a time, user-paced]
Main line: DETECT -> TRIAGE -> HUNT -> INVESTIGATE -> CONTAIN -> ERADICATE -> HARDEN -> REPORT. Work ONE phase at a time:
finish it, summarize findings as bullets, then STOP and wait for /next. Never race ahead.

[Style] Concise, precise, like an analyst at a SOC console. Bullet findings. Full copy-pasteable commands.
[Language] English. Keep tool names and technical terms verbatim.
═══════════════════════════════════════════════════════════════
`;

const PHASES: Phase[] = [
  { id: "DETECT", name: "Detect", probe: "detection-engineering siem sigma detection alert anomaly",
    brief: "spot the suspicious activity — alerts, anomalies, IOCs, affected assets",
    order: "Use detection_engineering / threat_hunt to characterize the signal and scope impact. OBSERVE ONLY." },
  { id: "TRIAGE", name: "Triage", probe: "incident-response triage soc severity classification",
    brief: "assess severity, confirm true vs false positive, determine blast radius",
    order: "Use incident_response triage: classify, rate severity, map impacted systems. /ioc anything confirmed." },
  { id: "HUNT", name: "Hunt", probe: "threat-hunting hunting ioc behavioral c2 beaconing",
    brief: "proactively find the adversary everywhere — hypotheses, IOCs, TTPs",
    order: "Use threat_hunt: run hypotheses, search IOCs/TTPs, find every affected host." },
  { id: "INVESTIGATE", name: "Investigate", probe: "forensics dfir memory disk timeline artifact investigation",
    brief: "forensics & root cause — timeline, patient zero, how they got in",
    order: "Use forensic_analysis / malware_analysis: disk/memory/log forensics, build the timeline, find root cause." },
  { id: "CONTAIN", name: "Contain", probe: "containment isolation block quarantine incident-response",
    brief: "stop the spread without destroying evidence — isolate, block IOCs, cut C2",
    order: "Use incident_response containment: isolate hosts, block IOCs, preserve evidence." },
  { id: "ERADICATE", name: "Eradicate", probe: "eradication recovery remediation malware-removal restore",
    brief: "remove the threat and recover — kill footholds, restore, validate clean",
    order: "Use incident_response eradication/recovery: remove footholds, restore systems, verify." },
  { id: "HARDEN", name: "Harden", probe: "hardening cis-benchmark zero-trust mitigation patch",
    brief: "prevent recurrence — patch the entry vector, harden configs, tighten controls",
    order: "Use security_hardening / detection_engineering: patch, harden configs (CIS/STIG/zero-trust), add detections." },
  { id: "REPORT", name: "Report", probe: "report reporting lessons-learned documentation",
    brief: "compile the incident report",
    order: "Compile from the evidence chain and IOC ledger: executive summary, timeline, IOCs, root cause, impact, remediation & lessons. English, markdown." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Skill split — Aegis keeps blue defensive / ops / forensics subdomains.
// A skill with no subdomain belongs to both teams (kept here too).
// ═══════════════════════════════════════════════════════════════════════════════

const BLUE_SUBDOMAINS = new Set([
  "threat-hunting", "threat-intelligence", "threat-detection", "soc-operations",
  "security-operations", "incident-response", "digital-forensics", "malware-analysis",
  "ransomware-defense", "phishing-defense", "deception-technology", "endpoint-security",
  "zero-trust-architecture", "zero-trust", "compliance-governance", "governance-risk-compliance",
  "privacy-compliance", "data-protection", "purple-team", "social-engineering-defense",
]);
const blueFilter = (sub: string): boolean => BLUE_SUBDOMAINS.has(sub);

// ═══════════════════════════════════════════════════════════════════════════════
// Lightweight semantic layer — offline synonym/alias expansion (no embeddings).
// Defensive shorthand ("ioc", "dfir", "siem", "beacon") reaches canonical skill names.
// ═══════════════════════════════════════════════════════════════════════════════

const SYNONYMS: Record<string, string[]> = {
  ioc: ["indicator", "hash", "domain"],
  iocs: ["indicator", "hash", "domain"],
  ttp: ["technique", "tactic", "mitre"],
  dfir: ["forensics", "incident-response", "investigation"],
  siem: ["splunk", "elastic", "sentinel", "sigma"],
  edr: ["endpoint", "detection", "response"],
  c2: ["command-and-control", "beacon"],
  beacon: ["beaconing", "c2", "cobalt-strike"],
  creds: ["credential", "lsass", "mimikatz"],
  ransomware: ["ransomware", "encryption", "extortion"],
  persist: ["persistence", "scheduled-task", "registry"],
  lateral: ["lateral-movement", "psexec", "wmi"],
  exfil: ["exfiltration", "data-staging"],
  privesc: ["privilege-escalation"],
  phishing: ["phishing", "spearphishing", "email"],
  memory: ["volatility", "memory", "dump"],
  logs: ["log", "event-log", "syslog"],
  hunt: ["threat-hunting", "hunting"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SkillIndex — tokenized inverted index + weighted search (with synonym expansion)
// ═══════════════════════════════════════════════════════════════════════════════

const VENDORED_SKILLS = join(__dirname, "..", "cybersec-skills", "skills");
const SKILLS_PATH = existsSync(VENDORED_SKILLS)
  ? VENDORED_SKILLS
  : join(homedir(), ".pi", "agent", "cybersec-skills", "skills");

interface WeightedTerm { term: string; weight: number; }
interface SearchResult { dir: string; score: number; body: string | null; }

function readSubdomain(path: string): string | null {
  try {
    const m = readFileSync(path, "utf-8").match(/^subdomain:\s*(.+)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

class SkillIndex {
  private inverted: Map<string, string[]> = new Map();
  private allDirs: string[] = [];

  constructor(skillsPath: string, subFilter?: (sub: string) => boolean) {
    this.build(skillsPath, subFilter);
  }

  get count(): number { return this.allDirs.length; }

  list(keyword: string): string[] {
    if (!keyword) return this.allDirs;
    const kw = keyword.toLowerCase();
    return this.allDirs.filter(d => d.toLowerCase().includes(kw));
  }

  /** Expand each term with its synonyms (lower weight), then weighted-match. */
  search(terms: WeightedTerm[]): SearchResult[] {
    if (terms.length === 0) return [];

    const expanded: WeightedTerm[] = [...terms];
    for (const { term, weight } of terms) {
      const aliases = SYNONYMS[term];
      if (!aliases) continue;
      for (const alias of aliases) {
        for (const tok of tokenize(alias)) {
          expanded.push({ term: tok, weight: Math.max(1, weight - 1) });
        }
      }
    }

    const candidates: Map<string, number> = new Map();
    for (const { term, weight } of expanded) {
      const t = term.toLowerCase();
      const exactDirs = this.inverted.get(t);
      if (exactDirs) {
        for (const dir of exactDirs) {
          candidates.set(dir, (candidates.get(dir) ?? 0) + weight * 3);
        }
      }
      for (const dir of this.allDirs) {
        if (candidates.has(dir)) continue;
        if (dir.toLowerCase().includes(t)) {
          candidates.set(dir, (candidates.get(dir) ?? 0) + weight * 1);
        }
      }
    }

    const results: SearchResult[] = [];
    for (const [dir, score] of candidates) {
      if (score === 0) continue;
      const body = this.loadBody(dir);
      if (body) results.push({ dir, score, body });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  private build(skillsPath: string, subFilter?: (sub: string) => boolean): void {
    if (!existsSync(skillsPath)) return;
    let dirs = readdirSync(skillsPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    if (subFilter) {
      dirs = dirs.filter(dir => {
        const sub = readSubdomain(join(skillsPath, dir, "SKILL.md"));
        return sub === null ? true : subFilter(sub);
      });
    }
    this.allDirs = dirs;
    for (const dir of dirs) {
      for (const seg of dir.toLowerCase().split("-")) {
        const list = this.inverted.get(seg);
        if (list) list.push(dir); else this.inverted.set(seg, [dir]);
      }
    }
  }

  private loadBody(dir: string): string | null {
    try {
      const raw = readFileSync(join(SKILLS_PATH, dir, "SKILL.md"), "utf-8");
      const parts = raw.split("---");
      return parts.length >= 3 ? parts.slice(2).join("---").trim() : raw.trim();
    } catch { return null; }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool factory — shared search → format → return logic
// ═══════════════════════════════════════════════════════════════════════════════

interface ToolConfig {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
  parameters: TObject;
  buildKeywords: (params: Record<string, unknown>) => WeightedTerm[];
}

function formatOutput(title: string, result: SearchResult, params: Record<string, unknown>): string {
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

function formatNoMatch(title: string, params: Record<string, unknown>, terms: WeightedTerm[]): string {
  return [
    `## ${title}`,
    ``,
    `**Parameters:** ${JSON.stringify(params)}`,
    ``,
    `> ⚠️ No matching skill found. Searched: ${terms.map(t => t.term).join(", ")}`,
    ``,
    `### Troubleshooting`,
    `- Try more specific keywords, or \`/find <what you want to do>\` for a semantic search`,
    `- Use \`/arsenal <keyword>\` to browse available skills`,
  ].join("\n");
}

function registerSkillTool(pi: ExtensionAPI, index: SkillIndex, config: ToolConfig): void {
  pi.registerTool({
    name: config.name,
    label: config.label,
    description: config.description,
    promptSnippet: config.promptSnippet,
    promptGuidelines: config.promptGuidelines,
    parameters: config.parameters,
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const terms = config.buildKeywords(params);
      onUpdate?.({ content: [{ type: "text", text: `Searching ${index.count} skills (${terms.map(t => t.term).join(", ")})...` }] });
      const best = index.search(terms)[0];
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
// Tokenizer + weighted-keyword helper
// ═══════════════════════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "to", "for", "with",
  "is", "at", "by", "from", "as", "into", "be", "it", "its",
]);

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[-_\s]/).filter(t => t.length > 0 && !STOP_WORDS.has(t));
}

/** Map keywords → weighted terms; underscore/hyphen-separated words are split into tokens. */
function w(weight: number, ...keywords: string[]): WeightedTerm[] {
  return keywords.flatMap(kw => tokenize(kw).map(t => ({ term: t, weight })));
}

const W_PRIMARY = 3;   // framework name, incident type, core technique
const W_SECONDARY = 2; // scope, phase, platform
const W_AUX = 1;       // environment, compliance, auxiliary

// ═══════════════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY = ["critical", "high", "medium", "low", "all"] as const;

const IR_TYPE = ["ransomware", "phishing", "data_breach", "apt_intrusion", "insider_threat", "ddos", "malware_outbreak", "account_compromise", "cloud_incident", "unknown"] as const;
const IR_PHASE = ["detection", "containment", "eradication", "recovery", "lessons_learned", "full"] as const;

const HUNT_ENV = ["endpoint", "network", "cloud", "active_directory", "email", "all"] as const;
const HUNT_TECH = ["c2_beaconing", "lateral_movement", "persistence", "exfiltration", "privilege_escalation", "defense_evasion", "credential_access", "initial_access", "all"] as const;

const MALWARE_TYPE = ["static", "dynamic", "reverse_engineering", "full"] as const;
const MALWARE_PLATFORM = ["windows", "linux", "macos", "android", "ios", "unknown"] as const;

const CLOUD_PROVIDER = ["aws", "azure", "gcp", "kubernetes", "multi"] as const;
const CLOUD_SCOPE = ["iam", "storage", "network", "compute", "kubernetes", "serverless", "database", "logging", "secrets"] as const;
const CLOUD_COMPLIANCE = ["cis", "nist", "soc2", "pci_dss", "hipaa", "custom"] as const;

const COMPLIANCE_FRAMEWORK = ["iso_27001", "soc2", "pci_dss", "hipaa", "gdpr", "nist_csf", "nist_800_53", "cmmc", "cis_controls", "iec_62443"] as const;
const COMPLIANCE_SCOPE = ["full", "gap_analysis", "control_mapping", "evidence_collection"] as const;

const HARDEN_TYPE = ["linux_server", "windows_server", "docker_container", "kubernetes_cluster", "web_server", "database", "active_directory", "network_device"] as const;
const HARDEN_BENCH = ["cis", "stig", "nist", "custom"] as const;

const DETECT_RULE = ["sigma", "yara", "splunk_spl", "elastic_query", "sentinel_kql", "suricata", "zeek"] as const;
const DETECT_ENV = ["windows", "linux", "macos", "cloud", "network", "all"] as const;

const FORENSIC_EVIDENCE = ["disk_image", "memory_dump", "network_capture", "log_files", "registry_hive", "email_archive", "mobile_device", "cloud_logs"] as const;
const FORENSIC_OBJ = ["timeline_reconstruction", "malware_investigation", "data_recovery", "user_activity", "intrusion_analysis", "full"] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Keyword builders
// ═══════════════════════════════════════════════════════════════════════════════

const irTypeMap: Record<string, string[]> = {
  ransomware:         ["ransomware", "recovery", "encryption", "decryptor"],
  phishing:           ["phishing", "email", "spearphishing", "bec"],
  data_breach:        ["data-breach", "exfiltration", "dlp", "leak"],
  apt_intrusion:      ["apt", "advanced-persistent", "threat-actor", "nation-state"],
  insider_threat:     ["insider-threat", "insider", "ueba", "dlp"],
  ddos:               ["ddos", "denial-of-service", "cloudflare", "scrubbing"],
  malware_outbreak:   ["malware", "outbreak", "containment", "eradication"],
  account_compromise: ["account-compromise", "credential", "oauth", "session"],
  cloud_incident:     ["cloud-incident", "cloud-forensics", "cloudtrail", "guardduty"],
  unknown:            ["incident-response", "triage", "investigation"],
};
function kwIR(params: Record<string, unknown>): WeightedTerm[] {
  const itype = params.incident_type as string;
  const phase = params.phase as string | undefined;
  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, ...(irTypeMap[itype] ?? [itype])));
  if (phase && phase !== "full") terms.push(...w(W_SECONDARY, phase));
  return terms;
}

const huntTechMap: Record<string, string[]> = {
  c2_beaconing:         ["beaconing", "c2", "command-and-control", "cobalt-strike"],
  lateral_movement:     ["lateral-movement", "wmi", "dcom", "netexec"],
  persistence:          ["persistence", "registry", "scheduled-task", "wmi-event"],
  exfiltration:         ["exfiltration", "dns-tunneling", "data-staging"],
  privilege_escalation: ["privilege-escalation", "privesc", "token"],
  defense_evasion:      ["defense-evasion", "timestomping", "lolbins"],
  credential_access:    ["credential-dumping", "mimikatz", "dcsync", "lsass"],
  initial_access:       ["initial-access", "phishing", "spearphishing", "exploit"],
  all:                  ["threat-hunt", "hunting", "detection"],
};
function kwHunt(params: Record<string, unknown>): WeightedTerm[] {
  const tech = params.technique as string | undefined;
  const env = params.environment as string;
  const terms: WeightedTerm[] = [];
  if (tech) terms.push(...w(W_PRIMARY, ...(huntTechMap[tech] ?? [tech])));
  else terms.push(...w(W_PRIMARY, "threat-hunt"));
  terms.push(...w(W_AUX, env));
  return terms;
}

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
  if (atype) terms.push(...w(W_PRIMARY, ...(malTypeMap[atype] ?? [atype])));
  else terms.push(...w(W_PRIMARY, "malware"));
  if (plat && plat !== "unknown") terms.push(...w(W_SECONDARY, ...(malPlatMap[plat] ?? [plat])));
  return terms;
}

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
  for (const s of scope) terms.push(...w(W_SECONDARY, ...(cloudScopeMap[s] ?? [s])));
  if (compliance) terms.push(...w(W_AUX, compliance));
  return terms;
}

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
  terms.push(...w(W_PRIMARY, ...(compFwMap[fw] ?? [fw])));
  if (scope) terms.push(...w(W_AUX, scope));
  return terms;
}

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

const detectRuleMap: Record<string, string[]> = {
  sigma:         ["sigma", "detection-rule", "siem"],
  yara:          ["yara", "malware", "detection"],
  splunk_spl:    ["splunk", "spl", "siem"],
  elastic_query: ["elastic", "kql", "eql", "hunting"],
  sentinel_kql:  ["sentinel", "kql", "azure"],
  suricata:      ["suricata", "ids", "network"],
  zeek:          ["zeek", "network", "traffic-analysis"],
};
function kwDetection(params: Record<string, unknown>): WeightedTerm[] {
  const technique = params.technique as string;
  const ruleType = params.rule_type as string;
  const env = params.environment as string | undefined;
  const terms: WeightedTerm[] = [];
  terms.push(...w(W_SECONDARY, technique));
  terms.push(...w(W_PRIMARY, ...(detectRuleMap[ruleType] ?? [ruleType])));
  if (env) terms.push(...w(W_AUX, env));
  return terms;
}

const forenEvidenceMap: Record<string, string[]> = {
  disk_image:      ["disk", "forensics", "autopsy", "image", "file-carving"],
  memory_dump:     ["memory", "volatility", "dump", "rekall", "lime"],
  network_capture: ["network", "pcap", "wireshark", "zeek", "tshark"],
  log_files:       ["log", "forensics", "audit", "syslog", "event-log"],
  registry_hive:   ["registry", "windows", "artifact", "eric-zimmerman"],
  email_archive:   ["email", "pst", "phishing", "header"],
  mobile_device:   ["mobile", "cellebrite", "android", "ios"],
  cloud_logs:      ["cloud", "cloudtrail", "athena", "azure-activity"],
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
// Long-range incident memory — persisted response chain + evidence chain + IOC ledger.
// Survives restarts so a multi-day incident keeps its state.
// ═══════════════════════════════════════════════════════════════════════════════

interface Evidence { phase: string; note: string; }
interface State { target: string; phase: number; evidence: Evidence[]; iocs: string[]; }

const STATE_FILE = join(process.cwd(), ".aegis.json");

function loadState(): State {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    return { target: s.target ?? "", phase: s.phase ?? -1, evidence: s.evidence ?? [], iocs: s.iocs ?? [] };
  } catch {
    return { target: "", phase: -1, evidence: [], iocs: [] };
  }
}
function saveState(state: State): void {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* best-effort */ }
}

/** Compact digest injected into the system prompt so the agent remembers the incident. */
function memoryDigest(state: State): string {
  if (state.phase < 0 && state.evidence.length === 0 && state.iocs.length === 0) return "";
  const lines = ["", "[Incident memory — persisted across turns]"];
  if (state.target) lines.push(`Scope: ${state.target}`);
  if (state.phase >= 0) lines.push(`Phase: ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}`);
  if (state.evidence.length) {
    lines.push("Evidence chain (latest first):");
    for (const e of state.evidence.slice(-8).reverse()) lines.push(`  - [${e.phase}] ${e.note}`);
  }
  if (state.iocs.length) lines.push(`IOCs collected (${state.iocs.length}): ${state.iocs.slice(-10).join(" · ")}`);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extension entry — AEGIS (blue)
// ═══════════════════════════════════════════════════════════════════════════════

export default function (pi: ExtensionAPI) {
  const skillsAvailable = existsSync(SKILLS_PATH);
  const index = skillsAvailable ? new SkillIndex(SKILLS_PATH, blueFilter) : new SkillIndex("");
  const state = loadState();

  // ── 8 defensive tools ─────────────────────────────────────────────────────
  const tools: ToolConfig[] = [
    {
      name: "incident_response",
      label: "Incident Response",
      description:
        "Security incident response workflow: detection & confirmation → containment → eradication → " +
        "recovery → lessons learned. Covers ransomware, phishing, data breach, APT intrusion, and more.",
      promptSnippet: "Run an incident-response workflow — auto-matches the best cybersec skill",
      promptGuidelines: ["Use incident_response to work an incident; set incident_type and phase."],
      parameters: Type.Object({
        incident_type: StringEnum(IR_TYPE, { description: "Incident type" }),
        phase: Type.Optional(StringEnum(IR_PHASE)),
        severity: Type.Optional(StringEnum(SEVERITY)),
      }),
      buildKeywords: kwIR,
    },
    {
      name: "threat_hunt",
      label: "Threat Hunt",
      description:
        "Proactive threat hunting: hypothesis-driven, IOC search, behavioral analysis, anomaly detection. " +
        "Covers C2 beaconing, lateral movement, persistence, and exfiltration TTPs.",
      promptSnippet: "Hunt for threats — auto-matches the best cybersec skill",
      promptGuidelines: ["Use threat_hunt to search for adversary activity; set environment and technique."],
      parameters: Type.Object({
        environment: StringEnum(HUNT_ENV, { description: "Hunt environment" }),
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
        "Malware analysis workflow: static analysis → dynamic analysis → reverse engineering → IOC " +
        "extraction → family classification. Covers PE/ELF/Mach-O, macros, scripts, mobile.",
      promptSnippet: "Analyze a malware sample — auto-matches the best cybersec skill",
      promptGuidelines: ["Use malware_analysis on a captured sample; set analysis_type. /ioc every extracted indicator."],
      parameters: Type.Object({
        sample_path: Type.String({ description: "Path to the malware sample, or its hash" }),
        analysis_type: Type.Optional(StringEnum(MALWARE_TYPE)),
        platform: Type.Optional(StringEnum(MALWARE_PLATFORM)),
      }),
      buildKeywords: kwMalware,
    },
    {
      name: "forensic_analysis",
      label: "Forensic Analysis",
      description:
        "Digital forensics: disk forensics, memory forensics, network forensics, log analysis, timeline " +
        "reconstruction. Covers Windows, Linux, macOS.",
      promptSnippet: "Perform digital forensics — auto-matches the best cybersec skill",
      promptGuidelines: ["Use forensic_analysis to examine evidence; set evidence_type and objective."],
      parameters: Type.Object({
        evidence_type: StringEnum(FORENSIC_EVIDENCE, { description: "Evidence type" }),
        target: Type.String({ description: "Path to the evidence file" }),
        objective: Type.Optional(StringEnum(FORENSIC_OBJ)),
      }),
      buildKeywords: kwForensic,
    },
    {
      name: "detection_engineering",
      label: "Detection Engineering",
      description:
        "Detection engineering: write Sigma/YARA rules, design SIEM use cases, tune alerts, build SOAR " +
        "playbooks. Mapped to MITRE ATT&CK.",
      promptSnippet: "Build detection rules — auto-matches the best cybersec skill",
      promptGuidelines: ["Use detection_engineering to build coverage; set technique (ATT&CK ID) and rule_type."],
      parameters: Type.Object({
        technique: Type.String({ description: "MITRE ATT&CK technique ID, e.g. T1059.001, T1003.001" }),
        rule_type: StringEnum(DETECT_RULE, { description: "Rule type" }),
        environment: Type.Optional(StringEnum(DETECT_ENV)),
      }),
      buildKeywords: kwDetection,
    },
    {
      name: "security_hardening",
      label: "Security Hardening",
      description:
        "System hardening: OS, container, network, application, and Active Directory hardening. Based on " +
        "CIS Benchmarks, STIG, and best practices.",
      promptSnippet: "Harden a system — auto-matches the best cybersec skill",
      promptGuidelines: ["Use security_hardening to reduce attack surface; set target_type and benchmark."],
      parameters: Type.Object({
        target: Type.String({ description: "Hardening target: system path, container name, or service name" }),
        target_type: StringEnum(HARDEN_TYPE, { description: "Target type" }),
        benchmark: Type.Optional(StringEnum(HARDEN_BENCH)),
      }),
      buildKeywords: kwHarden,
    },
    {
      name: "compliance_audit",
      label: "Compliance Audit",
      description:
        "Compliance audit & governance: ISO 27001, SOC 2, PCI DSS, HIPAA, GDPR, NIST CSF, CMMC. " +
        "Gap analysis, control mapping, evidence collection.",
      promptSnippet: "Audit against a compliance framework — auto-matches the best cybersec skill",
      promptGuidelines: ["Use compliance_audit to assess a framework; set framework and scope."],
      parameters: Type.Object({
        framework: StringEnum(COMPLIANCE_FRAMEWORK, { description: "Compliance framework" }),
        scope: Type.Optional(StringEnum(COMPLIANCE_SCOPE)),
        target_system: Type.Optional(Type.String()),
      }),
      buildKeywords: kwCompliance,
    },
    {
      name: "cloud_security_audit",
      label: "Cloud Security Audit",
      description:
        "Defensive cloud audit: IAM review, storage-bucket config, network ACLs, Kubernetes security, " +
        "serverless, logging. Covers AWS, Azure, GCP.",
      promptSnippet: "Audit cloud security posture — auto-matches the best cybersec skill",
      promptGuidelines: ["Use cloud_security_audit to review cloud posture; set provider and scope."],
      parameters: Type.Object({
        provider: StringEnum(CLOUD_PROVIDER, { description: "Cloud provider" }),
        scope: Type.Array(StringEnum(CLOUD_SCOPE), { description: "Audit scope" }),
        compliance: Type.Optional(StringEnum(CLOUD_COMPLIANCE)),
      }),
      buildKeywords: kwCloud,
    },
  ];
  for (const tool of tools) registerSkillTool(pi, index, tool);

  // ── Persona injection + incident memory (every turn) ───────────────────────
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    return { systemPrompt: event.systemPrompt + "\n" + PERSONA + memoryDigest(state) };
  });

  // ── Status + phase driver ──────────────────────────────────────────────────
  const refreshStatus = (ctx: any) => {
    if (!ctx.hasUI) return;
    const phase = state.phase >= 0 ? `Phase ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle";
    ctx.ui.setStatus("aegis", `▓ ${NAME} ▓ ${phase} · ${state.target || "no scope"}`);
  };

  const runPhase = (ctx: any) => {
    const p = PHASES[state.phase];
    refreshStatus(ctx);
    const last = state.phase === PHASES.length - 1;
    pi.sendUserMessage(
      `[Incident on ${state.target} — Phase ${state.phase + 1}/${PHASES.length}: ${p.name}]\n` +
      `Goal: ${p.brief}.\n${p.order}\n` +
      (last
        ? "This is the final phase — produce the report now."
        : `Do ONLY this phase. When done, summarize findings as bullets, /log the key ones, then STOP and tell the user to run /next for the ${PHASES[state.phase + 1].name} phase. Do not advance on your own.`)
    );
  };

  // ── Banner + startup ───────────────────────────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setTheme?.(THEME);
    let i = 0;
    const reveal = () => {
      ctx.ui.setWidget("aegis-banner", BANNER.slice(0, i));
      if (i < BANNER.length) { i++; setTimeout(reveal, 70); return; }
      refreshStatus(ctx);
      ctx.ui.notify(
        skillsAvailable
          ? `${NAME} online · defensive mode · ${index.count} skills ready` +
            (state.phase >= 0 ? ` · resumed incident on ${state.target}` : "")
          : `${NAME} online · ⚠️ skills library not found (run ./install.sh)`,
        skillsAvailable ? "info" : "warning",
      );
    };
    reveal();
  });

  // ── Commands ───────────────────────────────────────────────────────────────
  const HELP: string[] = [
    "",
    `  ${NAME} — blue-team agent. One scope, one response chain, one step at a time.`,
    "",
    "  The response:",
    "    /engage <scope>    start — lock scope, run Phase 1 (Detect), then stop",
    "    /next              advance one phase along the 8-phase defense chain",
    "    /phases            show the whole defense chain and where you are",
    "    /report            jump straight to the incident report",
    "",
    "  Memory:",
    "    /log <note>        add a finding to the evidence chain (persisted)",
    "    /ioc [indicator]   record an IOC (hash/IP/domain) — no arg lists the IOCs",
    "    /evidence          show the full incident memory",
    "    /reset             clear the incident (new scope)",
    "",
    "  Skills:",
    "    /find <query>      semantic skill search ('hunt for c2 beacons')",
    "    /arsenal [kw]      browse the 817-skill library",
    "    /list [kw]         list skills for the current phase (or a keyword)",
    "    /help              this help",
    "",
    `  You can also just talk:  "triage this alert"   "hunt for C2 beacons"   "carve the memory dump"`,
    "  Mission: defend authorized environments.",
    "",
  ];

  pi.registerCommand("engage", {
    description: "🎯 Start an incident response  <scope>",
    handler: async (args, ctx) => {
      const t = (args || "").trim() || state.target;
      if (!t) { ctx.ui.notify("Usage: /engage <scope>   e.g. /engage host-42", "warning"); return; }
      state.target = t; state.phase = 0; saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("next", {
    description: "⏭️ Advance to the next phase",
    handler: async (_args, ctx) => {
      if (state.phase < 0 || !state.target) { ctx.ui.notify("No incident running. Start with /engage <scope>.", "warning"); return; }
      if (state.phase >= PHASES.length - 1) { ctx.ui.notify("Response complete. Use /report, or /engage <scope> for a new one.", "info"); return; }
      state.phase += 1; saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("report", {
    description: "📄 Write the incident report",
    handler: async (_args, ctx) => {
      state.phase = PHASES.length - 1;
      if (!state.target) state.target = "this incident";
      saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("phases", {
    description: "🗺️ Show all phases of the defense chain",
    handler: async (_args, ctx) => {
      const lines = PHASES.map((p, i) => ` ${i === state.phase ? "▶" : " "} ${i + 1}. ${p.name} — ${p.brief}`);
      ctx.ui.notify([`${NAME} defense chain (${PHASES.length} phases):`, ...lines].join("\n"), "info");
    },
  });

  pi.registerCommand("help", {
    description: "❓ How to use this agent",
    handler: async (_args, ctx) => { ctx.ui.notify(HELP.join("\n"), "info"); },
  });

  // ── Memory commands ────────────────────────────────────────────────────────
  pi.registerCommand("log", {
    description: "📝 Add a finding to the evidence chain",
    handler: async (args, ctx) => {
      const note = (args || "").trim();
      if (!note) { ctx.ui.notify("Usage: /log <finding>   e.g. /log lsass access from svchost on host-42", "warning"); return; }
      const phase = state.phase >= 0 ? PHASES[state.phase].name : "-";
      state.evidence.push({ phase, note }); saveState(state);
      ctx.ui.notify(`Logged to evidence chain [${phase}]: ${note}`, "info");
    },
  });

  pi.registerCommand("ioc", {
    description: "🧬 Record / list indicators of compromise",
    handler: async (args, ctx) => {
      const item = (args || "").trim();
      if (!item) {
        ctx.ui.notify(state.iocs.length ? `IOCs (${state.iocs.length}):\n` + state.iocs.map(l => `  · ${l}`).join("\n") : "No IOCs recorded yet.", "info");
        return;
      }
      state.iocs.push(item); saveState(state);
      ctx.ui.notify(`IOC recorded: ${item}`, "info");
    },
  });

  pi.registerCommand("evidence", {
    description: "🧾 Show the full incident memory",
    handler: async (_args, ctx) => {
      const lines = [`${NAME} incident memory`, ""];
      lines.push(`Scope: ${state.target || "(none)"}`);
      lines.push(`Phase: ${state.phase >= 0 ? `${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle"}`);
      lines.push("");
      lines.push(`Evidence chain (${state.evidence.length}):`);
      lines.push(...(state.evidence.length ? state.evidence.map(e => `  - [${e.phase}] ${e.note}`) : ["  (empty)"]));
      lines.push("");
      lines.push(`IOCs (${state.iocs.length}):`);
      lines.push(...(state.iocs.length ? state.iocs.map(l => `  · ${l}`) : ["  (empty)"]));
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("reset", {
    description: "♻️ Clear the incident (new scope)",
    handler: async (_args, ctx) => {
      state.target = ""; state.phase = -1; state.evidence = []; state.iocs = []; saveState(state);
      refreshStatus(ctx);
      ctx.ui.notify("Incident cleared. Start a new one with /engage <scope>.", "info");
    },
  });

  // ── Skill browsing ─────────────────────────────────────────────────────────
  pi.registerCommand("find", {
    description: "🔎 Semantic skill search: /find <what you want to do>",
    handler: async (args, ctx) => {
      const q = (args || "").trim();
      if (!q) { ctx.ui.notify("Usage: /find <query>   e.g. /find hunt for c2 beacons", "warning"); return; }
      if (!skillsAvailable) { ctx.ui.notify("Skills library not found (run ./install.sh).", "error"); return; }
      const hits = index.search(w(W_PRIMARY, q)).slice(0, 12);
      if (hits.length === 0) { ctx.ui.notify(`No skills matched "${q}".`, "info"); return; }
      ctx.ui.notify(
        `Top skills for "${q}":\n` + hits.map(h => `  ${h.score.toString().padStart(3)}  ${h.dir}`).join("\n"),
        "info",
      );
    },
  });

  pi.registerCommand("arsenal", {
    description: "🧰 Browse / search the 817-skill library (keyword optional)",
    handler: async (args, ctx) => {
      if (!skillsAvailable) { ctx.ui.notify(`Skills library not found at ${SKILLS_PATH} (run ./install.sh).`, "error"); return; }
      const keyword = args?.trim() || "";
      const results = index.list(keyword);
      if (results.length === 0) { ctx.ui.notify(`No skills found matching "${keyword}"`, "info"); return; }
      ctx.ui.notify(
        `${results.length} skills${keyword ? ` matching "${keyword}"` : ""}:\n` +
        results.slice(0, 30).join("\n") + (results.length > 30 ? `\n... and ${results.length - 30} more` : ""),
        "info",
      );
    },
  });

  pi.registerCommand("list", {
    description: "📇 List skills for this phase (or /list <keyword>)",
    handler: async (args, ctx) => {
      const kw = (args || "").trim();
      const probe = state.phase >= 0 ? PHASES[state.phase].probe : "";
      const words = (kw || probe).split(/\s+/).filter(Boolean);
      const hits = [...new Set(words.flatMap(word => index.list(word)))].sort();
      if (hits.length === 0) { ctx.ui.notify(`No skills found${kw ? ` for "${kw}"` : ""}.`, "info"); return; }
      const label = kw ? `"${kw}"` : (state.phase >= 0 ? `Phase ${state.phase + 1} · ${PHASES[state.phase].name}` : "current phase");
      ctx.ui.notify(
        `${hits.length} skills for ${label}:\n` +
        hits.slice(0, 30).join("\n") + (hits.length > 30 ? `\n... and ${hits.length - 30} more` : ""),
        "info",
      );
    },
  });
}
