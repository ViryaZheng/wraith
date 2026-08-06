# WRAITH 👻 + AEGIS 🛡️

> Two security agents, one engine.  🔴 **Wraith** (red team, offense) and 🔵 **Aegis** (blue team, defense) for [pi](https://pi.dev). Self-contained, offline, built for Kali.

Same engine — the [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library (817 workflows, Apache 2.0) behind 10 typed tools — driven by two identities picked at launch. Plain `pi` stays a clean coding agent.

```bash
pi        # ⚪ plain pi — untouched, clean coding agent
wraith    # 🔴 red team  — matrix green — 9-phase kill chain — offensive skills
aegis     # 🔵 blue team — ice blue     — 8-phase defense    — defensive skills
```

## Install

```bash
git clone <this repo> ~/Wraith      # or copy the ~/Wraith folder over
cd ~/Wraith && ./install.sh
source ~/.zshrc
```
`install.sh` links the themes, wires the `wraith`/`aegis` shell commands, and confirms the bundled 817-skill library. On Kali the underlying tools (nmap/sqlmap/metasploit/bloodhound…) are already there.

## How it works — step by step, one phase at a time

Each agent walks a fixed main line, **one phase at a time, you set the pace**:

```
/engage <target>   lock target, run phase 1, then STOP
/next              advance one phase (it summarizes, then waits for you again)
/report            jump to the report
```

**🔴 Wraith — 9-phase kill chain (MITRE ATT&CK aligned)**
`RECON → ACCESS → EXECUTE → PERSIST → ESCALATE → CREDS → LATERAL → IMPACT → REPORT`

**🔵 Aegis — 8-phase defense (IR + threat hunting)**
`DETECT → TRIAGE → HUNT → INVESTIGATE → CONTAIN → ERADICATE → HARDEN → REPORT`

Each phase auto-pulls the right skills from the 817-workflow library. You can also just talk naturally ("grab the creds", "hunt for C2 beacons") — the persona maps it to the right tool.

## Commands

| Command | Does |
|---------|------|
| `/engage <target>` | Start an engagement at phase 1 |
| `/next` | Advance one phase |
| `/list [kw]` | List skills for the current phase (or a keyword) |
| `/phases` | Show the whole main line + where you are |
| `/report` | Write the report |
| `/arsenal [kw]` | Browse this team's skill library |
| `/help` | How to use |

## Architecture

```
~/Wraith/   (self-contained, copy-and-go)
├── wraith/index.ts       ← 🔴 red team entry   (calls the engine with team="red")
├── aegis/index.ts        ← 🔵 blue team entry  (team="blue")
├── engine/wraith.ts      ← shared engine: 10 tools, skill index, phase machine, RED/BLUE identities
├── cybersec-skills/skills/  ← 817 SKILL.md workflows (vendored, offline)
├── themes/matrix.json    ← 🔴 green skin   ·   themes/aegis.json ← 🔵 ice-blue skin
└── install.sh            ← links themes, wires wraith/aegis commands, isolated config per agent
```

- **One engine, two agent folders.** `wraith/` and `aegis/` are thin entries that call the shared `engine/` with their team; that fixes persona, main line, banner, theme, tools, and which skills are indexed. They never run at once, so they never collide.
- **Tools split by team.** Red exposes offensive tools (penetration_test, vulnerability_assessment, cloud_security_audit); blue exposes defensive ones (incident_response, threat_hunt, malware_analysis, forensic_analysis, detection_engineering, security_hardening, compliance_audit, cloud_security_audit).
- **Skills split by team.** Red indexes offensive/technical subdomains (~447 skills), blue defensive/ops/forensics (~370), read from each SKILL.md's `subdomain`.
- **Isolated config per agent.** Each agent runs under its own `~/.pi-wraith` / `~/.pi-aegis` (own theme so the header color matches; auth/models symlinked from `~/.pi/agent`). Plain `pi` stays untouched.
- **Retrieval.** Skill dir names are tokenized into an inverted index; each tool maps its structured params to weighted keywords and returns the top-scoring workflow.
- **Bundled & offline.** The 817-skill library ships inside the package; the extension locates it via `__dirname`, falling back to `~/.pi/agent/cybersec-skills`.

## Rules of engagement

Both agents are scoped to **authorized targets only** (authorized pentests / your own or lab systems / CTFs), with authorization confirmed before acting. Use responsibly.

## License

MIT (extension code). The [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library is Apache 2.0 by its authors.
