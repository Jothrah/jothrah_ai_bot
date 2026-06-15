export const sensitiveKeywords = [
  // Arabic
  "طفل",
  "أطفال",
  "رضيع",
  "حامل",
  "حمل",
  "قط",
  "قطة",
  "قطط",
  "كلب",
  "كلاب",
  "حيوان",
  "حيوانات",
  "حساسية",
  "ربو",
  "تسمم",
  "دوخة",
  "اختناق",
  "رائحة قوية",
  "مكان مغلق",
  "غرفة نوم",
  "طعام",

  // English
  "child",
  "children",
  "baby",
  "infant",
  "pregnant",
  "pregnancy",
  "cat",
  "cats",
  "dog",
  "dogs",
  "pet",
  "pets",
  "animal",
  "animals",
  "allergy",
  "asthma",
  "poisoning",
  "dizziness",
  "choking",
  "strong odor",
  "closed space",
  "bedroom",
  "food"

];

export function needsWhatsapp(message: string): boolean {
  const text = message.toLowerCase();
  return sensitiveKeywords.some((word) => text.includes(word.toLowerCase()));
}