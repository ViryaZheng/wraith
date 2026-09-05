/**
 * Skill retrieval engine — generic, team-agnostic.
 *
 * Tokenized inverted index over this product's own skill library + weighted search
 * with an offline synonym layer. Skills are pre-split on disk (this folder ships only
 * its own team's skills), so there is no runtime team filtering — the engine just
 * indexes whatever SKILL.md folders live under ./skills.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type TObject } from "typebox";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

// This product's own skills, bundled offline alongside the code.
export const SKILLS_PATH = join(__dirname, "skills");

export interface WeightedTerm { term: string; weight: number; }
export interface SearchResult { dir: string; score: number; body: string | null; }

export interface ToolConfig {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  parameters: TObject;
  buildKeywords: (params: Record<string, unknown>) => WeightedTerm[];
}

// ── Tokenizer + weighted-keyword helper ──────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "to", "for", "with",
  "is", "at", "by", "from", "as", "into", "be", "it", "its",
]);

export function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[-_\s]/).filter(t => t.length > 0 && !STOP_WORDS.has(t));
}

/** Map keywords → weighted terms; hyphen/underscore/space-separated words split into tokens. */
export function w(weight: number, ...keywords: string[]): WeightedTerm[] {
  return keywords.flatMap(kw => tokenize(kw).map(t => ({ term: t, weight })));
}

export const W_PRIMARY = 3;   // framework name, attack/incident class, core technique
export const W_SECONDARY = 2; // scope, phase, platform
export const W_AUX = 1;       // environment, auxiliary

// ── Index ────────────────────────────────────────────────────────────────────

export interface SkillMeta { description: string; tags: string[]; mitre: string[]; subdomain: string; }

export class SkillIndex {
  private inverted: Map<string, string[]> = new Map();  // folder-name segment → dirs (STRONG)
  private metaIndex: Map<string, string[]> = new Map(); // frontmatter token  → dirs (MEDIUM)
  private attackIndex: Map<string, string[]> = new Map(); // ATT&CK id (t1003) → dirs (EXACT)
  private meta: Map<string, SkillMeta> = new Map();     // per-dir frontmatter cache
  private allDirs: string[] = [];
  private synonyms: Record<string, string[]>;

  constructor(skillsPath: string, synonyms: Record<string, string[]> = {}) {
    this.synonyms = synonyms;
    this.build(skillsPath);
  }

  /** Parsed frontmatter for a skill dir (for tool output / callers). */
  getMeta(dir: string): SkillMeta | undefined { return this.meta.get(dir); }

  get count(): number { return this.allDirs.length; }

  list(keyword: string): string[] {
    if (!keyword) return this.allDirs;
    const kw = keyword.toLowerCase();
    return this.allDirs.filter(d => d.toLowerCase().includes(kw));
  }

