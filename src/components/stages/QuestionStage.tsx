import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import styles from './QuestionStage.module.css';
import copy from '../../data/copy.json';

/** 停止输入多久后自动提交（毫秒） */
const IDLE_SUBMIT_MS = 3000;

export default function QuestionStage() {
  const setStage      = useAppStore((s) => s.setStage);
  const setQuestion   = useAppStore((s) => s.setQuestion);

  const [text, setText] = useState('');
  const containerRef  = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLTextAreaElement>(null);
  const idleTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 淡入
  useEffect(() => {
    gsap.fromTo(containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.2, ease: 'power2.out' }
    );
    // 自动聚焦输入框
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // 提交问题 → 文字逐字淡出 → 切换阶段
  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);

    gsap.to(containerRef.current, {
      opacity: 0,
      duration: 1,
      ease: 'power2.in',
      onComplete: () => setStage('SHUFFLE'),
    });
  };

  // 输入处理：每次击键重置 idle 计时器
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (e.target.value.trim()) {
      idleTimerRef.current = setTimeout(handleSubmit, IDLE_SUBMIT_MS);
    }
  };

  // Enter（非 Shift+Enter）提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      handleSubmit();
    }
  };

  // 卸载时清理计时器
  useEffect(() => {
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <p className={styles.prompt}>{copy.question.prompt}</p>

      <div className={styles.inputWrap}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={copy.question.placeholder}
          rows={2}
          maxLength={200}
        />
      </div>

      {/* 提问示例：始终展示 */}
      <div className={styles.examplePanel}>
        <p className={styles.exampleTitle}>{copy.question.exampleTitle}</p>
        <div className={styles.exampleList}>
          {copy.question.examples.map((ex, i) => (
            <div key={i} className={styles.exampleRow}>
              <span className={styles.bad}>✗ {ex.bad}</span>
              <span className={styles.good}>✓ {ex.good}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
