import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NOW_KINDS, type NowItem } from "@/lib/now";
import { createNowItem, deleteNowItem, updateNowItem } from "./actions";

export const dynamic = "force-dynamic";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

const INPUT =
  "w-full rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-accent/45";
const LABEL = "block text-xs text-muted mb-1";

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} className={INPUT} />
    </div>
  );
}

function KindSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <div>
      <label className={LABEL}>Kind</label>
      <select name="kind" defaultValue={defaultValue ?? "reading"} className={INPUT}>
        {NOW_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </div>
  );
}

function ItemFields({ item }: { item?: NowItem }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KindSelect defaultValue={item?.kind} />
      <Field label="Title" name="title" defaultValue={item?.title} placeholder="Title" />
      <Field label="Subtitle" name="subtitle" defaultValue={item?.subtitle} placeholder="Author, studio, ..." />
      <Field label="ISBN-13" name="isbn13" defaultValue={item?.isbn13} placeholder="9780000000000" />
      <Field label="URL" name="url" defaultValue={item?.url} placeholder="https://" />
      <div className="sm:col-span-2">
        <Field label="Note" name="note" defaultValue={item?.note} placeholder="One line" />
      </div>
      <div className="flex items-end gap-4">
        <div className="w-20">
          <label className={LABEL}>Sort</label>
          <input name="sort" type="number" defaultValue={item?.sort ?? 0} className={INPUT} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-body">
          <input
            type="checkbox"
            name="active"
            defaultChecked={item ? item.active === 1 : true}
            className="h-4 w-4 rounded border border-neutral-700 bg-panel accent-accent"
          />
          Active
        </label>
      </div>
    </div>
  );
}

export default async function NowAdminPage() {
  let items: NowItem[] = [];
  let dbError = false;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const result = await env.ANALYTICS_DB.prepare(
      `SELECT id, kind, title, subtitle, isbn13, note, url, sort, active, updated_at
       FROM now_items ORDER BY active DESC, kind, sort, id`
    ).all<NowItem>();
    items = result.results ?? [];
  } catch (err) {
    console.error("[admin/now] failed to load items:", err);
    dbError = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Now</h1>
      </div>
      <p className="text-sm text-muted mb-8">
        Rows served by <span className="font-mono text-xs">/api/now</span>. The first active reading
        item is the book on the home page; edge cache is 60 s. Delete keeps the row and sets it
        inactive.
      </p>

      {dbError && <p className="text-sm text-red-400">Failed to load items.</p>}

      <div className="space-y-4 mb-12">
        {!dbError && items.length === 0 && <p className="text-sm text-muted">No items yet.</p>}
        {items.map((item) => (
          <form
            key={item.id}
            action={updateNowItem}
            className={
              "rounded-2xl border border-line bg-panel/35 p-5" + (item.active ? "" : " opacity-60")
            }
          >
            <input type="hidden" name="id" value={item.id} />
            <ItemFields item={item} />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                #{item.id} updated {new Date(item.updated_at).toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <div className="flex items-center gap-4">
                {item.active === 1 && (
                  <button
                    type="submit"
                    formAction={deleteNowItem}
                    className="text-xs text-neutral-500 hover:text-red-400 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-xl border border-accent/45 bg-accent/10 px-4 py-1.5 text-sm text-accent-text hover:bg-accent/15 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        ))}
      </div>

      <h2 className="text-lg font-medium mb-4">Add item</h2>
      <form action={createNowItem} className="rounded-2xl border border-line bg-panel/35 p-5">
        <ItemFields />
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="rounded-xl border border-accent/45 bg-accent/10 px-5 py-2 text-sm text-accent-text hover:bg-accent/15 transition"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
