/**
 * Cooldown flexible de subidas: evita la subida masiva sin castigar a quien
 * aporta con buena fe. Es "flexible" porque cada cuenta tiene su propio
 * cooldown en minutos (User.uploadCooldownMinutes, default 10), ajustable
 * por administración sin reimplementar nada.
 */

export const DEFAULT_UPLOAD_COOLDOWN_MINUTES = 10;

export interface CooldownDecision {
  allowed: boolean;
  /** Segundos que faltan para poder subir de nuevo (0 si allowed). */
  retryAfterSeconds: number;
  cooldownMinutes: number;
}

export function checkUploadCooldown(
  lastUploadAt: Date | null,
  cooldownMinutes: number,
  now: Date = new Date()
): CooldownDecision {
  const effectiveCooldown = Number.isFinite(cooldownMinutes)
    ? Math.max(1, Math.floor(cooldownMinutes))
    : DEFAULT_UPLOAD_COOLDOWN_MINUTES;

  if (!lastUploadAt) {
    return { allowed: true, retryAfterSeconds: 0, cooldownMinutes: effectiveCooldown };
  }

  const elapsedMs = now.getTime() - lastUploadAt.getTime();
  const cooldownMs = effectiveCooldown * 60 * 1000;

  if (elapsedMs >= cooldownMs) {
    return { allowed: true, retryAfterSeconds: 0, cooldownMinutes: effectiveCooldown };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((cooldownMs - elapsedMs) / 1000),
    cooldownMinutes: effectiveCooldown
  };
}
