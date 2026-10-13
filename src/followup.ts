/**
 * Follow-up multi-trilha: a cadência de toques depende de ONDE a conversa
 * parou, não só de quanto tempo passou — generalização do padrão do Bioete
 * (3 trilhas: qualificação incompleta, curiosidade sem orçamento, orçamento
 * pendente; cadência D+1/D+3/D+7/D+15).
 */

export interface Trilha {
  id: string;
  /** Dias após a âncora (último contato) em que cada toque dispara. */
  cadenciaDias: number[];
}

export interface ToqueAgendado {
  trilhaId: string;
  indice: number; // posição na cadência (0 = primeiro toque)
  disparaEm: number; // timestamp
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Gera os toques futuros de uma trilha a partir da âncora (ex: last_agent_ts). */
export function gerarToques(trilha: Trilha, ancoraMs: number): ToqueAgendado[] {
  return trilha.cadenciaDias.map((dias, indice) => ({
    trilhaId: trilha.id,
    indice,
    disparaEm: ancoraMs + dias * MS_POR_DIA,
  }));
}

/** Quais toques já venceram e ainda não foram marcados como enviados. */
export function toquesVencidos(toques: ToqueAgendado[], enviados: Set<number>, agora: number): ToqueAgendado[] {
  return toques.filter((t) => t.disparaEm <= agora && !enviados.has(t.indice));
}

/**
 * O relógio da trilha recomeça quando há troca de verdade (o lead respondeu
 * E o agente respondeu de volta) — não quando o lead manda qualquer coisa
 * sozinho. Decisão de design herdada da Sofia e do agente-sdr original.
 */
export function deveRecomeçar(leadRespondeuDepoisDoUltimoToque: boolean, agenteRespondeuDeVolta: boolean): boolean {
  return leadRespondeuDepoisDoUltimoToque && agenteRespondeuDeVolta;
}

/** Trilhas de exemplo — troque pelos estágios reais do seu funil. */
export const TRILHAS_EXEMPLO: Record<string, Trilha> = {
  qualificacao_incompleta: { id: "qualificacao_incompleta", cadenciaDias: [1, 3, 7, 15] },
  curiosidade_sem_orcamento: { id: "curiosidade_sem_orcamento", cadenciaDias: [3, 10, 30] },
  orcamento_pendente: { id: "orcamento_pendente", cadenciaDias: [1, 2, 5] },
};
