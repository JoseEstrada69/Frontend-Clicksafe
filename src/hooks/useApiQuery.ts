'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from 'react';
import { toApiError, type ApiError } from '@/lib/errors';

export type QueryStatus = 'loading' | 'success' | 'empty' | 'error';

export interface ApiQuery<T> {
  status: QueryStatus;
  data: T | undefined;
  error: ApiError | undefined;
  reload: () => void;
}

interface Options<T> {
  /** Si devuelve true con los datos recibidos, el estado es 'empty'. */
  isEmpty?: (data: T) => boolean;
}

type State<T> = {
  status: QueryStatus;
  data?: T;
  error?: ApiError;
};

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}

/**
 * Pide datos a la API y expone cargando / contenido / vacío / error
 * (CLAUDE.md 8.2). Vuelve a pedir cuando cambian `deps` o al llamar a
 * `reload()`, y cancela la petición en curso (AbortController) al desmontar
 * o al pedir de nuevo, para no escribir datos viejos sobre nuevos.
 */
export function useApiQuery<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: Options<T> = {},
): ApiQuery<T> {
  const [state, setState] = useState<State<T>>({ status: 'loading' });
  // Cada pedido nuevo incrementa la versión; el efecto depende solo de ella
  const [version, setVersion] = useState(0);
  const [prevDeps, setPrevDeps] = useState(deps);

  // Si cambiaron los deps, se marca "cargando" durante el render (patrón de
  // React para ajustar estado cuando cambian las props).
  if (!sameDeps(prevDeps, deps)) {
    setPrevDeps(deps);
    setVersion((v) => v + 1);
    setState({ status: 'loading' });
  }

  // La función y las opciones más recientes, sin volver a disparar el efecto
  const latest = useRef({ fn, options });
  useEffect(() => {
    latest.current = { fn, options };
  });

  useEffect(() => {
    const controller = new AbortController();
    latest.current
      .fn(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const empty = latest.current.options.isEmpty?.(data) ?? false;
        setState({ status: empty ? 'empty' : 'success', data });
      })
      .catch((e: unknown) => {
        const error = toApiError(e);
        if (controller.signal.aborted || error.canceled) return;
        setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [version]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setVersion((v) => v + 1);
  }, []);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    reload,
  };
}
