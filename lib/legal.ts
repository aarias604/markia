// =====================================================================
// Markia · Datos legales del negocio
// ⚠️ COMPLETA ESTOS DATOS antes de lanzar. Aparecen en todas las páginas
// legales y en el pie de página. Lo que está entre [corchetes] falta.
// =====================================================================

export const LEGAL = {
  marca: "Markia",
  razonSocial: "Adrian Arias",
  ruc: "[RUC] DV [00]",
  avisoOperacion: "[Número de Aviso de Operación]",
  direccion: "Juan Diaz, Ciudad de Panamá, República de Panamá",
  correoSoporte: "[hola@markiapa.com]",
  correoPrivacidad: "[hola@markiapa.com]",
  telefono: "[+507 6434-2146]",
  sitio: "https://markiapa.com",
  /** Cámbiala cada vez que modifiques un documento legal. */
  version: "2026-11-05",
  actualizado: "5 de noviembre de 2026",
} as const;

// Reglas del negocio que aparecen en los documentos (mantener igual que en la base de datos).
export const REGLAS = {
  avisoDias: 5,
  graciaDias: 30,
  descuentoReactivacion: 35,
  referidoPorcentaje: 10,
  referidoEsperaDias: 15,
  retiroMinimo: "25.00",
  reembolsoDias: 7,
  pagoRetiroDiasHabiles: 10,
} as const;
