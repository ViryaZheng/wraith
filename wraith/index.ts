/**
 * 🔴 WRAITH — autonomous red-team / offensive-security agent (a self-contained pi extension).
 *
 * This folder is ONE independent agent. It shares NO code with Aegis (blue team) — the two
 * were physically split so each can evolve on its own. Everything Wraith needs lives here:
 *   - Persona: senior offensive operator, injected into the system prompt every turn.
 *   - Tools: 7 offensive function-calling tools, each backed by the 817-skill workflow library
 *     (Nmap, Burp, sqlmap, Metasploit, BloodHound, mimikatz, Sliver, gophish, ...).
 *   - Skill retrieval: tokenized inverted index + weighted search + a lightweight synonym layer.
 *   - Engagement memory: a persisted 9-phase kill chain, evidence chain, and loot ledger that
 *     survive restarts (long-range state, PentestGPT-style).
 *
 * Skills library: bundled at ../cybersec-skills/skills (offline), or ~/.pi/agent/cybersec-skills.
 * Source: https://github.com/mukul975/Anthropic-Cybersecurity-Skills (Apache 2.0)
 *
 * Rules of engagement: authorized targets only (pentests, labs, CTFs, own assets).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TObject } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ═══════════════════════════════════════════════════════════════════════════════
// Identity — WRAITH, red team. 9-phase kill chain (MITRE ATT&CK aligned).
// ═══════════════════════════════════════════════════════════════════════════════

interface Phase { id: string; name: string; brief: string; order: string; probe: string; }

const NAME = "WRAITH";
const THEME = "matrix";
const BANNER = [
  "  ██     ██ ██████   █████  ██ ████████ ██   ██",
  "  ██     ██ ██   ██ ██   ██ ██    ██    ██   ██",
  "  ██  █  ██ ██████  ███████ ██    ██    ███████",
  "  ██ ███ ██ ██   ██ ██   ██ ██    ██    ██   ██",
  "   ███ ███  ██   ██ ██   ██ ██    ██    ██   ██",
  "  RED TEAM · 9-phase kill chain · /engage <target>",
];

const PERSONA = `
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
- Your offensive tools: penetration_test, vulnerability_assessment, exploit_development,
  password_attack, c2_operations, social_engineering, cloud_security_audit — backed by ~450
  attack workflows (Nmap, Burp, sqlmap, BloodHound, mimikatz, Impacket, Sliver, gophish, etc.).
  You do NOT do defense (no IR/hunt/forensics); that is Aegis. Pick a tool, pull its workflow, run via bash.
- Log every meaningful finding with /log and every captured secret/host with /loot — this
  engagement memory persists and feeds the final report.
- The user may just talk naturally ("grab the creds", "escalate to root", "pivot to the DC").

[Engagement flow — one phase at a time, user-paced]
Main line: RECON -> ACCESS -> EXECUTE -> PERSIST -> ESCALATE -> CREDS -> LATERAL -> IMPACT -> REPORT. Work ONE phase at a time:
finish it, summarize findings as bullets, then STOP and wait for /next. Never race ahead.

[Style] Concise, precise, like a hacker in a terminal. Bullet findings. Full copy-pasteable commands.
[Language] English. Keep tool names and technical terms verbatim.
═══════════════════════════════════════════════════════════════
`;

const PHASES: Phase[] = [
  { id: "RECON", name: "Recon", probe: "reconnaissance scanning enumeration nmap subdomain discovery",
    brief: "map the attack surface — hosts, ports, services, subdomains, tech stack (T1046/T1595/T1083)",
    order: "Use the recon phase of penetration_test. ENUMERATE ONLY — no exploitation yet." },
  { id: "ACCESS", name: "Initial Access", probe: "exploitation web-application phishing initial-access exploit",
    brief: "get the first foothold — exploit public apps, phishing, valid accounts (T1190/T1566/T1078)",
    order: "Use vulnerability_assessment / exploit_development / social_engineering to gain initial access." },
  { id: "EXECUTE", name: "Execution", probe: "command execution powershell scripting payload",
    brief: "run code on the foothold — command/script execution, payloads (T1059)",
    order: "Use penetration_test / c2_operations to establish reliable code execution / a stable shell." },
  { id: "PERSIST", name: "Persistence", probe: "persistence backdoor webshell scheduled-task service registry",
    brief: "survive reboots — webshell, scheduled task, service, account (T1505.003/T1053)",
    order: "Use penetration_test / c2_operations to install persistence; note trigger and stealth." },
  { id: "ESCALATE", name: "Priv Esc", probe: "privilege-escalation privesc token process-injection suid kernel",
    brief: "become admin/root — kernel/service/misconfig, process injection (T1068/T1055)",
    order: "Use penetration_test to enumerate privesc paths and escalate." },
  { id: "CREDS", name: "Credentials", probe: "credential-access dumping mimikatz kerberoasting hash brute-force lsass",
    brief: "harvest secrets — OS/AD creds, hashes, tickets, brute force (T1003/T1110/T1557)",
    order: "Use password_attack for credential access; /loot every secret obtained." },
  { id: "LATERAL", name: "Lateral", probe: "lateral-movement pass-the-hash remote-execution pivot active-directory",
    brief: "spread — pass-the-hash/tickets, remote exec, pivot, cloud accounts (T1021/T1078.004)",
    order: "Use penetration_test / password_attack for lateral movement; map controlled hosts and reach the objective." },
  { id: "IMPACT", name: "Exfil / Impact", probe: "exfiltration collection cloud-storage ransomware encryption impact",
    brief: "the objective — exfiltrate data or demonstrate impact (T1530/T1537/T1486)",
    order: "Use penetration_test / cloud_security_audit to stage/exfiltrate data or demonstrate impact (authorized scope only)." },
  { id: "REPORT", name: "Report", probe: "report reporting documentation",
    brief: "compile the red-team report",
    order: "Compile findings from the evidence chain and loot ledger: executive summary, attack path, vulns (severity+CVSS), repro steps, remediation. English, markdown." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Skill split — Wraith keeps offensive + technical skills, drops blue defensive ones.
// A skill with no subdomain (or a non-blue subdomain) belongs to red.
// ═══════════════════════════════════════════════════════════════════════════════

const BLUE_SUBDOMAINS = new Set([
  "threat-hunting", "threat-intelligence", "threat-detection", "soc-operations",
  "security-operations", "incident-response", "digital-forensics", "malware-analysis",
  "ransomware-defense", "phishing-defense", "deception-technology", "endpoint-security",
  "zero-trust-architecture", "zero-trust", "compliance-governance", "governance-risk-compliance",
  "privacy-compliance", "data-protection", "purple-team", "social-engineering-defense",
]);
const redFilter = (sub: string): boolean => !BLUE_SUBDOMAINS.has(sub);

// ═══════════════════════════════════════════════════════════════════════════════
// Lightweight semantic layer — offline synonym/alias expansion (no embeddings).
// A query token also pulls in its aliases at a slightly lower weight, so hacker
// shorthand ("creds", "privesc", "rce") reaches the canonical skill names.
// ═══════════════════════════════════════════════════════════════════════════════

const SYNONYMS: Record<string, string[]> = {
  creds: ["credential", "password", "hash", "ntlm", "kerberos", "lsass"],
  cred: ["credential", "password", "hash"],
  privesc: ["privilege-escalation", "privesc"],
  recon: ["reconnaissance", "enumeration", "osint", "scanning"],
  rce: ["remote-code-execution", "command-execution", "exploitation"],
  sqli: ["sql-injection", "injection"],
  xss: ["cross-site-scripting"],
  ssrf: ["server-side-request-forgery"],
  lfi: ["file-inclusion"],
  ad: ["active-directory", "kerberos", "ldap"],
  dc: ["domain-controller", "active-directory"],
  c2: ["command-and-control", "beacon", "implant"],
  pth: ["pass-the-hash"],
  av: ["antivirus", "evasion", "bypass"],
  edr: ["endpoint-detection", "evasion", "bypass"],
  lateral: ["lateral-movement", "pivot"],
  exfil: ["exfiltration", "data-staging"],
  persist: ["persistence", "backdoor"],
  ad_cs: ["adcs", "certipy", "certificate-services"],
  kerb: ["kerberoasting", "kerberos"],
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

const W_PRIMARY = 3;   // framework name, attack class, core technique
const W_SECONDARY = 2; // scope, phase, platform
const W_AUX = 1;       // environment, auxiliary

// ═══════════════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY = ["critical", "high", "medium", "low", "all"] as const;

const VULN_SCOPE = ["web_app", "api", "network", "container", "mobile", "dependency", "config", "secret", "cloud"] as const;
const VULN_FRAMEWORK = ["owasp_top10", "cwe_top25", "nist", "cis", "custom"] as const;

const PENTEST_PHASE = ["recon", "scanning", "exploitation", "privilege_escalation", "lateral_movement", "persistence", "exfiltration", "cleanup", "full"] as const;
const PENTEST_ENV = ["web", "internal_network", "active_directory", "cloud", "mobile"] as const;
const PENTEST_FW = ["mitre_attack", "ptes", "owasp", "nist"] as const;

const EXPLOIT_CLASS = ["binary", "web", "deserialization", "injection", "auth_bypass", "active_directory", "poc"] as const;
const EXPLOIT_PLATFORM = ["windows", "linux", "web", "cloud", "mobile"] as const;

const PASSWORD_METHOD = ["cracking", "brute_force", "spraying", "dumping", "kerberoast", "ntlm_relay", "pass_the_hash"] as const;
const PASSWORD_PLATFORM = ["windows", "linux", "active_directory", "web", "cloud"] as const;

const C2_FRAMEWORK = ["sliver", "cobalt_strike", "havoc", "mythic", "generic"] as const;
const C2_TASK = ["infrastructure", "implant", "redirector", "evasion", "post_exploitation"] as const;

const SOCIAL_VECTOR = ["phishing", "spearphishing", "pretext", "vishing", "osint"] as const;

const CLOUD_PROVIDER = ["aws", "azure", "gcp", "kubernetes", "multi"] as const;
const CLOUD_SCOPE = ["iam", "storage", "network", "compute", "kubernetes", "serverless", "database", "logging", "secrets"] as const;
const CLOUD_COMPLIANCE = ["cis", "nist", "soc2", "pci_dss", "hipaa", "custom"] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Keyword builders
// ═══════════════════════════════════════════════════════════════════════════════

const scopeMap: Record<string, string[]> = {
  web_app:    ["web-application", "pentest", "scanning", "xss", "sql-injection", "nikto", "burp"],
  api:        ["api-security", "api", "graphql", "rest", "fuzzing"],
  network:    ["network", "nmap", "nessus", "openvas", "infrastructure"],
  container:  ["container", "docker", "trivy", "grype", "kubernetes"],
  mobile:     ["mobile", "android", "ios", "frida"],
  dependency: ["dependency", "sca", "snyk", "supply-chain", "sbom"],
  config:     ["misconfiguration", "cis-benchmark", "hardening", "auditing"],
  secret:     ["secret", "gitleaks", "trufflehog", "credential"],
  cloud:      ["cloud", "aws", "azure", "gcp", "scout-suite"],
};
function kwVuln(params: Record<string, unknown>): WeightedTerm[] {
  const scope = params.scope as string[];
  const framework = params.framework as string | undefined;
  const severity = params.severity as string | undefined;
  const terms: WeightedTerm[] = [];
  for (const s of scope) terms.push(...w(W_SECONDARY, ...(scopeMap[s] ?? [s])));
  if (framework) terms.push(...w(W_PRIMARY, framework));
  if (severity && severity !== "all") terms.push(...w(W_AUX, severity));
  if (terms.length === 0) terms.push(...w(W_PRIMARY, "vulnerability-scanning"));
  return terms;
}

const phaseMap: Record<string, string[]> = {
  recon:                ["reconnaissance", "osint", "enumeration", "subdomain", "dns"],
  scanning:             ["scanning", "nmap", "nessus", "vulnerability-scanning"],
  exploitation:         ["exploitation", "exploiting", "metasploit", "sqlmap"],
  privilege_escalation: ["privilege-escalation", "privesc", "token", "suid"],
  lateral_movement:     ["lateral-movement", "wmiexec", "pass-the-hash", "netexec"],
  persistence:          ["persistence", "backdoor", "scheduled-task", "registry"],
  exfiltration:         ["exfiltration", "dns-tunneling", "icmp"],
  cleanup:              ["cleanup", "log", "anti-forensics"],
  full:                 ["penetration-test", "red-team", "full-scope"],
};
const pentestEnvMap: Record<string, string[]> = {
  web:              ["web-application", "burp", "owasp", "zap"],
  internal_network: ["internal-network", "lateral-movement", "netexec"],
  active_directory: ["active-directory", "kerberoasting", "bloodhound", "dcsync"],
  cloud:            ["cloud", "aws", "azure", "gcp", "pacu"],
  mobile:           ["mobile", "android", "ios", "frida"],
};
function kwPentest(params: Record<string, unknown>): WeightedTerm[] {
  const phase = params.phase as string | undefined;
  const env = params.environment as string | undefined;
  const terms: WeightedTerm[] = [];
  if (phase && phase !== "full") terms.push(...w(W_PRIMARY, ...(phaseMap[phase] ?? [phase])));
  else terms.push(...w(W_PRIMARY, "penetration-test"));
  if (env) terms.push(...w(W_SECONDARY, ...(pentestEnvMap[env] ?? [env])));
  return terms;
}

const exploitClassMap: Record<string, string[]> = {
  binary:           ["exploitation", "heap-spray", "buffer-overflow", "rop", "shellcode", "binary"],
  web:              ["exploiting", "http-request-smuggling", "ssrf", "idor", "deserialization"],
  deserialization:  ["insecure-deserialization", "deserialization", "gadget"],
  injection:        ["injection", "sql-injection", "command-injection", "sqlmap"],
  auth_bypass:      ["jwt", "authentication", "authorization", "oauth", "bypass"],
  active_directory: ["active-directory", "kerberoasting", "adcs", "certipy", "delegation"],
  poc:              ["exploit-development", "proof-of-concept", "cve", "exploiting"],
};
const exploitPlatMap: Record<string, string[]> = {
  windows: ["windows", "pe", "dotnet"],
  linux:   ["linux", "elf"],
  web:     ["web-application", "http"],
  cloud:   ["cloud", "aws", "azure"],
  mobile:  ["mobile", "android", "ios"],
};
function kwExploit(params: Record<string, unknown>): WeightedTerm[] {
  const cls = params.exploit_class as string | undefined;
  const plat = params.platform as string | undefined;
  const terms: WeightedTerm[] = [];
  if (cls) terms.push(...w(W_PRIMARY, ...(exploitClassMap[cls] ?? [cls])));
  else terms.push(...w(W_PRIMARY, "exploit-development", "exploitation"));
  if (plat) terms.push(...w(W_SECONDARY, ...(exploitPlatMap[plat] ?? [plat])));
  return terms;
}

const passwordMethodMap: Record<string, string[]> = {
  cracking:      ["hashcat", "john", "cracking", "hash", "wordlist"],
  brute_force:   ["brute-force", "hydra", "brute", "medusa"],
  spraying:      ["password-spraying", "spraying", "spray"],
  dumping:       ["credential-dumping", "mimikatz", "lsass", "dpapi", "lazagne", "secretsdump"],
  kerberoast:    ["kerberoasting", "kerberos", "impacket", "asrep"],
  ntlm_relay:    ["ntlm-relay", "relay", "responder", "coercion", "ntlmrelayx"],
  pass_the_hash: ["pass-the-hash", "overpass-the-hash", "pth", "secretsdump"],
};
const passwordPlatMap: Record<string, string[]> = {
  windows:          ["windows", "ntlm", "sam"],
  linux:            ["linux", "shadow", "unshadow"],
  active_directory: ["active-directory", "kerberos", "ldap"],
  web:              ["web", "login", "http"],
  cloud:            ["cloud", "aws", "azure", "token"],
};
function kwPassword(params: Record<string, unknown>): WeightedTerm[] {
  const method = params.method as string;
  const plat = params.platform as string | undefined;
  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, ...(passwordMethodMap[method] ?? [method])));
  if (plat) terms.push(...w(W_SECONDARY, ...(passwordPlatMap[plat] ?? [plat])));
  return terms;
}

const c2FrameworkMap: Record<string, string[]> = {
  sliver:        ["sliver", "c2"],
  cobalt_strike: ["cobalt-strike", "cobaltstrike", "beacon", "malleable"],
  havoc:         ["havoc", "c2"],
  mythic:        ["mythic", "c2", "agent"],
  generic:       ["c2", "command-and-control", "red-team", "implant"],
};
const c2TaskMap: Record<string, string[]> = {
  infrastructure:   ["infrastructure", "redirector", "domain-fronting"],
  implant:          ["implant", "beacon", "payload"],
  redirector:       ["redirector", "domain-fronting", "cdn"],
  evasion:          ["evasion", "obfuscation", "bypass"],
  post_exploitation:["post-exploitation", "pivot", "lateral-movement"],
};
function kwC2(params: Record<string, unknown>): WeightedTerm[] {
  const framework = params.framework as string;
  const task = params.task as string | undefined;
  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, ...(c2FrameworkMap[framework] ?? [framework])));
  if (task) terms.push(...w(W_SECONDARY, ...(c2TaskMap[task] ?? [task])));
  return terms;
}

const socialVectorMap: Record<string, string[]> = {
  phishing:      ["phishing", "gophish", "simulation", "campaign"],
  spearphishing: ["spearphishing", "spear", "targeted", "campaign"],
  pretext:       ["pretext", "pretexting", "social-engineering"],
  vishing:       ["vishing", "voice", "pretext-call"],
  osint:         ["osint", "reconnaissance", "footprinting"],
};
function kwSocial(params: Record<string, unknown>): WeightedTerm[] {
  const vector = params.vector as string;
  const terms: WeightedTerm[] = [];
  terms.push(...w(W_PRIMARY, ...(socialVectorMap[vector] ?? [vector])));
  terms.push(...w(W_AUX, "social-engineering"));
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

// ═══════════════════════════════════════════════════════════════════════════════
// Long-range engagement memory — persisted kill chain + evidence chain + loot ledger.
// Survives restarts so a multi-day engagement keeps its state. (PentestGPT-style PTT.)
// ═══════════════════════════════════════════════════════════════════════════════

interface Evidence { phase: string; note: string; }
interface State { target: string; phase: number; evidence: Evidence[]; loot: string[]; }

const STATE_FILE = join(process.cwd(), ".wraith.json");

function loadState(): State {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    return { target: s.target ?? "", phase: s.phase ?? -1, evidence: s.evidence ?? [], loot: s.loot ?? [] };
  } catch {
    return { target: "", phase: -1, evidence: [], loot: [] };
  }
}
function saveState(state: State): void {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* best-effort */ }
}

