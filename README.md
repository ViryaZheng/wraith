# pi-cybersec 🛡️

Cybersecurity toolkit extension for [pi coding agent](https://pi.dev) — 10 function-calling tools powered by the [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library (817 skills, Apache 2.0).

## How it works

Each of the 10 tools is a **function-calling entry point** that:

1. Takes structured parameters (target, scope, phase, etc.)
2. Searches the 817-skill library for the best-matching SKILL.md
3. Returns the full skill workflow — including **real tool commands** (Nessus, Volatility, Burp Suite, BloodHound, etc.)
4. The model then executes the workflow using bash and other tools

> **No stubs.** Every tool returns production-grade guidance from the skills library.

## Tools

| Tool | Maps to skills like... |
|------|----------------------|
| `vulnerability_assessment` | `performing-vulnerability-scanning-with-nessus`, `scanning-docker-images-with-trivy`, `performing-web-application-scanning-with-nikto` |
| `penetration_test` | `performing-web-application-penetration-test`, `conducting-internal-network-penetration-test`, `exploiting-vulnerabilities-with-metasploit-framework` |
| `incident_response` | `performing-ransomware-response`, `investigating-phishing-email-incident`, `conducting-cloud-incident-response` |
| `threat_hunt` | `hunting-for-cobalt-strike-beacons`, `hunting-for-lateral-movement-via-wmi`, `performing-threat-hunting-with-elastic-siem` |
| `malware_analysis` | `analyzing-memory-dumps-with-volatility`, `reverse-engineering-malware-with-ghidra`, `performing-automated-malware-analysis-with-cape` |
| `cloud_security_audit` | `auditing-aws-s3-bucket-permissions`, `performing-gcp-security-assessment-with-forseti`, `auditing-kubernetes-cluster-rbac` |
| `compliance_audit` | `implementing-iso-27001-information-security-management`, `performing-soc2-type2-audit-preparation`, `performing-nist-csf-maturity-assessment` |
| `security_hardening` | `hardening-linux-endpoint-with-cis-benchmark`, `hardening-docker-containers-for-production`, `configuring-ldap-security-hardening` |
| `detection_engineering` | `building-detection-rules-with-sigma`, `performing-yara-rule-development-for-detection`, `implementing-siem-use-cases-for-detection` |
| `forensic_analysis` | `performing-memory-forensics-with-volatility3`, `performing-disk-forensics-investigation`, `analyzing-windows-registry-for-artifacts` |

## Prerequisites

Install the skills library:

```bash
git clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills \
  ~/.pi/agent/cybersec-skills
```

Or set a custom path:

```bash
export CYBERSEC_SKILLS_PATH=/your/custom/path/skills
```

## Install

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

Once installed, the 10 tools are available to the LLM automatically:

```
Run a vulnerability assessment on example.com for web_app and api scopes
```

```
Execute a penetration test against 192.168.1.0/24, starting with recon phase
```

```
Analyze the malware sample at /samples/suspicious.exe with full analysis
```

### Commands

| Command | Description |
|---------|-------------|
| `/cybersec-list [keyword]` | List available skills, optionally filtered by keyword |

## Architecture

```
User prompt
    │
    ▼
LLM decides to call vulnerability_assessment(target, scope)
    │
    ▼
pi-cybersec tool handler
    │
    ├─► Searches ~/.pi/agent/cybersec-skills/skills/
    │   for best-matching SKILL.md
    │
    ├─► Loads and returns full skill workflow
    │   (with real commands for Nessus, Nmap, etc.)
    │
    ▼
LLM reads the workflow and executes
commands via bash tool
```

## License

MIT — Extension code

The skills library is [Apache 2.0](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) licensed by its authors.
