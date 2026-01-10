const jwt = require("jsonwebtoken");
const { Client } = require("pg");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

// tente pegar a env var que o seu Netlify DB criou
const DATABASE_URL =
  process.env.NETLIFY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

const DEFAULT_STATE = {
  people: ["Matheus", "Ana Beatriz", "Maria Carolina", "Lais Dias"],
  paidDates: {},
  chat: [],
  settings: { rotationMode: "sequential", currentIndex: 0 },
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    },
    body: body === null ? "" : JSON.stringify(body),
  };
}

function getPath(event) {
  return (event.path || "").replace(/^\/.netlify\/functions\/api/, "") || "/";
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}

function getAuthToken(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

function requireAdmin(event) {
  const token = getAuthToken(event);
  if (!token) return { ok: false, error: "Token de acesso necessário." };
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { ok: true, decoded };
  } catch {
    return { ok: false, error: "Token inválido." };
  }
}

async function withDb(fn) {
  if (!DATABASE_URL) throw new Error("DATABASE_URL não configurada no ambiente.");
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function getState(client) {
  const { rows } = await client.query("select data from app_state where id = 1");
  if (!rows.length) {
    await client.query("insert into app_state (id, data) values (1, $1::jsonb)", [
      JSON.stringify(DEFAULT_STATE),
    ]);
    return { ...DEFAULT_STATE };
  }
  return rows[0].data || { ...DEFAULT_STATE };
}

async function saveState(client, state) {
  await client.query("update app_state set data = $1::jsonb where id = 1", [JSON.stringify(state)]);
}

function getNextPersonInRotation(people, settings) {
  if (!people || people.length === 0) return null;
  if (settings?.rotationMode === "random") {
    return people[Math.floor(Math.random() * people.length)];
  }
  const idx = settings?.currentIndex || 0;
  return people[idx % people.length];
}

function updateRotationIndex(state) {
  if (state?.settings?.rotationMode === "sequential") {
    state.settings.currentIndex = (state.settings.currentIndex + 1) % state.people.length;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, null);

  const path = getPath(event);
  const method = event.httpMethod;

  try {
    // públicas
    if (path === "/data" && method === "GET") {
      return await withDb(async (client) => {
        const state = await getState(client);
        return json(200, { people: state.people, paidDates: state.paidDates, chat: state.chat });
      });
    }

    if (path === "/next-person" && method === "GET") {
      return await withDb(async (client) => {
        const state = await getState(client);
        const nextPerson = getNextPersonInRotation(state.people, state.settings);
        return json(200, { success: true, nextPerson });
      });
    }

    if (path === "/paid/toggle-today" && method === "PATCH") {
      const body = parseBody(event);
      const name = body.name;

      return await withDb(async (client) => {
        const state = await getState(client);
        const today = new Date().toISOString().slice(0, 10);

        if (!name || !state.people.includes(name)) {
          return json(400, { success: false, error: "Nome inválido." });
        }

        if (state.paidDates[today]) {
          delete state.paidDates[today];
        } else {
          state.paidDates[today] = name;
          updateRotationIndex(state);
        }

        await saveState(client, state);
        return json(200, { success: true, paidDates: state.paidDates });
      });
    }

    if (path === "/chat" && method === "POST") {
      const body = parseBody(event);
      const userName = String(body.userName || "").trim();
      const text = String(body.text || "").trim();

      if (!userName || !text) {
        return json(400, { success: false, error: "Nome de usuário e texto são obrigatórios." });
      }
      if (text.length > 500) {
        return json(400, { success: false, error: "Mensagem muito longa." });
      }

      return await withDb(async (client) => {
        const state = await getState(client);
        const newChatMsg = {
          id: Date.now().toString(),
          userName,
          text,
          timestamp: new Date().toISOString(),
        };

        state.chat = Array.isArray(state.chat) ? state.chat : [];
        state.chat.push(newChatMsg);
        if (state.chat.length > 100) state.chat = state.chat.slice(-100);

        await saveState(client, state);
        return json(201, { success: true, chat: state.chat });
      });
    }

    // admin
    if (path === "/admin/login" && method === "POST") {
      const body = parseBody(event);
      const password = String(body.password || "").trim();
      if (!password) return json(400, { success: false, error: "Senha é obrigatória." });
      if (password !== ADMIN_PASSWORD) return json(401, { success: false, error: "Senha incorreta." });

      const token = jwt.sign({ role: "admin", timestamp: Date.now() }, JWT_SECRET, {
        expiresIn: "24h",
      });
      return json(200, { success: true, token });
    }

    if (path.startsWith("/admin/")) {
      const auth = requireAdmin(event);
      if (!auth.ok) return json(401, { success: false, error: auth.error });
    }

    if (path === "/admin/data" && method === "GET") {
      return await withDb(async (client) => {
        const state = await getState(client);
        return json(200, state);
      });
    }

    if (path === "/admin/people" && method === "POST") {
      const body = parseBody(event);
      const name = String(body.name || "").trim();

      if (!name) return json(400, { success: false, error: "O nome é obrigatório." });
      if (name.length > 50) return json(400, { success: false, error: "Nome muito longo." });

      return await withDb(async (client) => {
        const state = await getState(client);
        if (state.people.includes(name)) return json(400, { success: false, error: "Pessoa já existe." });

        state.people.push(name);
        await saveState(client, state);
        return json(201, { success: true, people: state.people });
      });
    }

    if (path === "/admin/people" && method === "DELETE") {
      const body = parseBody(event);
      const name = String(body.name || "").trim();
      if (!name) return json(400, { success: false, error: "O nome é obrigatório." });

      return await withDb(async (client) => {
        const state = await getState(client);
        const before = state.people.length;
        state.people = state.people.filter((p) => p !== name);
        if (state.people.length === before) return json(404, { success: false, error: "Pessoa não encontrada." });

        const newPaidDates = {};
        for (const date in state.paidDates) {
          if (state.paidDates[date] !== name) newPaidDates[date] = state.paidDates[date];
        }
        state.paidDates = newPaidDates;

        if ((state.settings?.currentIndex || 0) >= state.people.length) state.settings.currentIndex = 0;

        await saveState(client, state);
        return json(200, { success: true, people: state.people, paidDates: state.paidDates });
      });
    }

    if (path === "/admin/paid" && method === "PATCH") {
      const body = parseBody(event);
      const date = String(body.date || "").trim();
      const name = body.name === null ? null : String(body.name || "").trim();

      if (!date) return json(400, { success: false, error: "Data é obrigatória." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { success: false, error: "Formato de data inválido." });

      return await withDb(async (client) => {
        const state = await getState(client);
        if (name) {
          if (!state.people.includes(name)) return json(400, { success: false, error: "Pessoa não encontrada." });
          state.paidDates[date] = name;
        } else {
          delete state.paidDates[date];
        }

        await saveState(client, state);
        return json(200, { success: true, paidDates: state.paidDates });
      });
    }

    if (path === "/admin/reset" && method === "DELETE") {
      return await withDb(async (client) => {
        const state = await getState(client);
        state.paidDates = {};
        if (!state.settings) state.settings = { rotationMode: "sequential", currentIndex: 0 };
        state.settings.currentIndex = 0;

        await saveState(client, state);
        return json(200, { success: true, message: "Histórico de pagamentos resetado." });
      });
    }

    if (path === "/admin/settings" && method === "PATCH") {
      const body = parseBody(event);
      const rotationMode = String(body.rotationMode || "").trim();

      if (!["sequential", "random"].includes(rotationMode)) {
        return json(400, { success: false, error: "Modo de rotação inválido." });
      }

      return await withDb(async (client) => {
        const state = await getState(client);
        if (!state.settings) state.settings = { rotationMode: "sequential", currentIndex: 0 };
        state.settings.rotationMode = rotationMode;

        await saveState(client, state);
        return json(200, { success: true, settings: state.settings });
      });
    }

    return json(404, { success: false, error: "Rota não encontrada." });
  } catch (e) {
    return json(500, { success: false, error: "Erro interno do servidor.", details: String(e?.message || e) });
  }
};
