# DevSync

**Project Specification — CPSC 4390/5390**

DevSync consolidates a software team's project plan, GitHub activity, and Discord communication into a single project-health view.

## 1. Summary

DevSync is a project-health and coordination platform for small software teams. It combines a structured project plan with GitHub activity and selected Discord communication to surface progress, deadlines, blockers, integration status, and next steps in one dashboard.

Small software teams, specifically student teams, startups, and organizations without a dedicated project manager, often have to reconstruct project status from plans, repository activity, and team conversations spread across multiple tools. DevSync allows a team to define its features, milestones, deliverables, owners, and deadlines; synchronize commits and pull requests from an authorized GitHub repository; and import relevant messages from selected Discord channels. It organizes this information into a browser-based project-health dashboard showing milestone progress, upcoming deadlines, recent work, blockers, decisions, and suggested next steps. DevSync can also generate evidence-based progress summaries from stored project and activity data while clearly identifying stale or failed integrations so outdated information is not presented as current. Rather than replacing GitHub or Discord, DevSync reduces manual status reporting and helps teams recognize risks and coordination needs earlier.

## 2. Customer

DevSync's primary customers are small software-development teams that use GitHub and Discord but lack a dedicated project manager. This includes student project teams, early-stage startups, and small companies whose project plans, development activity, deadlines, blockers, and decisions are spread across multiple tools. One immediate example is CPSC 4390/5390, where many small student groups (including us) coordinate semester-long software projects through shared repositories and team communication channels, without necessarily having fully coordinated responsibilities, workflows, and means of success and productivity.

DevSync serves both contributors who need to understand recent changes and team leads who need to monitor progress, milestones, and risks. It reduces the time spent manually checking repositories, reading conversations, and asking teammates for status updates. A future secondary audience may include clients, instructors, or advisors who need a simplified milestone-level view without access to private repository data or internal team discussions.

Some of the problems our customers may face, and our solution to these include:

- **Project information is scattered across different tools.** The plan may be in a document, development work in GitHub, and important decisions in Discord. DevSync brings this information into one project dashboard.
- **It is difficult to tell whether the project is actually on schedule.** DevSync compares recent activity with the team's milestones, deliverables, and deadlines to show overall progress and project health.
- **Blockers and decisions can get buried in chat.** DevSync pulls relevant context from selected Discord channels and highlights important blockers, decisions, and action items.
- **Status updates take time to prepare.** Instead of manually reviewing commits, pull requests, and messages, teams can use DevSync's progress summary to see recent work and likely next steps.
- **Information can become outdated.** DevSync shows synchronization status and the last successful update so users know whether the dashboard reflects current GitHub and Discord activity.

> **Customer evidence still needed:** record several external conversations (role, date, current workflow, pain points, and requirements learned). Begin with the customer's existing problem/workflow before presenting DevSync.

## 3. Competitive Landscape

DevSync competes mainly with the combination of tools teams already use rather than a single direct replacement.

| Alternative | What it does today | DevSync difference |
|---|---|---|
| GitHub Projects | Tracks issues/PRs and repository work. | Adds project-plan + Discord context and cross-source status. |
| Jira / Linear | Tracks planned work, tickets, owners, and status. | Reduces manual status upkeep by deriving context from actual activity. |
| Discord / Slack | Preserves team discussion. | Adds blockers/decisions beside repository progress. |

## 4. User Requirements

### Project setup

- **UR-1:** Users shall be able to create and edit a project with a summary, features, milestones, deliverables, and deadlines.
- **UR-2:** Users should be able to upload an existing specification and review extracted project fields before saving.

### Integrations

- **UR-3:** Users shall be able to connect a GitHub repository and synchronize supported repository activity.
- **UR-4:** Users shall be able to connect at least one Discord channel and synchronize project-relevant messages.
- **UR-5:** The UI shall show each integration's latest successful sync and any failure/stale state.

### Dashboard and summaries

- **UR-6:** Users shall be able to view project-plan data alongside recent GitHub and Discord activity.
- **UR-7:** The dashboard shall show milestone status, upcoming deadlines, recent work, blockers, and next steps.
- **UR-8:** Users shall be able to generate a progress summary based on stored project and activity data.
- **UR-9:** Generated analysis shall not be presented as current when source integrations are stale or failed.

### Future users/features

- **UR-10:** A future stakeholder view may expose milestone-level progress without unnecessary technical/private detail.
- **UR-11:** A future transcript workflow may extract candidate requirements, decisions, and action items for user review.

