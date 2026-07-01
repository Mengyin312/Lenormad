import { useEffect, useState } from 'react';
import styles from './WechatHint.module.css';

// 微信内置浏览器（含企业微信）禁用 getUserMedia，摄像头调不起来。
// 检测到微信时提示用户在系统浏览器打开。
function isWechat(): boolean {
  return /micromessenger/i.test(navigator.userAgent);
}

export default function WechatHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isWechat()) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      {/* 指向右上角「···」的箭头 */}
      <div className={styles.arrow}>↗</div>

      <div className={styles.card}>
        <p className={styles.title}>请在浏览器中打开</p>
        <p className={styles.body}>
          这次占卜需要用到摄像头识别你的手势，<br />
          而微信内不支持调用摄像头。
        </p>
        <p className={styles.steps}>
          点击右上角 <span className={styles.dots}>···</span><br />
          选择「在浏览器打开」
        </p>
        <button className={styles.dismiss} onClick={() => setShow(false)}>
          我知道了
        </button>
      </div>
    </div>
  );
}
