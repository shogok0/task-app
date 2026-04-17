import { describe, expect, it } from "vitest";

import { parseJpInput } from "@/lib/nlp/parse-jp-date";

// Fixed "now" used across tests for deterministic results.
// 2026-04-18 is a Saturday (getDay() === 6).
// Time is set to 01:00 local so that "today" comparisons for afternoon times
// resolve to "today" rather than "tomorrow".
const NOW = new Date(2026, 3, 18, 1, 0, 0, 0);

function ymdhm(d: Date): [number, number, number, number, number] {
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ];
}

describe("parseJpInput", () => {
  it("parses 明日 + 17時 + subject 数学 + trailing text", () => {
    const r = parseJpInput("明日 17時 数学ワーク p.42", NOW);
    expect(r.subject).toBe("数学");
    expect(r.title).toBe("ワーク p.42");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 19, 17, 0]);
  });

  it("parses M/D with current-year rollover forward", () => {
    const r = parseJpInput("4/28 英語レポート", NOW);
    expect(r.subject).toBe("英語");
    expect(r.title).toBe("レポート");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 28, 23, 59]);
  });

  it("rolls M/D to next year when date has already passed this year", () => {
    const r = parseJpInput("1/5 英語", NOW);
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2027, 1, 5, 23, 59]);
  });

  it("parses 来週月曜 + subject (title may be empty)", () => {
    const r = parseJpInput("来週月曜 国語", NOW);
    expect(r.subject).toBe("国語");
    expect(r.title).toBe("");
    expect(r.deadlineAt).not.toBeNull();
    // Saturday 2026-04-18 → next Monday is 2026-04-20.
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 20, 23, 59]);
  });

  it("parses N日後", () => {
    const r = parseJpInput("3日後 テスト勉強", NOW);
    expect(r.title).toBe("テスト勉強");
    expect(r.subject).toBeNull();
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 21, 23, 59]);
  });

  it("parses M/D + HH:MM + subject", () => {
    const r = parseJpInput("10/1 9:00 数学テスト", NOW);
    expect(r.subject).toBe("数学");
    expect(r.title).toBe("テスト");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 10, 1, 9, 0]);
  });

  it("returns null deadline when no date/time keywords are present", () => {
    const r = parseJpInput("宿題", NOW);
    expect(r.title).toBe("宿題");
    expect(r.deadlineAt).toBeNull();
    expect(r.subject).toBeNull();
  });

  it("parses 明後日 and subject 物理", () => {
    const r = parseJpInput("明後日 物理プリント", NOW);
    expect(r.subject).toBe("物理");
    expect(r.title).toBe("プリント");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 20, 23, 59]);
  });

  it("parses 午後N時 and uses today when time not yet passed", () => {
    const r = parseJpInput("午後3時 国語", NOW);
    expect(r.subject).toBe("国語");
    expect(r.deadlineAt).not.toBeNull();
    // NOW is 01:00 → 15:00 is later today.
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 18, 15, 0]);
  });

  it("parses HH:MM with no date (today, not past)", () => {
    const r = parseJpInput("23:00 読書", NOW);
    expect(r.title).toBe("読書");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 18, 23, 0]);
  });

  it("rolls time-only inputs to tomorrow if time already passed today", () => {
    const lateNow = new Date(2026, 3, 18, 23, 30, 0, 0);
    const r = parseJpInput("22:00 夜勉", lateNow);
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 19, 22, 0]);
  });

  it("parses YYYY/MM/DD with HH:MM and subject 世界史", () => {
    const r = parseJpInput("2026/05/01 12:00 世界史", NOW);
    expect(r.subject).toBe("世界史");
    expect(r.title).toBe("");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 5, 1, 12, 0]);
  });

  it("parses 来週金曜 + HH:MM + subject 情報", () => {
    const r = parseJpInput("来週金曜 14:30 情報 課題提出", NOW);
    expect(r.subject).toBe("情報");
    expect(r.title).toBe("課題提出");
    expect(r.deadlineAt).not.toBeNull();
    // Saturday 2026-04-18 → next Friday is 2026-04-24.
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 24, 14, 30]);
  });

  it("strips hashtag but keeps title; no deadline", () => {
    const r = parseJpInput("買い物 #プライベート", NOW);
    expect(r.title).toBe("買い物");
    expect(r.deadlineAt).toBeNull();
    expect(r.subject).toBeNull();
  });

  it("parses 昨日 as past deadline (overdue but still parsed)", () => {
    const r = parseJpInput("昨日 過ぎたもの", NOW);
    expect(r.title).toBe("過ぎたもの");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 17, 23, 59]);
  });

  it("returns empty result for empty input", () => {
    const r = parseJpInput("", NOW);
    expect(r.title).toBe("");
    expect(r.deadlineAt).toBeNull();
    expect(r.subject).toBeNull();
  });

  it("collapses whitespace around extracted subject", () => {
    const r = parseJpInput("   数学   レポート  ", NOW);
    expect(r.subject).toBe("数学");
    expect(r.title).toBe("レポート");
    expect(r.deadlineAt).toBeNull();
  });

  it("parses N月D日 Japanese month-day format", () => {
    const r = parseJpInput("5月10日 化学プリント", NOW);
    expect(r.subject).toBe("化学");
    expect(r.title).toBe("プリント");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 5, 10, 23, 59]);
  });

  it("parses 午前N時M分 correctly", () => {
    const r = parseJpInput("明日 午前9時30分 英語", NOW);
    expect(r.subject).toBe("英語");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 19, 9, 30]);
  });

  it("prefers the longer/more-specific subject keyword at same position", () => {
    const r = parseJpInput("世界史レポート 明日", NOW);
    expect(r.subject).toBe("世界史");
    expect(r.title).toBe("レポート");
  });

  it("parses N日前 as past deadline", () => {
    const r = parseJpInput("2日前 忘れ物", NOW);
    expect(r.title).toBe("忘れ物");
    expect(r.deadlineAt).not.toBeNull();
    expect(ymdhm(r.deadlineAt!)).toEqual([2026, 4, 16, 23, 59]);
  });
});