## 5. Minimum Viable Product

- Create/edit a project with description, features, milestones, deliverables, and deadlines.
- Connect GitHub and import commit/pull-request activity.
- Connect at least one Discord channel and import relevant messages.
- Display a combined project-health dashboard.
- Generate a progress summary with recent progress, upcoming milestones, notable activity, blockers when supported, and next steps.
- Show integration/synchronization status so stale data is not mistaken for current data.

To keep the first prototype manageable, the MVP may focus on one active project and one GitHub repository per team.

After the main workflow and the MVP is stable, DevSync can be expanded in several ways:

- **Document-assisted onboarding:** Users could upload an existing proposal, requirements document, or README. DevSync would extract possible project fields and allow the user to review them before saving.
- **Multiple-project support:** Teams could manage several projects and use a portfolio page to compare health, deadlines, and blockers.
- **Improved activity mapping:** GitHub and Discord activity could be linked more accurately to specific features, milestones, and deliverables, with clearer evidence for generated conclusions.
- **Stakeholder views:** Clients, instructors, or advisors could receive a simplified view of milestone progress without access to private code or team discussions.
- **Meeting and transcript analysis:** DevSync could extract candidate decisions, requirements, and action items from meeting transcripts for user review.
- **Additional integrations:** Later versions could support tools such as Slack, Linear, Jira, or GitHub Projects.
- **Advanced project insights:** Future analysis could include repository-health metrics, workload trends, velocity, risk forecasting, and notifications for approaching deadlines or unresolved blockers.

## 6. Use Cases

### UC1 — Create/configure project `[must have]`

**Actor:** Team member. Create or edit the structured plan used by DevSync.

- **UC1-AC1:** When an authenticated user submits valid required project fields, DevSync shall persist the project and return the stored data.
- **UC1-AC2:** If a required field is invalid or missing, DevSync shall identify the field and shall not create a partial project.

### UC2 — Connect/sync GitHub `[must have]`

**Actors:** Team member, GitHub API.

- **UC2-AC1:** When an authorized user completes GitHub connection and selects a repository, DevSync shall associate that repository with the project.
- **UC2-AC2:** If GitHub is unavailable, rate-limited, or unauthorized, DevSync shall preserve prior data and mark the integration degraded/failed.

### UC3 — Connect/sync Discord `[must have]`

**Actors:** Team member, Discord API.

- **UC3-AC1:** When an authorized user connects a permitted channel, DevSync shall store the integration and synchronization metadata.
- **UC3-AC2:** If Discord synchronization fails, DevSync shall preserve prior data and display a recoverable integration error.

### UC4 — View project-health dashboard `[must have]`

**Actor:** Team member.

- **UC4-AC1:** When an authorized user opens the dashboard, DevSync shall return the project plan, latest stored activity, and integration status.
- **UC4-AC2:** While an integration is stale or failed, DevSync shall display that state rather than presenting its data as current.

### UC5 — Generate progress summary `[must have]`

**Actors:** Team member, LLM service.

- **UC5-AC1:** When a user requests a summary, DevSync shall generate and persist a summary from the current project plan and stored activity.
- **UC5-AC2:** If the LLM service fails or returns invalid output, DevSync shall keep the last successful summary and return a recoverable error.

### UC6 — Parse existing specification `[useful]`

- **UC6-AC1:** Where assisted onboarding is included, when a user uploads a supported specification, DevSync shall present extracted candidate fields for review before saving.

### UC7 — Stakeholder view `[optional]`

- **UC7-AC1:** Where stakeholder access is included, DevSync shall show only the project information authorized for that stakeholder.

### Use-case diagram

