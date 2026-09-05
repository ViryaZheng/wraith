/**
 * CRIMSON KNIGHT tools — the red team's offensive arsenal.
 *
 * 7 tools, each mapping structured params → weighted keywords for skill retrieval,
 * plus the red synonym table. This product ships only red skills (./skills), so there
 * is no team filter. Add a tool by dropping a new entry in TOOLS; extend semantic
 * reach by editing SYNONYMS.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { type ToolConfig, type WeightedTerm, w, W_PRIMARY, W_SECONDARY, W_AUX } from "./skill-index";

// ── Offline semantic layer: hacker shorthand → canonical skill names ──
export const SYNONYMS: Record<string, string[]> = {
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

// ── Enums ──
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

// ── Keyword maps + builders ──
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
  windows: ["windows", "pe", "dotnet"], linux: ["linux", "elf"], web: ["web-application", "http"],
  cloud: ["cloud", "aws", "azure"], mobile: ["mobile", "android", "ios"],
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
  windows: ["windows", "ntlm", "sam"], linux: ["linux", "shadow", "unshadow"],
  active_directory: ["active-directory", "kerberos", "ldap"], web: ["web", "login", "http"],
  cloud: ["cloud", "aws", "azure", "token"],
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
  sliver: ["sliver", "c2"], cobalt_strike: ["cobalt-strike", "cobaltstrike", "beacon", "malleable"],
  havoc: ["havoc", "c2"], mythic: ["mythic", "c2", "agent"],
  generic: ["c2", "command-and-control", "red-team", "implant"],
};
const c2TaskMap: Record<string, string[]> = {
  infrastructure: ["infrastructure", "redirector", "domain-fronting"], implant: ["implant", "beacon", "payload"],
  redirector: ["redirector", "domain-fronting", "cdn"], evasion: ["evasion", "obfuscation", "bypass"],
  post_exploitation: ["post-exploitation", "pivot", "lateral-movement"],
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
  phishing: ["phishing", "gophish", "simulation", "campaign"],
  spearphishing: ["spearphishing", "spear", "targeted", "campaign"],
  pretext: ["pretext", "pretexting", "social-engineering"],
  vishing: ["vishing", "voice", "pretext-call"],
  osint: ["osint", "reconnaissance", "footprinting"],
};
function kwSocial(params: Record<string, unknown>): WeightedTerm[] {
  const vector = params.vector as string;
  return [...w(W_PRIMARY, ...(socialVectorMap[vector] ?? [vector])), ...w(W_AUX, "social-engineering")];
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

// ── The 7 offensive tools ──
export const TOOLS: ToolConfig[] = [
  {
    name: "vulnerability_assessment",
    label: "Vulnerability Assessment",
    description:
      "Comprehensive vulnerability assessment of a target: CVE scanning, OWASP Top 10 detection, " +
      "dependency audit, config review, CVSS scoring. Covers web apps, network, containers, API, mobile. " +
      "Set target and scope. Auto-matches the most relevant attack skill.",
    promptSnippet: "Scan a target for vulnerabilities — auto-matches the best cybersec skill",
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
      "persistence → cleanup. Covers web, internal network, Active Directory, cloud, mobile. Set target and phase.",
    promptSnippet: "Run a penetration test phase — auto-matches the best cybersec skill",
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
      "Build or adapt an exploit / PoC for a specific weakness: binary (heap/stack/ROP), web (smuggling, " +
      "SSRF, IDOR), insecure deserialization, injection, auth bypass, or Active Directory (Kerberoasting, ADCS). " +
      "Set exploit_class. Pulls a matching exploitation workflow with real tooling.",
    promptSnippet: "Develop or adapt an exploit / PoC — auto-matches the best cybersec skill",
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
      "Credential attacks: hash cracking (hashcat/john), brute force / spraying, OS & AD credential dumping " +
      "(mimikatz, LSASS, DPAPI, secretsdump), Kerberoasting, NTLM relay, pass-the-hash. Set method. " +
      "Covers Windows, Linux, Active Directory, web, cloud.",
    promptSnippet: "Attack credentials — auto-matches the best cybersec skill",
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
      "Command-and-control & post-exploitation infrastructure: stand up and operate a C2 (Sliver, Cobalt " +
      "Strike, Havoc, Mythic), build implants and redirectors, manage beacons. Set framework. Authorized " +
      "red-team engagements only.",
    promptSnippet: "Set up / operate C2 infrastructure — auto-matches the best cybersec skill",
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
      "Offensive social engineering for authorized assessments: phishing / spearphishing campaigns (gophish), " +
      "pretexting, vishing, OSINT-driven target profiling. Set vector. Simulation and awareness testing within " +
      "an approved scope only.",
    promptSnippet: "Run an authorized social-engineering campaign — auto-matches the best cybersec skill",
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
      "Kubernetes RBAC, serverless. Covers AWS, Azure, GCP. Set provider and scope.",
    promptSnippet: "Audit a cloud environment for attack paths — auto-matches the best cybersec skill",
    parameters: Type.Object({
      provider: StringEnum(CLOUD_PROVIDER, { description: "Cloud provider" }),
      scope: Type.Array(StringEnum(CLOUD_SCOPE), { description: "Audit scope" }),
      compliance: Type.Optional(StringEnum(CLOUD_COMPLIANCE)),
    }),
    buildKeywords: kwCloud,
  },
];
