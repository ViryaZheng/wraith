/**
 * 🔵 AEGIS — autonomous blue-team / defensive-security agent (self-contained pi extension).
 *
 * This folder is ONE independent agent — no shared code with Wraith. Three files:
 *   index.ts       ← you are here: identity, incident memory, commands, wiring
 *   tools.ts       ← the 8 defensive tools + keyword maps + blue synonym table
 *   skill-index.ts ← the generic skill-retrieval engine (team-agnostic)
 *
 * Mission: defend authorized environments — detect, respond, hunt, forensics, harden.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SkillIndex, registerSkillTool, w, W_PRIMARY, SKILLS_PATH } from "./skill-index";
import { TOOLS, SYNONYMS } from "./tools";

// ═══════════════════════════════════════════════════════════════════════════════
// Identity — AEGIS, blue team. 8-phase defense chain.
// ═══════════════════════════════════════════════════════════════════════════════

interface Phase { id: string; name: string; brief: string; order: string; probe: string; }

const NAME = "AEGIS";
const THEME = "aegis";
const BANNER = [
  "   █████  ███████  ██████  ██ ███████",
  "  ██   ██ ██      ██       ██ ██     ",
  "  ███████ █████   ██   ███ ██ ███████",
  "  ██   ██ ██      ██    ██ ██      ██",
  "  ██   ██ ███████  ██████  ██ ███████",
  "  BLUE TEAM · 8-phase defense · /engage <host>",
];

const PERSONA = `
═══════════════════════════════════════════════════════════════
You are AEGIS, an autonomous blue-team / defensive-security agent.

[Identity]
You are a senior SOC analyst & DFIR responder. You think like a defender:
detect -> triage -> contain -> investigate/hunt -> eradicate & recover -> report & harden.

[Mission]
- Protect authorized environments: detect intrusions, respond to incidents, hunt threats, do
  forensics, and harden. Assume good-faith defense of the user's own / authorized systems.
- Be evidence-driven: tie every conclusion to logs, IOCs, artifacts. Call out false positives.

[How you operate]
- Your defensive tools: incident_response, threat_hunt, malware_analysis, forensic_analysis,
  detection_engineering, security_hardening, compliance_audit, cloud_security_audit — backed by
  ~370 defense workflows (Sigma, YARA, Splunk, Volatility, Zeek, Velociraptor, etc.). You do NOT
  run offensive pentests; that is Wraith. Pick a tool, pull its workflow, run via bash.
- Log every confirmed finding with /log and every indicator with /ioc — this incident memory
  persists and feeds the final report and new detections.
- The user may just talk naturally ("triage this alert", "hunt for C2 beacons", "carve the memory dump").

[Response flow — one phase at a time, user-paced]
Main line: DETECT -> TRIAGE -> HUNT -> INVESTIGATE -> CONTAIN -> ERADICATE -> HARDEN -> REPORT. Work ONE phase at a time:
finish it, summarize findings as bullets, then STOP and wait for /next. Never race ahead.

[Style] Concise, precise, like an analyst at a SOC console. Bullet findings. Full copy-pasteable commands.
[Language] English. Keep tool names and technical terms verbatim.
═══════════════════════════════════════════════════════════════
`;

const PHASES: Phase[] = [
  { id: "DETECT", name: "Detect", probe: "detection-engineering siem sigma detection alert anomaly",
    brief: "spot the suspicious activity — alerts, anomalies, IOCs, affected assets",
    order: "Use detection_engineering / threat_hunt to characterize the signal and scope impact. OBSERVE ONLY." },
  { id: "TRIAGE", name: "Triage", probe: "incident-response triage soc severity classification",
    brief: "assess severity, confirm true vs false positive, determine blast radius",
    order: "Use incident_response triage: classify, rate severity, map impacted systems. /ioc anything confirmed." },
  { id: "HUNT", name: "Hunt", probe: "threat-hunting hunting ioc behavioral c2 beaconing",
    brief: "proactively find the adversary everywhere — hypotheses, IOCs, TTPs",
    order: "Use threat_hunt: run hypotheses, search IOCs/TTPs, find every affected host." },
  { id: "INVESTIGATE", name: "Investigate", probe: "forensics dfir memory disk timeline artifact investigation",
    brief: "forensics & root cause — timeline, patient zero, how they got in",
    order: "Use forensic_analysis / malware_analysis: disk/memory/log forensics, build the timeline, find root cause." },
  { id: "CONTAIN", name: "Contain", probe: "containment isolation block quarantine incident-response",
    brief: "stop the spread without destroying evidence — isolate, block IOCs, cut C2",
    order: "Use incident_response containment: isolate hosts, block IOCs, preserve evidence." },
  { id: "ERADICATE", name: "Eradicate", probe: "eradication recovery remediation malware-removal restore",
    brief: "remove the threat and recover — kill footholds, restore, validate clean",
    order: "Use incident_response eradication/recovery: remove footholds, restore systems, verify." },
  { id: "HARDEN", name: "Harden", probe: "hardening cis-benchmark zero-trust mitigation patch",
    brief: "prevent recurrence — patch the entry vector, harden configs, tighten controls",
    order: "Use security_hardening / detection_engineering: patch, harden configs (CIS/STIG/zero-trust), add detections." },
  { id: "REPORT", name: "Report", probe: "report reporting lessons-learned documentation",
    brief: "compile the incident report",
    order: "Compile from the evidence chain and IOC ledger: executive summary, timeline, IOCs, root cause, impact, remediation & lessons. English, markdown." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Long-range incident memory — persisted response chain + evidence chain + IOC ledger.
// ═══════════════════════════════════════════════════════════════════════════════

interface Evidence { phase: string; note: string; }
interface State { target: string; phase: number; evidence: Evidence[]; iocs: string[]; }

const STATE_FILE = join(process.cwd(), ".aegis.json");

function loadState(): State {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    return { target: s.target ?? "", phase: s.phase ?? -1, evidence: s.evidence ?? [], iocs: s.iocs ?? [] };
  } catch { return { target: "", phase: -1, evidence: [], iocs: [] }; }
}
function saveState(state: State): void {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* best-effort */ }
}

