"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { type ApplicationEnv, appendConfig, CONFIG_NAME_LIST } from "@/lib/applications/store";

export interface ConfigFormState {
  error?: string;
  ok?: boolean;
}

/** Append a stats_config row; the latest row per name wins. Never edits history. */
export async function writeConfig(_prev: ConfigFormState, fd: FormData): Promise<ConfigFormState> {
  const name = String(fd.get("name") ?? "");
  if (!CONFIG_NAME_LIST.includes(name)) return { error: "Choose a setting." };
  const raw = String(fd.get("value") ?? "").trim();
  const value = Number(raw);
  if (raw === "" || !Number.isFinite(value) || value < 0) return { error: "Value must be a non-negative number." };
  if ((name === "T_days" || name === "V_days" || name === "m") && !Number.isInteger(value)) return { error: `${name} must be a whole number.` };
  if (name === "floor" && value > 1) return { error: "floor is a share between 0 and 1." };
  const db = ((await getCloudflareContext({ async: true })).env as unknown as ApplicationEnv).ANALYTICS_DB;
  await appendConfig(db, name, value, new Date().toISOString());
  revalidatePath("/admin/stats");
  return { ok: true };
}
