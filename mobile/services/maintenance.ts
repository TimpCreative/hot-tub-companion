import api from './api';

export type MaintenanceEvent = {
  id: string;
  spaProfileId: string;
  eventType: string;
  title: string;
  description?: string | null;
  dueDate: string;
  completedAt?: string | null;
  isRecurring?: boolean;
  recurrenceIntervalDays?: number | null;
  linkedProductCategory?: string | null;
  source?: string;
};

type ListResponse = {
  success?: boolean;
  data?: {
    events: MaintenanceEvent[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  };
};

export async function listMaintenanceEvents(
  spaProfileId: string,
  opts?: { status?: string; pageSize?: number }
): Promise<MaintenanceEvent[]> {
  const res = (await api.get('/maintenance', {
    params: {
      spaProfileId,
      pageSize: opts?.pageSize ?? 120,
      page: 1,
      ...(opts?.status ? { status: opts.status } : {}),
    },
  })) as ListResponse;
  return res?.data?.events ?? [];
}

type CompleteResponse = { success?: boolean; data?: { event: MaintenanceEvent } };

export async function completeMaintenanceEvent(id: string): Promise<MaintenanceEvent | null> {
  const res = (await api.post(`/maintenance/${id}/complete`)) as CompleteResponse;
  return res?.data?.event ?? null;
}
