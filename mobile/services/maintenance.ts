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
  snoozedUntil?: string | null;
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

type MutateResponse = { success?: boolean; data?: { event: MaintenanceEvent } };

export async function createCustomMaintenanceEvent(body: {
  spaProfileId: string;
  title: string;
  description?: string | null;
  dueDate: string;
}): Promise<MaintenanceEvent | null> {
  const res = (await api.post('/maintenance', body)) as MutateResponse;
  return res?.data?.event ?? null;
}

export async function updateCustomMaintenanceEvent(
  id: string,
  body: { title?: string; description?: string | null; dueDate?: string }
): Promise<MaintenanceEvent | null> {
  const res = (await api.put(`/maintenance/${id}`, body)) as MutateResponse;
  return res?.data?.event ?? null;
}

export async function deleteCustomMaintenanceEvent(id: string): Promise<boolean> {
  try {
    await api.delete(`/maintenance/${id}`);
    return true;
  } catch {
    return false;
  }
}

type MutateOneResponse = { success?: boolean; data?: { event: MaintenanceEvent } };

export async function snoozeMaintenanceEvent(
  id: string,
  body: { preset: '1h' | '1d' | '7d' | 'custom'; customUntil?: string }
): Promise<MaintenanceEvent | null> {
  const res = (await api.post(`/maintenance/${id}/snooze`, body)) as MutateOneResponse;
  return res?.data?.event ?? null;
}

export async function rescheduleMaintenanceEvent(
  id: string,
  body: { preset: '1d' | '7d' | 'custom'; dueDate?: string }
): Promise<MaintenanceEvent | null> {
  const res = (await api.post(`/maintenance/${id}/reschedule`, body)) as MutateOneResponse;
  return res?.data?.event ?? null;
}

export type MaintenanceActivityItem = {
  id: string;
  spaProfileId: string;
  userId: string;
  tenantId: string;
  maintenanceEventId: string | null;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type ActivityListResponse = {
  success?: boolean;
  data?: {
    items: MaintenanceActivityItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export async function listMaintenanceActivity(
  spaProfileId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<{ items: MaintenanceActivityItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const res = (await api.get('/maintenance/activity', {
    params: {
      spaProfileId,
      page: opts?.page ?? 1,
      pageSize: opts?.pageSize ?? 50,
    },
  })) as ActivityListResponse;
  const d = res?.data;
  return {
    items: d?.items ?? [],
    total: d?.total ?? 0,
    page: d?.page ?? 1,
    pageSize: d?.pageSize ?? 50,
    totalPages: d?.totalPages ?? 1,
  };
}
