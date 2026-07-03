"""Fetch.ai uAgent bridge for ClassroomSim.

This agent bridges ASI:One / Agentverse chat queries to the ClassroomSim
Next.js backend (POST /api/agent). Using the standard Chat Protocol, a user
sends a lesson written in Markdown; the agent forwards it to the ClassroomSim
Mastra backend and returns the full generated pedagogical dossier.

Flow:
    ASI:One / Agentverse  --ChatMessage-->  this agent
    this agent            --POST /api/agent-->  ClassroomSim (Next.js/Mastra)
    ClassroomSim          --dossier_markdown-->  this agent
    this agent            --ChatMessage-->  ASI:One / Agentverse

Run with `python bridge.py`. The agent uses a mailbox and publishes its
details, so it auto-registers with Agentverse and becomes discoverable by
ASI:One.
"""

from datetime import datetime, timezone
from uuid import uuid4
import os
import httpx

from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatMessage,
    ChatAcknowledgement,
    TextContent,
    EndSessionContent,
    chat_protocol_spec,
)

# --- Configuration (from environment) ---------------------------------------

AGENT_SEED = os.getenv("AGENT_SEED")
if not AGENT_SEED:
    raise RuntimeError(
        "AGENT_SEED is required. Set it to a long, secret, random phrase "
        "(it deterministically derives the agent's identity/address)."
    )

AGENT_PORT = int(os.getenv("AGENT_PORT", "8001"))
MASTRA_APP_URL = os.getenv("MASTRA_APP_URL", "http://localhost:3000")
AGENT_NAME = os.getenv("AGENT_NAME", "koro-classroomsim")

# --- Agent + Chat protocol setup --------------------------------------------

agent = Agent(
    name=AGENT_NAME,
    seed=AGENT_SEED,
    port=AGENT_PORT,
    mailbox=True,
    publish_agent_details=True,
)

chat = Protocol(spec=chat_protocol_spec)


@chat.on_message(ChatMessage)
async def handle_chat_message(ctx: Context, sender: str, msg: ChatMessage):
    # Always acknowledge receipt first.
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.now(timezone.utc),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    # Concatenate all text parts of the incoming message.
    text = "".join(
        item.text for item in msg.content if isinstance(item, TextContent)
    )

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(
                f"{MASTRA_APP_URL}/api/agent",
                json={"markdown": text},
            )
            r.raise_for_status()
            data = r.json()
        answer = data.get("dossier_markdown") or data.get("error") or "(réponse vide)"
    except Exception as e:
        ctx.logger.exception("Failed to generate dossier via ClassroomSim backend")
        answer = f"⚠️ error: {e}"

    # Reply with the dossier and end the session.
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
    # We don't need to act on acknowledgements from the peer.
    pass


agent.include(chat, publish_manifest=True)


if __name__ == "__main__":
    agent.run()
