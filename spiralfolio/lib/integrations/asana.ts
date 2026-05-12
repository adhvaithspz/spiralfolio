import 'server-only';
import type { BrainDeliverable } from '@/lib/db/brain';

type AsanaResult = { created: number; skipped: number; reason?: string };

/**
 * Creates Asana tasks for pending deliverables. Uses dynamic import so the package
 * loads lazily. Gracefully no-ops if ASANA_ACCESS_TOKEN or asanaProjectId is missing.
 */
export async function syncDeliverablesToAsana(input: {
  asanaProjectId: string | null | undefined;
  projectName: string;
  clientName: string;
  callType: string;
  callDate: string;
  ourDeliverables: BrainDeliverable[];
  clientDeliverables: BrainDeliverable[];
}): Promise<AsanaResult> {
  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) return { created: 0, skipped: 0, reason: 'ASANA_ACCESS_TOKEN not configured' };
  if (!input.asanaProjectId) return { created: 0, skipped: 0, reason: 'No asana_project_id on client' };
  const asanaProjectId = input.asanaProjectId;

  // Asana SDK shape varies across versions; we use the lower-level Tasks API surface
  // through dynamic typing.
  type AsanaSdk = {
    ApiClient: { instance: { authentications: Record<string, { accessToken: string }> } };
    TasksApi: new () => {
      createTask: (
        body: { data: { name: string; notes: string; projects: string[]; due_on?: string } },
        opts: Record<string, unknown>
      ) => Promise<unknown>;
    };
  };

  let asana: AsanaSdk;
  try {
    asana = (await import('asana')) as unknown as AsanaSdk;
  } catch {
    return { created: 0, skipped: 0, reason: 'asana package not available' };
  }

  const client = asana.ApiClient.instance;
  client.authentications['token'].accessToken = token;
  const tasksApi = new asana.TasksApi();

  let created = 0;
  let skipped = 0;

  const buildName = (d: BrainDeliverable) => d.item.slice(0, 240);
  const buildNotes = (d: BrainDeliverable, owned: 'us' | 'client') => {
    const lines = [
      d.details ?? '',
      '',
      owned === 'client' ? `Owner (client side): ${d.owner ?? '—'}` : '',
      `Extracted from ${input.callType} call — ${input.callDate}`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const submit = async (d: BrainDeliverable, owned: 'us' | 'client') => {
    if ((d.status ?? '').toLowerCase() === 'done') {
      skipped++;
      return;
    }
    try {
      await tasksApi.createTask(
        {
          data: {
            name: buildName(d),
            notes: buildNotes(d, owned),
            projects: [asanaProjectId],
            due_on: d.due && /^\d{4}-\d{2}-\d{2}$/.test(d.due) ? d.due : undefined,
          },
        },
        {}
      );
      created++;
    } catch {
      skipped++;
    }
  };

  for (const d of input.ourDeliverables) await submit(d, 'us');
  for (const d of input.clientDeliverables) await submit(d, 'client');

  return { created, skipped };
}
