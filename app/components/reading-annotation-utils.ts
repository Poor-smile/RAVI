export function normalizeReadingAnnotationQuery(value: string) {
  return value
    .normalize("NFKC")
    .replace(/ي/gu, "ی")
    .replace(/ك/gu, "ک")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

export function quoteReadingAnnotation(value: string) {
  const quote = value.trim().replace(/^(«|")|(»|")$/gu, "");
  return `«${quote}»`;
}

export function formatReadingAnnotationTime(value: string) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return "—";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfCreatedDay = new Date(
    createdAt.getFullYear(),
    createdAt.getMonth(),
    createdAt.getDate(),
  );
  const dayDifference = Math.round(
    (startOfToday.getTime() - startOfCreatedDay.getTime()) / 86_400_000,
  );

  if (dayDifference === 0) {
    return createdAt.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
    });
  }
  if (dayDifference === 1) return "دیروز";
  return createdAt.toLocaleDateString("fa-IR", {
    day: "numeric",
    month: "short",
  });
}
