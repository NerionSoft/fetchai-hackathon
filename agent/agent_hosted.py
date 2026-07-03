"""Agentverse HOSTED Agent version — paste this into the Build tab (agent.py).

Differences vs bridge.py (the self-hosted version):
  - Do NOT create `Agent(...)`: the hosted platform pre-provides the global
    `agent` object (identity/seed/mailbox are managed for you).
  - No `agent.run()` at the bottom — the platform runs it.
  - Set MASTRA_APP_URL in the hosted agent's Secrets/.env tab (the public URL
    of your deployed Next.js backend, e.g. https://<your-app>.vercel.app).

httpx + uagents + uagents_core are all allowed in hosted agents, and outbound
HTTP to external URLs works, so this runs as-is on Agentverse.
"""

from datetime import datetime, timezone
from uuid import uuid4
import os

import httpx
from uagents import Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatMessage,
    ChatAcknowledgement,
    TextContent,
    EndSessionContent,
    chat_protocol_spec,
)

# Public URL of the deployed ClassroomSim Next.js backend (set in Secrets/.env).
# rstrip("/") so a trailing slash doesn't produce a `//api/agent` 308 redirect.
MASTRA_APP_URL = os.getenv("MASTRA_APP_URL", "http://localhost:3000").rstrip("/")

chat = Protocol(spec=chat_protocol_spec)


@chat.on_message(ChatMessage)
async def handle_chat_message(ctx: Context, sender: str, msg: ChatMessage):
    # Acknowledge receipt first.
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.now(timezone.utc),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    # Concatenate the user's text parts (the lesson, in Markdown).
    text = "".join(item.text for item in msg.content if isinstance(item, TextContent))

    try:
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            r = await client.post(f"{MASTRA_APP_URL}/api/agent", json={"markdown": text})
            r.raise_for_status()
            data = r.json()
        answer = data.get("dossier_markdown") or data.get("error") or "(empty response)"
    except Exception as e:
        ctx.logger.exception("ClassroomSim backend call failed")
        answer = f"⚠️ error: {e}"

    await ctx.send(
        sender,
        ChatMessage(
            timestamp=datetime.now(timezone.utc),
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=answer),
                EndSessionContent(type="end-session"),
            ],
        ),
    )


@chat.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


# `agent` is the platform-provided global on hosted agents — just attach the protocol.
agent.include(chat, publish_manifest=True)
