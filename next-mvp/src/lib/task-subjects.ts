/**
 * Maps a subject name (Japanese) to a stable color bucket for UI rendering.
 *
 * Each supported subject is assigned to one of ~10 color buckets keyed by
 * the first character of the subject name (plus overrides for aliases).
 * Returns Tailwind-compatible arbitrary-value class names for background,
 * foreground text, and a standalone "dot" indicator color.
 */

export type SubjectColor = {
  bg: string;
  text: string;
  dot: string;
};

type Palette = {
  bg: string;
  text: string;
  dot: string;
};

/** 10 distinct color buckets (iOS-ish palette, work on dark+light). */
const PALETTES: readonly Palette[] = [
  // 0: red
  {
    bg: "bg-[rgba(255,59,48,0.14)]",
    text: "text-[rgb(255,99,92)]",
    dot: "bg-[rgb(255,99,92)]",
  },
  // 1: orange
  {
    bg: "bg-[rgba(255,149,0,0.14)]",
    text: "text-[rgb(255,170,40)]",
    dot: "bg-[rgb(255,170,40)]",
  },
  // 2: yellow
  {
    bg: "bg-[rgba(255,204,0,0.16)]",
    text: "text-[rgb(234,190,20)]",
    dot: "bg-[rgb(234,190,20)]",
  },
  // 3: green
  {
    bg: "bg-[rgba(52,199,89,0.14)]",
    text: "text-[rgb(80,210,120)]",
    dot: "bg-[rgb(80,210,120)]",
  },
  // 4: teal
  {
    bg: "bg-[rgba(48,176,199,0.16)]",
    text: "text-[rgb(90,200,220)]",
    dot: "bg-[rgb(90,200,220)]",
  },
  // 5: blue
  {
    bg: "bg-[rgba(10,132,255,0.16)]",
    text: "text-[rgb(80,160,255)]",
    dot: "bg-[rgb(80,160,255)]",
  },
  // 6: indigo
  {
    bg: "bg-[rgba(88,86,214,0.18)]",
    text: "text-[rgb(140,138,232)]",
    dot: "bg-[rgb(140,138,232)]",
  },
  // 7: purple
  {
    bg: "bg-[rgba(175,82,222,0.16)]",
    text: "text-[rgb(198,130,235)]",
    dot: "bg-[rgb(198,130,235)]",
  },
  // 8: pink
  {
    bg: "bg-[rgba(255,45,85,0.14)]",
    text: "text-[rgb(255,105,145)]",
    dot: "bg-[rgb(255,105,145)]",
  },
  // 9: gray (fallback)
  {
    bg: "bg-[rgba(142,142,147,0.18)]",
    text: "text-[rgb(174,174,178)]",
    dot: "bg-[rgb(174,174,178)]",
  },
];

const NEUTRAL: Palette = PALETTES[9];

/**
 * Explicit bucket assignments for known subjects.
 * Keeps each related family in its own color while staying within 10 buckets.
 */
const SUBJECT_BUCKET: Record<string, number> = {
  // Language arts → red family
  国語: 0,
  現代文: 0,
  古文: 0,
  漢文: 0,

  // Math → blue
  数学: 5,

  // English → indigo
  英語: 6,

  // Science family → green / teal / yellow / purple
  理科: 3,
  物理: 5,
  化学: 1,
  生物: 3,
  地学: 4,

  // Social studies family → orange
  社会: 1,
  世界史: 1,
  日本史: 0,
  地理: 3,
  倫理: 7,
  政治経済: 7,
  政経: 7,

  // Tech / info → teal
  情報: 4,
  プログラミング: 4,
  技術: 4,

  // Arts / life → pink / yellow / green
  体育: 3,
  音楽: 7,
  美術: 8,
  家庭科: 8,
  家庭: 8,
};

function bucketForSubject(subject: string): number {
  if (subject in SUBJECT_BUCKET) {
    return SUBJECT_BUCKET[subject];
  }
  // Hash by first code point into the 10 buckets (skip the neutral slot).
  const cp = subject.codePointAt(0) ?? 0;
  return cp % 9;
}

export function subjectColor(
  subject: string | null | undefined,
): SubjectColor {
  if (!subject) {
    return { bg: NEUTRAL.bg, text: NEUTRAL.text, dot: NEUTRAL.dot };
  }
  const trimmed = subject.trim();
  if (trimmed === "") {
    return { bg: NEUTRAL.bg, text: NEUTRAL.text, dot: NEUTRAL.dot };
  }
  const p = PALETTES[bucketForSubject(trimmed)] ?? NEUTRAL;
  return { bg: p.bg, text: p.text, dot: p.dot };
}
