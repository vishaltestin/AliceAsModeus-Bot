"""Generates in-character replies using an OpenAI-compatible chat API.

If no API key is configured the generator reports itself unavailable and the
bot falls back to random lines from personality/quotes.txt and
personality/facts.txt.
"""

import random

from openai import OpenAI


class AIResponseGenerator:
    def __init__(
        self,
        api_key,
        model,
        character_name,
        primary_traits,
        secondary_traits,
        response_modes,
        max_response_chars,
    ):
        self.available = bool(api_key)
        self.client = OpenAI(api_key=api_key) if api_key else None
        self.model = model
        self.character_name = character_name
        self.primary_traits = primary_traits
        self.secondary_traits = secondary_traits
        self.response_modes = response_modes
        self.max_response_chars = max_response_chars

    def _pick_response_mode(self):
        pool = []
        for name, instruction, weight in self.response_modes:
            pool += [(name, instruction)] * max(int(weight), 1)
        return random.choice(pool)

    def _build_messages(self, user_text, context):
        mode_name, mode_instruction = self._pick_response_mode()
        primary = random.choice(self.primary_traits)
        secondary = random.choice(self.secondary_traits)

        system = (
            f"You are {self.character_name}. Stay fully in character.\n"
            f"Personality: {primary}, with a {secondary} undertone.\n"
            f"Mode: {mode_instruction}\n"
            "Rules:\n"
            "- Reply in English, as the character.\n"
            f"- Keep every reply under {self.max_response_chars} characters.\n"
            "- Never break character or mention being an AI or a bot."
        )

        messages = [{"role": "system", "content": system}]
        if context:
            messages.extend(context)
        messages.append({"role": "user", "content": user_text})
        return messages

    def generate(self, user_text, context=None):
        """Return the reply text, or raise an exception on failure."""
        if not self.available:
            raise RuntimeError("OpenAI API key not configured")

        messages = self._build_messages(user_text, context)
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=300,
            temperature=0.9,
        )
        return completion.choices[0].message.content.strip()
