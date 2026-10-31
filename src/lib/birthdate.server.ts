import { sql } from "@/lib/neon";

/** Geboortedatum per account. Alleen via deze helpers lezen/schrijven. */

export const MIN_AGE = 13;

/** Valideert JJJJ-MM-DD: bestaande datum, niet in de toekomst, minstens 13 jaar. */
export function validateBirthdate(raw: string, now = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Gebruik een geldige datum.");
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) throw new Error("Gebruik een geldige datum.");
  if (d.getUTCFullYear() < 1900) throw new Error("Gebruik een geldige datum.");
  const limit = new Date(Date.UTC(now.getUTCFullYear() - MIN_AGE, now.getUTCMonth(), now.getUTCDate()));
  if (d > limit) throw new Error(`Je moet minstens ${MIN_AGE} jaar zijn.`);
  return raw;
}

export async function hasBirthdate(userId: string): Promise<boolean> {
  const rows = (await sql`select 1 from public.user_birthdates where user_id = ${userId} limit 1`) as unknown[];
  return rows.length > 0;
}

export async function saveBirthdate(userId: string, birthdate: string, source: "user" | "google" = "user") {
  const value = validateBirthdate(birthdate);
  await sql`
    insert into public.user_birthdates (user_id, birthdate, source)
    values (${userId}, ${value}, ${source})
    on conflict (user_id) do update
      set birthdate = excluded.birthdate, source = excluded.source, updated_at = now()`;
}
