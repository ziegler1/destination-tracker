# Memory Vault Setup (Local Dev)

This project uses [Memory Vault](https://github.com/mihaibuilds/memory-vault) — a self-hosted Postgres + pgvector memory layer — for Claude Code's persistent memory across sessions. It runs locally via Docker and is NOT part of this repo's deployed stack.

## Prerequisites
- Docker (Rancher Desktop or equivalent)
- Python 3.11+

## Setup
1. Clone Memory Vault somewhere outside this repo, e.g. `C:/Users/<you>/memory-vault`:
```bash
   git clone https://github.com/mihaibuilds/memory-vault.git
   cd memory-vault
   docker compose up -d
```
2. Verify it's running:
```bash
   docker compose exec app memory-vault status
```
3. Install Python MCP dependencies:
```bash
   pip install -e ".[mcp]"
```
4. **Windows only** — apply the event loop fix in `src/mcp/__main__.py`:
```python
   import asyncio
   import sys

   if sys.platform == "win32":
       asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

   from src.mcp.server import main
   main()
```

## Wiring to This Project
Create a `.mcp.json` file in this project's root (gitignored — not committed) with:
```json
{
  "mcpServers": {
    "memory-vault": {
      "command": "python",
      "args": ["-m", "src.mcp"],
      "cwd": "<path-to-memory-vault>",
      "env": {
        "PYTHONPATH": "<path-to-memory-vault>",
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "memory_vault",
        "DB_USER": "memory_vault",
        "DB_PASSWORD": "memory_vault"
      }
    }
  }
}
```
Replace `<path-to-memory-vault>` with the actual local path on your machine.

Reload the VS Code window, then verify via `/mcp` in Claude Code — `memory-vault` should show **Connected**.

## Memory Space
This project's memories are stored under the `waypoint` space in Memory Vault. See `CLAUDE.md` for the memory-routing instructions Claude Code follows automatically.