from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_session
from app.services.agent import run_agent_turn

router = APIRouter(prefix="/chat", tags=["Agent Chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class ChatResponse(BaseModel):
    message: Dict[str, Any]


@router.post("", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest, session: Session = Depends(get_session)):
    """Talk directly to Hermes or the garden agent with tool execution capabilities."""
    raw_messages = [{"role": m.role, "content": m.content} for m in request.messages]
    agent_msg = await run_agent_turn(raw_messages, session)
    return ChatResponse(message=agent_msg)
