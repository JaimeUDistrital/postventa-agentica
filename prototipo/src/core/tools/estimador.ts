import type { Vehicle } from "@/core/contracts";
import { daysBetween } from "./dates";

export const PASO_HITO_KM = 10_000;

export interface EstimacionKm {
  kmEstimado: number;
  proximoHitoKm: number;
  diasParaHito: number;
  enGarantia: boolean;
}

/** Último registro + ritmo diario × días transcurridos hasta `now`. */
export function estimarKm(v: Vehicle, now: string): EstimacionKm {
  const dias = Math.max(0, daysBetween(v.fechaUltimoRegistro, now));
  const kmEstimado = Math.round(v.kmUltimoRegistro + v.kmPromedioDia * dias);
  const proximoHitoKm = (Math.floor(kmEstimado / PASO_HITO_KM) + 1) * PASO_HITO_KM;
  return {
    kmEstimado,
    proximoHitoKm,
    diasParaHito: Math.ceil((proximoHitoKm - kmEstimado) / v.kmPromedioDia),
    enGarantia: now.slice(0, 10) < v.garantiaFabricaHasta,
  };
}
