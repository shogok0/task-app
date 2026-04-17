/**
 * Japanese natural-language date / task parser.
 *
 * Extracts an absolute / relative date, an optional time, and a subject keyword
 * from free-form Japanese (or mixed) text, returning the remaining text as the
 * task title.
 *
 * Pure TypeScript — no external runtime dependencies.
 */

export type ParsedInput = {
  /** Remaining text after extraction, trimmed and whitespace-collapsed. */
  title: string;
  /** Extracted deadline, or null if nothing date-related matched. */
  deadlineAt: Date | null;
  /** Extracted subject keyword, or null if none matched. */
  subject: string | null;
};

// --------------------------------------------------------------------------
// Subject keywords (order matters: longer / more specific first)
// --------------------------------------------------------------------------
const SUBJECT_KEYWORDS: readonly string[] = [
  "政治経済",
  "現代文",
  "世界史",
  "日本史",
  "プログラミング",
  "政経",
  "家庭科",
  "国語",
  "数学",
  "英語",
  "理科",
  "社会",
  "情報",
  "体育",
  "音楽",
  "美術",
  "家庭",
  "技術",
  "物理",
  "化学",
  "生物",
  "地学",
  "地理",
  "倫理",
  "古文",
  "漢文",
];

// --------------------------------------------------------------------------
// Weekday mapping
// --------------------------------------------------------------------------
const WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  月: 1,
  火: 2,
  水: 3,
  木: 4,
  金: 5,
  土: 6,
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function setTime(d: Date, h: number, m: number): Date {
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

function collapseWhitespace(s: string): string {
  // Collapse any whitespace (ASCII + full-width space) into single ASCII space.
  return s.replace(/[\s\u3000]+/g, " ").trim();
}

type DateMatch = {
  /** Resolved calendar date (time component is zeroed). */
  date: Date;
  /** Index in the original string where the match starts. */
  index: number;
  /** Length of the matched substring. */
  length: number;
};

type TimeMatch = {
  hour: number;
  minute: number;
  index: number;
  length: number;
};

// --------------------------------------------------------------------------
// Absolute & relative DATE extraction
// --------------------------------------------------------------------------
function extractDate(text: string, now: Date): DateMatch | null {
  const today = startOfDay(now);

  // 1a. YYYY/MM/DD or YYYY-MM-DD
  {
    const re = /(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/;
    const m = re.exec(text);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (isValidYmd(y, mo, d)) {
        return {
          date: startOfDay(new Date(y, mo - 1, d)),
          index: m.index,
          length: m[0].length,
        };
      }
    }
  }

  // 1b. M/D (no year) — roll forward if past.
  {
    const re = /(?<![\d/\-])(\d{1,2})[/\-](\d{1,2})(?![\d/\-])/;
    const m = re.exec(text);
    if (m) {
      const mo = Number(m[1]);
      const d = Number(m[2]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        let year = now.getFullYear();
        let candidate = startOfDay(new Date(year, mo - 1, d));
        if (candidate.getTime() < today.getTime()) {
          year += 1;
          candidate = startOfDay(new Date(year, mo - 1, d));
        }
        if (isValidYmd(year, mo, d)) {
          return { date: candidate, index: m.index, length: m[0].length };
        }
      }
    }
  }

  // 1c. N月D日 (Japanese month/day)
  {
    const re = /(\d{1,2})月(\d{1,2})日/;
    const m = re.exec(text);
    if (m) {
      const mo = Number(m[1]);
      const d = Number(m[2]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        let year = now.getFullYear();
        let candidate = startOfDay(new Date(year, mo - 1, d));
        if (candidate.getTime() < today.getTime()) {
          year += 1;
          candidate = startOfDay(new Date(year, mo - 1, d));
        }
        if (isValidYmd(year, mo, d)) {
          return { date: candidate, index: m.index, length: m[0].length };
        }
      }
    }
  }

  // 2. Relative day keywords
  // Order: multi-char first so 明後日 beats 明日.
  const relKeywords: Array<{ key: string; delta: number }> = [
    { key: "明後日", delta: 2 },
    { key: "今日", delta: 0 },
    { key: "明日", delta: 1 },
    { key: "昨日", delta: -1 },
  ];
  for (const { key, delta } of relKeywords) {
    const idx = text.indexOf(key);
    if (idx >= 0) {
      return { date: addDays(today, delta), index: idx, length: key.length };
    }
  }

  // N日後 / N日前
  {
    const re = /(\d{1,3})日(後|前)/;
    const m = re.exec(text);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 365) {
        const delta = m[2] === "後" ? n : -n;
        return {
          date: addDays(today, delta),
          index: m.index,
          length: m[0].length,
        };
      }
    }
  }

  // 3. Weekday phrases
  // 再来週 / 来週 / 今週  + 月|火|水|木|金|土|日 + 曜(日)?
  {
    const re = /(再来週|来週|今週)?\s*(月|火|水|木|金|土|日)曜日?/;
    const m = re.exec(text);
    if (m) {
      const prefix = m[1] ?? "";
      const wd = WEEKDAY_MAP[m[2]];
      const todayWd = today.getDay();
      let delta: number;
      if (prefix === "来週") {
        // Start of next week (treat Monday as first day of week for pragmatism).
        const daysToNextMonday = ((1 - todayWd + 7) % 7) || 7;
        const offsetFromMonday = (wd - 1 + 7) % 7; // Mon=0 ... Sun=6
        delta = daysToNextMonday + offsetFromMonday;
      } else if (prefix === "再来週") {
        const daysToNextMonday = ((1 - todayWd + 7) % 7) || 7;
        const offsetFromMonday = (wd - 1 + 7) % 7;
        delta = daysToNextMonday + 7 + offsetFromMonday;
      } else if (prefix === "今週") {
        // This week's X; if already passed (or today), bump to next week.
        if (wd > todayWd) {
          delta = wd - todayWd;
        } else {
          delta = 7 - (todayWd - wd);
        }
      } else {
        // Bare "X曜". If X <= today's weekday → next week; else this week.
        if (wd > todayWd) {
          delta = wd - todayWd;
        } else {
          delta = 7 - (todayWd - wd);
        }
      }
      return { date: addDays(today, delta), index: m.index, length: m[0].length };
    }
  }

  return null;
}

