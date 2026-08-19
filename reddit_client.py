"""Builds the authenticated PRAW (Reddit) client from config/.env."""

import praw

import config


def build_reddit() -> praw.Reddit:
    """Create and return an authenticated Reddit instance.

    Uses the "script" app OAuth flow, which is the standard way to run a bot
    account. Requires the credentials from .env.
    """
    required = {
        "REDDIT_CLIENT_ID": config.REDDIT_CLIENT_ID,
        "REDDIT_CLIENT_SECRET": config.REDDIT_CLIENT_SECRET,
        "REDDIT_USERNAME": config.REDDIT_USERNAME,
        "REDDIT_PASSWORD": config.REDDIT_PASSWORD,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(
            "Missing Reddit credentials in .env: " + ", ".join(missing) + "\n"
            "Copy .env.example to .env and fill in your values "
            "(see README.md for setup instructions)."
        )

    return praw.Reddit(
        client_id=config.REDDIT_CLIENT_ID,
        client_secret=config.REDDIT_CLIENT_SECRET,
        user_agent=config.REDDIT_USER_AGENT,
        username=config.REDDIT_USERNAME,
        password=config.REDDIT_PASSWORD,
    )
