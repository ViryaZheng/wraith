# pi-cybersec 🛡️

Cybersecurity toolkit extension for [pi coding agent](https://pi.dev) — 10 professional security tools covering the full security lifecycle.

## Tools

| Tool | Description | Frameworks |
|------|-------------|------------|
| `vulnerability_assessment` | CVE 扫描、OWASP Top 10、依赖审计、CVSS 评分 | OWASP, CWE, NIST, CIS |
| `penetration_test` | 体系化渗透测试 (recon → exploitation → cleanup) | PTES, MITRE ATT&CK, OWASP |
| `incident_response` | 安全事件响应 (detection → containment → recovery) | NIST IR |
| `threat_hunt` | 主动威胁狩猎，基于假设驱动和 IOC 搜索 | MITRE ATT&CK |
| `malware_analysis` | 恶意软件分析 (static/dynamic/reverse engineering) | — |
| `cloud_security_audit` | 云安全审计 (IAM, storage, network, K8s) | CIS, NIST, SOC2, PCI DSS |
| `compliance_audit` | 合规审计 (ISO 27001, SOC 2, PCI DSS, HIPAA, GDPR) | ISO, NIST CSF, CMMC |
| `security_hardening` | 系统安全加固 (OS, container, network, AD) | CIS Benchmark, STIG |
| `detection_engineering` | 检测规则构建 (Sigma, YARA, SIEM queries) | MITRE ATT&CK |
| `forensic_analysis` | 数字取证 (disk, memory, network, timeline) | — |

## Install

### From npm (once published)

```bash
pi install npm:pi-cybersec
```

### From GitHub

```bash
pi install git:github.com/YOUR_USER/pi-cybersec
```

### Local development

```bash
git clone https://github.com/YOUR_USER/pi-cybersec
pi install ./pi-cybersec
```

Or test without installing:

```bash
pi -e ./pi-cybersec/extensions/cybersec.ts
```

## Usage

Once installed, the 10 tools are available to the LLM automatically. You can also invoke them explicitly:

```
Run a vulnerability assessment on example.com for web_app and api scopes
```

```
Execute a penetration test against 192.168.1.0/24, starting with recon phase
```

```
Analyze the malware sample at /samples/suspicious.exe with full analysis
```

## ⚠️ Current Status: Stub Implementation

This package currently provides **tool schemas and workflow guidance** — the LLM receives structured tool definitions with detailed workflow steps. The actual execution backends (scanners, exploit frameworks, sandboxes, etc.) need to be integrated.

### Making tools functional

Each tool's `execute()` function is a stub. To make a tool functional, replace the stub with real integration code. For example:

```typescript
// vulnerability_assessment — integrate with Trivy
async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
  onUpdate?.({ content: [{ type: "text", text: "Scanning with Trivy..." }] });
  const result = await execAsync(`trivy fs --severity ${params.severity} ${params.target}`);
  return {
    content: [{ type: "text", text: result.stdout }],
    details: { scanResult: result },
  };
}
```

## Package Structure

```
pi-cybersec/
├── package.json          # pi package manifest
├── extensions/
│   └── cybersec.ts       # Main extension (all 10 tools)
├── LICENSE               # MIT
└── README.md
```

## Contributing

Contributions welcome! Areas to help:

1. **Implement tool backends** — integrate real security tools
2. **Add more tools** — extend the toolkit
3. **Improve workflows** — refine the step-by-step guidance
4. **Add tests** — validate tool schemas and outputs

## License

MIT
