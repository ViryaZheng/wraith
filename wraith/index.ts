/**
 * 🔴 WRAITH — autonomous red-team / offensive-security agent (self-contained pi extension).
 *
 * This folder is ONE independent agent — no shared code with Aegis. Three files:
 *   index.ts       ← you are here: identity, engagement memory, commands, wiring
 *   tools.ts       ← the 7 offensive tools + keyword maps + red synonym table
 *   skill-index.ts ← the generic skill-retrieval engine (team-agnostic)
 *
 * Rules of engagement: authorized targets only (pentests, labs, CTFs, own assets).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SkillIndex, registerSkillTool, w, W_PRIMARY, SKILLS_PATH } from "./skill-index";
import { TOOLS, SYNONYMS } from "./tools";

// ═══════════════════════════════════════════════════════════════════════════════
// Identity — WRAITH, red team. 9-phase kill chain (MITRE ATT&CK aligned).
// ═══════════════════════════════════════════════════════════════════════════════

interface Phase { id: string; name: string; brief: string; order: string; probe: string; }

const NAME = "WRAITH";
const THEME = "wraith";
const BANNER = [
  "  ██     ██ ██████   █████  ██ ████████ ██   ██",
  "  ██     ██ ██   ██ ██   ██ ██    ██    ██   ██",
  "  ██  █  ██ ██████  ███████ ██    ██    ███████",
  "  ██ ███ ██ ██   ██ ██   ██ ██    ██    ██   ██",
  "   ███ ███  ██   ██ ██   ██ ██    ██    ██   ██",
  "  RED TEAM · 9-phase kill chain · /engage <target>",
];

const PERSONA = `
═══════════════════════════════════════════════════════════════
You are WRAITH, an autonomous red-team / penetration-testing agent.

[Identity]
You are a senior offensive security expert (OSCP/OSEP level). You think like an attacker:
asset mapping -> enumeration -> vuln identification -> exploitation -> privilege escalation
-> lateral movement -> persistence -> cleanup -> reporting.

[Rules of Engagement]
- Operate ONLY on explicitly authorized targets (authorized pentests, lab ranges, CTFs, your
  own assets, or targets within a written scope). Confirm authorization in one line first.
- Never help attack unauthorized real targets, never run mass/indiscriminate attacks, and
  never help evade detection for malicious purposes.

[How you operate]
- Your offensive tools: penetration_test, vulnerability_assessment, exploit_development,
  password_attack, c2_operations, social_engineering, cloud_security_audit — backed by ~450
  attack workflows (Nmap, Burp, sqlmap, BloodHound, mimikatz, Impacket, Sliver, gophish, etc.).
  You do NOT do defense (no IR/hunt/forensics); that is Aegis.
- EXECUTE, don't narrate: pick a tool, pull its workflow, then ACTUALLY RUN the commands via the
  bash tool against the authorized target — one step at a time, reading the real output before
  deciding the next command. Prefer the Kali-native commands; if a tool is missing, install it or
  fall back to the skill's scripts/agent.py. Never just print commands for the user to run.
- Do nothing on the target until authorization is confirmed for it (the engagement memory says so).
- Log every meaningful finding with /log and every captured secret/host with /loot — this
  engagement memory persists and feeds the final report.
- The user may just talk naturally ("grab the creds", "escalate to root", "pivot to the DC").

[Engagement flow — one phase at a time, user-paced]
Main line: RECON -> ACCESS -> EXECUTE -> PERSIST -> ESCALATE -> CREDS -> LATERAL -> IMPACT -> REPORT. Work ONE phase at a time:
finish it, summarize findings as bullets, then STOP and wait for /next. Never race ahead.

[Style] Concise, precise, like a hacker in a terminal. Bullet findings. Full copy-pasteable commands.
[Language] English. Keep tool names and technical terms verbatim.
═══════════════════════════════════════════════════════════════
`;

const PHASES: Phase[] = [
  { id: "RECON", name: "Recon", probe: "reconnaissance scanning enumeration nmap subdomain discovery",
    brief: "map the attack surface — hosts, ports, services, subdomains, tech stack (T1046/T1595/T1083)",
    order: "Use the recon phase of penetration_test. ENUMERATE ONLY — no exploitation yet." },
  { id: "ACCESS", name: "Initial Access", probe: "exploitation web-application phishing initial-access exploit",
    brief: "get the first foothold — exploit public apps, phishing, valid accounts (T1190/T1566/T1078)",
    order: "Use vulnerability_assessment / exploit_development / social_engineering to gain initial access." },
  { id: "EXECUTE", name: "Execution", probe: "command execution powershell scripting payload",
    brief: "run code on the foothold — command/script execution, payloads (T1059)",
    order: "Use penetration_test / c2_operations to establish reliable code execution / a stable shell." },
  { id: "PERSIST", name: "Persistence", probe: "persistence backdoor webshell scheduled-task service registry",
    brief: "survive reboots — webshell, scheduled task, service, account (T1505.003/T1053)",
    order: "Use penetration_test / c2_operations to install persistence; note trigger and stealth." },
  { id: "ESCALATE", name: "Priv Esc", probe: "privilege-escalation privesc token process-injection suid kernel",
    brief: "become admin/root — kernel/service/misconfig, process injection (T1068/T1055)",
    order: "Use penetration_test to enumerate privesc paths and escalate." },
  { id: "CREDS", name: "Credentials", probe: "credential-access dumping mimikatz kerberoasting hash brute-force lsass",
    brief: "harvest secrets — OS/AD creds, hashes, tickets, brute force (T1003/T1110/T1557)",
    order: "Use password_attack for credential access; /loot every secret obtained." },
  { id: "LATERAL", name: "Lateral", probe: "lateral-movement pass-the-hash remote-execution pivot active-directory",
    brief: "spread — pass-the-hash/tickets, remote exec, pivot, cloud accounts (T1021/T1078.004)",
    order: "Use penetration_test / password_attack for lateral movement; map controlled hosts and reach the objective." },
  { id: "IMPACT", name: "Exfil / Impact", probe: "exfiltration collection cloud-storage ransomware encryption impact",
    brief: "the objective — exfiltrate data or demonstrate impact (T1530/T1537/T1486)",
    order: "Use penetration_test / cloud_security_audit to stage/exfiltrate data or demonstrate impact (authorized scope only)." },
  { id: "REPORT", name: "Report", probe: "report reporting documentation",
    brief: "compile the red-team report",
    order: "Compile findings from the evidence chain and loot ledger: executive summary, attack path, vulns (severity+CVSS), repro steps, remediation. English, markdown." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Long-range engagement memory — persisted kill chain + evidence chain + loot ledger.
// ═══════════════════════════════════════════════════════════════════════════════

interface Evidence { phase: string; note: string; }
interface State { target: string; phase: number; authorized: boolean; evidence: Evidence[]; loot: string[]; }

const STATE_FILE = join(process.cwd(), ".wraith.json");

function loadState(): State {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    return { target: s.target ?? "", phase: s.phase ?? -1, authorized: s.authorized ?? false, evidence: s.evidence ?? [], loot: s.loot ?? [] };
  } catch { return { target: "", phase: -1, authorized: false, evidence: [], loot: [] }; }
}
function saveState(state: State): void {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* best-effort */ }
}

