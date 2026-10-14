import { solveChallenge } from './captcha-solver';
import type { CaptchaChallenge } from './types';

// Web Worker: resuelve el captcha en otro hilo para que la página no se
// congele mientras se calculan miles de hashes. Responde la solución o null.

self.onmessage = (event: MessageEvent<CaptchaChallenge>) => {
  solveChallenge(event.data)
    .catch(() => null)
    .then((solution) => self.postMessage(solution));
};
