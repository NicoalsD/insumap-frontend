import { http, HttpResponse } from 'msw';
import type { AssistantReplyDto } from '@/services/dto/assistant';
import { apiUrl } from '@/services/http/apiUrl';
import { apiError, readBody, validationError } from '../http';
import type { MockState } from '../MockState';
import { guard } from './guard';

const FALLBACK_MESSAGE_MAX = 500;
const DOSE_QUESTION = /dosis|unidades|cu[aá]nta insulina|cu[aá]ntas unidades|ajustar (mi )?insulina|subir (mi )?insulina|bajar (mi )?insulina/i;
const ALARM_SIGNS = /desmayo|convulsi|no despierta|inconsciente|no puedo respirar|dolor de pecho|vomito sin parar|vómito sin parar|confusi[oó]n/i;
const DOCTOR_SIGNS = /mare(o|ado)|sudor|temblor|me siento mal|s[ií]ntoma/i;
const ROTATION = /rotar|rotaci[oó]n|sitio|inyect/i;
const LOW_SUGAR = /hipoglucemia|az[uú]car baja|glucosa baja/i;
const RANGE = /tiempo en rango/i;

/** Educational replies from approved material. Mirrors the guardrails of IA6 for the MSW mock. */
export function answerQuestion(question: string): AssistantReplyDto {
  if (ALARM_SIGNS.test(question)) {
    return {
      reply_text:
        'Tus síntomas pueden ser una emergencia. Llama a tu línea de urgencias ahora. También avisamos a tu equipo de atención.',
      citations: [],
      escalation: 'EMERGENCY',
      is_fallback: false,
    };
  }
  if (DOSE_QUESTION.test(question)) {
    return {
      reply_text:
        'Eso lo define tu médico. Este asistente no indica dosis ni cambios de insulina. Escríbele desde Mensajes.',
      citations: [],
      escalation: 'NONE',
      is_fallback: false,
    };
  }
  if (DOCTOR_SIGNS.test(question)) {
    return {
      reply_text:
        'Lo que describes necesita a tu médico. Escríbele hoy desde Mensajes; si empeora, llama a tu línea de urgencias.',
      citations: [],
      escalation: 'CONTACT_DOCTOR',
      is_fallback: false,
    };
  }
  if (LOW_SUGAR.test(question)) {
    return {
      reply_text:
        'Si tu glucosa está baja, sigue el plan que te dio tu médico para la hipoglucemia y mide de nuevo. Si no mejora, pide ayuda.',
      citations: [{ title: 'Guía de hipoglucemia de tu clínica' }],
      escalation: 'NONE',
      is_fallback: false,
    };
  }
  if (ROTATION.test(question)) {
    return {
      reply_text:
        'Rota los sitios de inyección: usa un punto distinto cada vez y alterna izquierda y derecha. Así evitas engrosar la piel.',
      citations: [{ title: 'Guía de rotación de sitios de inyección' }],
      escalation: 'NONE',
      is_fallback: false,
    };
  }
  if (RANGE.test(question)) {
    return {
      reply_text:
        'El tiempo en rango es la parte del día en la que tu glucosa está dentro de tu rango objetivo. Tu equipo define ese rango.',
      citations: [{ title: 'Explicación de tiempo en rango' }],
      escalation: 'NONE',
      is_fallback: false,
    };
  }
  return {
    reply_text:
      'No tengo material aprobado sobre eso. Escribe a tu equipo de atención desde Mensajes para una respuesta personal.',
    citations: [],
    escalation: 'NONE',
    is_fallback: false,
  };
}

/** `POST /assistant/messages` for the patient. The answer is plain text and never carries doses. */
export function assistantHandlers(state: MockState) {
  return [
    http.post(apiUrl('/assistant/messages'), async ({ request }) => {
      const result = guard(state, request);
      if ('response' in result) return result.response;
      if (result.account.role !== 'PATIENT') return apiError('FORBIDDEN');
      const body = await readBody(request);
      const message = typeof body?.['message'] === 'string' ? body['message'].trim() : '';
      const max = state.limits['assistant_message_max_length'] ?? state.limits['message_max_length'] ?? FALLBACK_MESSAGE_MAX;
      if (message === '' || message.length > max) {
        return validationError([{ field: 'body.message', type: 'string' }]);
      }
      return HttpResponse.json(answerQuestion(message));
    }),
  ];
}
