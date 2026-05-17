#!/usr/bin/env node
/**
 * Interactive Gemini chat sample: model proposes DPP tools; Node executes them server-side.
 * Requires GEMINI_API_KEY plus the local wallet + merchant demo stack (see README).
 */
import { GoogleGenAI } from '@google/genai';
import { loadConfigFromEnv, McpPaymentSession } from 'dpp-mcp-payment-tool';
import { DPP_GEMINI_FUNCTION_DECLARATIONS } from '../declarations.js';
import { executeGeminiFunctionCall } from '../executor.js';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Set GEMINI_API_KEY to run the Gemini chat sample.');
  process.exit(1);
}

const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const userId = process.env.DPP_GEMINI_USER_ID ?? 'demo-user-1';
const prompt = process.argv.slice(2).join(' ') || 'Help me link my wallet and preview a $1.00 USD payment.';

const config = loadConfigFromEnv();
const session = new McpPaymentSession(config);
const ai = new GoogleGenAI({ apiKey });

type Content = { role: string; parts: Array<Record<string, unknown>> };

async function runToolLoop(contents: Content[]): Promise<void> {
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      tools: [{ functionDeclarations: DPP_GEMINI_FUNCTION_DECLARATIONS }],
    },
  });

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const functionCalls = parts.filter((p) => 'functionCall' in p && p.functionCall);

  if (functionCalls.length === 0) {
    const text = parts
      .map((p) => ('text' in p && typeof p.text === 'string' ? p.text : ''))
      .join('');
    console.log(text || JSON.stringify(response, null, 2));
    return;
  }

  contents.push({ role: 'model', parts: parts as Array<Record<string, unknown>> });

  const responseParts: Array<Record<string, unknown>> = [];
  for (const part of functionCalls) {
    const fc = (part as { functionCall: { name?: string; args?: Record<string, unknown> } })
      .functionCall;
    const name = fc.name ?? 'unknown';
    const args = { ...fc.args, userId: fc.args?.userId ?? userId };
    const result = await executeGeminiFunctionCall(session, { name, args });
    console.error(`[tool] ${name}`, JSON.stringify(result, null, 2));
    responseParts.push({
      functionResponse: {
        name,
        response: result as Record<string, unknown>,
      },
    });
  }

  contents.push({ role: 'user', parts: responseParts });
  await runToolLoop(contents);
}

const initial: Content[] = [
  {
    role: 'user',
    parts: [
      {
        text: `${prompt}\n\nUse DPP tools only. userId for vault partition: ${userId}. Never ask for or repeat OAuth tokens or capability JWTs.`,
      },
    ],
  },
];

await runToolLoop(initial);