  /** Expand each term with its synonyms (lower weight), then weighted-match. */
  search(terms: WeightedTerm[]): SearchResult[] {
    if (terms.length === 0) return [];

    const expanded: WeightedTerm[] = [...terms];
    for (const { term, weight } of terms) {
      const aliases = this.synonyms[term];
      if (!aliases) continue;
      for (const alias of aliases) {
        for (const tok of tokenize(alias)) {
          expanded.push({ term: tok, weight: Math.max(1, weight - 1) });
        }
      }
    }

    const candidates: Map<string, number> = new Map();
    const add = (dir: string, pts: number) => candidates.set(dir, (candidates.get(dir) ?? 0) + pts);
    for (const { term, weight } of expanded) {
      const t = term.toLowerCase();
      // EXACT ATT&CK technique id (e.g. "t1003") — most specific signal
      for (const dir of this.attackIndex.get(t) ?? []) add(dir, weight * 4);
      // STRONG folder-name segment match
      for (const dir of this.inverted.get(t) ?? []) add(dir, weight * 3);
      // MEDIUM frontmatter (description/tags/subdomain) token match
      for (const dir of this.metaIndex.get(t) ?? []) add(dir, weight * 2);
      // WEAK substring on folder name, only for dirs not already scored
      for (const dir of this.allDirs) {
        if (candidates.has(dir)) continue;
        if (dir.toLowerCase().includes(t)) add(dir, weight * 1);
      }
    }

    const results: SearchResult[] = [];
    for (const [dir, score] of candidates) {
      if (score === 0) continue;
      const body = this.loadBody(dir);
      if (body) results.push({ dir, score, body });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  private build(skillsPath: string): void {
    if (!existsSync(skillsPath)) return;
    const dirs = readdirSync(skillsPath, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    this.allDirs = dirs;
    const push = (map: Map<string, string[]>, key: string, dir: string) => {
      const list = map.get(key);
      if (list) { if (!list.includes(dir)) list.push(dir); } else map.set(key, [dir]);
    };
    for (const dir of dirs) {
      // STRONG: folder-name segments
      for (const seg of dir.toLowerCase().split("-")) push(this.inverted, seg, dir);
      // Parse SKILL.md frontmatter → MEDIUM (meta) + EXACT (ATT&CK) indexes
      const fm = this.parseFrontmatter(dir);
      if (!fm) continue;
      this.meta.set(dir, fm);
      for (const tok of tokenize(fm.description)) push(this.metaIndex, tok, dir);
      for (const tag of fm.tags) for (const tok of tokenize(tag)) push(this.metaIndex, tok, dir);
      for (const tok of tokenize(fm.subdomain)) push(this.metaIndex, tok, dir);
      for (const id of fm.mitre) {
        const low = id.toLowerCase();
        push(this.attackIndex, low, dir);   // exact "t1003" / "t1003.001"
        push(this.metaIndex, low, dir);
      }
    }
  }

  /** Tolerant YAML-ish frontmatter reader — enough to index, not a full parser. */
  private parseFrontmatter(dir: string): SkillMeta | null {
    let raw: string;
    try { raw = readFileSync(join(SKILLS_PATH, dir, "SKILL.md"), "utf-8"); } catch { return null; }
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const lines = m[1].split("\n");
    const meta: SkillMeta = { description: "", tags: [], mitre: [], subdomain: "" };
    let key = "";
    const descParts: string[] = [];
    for (const line of lines) {
      const kv = line.match(/^([a-z_]+):(.*)$/i);
      if (kv) {
        key = kv[1].toLowerCase();
        const val = kv[2].trim().replace(/^['"]|['"]$/g, "");
        if (key === "description") descParts.push(val);
        else if (key === "subdomain") meta.subdomain = val;
        continue;
      }
      const item = line.match(/^\s*-\s+(.*)$/);
      if (item) {
        const val = item[1].trim().replace(/^['"]|['"]$/g, "");
        if (key === "tags") meta.tags.push(val);
        else if (key === "mitre_attack") meta.mitre.push(val);
        continue;
      }
      // folded continuation lines (e.g. multi-line description)
      if (key === "description" && line.trim()) descParts.push(line.trim().replace(/^['"]|['"]$/g, ""));
    }
    meta.description = descParts.join(" ").trim();
    return meta;
  }

  private loadBody(dir: string): string | null {
    try {
      const raw = readFileSync(join(SKILLS_PATH, dir, "SKILL.md"), "utf-8");
      const parts = raw.split("---");
      return parts.length >= 3 ? parts.slice(2).join("---").trim() : raw.trim();
    } catch { return null; }
  }
}

// ── Tool registration + output formatting ────────────────────────────────────

// ── Kali preflight: which CLI tools this workflow needs are actually installed ──

// Curated union of common offensive + defensive Kali binaries. A red skill body simply
// won't mention the blue tools and vice-versa, so one shared list stays team-agnostic.
const COMMON_TOOLS = [
  // recon / web
  "nmap", "masscan", "rustscan", "nikto", "gobuster", "ffuf", "feroxbuster", "dirb", "whatweb",
  "wpscan", "amass", "subfinder", "theharvester", "dnsenum", "dnsrecon", "dig", "whois", "curl",
  "jq", "shodan", "wafw00f", "sslscan",
  // exploit / creds / AD
  "sqlmap", "hydra", "medusa", "john", "hashcat", "netexec", "crackmapexec", "secretsdump.py",
  "impacket-secretsdump", "evil-winrm", "responder", "bloodhound", "sharphound", "certipy",
  "kerbrute", "enum4linux", "smbclient", "smbmap", "ldapsearch", "mimikatz",
  // frameworks / c2 / cloud / mobile
  "msfconsole", "msfvenom", "searchsploit", "sliver", "proxychains", "gophish", "setoolkit",
  "scout-suite", "pacu", "trivy", "grype", "frida", "objection",
  // blue: forensics / detection / IR
  "volatility", "vol.py", "yara", "sigma", "zeek", "suricata", "snort", "velociraptor", "autopsy",
  "binwalk", "foremost", "chainsaw", "hayabusa", "clamav", "rkhunter", "chkrootkit", "osquery",
  "tcpdump", "tshark", "wireshark", "dcfldd", "dd", "gpg", "openssl", "strings", "apktool", "jadx",
];

/** Tool names referenced in a skill body, in first-seen order. */
function extractTools(body: string): string[] {
  const found: string[] = [];
  const lower = body.toLowerCase();
  for (const t of COMMON_TOOLS) {
    const re = new RegExp(`(^|[^a-z0-9_.-])${t.replace(/[.]/g, "\\.")}([^a-z0-9_-]|$)`, "i");
    if (re.test(lower) && !found.includes(t)) found.push(t);
  }
  return found;
}

/** Best-effort `command -v` check of referenced tools. Read-only; never throws. */
function preflight(body: string): { present: string[]; missing: string[] } {
  const tools = extractTools(body);
  if (tools.length === 0) return { present: [], missing: [] };
  let presentOut = "";
  try {
    // `; true` keeps the overall exit status 0 — otherwise a not-found last tool makes the
    // shell exit non-zero, execSync throws, and the stdout (the tools that WERE found) is lost.
    presentOut = execSync(`for t in ${tools.join(" ")}; do command -v "$t" >/dev/null 2>&1 && echo "$t"; done; true`,
      { encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
  } catch { /* best-effort */ }
  const present = presentOut.split("\n").map(s => s.trim()).filter(Boolean);
  const missing = tools.filter(t => !present.includes(t));
  return { present, missing };
}

function preflightReport(pf: { present: string[]; missing: string[] }): string {
  if (pf.present.length === 0 && pf.missing.length === 0) {
    return "_No specific CLI tools detected in this workflow — use standard Kali tooling._";
  }
  const lines: string[] = [];
  if (pf.present.length) lines.push(`**Present:** ${pf.present.join(", ")}`);
  if (pf.missing.length) lines.push(`**Missing:** ${pf.missing.join(", ")}  →  \`sudo apt install -y ${pf.missing.join(" ")}\``);
  return lines.join("\n");
}

function formatOutput(
  title: string, result: SearchResult, params: Record<string, unknown>,
  pf: { present: string[]; missing: string[] }, meta: SkillMeta | undefined, executeVerb: string,
): string {
  const attack = meta?.mitre?.length ? `  ·  ATT&CK: ${meta.mitre.join(", ")}` : "";
  return [
    `## ${title}`, ``,
    `**Selected skill:** \`${result.dir}\` (score: ${result.score})${attack}`,
    `**Parameters:** ${JSON.stringify(params)}`, ``,
    `### Environment preflight (Kali)`, preflightReport(pf), ``,
    `### ▶ EXECUTE — run it, don't just print it`,
    `You are in an authorized engagement. **Actually run** the workflow below against the target ` +
    `using the bash tool — ${executeVerb}. Run one step, read the real output, then choose the next ` +
    `command from what you observe. Prefer the Kali-native commands shown here; if a tool is missing, ` +
    `install it or fall back to \`scripts/agent.py\` in the skill folder. Do not paste commands back ` +
    `to the user unrun. When the step is done, summarize findings as bullets and log the key ones.`, ``,
    `---`, ``, result.body, ``, `---`,
    `> 📚 Source: [Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) (Apache 2.0)`,
  ].join("\n");
}

function formatNoMatch(title: string, params: Record<string, unknown>, terms: WeightedTerm[]): string {
  return [
    `## ${title}`, ``,
    `**Parameters:** ${JSON.stringify(params)}`, ``,
    `> ⚠️ No matching skill found. Searched: ${terms.map(t => t.term).join(", ")}`, ``,
    `### Troubleshooting`,
    `- Try more specific keywords, or \`/find <what you want to do>\` for a semantic search`,
    `- Use \`/arsenal <keyword>\` to browse available skills`,
  ].join("\n");
}

export function registerSkillTool(pi: ExtensionAPI, index: SkillIndex, config: ToolConfig): void {
  pi.registerTool({
    name: config.name,
    label: config.label,
    description: config.description,
    promptSnippet: config.promptSnippet,
    parameters: config.parameters,
    async execute(_id, params, _signal, onUpdate, _ctx) {
      const terms = config.buildKeywords(params);
      onUpdate?.({ content: [{ type: "text", text: `Searching ${index.count} skills (${terms.map(t => t.term).join(", ")})...` }] });
      const best = index.search(terms)[0];
      if (!best) {
        return {
          content: [{ type: "text", text: formatNoMatch(config.label, params, terms) }],
          details: { ...params, skillFound: false },
        };
      }
      onUpdate?.({ content: [{ type: "text", text: `Selected ${best.dir} — checking Kali toolchain...` }] });
      const pf = preflight(best.body);
      const meta = index.getMeta(best.dir);
      const verb = "execute each step step-by-step and reason from the real output";
      return {
        content: [{ type: "text", text: formatOutput(config.label, best, params, pf, meta, verb) }],
        details: { ...params, skillFound: true, skillDir: best.dir, score: best.score, toolsPresent: pf.present, toolsMissing: pf.missing },
      };
    },
  });
}