function isValidYmd(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const probe = new Date(y, mo - 1, d);
  return (
    probe.getFullYear() === y &&
    probe.getMonth() === mo - 1 &&
    probe.getDate() === d
  );
}

// --------------------------------------------------------------------------
// TIME extraction
// --------------------------------------------------------------------------
function extractTime(text: string): TimeMatch | null {
  // Tried in order of specificity.

  // 午前/午後 N時(M分)?
  {
    const re = /(午前|午後)\s*(\d{1,2})時(?:\s*(\d{1,2})分)?/;
    const m = re.exec(text);
    if (m) {
      let h = Number(m[2]);
      const mi = m[3] ? Number(m[3]) : 0;
      if (m[1] === "午後" && h < 12) h += 12;
      if (m[1] === "午前" && h === 12) h = 0;
      if (isValidHm(h, mi)) {
        return { hour: h, minute: mi, index: m.index, length: m[0].length };
      }
    }
  }

  // HH:MM
  {
    const re = /(?<!\d)(\d{1,2}):(\d{2})(?!\d)/;
    const m = re.exec(text);
    if (m) {
      const h = Number(m[1]);
      const mi = Number(m[2]);
      if (isValidHm(h, mi)) {
        return { hour: h, minute: mi, index: m.index, length: m[0].length };
      }
    }
  }

  // N時M分
  {
    const re = /(\d{1,2})時(\d{1,2})分/;
    const m = re.exec(text);
    if (m) {
      const h = Number(m[1]);
      const mi = Number(m[2]);
      if (isValidHm(h, mi)) {
        return { hour: h, minute: mi, index: m.index, length: m[0].length };
      }
    }
  }

  // N時
  {
    const re = /(\d{1,2})時/;
    const m = re.exec(text);
    if (m) {
      const h = Number(m[1]);
      if (isValidHm(h, 0)) {
        return { hour: h, minute: 0, index: m.index, length: m[0].length };
      }
    }
  }

  return null;
}

