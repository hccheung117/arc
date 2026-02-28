import { withApp } from '@cli/bootstrap.js'
import { resolve, appendJsonl, readJsonl } from '@main/arcfs.js'
import { createSession } from '@main/services/session.js'
import { generateId } from 'ai'
import path from 'node:path'

const sessions = [
  {
    title: 'API Design Review',
    messages: [
      { role: 'user', text: 'Can you review this REST API design for our user service?\n\n```\nGET    /users\nPOST   /users\nGET    /users/:id\nPATCH  /users/:id\nDELETE /users/:id\n```\n\nI\'m unsure about pagination and filtering.' },
      { role: 'assistant', text: '## API Review\n\nThe base CRUD looks solid. A few suggestions:\n\n### Pagination\n\nUse cursor-based pagination for large datasets:\n\n```\nGET /users?cursor=abc123&limit=25\n```\n\nAvoid offset-based — it breaks under concurrent writes.\n\n### Filtering\n\nSupport query params with a consistent pattern:\n\n```\nGET /users?status=active&role=admin&sort=-createdAt\n```\n\n### Versioning\n\nConsider a header-based approach:\n\n```\nAccept: application/vnd.myapp.v1+json\n```\n\nThis keeps URLs clean while allowing breaking changes.' },
      { role: 'user', text: 'Good points. What about error responses? We\'ve been inconsistent.' },
      { role: 'assistant', text: 'Standardize on [RFC 7807](https://tools.ietf.org/html/rfc7807) problem details:\n\n```json\n{\n  "type": "https://api.example.com/errors/validation",\n  "title": "Validation Error",\n  "status": 422,\n  "detail": "Email format is invalid",\n  "errors": [\n    { "field": "email", "message": "Must be a valid email address" }\n  ]\n}\n```\n\nKey rules:\n- Always return `type`, `title`, `status`\n- Use `detail` for human-readable specifics\n- Add domain-specific fields (like `errors`) as needed\n- **Never** expose stack traces in production' },
    ],
  },
  {
    title: 'Bug Triage: Memory Leak',
    messages: [
      { role: 'user', text: 'We\'re seeing memory usage climb steadily in production. The Node.js process starts at ~200MB and hits 1.5GB after 24h. Here\'s the heap snapshot diff:\n\n| Constructor | Count | Size |\n|---|---|---|\n| `(string)` | +45,000 | +12MB |\n| `Object` | +23,000 | +8MB |\n| `Array` | +12,000 | +4MB |\n| `EventEmitter` | +3,200 | +2MB |' },
      { role: 'assistant', text: 'The `EventEmitter` growth is the smoking gun — **3,200 new emitters** suggests listeners aren\'t being cleaned up.\n\nCommon causes:\n\n1. **Missing `removeListener`** on WebSocket/SSE connections\n2. **Re-registering listeners** on each request without cleanup\n3. **Closures holding references** to request/response objects\n\nDebug steps:\n\n```bash\n# Enable leak detection\nnode --max-old-space-size=2048 --expose-gc app.js\n```\n\n```js\n// Add to startup\nprocess.on(\'warning\', (w) => {\n  if (w.name === \'MaxListenersExceededWarning\') {\n    console.log(w.stack)\n  }\n})\n```\n\nCan you share the WebSocket or event subscription code?' },
    ],
  },
  {
    title: 'Documentation Draft: Auth Flow',
    messages: [
      { role: 'user', text: 'I need to write developer docs for our OAuth2 + PKCE auth flow. Can you draft the overview section?' },
      { role: 'assistant', text: '# Authentication\n\nArc uses **OAuth 2.0 with PKCE** (Proof Key for Code Exchange) for secure authentication without client secrets.\n\n## Flow Overview\n\n1. Client generates a random `code_verifier` and derives `code_challenge`\n2. Client redirects to `/authorize` with the challenge\n3. User authenticates and grants consent\n4. Server returns an authorization `code`\n5. Client exchanges `code` + `code_verifier` for tokens\n\n## Quick Start\n\n```js\nimport { createAuth } from \'@arc/auth\'\n\nconst auth = createAuth({\n  clientId: \'your-client-id\',\n  redirectUri: \'http://localhost:3000/callback\',\n})\n\n// Step 1: Redirect to login\nconst loginUrl = await auth.getLoginUrl()\nwindow.location.href = loginUrl\n\n// Step 2: Handle callback\nconst tokens = await auth.handleCallback(window.location.search)\n```\n\n> **Note:** Access tokens expire after 1 hour. Use `auth.refresh()` to obtain new tokens silently.' },
      { role: 'user', text: 'Nice. Add a section on token storage best practices.' },
      { role: 'assistant', text: '## Token Storage\n\n### Recommended: HTTP-Only Cookies\n\nStore tokens in **HTTP-only, Secure, SameSite=Strict** cookies:\n\n- Not accessible to JavaScript (XSS-safe)\n- Automatically sent with requests\n- Server controls expiry\n\n### Acceptable: In-Memory\n\nKeep tokens in a closure or module-scoped variable:\n\n```js\nlet accessToken = null\n\nexport const getToken = () => accessToken\nexport const setToken = (token) => { accessToken = token }\n```\n\n**Trade-off:** lost on page refresh (user re-authenticates).\n\n### Avoid\n\n- `localStorage` — accessible to any script on the domain\n- `sessionStorage` — same XSS risk, plus lost across tabs\n- URL parameters — visible in logs, history, referrer headers\n\n> **Desktop apps (Electron):** Use the OS keychain via `safeStorage.encryptString()`. Never store tokens in plain-text config files.' },
    ],
  },
  {
    title: 'SQL Query Optimization',
    messages: [
      { role: 'user', text: 'This query takes 12 seconds on 2M rows:\n\n```sql\nSELECT u.name, COUNT(o.id) as order_count, SUM(o.total) as revenue\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nWHERE u.created_at > \'2024-01-01\'\n  AND o.status = \'completed\'\nGROUP BY u.id\nORDER BY revenue DESC\nLIMIT 50;\n```\n\nExplain plan shows a sequential scan on `orders`.' },
      { role: 'assistant', text: 'Several issues:\n\n### 1. Missing composite index\n\n```sql\nCREATE INDEX idx_orders_user_status\n  ON orders (user_id, status)\n  INCLUDE (total);\n```\n\nThis covers the join, filter, and aggregation without hitting the table.\n\n### 2. LEFT JOIN + WHERE contradiction\n\n`WHERE o.status = \'completed\'` turns the `LEFT JOIN` into an `INNER JOIN` — rows where `o` is NULL are filtered out. Use `INNER JOIN` explicitly so the planner knows.\n\n### 3. Rewritten query\n\n```sql\nSELECT u.name, o.order_count, o.revenue\nFROM users u\nINNER JOIN (\n  SELECT user_id, COUNT(*) as order_count, SUM(total) as revenue\n  FROM orders\n  WHERE status = \'completed\'\n  GROUP BY user_id\n) o ON o.user_id = u.id\nWHERE u.created_at > \'2024-01-01\'\nORDER BY o.revenue DESC\nLIMIT 50;\n```\n\n**Why faster:** aggregates orders *before* joining, reducing the join cardinality from 2M to ~number-of-users.' },
      { role: 'user', text: 'The rewrite brought it to 400ms. Can we get sub-100ms?' },
      { role: 'assistant', text: 'For sub-100ms on this scale, consider a **materialized view**:\n\n```sql\nCREATE MATERIALIZED VIEW user_revenue AS\nSELECT\n  user_id,\n  COUNT(*) as order_count,\n  SUM(total) as revenue\nFROM orders\nWHERE status = \'completed\'\nGROUP BY user_id;\n\nCREATE UNIQUE INDEX ON user_revenue (user_id);\n```\n\nRefresh strategy:\n\n```sql\n-- After batch imports or on a schedule\nREFRESH MATERIALIZED VIEW CONCURRENTLY user_revenue;\n```\n\nThe final query becomes a simple indexed join:\n\n```sql\nSELECT u.name, r.order_count, r.revenue\nFROM users u\nJOIN user_revenue r ON r.user_id = u.id\nWHERE u.created_at > \'2024-01-01\'\nORDER BY r.revenue DESC\nLIMIT 50;\n```\n\nThis should be **5-20ms** depending on index warmth.' },
    ],
  },
  {
    title: 'Deployment Runbook: v2.4',
    messages: [
      { role: 'user', text: 'Help me write a deployment runbook for our v2.4 release. It includes a database migration (adding a `preferences` JSONB column) and a new background worker.' },
      { role: 'assistant', text: '# Deployment Runbook — v2.4\n\n## Pre-deployment Checklist\n\n- [ ] All CI checks passing on `release/2.4`\n- [ ] Database backup completed (RDS snapshot)\n- [ ] Migration tested on staging\n- [ ] Rollback plan reviewed\n- [ ] On-call engineer notified\n\n## Steps\n\n### 1. Database Migration (10 min)\n\n```bash\n# SSH to bastion\nssh bastion.prod.internal\n\n# Run migration\nDATABASE_URL=$PROD_DB_URL npx prisma migrate deploy\n```\n\n**Verify:**\n```sql\nSELECT column_name, data_type\nFROM information_schema.columns\nWHERE table_name = \'users\' AND column_name = \'preferences\';\n```\n\n### 2. Deploy API (5 min)\n\n```bash\nkubectl set image deployment/api api=registry.example.com/api:v2.4.0\nkubectl rollout status deployment/api --timeout=120s\n```\n\n### 3. Deploy Worker (5 min)\n\n```bash\nkubectl apply -f k8s/worker-v2.4.yaml\nkubectl rollout status deployment/preferences-worker --timeout=60s\n```\n\n### 4. Smoke Tests\n\n```bash\ncurl -s https://api.example.com/health | jq .version\n# Expected: "2.4.0"\n```\n\n## Rollback\n\n```bash\n# Revert API\nkubectl rollout undo deployment/api\n\n# Revert migration (only if no data written)\nDATABASE_URL=$PROD_DB_URL npx prisma migrate resolve --rolled-back 20240301_add_preferences\n```\n\n> **Warning:** If users have written preferences data, coordinate with the team before rolling back the migration.' },
    ],
  },
  {
    title: 'Code Review: Rate Limiter',
    messages: [
      { role: 'user', text: 'Review this rate limiter implementation:\n\n```js\nconst rateLimiter = (windowMs, maxRequests) => {\n  const hits = new Map()\n\n  setInterval(() => hits.clear(), windowMs)\n\n  return (req, res, next) => {\n    const key = req.ip\n    const count = (hits.get(key) || 0) + 1\n    hits.set(key, count)\n\n    if (count > maxRequests) {\n      return res.status(429).json({ error: \'Too many requests\' })\n    }\n    next()\n  }\n}\n```' },
      { role: 'assistant', text: 'Several issues:\n\n**1. Fixed-window race condition**\n\nThe `setInterval` clears *all* counts simultaneously. A burst at the window boundary gets `2x maxRequests`. Use sliding window instead.\n\n**2. Memory leak**\n\nOld keys are only cleared on interval. Under attack, the Map grows unbounded between clears.\n\n**3. No cleanup on shutdown**\n\nThe `setInterval` keeps the process alive — it prevents graceful shutdown.\n\n**4. IP spoofing**\n\n`req.ip` trusts `X-Forwarded-For` by default in Express. Set `app.set(\'trust proxy\', 1)` or use a verified header.\n\n**Improved version:**\n\n```js\nconst rateLimiter = (windowMs, maxRequests) => {\n  const hits = new Map()\n\n  const getEntry = (key) => {\n    const now = Date.now()\n    const entry = hits.get(key)\n    if (!entry || now - entry.start > windowMs) {\n      const fresh = { start: now, count: 0 }\n      hits.set(key, fresh)\n      return fresh\n    }\n    return entry\n  }\n\n  return (req, res, next) => {\n    const entry = getEntry(req.ip)\n    entry.count++\n\n    res.set(\'X-RateLimit-Limit\', maxRequests)\n    res.set(\'X-RateLimit-Remaining\', Math.max(0, maxRequests - entry.count))\n\n    if (entry.count > maxRequests) {\n      res.set(\'Retry-After\', Math.ceil((entry.start + windowMs - Date.now()) / 1000))\n      return res.status(429).json({ error: \'Too many requests\' })\n    }\n    next()\n  }\n}\n```\n\nFor production, use Redis-backed sliding window (`ioredis` + Lua script).' },
    ],
  },
  {
    title: 'Architecture: Event Sourcing',
    messages: [
      { role: 'user', text: 'We\'re considering event sourcing for our order management system. What are the trade-offs vs. our current CRUD approach?' },
      { role: 'assistant', text: '## Event Sourcing Trade-offs\n\n### Benefits\n\n- **Complete audit trail** — every state change is an immutable event\n- **Temporal queries** — reconstruct state at any point in time\n- **Decoupled consumers** — services react to events independently\n- **Natural fit for workflows** — order lifecycle maps cleanly to events:\n  - `OrderPlaced` → `PaymentProcessed` → `ItemsReserved` → `OrderShipped`\n\n### Costs\n\n- **Eventual consistency** — projections lag behind events\n- **Complexity** — CQRS pattern usually required (separate read/write models)\n- **Event versioning** — schema changes require upcasting strategies\n- **Learning curve** — team needs to think in events, not state\n\n### When it\'s worth it\n\n> If you need an **audit trail** + **complex workflows** + **multiple consumers**, event sourcing pays for itself.\n\n> If you\'re just doing CRUD with a history table, you\'re adding complexity for little gain.\n\n### Pragmatic middle ground\n\nStart with **event-driven architecture** (publish events from CRUD operations) without full sourcing. You get decoupling and audit without the read-model complexity. Migrate to full sourcing for specific aggregates if needed.' },
      { role: 'user', text: 'Good analysis. Let\'s go with the pragmatic approach. How should we structure the events?' },
      { role: 'assistant', text: '## Event Structure\n\n```js\nconst event = {\n  id: \'evt_abc123\',            // unique event ID\n  type: \'order.placed\',         // dot-notation namespace\n  aggregateId: \'ord_xyz789\',    // the entity this event belongs to\n  version: 1,                   // optimistic concurrency\n  timestamp: \'2024-03-01T10:30:00Z\',\n  data: {                       // event-specific payload\n    items: [{ sku: \'WIDGET-1\', qty: 2, price: 29.99 }],\n    total: 59.98,\n    currency: \'USD\',\n  },\n  metadata: {                   // cross-cutting concerns\n    userId: \'usr_abc\',\n    correlationId: \'req_def\',\n    source: \'checkout-service\',\n  },\n}\n```\n\n### Event Types\n\nUse past tense — events describe *what happened*:\n\n| Event | Trigger |\n|---|---|\n| `order.placed` | Customer submits order |\n| `order.payment_processed` | Payment gateway confirms |\n| `order.items_reserved` | Inventory service confirms |\n| `order.shipped` | Warehouse marks shipped |\n| `order.delivered` | Carrier confirms delivery |\n| `order.cancelled` | Customer or system cancels |\n| `order.refunded` | Refund processed |\n\n### Publishing\n\n```js\nconst placeOrder = async (orderData) => {\n  const order = await db.orders.create(orderData)\n  await eventBus.publish({\n    type: \'order.placed\',\n    aggregateId: order.id,\n    data: orderData,\n  })\n  return order\n}\n```\n\nKeep the DB write and event publish in the same transaction (outbox pattern) to avoid inconsistency.' },
    ],
  },
  {
    title: 'Performance: React Render Profiling',
    messages: [
      { role: 'user', text: 'Our React app stutters when scrolling a long list (~5000 items). React DevTools shows excessive re-renders in `<ListItem>`. Here\'s the component:\n\n```jsx\nconst ListItem = ({ item, onSelect, selectedId }) => (\n  <div\n    className={`item ${item.id === selectedId ? \'selected\' : \'\'}`}\n    onClick={() => onSelect(item.id)}\n  >\n    <span>{item.name}</span>\n    <span>{item.date}</span>\n  </div>\n)\n```' },
      { role: 'assistant', text: 'Two problems:\n\n### 1. Every item re-renders on selection change\n\n`selectedId` is passed to *all* items, so when it changes, every `<ListItem>` re-renders even though only two items actually changed (old selected → new selected).\n\n**Fix:** derive the boolean in the parent and memoize:\n\n```jsx\nconst ListItem = memo(({ item, isSelected, onSelect }) => (\n  <div\n    className={`item ${isSelected ? \'selected\' : \'\'}`}\n    onClick={() => onSelect(item.id)}\n  >\n    <span>{item.name}</span>\n    <span>{item.date}</span>\n  </div>\n))\n```\n\nIn the parent:\n```jsx\n{items.map(item => (\n  <ListItem\n    key={item.id}\n    item={item}\n    isSelected={item.id === selectedId}\n    onSelect={handleSelect}\n  />\n))}\n```\n\n### 2. No virtualization\n\nRendering 5000 DOM nodes is expensive regardless of React. Use windowing:\n\n```jsx\nimport { useVirtualizer } from \'@tanstack/react-virtual\'\n\nconst rowVirtualizer = useVirtualizer({\n  count: items.length,\n  getScrollElement: () => parentRef.current,\n  estimateSize: () => 48,\n})\n```\n\nThis renders only ~20-30 visible items instead of 5000. Combined with `memo`, scroll jank disappears.' },
    ],
  },
  {
    title: 'Onboarding: Dev Environment Setup',
    messages: [
      { role: 'user', text: 'New engineer starting Monday. Draft the dev environment setup guide.' },
      { role: 'assistant', text: '# Dev Environment Setup\n\n## Prerequisites\n\n- **Node.js 20+** — use [fnm](https://github.com/Schniz/fnm) or nvm\n- **Git** — configure SSH keys for GitHub\n- **Docker Desktop** — for local services\n\n## 1. Clone & Install\n\n```bash\ngit clone git@github.com:acme/platform.git\ncd platform\nfnm use          # picks up .node-version\nnpm install\n```\n\n## 2. Local Services\n\n```bash\ndocker compose up -d   # Postgres, Redis, MinIO\n```\n\nVerify:\n```bash\ndocker compose ps\n# All services should show \"running\"\n```\n\n## 3. Environment Config\n\n```bash\ncp .env.example .env.local\n```\n\nEdit `.env.local`:\n```\nDATABASE_URL=postgresql://dev:dev@localhost:5432/platform\nREDIS_URL=redis://localhost:6379\nS3_ENDPOINT=http://localhost:9000\n```\n\n## 4. Database Setup\n\n```bash\nnpm run db:migrate\nnpm run db:seed\n```\n\n## 5. Run\n\n```bash\nnpm run dev     # http://localhost:3000\n```\n\n## 6. Verify\n\n- [ ] App loads at `localhost:3000`\n- [ ] Can log in with `dev@example.com` / `password`\n- [ ] API health check: `curl localhost:3000/api/health`\n\n## Common Issues\n\n| Problem | Fix |\n|---|---|\n| Port 5432 in use | `lsof -i :5432` then kill or change port |\n| npm install fails on native modules | `xcode-select --install` (macOS) |\n| Docker out of disk | `docker system prune -a` |' },
    ],
  },
  {
    title: 'Incident Postmortem: Cache Stampede',
    messages: [
      { role: 'user', text: 'We had a 15-minute outage yesterday when our Redis cache expired during peak traffic. The database got hammered with ~50k concurrent queries. Can you help write the postmortem?' },
      { role: 'assistant', text: '# Incident Postmortem: Cache Stampede\n\n**Date:** 2024-02-27  \n**Duration:** 15 minutes (14:32 – 14:47 UTC)  \n**Severity:** P1 — full service degradation  \n**Author:** [Your name]\n\n## Summary\n\nA cache stampede occurred when a hot cache key (`product-catalog`) expired during peak traffic. ~50,000 concurrent requests bypassed the cache and hit the database simultaneously, causing connection pool exhaustion and cascading failures.\n\n## Timeline\n\n| Time (UTC) | Event |\n|---|---|\n| 14:32 | `product-catalog` cache key expires (TTL: 1h) |\n| 14:32 | Database connections spike from 50 → 500 (pool max) |\n| 14:33 | API latency p99 jumps from 200ms → 12s |\n| 14:35 | PagerDuty alert fires |\n| 14:38 | On-call identifies cache miss storm |\n| 14:40 | Manual cache warm executed |\n| 14:42 | Database connections begin recovering |\n| 14:47 | Full recovery confirmed |\n\n## Root Cause\n\nThe cache key had a **fixed TTL** with no stampede protection. When it expired, every request saw a cache miss and independently queried the database.\n\n## Fix\n\nImplement **cache stampede protection** using a mutex pattern:\n\n```python\nasync def get_with_lock(key, fetch_fn, ttl=3600):\n    value = await redis.get(key)\n    if value:\n        return json.loads(value)\n\n    lock_key = f"lock:{key}"\n    if await redis.set(lock_key, "1", nx=True, ex=30):\n        # Winner: fetch and populate\n        value = await fetch_fn()\n        await redis.set(key, json.dumps(value), ex=ttl)\n        await redis.delete(lock_key)\n        return value\n    else:\n        # Loser: wait and retry\n        await asyncio.sleep(0.1)\n        return await get_with_lock(key, fetch_fn, ttl)\n```\n\n## Action Items\n\n- [ ] Implement mutex-based cache population\n- [ ] Add jitter to TTLs: `ttl + random(0, 300)`\n- [ ] Set up alerts on cache miss rate > 10%\n- [ ] Add circuit breaker between API and database\n- [ ] Document cache architecture and failure modes' },
      { role: 'user', text: 'Should we also consider cache warming or stale-while-revalidate?' },
      { role: 'assistant', text: 'Both are excellent additions — they work at different layers:\n\n## Stale-While-Revalidate (Recommended)\n\nServe stale data while refreshing in the background:\n\n```python\nasync def get_swr(key, fetch_fn, ttl=3600, stale_ttl=7200):\n    value, remaining_ttl = await redis.get_with_ttl(key)\n\n    if value:\n        # Serve immediately\n        result = json.loads(value)\n        # If past soft TTL, trigger background refresh\n        if remaining_ttl < (stale_ttl - ttl):\n            asyncio.create_task(refresh(key, fetch_fn, stale_ttl))\n        return result\n\n    # Hard miss — must fetch synchronously\n    return await fetch_and_cache(key, fetch_fn, stale_ttl)\n```\n\n**Two TTLs:**\n- *Soft TTL* (1h): triggers background refresh\n- *Hard TTL* (2h): data actually expires\n\nUsers never wait for a fetch — they always get instant responses.\n\n## Cache Warming\n\nBest for **predictable hot keys** (product catalog, config):\n\n```bash\n# Cron job, 10 minutes before expected expiry\n*/50 * * * * curl -X POST https://api.internal/cache/warm?key=product-catalog\n```\n\n**Use when:** you know which keys are hot and their access patterns are predictable.\n\n> **My recommendation:** SWR for general use (self-healing, no operational overhead) + warming for your top 5 hottest keys as defense-in-depth.' },
    ],
  },
]

