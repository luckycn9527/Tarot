import { env } from '../config/env.js';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly safeMessage = '灵感通道暂时繁忙，请稍后再试',
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

export function isAiServiceError(err: unknown): err is AiServiceError {
  return err instanceof AiServiceError;
}

export async function callDeepSeek(
  messages: DeepSeekMessage[],
  timeout = 30000,
  maxTokens = 1024
): Promise<string> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new AiServiceError('DeepSeek API Key 未配置');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.8,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = (await response.clone().json()) as {
          error?: { message?: string; type?: string; code?: string };
        };
        const m = errJson?.error?.message;
        if (m) detail = `（${m}）`;
      } catch {
        try {
          const t = await response.text();
          if (t && t.length < 500) detail = `（${t}）`;
        } catch {
          /* ignore */
        }
      }

      if (response.status === 401) {
        throw new AiServiceError(
          `DeepSeek 鉴权失败(401)：API Key 无效、已作废或写错。请到 https://platform.deepseek.com/api_keys 重新创建密钥，写入 tarot-server/.env 的 DEEPSEEK_API_KEY（不要加引号、不要多空格），保存后重启后端。${detail}`,
        );
      }
      throw new AiServiceError(`DeepSeek API 错误 ${response.status}${detail}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiServiceError('DeepSeek 返回空响应');
    }
    return content;
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiServiceError('DeepSeek 请求超时');
    }
    throw new AiServiceError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}
