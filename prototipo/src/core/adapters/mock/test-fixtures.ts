/** Datos mínimos de prueba (propios de T03; no dependen de @/core/data). Solo para tests. */
import type { Fixtures } from "@/core/contracts";

export const testFixtures = (): Fixtures => ({
  owners: [
    {
      id: "o1",
      nombre: "Laura Gómez",
      cedula: "1020304050",
      celular: "3001234567",
      email: "laura@example.com",
      ciudad: "Bogotá",
      consentimientos: [{ canal: "whatsapp", optIn: true, fecha: "2025-01-10", finalidad: "mantenimiento" }],
      contactosUltimos30Dias: 1,
    },
  ],
  vehicles: [
    {
      id: "v_cx30",
      ownerId: "o1",
      placa: "ABC123",
      marca: "Mazda",
      modelo: "CX-30",
      anio: 2023,
      fechaEntrega: "2023-03-01",
      kmUltimoRegistro: 8000,
      fechaUltimoRegistro: "2026-10-12",
      kmPromedioDia: 50,
      garantiaFabricaHasta: "2028-03-01",
      vencimientoSoat: "2026-12-01",
      vencimientoPoliza: null,
    },
    {
      id: "v_duster",
      ownerId: "o1",
      placa: "XYZ987",
      marca: "Renault",
      modelo: "Duster",
      anio: 2020,
      fechaEntrega: "2020-03-01",
      kmUltimoRegistro: 19000,
      fechaUltimoRegistro: "2026-11-02",
      kmPromedioDia: 40,
      garantiaFabricaHasta: "2025-03-01",
      vencimientoSoat: "2026-11-02",
      vencimientoPoliza: "2027-01-15",
    },
  ],
  serviceHistory: [
    { id: "s1", vehicleId: "v_cx30", fecha: "2026-05-01", km: 5000, servicio: "Revisión 5.000", enAgencia: true, valorUsd: 90 },
  ],
  parts: [
    { sku: "P-ACE", descripcion: "Aceite 5W30", compatibles: ["Mazda CX-30"], stock: 10, precioUsd: 20, fechaReposicion: null },
    { sku: "P-FIL", descripcion: "Filtro de aceite", compatibles: ["Mazda CX-30"], stock: 5, precioUsd: 10, fechaReposicion: null },
    { sku: "P-PAS", descripcion: "Pastillas de freno", compatibles: ["Mazda CX-30"], stock: 4, precioUsd: 40, fechaReposicion: null },
    { sku: "P-BAT", descripcion: "Batería", compatibles: ["Renault Duster"], stock: 0, precioUsd: 80, fechaReposicion: "2026-11-20" },
  ],
  tariffs: [
    { id: "t_cx30_10000", modelo: "Mazda CX-30", hitoKm: 10000, descripcion: "Mantenimiento 10.000 km", manoObraUsd: 30, repuestos: [{ sku: "P-ACE", cantidad: 2 }, { sku: "P-FIL", cantidad: 1 }], duracionHoras: 2, esVentaCruzada: false },
    { id: "t_duster_20000", modelo: "Renault Duster", hitoKm: 20000, descripcion: "Mantenimiento 20.000 km", manoObraUsd: 50, repuestos: [{ sku: "P-BAT", cantidad: 1 }], duracionHoras: 3, esVentaCruzada: false },
    { id: "t_frenos", modelo: "Mazda CX-30", hitoKm: 10000, descripcion: "Cambio de pastillas", manoObraUsd: 25, repuestos: [{ sku: "P-PAS", cantidad: 1 }], duracionHoras: 1, esVentaCruzada: true },
    { id: "t_alineacion", modelo: "*", hitoKm: 10000, descripcion: "Alineación y balanceo", manoObraUsd: 35, repuestos: [], duracionHoras: 1, esVentaCruzada: true },
  ],
  bays: [
    { id: "b1", bahia: 1, inicio: "2026-11-12T08:00", fin: "2026-11-12T10:00", disponible: true, franja: "pico" },
    { id: "b2", bahia: 1, inicio: "2026-11-12T10:00", fin: "2026-11-12T12:00", disponible: true, franja: "valle" },
    { id: "b3", bahia: 2, inicio: "2026-11-12T14:00", fin: "2026-11-12T16:00", disponible: false, franja: "valle" },
    { id: "b4", bahia: 1, inicio: "2026-11-13T10:00", fin: "2026-11-13T12:00", disponible: true, franja: "valle" },
    { id: "b5", bahia: 1, inicio: "2026-11-23T10:00", fin: "2026-11-23T12:00", disponible: true, franja: "valle" },
    { id: "b6", bahia: 2, inicio: "2026-11-24T10:00", fin: "2026-11-24T12:00", disponible: true, franja: "valle" },
    { id: "b7", bahia: 1, inicio: "2026-11-25T10:00", fin: "2026-11-25T12:00", disponible: true, franja: "valle" },
    { id: "b8", bahia: 1, inicio: "2026-11-26T10:00", fin: "2026-11-26T12:00", disponible: true, franja: "valle" },
  ],
  insurers: [
    { id: "i1", aseguradora: "Aliada Seguros", producto: "SOAT", primaAnualUsd: 120, coberturaResumen: "SOAT obligatorio", comisionAgenciaUsd: 6 },
    { id: "i2", aseguradora: "Aliada Protección", producto: "Todo riesgo", primaAnualUsd: 900, coberturaResumen: "Cobertura total", comisionAgenciaUsd: 45 },
  ],
  scenarios: [],
});
