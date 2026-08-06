# WRAITH 👻 + AEGIS 🛡️

> Two **independent** security agents for [pi](https://pi.dev). 🔴 **Wraith** (red team, offense) and 🔵 **Aegis** (blue team, defense). Self-contained, offline, built for Kali.

Two separate agents — each with its own persona, its own tools, and its own slice of the [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library (817 workflows, Apache 2.0). No shared code: `wraith/` and `aegis/` each stand alone, so they evolve independently. Plain `pi` stays a clean coding agent.

```bash
pi        # ⚪ plain pi — untouched, clean coding agent
wraith    # 🔴 red team  — matrix green — 9-phase kill chain — 7 offensive tools
aegis     # 🔵 blue team — ice blue     — 8-phase defense    — 8 defensive tools
```

## Install

```bash
git clone <this repo> ~/Wraith      # or copy the ~/Wraith folder over
cd ~/Wraith && ./install.sh
source ~/.zshrc
```
`install.sh` links the themes, wires the `wraith`/`aegis` shell commands, sets up an isolated config per agent, and confirms the bundled 817-skill library. On Kali the underlying tools (nmap/sqlmap/metasploit/bloodhound…) are already there.

## How it works — one phase at a time, you set the pace

Each agent walks a fixed main line, **one phase at a time**:

```
/engage <target>   lock target, run phase 1, then STOP
/next              advance one phase (it summarizes, then waits for you again)
/report            jump to the report
```

**🔴 Wraith — 9-phase kill chain (MITRE ATT&CK aligned)**
`RECON → ACCESS → EXECUTE → PERSIST → ESCALATE → CREDS → LATERAL → IMPACT → REPORT`

**🔵 Aegis — 8-phase defense (IR + threat hunting)**
`DETECT → TRIAGE → HUNT → INVESTIGATE → CONTAIN → ERADICATE → HARDEN → REPORT`

Each phase auto-pulls the right skills from the workflow library. You can also just talk naturally ("grab the creds", "hunt for C2 beacons") — the persona maps it to the right tool.

## Commands

| Command | Does |
|---------|------|
| `/engage <target>` | Start at phase 1 |
| `/next` · `/phases` · `/report` | Advance · show the main line · write the report |
| `/find <query>` | **Semantic** skill search ("dump creds from the DC") |
| `/log <note>` | Add a finding to the persisted **evidence chain** |
| `/loot [item]` 🔴 · `/ioc [item]` 🔵 | Record captured creds/hosts (red) or IOCs (blue) |
| `/evidence` · `/reset` | Show the full engagement memory · clear it |
| `/arsenal [kw]` · `/list [kw]` | Browse the skill library |
| `/help` | How to use |

**Long-range memory:** target, phase, evidence chain, and the loot/IOC ledger are saved to `.wraith.json` / `.aegis.json` in the working dir and **survive restarts** — a multi-day engagement resumes where it left off, and the running state is fed back into the agent every turn.

## Tools

- **🔴 Wraith (7 offensive):** `penetration_test`, `vulnerability_assessment`, `exploit_development`, `password_attack`, `c2_operations`, `social_engineering`, `cloud_security_audit`
- **🔵 Aegis (8 defensive):** `incident_response`, `threat_hunt`, `malware_analysis`, `forensic_analysis`, `detection_engineering`, `security_hardening`, `compliance_audit`, `cloud_security_audit`

## Architecture

```
~/Wraith/   (self-contained, copy-and-go)
├── wraith/index.ts       ← 🔴 red team — complete, standalone agent (7 tools, red persona, 447 skills)
├── aegis/index.ts        ← 🔵 blue team — complete, standalone agent (8 tools, blue persona, 370 skills)
├── cybersec-skills/skills/  ← 817 SKILL.md workflows (vendored, offline, shared library)
├── themes/matrix.json    ← 🔴 green skin   ·   themes/aegis.json ← 🔵 ice-blue skin
└── install.sh            ← links themes, wires wraith/aegis commands, isolated config per agent
```

- **Two independent agents.** `wraith/index.ts` and `aegis/index.ts` share no code — each is a full, self-contained pi extension. Edit one without touching the other.
- **Tools split by team.** Red is offense-only, blue is defense-only; `cloud_security_audit` appears on both (attack-path view vs posture view).
- **Skills split by team.** Red indexes offensive/technical subdomains (447 skills), blue defensive/ops/forensics (370), read from each SKILL.md's `subdomain`.
- **Retrieval.** Skill dir names are tokenized into an inverted index; each tool maps its params to weighted keywords, plus a lightweight offline **synonym layer** so shorthand ("creds", "privesc", "beacon") reaches the canonical skill.
- **Isolated config per agent.** Each runs under its own `~/.pi-wraith` / `~/.pi-aegis` (own theme; auth/models symlinked from `~/.pi/agent`). Plain `pi` stays untouched.
- **Bundled & offline.** The 817-skill library ships inside the package; each agent locates it via `__dirname`, falling back to `~/.pi/agent/cybersec-skills`.

## Rules of engagement

Both agents are scoped to **authorized targets only** (authorized pentests / your own or lab systems / CTFs), with authorization confirmed before acting. Use responsibly.

## License

MIT (extension code). The [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library is Apache 2.0 by its authors.
