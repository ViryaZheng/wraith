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
├── extensions/wraith.ts        ← one engine; WRAITH_TEAM env picks RED (Wraith) or BLUE (Aegis)
├── cybersec-skills/skills/      ← 817 SKILL.md workflows (vendored, offline)
├── themes/matrix.json           ← 🔴 red skin (green)
├── themes/aegis.json            ← 🔵 blue skin (ice blue)
└── install.sh
```

- **One engine, two agents.** `wraith`/`aegis` launch the same extension with `WRAITH_TEAM=red|blue`; that switches persona, main line, banner, theme, and which skills are indexed. They never run at once, so they never collide.
- **Skills split by team.** Red indexes the offensive/technical subdomains (~447 skills), blue the defensive/ops/forensics ones (~370), by reading each SKILL.md's `subdomain`.
- **Retrieval.** Skill dir names are tokenized into an inverted index; each tool maps its structured params to weighted keywords and returns the top-scoring workflow.
- **Bundled & offline.** The 817-skill library ships inside the package; the extension locates it via `__dirname`, falling back to `~/.pi/agent/cybersec-skills`.

## Rules of engagement

Both agents are scoped to **authorized targets only** (authorized pentests / your own or lab systems / CTFs), with authorization confirmed before acting. Use responsibly.

## License

MIT (extension code). The [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) library is Apache 2.0 by its authors.
