/**
 * Saludos y cortesías ("hola", "gracias", "¿quién eres?"). No son preguntas sobre los apuntes:
 * se responden al instante, sin buscar, sin IA y sin gastar la cuota de preguntas. Solo se
 * reconocen mensajes cortos que no traen nada más: "hola, ¿qué es una tautología?" sí se busca.
 */
export type SmallTalk = 'greeting' | 'thanks' | 'identity' | 'farewell';

/** Un saludo es un mensaje hecho solo de estas palabras ("hola", "hola, ¿qué tal?", "buenas tardes"). */
const GREETING_WORDS = new Set(
  (
    'hola holi holis ola buenas buenos buen dia dias tardes noches hey hi hello que tal como estas ' +
    'vas hay todo bien saludos'
  ).split(' '),
);
const GREETING_STARTERS = new Set(
  'hola holi holis ola buenas buenos buen hey hi hello saludos'.split(' '),
);
const THANKS =
  /^((muchas|mil) )?gracias( (illari|amigo|amiga|crack))?$|^(ok|okey|vale|genial|perfecto|listo|entendido)( gracias)?$|^thanks?( you)?$|^thank you$/u;
const IDENTITY =
  /^(quien eres|que eres|como te llamas|que puedes hacer|que haces|para que sirves|como funcionas|who are you|what are you|what can you do)$/u;
const FAREWELL = /^(chao|chau|adios|hasta luego|hasta manana|nos vemos|bye|goodbye|see you)$/u;
const NAMES = /\b(illari|mascota|llama)\b/gu;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(NAMES, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function detectSmallTalk(question: string): SmallTalk | null {
  const text = normalize(question);
  if (text.length === 0 || text.split(' ').length > 6) return null;
  const words = text.split(' ');
  if (GREETING_STARTERS.has(words[0] ?? '') && words.every((w) => GREETING_WORDS.has(w))) {
    return 'greeting';
  }
  if (text === 'que tal' || text === 'como estas') return 'greeting';
  if (THANKS.test(text)) return 'thanks';
  if (IDENTITY.test(text)) return 'identity';
  if (FAREWELL.test(text)) return 'farewell';
  return null;
}