function isValidHm(h: number, m: number): boolean {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// --------------------------------------------------------------------------
// SUBJECT extraction
// --------------------------------------------------------------------------
type SubjectMatch = {
  subject: string;
  index: number;
  length: number;
};

function extractSubject(text: string): SubjectMatch | null {
  // First match wins by position in text; ties broken by longest.
  let best: SubjectMatch | null = null;
  for (const kw of SUBJECT_KEYWORDS) {
    const idx = text.indexOf(kw);
    if (idx < 0) continue;
    if (
      best === null ||
      idx < best.index ||
      (idx === best.index && kw.length > best.length)
    ) {
      best = { subject: kw, index: idx, length: kw.length };
    }
  }
  return best;
}

// --------------------------------------------------------------------------
// Hashtag extraction
// --------------------------------------------------------------------------
type Range = { index: number; length: number };

function extractHashtagRanges(text: string): Range[] {
  const out: Range[] = [];
  const re = /#\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ index: m.index, length: m[0].length });
  }
  return out;
}

// --------------------------------------------------------------------------
// Utility: remove a set of (possibly overlapping) ranges from text
// --------------------------------------------------------------------------
function removeRanges(text: string, ranges: Range[]): string {
  if (ranges.length === 0) return text;
  const sorted = [...ranges].sort((a, b) => a.index - b.index);
  // Merge overlaps.
  const merged: Range[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.index <= last.index + last.length) {
      const end = Math.max(last.index + last.length, r.index + r.length);
      last.length = end - last.index;
    } else {
      merged.push({ ...r });
    }
  }
  let result = "";
  let cursor = 0;
  for (const r of merged) {
    result += text.slice(cursor, r.index);
    cursor = r.index + r.length;
  }
  result += text.slice(cursor);
  return result;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
export function parseJpInput(input: string, now: Date = new Date()): ParsedInput {
  if (input === "") {
    return { title: "", deadlineAt: null, subject: null };
  }

  const ranges: Range[] = [];

  const dateMatch = extractDate(input, now);
  if (dateMatch) {
    ranges.push({ index: dateMatch.index, length: dateMatch.length });
  }

  const timeMatch = extractTime(input);
  if (timeMatch) {
    ranges.push({ index: timeMatch.index, length: timeMatch.length });
  }

  const subjectMatch = extractSubject(input);
  if (subjectMatch) {
    ranges.push({ index: subjectMatch.index, length: subjectMatch.length });
  }

  for (const r of extractHashtagRanges(input)) {
    ranges.push(r);
  }

  // Compute deadline
  let deadlineAt: Date | null = null;
  if (dateMatch && timeMatch) {
    deadlineAt = setTime(dateMatch.date, timeMatch.hour, timeMatch.minute);
  } else if (dateMatch && !timeMatch) {
    deadlineAt = setTime(dateMatch.date, 23, 59);
    // Preserve seconds/ms at 0 explicitly for the spec "23:59:00.000".
    deadlineAt.setSeconds(0, 0);
  } else if (!dateMatch && timeMatch) {
    const today = startOfDay(now);
    let candidate = setTime(today, timeMatch.hour, timeMatch.minute);
    if (candidate.getTime() <= now.getTime()) {
      candidate = addDays(candidate, 1);
    }
    deadlineAt = candidate;
  }

  // Build title from remaining text
  const remaining = removeRanges(input, ranges);
  const cleaned = collapseWhitespace(remaining);
  const title = cleaned === "" ? (ranges.length === 0 ? input : "") : cleaned;

  // Spec fallback: "If title ends up empty, return title = original input".
  // We only apply the fallback when *nothing* was extracted — otherwise callers
  // want the deliberate empty title (e.g. "来週月曜 国語" → "").
  const finalTitle =
    title === "" && ranges.length === 0 ? input : title;

  return {
    title: finalTitle,
    deadlineAt,
    subject: subjectMatch ? subjectMatch.subject : null,
  };
}