/** Compact digest injected into the system prompt so the agent remembers the incident. */
function memoryDigest(state: State): string {
  if (state.phase < 0 && state.evidence.length === 0 && state.iocs.length === 0) return "";
  const lines = ["", "[Incident memory — persisted across turns]"];
  if (state.target) lines.push(`Scope: ${state.target}`);
  if (state.phase >= 0) lines.push(`Phase: ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}`);
  if (state.evidence.length) {
    lines.push("Evidence chain (latest first):");
    for (const e of state.evidence.slice(-8).reverse()) lines.push(`  - [${e.phase}] ${e.note}`);
  }
  if (state.iocs.length) lines.push(`IOCs collected (${state.iocs.length}): ${state.iocs.slice(-10).join(" · ")}`);
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

  // Persona + incident memory, injected every turn.
  pi.on("before_agent_start", async (event: any) => ({ systemPrompt: event.systemPrompt + "\n" + PERSONA + memoryDigest(state) }));

  const refreshStatus = (ctx: any) => {
    if (!ctx.hasUI) return;
    const phase = state.phase >= 0 ? `Phase ${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle";
    ctx.ui.setStatus("aegis", `▓ ${NAME} ▓ ${phase} · ${state.target || "no scope"}`);
  };

  const runPhase = (ctx: any) => {
    const p = PHASES[state.phase];
    refreshStatus(ctx);
    const last = state.phase === PHASES.length - 1;
    pi.sendUserMessage(
      `[Incident on ${state.target} — Phase ${state.phase + 1}/${PHASES.length}: ${p.name}]\n` +
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
      ctx.ui.setWidget("aegis-banner", BANNER.slice(0, i));
      if (i < BANNER.length) { i++; setTimeout(reveal, 70); return; }
      refreshStatus(ctx);
      ctx.ui.notify(
        skillsAvailable
          ? `${NAME} online · defensive mode · ${index.count} skills ready` + (state.phase >= 0 ? ` · resumed incident on ${state.target}` : "")
          : `${NAME} online · ⚠️ skills library not found (run ./install.sh)`,
        skillsAvailable ? "info" : "warning",
      );
    };
    reveal();
  });

  const HELP = [
    "", `  ${NAME} — blue-team agent. One scope, one response chain, one step at a time.`, "",
    "  The response:",
    "    /engage <scope>    start — lock scope, run Phase 1 (Detect), then stop",
    "    /next              advance one phase along the 8-phase defense chain",
    "    /phases · /report  show the defense chain · jump to the report", "",
    "  Memory:",
    "    /log <note>        add a finding to the evidence chain (persisted)",
    "    /ioc [indicator]   record an IOC (hash/IP/domain) — no arg lists the IOCs",
    "    /evidence · /reset show the full incident memory · clear it", "",
    "  Skills:",
    "    /find <query>      semantic skill search ('hunt for c2 beacons')",
    "    /arsenal [kw]      browse skills — for this phase, or matching a keyword",
    "    /help              this help", "",
    `  You can also just talk:  "triage this alert"   "hunt for C2 beacons"   "carve the memory dump"`,
    "  Mission: defend authorized environments.", "",
  ];

  pi.registerCommand("engage", {
    description: "Start an incident response  <scope>",
    handler: async (args, ctx) => {
      const t = (args || "").trim() || state.target;
      if (!t) { ctx.ui.notify("Usage: /engage <scope>   e.g. /engage host-42", "warning"); return; }
      state.target = t; state.phase = 0; saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("next", {
    description: "Advance to the next phase",
    handler: async (_args, ctx) => {
      if (state.phase < 0 || !state.target) { ctx.ui.notify("No incident running. Start with /engage <scope>.", "warning"); return; }
      if (state.phase >= PHASES.length - 1) { ctx.ui.notify("Response complete. Use /report, or /engage <scope> for a new one.", "info"); return; }
      state.phase += 1; saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("report", {
    description: "Write the incident report",
    handler: async (_args, ctx) => {
      state.phase = PHASES.length - 1;
      if (!state.target) state.target = "this incident";
      saveState(state);
      runPhase(ctx);
    },
  });

  pi.registerCommand("phases", {
    description: "Show all phases of the defense chain",
    handler: async (_args, ctx) => {
      const lines = PHASES.map((p, i) => ` ${i === state.phase ? "▶" : " "} ${i + 1}. ${p.name} — ${p.brief}`);
      ctx.ui.notify([`${NAME} defense chain (${PHASES.length} phases):`, ...lines].join("\n"), "info");
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
      if (!note) { ctx.ui.notify("Usage: /log <finding>   e.g. /log lsass access from svchost on host-42", "warning"); return; }
      const phase = state.phase >= 0 ? PHASES[state.phase].name : "-";
      state.evidence.push({ phase, note }); saveState(state);
      ctx.ui.notify(`Logged to evidence chain [${phase}]: ${note}`, "info");
    },
  });

  pi.registerCommand("ioc", {
    description: "Record / list indicators of compromise",
    handler: async (args, ctx) => {
      const item = (args || "").trim();
      if (!item) {
        ctx.ui.notify(state.iocs.length ? `IOCs (${state.iocs.length}):\n` + state.iocs.map(l => `  · ${l}`).join("\n") : "No IOCs recorded yet.", "info");
        return;
      }
      state.iocs.push(item); saveState(state);
      ctx.ui.notify(`IOC recorded: ${item}`, "info");
    },
  });

  pi.registerCommand("evidence", {
    description: "Show the full incident memory",
    handler: async (_args, ctx) => {
      const lines = [`${NAME} incident memory`, "",
        `Scope: ${state.target || "(none)"}`,
        `Phase: ${state.phase >= 0 ? `${state.phase + 1}/${PHASES.length} · ${PHASES[state.phase].name}` : "idle"}`, "",
        `Evidence chain (${state.evidence.length}):`,
        ...(state.evidence.length ? state.evidence.map(e => `  - [${e.phase}] ${e.note}`) : ["  (empty)"]), "",
        `IOCs (${state.iocs.length}):`,
        ...(state.iocs.length ? state.iocs.map(l => `  · ${l}`) : ["  (empty)"])];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("reset", {
    description: "Clear the incident (new scope)",
    handler: async (_args, ctx) => {
      state.target = ""; state.phase = -1; state.evidence = []; state.iocs = []; saveState(state);
      refreshStatus(ctx);
      ctx.ui.notify("Incident cleared. Start a new one with /engage <scope>.", "info");
    },
  });

  pi.registerCommand("find", {
    description: "Semantic skill search: /find <what you want to do>",
    handler: async (args, ctx) => {
      const q = (args || "").trim();
      if (!q) { ctx.ui.notify("Usage: /find <query>   e.g. /find hunt for c2 beacons", "warning"); return; }
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