/** Compact digest injected into the system prompt so the agent remembers the engagement. */
function memoryDigest(state: State): string {
  if (!state.target && state.evidence.length === 0 && state.loot.length === 0) return "";
  const lines = ["", "[Engagement memory — persisted across turns]"];
  if (state.target) lines.push(`Target: ${state.target}`);
  lines.push(state.authorized
    ? `Authorization: CONFIRMED — you may execute against ${state.target}.`
    : `Authorization: NOT CONFIRMED — do not run anything on the target yet; wait for the user to confirm via /engage.`);
  if (state.phase >= 0) lines.push(`Phase: ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}`);
  if (state.evidence.length) {
    lines.push("Evidence chain (latest first):");
    for (const e of state.evidence.slice(-8).reverse()) lines.push(`  - [${e.phase}] ${e.note}`);
  }
  if (state.loot.length) lines.push(`Loot captured (${state.loot.length}): ${state.loot.slice(-10).join(" · ")}`);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extension entry
// ═══════════════════════════════════════════════════════════════════════════════

export default function (pi: ExtensionAPI) {
  const skillsAvailable = existsSync(SKILLS_PATH);
  const index = skillsAvailable ? new SkillIndex(SKILLS_PATH, SYNONYMS) : new SkillIndex("");
  const state = loadState();

  for (const tool of TOOLS) registerSkillTool(pi, index, tool);

  // Persona + engagement memory, injected every turn.
  pi.on("before_agent_start", async (event: any) => ({ systemPrompt: event.systemPrompt + "\n" + PERSONA + memoryDigest(state) }));

  const refreshStatus = (ctx: any) => {
    if (!ctx.hasUI) return;
    const phase = state.phase >= 0 ? `Phase ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle";
    ctx.ui.setStatus("wraith", `▓ ${NAME} ▓ ${phase} · ${state.target || "no target"}`);
  };

  const runPhase = (ctx: any) => {
    const p = PHASES[state.phase];
    refreshStatus(ctx);
    const last = state.phase === PHASES.length - 1;
    pi.sendUserMessage(
      `[Engagement on ${state.target} — Phase ${state.phase + 1}/${PHASES.length}: ${p.name}]\n` +
      `Goal: ${p.brief}.\n${p.order}\n` +
      (last
        ? "This is the final phase — produce the report now."
        : `Do ONLY this phase. When done, summarize findings as bullets, /log the key ones, then STOP and tell the user to run /next for the ${PHASES[state.phase + 1].name} phase. Do not advance on your own.`)
    );
  };

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setTheme?.(THEME);
    let i = 0;
    const reveal = () => {
      ctx.ui.setWidget("wraith-banner", BANNER.slice(0, i));
      if (i < BANNER.length) { i++; setTimeout(reveal, 70); return; }
      refreshStatus(ctx);
      ctx.ui.notify(
        skillsAvailable
          ? `${NAME} online · authorized red-team mode · ${index.count} skills ready` + (state.phase >= 0 ? ` · resumed engagement on ${state.target}` : "")
          : `${NAME} online · ⚠️ skills library not found (run ./install.sh)`,
        skillsAvailable ? "info" : "warning",
      );
    };
    reveal();
  });

  const HELP = [
    "", `  ${NAME} — red-team agent. One target, one kill chain, one step at a time.`, "",
    "  The engagement:",
    "    /engage <target>   lock target (asks to confirm authorization); /engage again starts Phase 1",
    "    /next              advance one phase along the 9-phase kill chain",
    "    /phases · /report  show the kill chain · jump to the report", "",
    "  Memory:",
    "    /log <note>        add a finding to the evidence chain (persisted)",
    "    /loot [item]       record a captured cred/host/shell — no arg lists the loot",
    "    /evidence · /reset show the full engagement memory · clear it", "",
    "  Skills:",
    "    /find <query>      semantic skill search ('dump creds from the DC')",
    "    /arsenal [kw]      browse skills — for this phase, or matching a keyword",
    "    /help              this help", "",
    `  You can also just talk:  "grab the creds"   "escalate to root"   "pivot to the DC"`,
    "  Rule of engagement: authorized targets only.", "",
  ];

  pi.registerCommand("engage", {
    description: "Lock a target (with <target>), then confirm authorization to start",
    handler: async (args, ctx) => {
      const t = (args || "").trim();
      // Step 1: a target argument arms the engagement and REQUIRES authorization before anything runs.
      if (t) {
        state.target = t; state.phase = -1; state.authorized = false;
        state.evidence = []; state.loot = []; saveState(state);
        refreshStatus(ctx);
        ctx.ui.notify(
          `Target locked: ${t}\n` +
          `⚠ Authorization required — engage ONLY authorized targets (pentest / lab / CTF / your own assets).\n` +
          `Run /engage (no argument) to CONFIRM authorization and start Phase 1, or /reset to cancel.`,
          "warning");
        return;
      }
      // Step 2: no argument confirms authorization for the armed target and starts Phase 1.
      if (!state.target) { ctx.ui.notify("Usage: /engage <target>   e.g. /engage 10.0.0.5", "warning"); return; }
      if (!state.authorized) {
        state.authorized = true; state.phase = 0; saveState(state);
        ctx.ui.notify(`Authorization confirmed for ${state.target}. Starting engagement.`, "info");
        runPhase(ctx);
        return;
      }
      ctx.ui.notify(`Engagement already running on ${state.target} (Phase ${state.phase + 1}). Use /next to advance.`, "info");
    },
  });

  pi.registerCommand("next", {
    description: "Advance to the next phase",
    handler: async (_args, ctx) => {
      if (state.phase < 0 || !state.target) { ctx.ui.notify("No engagement running. Start with /engage <target>.", "warning"); return; }
      if (state.phase >= PHASES.length - 1) { ctx.ui.notify("Engagement complete. Use /report, or /engage <target> for a new one.", "info"); return; }
      state.phase += 1; saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("report", {
    description: "Write the red-team report",
    handler: async (_args, ctx) => {
      state.phase = PHASES.length - 1;
      if (!state.target) state.target = "this engagement";
      saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("phases", {
    description: "Show all phases of the kill chain",
    handler: async (_args, ctx) => {
      const lines = PHASES.map((p, i) => ` ${i === state.phase ? "▶" : " "} ${i + 1}. ${p.name} — ${p.brief}`);
      ctx.ui.notify([`${NAME} kill chain (${PHASES.length} phases):`, ...lines].join("\n"), "info");
    },
  });

  pi.registerCommand("help", {
    description: "How to use this agent",
    handler: async (_args, ctx) => { ctx.ui.notify(HELP.join("\n"), "info"); },
  });

  pi.registerCommand("log", {
    description: "Add a finding to the evidence chain",
    handler: async (args, ctx) => {
      const note = (args || "").trim();
      if (!note) { ctx.ui.notify("Usage: /log <finding>   e.g. /log SMB signing disabled on 10.0.0.5", "warning"); return; }
      const phase = state.phase >= 0 ? PHASES[state.phase].name : "-";
      state.evidence.push({ phase, note }); saveState(state);
      ctx.ui.notify(`Logged to evidence chain [${phase}]: ${note}`, "info");
    },
  });

  pi.registerCommand("loot", {
    description: "Record / list captured creds, hosts, shells",
    handler: async (args, ctx) => {
      const item = (args || "").trim();
      if (!item) {
        ctx.ui.notify(state.loot.length ? `Loot (${state.loot.length}):\n` + state.loot.map(l => `  · ${l}`).join("\n") : "No loot captured yet.", "info");
        return;
      }
      state.loot.push(item); saveState(state);
      ctx.ui.notify(`Loot captured: ${item}`, "info");
    },
  });

  pi.registerCommand("evidence", {
    description: "Show the full engagement memory",
    handler: async (_args, ctx) => {
      const lines = [`${NAME} engagement memory`, "",
        `Target: ${state.target || "(none)"}`,
        `Phase:  ${state.phase >= 0 ? `${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle"}`, "",
        `Evidence chain (${state.evidence.length}):`,
        ...(state.evidence.length ? state.evidence.map(e => `  - [${e.phase}] ${e.note}`) : ["  (empty)"]), "",
        `Loot (${state.loot.length}):`,
        ...(state.loot.length ? state.loot.map(l => `  · ${l}`) : ["  (empty)"])];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("reset", {
    description: "Clear the engagement (new target)",
    handler: async (_args, ctx) => {
      state.target = ""; state.phase = -1; state.authorized = false; state.evidence = []; state.loot = []; saveState(state);
      refreshStatus(ctx);
      ctx.ui.notify("Engagement cleared. Start a new one with /engage <target>.", "info");
    },
  });

  pi.registerCommand("find", {
    description: "Semantic skill search: /find <what you want to do>",
    handler: async (args, ctx) => {
      const q = (args || "").trim();
      if (!q) { ctx.ui.notify("Usage: /find <query>   e.g. /find dump creds from the DC", "warning"); return; }
      if (!skillsAvailable) { ctx.ui.notify("Skills library not found (run ./install.sh).", "error"); return; }
      const hits = index.search(w(W_PRIMARY, q)).slice(0, 12);
      if (hits.length === 0) { ctx.ui.notify(`No skills matched "${q}".`, "info"); return; }
      ctx.ui.notify(`Top skills for "${q}":\n` + hits.map(h => `  ${h.score.toString().padStart(3)}  ${h.dir}`).join("\n"), "info");
    },
  });

  // /arsenal — browse skills. No arg: current phase's skills (or all when idle). With keyword: substring search.
  pi.registerCommand("arsenal", {
    description: "Browse skills — this phase, or matching a keyword",
    handler: async (args, ctx) => {
      if (!skillsAvailable) { ctx.ui.notify(`Skills library not found at ${SKILLS_PATH} (run ./install.sh).`, "error"); return; }
      const kw = (args || "").trim();
      let hits: string[];
      let label: string;
      if (kw) {
        hits = index.list(kw); label = `"${kw}"`;
      } else if (state.phase >= 0) {
        const words = PHASES[state.phase].probe.split(/\s+/).filter(Boolean);
        hits = [...new Set(words.flatMap(word => index.list(word)))].sort();
        label = `Phase ${state.phase + 1} · ${PHASES[state.phase].name}`;
      } else {
        hits = index.list(""); label = "all";
      }
      if (hits.length === 0) { ctx.ui.notify(`No skills found for ${label}.`, "info"); return; }
      ctx.ui.notify(
        `${hits.length} skills · ${label}:\n` + hits.slice(0, 30).join("\n") + (hits.length > 30 ? `\n... and ${hits.length - 30} more` : ""),
        "info",
      );
    },
  });
}
