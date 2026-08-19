# Alice Asmodeus Bot

A Reddit character bot that watches **r/DemonSchoolIrumakun** for mentions of
**Alice Asmodeus** (from *Welcome to Demon School! Iruma-kun*) and replies
in-character.

When someone mentions the character, the bot generates a context-aware,
in-character reply using an LLM (OpenAI-compatible). If the API key is missing
or the call fails, it falls back to random lines from
`personality/quotes.txt` and `personality/facts.txt`.

> Inspired by the [UraharaBot](https://github.com/eternalweary27/UraharaBot)
> project, rewritten for the current PRAW / OpenAI APIs.

---

## Does the Reddit API still work? (yes — here's the real story)

Reddit's 2023 changes didn't remove the free API; they restricted it:

| Tier | Rate limit | Cost |
|------|-----------|------|
| Free (OAuth, non-commercial) | 100 requests/min | $0 |
| Free (unauthenticated) | 10 requests/min | $0 |
| Commercial / high-volume | contract | ~$0.24 per 1,000 calls |

For a **personal/hobby character bot**, the free OAuth tier is plenty — this
bot is well under 100 requests/minute. You just need to register a **"script"**
app (free) and authenticate with OAuth. That's exactly what this project does
via PRAW.

---

## Setup

### 1. Create a Reddit app (get your credentials)

1. Log in to the **Reddit account the bot will post as** (use a dedicated
   account, not your personal one).
2. Go to **https://www.reddit.com/prefs/apps**.
3. Click **"create another app…"** (at the bottom).
4. Fill it in:
   - **name**: `AliceAsModeusBot`
   - **type**: select **`script`** ← important
   - **description**: short blurb (e.g. "Character roleplay bot for Alice Asmodeus")
   - **about url**: leave blank
   - **redirect uri**: `http://localhost:8080` (required, but unused for script apps)
5. Click **"create app"**.
6. Note down:
   - the string under the app name → **client ID**
   - the `secret` field → **client secret**

> If the app sits in an approval queue, that's normal for new apps — it
> usually clears quickly for personal/script use. Existing apps keep working.

### 2. Set up the environment

```bash
cd AliceAsModeus-Bot
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then edit .env with your values
```

Edit `.env`:

```
REDDIT_CLIENT_ID=<your client id>
REDDIT_CLIENT_SECRET=<your secret>
REDDIT_USERNAME=<bot account username>
REDDIT_PASSWORD=<bot account password>
REDDIT_USER_AGENT=AliceAsModeusBot/1.0 (by /u/<your username>)
OPENAI_API_KEY=<optional, for in-character LLM replies>
```

### 3. Run it

```bash
python main.py
```

The bot logs to the console and to `logs/bot.log`. It scans the most recent
submissions and their comments every 5 minutes (`CHECK_INTERVAL` in
`config.py`).

---

## How it works

`main.py` → `reddit_client.py` → `character_bot.py` → `response_generator.py`

1. **Fetch** the newest `NO_SUBMISSIONS` submissions (and all their comments)
   from the configured subreddits.
2. **Match** each post/comment against `KEY_WORDS` (character mentions) and
   `BOT_INVOKE_WORDS` (direct summons). Single-word keywords use whole-word
   matching to avoid false positives.
3. **Filter** — it skips its own comments, things it already replied to,
   blacklisted words, and quarantined users. It also continues conversations
   only when someone replies to it with a question.
4. **Generate** a reply via the LLM (with a randomized personality + response
   mode), falling back to quotes/facts on failure.
5. **Reply** and record the item ID in `data/replied_to.txt` so it never
   double-posts.

---

## Customizing

Everything lives in `config.py`:

| Setting | What it does |
|---------|-------------|
| `KEY_WORDS` | Names that trigger the bot (character mentions) |
| `BOT_INVOKE_WORDS` | Commands that summon it directly |
| `PRIMARY_TRAITS` / `SECONDARY_TRAITS` | Random personality flavor injected into prompts |
| `RESPONSE_MODES` | Weighted reply styles (chat / joke / fact) |
| `SUBREDDITS` | Which subreddits to watch |
| `NO_SUBMISSIONS`, `CHECK_INTERVAL` | Scan depth and frequency |
| `MAX_RESPONSE_CHARS` | Reply length cap |

Persona data:

- `personality/quotes.txt` — fallback + flavor lines (edit these!)
- `personality/facts.txt` — fallback + flavor facts (edit these!)
- `data/blacklist.txt` — one word/phrase per line; matching users get
  temporarily quarantined (see `QUARANTINE_TIME`).

> **False positives?** "alice" is a common name. If the bot fires on
> non-character mentions, narrow `KEY_WORDS` to `"alice asmodeus"` and
> `"asmodeus alice"`.

---

## Tips & troubleshooting

- **429 / rate limited**: Reddit's free tier is 100 req/min. If you scan huge
  threads, lower `NO_SUBMISSIONS` or raise `CHECK_INTERVAL`. PRAW
  auto-retries when it hits the limit.
- **Auth error**: confirm the app type is `script` and the client ID/secret
  are copied correctly.
- **No LLM replies**: the `OPENAI_API_KEY` is missing/invalid. The bot still
  works using quotes/facts.
- **New subreddit**: add its name to `SUBREDDITS` in `config.py`. Be aware
  many subreddits require bots to register with the mods first — check the
  subreddit rules.

---

## Legal / etiquette notes

- This is a **fan project**; *Alice Asmodeus* and *Welcome to Demon School!
  Iruma-kun* belong to their respective creators. The quotes in
  `personality/quotes.txt` are original in-character lines, not verbatim
  dialogue.
- Follow each subreddit's bot policy (many require bots to identify
  themselves — the `BOT_TAG` footer does this).
- Keep it **non-commercial** to stay within Reddit's free tier.
