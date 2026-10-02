/**
 * Achievement cards (Prep blueprint C1): an image a learner shares — a
 * WhatsApp status or a story (9:16), or a post (1:1) — in English or Hindi.
 * Drawn as SVG on the server, from what the server knows, so a card never
 * claims what was not earned. The browser turns it into a PNG to share.
 */

export type CardFormat = "story" | "square";
export type CardLanguage = "en" | "hi";

export const ACHIEVEMENT_NAMES: Readonly<Record<string, { readonly en: string; readonly hi: string }>> = {
  first_solve: { en: "First solve", hi: "पहला हल" },
  solved_10: { en: "10 solved", hi: "10 हल" },
  solved_50: { en: "50 solved", hi: "50 हल" },
  solved_100: { en: "100 solved", hi: "100 हल" },
  solved_250: { en: "250 solved", hi: "250 हल" },
  first_hard: { en: "A hard one", hi: "एक कठिन प्रश्न" },
  streak_7: { en: "7-day streak", hi: "7 दिन लगातार" },
  streak_30: { en: "30-day streak", hi: "30 दिन लगातार" },
  streak_100: { en: "100-day streak", hi: "100 दिन लगातार" },
  first_contest: { en: "First contest", hi: "पहला कॉन्टेस्ट" },
  podium: { en: "Top three", hi: "टॉप तीन" },
  rating_1600: { en: "Rated 1600", hi: "1600 रेटिंग" },
  storyteller: { en: "Storyteller", hi: "कहानीकार" },
};

const WORDS = {
  en: { earned: "Achievement unlocked", on: "on", rating: "Rating" },
  hi: { earned: "उपलब्धि मिली", on: "पर", rating: "रेटिंग" },
} as const;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Long names are cut, not squeezed: a card is read at a glance. */
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function achievementCard(input: {
  readonly format: CardFormat;
  readonly lang: CardLanguage;
  readonly achievement: string;
  readonly name: string;
  readonly site: string;
  readonly title: string;
  readonly rating: number | null;
  /** Where the learner's public profile is; null when it is not public. */
  readonly profileUrl: string | null;
}): string {
  const label = ACHIEVEMENT_NAMES[input.achievement]?.[input.lang] ?? input.achievement;
  const w = WORDS[input.lang];
  const width = 1080;
  const height = input.format === "story" ? 1920 : 1080;
  const mid = height / 2;
  const font = input.lang === "hi" ? "'Noto Sans Devanagari', 'Mukta', sans-serif" : "'Inter', 'Segoe UI', sans-serif";
  const line = (y: number, size: number, text: string, weight = 400, fill = "#ffffff", opacity = 1) =>
    `<text x="540" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" fill-opacity="${opacity}">${escape(text)}</text>`;
  const standing = input.rating === null ? input.title : `${input.title} · ${w.rating} ${input.rating}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${font}" role="img" aria-label="${escape(`${w.earned}: ${label} — ${input.name}`)}">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs>`,
    `<rect width="${width}" height="${height}" fill="url(#bg)"/>`,
    `<circle cx="540" cy="${mid - 250}" r="150" fill="#fbbf24"/>`,
    `<path d="M480 ${mid - 320} h120 v60 a60 60 0 0 1 -120 0 z M520 ${mid - 200} h40 v40 h30 v20 h-100 v-20 h30 z" fill="#1e1b4b"/>`,
    line(mid - 20, 40, w.earned, 500, "#c7d2fe"),
    line(mid + 70, 84, clip(label, 22), 700),
    line(mid + 170, 52, clip(input.name, 30), 600),
    line(mid + 240, 38, standing, 400, "#e0e7ff"),
    line(height - 150, 34, `${w.on} ${clip(input.site, 40)}`, 400, "#c7d2fe"),
    input.profileUrl === null ? "" : line(height - 95, 28, clip(input.profileUrl.replace(/^https?:\/\//, ""), 60), 400, "#a5b4fc"),
    `</svg>`,
  ].join("");
}
