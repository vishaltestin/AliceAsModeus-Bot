"""Discord character bot for Alice Asmodeus (Iruma-kun).

Replies in-character whenever the character's name is mentioned in any channel
the bot can see. Unlike the Reddit approach, Discord needs no API approval —
you can have this running in about 5 minutes.

Quick setup:
  1. https://discord.com/developers/applications -> "New Application"
  2. Left sidebar -> "Bot" -> "Reset Token" -> copy the token
  3. Still on the Bot page -> enable "MESSAGE CONTENT INTENT"
  4. "OAuth2" -> "URL Generator" -> scope "bot", permissions:
     Send Messages, Read Messages, Read Message History -> copy + open the URL
  5. Put the token in .env as DISCORD_TOKEN
  6. `python discord_bot.py`
"""

import logging
import random
import re

import discord
from discord.ext import commands

import config
from response_generator import AIResponseGenerator

log = logging.getLogger("alice_discord")


def _word_in_text(text, word):
    """Whole-word match so short keywords don't match inside other words."""
    return re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE) is not None


def _load_lines(path):
    try:
        with open(path, encoding="utf-8") as f:
            return [line.rstrip("\n") for line in f if line.strip()]
    except FileNotFoundError:
        return []


def _mentioned(text):
    """True if the text triggers the bot (character mention or direct summon)."""
    text = text.lower()
    for word in config.KEY_WORDS:
        if " " in word:
            if word in text:
                return True
        elif _word_in_text(text, word):
            return True
    for word in config.BOT_INVOKE_WORDS:
        if word in text:
            return True
    return False


class AliceBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True  # required to read message text
        super().__init__(command_prefix="!", intents=intents)

        self.generator = AIResponseGenerator(
            api_key=config.OPENAI_API_KEY,
            model=config.OPENAI_MODEL,
            character_name=config.CHARACTER_NAME,
            primary_traits=config.PRIMARY_TRAITS,
            secondary_traits=config.SECONDARY_TRAITS,
            response_modes=config.RESPONSE_MODES,
            max_response_chars=config.MAX_RESPONSE_CHARS,
        )
        self.quotes = _load_lines(config.QUOTES_FILE)
        self.facts = _load_lines(config.FACTS_FILE)

    async def on_ready(self):
        log.info("Logged in as %s", self.user)

    async def on_message(self, message):
        # Never reply to ourselves.
        if message.author == self.user:
            return

        text = message.content or ""
        if not text.strip() or not _mentioned(text):
            return

        log.info("Triggered by @%s: %s", message.author, text[:80])

        reply = None
        if self.generator.available:
            try:
                reply = self.generator.generate(text)
            except Exception as exc:  # noqa: BLE001
                log.warning("LLM failed (%s); using fallback", exc)

        if not reply:
            pool = self.quotes + self.facts
            reply = random.choice(pool) if pool else None

        if reply:
            await message.reply(reply)


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("logs/bot.log", encoding="utf-8"),
        ],
    )

    token = config.DISCORD_TOKEN
    if not token:
        raise SystemExit(
            "DISCORD_TOKEN not set. Copy .env.example to .env and add your "
            "Discord bot token (see the comments at the top of discord_bot.py)."
        )

    bot = AliceBot()
    bot.run(token)


if __name__ == "__main__":
    main()
