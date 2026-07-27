import { api } from "@/lib/api/client";

export type MasterFieldType = "text" | "number" | "color" | "select";
export interface MasterField { key: string; label: string; type: MasterFieldType; unit?: string; options?: string[] }
export interface MasterItem { id: string; value: string; label: string; metadata?: Record<string, unknown> | null; isActive: boolean }
export interface MasterListDetail { id: string; key: string; label: string; fields?: MasterField[] | null; items: MasterItem[] }

export async function getMaster(key: string, storeId: string): Promise<MasterListDetail | null> {
  try {
    return await api.get<MasterListDetail>(`/masters/${key}?storeId=${storeId}`, { auth: true });
  } catch {
    return null;
  }
}

export async function getMasterItems(key: string, storeId: string): Promise<MasterItem[]> {
  const list = await getMaster(key, storeId);
  return (list?.items ?? []).filter((i) => i.isActive);
}
