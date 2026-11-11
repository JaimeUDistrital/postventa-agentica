"use client";
/**
 * Preferencias del visitante en localStorage (solo comodidad, T20/T22). Se leen con
 * `useSyncExternalStore`: en el servidor y al hidratar valen `porDefecto` (sin desajustes)
 * y luego la guardada. Si el navegador bloquea el almacenamiento, viven en memoria durante la visita.
 */
import { useSyncExternalStore } from "react";

export function crearPreferencia<T extends string>(clave: string, porDefecto: T, validos: readonly T[]) {
  const avisos = new Set<() => void>();
  let enMemoria = porDefecto;
  const leer = (): T => {
    try {
      const v = window.localStorage.getItem(clave);
      return validos.find((x) => x === v) ?? porDefecto;
    } catch {
      return enMemoria;
    }
  };
  const guardar = (v: T): void => {
    enMemoria = v;
    try {
      window.localStorage.setItem(clave, v);
    } catch {
      /* localStorage no disponible */
    }
    avisos.forEach((avisar) => avisar());
  };
  const suscribir = (avisar: () => void) => {
    avisos.add(avisar);
    return () => {
      avisos.delete(avisar);
    };
  };
  const servidor = (): T => porDefecto;
  return function usePreferencia(): [T, (v: T) => void] {
    return [useSyncExternalStore(suscribir, leer, servidor), guardar];
  };
}
