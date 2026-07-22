# Collab Editor

A real-time collaborative code editor supporting concurrent multi-user editing with conflict-free document convergence via CRDTs.

## Architecture

```
Browser A                        Browser B
   |                                |
   | WebSocket                      | WebSocket
   |                                |
   +----------> Go Server <---------+
                   |
          +--------+--------+
          |                 |
        Redis            Postgres
     (pub/sub,          (document
      presence)          snapshots)
```

**Key design decisions:**

- **CRDTs (Logoot)** over Operational Transformation - no central sequencer, server is a stateless relay, horizontally scalable
- **Go goroutines** for WebSocket fan-out - one goroutine per connection direction, channel-based hub owns the room map exclusively (no mutexes)
- **Mixed consistency models** - strong eventual consistency for document content, last-write-wins for cursor presence
- **Snapshot + WAL pattern** - document state checkpointed to Postgres every 30s, O(1) restart recovery
- **JWT auth** - stateless, no session table, tokens validated by re-signing

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Go, Gin, gorilla/websocket |
| Frontend | React, TypeScript, Vite, Monaco Editor |
| Conflict resolution | Logoot CRDT (custom implementation) |
| Auth | JWT (HMAC-SHA256), bcrypt |
| State store | Redis |
| Database | PostgreSQL |
| Infra | Docker, Docker Compose, nginx |

## Run locally (one command)

```bash
docker compose up --build
```

Open `http://localhost?room=your-room-name` in two browser tabs, register two accounts, and start typing.

## Run in development

**Backend:**
```bash
cd backend
go run main.go
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000?room=test`

## Project structure

```
collab-editor/
  backend/
    main.go                        - server entry point, routes
    internal/
      auth/                        - JWT generation, validation, HTTP handlers
      crdt/                        - Logoot CRDT: position, document, operations
      room/                        - room state (wraps CRDT document)
      store/                       - Postgres adapter: snapshots, users
      ws/                          - WebSocket hub, client pumps, snapshot worker
  frontend/
    src/
      components/
        Editor.tsx                 - Monaco wrapper, suppress flag, change->op
        Login.tsx                  - register/login form
      hooks/
        useDocument.ts             - client-side CRDT, op generation, message handling
        useWebSocket.ts            - WebSocket lifecycle management
      App.tsx                      - session state, wires hooks together
  docker-compose.yml
  README.md
```

## How it works

1. User opens a room - server loads the latest Postgres snapshot into a CRDT document
2. Server sends a snapshot to the joining client
3. User types - client generates a CRDT operation (insert/delete with a Logoot position)
4. Op is applied locally first (optimistic), then sent to the server
5. Server applies the op to its own document replica and broadcasts to all other clients
6. Other clients apply the op - CRDT commutativity guarantees all replicas converge
7. Every 30 seconds the server snapshots all active rooms to Postgres

## CRDT convergence guarantee

```
apply(apply(doc, opA), opB) == apply(apply(doc, opB), opA)
```

Operation order does not matter. Two clients with the same set of operations always produce identical documents, regardless of network delays or ordering.
