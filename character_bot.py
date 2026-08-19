"""The core bot logic: watch Reddit for character mentions and reply in
character. Loosely based on the structure of the UraharaBot reference project,
rewritten for the current PRAW / OpenAI APIs and the Alice Asmodeus persona.
"""

import logging
import random
import re
import time
from datetime import datetime

import praw

import config
from response_generator import AIResponseGenerator

log = logging.getLogger("alice_bot")

# Words that indicate a follow-up question when someone replies to the bot.
QUESTION_WORDS = {
    "who", "what", "why", "how", "where", "when", "did", "do", "tell",
    "give", "can", "could", "would", "is", "are", "which",
}


def _load_lines(path):
    """Read a text file into a list of non-empty, stripped lines."""
    try:
        with open(path, encoding="utf-8") as f:
            return [line.rstrip("\n") for line in f if line.strip()]
    except FileNotFoundError:
        return []


def _word_in_text(text, word):
    """Whole-word match, so short keywords don't match inside other words."""
    return re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE) is not None


class CharacterBot:
    def __init__(self, reddit):
        self.reddit = reddit
        self.me = getattr(reddit.user.me(), "name", None)

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
        self.blacklist = _load_lines(config.BLACKLIST_FILE)
        self.replied = set(_load_lines(config.REPLIED_TO_FILE))
        self.quarantined = self._load_quarantined()

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _load_quarantined(self):
        active = {}
        now = datetime.now()
        for record in _load_lines(config.QUARANTINED_USERS_FILE):
            parts = record.split(",")
            if len(parts) != 2:
                continue
            name, ts = parts
            try:
                since = now - datetime.fromisoformat(ts)
            except ValueError:
                continue
            if since.total_seconds() < config.QUARANTINE_TIME:
                active[name] = ts
        return active

    def _save_quarantined(self):
        with open(config.QUARANTINED_USERS_FILE, "w", encoding="utf-8") as f:
            for name, ts in self.quarantined.items():
                f.write(f"{name},{ts}\n")

    def _save_replied(self):
        with open(config.REPLIED_TO_FILE, "w", encoding="utf-8") as f:
            for item_id in self.replied:
                f.write(item_id + "\n")

    def _mark_replied(self, item_id):
        self.replied.add(item_id)
        self._save_replied()

    # ------------------------------------------------------------------
    # Content checks
    # ------------------------------------------------------------------
    @staticmethod
    def _text_of(item):
        if isinstance(item, praw.models.Submission):
            return f"{item.title} {item.selftext or ''}".strip()
        return item.body

    def _is_mentioned(self, text):
        text = text.lower()
        for word in config.KEY_WORDS:
            if " " in word:
                if word in text:
                    return True
            elif _word_in_text(text, word):
                return True
        return False

    def _is_safe(self, text):
        text = text.lower()
        for word in self.blacklist:
            if " " in word:
                if word in text:
                    return False
            elif _word_in_text(text, word):
                return False
        return True

    def _is_quarantined(self, name):
        ts = self.quarantined.get(name)
        if not ts:
            return False
        try:
            since = datetime.now() - datetime.fromisoformat(ts)
        except ValueError:
            return True
        if since.total_seconds() >= config.QUARANTINE_TIME:
            self.quarantined.pop(name, None)
            return False
        return True

    def _already_replied(self, item):
        if item.id in self.replied:
            return True
        # Also check the already-loaded replies, in case state was lost
        # (e.g. the reply was posted but the file write failed, or a restart).
        replies = (
            item.comments if isinstance(item, praw.models.Submission) else item.replies
        )
        for reply in replies:
            if getattr(getattr(reply, "author", None), "name", None) == self.me:
                return True
        return False

    def _is_reply_to_bot(self, item):
        return (
            isinstance(item, praw.models.Comment)
            and getattr(getattr(item.parent(), "author", None), "name", None) == self.me
        )

    # ------------------------------------------------------------------
    # Decision logic
    # ------------------------------------------------------------------
    def should_reply(self, item):
        author_name = getattr(item.author, "name", None)
        if not author_name or author_name == self.me:
            return False
        if self._already_replied(item):
            return False
        if self._is_quarantined(author_name):
            return False

        text = self._text_of(item)
        lowered = text.lower()
        is_bot_invoked = any(w in lowered for w in config.BOT_INVOKE_WORDS)
        is_reply_to_bot = self._is_reply_to_bot(item)
        is_mentioned = self._is_mentioned(text)

        if is_bot_invoked or is_mentioned:
            pass  # will reply (subject to blacklist below)
        elif is_reply_to_bot:
            # Only continue a conversation if it looks like a question or
            # follow-up, to avoid replying endlessly to our own threads.
            has_question = "?" in text or any(
                w in lowered.split() for w in QUESTION_WORDS
            )
            if not has_question:
                return False
        else:
            return False

        if not self._is_safe(text):
            self.quarantined[author_name] = datetime.now().isoformat()
            self._save_quarantined()
            log.info("Skipped blacklisted text from u/%s", author_name)
            return False

        return True

    # ------------------------------------------------------------------
    # Replying
    # ------------------------------------------------------------------
    def _build_context(self, item):
        """Give the LLM the previous message when replying to a thread."""
        if not isinstance(item, praw.models.Comment):
            return []
        parent = item.parent()
        if not isinstance(parent, praw.models.Comment):
            return []
        role = (
            "assistant"
            if getattr(parent.author, "name", None) == self.me
            else "user"
        )
        return [{"role": role, "content": parent.body}]

    def get_reply(self, item):
        text = self._text_of(item)
        context = self._build_context(item)

        reply = None
        if self.generator.available:
            try:
                reply = self.generator.generate(text, context)
            except Exception as exc:  # noqa: BLE001 - fall back gracefully
                log.warning("LLM generation failed (%s); using fallback", exc)

        if not reply:
            pool = self.quotes + self.facts
            reply = random.choice(pool) if pool else None

        return reply

    def post_reply(self, item, reply):
        item.reply(reply + config.BOT_TAG)
        self._mark_replied(item.id)
        log.info("Replied to %s %s", type(item).__name__, item.id)

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    def _handle(self, item):
        try:
            if not self.should_reply(item):
                return
            reply = self.get_reply(item)
            if not reply:
                return
            self.post_reply(item, reply)
        except Exception:  # noqa: BLE001 - one bad item shouldn't kill the bot
            log.exception("Failed while handling %s", getattr(item, "id", "?"))

    def scan(self, subreddit):
        for submission in subreddit.new(limit=config.NO_SUBMISSIONS):
            self._handle(submission)
            try:
                submission.comments.replace_more(limit=None)
            except Exception:  # noqa: BLE001
                log.exception("replace_more failed on %s", submission.id)
                continue
            for comment in submission.comments.list():
                self._handle(comment)

    def run(self):
        log.info(
            "Bot started (u/%s). Monitoring r/%s every %ss.",
            self.me,
            "+".join(config.SUBREDDITS),
            config.CHECK_INTERVAL,
        )
        subreddit = self.reddit.subreddit("+".join(config.SUBREDDITS))
        while True:
            try:
                self.scan(subreddit)
            except Exception:  # noqa: BLE001
                log.exception("Error during scan")
            time.sleep(config.CHECK_INTERVAL)
