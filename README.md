<div align="center">

# Crimson Knight 🔴

**The red-team / offensive-security agent of [Frontier Knight Labs](https://github.com/frontierknight).**

*OSCP-level attacker persona · 9-phase MITRE ATT&CK kill chain · executes Kali-native tools · offline · built for Kali.*

Runs on [pi](https://pi.dev) · blue-team counterpart: [Azure Knight 🔵](https://github.com/frontierknight/azure) · proving ground: [Knightfall](https://github.com/frontierknight)

</div>

---

Crimson Knight is an offensive-security agent: it selects the right workflow from a bundled library of **447 attack skills** (from the [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills), Apache 2.0), checks the toolchain it needs, then **actually runs the Kali-native tools** (Nmap, sqlmap, BloodHound, Impacket, Sliver, …), reads the real output, and reasons forward — one phase at a time, at your pace. It runs as a pi extension and leaves plain `pi` untouched.

## Install

Needs [pi](https://pi.dev) (Node ≥ 22) and a model configured in pi (`pi` once to sign in).

```bash
git clone https://github.com/frontierknight/crimson ~/crimson
cd ~/crimson && ./install.sh
source ~/.zshrc
crimson
```

The installer sets up an isolated config, wires the `crimson` command, checks your Kali toolchain (prints `apt install` for anything missing), and drops an optional API-keys template at `~/.frontierknight/keys.env`. On Kali the offensive tools are mostly already there.

## How it works — one phase at a time, you set the pace

```
/engage <target>   lock the target — asks you to confirm authorization
/engage            (no arg) confirm authorization → runs phase 1, then STOPs
/next              advance one phase (it summarizes, then waits for you again)
/report            jump to the report
```

**9-phase kill chain (MITRE ATT&CK aligned):**
`RECON → ACCESS → EXECUTE → PERSIST → ESCALATE → CREDS → LATERAL → IMPACT → REPORT`

Nothing runs against a target until you confirm authorization. Each phase then **runs** its tools, reads the output, and stops for your `/next`.

**7 offensive tools:** `penetration_test`, `vulnerability_assessment`, `exploit_development`, `password_attack`, `c2_operations`, `social_engineering`, `cloud_security_audit`

## Commands

| Command | Does |
|---------|------|
| `/engage <target>` · `/next` · `/phases` · `/report` | Start · advance · show the chain · report |
| `/find <query>` | Semantic skill search — also by ATT&CK id (`/find T1003`) |
| `/log <note>` · `/loot [item]` | Add a finding to the evidence chain · record captured creds/hosts |
| `/evidence` · `/reset` | Show the full engagement memory · clear it |
| `/arsenal [kw]` · `/help` | Browse skills · how to use |

Memory (target, phase, evidence chain, loot ledger) persists to `.crimson.json` in the working dir and survives restarts.

## Rules of engagement

Operate **only on authorized targets** (authorized pentests / your own or lab systems / CTFs). A two-step `/engage` gate enforces authorization before anything runs; the persona refuses unauthorized real targets, mass/indiscriminate attacks, and detection-evasion for malicious purposes. These agents execute real commands — run them only where you have written permission. Use responsibly.

## License

MIT (extension code). The bundled skills are Apache 2.0 by their authors.
