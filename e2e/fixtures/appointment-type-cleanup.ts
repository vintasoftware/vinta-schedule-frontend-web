import type { APIRequestContext } from '@playwright/test';

/**
 * deleteAppointmentType — best-effort cleanup for an appointment type this
 * suite's specs created in the shared QA org.
 *
 * There is no delete affordance anywhere in the app UI for an appointment type
 * (`appointment-types-table.tsx` and `appointment-type-detail-view.tsx` only offer "Get scheduling
 * link" and "Edit") — `appointmentTypesDestroy` (`DELETE /appointment-types/{id}/`)
 * exists on the API but the frontend never calls it. Per the task's explicit
 * "via the UI" alternative, this goes straight at the REST API instead,
 * through Playwright's own `request` fixture — the same `NEXT_PUBLIC_API_BASE_URL`
 * the app points its generated client at (`@/lib/configure-api-clients.ts`),
 * with the same two headers the app's own request interceptor would set:
 * `Authorization: Bearer <token>` and `X-Organization-Id` (resolved from
 * `GET /organizations/current/`, mirroring `use-active-organization.ts`'s
 * bootstrap — there is no shortcut to the org id, it has to be looked up the
 * same way the app does).
 *
 * Deliberately swallows a failed delete rather than throwing: cleanup runs
 * in `afterEach`, and a `afterEach`-time throw would mask the actual test
 * failure that (if any) preceded it. A failure is `console.warn`'d loudly so
 * a human sees it and can sweep the QA org by hand — "resilient to a
 * mid-test failure" per the task, not "guaranteed to always succeed".
 */
export async function deleteAppointmentType(
  request: APIRequestContext,
  appointmentTypeId: number | null
): Promise<void> {
  if (appointmentTypeId === null) return;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const accessToken = process.env.E2E_ADMIN_ACCESS_TOKEN;
  if (!apiBaseUrl || !accessToken) {
    console.warn(
      `[cleanup] Skipping delete of appointment type ${appointmentTypeId} — ` +
        'NEXT_PUBLIC_API_BASE_URL or E2E_ADMIN_ACCESS_TOKEN is not set.'
    );
    return;
  }

  try {
    const organizationId = await resolveActiveOrganizationId(
      request,
      apiBaseUrl,
      accessToken
    );
    const response = await request.delete(
      `${apiBaseUrl}/appointment-types/${appointmentTypeId}/`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Organization-Id': organizationId,
        },
      }
    );
    // 204 on success, 404 if it's already gone (e.g. a retried cleanup) —
    // both are fine. Anything else is worth a human's attention, not a
    // failed test run.
    if (!response.ok() && response.status() !== 404) {
      console.warn(
        `[cleanup] Failed to delete appointment type ${appointmentTypeId}: ` +
          `${response.status()} ${await response.text()}`
      );
    }
  } catch (err) {
    console.warn(
      `[cleanup] Error deleting appointment type ${appointmentTypeId}: ${String(err)}`
    );
  }
}

async function resolveActiveOrganizationId(
  request: APIRequestContext,
  apiBaseUrl: string,
  accessToken: string
): Promise<string> {
  const response = await request.get(`${apiBaseUrl}/organizations/current/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok()) {
    throw new Error(
      `Failed to resolve the active organization for cleanup (${response.status()})`
    );
  }
  const body = (await response.json()) as {
    organization?: { id?: unknown };
  };
  const organizationId = body.organization?.id;
  if (organizationId === undefined || organizationId === null) {
    throw new Error(
      'GET /organizations/current/ returned no organization id for cleanup'
    );
  }
  return String(organizationId);
}
