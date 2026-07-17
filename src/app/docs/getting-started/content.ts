/**
 * Getting Started guide content, as a markdown string.
 *
 * Colocated with the route it feeds (rather than living in `src/lib/docs/`,
 * which is reserved for auth token storage, fetch interceptors, and utils
 * per AGENTS.md) and shipped as a plain TS module (rather than read from disk
 * at request time via `fs.readFileSync`) so it is bundled like any other
 * import — no `process.cwd()`-relative path, and nothing for Next's
 * file-tracing to miss once later phases add `generateStaticParams` + ISR to
 * sibling routes that copy this pattern.
 */
export const gettingStartedContent = `# Getting Started with Vinta Schedule API

Welcome to the Vinta Schedule GraphQL API. This guide will get you from zero to your first authenticated API call in minutes.

## What is the Vinta Schedule API?

The Vinta Schedule API is a GraphQL interface for managing calendar groups, availability, bookings, and events. It powers scheduling workflows across healthcare organizations — allowing your patients and staff to find and book appointments across all your connected calendars (Google Calendar, Microsoft Exchange, resource calendars, and more), all in sync within seconds.

This guide covers public-API access, which is designed for integrations and automation. All calls are authenticated with a bearer token.

## Step 1: Mint an API Token

An API token is a credential that grants your integration access to the API. Only organization administrators can create tokens.

1. Navigate to your [API tokens page](/api-tokens)
2. Click "New token"
3. Give your token a descriptive name (e.g., "My Integration" or "Booking System")
4. Select the scopes your integration needs
5. Copy the credential shown — it is shown only once. Store it securely (e.g., in an environment variable)

The credential is a single string in the form \`<system_user_id>:<token>\`. The dialog composes both halves for you — copy the whole string as-is; there is nothing to assemble yourself.

For example: \`42:sk_live_abc123xyz...\`

## Step 2: Send the Authorization Header

Every API request must include an \`Authorization\` header with your credential in this exact format:

\`\`\`
Authorization: Bearer <system_user_id>:<token>
\`\`\`

For example:

\`\`\`
Authorization: Bearer 42:sk_live_abc123xyz...
\`\`\`

The \`Bearer\` prefix and the colon separating \`system_user_id\` and \`token\` are required. The backend middleware validates this exact format.

## Step 3: Make Your First Request

Let's query the API for available booking slots in a calendar group. Here's a curl example:

\`\`\`bash
curl -X POST \\
  -H "Authorization: Bearer <system_user_id>:<token>" \\
  -H "Content-Type: application/json" \\
  https://api.example.com/graphql/ \\
  -d '{
    "query": "query { calendarGroupBookableSlots(groupId: 42, searchWindowStart: \\"2026-06-17T09:00:00-07:00\\", searchWindowEnd: \\"2026-06-24T09:00:00-07:00\\", durationSeconds: 1800) { startTime endTime } }"
  }'
\`\`\`

Replace \`<system_user_id>:<token>\` with your actual credential and \`api.example.com\` with your API base URL.

### GraphQL Example: Query for Bookable Slots

\`\`\`graphql
query {
  calendarGroupBookableSlots(
    groupId: 42
    searchWindowStart: "2026-06-17T09:00:00-07:00"
    searchWindowEnd: "2026-06-24T09:00:00-07:00"
    durationSeconds: 1800
  ) {
    startTime
    endTime
  }
}
\`\`\`

This query searches a calendar group (groupId: 42) for slots of 30 minutes (1800 seconds) within the given search window (\`searchWindowStart\` through \`searchWindowEnd\`).

### GraphQL Example: Create a Booking

Once you've identified an available slot, confirm the booking:

\`\`\`graphql
mutation {
  createCalendarGroupEvent(
    input: {
      organizationId: 7
      groupId: 42
      timezone: "America/Los_Angeles"
      title: "Prenatal Intake"
      description: ""
      startTime: "2026-06-17T10:30:00-07:00"
      endTime: "2026-06-17T11:00:00-07:00"
      slotSelections: [{ slotId: 5, calendarIds: [128] }]
    }
  ) {
    success
    event {
      id
      title
      startTime
      endTime
    }
  }
}
\`\`\`

This mutation books the selected slot across every calendar in the group, writes it to all connected providers (Google Calendar, Exchange, etc.), and returns \`success\` plus the created event details under \`event\`. If the booking could not be made, \`success\` is \`false\` and \`event\` is \`null\` — check \`success\` before reading \`event\`.

## What's Next?

- **Schema Reference**: Browse every query, mutation, and type in the [schema reference](/docs/reference)
- **Concepts**: Understand [Calendar Groups](/docs/concepts), availability, events, and more
- **Explorer**: Try live queries in the [GraphiQL explorer](/docs/explorer)
- **Webhooks**: Set up [outbound event notifications](/docs/webhooks) for your bookings

## Support

For API issues, questions, or feature requests, reach out to the Vinta team or check the [concepts](/docs/concepts) for in-depth domain documentation.

Happy coding!
`;
