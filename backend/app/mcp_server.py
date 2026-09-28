"""
Model Context Protocol (MCP) Stdio Server for Jardín Garden OS.
Allows external LLM agents (Claude Desktop, Nous Hermes CLI, etc.) to inspect and control the garden.
"""

import sys
import json
from sqlmodel import Session
from app.database import engine
from app.services.agent import HERMES_TOOLS, execute_agent_tool


def main():
    with Session(engine) as session:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            try:
                request = json.loads(line)
            except Exception:
                continue

            req_id = request.get("id")
            method = request.get("method")
            params = request.get("params", {})

            if method == "tools/list":
                tools_mcp = [
                    {
                        "name": t["function"]["name"],
                        "description": t["function"]["description"],
                        "inputSchema": t["function"]["parameters"],
                    }
                    for t in HERMES_TOOLS
                ]
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"tools": tools_mcp},
                }
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()

            elif method == "tools/call":
                tool_name = params.get("name")
                tool_args = params.get("arguments", {})
                result = execute_agent_tool(tool_name, tool_args, session)
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(result, indent=2)}]
                    },
                }
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()

            elif method == "initialize":
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "jardin-mcp", "version": "0.1.0"},
                    },
                }
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()


if __name__ == "__main__":
    main()
