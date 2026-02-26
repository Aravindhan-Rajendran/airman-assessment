# CUTS.md – Features Intentionally Not Built

## List of Features Not Built

| Feature | Reason |
|---------|--------|
| **Redis in Docker Compose** | Requirement allows “in-memory with TTL”; in-memory cache keeps the stack minimal and one-command run simpler. Redis can be added for production. |
| **Live cloud deployment URL** | Assessment allows “documented proof” and “optional”; README and PLAN document env separation, secrets, and rollback. Actual deployment is optional. |
| **Offline-first quiz attempts** | Bonus item; not implemented to stay within 72h core scope. |
| **Telemetry ingestion stub (flight event logs)** | Bonus item; not implemented. |
| **Role-based feature flags** | Bonus item; not implemented. |
| **Email notification (real)** | Assessment says “Email notification stub (console logger acceptable)”; only console/audit stub implemented. |
| **Separate schema per tenant / separate DB per tenant** | Chose “shared DB + tenant_id” and documented; other options not implemented. |
| **BullMQ worker in Docker** | Escalation job runs in-process (setInterval) with retry; keeps Docker single-process. BullMQ can be added for scale. |

## Reasoning Summary

- **Mandatory** items (Auth, RBAC, Learning, Scheduling, Multi-tenant, Audit, Workflow, Pagination, Cache, Rate limit, CI, Docker) were implemented.
- **Optional / bonus** items were skipped to meet the 72h constraint and avoid scope creep.
- **Alternatives** (e.g. in-memory cache, in-process job) were chosen where the spec allowed them and they reduce setup complexity.
