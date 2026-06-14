/**
 * 清洗 AI 解读文本：去除 Markdown 标记与 emoji，
 * 保证输出是符合占卜语气的连贯散文（第三方模型有时不遵守纯文本要求，前端兜底）。
 */
export function stripMarkdown(text: string): string {
  return text
    // 标题 ### / ##
    .replace(/^#{1,6}\s+/gm, '')
    // 分隔线 --- *** ___（整行）
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, '')
    // 无序列表符号 - * +
    .replace(/^\s*[-*+]\s+/gm, '')
    // 有序列表 1. 2.
    .replace(/^\s*\d+\.\s+/gm, '')
    // 加粗 / 斜体 / 行内代码
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // 残留的孤立标记符
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}/g, '')
    // emoji 及符号表情
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}️]/gu,
      ''
    )
    // 压缩多余空行 / 行尾空格
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
