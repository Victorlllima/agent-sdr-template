/**
 * Tipos compartilhados do template SDR. Ajuste os campos conforme o produto
 * de cada cliente — isto é só o esqueleto.
 */

export interface Lead {
  tenantId: string;
  conversaId: string;
  telefone: string;
  nome?: string;
  origem?: string; // ex: "instagram:post123", "trafego_pago:campanha_x"
}

/** As 5 letras do SPICED: situação, dor, impacto, evento crítico, decisão. */
export type EtapaSpiced = "situacao" | "dor" | "impacto" | "evento_critico" | "decisao" | "fechamento";

export interface EstadoLead {
  etapa: EtapaSpiced;
  campos: Record<string, string>; // preenchido via extrairRegistros/fundirEstado do core
  oferta?: string; // qual produto/plano está sendo discutido, se houver mais de um
}
