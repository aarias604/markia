// =====================================================================
// Markia · Datos legales del negocio
// Aparecen en todas las páginas legales y en el pie de página.
// =====================================================================

export const LEGAL = {
  marca: "Markia",
  razonSocial: "SOLUCIONES INNOVADORAS PA",
  ruc: "8-1017-329 DV 44",
  avisoOperacion: "8-1017-329-2026-574458179",
  direccion: "Juan Diaz, Ciudad de Panamá, República de Panamá",
  correoSoporte: "hola@markiapa.com",
  correoPrivacidad: "hola@markiapa.com",
  telefono: "+507 6434-2146",
  sitio: "https://markiapa.com",
  /** Cámbiala cada vez que modifiques un documento legal. */
  version: "2026-11-09",
  actualizado: "9 de noviembre de 2026",
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
