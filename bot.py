import os
import re
from urllib.parse import quote

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackContext, CommandHandler, Filters, MessageHandler, Updater


TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "1184896317"))

STORE_URL = "https://jothrah.com/"
WHATSAPP_URL = "https://wa.me/966501211056"

if not TOKEN:
    raise ValueError("BOT_TOKEN is not set")


user_last_photo = {}
waiting_for_phone = {}


PEST_INFO = {
    "اكلونيفين": {
        "keywords": ["اكلونيفين", "aclonifen"],
        "title": "أكلونيفين 60% إس سي",
        "desc": "مبيد أعشاب جهازي يستخدم قبل الإنبات.",
        "damage": "الحشائش تنافس المحصول على الغذاء والضوء.",
        "control": "المادة الفعالة: أكلونيفين – مجموعة دايفينيل إيثر.",
        "usage": "يستخدم قبل الإنبات حسب المحصول.",
        "tips": "اختر التوقيت المناسب قبل ظهور الحشائش.",
        "search_term": "أكلونيفين",
    },
}


def normalize(text):
    return text.lower().strip()


def build_search_url(keyword):
    return f"https://jothrah.com/ar/search?q={quote(keyword)}"


def buttons(url):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🛒 عرض المنتجات", url=url)],
        [InlineKeyboardButton("📞 واتساب", url=WHATSAPP_URL)]
    ])


def start(update: Update, context: CallbackContext):
    update.message.reply_text(
        "👋 أهلاً بك في بوت جذرة\n\nاكتب اسم الآفة أو أرسل صورة"
    )


def detect(text):
    text = normalize(text)
    for k, v in PEST_INFO.items():
        for kw in v["keywords"]:
            if kw in text:
                return k
    return None


def reply(update: Update, context: CallbackContext):
    text = update.message.text

    topic = detect(text)

    if topic:
        info = PEST_INFO[topic]
        url = build_search_url(info["search_term"])

        update.message.reply_text(
            f"✅ {info['title']}\n\n"
            f"📌 {info['desc']}\n\n"
            f"⚠️ {info['damage']}\n\n"
            f"🧪 {info['control']}\n\n"
            f"💧 {info['usage']}\n\n"
            f"💡 {info['tips']}",
            reply_markup=buttons(url)
        )
    else:
        url = build_search_url(text)
        update.message.reply_text(
            "🔍 لم يتم التعرف على الطلب",
            reply_markup=buttons(url)
        )


def main():
    print("Bot is running...")

    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher

    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(MessageHandler(Filters.text, reply))

    updater.start_polling()
    updater.idle()


if __name__ == "__main__":
    main()
