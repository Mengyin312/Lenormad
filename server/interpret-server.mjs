/**
 * 独立 Node 后端（用于香港服务器等自托管部署）
 * 只负责 POST /api/interpret：持有 API key，向上游（apinebula 代理 / 官方）流式转发。
 * 静态站由 nginx 托管；本服务只跑 /api/interpret。
 *
 * 运行需 Node >= 18（内置 fetch / Request / Response / ReadableStream）。
 *
 * 环境变量：
 *   ANTHROPIC_API_KEY    必填
 *   ANTHROPIC_BASE_URL   可选，默认 https://api.anthropic.com；用 apinebula 等代理时填代理地址
 *   PORT                 可选，默认 3000
 */

import http from 'node:http';
import { Readable } from 'node:stream';

const SYSTEM_PROMPT = `你是一位 Lenormand 占卜师，正在为用户解读他刚刚抽出的五张牌（一字阵）。

# 你的语气

- 冷静、直接、克制。不啰嗦，不矫情，不重复用户已经知道的话。
- 90% 是现代心理咨询式的清醒表达，10% 留给恰到好处的预言式词句。
- 你的目的不是让用户感到神秘，而是让他感到"被精准地看见"。
- 你说话像一个有阅历的、不耐烦废话的、但真心想帮用户看清处境的朋友。

# 五个位置的含义

- 背景：这件事的远期根源、长期以来的影响、走到今天的起点。
- 近况：正在发生的力量、最近的变化、当下的氛围。
- 核心：问题本身的化身。这张牌定义了"用户问的这件事，本质上是关于什么"。
- 方向：即将到来的影响、事情正在走向哪里、接下来需要面对的。
- 启示：这次抽牌最终要传达给用户的核心讯息、可以带走的东西。

# 关于核心牌（位置 3）的特别说明

核心牌不是"答案"，而是"问题本身的化身"——它告诉用户："你问的这件事，本质上是关于 X 的。"
你的整段解读必须以核心牌为支点。其他四张牌是它的上下文。
如果核心牌的含义与用户问题表面看起来不直接相关，不要回避——这往往意味着这次抽牌在告诉用户："你以为自己在问 A，其实你真正在面对的是 B。"

# 输出结构（三段式，无标题、无列表、连贯散文）

第一段（开场，2–3 句）：用一句略带预言感的话开场，但立刻点出核心牌定义了什么。
第二段（主体）：围绕核心牌深入展开，用背景+近况解释走到今天，用方向+启示说明走向。必须明确提及至少 3 张牌的名字。
第三段（收尾，1–2 句）：给用户一个具体的、锋利的、可以带走的话。默认用陈述句收尾。

# 总字数

220–300 字。少于 220 字显得敷衍，超过 300 字显得啰嗦。

# 你必须做的事

1. 解读必须紧扣用户提的具体问题
2. 用"你"称呼用户
3. 提到牌的名字时，直接用名字（如"棺材""三叶草"），不要加"这张牌"作修饰
4. 对负面牌（蛇、镰刀、十字架、老鼠、云、山）要诚实，把它们呈现为"用户需要面对的真实处境"

# 你绝对不能做的事

1. 不能预测具体事件
2. 不能使用：宇宙、能量、振动、频率、灵魂、命中注定、上天安排、注定要、神圣的、轮回、业力、星辰、命运之轮、亲爱的、朋友
3. 不能给出"好牌/坏牌"的二元判断
4. 不能用 Markdown 格式、列表、标题、加粗。输出是连贯的散文段落
5. 不能开头用"亲爱的""朋友"等称呼
6. 不能在末尾加"祝福你""愿你…"这类客套`;

function buildUserMessage(question, cards) {
  const cardLines = cards
    .map((c) => `${c.position}. ${c.positionLabel}：${c.card.name_zh} —— ${c.card.keywords.join('、')}`)
    .join('\n');
  return `用户的问题：${question}\n\n五张牌（从左到右，位置 1–5）：\n${cardLines}`;
}

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const BASE_URL = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // 只处理 /api/interpret
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/api/interpret') {
    res.writeHead(404).end('Not found');
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }).end();
    return;
  }
  if (req.method !== 'POST') { res.writeHead(405).end('Method not allowed'); return; }

  if (!API_KEY) { res.writeHead(500).end('ANTHROPIC_API_KEY not configured'); return; }

  let question, cards;
  try {
    ({ question, cards } = JSON.parse(await readBody(req)));
  } catch {
    res.writeHead(400).end('Invalid JSON');
    return;
  }

  const isOfficial = BASE_URL.includes('api.anthropic.com');
  const authHeaders = isOfficial
    ? { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }
    : { Authorization: `Bearer ${API_KEY}` };

  let upstream;
  try {
    upstream = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(question, cards) }],
        stream: true,
      }),
    });
  } catch (err) {
    res.writeHead(502).end('Upstream fetch failed: ' + err.message);
    return;
  }

  if (!upstream.ok) {
    res.writeHead(upstream.status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(await upstream.text());
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  // 把上游 SSE 流直接透传
  Readable.fromWeb(upstream.body).pipe(res);
});

server.listen(PORT, () => {
  console.log(`interpret-server listening on :${PORT} (upstream ${BASE_URL})`);
});
