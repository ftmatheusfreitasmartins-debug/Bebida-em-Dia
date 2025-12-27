import { neon } from "@neondatabase/serverless";

const DATABASE_URL =
  process.env.NETLIFY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED; // fallback

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL ausente (NETLIFY_DATABASE_URL/DATABASE_URL).");
}

export const sql = neon(DATABASE_URL);

const DEFAULT_DATA = {
  chat: [],
  paidDates: {},
  people: [],
  settings: { currentIndex: 0, rotationMode: "sequential" },
};

function ensureShape(data) {
  return {
    chat: Array.isArray(data?.chat) ? data.chat : [],
    paidDates: data?.paidDates && typeof data.paidDates === "object" ? data.paidDates : {},
    people: Array.isArray(data?.people) ? data.people : [],
    settings: data?.settings && typeof data.settings === "object" ? data.settings : DEFAULT_DATA.settings,
  };
}

export async function loadState() {
  const rows = await sql`SELECT data FROM app_state WHERE id = 'bebida-em-dia' LIMIT 1`;
  if (rows.length) return ensureShape(rows[0].data);

  await saveState(DEFAULT_DATA);
  return DEFAULT_DATA;
}

export async function saveState(data) {
  const normalized = ensureShape(data);

  await sql`
    INSERT INTO app_state (id, data)
    VALUES ('bebida-em-dia', ${JSON.stringify(normalized)}::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data,
        updated_at = now()
  `;

  return normalized;
}