withApp(async () => {
  const dir = resolve('sessions')
  const results = []

  for (const { title, messages } of sessions) {
    const id = await createSession(dir, title)
    const filePath = path.join(dir, id, 'messages.jsonl')

    let lastId = null
    for (const { role, text } of messages) {
      const msgId = generateId()
      await appendJsonl(filePath, {
        id: msgId,
        role,
        parts: [{ type: 'text', text }],
        arcParentId: lastId,
      })
      lastId = msgId
    }

    results.push({ id, title })
  }

  // Add a branch to "Code Review: Rate Limiter" to exercise tree behavior
  const rateLimiter = results.find(r => r.title === 'Code Review: Rate Limiter')
  if (rateLimiter) {
    const filePath = path.join(dir, rateLimiter.id, 'messages.jsonl')
    const written = await readJsonl(filePath)
    await appendJsonl(filePath, {
      id: generateId(),
      role: 'assistant',
      parts: [{ type: 'text', text: 'I see a few issues but overall this is a reasonable approach for a simple use case. The main concern is the `setInterval` — it creates a fixed window that can be gamed. But for internal APIs with trusted clients, this is acceptable.\n\nIf you need production-grade limiting, look at `express-rate-limit` with a Redis store.' }],
      arcParentId: written[0].id,
    })
    console.log(`  ↳ Branch added to "${rateLimiter.title}"`)
  }

  console.log(`\nCreated ${results.length} sessions:\n`)
  for (const { id, title } of results) {
    console.log(`  ${id}  ${title}`)
  }
})
