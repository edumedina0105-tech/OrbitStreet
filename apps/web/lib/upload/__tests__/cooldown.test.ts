import { describe, expect, it } from 'vitest';
import { checkUploadCooldown, DEFAULT_UPLOAD_COOLDOWN_MINUTES } from '../cooldown';

const NOW = new Date('2026-11-15T12:00:00Z');

describe('checkUploadCooldown (anti-subida-masiva)', () => {
  it('sin subidas previas → permitido', () => {
    const decision = checkUploadCooldown(null, 10, NOW);
    expect(decision.allowed).toBe(true);
    expect(decision.retryAfterSeconds).toBe(0);
  });

  it('subida hace 5 min con cooldown de 10 → bloqueado, reintenta en ~300 s', () => {
    const last = new Date('2026-11-15T11:55:00Z'); // 5 minutos atrás
    const decision = checkUploadCooldown(last, 10, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(300);
  });

  it('subida hace 11 min con cooldown de 10 → permitido', () => {
    const last = new Date('2026-11-15T11:49:00Z'); // 11 minutos atrás
    const decision = checkUploadCooldown(last, 10, NOW);
    expect(decision.allowed).toBe(true);
  });

  it('cooldown flexible: la misma antigüedad pasa con cooldown menor', () => {
    const last = new Date('2026-11-15T11:55:00Z'); // 5 minutos atrás
    expect(checkUploadCooldown(last, 10, NOW).allowed).toBe(false);
    expect(checkUploadCooldown(last, 5, NOW).allowed).toBe(true);
    // Y viceversa: una cuenta con cooldown 60 sigue bloqueada.
    expect(checkUploadCooldown(last, 60, NOW).allowed).toBe(false);
    expect(checkUploadCooldown(last, 60, NOW).retryAfterSeconds).toBe(3300);
  });

  it('cooldown inválido o menor a 1 → usa el default seguro', () => {
    expect(checkUploadCooldown(null, Number.NaN, NOW).cooldownMinutes).toBe(
      DEFAULT_UPLOAD_COOLDOWN_MINUTES
    );
    expect(checkUploadCooldown(new Date('2026-11-15T11:59:59Z'), 0, NOW).cooldownMinutes).toBe(1);
  });
});
