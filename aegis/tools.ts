/**
 * AEGIS tools — the blue team's defensive arsenal.
 *
 * 8 tools, each mapping structured params → weighted keywords for skill retrieval,
 * plus the blue synonym table. This product ships only blue skills (./skills), so
 * there is no team filter. Add a tool by dropping a new entry in TOOLS; extend
 * semantic reach by editing SYNONYMS.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { type ToolConfig, type WeightedTerm, w, W_PRIMARY, W_SECONDARY, W_AUX } from "./skill-index";

// ── Offline semantic layer: defensive shorthand → canonical skill names ──
export const SYNONYMS: Record<string, string[]> = {
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

// ── Enums ──
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

// ── Keyword maps + builders ──
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
  windows: ["windows", "pe", "dotnet", "powershell"], linux: ["linux", "elf"], macos: ["macos", "mach-o"],
  android: ["android", "apk", "jadx"], ios: ["ios", "frida"], unknown: [],
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

// ── The 8 defensive tools ──
export const TOOLS: ToolConfig[] = [
  {
    name: "incident_response",
    label: "Incident Response",
    description:
      "Security incident response workflow: detection & confirmation → containment → eradication → recovery " +
      "→ lessons learned. Covers ransomware, phishing, data breach, APT intrusion, and more. Set incident_type and phase.",
    promptSnippet: "Run an incident-response workflow — auto-matches the best cybersec skill",
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
      "Proactive threat hunting: hypothesis-driven, IOC search, behavioral analysis, anomaly detection. Covers " +
      "C2 beaconing, lateral movement, persistence, exfiltration TTPs. Set environment and technique.",
    promptSnippet: "Hunt for threats — auto-matches the best cybersec skill",
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
      "Malware analysis workflow: static → dynamic → reverse engineering → IOC extraction → family " +
      "classification. Covers PE/ELF/Mach-O, macros, scripts, mobile. Set analysis_type. /ioc every extracted indicator.",
    promptSnippet: "Analyze a malware sample — auto-matches the best cybersec skill",
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
      "Digital forensics: disk, memory, network forensics, log analysis, timeline reconstruction. Covers " +
      "Windows, Linux, macOS. Set evidence_type and objective.",
    promptSnippet: "Perform digital forensics — auto-matches the best cybersec skill",
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
      "Detection engineering: write Sigma/YARA rules, design SIEM use cases, tune alerts, build SOAR playbooks. " +
      "Mapped to MITRE ATT&CK. Set technique (ATT&CK ID) and rule_type.",
    promptSnippet: "Build detection rules — auto-matches the best cybersec skill",
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
      "System hardening: OS, container, network, application, and Active Directory hardening. Based on CIS " +
      "Benchmarks, STIG, best practices. Set target_type and benchmark.",
    promptSnippet: "Harden a system — auto-matches the best cybersec skill",
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
      "Compliance audit & governance: ISO 27001, SOC 2, PCI DSS, HIPAA, GDPR, NIST CSF, CMMC. Gap analysis, " +
      "control mapping, evidence collection. Set framework and scope.",
    promptSnippet: "Audit against a compliance framework — auto-matches the best cybersec skill",
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
      "Defensive cloud audit: IAM review, storage-bucket config, network ACLs, Kubernetes security, serverless, " +
      "logging. Covers AWS, Azure, GCP. Set provider and scope.",
    promptSnippet: "Audit cloud security posture — auto-matches the best cybersec skill",
    parameters: Type.Object({
      provider: StringEnum(CLOUD_PROVIDER, { description: "Cloud provider" }),
      scope: Type.Array(StringEnum(CLOUD_SCOPE), { description: "Audit scope" }),
      compliance: Type.Optional(StringEnum(CLOUD_COMPLIANCE)),
    }),
    buildKeywords: kwCloud,
  },
];
