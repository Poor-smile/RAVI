import { parse } from "yaml";

type MetadataRecord = Record<string, unknown>;

export type WordFrontmatterProperties = {
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string;
  description?: string;
  customProperties: Array<{ name: string; value: string }>;
};

export type ExtractedWordFrontmatter = {
  markdown: string;
  properties: WordFrontmatterProperties;
};

function scalarText(value: unknown) {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return undefined;
}
function propertyText(value: unknown): string | undefined {
  const scalar = scalarText(value);
  if (scalar !== undefined) return scalar;
  if (Array.isArray(value)) {
    const scalars = value.map(scalarText);
    if (scalars.every((item): item is string => item !== undefined)) {
      return scalars.join(", ");
    }
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function recordValue(record: MetadataRecord, names: string[]) {
  const match = Object.keys(record).find((key) =>
    names.some((name) => key.toLocaleLowerCase("en-US") === name),
  );
  return match ? record[match] : undefined;
}

function flattenCustomProperties(
  value: unknown,
  path: string[],
  output: Array<{ name: string; value: string }>,
  ancestors = new Set<object>(),
) {
  if (path.length > 64) throw new Error("Frontmatter nesting is too deep.");
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    const text = propertyText(value);
    if (text) output.push({ name: `Raavi.${path.join(".")}`, value: text });
    return;
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    if (ancestors.has(value)) throw new Error("Frontmatter contains a circular alias.");
    ancestors.add(value);
    try {
      for (const [key, child] of Object.entries(value as MetadataRecord)) {
        flattenCustomProperties(child, [...path, key], output, ancestors);
      }
    } finally {
      ancestors.delete(value);
    }
    return;
  }
  const text = propertyText(value);
  if (text) output.push({ name: `Raavi.${path.join(".")}`, value: text });
}

function customProperties(record: MetadataRecord) {
  const output: Array<{ name: string; value: string }> = [];
  const standardRootKeys = new Set([
    "title",
    "subject",
    "description",
    "tags",
    "keywords",
  ]);

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLocaleLowerCase("en-US");
    if (standardRootKeys.has(normalizedKey)) continue;
    if (normalizedKey === "author" && value && typeof value === "object") {
      for (const [authorKey, authorValue] of Object.entries(value as MetadataRecord)) {
        if (authorKey.toLocaleLowerCase("en-US") === "name") continue;
        flattenCustomProperties(authorValue, [key, authorKey], output);
      }
      continue;
    }
    if (normalizedKey === "author") continue;
    flattenCustomProperties(value, [key], output);
  }

  const seen = new Set<string>();
  return output
    .map(({ name, value }) => ({
      name: name.slice(0, 255),
      value: value.slice(0, 32_767),
    }))
    .filter(({ name }) => {
      const key = name.toLocaleLowerCase("en-US");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseProperties(raw: string): WordFrontmatterProperties {
  let parsed: unknown;
  try {
    parsed = parse(raw, { maxAliasCount: 50 });
  } catch {
    return {
      customProperties: [
        {
          name: "Raavi.Frontmatter",
          value: raw.slice(0, 32_767),
        },
      ],
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { customProperties: [] };
  }

  const record = parsed as MetadataRecord;
  const author = recordValue(record, ["author"]);
  const creator =
    scalarText(author) ??
    (author && typeof author === "object" && !Array.isArray(author)
      ? scalarText(recordValue(author as MetadataRecord, ["name"]))
      : undefined);
  const tags = recordValue(record, ["tags", "keywords"]);
  let custom: WordFrontmatterProperties["customProperties"];
  try {
    custom = customProperties(record);
  } catch {
    // Preserve metadata that cannot be flattened instead of failing Word export.
    custom = [{ name: "Raavi.Frontmatter", value: raw.slice(0, 32_767) }];
  }

  return {
    title: scalarText(recordValue(record, ["title"])),
    subject: scalarText(recordValue(record, ["subject"])),
    creator,
    keywords: propertyText(tags),
    description: scalarText(recordValue(record, ["description"])),
    customProperties: custom,
  };
}

export function extractWordFrontmatter(markdown: string): ExtractedWordFrontmatter {
  const opening = /^(?:\uFEFF)?---[\t ]*(?:\r?\n)/u.exec(markdown);
  if (!opening) return { markdown, properties: { customProperties: [] } };

  const closingPattern = /^(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/gmu;
  closingPattern.lastIndex = opening[0].length;
  const closing = closingPattern.exec(markdown);
  if (!closing) return { markdown, properties: { customProperties: [] } };

  const raw = markdown.slice(opening[0].length, closing.index).trim();
  return {
    markdown: markdown.slice(closing.index + closing[0].length),
    properties: parseProperties(raw),
  };
}
