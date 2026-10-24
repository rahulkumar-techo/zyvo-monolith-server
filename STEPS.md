Recommended execution approach
Ask the coding agent to finish only the foundation first. Do not implement authentication, rider onboarding, dispatch, payments, or ride lifecycle in this initial task.

Once the foundation passes all checks, use separate implementation prompts in this order:
1. Authentication: OTP/password login, access tokens, refresh-token rotation, sessions, RBAC.
2. Users and riders: profiles, onboarding, verification, vehicles, document metadata.
3. Rides: fare estimates, ride creation, lifecycle transitions, cancellation.
4. Dispatch: Redis GEO, rider offers, race-safe assignment.
5. Payments and wallets: provider integration, webhooks, immutable ledger.
6. Realtime and notifications: WebSocket authorization, ride updates, push notifications.
This sequence keeps the initial setup small, verifiable, and easier to debug without breaking the existing pnpm workspace.