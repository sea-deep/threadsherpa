export interface FaqEntry { question: string; answer: string; }

/** Deliberately deterministic: import the moderator's wording, never inferred answers. */
export function parseFaq(text: string): FaqEntry[] {
  if (!text.trim() || text.length > 4000) throw new Error('Paste up to 4,000 characters.');
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const qa = /^Q:\s*\S/im.test(normalized);
  const entries: FaqEntry[] = [];
  let question: string | undefined;
  let lines: string[] = [];
  let fence: string | undefined;
  const finish = () => {
    if (!question) return;
    const answer = lines.join('\n').trim();
    if (!answer) throw new Error(`Add an answer for “${question.slice(0, 60)}”.`);
    if (question.length > 200 || answer.length > 3500) throw new Error('Questions can be 200 characters; answers can be 3,500.');
    entries.push({ question, answer });
  };
  for (const line of normalized.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      lines.push(line);
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (marker && question) { fence = marker; lines.push(line); continue; }
    const heading = qa ? /^Q:\s*(.+)$/i.exec(line) : /^#{2,3}\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (heading) { finish(); question = heading[1].trim(); lines = []; }
    else if (question) {
      if (!lines.length && !line.trim()) continue;
      lines.push(qa && !lines.length ? line.replace(/^A:\s*/i, '') : line);
    }
    else if (line.trim() && !/^#\s+/.test(line)) throw new Error('Use ## Question headings or Q: and A: pairs.');
  }
  if (fence) throw new Error('Close the code block before importing.');
  finish();
  if (!entries.length) throw new Error('Use ## Question headings or Q: and A: pairs.');
  if (entries.length > 10) throw new Error('Import up to 10 answers at a time.');
  if (new Set(entries.map(e => e.question.toLowerCase())).size !== entries.length) throw new Error('Each question should appear once in the import.');
  return entries;
}

export function httpsSource(value: string): string | undefined {
  if (!value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 500) return url.href;
  } catch { /* Report the same useful error for malformed and unsupported links. */ }
  throw new Error('Use an https source link without login details.');
}
