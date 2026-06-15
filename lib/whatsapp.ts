export function buildWhatsappUrl(message: string) {
  const number = process.env.WHATSAPP_NUMBER || "966501211056";
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}