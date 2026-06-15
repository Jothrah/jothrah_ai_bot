import categoriesData from "@/data/categories.json";

export type BotLanguage = "ar" | "en";

type Category = {
  key: string;
  title: {
    ar: string;
    en: string;
  };
  keywords: {
    ar: string[];
    en: string[];
  };
  url: {
    ar: string;
    en: string;
  };
};

export type MatchedCategory = {
  key: string;
  title: string;
  url: string;
  score: number;
};

const categories = categoriesData as Category[];

const weakContextWords = [
  "مطبخ",
  "حمام",
  "زوايا",
  "شقوق",
  "حوش",
  "حديقة",
  "kitchen",
  "bathroom",
  "corners",
  "cracks",
  "yard",
  "garden"
];

export function detectLanguage(message: string): BotLanguage {
  return /[\u0600-\u06FF]/.test(message) ? "ar" : "en";
}

function normalizeText(text: string) {
  return text.toLowerCase().trim();
}

function keywordScore(keyword: string) {
  const normalized = normalizeText(keyword);
  return weakContextWords.includes(normalized) ? 1 : 5;
}

export function matchCategories(
  message: string,
  language: BotLanguage = detectLanguage(message)
): MatchedCategory[] {
  const text = normalizeText(message);

  const scored = categories
    .map((category) => {
      const keywords = category.keywords[language] || [];

      const score = keywords.reduce((total, keyword) => {
        const normalizedKeyword = normalizeText(keyword);
        return text.includes(normalizedKeyword)
          ? total + keywordScore(normalizedKeyword)
          : total;
      }, 0);

      return {
        key: category.key,
        title: category.title[language],
        url: category.url[language],
        score
      };
    })
    .filter((category) => category.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestScore = scored[0]?.score || 0;

  if (bestScore >= 5) {
    return scored.filter((category) => category.score >= 5).slice(0, 3);
  }

  return scored.slice(0, 3);
}