/** Compact digest injected into the system prompt so the agent remembers the engagement. */
function memoryDigest(state: State): string {
  if (state.phase < 0 && state.evidence.length === 0 && state.loot.length === 0) return "";
  const lines = ["", "[Engagement memory — persisted across turns]"];
  if (state.target) lines.push(`Target: ${state.target}`);
  if (state.phase >= 0) lines.push(`Phase: ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}`);
  if (state.evidence.length) {
    lines.push("Evidence chain (latest first):");
    for (const e of state.evidence.slice(-8).reverse()) lines.push(`  - [${e.phase}] ${e.note}`);
  }
  if (state.loot.length) lines.push(`Loot captured (${state.loot.length}): ${state.loot.slice(-10).join(" · ")}`);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extension entry — WRAITH (red)
// ═══════════════════════════════════════════════════════════════════════════════

export default function (pi: ExtensionAPI) {
  const skillsAvailable = existsSync(SKILLS_PATH);
  const index = skillsAvailable ? new SkillIndex(SKILLS_PATH, redFilter) : new SkillIndex("");
  const state = loadState();

  // ── 7 offensive tools ─────────────────────────────────────────────────────
  const tools: ToolConfig[] = [
    {
      name: "vulnerability_assessment",
      label: "Vulnerability Assessment",
      description:
        "Comprehensive vulnerability assessment of a target: CVE scanning, OWASP Top 10 detection, " +
        "dependency audit, config review, CVSS scoring. Covers web apps, network, containers, API, mobile. " +
        "Auto-matches the most relevant attack skill.",
      promptSnippet: "Scan a target for vulnerabilities — auto-matches the best cybersec skill",
      promptGuidelines: ["Use vulnerability_assessment to enumerate weaknesses; set target and scope."],
      parameters: Type.Object({
        target: Type.String({ description: "Assessment target: directory path, URL, IP address, or container image" }),
        scope: Type.Array(StringEnum(VULN_SCOPE), { description: "Assessment scope" }),
        severity: Type.Optional(StringEnum(SEVERITY)),
        framework: Type.Optional(StringEnum(VULN_FRAMEWORK)),
      }),
      buildKeywords: kwVuln,
    },
    {
      name: "penetration_test",
      label: "Penetration Test",
      description:
        "Systematic penetration test: recon → exploitation → privilege escalation → lateral movement → " +
        "persistence → cleanup. Covers web, internal network, Active Directory, cloud, mobile.",
      promptSnippet: "Run a penetration test phase — auto-matches the best cybersec skill",
      promptGuidelines: ["Use penetration_test to drive the kill chain; set target and phase."],
      parameters: Type.Object({
        target: Type.String({ description: "Pentest target: IP, domain, URL, or IP range" }),
        phase: Type.Optional(StringEnum(PENTEST_PHASE)),
        environment: Type.Optional(StringEnum(PENTEST_ENV)),
        framework: Type.Optional(StringEnum(PENTEST_FW)),
      }),
      buildKeywords: kwPentest,
    },
    {
      name: "exploit_development",
      label: "Exploit Development",
      description:
        "Build or adapt an exploit / PoC for a specific weakness: binary (heap/stack/ROP), web " +
        "(smuggling, SSRF, IDOR), insecure deserialization, injection, auth bypass, or Active Directory " +
        "(Kerberoasting, ADCS). Pulls a matching exploitation workflow with real tooling.",
      promptSnippet: "Develop or adapt an exploit / PoC — auto-matches the best cybersec skill",
      promptGuidelines: ["Use exploit_development to weaponize a specific vuln class; set exploit_class."],
      parameters: Type.Object({
        target: Type.String({ description: "What to exploit: a CVE, endpoint, binary, or service" }),
        exploit_class: StringEnum(EXPLOIT_CLASS, { description: "Vulnerability class to weaponize" }),
        platform: Type.Optional(StringEnum(EXPLOIT_PLATFORM)),
      }),
      buildKeywords: kwExploit,
    },
    {
      name: "password_attack",
      label: "Password Attack",
      description:
        "Credential attacks: hash cracking (hashcat/john), brute force / spraying, OS & AD credential " +
        "dumping (mimikatz, LSASS, DPAPI, secretsdump), Kerberoasting, NTLM relay, pass-the-hash. " +
        "Covers Windows, Linux, Active Directory, web, cloud.",
      promptSnippet: "Attack credentials — auto-matches the best cybersec skill",
      promptGuidelines: ["Use password_attack for any credential access; set method. /loot every secret you recover."],
      parameters: Type.Object({
        target: Type.String({ description: "Credential target: a hash file, host, account, or hash string" }),
        method: StringEnum(PASSWORD_METHOD, { description: "Attack method" }),
        platform: Type.Optional(StringEnum(PASSWORD_PLATFORM)),
      }),
      buildKeywords: kwPassword,
    },
    {
      name: "c2_operations",
      label: "C2 Operations",
      description:
        "Command-and-control & post-exploitation infrastructure: stand up and operate a C2 (Sliver, " +
        "Cobalt Strike, Havoc, Mythic), build implants and redirectors, and manage beacons. Authorized " +
        "red-team engagements only.",
      promptSnippet: "Set up / operate C2 infrastructure — auto-matches the best cybersec skill",
      promptGuidelines: ["Use c2_operations to establish reliable control; set framework."],
      parameters: Type.Object({
        objective: Type.String({ description: "What to do: e.g. 'stand up a Sliver listener', 'build a redirector'" }),
        framework: StringEnum(C2_FRAMEWORK, { description: "C2 framework" }),
        task: Type.Optional(StringEnum(C2_TASK)),
      }),
      buildKeywords: kwC2,
    },
    {
      name: "social_engineering",
      label: "Social Engineering",
      description:
        "Offensive social engineering for authorized assessments: phishing / spearphishing campaigns " +
        "(gophish), pretexting, vishing, and OSINT-driven target profiling. Simulation and awareness " +
        "testing within an approved scope.",
      promptSnippet: "Run an authorized social-engineering campaign — auto-matches the best cybersec skill",
      promptGuidelines: ["Use social_engineering for approved phishing/pretext simulations; set vector."],
      parameters: Type.Object({
        target: Type.String({ description: "Campaign target: an org, user group, or scenario" }),
        vector: StringEnum(SOCIAL_VECTOR, { description: "Social-engineering vector" }),
      }),
      buildKeywords: kwSocial,
    },
    {
      name: "cloud_security_audit",
      label: "Cloud Security Audit",
      description:
        "Offensive cloud audit: IAM privilege-escalation paths, exposed storage buckets, network ACLs, " +
        "Kubernetes RBAC, serverless. Covers AWS, Azure, GCP.",
      promptSnippet: "Audit a cloud environment for attack paths — auto-matches the best cybersec skill",
      promptGuidelines: ["Use cloud_security_audit to find cloud attack paths; set provider and scope."],
      parameters: Type.Object({
        provider: StringEnum(CLOUD_PROVIDER, { description: "Cloud provider" }),
        scope: Type.Array(StringEnum(CLOUD_SCOPE), { description: "Audit scope" }),
        compliance: Type.Optional(StringEnum(CLOUD_COMPLIANCE)),
      }),
      buildKeywords: kwCloud,
    },
  ];
  for (const tool of tools) registerSkillTool(pi, index, tool);

  // ── Persona injection + engagement memory (every turn) ─────────────────────
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    return { systemPrompt: event.systemPrompt + "\n" + PERSONA + memoryDigest(state) };
  });

  // ── Status + phase driver ──────────────────────────────────────────────────
  const refreshStatus = (ctx: any) => {
    if (!ctx.hasUI) return;
    const phase = state.phase >= 0 ? `Phase ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle";
    ctx.ui.setStatus("wraith", `▓ ${NAME} ▓ ${phase} · ${state.target || "no target"}`);
  };

  const runPhase = (ctx: any) => {
    const p = PHASES[state.phase];
    refreshStatus(ctx);
    const last = state.phase === PHASES.length - 1;
    pi.sendUserMessage(
      `[Engagement on ${state.target} — Phase ${state.phase + 1}/${PHASES.length}: ${p.name}]\n` +
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
      ctx.ui.setWidget("wraith-banner", BANNER.slice(0, i));
      if (i < BANNER.length) { i++; setTimeout(reveal, 70); return; }
      refreshStatus(ctx);
      ctx.ui.notify(
        skillsAvailable
          ? `${NAME} online · authorized red-team mode · ${index.count} skills ready` +
            (state.phase >= 0 ? ` · resumed engagement on ${state.target}` : "")
          : `${NAME} online · ⚠️ skills library not found (run ./install.sh)`,
        skillsAvailable ? "info" : "warning",
      );
    };
    reveal();
  });

  // ── Commands ───────────────────────────────────────────────────────────────
  const HELP: string[] = [
    "",
    `  ${NAME} — red-team agent. One target, one kill chain, one step at a time.`,
    "",
    "  The engagement:",
    "    /engage <target>   start — lock target, run Phase 1 (Recon), then stop",
    "    /next              advance one phase along the 9-phase kill chain",
    "    /phases            show the whole kill chain and where you are",
    "    /report            jump straight to the report",
    "",
    "  Memory:",
    "    /log <note>        add a finding to the evidence chain (persisted)",
    "    /loot [item]       record a captured cred/host/shell — no arg lists the loot",
    "    /evidence          show the full engagement memory",
    "    /reset             clear the engagement (new target)",
    "",
    "  Skills:",
    "    /find <query>      semantic skill search ('dump creds from the DC')",
    "    /arsenal [kw]      browse the 817-skill library",
    "    /list [kw]         list skills for the current phase (or a keyword)",
    "    /help              this help",
    "",
    `  You can also just talk:  "grab the creds"   "escalate to root"   "pivot to the DC"`,
    "  Rule of engagement: authorized targets only.",
    "",
  ];

  pi.registerCommand("engage", {
    description: "🎯 Start an engagement  <target>",
    handler: async (args, ctx) => {
      const t = (args || "").trim() || state.target;
      if (!t) { ctx.ui.notify("Usage: /engage <target>   e.g. /engage 10.0.0.5", "warning"); return; }
      state.target = t; state.phase = 0; saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("next", {
    description: "⏭️ Advance to the next phase",
    handler: async (_args, ctx) => {
      if (state.phase < 0 || !state.target) { ctx.ui.notify("No engagement running. Start with /engage <target>.", "warning"); return; }
      if (state.phase >= PHASES.length - 1) { ctx.ui.notify("Engagement complete. Use /report, or /engage <target> for a new one.", "info"); return; }
      state.phase += 1; saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("report", {
    description: "📄 Write the red-team report",
    handler: async (_args, ctx) => {
      state.phase = PHASES.length - 1;
      if (!state.target) state.target = "this engagement";
      saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("phases", {
    description: "🗺️ Show all phases of the kill chain",
    handler: async (_args, ctx) => {
      const lines = PHASES.map((p, i) => ` ${i === state.phase ? "▶" : " "} ${i + 1}. ${p.name} — ${p.brief}`);
      ctx.ui.notify([`${NAME} kill chain (${PHASES.length} phases):`, ...lines].join("\n"), "info");
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
      if (!note) { ctx.ui.notify("Usage: /log <finding>   e.g. /log SMB signing disabled on 10.0.0.5", "warning"); return; }
      const phase = state.phase >= 0 ? PHASES[state.phase].name : "-";
      state.evidence.push({ phase, note }); saveState(state);
      ctx.ui.notify(`Logged to evidence chain [${phase}]: ${note}`, "info");
    },
  });

  pi.registerCommand("loot", {
    description: "💰 Record / list captured creds, hosts, shells",
    handler: async (args, ctx) => {
      const item = (args || "").trim();
      if (!item) {
        ctx.ui.notify(state.loot.length ? `Loot (${state.loot.length}):\n` + state.loot.map(l => `  · ${l}`).join("\n") : "No loot captured yet.", "info");
        return;
      }
      state.loot.push(item); saveState(state);
      ctx.ui.notify(`Loot captured: ${item}`, "info");
    },
  });

  pi.registerCommand("evidence", {
    description: "🧾 Show the full engagement memory",
    handler: async (_args, ctx) => {
      const lines = [`${NAME} engagement memory`, ""];
      lines.push(`Target: ${state.target || "(none)"}`);
      lines.push(`Phase:  ${state.phase >= 0 ? `${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle"}`);
      lines.push("");
      lines.push(`Evidence chain (${state.evidence.length}):`);
      lines.push(...(state.evidence.length ? state.evidence.map(e => `  - [${e.phase}] ${e.note}`) : ["  (empty)"]));
      lines.push("");
      lines.push(`Loot (${state.loot.length}):`);
      lines.push(...(state.loot.length ? state.loot.map(l => `  · ${l}`) : ["  (empty)"]));
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("reset", {
    description: "♻️ Clear the engagement (new target)",
    handler: async (_args, ctx) => {
      state.target = ""; state.phase = -1; state.evidence = []; state.loot = []; saveState(state);
      refreshStatus(ctx);
      ctx.ui.notify("Engagement cleared. Start a new one with /engage <target>.", "info");
    },
  });

  // ── Skill browsing ─────────────────────────────────────────────────────────
  pi.registerCommand("find", {
    description: "🔎 Semantic skill search: /find <what you want to do>",
    handler: async (args, ctx) => {
      const q = (args || "").trim();
      if (!q) { ctx.ui.notify("Usage: /find <query>   e.g. /find dump creds from the DC", "warning"); return; }
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
