"""Central configuration for the Alice Asmodeus Reddit bot.

Everything you'll want to tweak lives in this file: credentials are read from
a `.env` file (never commit real secrets), and the character / subreddit /
behaviour settings are plain constants below.
"""

import os

from dotenv import load_dotenv

load_dotenv()  # loads credentials from .env into the environment


# ---------------------------------------------------------------------------
# Credentials (populate a `.env` file — see .env.example)
# ---------------------------------------------------------------------------
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USERNAME = os.getenv("REDDIT_USERNAME")
REDDIT_PASSWORD = os.getenv("REDDIT_PASSWORD")
REDDIT_USER_AGENT = os.getenv(
    "REDDIT_USER_AGENT", "AliceAsModeusBot/1.0 (by /u/your_username)"
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Discord bot token (used by discord_bot.py)
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")


# ---------------------------------------------------------------------------
# Character / persona
# ---------------------------------------------------------------------------
CHARACTER_NAME = "Alice Asmodeus from 'Welcome to Demon School! Iruma-kun'"

# Words that make the bot appear in a post or comment (case-insensitive).
# Multi-word phrases match anywhere in the text; single words match only as
# whole words, so "azu" won't accidentally match "azure".
#
# NOTE: "alice" alone is a common name, so if you see false positives you can
# narrow this to just the full names ("alice asmodeus", "asmodeus alice").
KEY_WORDS = [
    "alice",
    "asmodeus",
    "azmodeus",       # common misspelling
    "alice asmodeus",
    "asmodeus alice",
    "azu",            # his nickname ("Azu-chan")
    "azz-kun",
]

# Words that summon the bot directly, even if the character isn't mentioned.
BOT_INVOKE_WORDS = [
    "alicebot",
    "alice bot",
    "asmodeusbot",
    "asmodeus bot",
    "azu bot",
]

# Personality traits mixed at random into every generated reply.
PRIMARY_TRAITS = [
    "proud and aristocratic",
    "elegant and refined",
    "fiercely loyal and devoted",
    "competitive and hot-blooded",
    "dramatic and theatrical",
    "protective and gallant",
]
SECONDARY_TRAITS = [
    "earnest",
    "flustered",
    "smug",
    "sincere",
    "overzealous",
    "tender",
]

# Response modes: (name, instruction, weight). Higher weight = more likely.
# The bot picks one at random for each reply to add variety.
RESPONSE_MODES = [
    ("chat", "Have a natural in-character conversation.", 6),
    ("joke", "Respond with a relevant joke, staying in character.", 2),
    ("fact", "Respond with a relevant fact or piece of trivia, in character.", 2),
]

# Cap on generated reply length (Reddit comments allow 10,000 chars, but the
# character is more convincing with short, punchy replies).
MAX_RESPONSE_CHARS = 500


# ---------------------------------------------------------------------------
# Where the bot listens
# ---------------------------------------------------------------------------
SUBREDDITS = ["DemonSchoolIrumakun"]


# ---------------------------------------------------------------------------
# Bot behaviour
# ---------------------------------------------------------------------------
NO_SUBMISSIONS = 30   # how many recent submissions to scan each loop
CHECK_INTERVAL = 300  # seconds between scans (5 minutes)

# Small footer appended to every reply (Reddit asks bots to identify
# themselves; some subreddits require it).
BOT_TAG = "\n\n---\n*beep boop — I'm a bot*"


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------
QUOTES_FILE = "personality/quotes.txt"
FACTS_FILE = "personality/facts.txt"
BLACKLIST_FILE = "data/blacklist.txt"
REPLIED_TO_FILE = "data/replied_to.txt"
QUARANTINED_USERS_FILE = "data/quarantined_users.txt"

# How long a user is ignored after posting blacklisted words (seconds).
QUARANTINE_TIME = 5 * 24 * 3600
