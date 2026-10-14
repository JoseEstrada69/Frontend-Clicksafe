import { describe, expect, it } from 'vitest';
import { groupSecret, safeQrDataUrl, totpSecretFromUri } from '@/lib/mfa-setup';
import { isEmail, passwordProblem } from '@/lib/password';

describe('mfa-setup.ts', () => {
  it('acepta solo un QR PNG en Base64', () => {
    const ok = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    expect(safeQrDataUrl(ok)).toBe(ok);
    expect(safeQrDataUrl('javascript:alert(1)')).toBeNull();
    expect(safeQrDataUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeQrDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(safeQrDataUrl('https://evil.example/qr.png')).toBeNull();
  });

  it('extrae la clave Base32 de la URI otpauth', () => {
    expect(
      totpSecretFromUri(
        'otpauth://totp/ClickSafe:a%40b.mx?secret=JBSWY3DPEHPK3PXP&issuer=ClickSafe',
      ),
    ).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rechaza URIs que no son otpauth o claves con caracteres raros', () => {
    expect(totpSecretFromUri('https://evil.example/?secret=JBSWY3DPEHPK3PXP')).toBeNull();
    expect(totpSecretFromUri('otpauth://totp/x?secret=<script>')).toBeNull();
    expect(totpSecretFromUri('no es una url')).toBeNull();
  });

  it('agrupa la clave de 4 en 4', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
  });
});

describe('password.ts', () => {
  it('exige de 8 a 128 caracteres y nada más (sin reglas de símbolos)', () => {
    expect(passwordProblem('1234567')).toBeTruthy();
    expect(passwordProblem('ochoocho')).toBeUndefined();
    expect(passwordProblem('a'.repeat(128))).toBeUndefined();
    expect(passwordProblem('a'.repeat(129))).toBeTruthy();
  });

  it('valida la forma del correo', () => {
    expect(isEmail('admin@clicksafe.mx')).toBe(true);
    expect(isEmail('sin-arroba')).toBe(false);
    expect(isEmail(`${'a'.repeat(250)}@b.mx`)).toBe(false);
  });
});
