/**
 * Rastreamento genérico de SPICED (Situação, Dor, Impacto, evento Crítico,
 * Decisão) a partir dos registros que o modelo escreve na resposta — usa o
 * módulo `registro` do core. A regra de qual pergunta falta é expor pro
 * supervisor/revisor o que ainda não foi preenchido, sem virar checklist
 * rígido de perguntas (ver nota abaixo).
 *
 * Generalização do padrão SPICED visto no agente-sdr (Talles).
 */

import type { EstadoLead, EtapaSpiced } from "./tipos.js";

const ORDEM_ETAPAS: EtapaSpiced[] = ["situacao", "dor", "impacto", "evento_critico", "decisao", "fechamento"];

/** Campos esperados por etapa — ajuste pro roteiro do seu produto. */
export const CAMPOS_POR_ETAPA: Record<EtapaSpiced, string[]> = {
  situacao: ["situacao"],
  dor: ["dor"],
  impacto: ["impacto"],
  evento_critico: ["evento_critico"],
  decisao: ["decisao"],
  fechamento: [],
};

export function etapaInicial(): EstadoLead {
  return { etapa: "situacao", campos: {} };
}

/** Quais campos ainda faltam pra fechar o SPICED completo, na ordem do roteiro. */
export function camposFaltantes(estado: EstadoLead): string[] {
  const faltantes: string[] = [];
  for (const etapa of ORDEM_ETAPAS) {
    for (const campo of CAMPOS_POR_ETAPA[etapa]) {
      if (!(campo in estado.campos)) faltantes.push(campo);
    }
  }
  return faltantes;
}

/**
 * Avança a etapa corrente se os campos dela já foram preenchidos. Não pula
 * etapa: um passo de cada vez, igual ao roteiro original ("um passo por
 * turno"). Isto é só uma sugestão de estado — a decisão real de como
 * conduzir a conversa continua sendo do modelo/prompt.
 */
export function avancarEtapa(estado: EstadoLead): EstadoLead {
  const indiceAtual = ORDEM_ETAPAS.indexOf(estado.etapa);
  const camposDaEtapa = CAMPOS_POR_ETAPA[estado.etapa];
  const completa = camposDaEtapa.every((c) => c in estado.campos);
  if (!completa || indiceAtual === ORDEM_ETAPAS.length - 1) return estado;
  return { ...estado, etapa: ORDEM_ETAPAS[indiceAtual + 1] };
}
