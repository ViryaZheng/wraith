<div align="center">

# WRAITH 🔴 + AEGIS 🔵

**Two independent security agents for [pi](https://pi.dev) — one command to install.**

🔴 **Wraith** · red team (offense)  ·  🔵 **Aegis** · blue team (defense)

*Self-contained · offline · built for Kali · plain `pi` stays clean.*

</div>

---

Two **separate products** — each with its own persona, its own tools, and its own set of skills carved from the [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library (Apache 2.0): **447 offensive workflows** ship with Wraith, **370 defensive** with Aegis. They share **no code and no skills** — each product carries only what its team needs. One installer sets both up on `pi` while leaving plain `pi` untouched.

**They run the skills, they don't just recite them.** On Kali, each agent selects the right workflow, checks the toolchain it needs, then **actually executes the Kali-native commands** (nmap, sqlmap, BloodHound, Volatility, YARA, …), reads the real output, and reasons forward — one phase at a time, at your pace. Every skill also ships a Python `scripts/agent.py` used as a fallback when a native tool is missing.

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

The installer sets up an isolated config per agent, wires the `wraith` / `aegis` shell commands, links the themes, confirms the bundled 817-skill library, **checks your Kali toolchain** (and prints the `apt install` line for anything missing), and drops an optional API-keys template at `~/.wraith/keys.env`. On Kali the underlying tools (nmap/sqlmap/metasploit/bloodhound…) are already there. It also offers to `pip install` the optional Python fallback deps (`wraith/requirements.txt`, `aegis/requirements.txt`) — skip it unless you want the `agent.py` fallbacks. Update later with `git -C ~/Wraith pull`.

**API keys (optional):** a few skills enrich results from external services (Shodan, VirusTotal, HIBP, MISP, Splunk…). Fill in only the ones you need in `~/.wraith/keys.env` — the `wraith` / `aegis` commands source it automatically. Everything works without keys.

## How each agent works — one phase at a time, you set the pace

```
/engage <target>   lock the target — asks you to confirm authorization
/engage            (no arg) confirm authorization → runs phase 1, then STOPs
/next              advance one phase (it summarizes, then waits for you again)
/report            jump to the report
```

Nothing runs against a target until you confirm authorization: `/engage <target>` arms it, a second `/engage` confirms and starts. Each phase then **runs** its tools, reads the output, and stops for your `/next`.

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
- **Retrieval.** Skill folder names **and** each SKILL.md's frontmatter (`description`, `tags`, `subdomain`, `mitre_attack`) are tokenized into a weighted inverted index, plus an offline **synonym layer** so shorthand ("creds", "privesc", "beacon") reaches the canonical skill. You can search by **ATT&CK technique id** too — `/find T1003` finds the credential-dumping skills.
- **Execution + preflight.** When a tool selects a skill, it runs a read-only `command -v` **preflight** over the Kali tools that workflow references (reporting present/missing with an `apt install` hint), then hands the agent an explicit *execute* directive: run the native commands via bash, read real output, advance — never just print them.
- **Isolated config per agent.** Each runs under its own `~/.pi-wraith` / `~/.pi-aegis` (own theme; auth/models symlinked from `~/.pi/agent`). Plain `pi` stays untouched.

## Rules of engagement

Both agents are scoped to **authorized targets only** (authorized pentests / your own or lab systems / CTFs). Authorization is enforced by a two-step `/engage` gate — the agent will not run anything against a target until you confirm — and the persona refuses unauthorized real targets, mass/indiscriminate attacks, and detection-evasion for malicious purposes. These agents execute real offensive/defensive commands: run them only where you have written permission. Use responsibly.

## License

MIT (extension code). The [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library is Apache 2.0 by its authors.
