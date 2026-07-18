/**
 * pi-cybersec — Cybersecurity Toolkit Extension for pi Coding Agent
 *
 * Registers 10 cybersecurity tools covering the full security lifecycle:
 *   vulnerability_assessment, penetration_test, incident_response,
 *   threat_hunt, malware_analysis, cloud_security_audit,
 *   compliance_audit, security_hardening, detection_engineering,
 *   forensic_analysis
 *
 * Each tool follows a structured workflow pattern and maps to
 * industry-standard frameworks (MITRE ATT&CK, OWASP, NIST, CIS, PTES).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

// ─── Shared enums ───────────────────────────────────────────────────────────

const SeverityEnum = StringEnum(["critical", "high", "medium", "low", "all"] as const);

// ─── 1. vulnerability_assessment ────────────────────────────────────────────

const VULN_ASSESSMENT_SCOPES = [
  "web_app", "api", "network", "container",
  "mobile", "dependency", "config", "secret", "cloud",
] as const;

const VULN_FRAMEWORKS = [
  "owasp_top10", "cwe_top25", "nist", "cis", "custom",
] as const;

// ─── 2. penetration_test ────────────────────────────────────────────────────

const PENTEST_PHASES = [
  "recon", "scanning", "exploitation", "privilege_escalation",
  "lateral_movement", "persistence", "exfiltration", "cleanup", "full",
] as const;

const PENTEST_ENVS = [
  "web", "internal_network", "active_directory", "cloud", "mobile",
] as const;

const PENTEST_FRAMEWORKS = [
  "mitre_attack", "ptes", "owasp", "nist",
] as const;

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

const MALWARE_ANALYSIS_TYPES = [
  "static", "dynamic", "reverse_engineering", "full",
] as const;

const MALWARE_PLATFORMS = [
  "windows", "linux", "macos", "android", "ios", "unknown",
] as const;

// ─── 6. cloud_security_audit ────────────────────────────────────────────────

const CLOUD_PROVIDERS = ["aws", "azure", "gcp", "kubernetes", "multi"] as const;

const CLOUD_SCOPES = [
  "iam", "storage", "network", "compute",
  "kubernetes", "serverless", "database", "logging", "secrets",
] as const;

const CLOUD_COMPLIANCE = [
  "cis", "nist", "soc2", "pci_dss", "hipaa", "custom",
] as const;

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

// ─── 10. forensic_analysis ──────────────────────────────────────────────────

const FORENSIC_EVIDENCE_TYPES = [
  "disk_image", "memory_dump", "network_capture", "log_files",
  "registry_hive", "email_archive", "mobile_device", "cloud_logs",
] as const;

const FORENSIC_OBJECTIVES = [
  "timeline_reconstruction", "malware_investigation",
  "data_recovery", "user_activity", "intrusion_analysis", "full",
] as const;

// ─── Extension entry point ──────────────────────────────────────────────────

export default function cybersecExtension(pi: ExtensionAPI) {
  // ── 1. vulnerability_assessment ─────────────────────────────────────────

  pi.registerTool({
    name: "vulnerability_assessment",
    label: "Vulnerability Assessment",
    description:
      "对目标系统进行全面的漏洞评估：CVE 扫描、OWASP Top 10 检测、依赖审计、配置审查、CVSS 评分。" +
      "覆盖 Web 应用、网络、容器、API、移动端。",
    promptSnippet: "Scan target for vulnerabilities (CVE, OWASP, dependency, config, CVSS scoring)",
    promptGuidelines: [
      "使用 vulnerability_assessment 对目标进行漏洞评估时，指定 target 和 scope",
    ],
    parameters: Type.Object({
      target: Type.String({ description: "评估目标：目录路径、URL、IP 地址、容器镜像名" }),
      scope: Type.Array(
        StringEnum(VULN_ASSESSMENT_SCOPES),
        { description: "评估范围" },
      ),
      severity: Type.Optional(
        SeverityEnum,
      ),
      framework: Type.Optional(
        StringEnum(VULN_FRAMEWORKS),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { target, scope, severity, framework } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Vulnerability Assessment`,
            ``,
            `**Target:** \`${target}\``,
            `**Scope:** ${scope.join(", ")}`,
            severity ? `**Severity filter:** ${severity}` : "",
            framework ? `**Framework:** ${framework}` : "",
            ``,
            `> ⚠️ This is a stub implementation. To make this tool functional,`,
            `> integrate with scanners such as Trivy, Nuclei, OWASP ZAP, Snyk,`,
            `> or custom vulnerability databases.`,
            ``,
            `### Recommended workflow:`,
            `1. **Reconnaissance** — identify assets, open ports, running services`,
            `2. **CVE Scanning** — match software versions against CVE databases (NVD, OSV)`,
            `3. **OWASP Top 10** — test for injection, broken auth, SSRF, XSS, etc.`,
            `4. **Dependency Audit** — check third-party libraries (npm audit, pip audit, OWASP Dependency-Check)`,
            `5. **Config Review** — check for misconfigurations (CIS benchmarks)`,
            `6. **CVSS Scoring** — assign severity scores per CVSS v3.1/v4.0`,
            `7. **Report** — generate findings with remediation steps`,
          ].filter(Boolean).join("\n"),
        }],
        details: { target, scope, severity, framework, status: "stub" },
      };
    },
  });

  // ── 2. penetration_test ─────────────────────────────────────────────────

  pi.registerTool({
    name: "penetration_test",
    label: "Penetration Test",
    description:
      "执行体系化渗透测试：信息收集 → 漏洞利用 → 权限提升 → 横向移动 → 持久化 → 清理痕迹。" +
      "覆盖 Web、内网、AD、云、移动端。",
    promptSnippet: "Execute penetration test following PTES methodology",
    promptGuidelines: [
      "使用 penetration_test 执行渗透测试时，指定 target 和 phase",
    ],
    parameters: Type.Object({
      target: Type.String({ description: "渗透目标：IP、域名、URL 或 IP 范围" }),
      phase: Type.Optional(
        StringEnum(PENTEST_PHASES),
      ),
      environment: Type.Optional(
        StringEnum(PENTEST_ENVS),
      ),
      framework: Type.Optional(
        StringEnum(PENTEST_FRAMEWORKS),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { target, phase, environment, framework } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Penetration Test`,
            ``,
            `**Target:** \`${target}\``,
            `**Phase:** ${phase ?? "full"}`,
            environment ? `**Environment:** ${environment}` : "",
            framework ? `**Framework:** ${framework}` : "",
            ``,
            `> ⚠️ This is a stub implementation. Integrate with tools like`,
            `> Metasploit, Impacket, BloodHound, CrackMapExec, Burp Suite,`,
            `> or custom exploit frameworks.`,
            ``,
            `### PTES Phases:`,
            `1. **Recon** — OSINT, DNS enumeration, subdomain discovery, port scanning`,
            `2. **Scanning** — service enumeration, version detection, vulnerability mapping`,
            `3. **Exploitation** — exploit known vulns, default creds, misconfigurations`,
            `4. **Privilege Escalation** — local/domain privilege escalation techniques`,
            `5. **Lateral Movement** — pivot through network, pass-the-hash/ticket`,
            `6. **Persistence** — backdoors, scheduled tasks, registry modifications`,
            `7. **Exfiltration** — data staging and extraction simulation`,
            `8. **Cleanup** — remove artifacts, restore configurations`,
          ].filter(Boolean).join("\n"),
        }],
        details: { target, phase, environment, framework, status: "stub" },
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
    promptSnippet: "Execute incident response workflow (detection → containment → eradication → recovery)",
    promptGuidelines: [
      "使用 incident_response 处理安全事件时，指定 incident_type 和 phase",
    ],
    parameters: Type.Object({
      incident_type: StringEnum(INCIDENT_TYPES, {
        description: "事件类型",
      }),
      phase: Type.Optional(
        StringEnum(IR_PHASES),
      ),
      severity: Type.Optional(
        SeverityEnum,
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { incident_type, phase, severity } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Incident Response`,
            ``,
            `**Type:** ${incident_type}`,
            `**Phase:** ${phase ?? "full"}`,
            severity ? `**Severity:** ${severity}` : "",
            ``,
            `> ⚠️ This is a stub implementation. Integrate with SIEM/SOAR platforms,`,
            `> EDR tools, and incident management systems.`,
            ``,
            `### NIST IR Lifecycle:`,
            `1. **Detection** — identify and validate the incident via alerts, logs, IOCs`,
            `2. **Containment** — isolate affected systems, block C2, revoke credentials`,
            `3. **Eradication** — remove malware, patch vulnerabilities, harden systems`,
            `4. **Recovery** — restore from clean backups, verify integrity, monitor`,
            `5. **Lessons Learned** — post-incident review, update playbooks, improve detections`,
          ].filter(Boolean).join("\n"),
        }],
        details: { incident_type, phase, severity, status: "stub" },
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
    promptSnippet: "Proactive threat hunting based on hypotheses, IOCs, and behavioral analysis",
    promptGuidelines: [
      "使用 threat_hunt 进行威胁狩猎时，指定 environment 和 technique",
    ],
    parameters: Type.Object({
      environment: StringEnum(HUNT_ENVS, {
        description: "狩猎环境",
      }),
      technique: Type.Optional(
        StringEnum(HUNT_TECHNIQUES),
      ),
      hypothesis: Type.Optional(Type.String()),
      time_range: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { environment, technique, hypothesis, time_range } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Threat Hunt`,
            ``,
            `**Environment:** ${environment}`,
            technique ? `**Technique:** ${technique}` : "",
            hypothesis ? `**Hypothesis:** ${hypothesis}` : "",
            time_range ? `**Time Range:** ${time_range}` : "",
            ``,
            `> ⚠️ This is a stub implementation. Integrate with EDR telemetry,`,
            `> SIEM queries, network flow data, and threat intelligence feeds.`,
            ``,
            `### Hunting Methodology:`,
            `1. **Hypothesis Formation** — define what TTPs to hunt for based on threat intel`,
            `2. **Data Collection** — gather logs, flows, endpoint telemetry, auth events`,
            `3. **Analysis** — search for IOCs, behavioral anomalies, MITRE ATT&CK TTPs`,
            `4. **Triage** — validate findings, eliminate false positives`,
            `5. **Response** — escalate confirmed threats to incident response`,
          ].filter(Boolean).join("\n"),
        }],
        details: { environment, technique, hypothesis, time_range, status: "stub" },
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
    promptSnippet: "Analyze malware samples — static, dynamic, reverse engineering, IOC extraction",
    promptGuidelines: [
      "使用 malware_analysis 分析恶意软件时，指定 sample_path 和 analysis_type",
    ],
    parameters: Type.Object({
      sample_path: Type.String({ description: "恶意软件样本路径或哈希值" }),
      analysis_type: Type.Optional(
        StringEnum(MALWARE_ANALYSIS_TYPES),
      ),
      platform: Type.Optional(
        StringEnum(MALWARE_PLATFORMS),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { sample_path, analysis_type, platform } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Malware Analysis`,
            ``,
            `**Sample:** \`${sample_path}\``,
            `**Analysis Type:** ${analysis_type ?? "full"}`,
            platform ? `**Platform:** ${platform}` : "",
            ``,
            `> ⚠️ This is a stub implementation. Integrate with sandbox environments,`,
            `> disassemblers (IDA Pro, Ghidra), YARA rules, and threat intel platforms.`,
            ``,
            `### Analysis Workflow:`,
            `1. **Static Analysis** — file hashes, strings, PE/ELF headers, imports, YARA matching`,
            `2. **Dynamic Analysis** — sandbox execution, API calls, network traffic, process tree`,
            `3. **Reverse Engineering** — disassembly, decompilation, unpacking`,
            `4. **IOC Extraction** — domains, IPs, URLs, file hashes, mutexes, registry keys`,
            `5. **Family Classification** — match against known malware families`,
          ].filter(Boolean).join("\n"),
        }],
        details: { sample_path, analysis_type, platform, status: "stub" },
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
    promptSnippet: "Audit cloud security — IAM, storage, network, K8s, serverless (AWS/Azure/GCP)",
    promptGuidelines: [
      "使用 cloud_security_audit 审计云环境时，指定 provider 和 scope",
    ],
    parameters: Type.Object({
      provider: StringEnum(CLOUD_PROVIDERS, {
        description: "云提供商",
      }),
      scope: Type.Array(
        StringEnum(CLOUD_SCOPES),
        { description: "审计范围" },
      ),
      compliance: Type.Optional(
        StringEnum(CLOUD_COMPLIANCE),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { provider, scope, compliance } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Cloud Security Audit`,
            ``,
            `**Provider:** ${provider}`,
            `**Scope:** ${scope.join(", ")}`,
            compliance ? `**Compliance:** ${compliance}` : "",
            ``,
            `> ⚠️ This is a stub implementation. Integrate with cloud SDKs,`,
            `> Prowler, ScoutSuite, kube-bench, Trivy, or cloud-native security tools.`,
            ``,
            `### Audit Areas:`,
            `1. **IAM** — overly permissive roles, unused credentials, MFA enforcement`,
            `2. **Storage** — public buckets, encryption at rest, versioning, access logs`,
            `3. **Network** — open security groups, NACL rules, VPC flow logs`,
            `4. **Compute** — instance metadata, IMDSv2, patch status`,
            `5. **Kubernetes** — RBAC, pod security, network policies, secrets management`,
            `6. **Serverless** — function permissions, environment variables, timeout configs`,
            `7. **Database** — encryption, public accessibility, backup retention`,
            `8. **Logging** — CloudTrail/Audit Logs, retention, alerting`,
            `9. **Secrets** — hardcoded secrets, secret rotation, KMS usage`,
          ].filter(Boolean).join("\n"),
        }],
        details: { provider, scope, compliance, status: "stub" },
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
    promptSnippet: "Audit compliance against frameworks (ISO 27001, SOC 2, PCI DSS, HIPAA, GDPR, NIST)",
    promptGuidelines: [
      "使用 compliance_audit 进行合规审计时，指定 framework 和 scope",
    ],
    parameters: Type.Object({
      framework: StringEnum(COMPLIANCE_FRAMEWORKS, {
        description: "合规框架",
      }),
      scope: Type.Optional(
        StringEnum(COMPLIANCE_SCOPES),
      ),
      target_system: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { framework, scope, target_system } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Compliance Audit`,
            ``,
            `**Framework:** ${framework}`,
            `**Scope:** ${scope ?? "full"}`,
            target_system ? `**Target System:** ${target_system}` : "",
            ``,
            `> ⚠️ This is a stub implementation. Integrate with GRC platforms,`,
            `> compliance scanners, and evidence collection tools.`,
            ``,
            `### Audit Activities:`,
            `1. **Gap Analysis** — compare current controls against framework requirements`,
            `2. **Control Mapping** — map existing controls to framework controls`,
            `3. **Evidence Collection** — gather policies, configs, logs, screenshots`,
            `4. **Risk Assessment** — identify and rate compliance gaps`,
            `5. **Remediation Plan** — prioritize and track remediation actions`,
          ].filter(Boolean).join("\n"),
        }],
        details: { framework, scope, target_system, status: "stub" },
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
    promptSnippet: "Harden systems based on CIS Benchmarks, STIG, and best practices",
    promptGuidelines: [
      "使用 security_hardening 加固系统时，指定 target 和 benchmark",
    ],
    parameters: Type.Object({
      target: Type.String({ description: "加固目标：系统路径、容器名、服务名" }),
      target_type: StringEnum(HARDENING_TARGETS, {
        description: "目标类型",
      }),
      benchmark: Type.Optional(
        StringEnum(HARDENING_BENCHMARKS),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { target, target_type, benchmark } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Security Hardening`,
            ``,
            `**Target:** \`${target}\``,
            `**Type:** ${target_type}`,
            `**Benchmark:** ${benchmark ?? "cis"}`,
            ``,
            `> ⚠️ This is a stub implementation. Integrate with configuration`,
            `> management tools (Ansible, Chef, Puppet), CIS-CAT, Lynis,`,
            `> or OS-specific hardening scripts.`,
            ``,
            `### Hardening Categories:`,
            `1. **OS Hardening** — kernel parameters, file permissions, service minimization`,
            `2. **Container Hardening** — non-root users, read-only filesystems, seccomp/AppArmor`,
            `3. **Network Hardening** — firewall rules, TLS configuration, SSH hardening`,
            `4. **Application Hardening** — security headers, input validation, CSP`,
            `5. **Database Hardening** — authentication, encryption, audit logging`,
            `6. **AD Hardening** — LAPS, tiered admin, GPO review, Kerberos hardening`,
          ].filter(Boolean).join("\n"),
        }],
        details: { target, target_type, benchmark, status: "stub" },
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
    promptSnippet: "Build detection rules (Sigma, YARA, SIEM queries) mapped to MITRE ATT&CK",
    promptGuidelines: [
      "使用 detection_engineering 构建检测时，指定 technique 和 rule_type",
    ],
    parameters: Type.Object({
      technique: Type.String({ description: "MITRE ATT&CK 技术 ID，如 T1059.001、T1003.001" }),
      rule_type: StringEnum(DETECTION_RULE_TYPES, {
        description: "规则类型",
      }),
      environment: Type.Optional(
        StringEnum(DETECTION_ENVS),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { technique, rule_type, environment } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Detection Engineering`,
            ``,
            `**Technique:** \`${technique}\``,
            `**Rule Type:** ${rule_type}`,
            environment ? `**Environment:** ${environment}` : "",
            ``,
            `> ⚠️ This is a stub implementation. Integrate with Sigma CLI,`,
            `> YARA compiler, SIEM query languages, and detection-as-code pipelines.`,
            ``,
            `### Detection Engineering Workflow:`,
            `1. **Technique Analysis** — study MITRE ATT&CK technique, data sources, procedures`,
            `2. **Rule Authoring** — write detection logic in target format`,
            `3. **Testing** — validate against known-good and known-bad data`,
            `4. **Tuning** — adjust thresholds, add allowlists, reduce false positives`,
            `5. **Deployment** — push to SIEM/EDR, enable alerting, create runbooks`,
          ].filter(Boolean).join("\n"),
        }],
        details: { technique, rule_type, environment, status: "stub" },
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
    promptSnippet: "Perform digital forensics — disk, memory, network, logs, timeline reconstruction",
    promptGuidelines: [
      "使用 forensic_analysis 进行取证时，指定 evidence_type 和 target",
    ],
    parameters: Type.Object({
      evidence_type: StringEnum(FORENSIC_EVIDENCE_TYPES, {
        description: "证据类型",
      }),
      target: Type.String({ description: "证据文件路径" }),
      objective: Type.Optional(
        StringEnum(FORENSIC_OBJECTIVES),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { evidence_type, target, objective } = params;
      return {
        content: [{
          type: "text",
          text: [
            `## Forensic Analysis`,
            ``,
            `**Evidence Type:** ${evidence_type}`,
            `**Target:** \`${target}\``,
            `**Objective:** ${objective ?? "full"}`,
            ``,
            `> ⚠️ This is a stub implementation. Integrate with forensic tools`,
            `> (Autopsy/Sleuth Kit, Volatility, Wireshark, Plaso/log2timeline),`,
            `> and evidence management systems.`,
            ``,
            `### Forensic Workflow:`,
            `1. **Evidence Acquisition** — create forensic images, preserve chain of custody`,
            `2. **Triage** — identify key artifacts based on objective`,
            `3. **Analysis** — examine filesystem, registry, memory, network captures, logs`,
            `4. **Timeline Reconstruction** — correlate events across data sources`,
            `5. **Reporting** — document findings, IOCs, and timeline`,
          ].filter(Boolean).join("\n"),
        }],
        details: { evidence_type, target, objective, status: "stub" },
      };
    },
  });

  // ── Startup notification ─────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(
      "🛡️ pi-cybersec loaded — 10 security tools available",
      "info",
    );
  });
}
