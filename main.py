"""Entry point for the Alice Asmodeus Reddit bot."""

import logging

from character_bot import CharacterBot
from reddit_client import build_reddit


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("logs/bot.log", encoding="utf-8"),
        ],
    )


def main():
    setup_logging()
    log = logging.getLogger("main")

    log.info("Starting Alice Asmodeus bot...")
    reddit = build_reddit()
    log.info("Authenticated as u/%s", reddit.user.me().name)

    bot = CharacterBot(reddit)
    bot.run()


if __name__ == "__main__":
    main()