![Use-case diagram](https://www.plantuml.com/plantuml/svg/RLBBRi8m4BpxArRSeIfFgQeG22Ie119IsbxQ7eop8MuT6_cH2bNzzpe91hVDoPdCp7hMkpDZgRQk44HWPi4gqFoGMqYvHcQvaeGogpHq7f4MiCLYZxe3rC2JGHsuXU0eBTp0F2svKOqWiVG3SoNIgsx5xThjORvxg1KD3EII6wPqUc7FED2RpHOIr2LdMDCUaoeYbGU1iCGoEKa6NmJ06MJKe8-baLhqiHPAPlpWDC9EgtTlUfKlXJCMSbhYMzFEuZQsriMQV6tQ_Z_jEMsRU12Bdpb-mXgfi3aigSdtYhQxXh5hXH9rrKlYYeBgKvjX51jsLFiZEIBZ6MUq6gJtU3fp8XZ6lvguJWkgZ5wjZfMDNlGJyasggKEtEwtVAmBz60nYC8p1A0PZ4b_Q_9kGyuw4ic4hGkLg3KAjw_UO-8kWrwizS0VtzrmouLASJYDcy8UPeKpzvly0)

<details>
<summary>PlantUML source</summary>

```plantuml
@startuml
left to right direction
actor "Team Member" as User
actor "Client / Advisor" as Stakeholder
actor "GitHub API" as GitHub
actor "Discord API" as Discord
actor "LLM Service" as LLM
rectangle DevSync {
  usecase "Create / Configure Project\n[must have]" as UC1
  usecase "Sync GitHub\n[must have]" as UC2
  usecase "Sync Discord\n[must have]" as UC3
  usecase "View Health Dashboard\n[must have]" as UC4
  usecase "Generate Summary\n[must have]" as UC5
  usecase "Parse Specification\n[useful]" as UC6
  usecase "Stakeholder View\n[optional]" as UC7
}
User --> UC1
User --> UC2
User --> UC3
User --> UC4
User --> UC5
User --> UC6
Stakeholder --> UC7
GitHub --> UC2
Discord --> UC3
LLM --> UC5
LLM --> UC6
UC4 ..> UC2 : <<include>>
UC4 ..> UC3 : <<include>>
@enduml
```

</details>

## 7. Security Requirements

- Authenticate users for project/integration/private-data actions; authorize every read/write by project membership or role.
- Protect third-party tokens as secrets, never log plaintext credentials, request least-privilege scopes, and use HTTPS/TLS.
- Keep project plans, repository metadata, Discord content, and summaries confidential to authorized users.
- Minimize LLM data: send only required project context and exclude credentials/unrelated private data.
- Validate inputs; errors must not expose secrets; define deletion behavior for cached third-party data.

## 8. External Entities and Software Stack

**Stack:** TypeScript + React/Next.js frontend; Python + FastAPI backend; PostgreSQL; Docker; GitHub Actions. Hosting, authentication provider, and LLM provider remain to be finalized.

| Service | Operations / data | Failure behavior |
|---|---|---|
| GitHub API | Authorize repo; fetch commits/PRs/branches. Send token + repo/sync IDs; receive activity metadata. | Keep last good data; mark stale; retry/reconnect on auth failure. |
| Discord API | Authorize channel; fetch selected messages. Send token + channel/sync IDs; receive message text/metadata. | Keep last good data; show error; reconnect if access is revoked. |
| LLM API | Generate summaries; optionally parse specs/transcripts. Send required project/activity text; receive generated output. | Keep last good output; return error; allow retry/manual workflow. |

## 9. User Interface Requirements

- Browser-based interface with a clear project-setup flow and dashboard.
- Dashboard prioritizes status, milestones/deadlines, recent activity, blockers, next steps, and integration health.
- Connected repository/channel, last successful sync, loading/empty/error/stale states must be obvious.
- Generated summaries must be visually distinguished from source activity.
- Forms provide actionable validation; controls use semantic labels/keyboard support and status is not communicated by color alone.
- Frontend/backend data exchange uses documented JSON conforming to the OpenAPI contract.

## 10. Specification

### 10.1 Execution descriptions

- **UC1 — Create project:** Next.js sends validated plan data to FastAPI; the backend authenticates/authorizes, validates, writes project/plan records to PostgreSQL, and returns the stored project (UC1-AC1/2).
- **UC2 — GitHub sync:** the backend uses the stored integration to fetch supported activity, normalizes/upserts it, and records sync status; failures preserve prior data (UC2-AC1/2).
- **UC3 — Discord sync:** the backend fetches messages from the selected permitted channel, stores/derives required context, and records sync status; failures preserve prior data (UC3-AC1/2).
- **UC4 — Dashboard:** FastAPI reads the project plan, milestones, normalized activity, integration health, and latest summary from PostgreSQL and returns one dashboard response (UC4-AC1/2).
- **UC5 — Summary:** the backend reads current plan/activity, sends minimized context to the LLM, validates the result, stores successful output, and preserves the prior summary on provider failure (UC5-AC1/2).

### 10.2 Sequence diagram

![Sequence diagram](https://www.plantuml.com/plantuml/svg/PPB1KeD038RlF4N6ktBduDIMbZfJjRRw0EaIs-sKNTm4fzNntGq8jEW9XlzFykKF8nOCKXM728tu0AzC8IhrapMsH2TmzKX7kTdp5I33R3hKPiXojxnlD7r6EGfka0cMdcKRQFsygALqF2pBhCoh3NILsNmefvQD3tclfvEXlbWyz9g-HpKpNDygNG9F9Jd8aNSRZo6FPjDQK7C2sVG5uZBuFHdX-Clct_7PfuxQc8uJM17cK1xGnPg8_R1oYlda36XGGb4wXkkkure3exmLcWujHDhrNH6NtZ4D45Vq5eXtO9tGDg1OTLo2Bf_MBz2C3FHU4GjtUDayWHc9sQbIUhOw_mGTPR_3f3EP7Jf71oY86RV4brk-baeau7mey60_TOs-poLhHeuKaO2hei1m-iVv9z5VcntEQX8rLGYarpDUrpvAf-lz4dYmpXODH3kcspogJttEksMuQDsS03vq1VtrplM3QxHb_Ir6v7BzuNy0)

<details>
<summary>PlantUML source</summary>

```plantuml
@startuml
actor User
participant "Next.js" as FE
participant "FastAPI" as API
database PostgreSQL as DB
participant "GitHub API" as GH
participant "Discord API" as DC
participant "LLM API" as LLM
User -> FE: Open dashboard
FE -> API: GET /projects/{id}/dashboard
API -> DB: Read plan/activity/sync state
DB --> API: Stored state
API --> FE: DashboardResponse
User -> FE: Refresh integrations
FE -> API: POST sync requests
API -> GH: Fetch repository activity
API -> DC: Fetch channel messages
API -> DB: Upsert normalized activity
User -> FE: Generate summary
FE -> API: POST /projects/{id}/summaries
API -> DB: Read current context
API -> LLM: Minimized summary request
LLM --> API: Summary
API -> DB: Store validated summary
API --> FE: SummaryResponse
@enduml
```

</details>

### 10.3 Application architecture

![Application architecture diagram](https://www.plantuml.com/plantuml/svg/PL51ReCm4Bpx5IlkQUyzH6aAX5GafJ5zm08hIWfsP2zI-NrjDr2adZmxCzREs3lBQ7WSUc6_EdL3WmFKUhXfHOebJps1ePfHjJq9h5aRY4fofXCD5Pa8qCA79IEMIn2TwPiVhXOUuKBkIl2aoTgHekNduWYNH9RWGB2uS-qvAgRM87TQWPnK7JmUh4s5qLSN3pB2dZ_THZaE0vefc7z9qI1ZXPQWq9PRG_8zzsgy5tMlnmQYGyVPM2qv3jain9sjjMaM9NwPbJm_BQp3mZy1R3PRtpDD0lBzdY0hoqAwNA_oxImyvIMtUeQXq3pS0tikp2x9WjtkFxmNzyB_9vzcHwfnN_e3)

<details>
<summary>PlantUML source</summary>

```plantuml
@startuml
skinparam componentStyle rectangle
actor "Team Member" as User
component "Next.js / React" as FE
component "FastAPI REST API" as API
component "Integration Sync" as Sync
component "Project Health / Summary" as Health
database PostgreSQL as DB
cloud "GitHub API" as GH
cloud "Discord API" as DC
cloud "LLM API" as LLM
User --> FE
FE --> API : HTTPS / JSON
API --> DB
API --> Sync
API --> Health
Sync --> GH
Sync --> DC
Sync --> DB
Health --> DB
Health --> LLM
@enduml
```

</details>

### 10.4 Backend REST API (OpenAPI 3.1 draft)

```yaml
openapi: 3.1.0
info:
  title: DevSync API
  version: 0.1.0
servers:
  - url: /api
security:
  - bearerAuth: []
paths:
  /projects:
    post:
      summary: Create project
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/ProjectCreate'}
      responses:
        '201':
          description: Created
          content: {application/json: {schema: {$ref: '#/components/schemas/Project'}}}
        '400': {$ref: '#/components/responses/BadRequest'}
        '401': {$ref: '#/components/responses/Unauthorized'}
  /projects/{projectId}:
    get:
      summary: Get project
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      responses:
        '200':
          description: Project
          content: {application/json: {schema: {$ref: '#/components/schemas/Project'}}}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '404': {$ref: '#/components/responses/NotFound'}
    patch:
      summary: Update project
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/ProjectUpdate'}
      responses:
        '200':
          description: Updated project
          content: {application/json: {schema: {$ref: '#/components/schemas/Project'}}}
        '400': {$ref: '#/components/responses/BadRequest'}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '404': {$ref: '#/components/responses/NotFound'}
  /projects/{projectId}/integrations/github:
    post:
      summary: Connect GitHub repository
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/GitHubConnect'}
      responses:
        '200': {description: Connected, content: {application/json: {schema: {$ref: '#/components/schemas/IntegrationStatus'}}}}
        '400': {$ref: '#/components/responses/BadRequest'}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '502': {$ref: '#/components/responses/ExternalError'}
  /projects/{projectId}/integrations/github/sync:
    post:
      summary: Sync GitHub
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      responses:
        '200': {description: Synced, content: {application/json: {schema: {$ref: '#/components/schemas/SyncResult'}}}}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '409': {$ref: '#/components/responses/Conflict'}
        '502': {$ref: '#/components/responses/ExternalError'}
  /projects/{projectId}/integrations/discord:
    post:
      summary: Connect Discord channel
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/DiscordConnect'}
      responses:
        '200': {description: Connected, content: {application/json: {schema: {$ref: '#/components/schemas/IntegrationStatus'}}}}
        '400': {$ref: '#/components/responses/BadRequest'}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '502': {$ref: '#/components/responses/ExternalError'}
  /projects/{projectId}/integrations/discord/sync:
    post:
      summary: Sync Discord
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      responses:
        '200': {description: Synced, content: {application/json: {schema: {$ref: '#/components/schemas/SyncResult'}}}}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '409': {$ref: '#/components/responses/Conflict'}
        '502': {$ref: '#/components/responses/ExternalError'}
  /projects/{projectId}/dashboard:
    get:
      summary: Get dashboard
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      responses:
        '200': {description: Dashboard, content: {application/json: {schema: {$ref: '#/components/schemas/Dashboard'}}}}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '404': {$ref: '#/components/responses/NotFound'}
  /projects/{projectId}/summaries:
    post:
      summary: Generate summary
      parameters: [{$ref: '#/components/parameters/ProjectId'}]
      responses:
        '201': {description: Summary, content: {application/json: {schema: {$ref: '#/components/schemas/Summary'}}}}
        '401': {$ref: '#/components/responses/Unauthorized'}
        '403': {$ref: '#/components/responses/Forbidden'}
        '404': {$ref: '#/components/responses/NotFound'}
        '502': {$ref: '#/components/responses/ExternalError'}
components:
  securitySchemes:
    bearerAuth: {type: http, scheme: bearer}
  parameters:
    ProjectId:
      name: projectId
      in: path
      required: true
      schema: {type: string, format: uuid}
  responses:
    BadRequest: {description: Invalid request, content: {application/json: {schema: {$ref: '#/components/schemas/Error'}}}}
    Unauthorized: {description: Authentication required, content: {application/json: {schema: {$ref: '#/components/schemas/Error'}}}}
    Forbidden: {description: Forbidden, content: {application/json: {schema: {$ref: '#/components/schemas/Error'}}}}
    NotFound: {description: Not found, content: {application/json: {schema: {$ref: '#/components/schemas/Error'}}}}
    Conflict: {description: Integration not connected, content: {application/json: {schema: {$ref: '#/components/schemas/Error'}}}}
    ExternalError: {description: External service failure, content: {application/json: {schema: {$ref: '#/components/schemas/Error'}}}}
  schemas:
    MilestoneInput:
      type: object
      required: [title, dueAt]
      properties:
        title: {type: string}
        dueAt: {type: string, format: date-time}
    Milestone:
      type: object
      required: [id, title, dueAt, status]
      properties:
        id: {type: string, format: uuid}
        title: {type: string}
        dueAt: {type: string, format: date-time}
        status: {type: string, enum: [planned, in_progress, completed, at_risk]}
    ProjectCreate:
      type: object
      required: [name, summary, features, milestones]
      properties:
        name: {type: string}
        summary: {type: string}
        features: {type: array, items: {type: string}}
        deliverables: {type: array, items: {type: string}}
        milestones: {type: array, items: {$ref: '#/components/schemas/MilestoneInput'}}
    ProjectUpdate:
      type: object
      properties:
        name: {type: string}
        summary: {type: string}
        features: {type: array, items: {type: string}}
        deliverables: {type: array, items: {type: string}}
        milestones: {type: array, items: {$ref: '#/components/schemas/MilestoneInput'}}
    Project:
      type: object
      required: [id, name, summary, features, deliverables, milestones]
      properties:
        id: {type: string, format: uuid}
        name: {type: string}
        summary: {type: string}
        features: {type: array, items: {type: string}}
        deliverables: {type: array, items: {type: string}}
        milestones: {type: array, items: {$ref: '#/components/schemas/Milestone'}}
    GitHubConnect:
      type: object
      required: [repositoryOwner, repositoryName, authorizationCode]
      properties:
        repositoryOwner: {type: string}
        repositoryName: {type: string}
        authorizationCode: {type: string}
    DiscordConnect:
      type: object
      required: [guildId, channelId, authorizationCode]
      properties:
        guildId: {type: string}
        channelId: {type: string}
        authorizationCode: {type: string}
    IntegrationStatus:
      type: object
      required: [provider, status]
      properties:
        provider: {type: string, enum: [github, discord]}
        status: {type: string, enum: [connected, syncing, healthy, degraded, failed]}
        lastSuccessfulSyncAt: {type: [string, 'null'], format: date-time}
    SyncResult:
      type: object
      required: [provider, status, importedCount]
      properties:
        provider: {type: string, enum: [github, discord]}
        status: {type: string, enum: [healthy, degraded, failed]}
        importedCount: {type: integer, minimum: 0}
    ActivityItem:
      type: object
      required: [id, source, kind, occurredAt, title]
      properties:
        id: {type: string}
        source: {type: string, enum: [github, discord]}
        kind: {type: string}
        occurredAt: {type: string, format: date-time}
        title: {type: string}
    Dashboard:
      type: object
      required: [project, integrations, recentActivity, blockers, nextSteps]
      properties:
        project: {$ref: '#/components/schemas/Project'}
        integrations: {type: array, items: {$ref: '#/components/schemas/IntegrationStatus'}}
        recentActivity: {type: array, items: {$ref: '#/components/schemas/ActivityItem'}}
        blockers: {type: array, items: {type: string}}
        nextSteps: {type: array, items: {type: string}}
        latestSummary:
          anyOf:
            - {$ref: '#/components/schemas/Summary'}
            - {type: 'null'}
    Summary:
      type: object
      required: [id, projectId, text, generatedAt]
      properties:
        id: {type: string, format: uuid}
        projectId: {type: string, format: uuid}
        text: {type: string}
        generatedAt: {type: string, format: date-time}
    Error:
      type: object
      required: [code, message]
      properties:
        code: {type: string}
        message: {type: string}
```

## 11. Testing and Documentation Plan

- **Frontend unit/component tests:** Vitest or Jest + React Testing Library.
- **Backend unit/API tests:** pytest + FastAPI test client/httpx.
- **Database/integration tests:** isolated PostgreSQL test database, migrations, constraints, authorization, and external-service adapters.
- **System/end-to-end tests:** Playwright for major MVP flows.
- **Acceptance tests:** map tests directly to EARS IDs (for example UC2-AC2).
- **CI:** GitHub Actions runs linting, type checks, tests, and OpenAPI validation before merge.
- **Docs:** repository README/developer setup, `docs/openapi.yaml` rendered with Swagger UI or Redoc, and code comments/docstrings for non-obvious modules.

## 12. Project Planning

Primary ownership is coordination, not exclusive authorship; each member should contribute to implementation and testing across frontend/backend work.

| # | Task | Owner(s) | Hrs | Depends | SP |
|---|---|---|---|---|---|
| 1 | Customer validation | Andrew | 5 | — | 3 |
| 2 | Data model + migrations | Shaunak | 8 | 1 | 5 |
| 3 | Auth + project access | Miguel | 8 | 2 | 5 |
| 4 | Project API | Shaunak | 8 | 2, 3 | 5 |
| 5 | Project setup UI | Andrew | 8 | 4 | 5 |
| 6 | Dashboard backend | Eric | 10 | 2, 4 | 8 |
| 7 | Dashboard frontend | Lena | 10 | 6 | 8 |
| 8 | GitHub integration | Daniel | 14 | 2, 3 | 8 |
| 9 | Discord integration | Sid | 14 | 2, 3 | 8 |
| 10 | Integration UI/status | Miguel | 8 | 8, 9 | 5 |
| 11 | Health/normalization logic | Eric | 12 | 6, 8, 9 | 8 |
| 12 | LLM summary flow | Lena | 10 | 11 | 8 |
| 13 | Unit/integration/EARS tests | Eric | 12 | 4–12 | 8 |
| 14 | CI, Docker, deployment | Daniel | 8 | core app | 5 |
| 15 | Docs, OpenAPI, stabilization | Andrew | 10 | 12–14 | 5 |
