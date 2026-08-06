<div align="center">

# WRAITH 🔴 + AEGIS 🔵

**Two independent security agents for [pi](https://pi.dev) — one command to install.**

🔴 **Wraith** · red team (offense)  ·  🔵 **Aegis** · blue team (defense)

*Self-contained · offline · built for Kali · plain `pi` stays clean.*

</div>

---

Two **separate products** — each with its own persona, its own tools, and its own set of skills carved from the [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library (Apache 2.0): **447 offensive workflows** ship with Wraith, **370 defensive** with Aegis. They share **no code and no skills** — each product carries only what its team needs. One installer sets both up on `pi` while leaving plain `pi` untouched.

```bash
pi        # ⚪ plain pi — untouched, clean coding agent
wraith    # 🔴 red team  — green         — 9-phase kill chain — 7 offensive tools
aegis     # 🔵 blue team — ice blue     — 8-phase defense    — 8 defensive tools
```

## Install

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ViryaZheng/wraith/main/install.sh)"
```

Or from a local checkout:

```bash
git clone https://github.com/ViryaZheng/wraith ~/Wraith
cd ~/Wraith && ./install.sh
source ~/.zshrc
```

The installer sets up an isolated config per agent, wires the `wraith` / `aegis` shell commands, links the themes, and confirms the bundled 817-skill library. On Kali the underlying tools (nmap/sqlmap/metasploit/bloodhound…) are already there. Update later with `git -C ~/Wraith pull`.

## How each agent works — one phase at a time, you set the pace

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
| `/engage <target>` · `/next` · `/phases` · `/report` | Start · advance · show the chain · report |
| `/find <query>` | **Semantic** skill search ("dump creds from the DC") |
| `/log <note>` | Add a finding to the persisted **evidence chain** |
| `/loot [item]` 🔴 · `/ioc [item]` 🔵 | Record captured creds/hosts (red) or IOCs (blue) |
| `/evidence` · `/reset` | Show the full engagement memory · clear it |
| `/arsenal [kw]` | Browse skills — for this phase, or matching a keyword |
| `/help` | How to use |

**Long-range memory:** target, phase, evidence chain, and the loot/IOC ledger are saved to `.wraith.json` / `.aegis.json` in the working dir and **survive restarts** — a multi-day engagement resumes where it left off, and the running state feeds back into the agent every turn.

## The two products

- **🔴 Wraith (7 offensive tools):** `penetration_test`, `vulnerability_assessment`, `exploit_development`, `password_attack`, `c2_operations`, `social_engineering`, `cloud_security_audit`
- **🔵 Aegis (8 defensive tools):** `incident_response`, `threat_hunt`, `malware_analysis`, `forensic_analysis`, `detection_engineering`, `security_hardening`, `compliance_audit`, `cloud_security_audit`

## Structure

```
wraith/  (this repo — two independent agent products)
├── wraith/               🔴 red team — a complete, standalone agent
│   ├── index.ts          ·  identity, engagement memory, commands
│   ├── tools.ts          ·  7 offensive tools + red synonyms
│   ├── skill-index.ts    ·  skill-retrieval engine
│   └── skills/           ·  447 red SKILL.md workflows (vendored, offline)
├── aegis/                🔵 blue team — a complete, standalone agent (same shape)
│   └── skills/           ·  370 blue SKILL.md workflows
├── themes/               wraith.json (🔴) · aegis.json (🔵)
└── install.sh            one-command installer
```

- **Two independent products.** `wraith/` and `aegis/` share no code and no skills — each is a self-contained pi extension in three focused files plus its own skill library. Edit one without touching the other; add a third agent by dropping in a new folder.
- **Tools split by team.** Red is offense-only, blue is defense-only; `cloud_security_audit` appears on both (attack-path view vs posture view).
- **Skills split by team, physically.** The 817-workflow library is partitioned by each SKILL.md's `subdomain` into 447 offensive (Wraith) + 370 defensive (Aegis). Each product ships only its own — red never carries blue.
- **Retrieval.** Skill dir names are tokenized into an inverted index; each tool maps params to weighted keywords, plus a lightweight offline **synonym layer** so shorthand ("creds", "privesc", "beacon") reaches the canonical skill.
- **Isolated config per agent.** Each runs under its own `~/.pi-wraith` / `~/.pi-aegis` (own theme; auth/models symlinked from `~/.pi/agent`). Plain `pi` stays untouched.

## Rules of engagement

Both agents are scoped to **authorized targets only** (authorized pentests / your own or lab systems / CTFs), with authorization confirmed before acting. Use responsibly.

## License

MIT (extension code). The [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library is Apache 2.0 by its authors.
