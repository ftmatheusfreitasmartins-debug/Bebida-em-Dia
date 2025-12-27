import jwt from "jsonwebtoken";
import { loadState, saveState } from "./db.mjs";

const ADMIN_PASSWORD = process.env.ADMINPASSWORD || "coca";
const JWT_SECRET = process.env.JWTSECRET || process.env.JWT_SECRET || "CHANGE_ME_ON_NETLIFY";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
    body: JSON.stringify(data),
  };
}

function safeJsonParse(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function normalizeRoute(eventPath) {
  let p = eventPath || "/";
  // quando vem pelo redirect, costuma chegar como /.netlify/functions/api/...
  p = p.replace(/^\/\.netlify\/functions\/api/, "");
  if (!p.startsWith("/")) p = `/${p}`;
  // se algum cliente chamar /api/..., também funciona
  if (p.startsWith("/api/")) p = p.slice(4);
  return p;
}

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function requireAdmin(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (!auth || !auth.startsWith("Bearer ")) return { ok: false, error: "Token ausente" };

  const token = auth.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload?.role !== "admin") return { ok: false, error: "Token inválido" };
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "Token inválido/expirado" };
  }
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

    const route = normalizeRoute(event.path);
    const method = event.httpMethod;

    let data = await loadState();

    // ---------- PUBLIC ----------
    if (route === "/data" && method === "GET") {
      return json(200, data);
    }

    if (route === "/next-person" && method === "GET") {
      const people = data.people;
      if (!people.length) return json(200, { nextPerson: null });

      const counts = {};
      people.forEach((p) => (counts[p] = 0));
      Object.values(data.paidDates || {}).forEach((p) => {
        if (counts[p] !== undefined) counts[p] += 1;
      });

      const nextPerson = people.reduce(
        (prev, curr) => (counts[curr] < counts[prev] ? curr : prev),
        people[0],
      );

      return json(200, { nextPerson });
    }

    if (route === "/paid/toggle-today" && method === "PATCH") {
      const body = safeJsonParse(event.body);
      if (!body) return json(400, { success: false, error: "JSON inválido" });

      const name = (body.name || "").trim();
      if (!name) return json(400, { success: false, error: "Nome não fornecido" });

      const today = getTodayISO();
      const payer = data.paidDates[today];

      if (payer === name) delete data.paidDates[today];
      else data.paidDates[today] = name;

      data = await saveState(data);
      return json(200, { success: true, paidDates: data.paidDates });
    }

    if (route === "/chat" && method === "GET") {
      return json(200, data.chat);
    }

    if (route === "/chat" && method === "POST") {
      const body = safeJsonParse(event.body);
      if (!body) return json(400, { success: false, error: "JSON inválido" });

      const userName = (body.userName || "").trim();
      const text = (body.text || "").trim();
      if (!userName || !text) return json(400, { success: false, error: "userName e text são obrigatórios" });

      const msg = {
        id: Date.now().toString(),
        userName,
        text,
        timestamp: new Date().toISOString(),
      };

      data.chat.push(msg);
      if (data.chat.length > 100) data.chat = data.chat.slice(-100);

      data = await saveState(data);
      return json(200, { success: true, message: msg, totalMessages: data.chat.length });
    }

    // ---------- ADMIN ----------
    if (route === "/admin/login" && method === "POST") {
      const body = safeJsonParse(event.body);
      if (!body) return json(400, { success: false, error: "JSON inválido" });

      if (body.password !== ADMIN_PASSWORD) return json(401, { success: false, error: "Senha incorreta" });

      const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
      return json(200, { success: true, token, message: "Login realizado com sucesso" });
    }

    if (route.startsWith("/admin/")) {
      const auth = requireAdmin(event);
      if (!auth.ok) return json(401, { success: false, error: auth.error });

      if (route === "/admin/data" && method === "GET") {
        return json(200, { success: true, ...data });
      }

      if (route === "/admin/people" && method === "POST") {
        const body = safeJsonParse(event.body);
        if (!body) return json(400, { success: false, error: "JSON inválido" });

        const name = (body.name || "").trim();
        if (!name) return json(400, { success: false, error: "Nome inválido" });

        if (!data.people.includes(name)) data.people.push(name);
        data = await saveState(data);
        return json(200, { success: true, people: data.people });
      }

      if (route === "/admin/people" && method === "DELETE") {
        const body = safeJsonParse(event.body);
        if (!body) return json(400, { success: false, error: "JSON inválido" });

        const name = (body.name || "").trim();
        if (!name) return json(400, { success: false, error: "Nome inválido" });

        data.people = data.people.filter((p) => p !== name);
        Object.keys(data.paidDates).forEach((date) => {
          if (data.paidDates[date] === name) delete data.paidDates[date];
        });

        data = await saveState(data);
        return json(200, { success: true, people: data.people, paidDates: data.paidDates });
      }

      if (route === "/admin/paid" && method === "PATCH") {
        const body = safeJsonParse(event.body);
        if (!body) return json(400, { success: false, error: "JSON inválido" });

        const date = body.date;
        const name = body.name;

        if (!date) return json(400, { success: false, error: "Data não fornecida" });

        if (name === null || name === undefined || String(name).trim() === "") delete data.paidDates[date];
        else data.paidDates[date] = String(name).trim();

        data = await saveState(data);
        return json(200, { success: true, paidDates: data.paidDates });
      }

      if (route === "/admin/reset" && method === "DELETE") {
        data.paidDates = {};
        data.chat = [];
        data.settings = { currentIndex: 0, rotationMode: "sequential" };
        data = await saveState(data);
        return json(200, { success: true });
      }

      if (route === "/admin/settings" && method === "PATCH") {
        const body = safeJsonParse(event.body);
        if (!body) return json(400, { success: false, error: "JSON inválido" });

        data.settings = { ...(data.settings || {}), ...body };
        data = await saveState(data);
        return json(200, { success: true, settings: data.settings });
      }

      return json(405, { success: false, error: "Método não permitido" });
    }

    return json(404, { success: false, error: "Rota não encontrada", route });
  } catch (e) {
    return json(500, { success: false, error: e?.message || "Erro interno" });
  }
};
