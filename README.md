# Message Broker

A fully functional message broker built from scratch with NestJS and TypeScript. Built as a learning project to understand how tools like Kafka and RabbitMQ work under the hood.

Read the full breakdown: [Building a Message Broker from Scratch with NestJS](https://medium.com/@obajide028/building-a-message-broker-from-scratch-with-nestjs-69d9e5b106f4)

---

## What It Does

- **Pub/Sub (FANOUT)** — every subscriber gets a copy of each message
- **Work queue (ROUND_ROBIN)** — one consumer per message, rotating fairly across instances
- **Consumer groups** — horizontal scaling without duplicate processing
- **At-least-once delivery** — retry logic, acknowledgments, and failure tracking
- **Message TTL** — messages expire automatically if not consumed in time
- **Swappable persistence** — in-memory (development) or file-based (production) via the adapter pattern
- **REST management API** — inspect topics, consumers, and message stats
- **Background scheduler** — retries, eviction, dead consumer detection, and cleanup jobs

---

## Architecture

```
Clients
    |  WebSocket
BrokerGateway       ← transport layer, knows about sockets only
    |
BrokerService       ← facade, coordinates everything
  /   |   \   \
Topic Consumer Message Router
Services
         |
  IPersistenceAdapter
  /              \
Memory          File
Adapter         Adapter
                    ^
          BrokerScheduler (background jobs)
```

Each layer depends only on abstractions. The transport layer knows nothing about routing. The router knows nothing about sockets. Swapping any layer doesn't touch the others.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Environment

Create a `.env` file at the project root:

```bash
BROKER_PORT=3000
PERSISTENCE_ADAPTER=memory   # or 'file' for disk persistence
WS_CORS_ORIGIN=*
DEFAULT_TTL_MS=86400000
DEFAULT_MAX_RETRIES=3
NODE_ENV=development
```

### Run

```bash
# development
npm run start:dev

# production
npm run start:prod
```

The broker starts on port 3000. WebSocket gateway and REST API are both available on the same port.

---

## Connecting a Client

Clients connect over WebSocket using socket.io. Load the client from the broker:

```html
<script src="http://localhost:3000/socket.io/socket.io.js"></script>
```

### Subscribe to a topic

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  socket.emit('SUBSCRIBE', { topic: 'orders.created' });
});

socket.on('DELIVER', (message) => {
  console.log('Received:', message);
  socket.emit('ACKNOWLEDGE', { messageId: message.id });
});
```

### Publish a message

```javascript
socket.emit('PUBLISH', {
  topic: 'orders.created',
  payload: { orderId: 'ord_123', amount: 99.99 },
  ttl: 60000,       // optional: expire after 60 seconds
  maxRetries: 3     // optional: retry up to 3 times on failure
});
```

### Consumer groups

Pass a `groupId` on connect to join a consumer group. Consumers in the same group share messages — only one instance processes each message:

```javascript
const socket = io('http://localhost:3000', {
  query: { groupId: 'email-service' }
});
```

---

## REST Management API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Uptime, memory, and broker stats |
| GET | `/api/overview` | All topics with live message counts |
| GET | `/api/topics` | List all topics |
| POST | `/api/topics` | Create a topic manually |
| GET | `/api/topics/:name` | Topic detail with messages and consumers |
| DELETE | `/api/topics/:name` | Delete a topic |

### Create a topic

```bash
curl -X POST http://localhost:3000/api/topics \
  -H "Content-Type: application/json" \
  -d '{"name": "payments.processed", "deliveryMode": "ROUND_ROBIN"}'
```

---

## Docker

```bash
docker compose up --build
```

This starts the broker with file-based persistence and a health check on `/api/health`.

---

## Tests

```bash
# unit tests
npm run test

# watch mode
npm run test:watch

# coverage
npm run test:cov
```

---

## Tech Stack

- [NestJS](https://nestjs.com) — framework
- [Socket.io](https://socket.io) — WebSocket transport
- [class-validator](https://github.com/typestack/class-validator) — input validation
- [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling) — background jobs
- [Jest](https://jestjs.io) — testing

---

## License

MIT
