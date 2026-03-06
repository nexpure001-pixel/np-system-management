
export const getManualHtml = (imageSrc, hotspots, links = []) => {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Manual Export</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');

  /* ===== LIQUID GLASS THEME ===== */
  :root {
    --glass-bg: rgba(255, 255, 255, 0.65);
    --glass-border: rgba(255, 255, 255, 0.4);
    --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
    --accent: #ff4757;
    --accent-glow: rgba(255, 71, 87, 0.4);
    --text-main: #1e293b;
    --text-sec: #475569;
  }

  body {
    font-family: 'Noto Sans JP', sans-serif;
    color: var(--text-main);
    background: radial-gradient(circle at 50% 10%, #fff9c4, #ffdde1, #c2e9fb);
    background-size: 200% 200%;
    animation: gradient 15s ease infinite;
    min-height: 100vh;
    overflow-x: hidden;
    margin: 0;
  }

  @keyframes gradient {
     0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* ===== HEADER (Glass) ===== */
  .page-header {
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--glass-border);
    padding: 16px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 200;
    box-shadow: var(--glass-shadow);
  }

  .page-header h1 {
    font-weight: 700;
    color: #1e293b;
    background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 18px;
    margin: 0;
  }

  .sub { font-size: 11px; color: var(--text-sec); font-weight: 500; margin-top: 4px; }

  /* ===== LEGEND using Glass Chips ===== */
  .legend { display: flex; gap: 8px; }
  .legend-item {
    background: rgba(255, 255, 255, 0.3);
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-sec);
    box-shadow: 0 2px 5px rgba(0,0,0,0.03);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-required { background: linear-gradient(135deg, #ff4757, #ff6b81); box-shadow: 0 2px 5px rgba(255, 71, 87, 0.3); }
  .dot-caution { background: linear-gradient(135deg, #ffa502, #ffc048); box-shadow: 0 2px 5px rgba(255, 165, 2, 0.3); }
  .dot-info { background: linear-gradient(135deg, #3742fa, #5352ed); box-shadow: 0 2px 5px rgba(55, 66, 250, 0.3); }

  /* ===== IMAGE WRAPPER (Glass Frame) ===== */
  .scroll-area { padding: 40px; display: flex; justify-content: center; }
  .img-wrap {
    position: relative;
    padding: 12px;
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    border-radius: 24px;
    border: 1px solid var(--glass-border);
    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
    display: inline-block;
  }
  
  .img-wrap img { border-radius: 12px; display: block; max-width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }

  /* ===== HOTSPOT (Liquid) ===== */
  .hs { position: absolute; transform: translate(-50%, -50%); cursor: pointer; z-index: 100; }
  .hs-dot {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-bold; color: #fff;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .type-required .hs-dot { background: linear-gradient(135deg, #ff4757, #ff6b81); }
  .type-caution .hs-dot { background: linear-gradient(135deg, #ffa502, #ffc048); }
  .type-info .hs-dot { background: linear-gradient(135deg, #3742fa, #5352ed); }

  .hs-ring {
    position: absolute; inset: -5px; border-radius: 50%;
    border: 2px solid currentColor;
    animation: ripple 2s infinite; opacity: 0;
  }
  .type-required { color: #ff4757; }
  .type-caution { color: #ffa502; }
  .type-info { color: #3742fa; }

  @keyframes ripple {
    0% { transform: scale(0.8); opacity: 0; }
    50% { opacity: 0.5; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  /* ===== TOOLTIP (Liquid Glass Card) ===== */
  .tip {
    position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%) translateY(10px);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    border-radius: 16px;
    padding: 16px 20px;
    width: 260px;
    opacity: 0; pointer-events: none; transition: all 0.3s;
    z-index: 150;
  }
  .tip.above { bottom: 120%; top: auto; }
  .hs:hover .tip { opacity: 1; transform: translateX(-50%) translateY(0); }

  .tip-tag { font-size: 9px; padding: 2px 8px; border-radius: 10px; background: rgba(0,0,0,0.05); margin-bottom: 8px; display: inline-block; }
  .tip-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .tip-body { font-size: 12px; line-height: 1.5; color: #475569; }
  
  .tip-note {
    background: rgba(255, 165, 2, 0.1);
    border-left: 3px solid #ffa502;
    color: #d97706;
    margin-top: 10px; padding: 6px 10px;
    border-radius: 4px; font-size: 11px;
  }

  /* ===== LINK BUTTON ===== */
  .link-btn {
    position: absolute; transform: translate(-50%, -50%);
    width: 36px; height: 36px; border-radius: 50%;
    background: #4f46e5; border: 2px solid #fff;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    display: flex; align-items: center; justify-content: center;
    color: #fff; text-decoration: none; transition: all 0.2s;
    z-index: 100;
  }
  .link-btn:hover { transform: translate(-50%, -50%) scale(1.1); background: #4338ca; }
  .link-label {
    position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    margin-top: 8px; background: #1e293b; color: #fff; padding: 4px 8px;
    border-radius: 4px; font-size: 10px; white-space: nowrap;
    opacity: 0; pointer-events: none; transition: 0.2s;
  }
  .link-btn:hover .link-label { opacity: 1; }
</style>
</head>
<body>

<div class="page-header">
  <div>
    <h1>📋 マニュアル</h1>
    <div class="sub">🔵 マーカーにマウスを重ねると詳細が表示されます</div>
  </div>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot dot-required"></div>必須</div>
    <div class="legend-item"><div class="legend-dot dot-caution"></div>注意</div>
    <div class="legend-item"><div class="legend-dot dot-info"></div>情報</div>
  </div>
</div>

<div class="scroll-area">
<div class="img-wrap">
  <img src="${imageSrc}" alt="Manual Screen">

  ${links.map(l => `
    <a href="${l.url}" class="link-btn" style="left:${l.x}%; top:${l.y}%;" target="_blank">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      <div class="link-label">${l.label}</div>
    </a>
  `).join('\n')}

  ${hotspots.map(h => `
    <div class="hs type-${h.type}" style="left:${h.x}%; top:${h.y}%;">
      <div class="hs-ring"></div>
      <div class="hs-dot">${h.icon === 'dot' ? '●' : h.icon}</div>
      <div class="tip">
        <span class="tip-tag">${h.type === 'required' ? '必須' : h.type === 'caution' ? '注意' : '情報'}</span>
        <div class="tip-title">${h.title}</div>
        <div class="tip-body">${h.content}</div>
        ${h.note ? `<div class="tip-note">${h.note}</div>` : ''}
      </div>
    </div>`).join('\n')}
</div>
</div>

</body>
</html>`;
};

export const generateDownload = (imageSrc, hotspots, links = []) => {
  const htmlContent = getManualHtml(imageSrc, hotspots, links);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'manual-export.html';
  a.click();
  URL.revokeObjectURL(url);
};
