/** Splits `text` into segments, marking the (case-insensitive) occurrences of `query` for highlighting. */
export function splitMatch(text: string, query: string): { text: string; match: boolean }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];

  const segments: { text: string; match: boolean }[] = [];
  const haystack = text.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index === -1) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false });
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }

  return segments.length ? segments : [{ text, match: false }];
}
