# Agent Authentication
**Status:** Accepted
**Date:** 2026-03-18
**Source:** [Conversation 001](../conversations/001-initial-planning.md)

## Context

The system has a server exposed on a port with a WebSocket endpoint for agent registration. Without authentication, any process that can reach the server can register as an agent and receive session data. The assessment runs on localhost in Docker Compose — full user authentication (accounts, login, JWT) would be over-engineering, but the agent-server channel is the real trust boundary.

## Decision

Implement a shared secret for agent authentication:

- `AGENT_SECRET` environment variable in `.env`
- Agent sends the secret during `agent:register`
- Server validates the secret and rejects/closes unauthorized connections

Skip UI authentication entirely — single-user localhost deployment doesn't warrant it.

## Consequences

- The agent-server trust boundary is secured with minimal effort (~3 lines of logic)
- The .env file becomes security-sensitive (contains both LLM API key and agent secret)
- UI endpoints are unauthenticated — acceptable for localhost, would need addressing for any production deployment
- Baking this in now costs 5 minutes; retrofitting later would cost ~15 minutes and require threading the check through existing handlers
