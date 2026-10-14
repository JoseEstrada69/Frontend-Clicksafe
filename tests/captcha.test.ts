import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { encodeCaptchaPayload, withCaptcha } from '@/lib/captcha';
import { solveChallenge } from '@/lib/captcha-solver';
import { ApiError } from '@/lib/errors';
import type { CaptchaChallenge } from '@/lib/types';

// Reto como lo arma el backend: SHA-256(salt + número secreto)
function buildChallenge(secret: number, maxnumber = 5_000): CaptchaChallenge {
  const salt = '0123456789abcdef01234567?expires=9999999999';
  return {
    algorithm: 'SHA-256',
    challenge: createHash('sha256').update(salt + String(secret)).digest('hex'),
    maxnumber,
    salt,
    signature: 'f'.repeat(64),
  };
}

describe('captcha-solver.ts', () => {
  it('encuentra el número que produce el hash del reto', async () => {
    const solution = await solveChallenge(buildChallenge(1234));
    expect(solution?.number).toBe(1234);
    expect(solution?.took).toBeGreaterThanOrEqual(0);
  });

  it('encuentra soluciones en los extremos del rango (0 y maxnumber)', async () => {
    expect((await solveChallenge(buildChallenge(0, 50)))?.number).toBe(0);
    expect((await solveChallenge(buildChallenge(50, 50)))?.number).toBe(50);
  });

  it('sin solución dentro de maxnumber → null', async () => {
    expect(await solveChallenge(buildChallenge(3_000, 2_000))).toBeNull();
  });

  it('rechaza algoritmos distintos de SHA-256 y rangos absurdos', async () => {
    expect(
      await solveChallenge({ ...buildChallenge(1), algorithm: 'MD5' }),
    ).toBeNull();
    expect(
      await solveChallenge({ ...buildChallenge(1), maxnumber: 1e12 }),
    ).toBeNull();
  });
});

describe('captcha.ts', () => {
  it('arma el payload: JSON con los campos del reto + number + took, en Base64', () => {
    const challenge = buildChallenge(42);
    const payload = encodeCaptchaPayload(challenge, { number: 42, took: 17 });

    expect(JSON.parse(atob(payload))).toEqual({
      algorithm: 'SHA-256',
      challenge: challenge.challenge,
      number: 42,
      salt: challenge.salt,
      signature: challenge.signature,
      took: 17,
    });
  });

  it('si el servidor responde CAPTCHA_INVALID, reintenta UNA vez con un reto nuevo', async () => {
    const solve = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('reto-1')
      .mockResolvedValueOnce('reto-2');
    const send = vi
      .fn<(captcha: string) => Promise<string>>()
      .mockRejectedValueOnce(new ApiError({ status: 400, code: 'CAPTCHA_INVALID' }))
      .mockResolvedValueOnce('ok');

    await expect(withCaptcha(send, {}, solve)).resolves.toBe('ok');
    expect(solve).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([captcha]) => captcha)).toEqual(['reto-1', 'reto-2']);
  });

  it('no reintenta una segunda vez', async () => {
    const solve = vi.fn<() => Promise<string>>().mockResolvedValue('reto');
    const send = vi
      .fn<(captcha: string) => Promise<string>>()
      .mockRejectedValue(new ApiError({ status: 400, code: 'CAPTCHA_INVALID' }));

    const error = await withCaptcha(send, {}, solve).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('CAPTCHA_INVALID');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('otros errores no se reintentan', async () => {
    const solve = vi.fn<() => Promise<string>>().mockResolvedValue('reto');
    const send = vi
      .fn<(captcha: string) => Promise<string>>()
      .mockRejectedValue(new ApiError({ status: 401 }));

    await expect(withCaptcha(send, {}, solve)).rejects.toMatchObject({ status: 401 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('avisa cuándo resuelve ("Verificando…") y cuándo envía', async () => {
    const events: string[] = [];
    await withCaptcha(
      async () => events.push('send'),
      {
        onSolving: () => events.push('solving'),
        onSending: () => events.push('sending'),
      },
      async () => 'reto',
    );
    expect(events).toEqual(['solving', 'sending', 'send']);
  });
});
