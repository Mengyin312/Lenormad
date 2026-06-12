import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

// ── 完整系统提示词（来自 PRD 附录 C） ──────────────────────────────
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

// ── 构造用户消息 ──────────────────────────────────────────────────
function buildUserMessage(question: string, cards: Array<{
  position: number;
  positionLabel: string;
  card: { name_zh: string; keywords: string[] };
}>) {
  const cardLines = cards.map(c =>
    `${c.position}. ${c.positionLabel}：${c.card.name_zh} —— ${c.card.keywords.join('、')}`
  ).join('\n');
  return `用户的问题：${question}\n\n五张牌（从左到右，位置 1–5）：\n${cardLines}`;
}

// ── 开发环境 API 中间件插件 ──────────────────────────────────────────
// apiKey / baseUrl 由外部通过 loadEnv 注入，避免 process.env 读不到 .env.local 的问题
function devInterpretPlugin(apiKey: string, baseUrl: string): Plugin {
  // 标准化 baseUrl：去掉末尾斜杠，默认为官方地址
  const apiBase = (baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  const messagesUrl = `${apiBase}/v1/messages`;

  return {
    name: 'dev-interpret-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          // 只处理 /api/interpret，其余交给 Vite
          if (req.url !== '/api/interpret') { next(); return; }

          // OPTIONS preflight
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
          if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

          // 读取请求 body
          const rawBody = await new Promise<string>((resolve) => {
            let buf = '';
            req.on('data', (chunk: Buffer) => { buf += chunk.toString(); });
            req.on('end', () => resolve(buf));
          });

          let question: string, cards: unknown[];
          try {
            ({ question, cards } = JSON.parse(rawBody));
          } catch {
            res.writeHead(400); res.end('Invalid JSON'); return;
          }

          if (!apiKey || apiKey.startsWith('sk-ant-api03-xxx')) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in .env.local' }));
            return;
          }

          try {
            // 官方地址用 x-api-key，第三方代理通常用 Authorization: Bearer
            const isOfficialApi = apiBase.includes('api.anthropic.com');
            const anthropicRes = await fetch(messagesUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(isOfficialApi
                  ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
                  : { 'Authorization': `Bearer ${apiKey}` }
                ),
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 600,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: buildUserMessage(question, cards as Parameters<typeof buildUserMessage>[1]) }],
                stream: true,
              }),
            });

            if (!anthropicRes.ok) {
              const errText = await anthropicRes.text();
              res.writeHead(anthropicRes.status);
              res.end(errText);
              return;
            }

            // 将 Anthropic 的 SSE 流直接转发给前端
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            });

            const reader = anthropicRes.body!.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(decoder.decode(value, { stream: true }));
            }
          } catch (err) {
            if (!res.headersSent) { res.writeHead(500); }
          } finally {
            res.end();
          }
        });
    },
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv 读取 .env.local 等文件，第三个参数 '' 表示不过滤前缀，获取所有变量
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      devInterpretPlugin(
        env.ANTHROPIC_API_KEY  ?? '',
        env.ANTHROPIC_BASE_URL ?? '',
      ),
    ],
  };
});
