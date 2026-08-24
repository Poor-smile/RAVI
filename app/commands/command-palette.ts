import type { CommandDefinition, CommandId } from "../keyboard/command-registry";

export const COMMAND_USAGE_STORAGE_KEY = "raavi:command-usage:v1";

export type CommandUsage = Partial<
  Record<CommandId, { count: number; lastUsedAt: number }>
>;

export function normalizeCommandQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .toLocaleLowerCase("fa")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function subsequenceScore(source: string, query: string) {
  let queryIndex = 0;
  let gap = 0;
  for (let index = 0; index < source.length && queryIndex < query.length; index += 1) {
    if (source[index] === query[queryIndex]) queryIndex += 1;
    else if (queryIndex > 0) gap += 1;
  }
  return queryIndex === query.length ? Math.max(1, 28 - gap) : 0;
}

export function scoreCommandText(
  command: Pick<CommandDefinition, "title" | "description" | "keywords">,
  query: string,
) {
  if (!query) return 0;
  const title = normalizeCommandQuery(command.title);
  const description = normalizeCommandQuery(command.description);
  const keywords = command.keywords.map(normalizeCommandQuery);
  const haystacks = [title, ...keywords, description];
  let score = 0;
  for (const token of query.split(/\s+/)) {
    let tokenScore = 0;
    for (const [index, value] of haystacks.entries()) {
      if (value === token) tokenScore = Math.max(tokenScore, index === 0 ? 140 : 110);
      else if (value.startsWith(token)) tokenScore = Math.max(tokenScore, index === 0 ? 105 : 82);
      else if (value.includes(token)) tokenScore = Math.max(tokenScore, index === 0 ? 72 : 52);
      else tokenScore = Math.max(tokenScore, subsequenceScore(value, token));
    }
    if (!tokenScore) return 0;
    score += tokenScore;
  }
  return score;
}

export function rankPaletteCommands(
  commands: CommandDefinition[],
  query: string,
  usage: CommandUsage,
) {
  const normalized = normalizeCommandQuery(query);
  return commands
    .map((command, registryIndex) => {
      const match = scoreCommandText(command, normalized);
      const recent = usage[command.id];
      const usageBoost = recent
        ? Math.min(18, recent.count * 2) + Math.max(0, 12 - (Date.now() - recent.lastUsedAt) / 86_400_000)
        : 0;
      return {
        command,
        registryIndex,
        match,
        score: match + (normalized ? usageBoost : usageBoost * 2),
      };
    })
    .filter((candidate) => !normalized || candidate.match > 0)
    .sort((left, right) => right.score - left.score || left.registryIndex - right.registryIndex)
    .map(({ command }) => command);
}

export function recordCommandUsage(
  usage: CommandUsage,
  id: CommandId,
  now = Date.now(),
): CommandUsage {
  const current = usage[id];
  return {
    ...usage,
    [id]: { count: Math.min(999, (current?.count ?? 0) + 1), lastUsedAt: now },
  };
}

export function parseCommandUsage(value: string | null): CommandUsage {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const safe: CommandUsage = {};
    for (const [id, candidate] of Object.entries(parsed)) {
      if (!candidate || typeof candidate !== "object") continue;
      const count = Number((candidate as { count?: unknown }).count);
      const lastUsedAt = Number((candidate as { lastUsedAt?: unknown }).lastUsedAt);
      if (!Number.isFinite(count) || !Number.isFinite(lastUsedAt)) continue;
      safe[id as CommandId] = {
        count: Math.max(0, Math.min(999, Math.floor(count))),
        lastUsedAt: Math.max(0, lastUsedAt),
      };
    }
    return safe;
  } catch {
    return {};
  }
}
