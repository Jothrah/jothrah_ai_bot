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

export function detectLanguage(message: string): BotLanguage {
  return /[\u0600-\u06FF]/.test(message) ? "ar" : "en";
}

function normalizeText(text: string) {
  return text.toLowerCase().trim();
}

export function matchCategories(
  message: string,
  language: BotLanguage = detectLanguage(message)
): MatchedCategory[] {
  const text = normalizeText(message);

  return categories
    .map((category) => {
      const keywords = category.keywords[language] || [];
      const score = keywords.reduce((total, keyword) => {
        return text.includes(normalizeText(keyword)) ? total + 1 : total;
      }, 0);

      return {
        key: category.key,
        title: category.title[language],
        url: category.url[language],
        score
      };
    })
    .filter((category) => category.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}