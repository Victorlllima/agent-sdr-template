/**
 * Esqueleto do loop principal do agente SDR. Liga os guardrails do core
 * (anti-loop, debounce, confirmação dupla, controle de IA, cache de prompt,
 * extração de registro) ao fluxo específico de qualificação/venda.
 *
 * TODO antes de usar em produção:
 *  - Preencher PROMPT_FIXO com a persona e o roteiro reais do cliente.
 *  - Implementar o adaptador de canal (WhatsApp) — este arquivo não assume
 *    Evolution, Uzapi, Cloud API oficial nem nenhum provedor específico.
 *  - Trocar CrmConsole por um CrmAdapter real.
 *  - Trocar MemoriaEmProcesso por um SessionStore persistente.
 *  - Em grupo: troque DiarioGrupoEmProcesso por persistência real e preencha
 *    NOMES_DO_AGENTE / IDS_DO_AGENTE (ver receberMensagemDeGrupo).
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AntiLoop,
  ContextoGrupo,
  DebounceConversa,
  DiarioGrupoEmProcesso,
  IaControl,
  MemoriaEmProcesso,
  deveFicarEmSilencio,
  deveResponder,
  extrairRegistros,
  fundirEstado,
  montarSystemCacheado,
  removerRegistros,
} from "@genixtech/agent-core";
import { avancarEtapa, etapaInicial } from "./spiced.js";
import { CrmConsole } from "./crm.js";
import type { Lead, EstadoLead } from "./tipos.js";

// TODO: mova pra variável de ambiente / arquivo de config por cliente.
const PROMPT_FIXO = `Você é um SDR qualificando leads. Use [[REGISTRO: campo = valor]] pra
registrar situacao, dor, impacto, evento_critico e decisao conforme descobre cada um.
TODO: substitua por o roteiro real do produto.`;

const anthropic = new Anthropic();
const antiLoop = new AntiLoop();
const iaControl = new IaControl();
const memoria = new MemoriaEmProcesso();
const crm = new CrmConsole();
const estadosPorConversa = new Map<string, EstadoLead>();

// Grupo: responde só quando marcado, mas lê tudo desde a última leitura.
// TODO: troque por persistência real (tabela por tenant+grupo, ou JSONL).
const contextoGrupo = new ContextoGrupo(new DiarioGrupoEmProcesso());
// TODO: nome(s) pelo qual o grupo chama o agente e os ids dele no canal (JID/LID).
const NOMES_DO_AGENTE: (string | RegExp)[] = ["Assistente"];
const IDS_DO_AGENTE: string[] = [];

/**
 * @param contextoExtra bloco que o modelo vê junto da mensagem neste turno
 *   (ex.: o diff do grupo), mas que NÃO vai para o histórico salvo — senão o
 *   histórico repete a conversa do grupo a cada menção.
 */
async function processarMensagem(
  lead: Lead,
  messageId: string,
  texto: string,
  contextoExtra?: string,
): Promise<string | null> {
  const decisao = antiLoop.avaliar(lead.telefone, messageId);
  if (!decisao.aceitar) return null;

  if (iaControl.estaSuspensa(lead.conversaId)) return null;

  const estado = estadosPorConversa.get(lead.conversaId) ?? etapaInicial();

  if (deveFicarEmSilencio(estado.etapa === "fechamento", texto)) return null;

  const historico = await memoria.carregar({ tenantId: lead.tenantId, conversaId: lead.conversaId });
  const system = montarSystemCacheado({
    fixo: PROMPT_FIXO,
    variavel: `Etapa atual: ${estado.etapa}. Campos já descobertos: ${JSON.stringify(estado.campos)}.`,
  });

  const resposta = await anthropic.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    system,
    messages: [
      ...historico,
      { role: "user", content: contextoExtra ? `${contextoExtra}\n\n[Mensagem que te acionou]\n${texto}` : texto },
    ],
  });

  const textoResposta = resposta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const registros = extrairRegistros(textoResposta);
  const novoEstado = avancarEtapa({ ...estado, campos: fundirEstado(estado.campos, registros) });
  estadosPorConversa.set(lead.conversaId, novoEstado);

  await crm.upsertLead({ lead, campos: novoEstado.campos, etapa: novoEstado.etapa });

  const textoFinal = removerRegistros(textoResposta);
  await memoria.salvar(
    { tenantId: lead.tenantId, conversaId: lead.conversaId },
    [...historico, { role: "user", content: texto }, { role: "assistant", content: textoResposta }],
  );

  return textoFinal;
}

export interface MensagemDeGrupoRecebida {
  grupoId: string;
  messageId: string;
  /** Texto, ou a transcrição do áudio. */
  texto: string;
  /** JIDs marcados com @ na mensagem. */
  mencionados?: string[];
  /** true se é resposta (citação) a uma mensagem do agente. */
  respondendoAoAgente?: boolean;
  midia?: string;
  citando?: string;
}

/**
 * Chame para TODA mensagem que chegar num grupo — não só as que marcam o
 * agente. Todas entram no diário; só as que chamam o agente geram resposta,
 * e essa resposta vê tudo o que foi dito desde a última leitura.
 *
 * O grupo inteiro compartilha uma sessão e um estado SPICED (conversaId =
 * grupoId): ex. grupo de compra com sócios, onde a decisão é coletiva.
 */
async function receberMensagemDeGrupo(lead: Lead, msg: MensagemDeGrupoRecebida): Promise<string | null> {
  const chave = { tenantId: lead.tenantId, grupoId: msg.grupoId };
  await contextoGrupo.registrar(chave, {
    id: msg.messageId,
    autor: lead.nome ?? lead.telefone,
    texto: msg.texto,
    midia: msg.midia,
    citando: msg.citando,
  });

  const chamado = deveResponder({
    texto: msg.texto,
    mencionados: msg.mencionados,
    idsAgente: IDS_DO_AGENTE,
    respondendoAoAgente: msg.respondendoAoAgente,
    padroes: NOMES_DO_AGENTE,
  });
  if (!chamado) return null;

  const leitura = await contextoGrupo.lerDesdeUltimaLeitura(chave);
  const resposta = await processarMensagem({ ...lead, conversaId: msg.grupoId }, msg.messageId, msg.texto, leitura.contexto);

  // O agente precisa ver o que ele mesmo já disse na próxima leitura.
  if (resposta) await contextoGrupo.registrar(chave, { autor: "agente", texto: resposta, doAgente: true });
  return resposta;
}

// TODO: substitua por um webhook real (Express/Fastify) recebendo eventos do
// provedor de WhatsApp. Este debounce é só pra ilustrar a ligação com o core.
const debounce = new DebounceConversa(async (conversaId: string, mensagemJunta: string) => {
  console.log(`[agente] processar conversa ${conversaId}:`, mensagemJunta);
  // const resposta = await processarMensagem(lead, messageId, mensagemJunta);
  // TODO: enviar `resposta` de volta pelo provedor de WhatsApp.
});

export { processarMensagem, receberMensagemDeGrupo, debounce };
