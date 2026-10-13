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
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  AntiLoop,
  DebounceConversa,
  IaControl,
  MemoriaEmProcesso,
  deveFicarEmSilencio,
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

async function processarMensagem(lead: Lead, messageId: string, texto: string): Promise<string | null> {
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
    messages: [...historico, { role: "user", content: texto }],
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

// TODO: substitua por um webhook real (Express/Fastify) recebendo eventos do
// provedor de WhatsApp. Este debounce é só pra ilustrar a ligação com o core.
const debounce = new DebounceConversa(async (conversaId: string, mensagemJunta: string) => {
  console.log(`[agente] processar conversa ${conversaId}:`, mensagemJunta);
  // const resposta = await processarMensagem(lead, messageId, mensagemJunta);
  // TODO: enviar `resposta` de volta pelo provedor de WhatsApp.
});

export { processarMensagem, debounce };
