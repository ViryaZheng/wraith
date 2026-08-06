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

export class SkillIndex {
  private inverted: Map<string, string[]> = new Map();
  private allDirs: string[] = [];
  private synonyms: Record<string, string[]>;

  constructor(skillsPath: string, synonyms: Record<string, string[]> = {}) {
    this.synonyms = synonyms;
    this.build(skillsPath);
  }

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
    for (const { term, weight } of expanded) {
      const t = term.toLowerCase();
      const exactDirs = this.inverted.get(t);
      if (exactDirs) {
        for (const dir of exactDirs) candidates.set(dir, (candidates.get(dir) ?? 0) + weight * 3);
      }
      for (const dir of this.allDirs) {
        if (candidates.has(dir)) continue;
        if (dir.toLowerCase().includes(t)) candidates.set(dir, (candidates.get(dir) ?? 0) + weight * 1);
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
    for (const dir of dirs) {
      for (const seg of dir.toLowerCase().split("-")) {
        const list = this.inverted.get(seg);
        if (list) list.push(dir); else this.inverted.set(seg, [dir]);
      }
    }
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

function formatOutput(title: string, result: SearchResult, params: Record<string, unknown>): string {
  return [
    `## ${title}`, ``,
    `**Loaded skill:** \`${result.dir}\` (score: ${result.score})`,
    `**Parameters:** ${JSON.stringify(params)}`, ``, `---`, ``,
    result.body, ``, `---`,
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
      return {
        content: [{ type: "text", text: formatOutput(config.label, best, params) }],
        details: { ...params, skillFound: true, skillDir: best.dir, score: best.score },
      };
    },
  });
}
