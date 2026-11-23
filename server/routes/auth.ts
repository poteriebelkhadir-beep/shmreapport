import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabase";
import { consume, getClientIp } from "../lib/rateLimit";
import { issueRapportToken, requireRapportAuth, RAPPORT_SESSION_DAYS } from "../lib/auth";

/**
 * Connexion réelle, vérifiée côté serveur.
 *
 * Les comptes vivent dans la table Supabase `rapport_users` (voir
 * supabase/AUTH.sql). Le mot de passe et le PIN n'y sont stockés que sous
 * forme de hash bcrypt : ils ne sont jamais présents dans le code du site,
 * contrairement à l'ancien système qui comparait les saisies à des variables
 * VITE_* visibles dans le bundle JavaScript.
 */

const router = Router();

const TABLE = "rapport_users";
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Normalise un nom : minuscules, sans accents, espaces simples. */
const normalizeName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function noStore(res: Response) {
  res.setHeader("Cache-Control", "no-store");
}

interface LoginBody {
  firstName?: unknown;
  lastName?: unknown;
  pin?: unknown;
  password?: unknown;
}

router.post("/login", async (req: Request, res: Response) => {
  noStore(res);

  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: "Connexion non configurée sur le serveur (JWT_SECRET manquant)." });
  }

  const body = (req.body ?? {}) as LoginBody;
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const pin = clean(body.pin);
  const password = typeof body.password === "string" ? body.password : "";

  if (!firstName || !lastName || !pin || !password) {
    return res.status(400).json({ error: "الرجاء ملء جميع الحقول." });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: "يجب أن يتكون رمز PIN من أرقام فقط." });
  }

  const ip = getClientIp(req as unknown as { headers: Record<string, unknown>; ip?: string });
  const limiterKey = `login:${ip}:${normalizeName(lastName)}:${normalizeName(firstName)}`;
  const limit = consume(limiterKey, LOCK_MINUTES * 60_000, 10);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    return res.status(429).json({
      error: `عدد المحاولات كبير جدًا. أعد المحاولة بعد ${Math.ceil(limit.retryAfterSeconds / 60)} دقيقة.`,
    });
  }

  try {
    const { data: candidates, error } = await supabaseAdmin
      .from(TABLE)
      .select("id, first_name, last_name, birth_date, pin_hash, password_hash, role, is_active, failed_attempts, locked_until")
      .limit(50);

    if (error) {
      console.error("[auth] lecture rapport_users:", error.message);
      return res.status(500).json({ error: "تعذر الاتصال بالخادم. حاول لاحقًا." });
    }

    const user = (candidates ?? []).find(
      (row) =>
        normalizeName(String(row.first_name ?? "")) === normalizeName(firstName) &&
        normalizeName(String(row.last_name ?? "")) === normalizeName(lastName),
    );

    // Message identique dans tous les cas : on n'indique jamais quel champ
    // est faux (pas d'énumération de comptes).
    const invalid = () => res.status(401).json({ error: "معلومات تسجيل الدخول غير صحيحة." });

    if (!user) return invalid();
    if (!user.is_active) {
      return res.status(403).json({ error: "هذا الحساب معطّل. تواصل مع المسؤول." });
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const minutes = Math.max(1, Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60_000));
      return res.status(423).json({ error: `الحساب مقفل مؤقتًا. أعد المحاولة بعد ${minutes} دقيقة.` });
    }

    const [passwordOk, pinOk] = await Promise.all([
      bcrypt.compare(password, String(user.password_hash ?? "")),
      bcrypt.compare(pin, String(user.pin_hash ?? "")),
    ]);

    if (!passwordOk || !pinOk) {
      const attempts = Number(user.failed_attempts ?? 0) + 1;
      const update: Record<string, unknown> = { failed_attempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
        update.failed_attempts = 0;
      }
      await supabaseAdmin.from(TABLE).update(update).eq("id", user.id);

      if (attempts >= MAX_ATTEMPTS) {
        return res.status(423).json({
          error: `تم قفل الحساب مؤقتًا بعد ${MAX_ATTEMPTS} محاولات. أعد المحاولة بعد ${LOCK_MINUTES} دقيقة.`,
        });
      }
      return invalid();
    }

    await supabaseAdmin
      .from(TABLE)
      .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    const token = issueRapportToken(String(user.id), String(user.role ?? "chef"));

    return res.json({
      token,
      expiresInDays: RAPPORT_SESSION_DAYS,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        birthDate: user.birth_date,
        role: user.role ?? "chef",
      },
    });
  } catch (error) {
    console.error("[auth] login:", error);
    return res.status(500).json({ error: "تعذر الاتصال بالخادم. حاول لاحقًا." });
  }
});

/** Profil du compte connecté (vérifie que la session est toujours valide). */
router.get("/me", requireRapportAuth, async (req: Request, res: Response) => {
  noStore(res);
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("id, first_name, last_name, birth_date, role, is_active, last_login_at")
      .eq("id", req.rapport_user!.sub)
      .maybeSingle();

    if (error) {
      console.error("[auth] me:", error.message);
      return res.status(500).json({ error: "تعذر تحميل الحساب." });
    }
    if (!data || !data.is_active) {
      return res.status(401).json({ error: "الحساب غير متاح." });
    }

    return res.json({
      user: {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        birthDate: data.birth_date,
        role: data.role ?? "chef",
      },
    });
  } catch (error) {
    console.error("[auth] me:", error);
    return res.status(500).json({ error: "تعذر تحميل الحساب." });
  }
});

export default router;
