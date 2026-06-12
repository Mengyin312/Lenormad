/**
 * Cloudflare Worker: Lenormand 解读接口
 * 部署: wrangler deploy
 * 密钥: wrangler secret put ANTHROPIC_API_KEY
 */

export interface Env {
  ANTHROPIC_API_KEY: string;
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `你是一位 Lenormand 占卜师，正在为用户解读他刚刚抽出的五张牌（一字阵）。

你的语气：冷静、直接、克制。90% 现代心理咨询式表达，10% 预言点缀。
目的是让用户感到"被精准地看见"。

五个位置含义：
- 背景：这件事的远期根源
- 近况：正在发生的力量
- 核心：问题本身的化身（解读支点）
- 方向：即将到来的影响
- 启示：最终要传达的核心讯息

输出结构：三段式散文（无标题无列表），220–300 字。
第一段开场（2–3句）：预言式起头+点出核心牌定义。
第二段主体：围绕核心牌展开，必须提及至少3张牌名字。
第三段收尾（1–2句）：陈述式悬钩，可以带走的话。

严禁使用：宇宙/能量/振动/灵魂/命中注定/上天安排/星辰/命运之轮
严禁：Markdown格式/列表/加粗/预测具体事件/"祝福你""愿你"结尾`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    let question: string, cards: unknown[];
    try {
      ({ question, cards } = await request.json() as { question: string; cards: unknown[] });
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: CORS });
    }

    if (!question || !Array.isArray(cards) || cards.length !== 5) {
      return new Response('Invalid input', { status: 400, headers: CORS });
    }

    const userMessage = buildUserMessage(question, cards as CardInput[]);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
        stream:     true,
      }),
    });

    if (!anthropicRes.ok) {
      return new Response(await anthropicRes.text(), {
        status: anthropicRes.status, headers: CORS,
      });
    }

    return new Response(anthropicRes.body, {
      headers: {
        ...CORS,
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  },
};

interface CardInput {
  position: number;
  positionLabel: string;
  card: { name_zh: string; keywords: string[] };
}

function buildUserMessage(question: string, cards: CardInput[]) {
  const lines = cards.map((c) =>
    `${c.position}. ${c.positionLabel}：${c.card.name_zh} —— ${c.card.keywords.join('、')}`
  ).join('\n');
  return `用户的问题：${question}\n\n五张牌（从左到右，位置 1–5）：\n${lines}`;
}
