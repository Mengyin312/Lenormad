import type { SelectedCard } from '../types';

/**
 * 调用 /api/interpret，流式返回解读文字（AsyncGenerator<string>）
 * 每次 yield 一个文字片段（可能是一个字、几个字或一个标点）
 */
export async function* streamInterpretation(
  question: string,
  cards: SelectedCard[]
): AsyncGenerator<string> {
  const response = await fetch('/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      cards: cards.map((sc) => ({
        position:      sc.position,
        positionLabel: sc.positionLabel,
        card: {
          name_zh:  sc.card.name_zh,
          keywords: sc.card.keywords,
        },
      })),
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 按行解析 SSE
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // 末尾可能是不完整的行，留到下次

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const json = JSON.parse(data);
        // Anthropic streaming: content_block_delta 携带文字
        if (json.type === 'content_block_delta' && json.delta?.text) {
          yield json.delta.text as string;
        }
      } catch {
        // 忽略非 JSON 的 SSE 行（如 event:、comment 等）
      }
    }
  }
}
