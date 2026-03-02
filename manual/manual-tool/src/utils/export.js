
export const generateDownload = (imageSrc, hotspots, links = []) => {
  const htmlContent = `<!DOCTYPE html>
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
    background: linear-gradient(45deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%); 
    background: radial-gradient(circle at 50% 10%, #fff9c4, #ffdde1, #c2e9fb);
    background-size: 200% 200%;
    animation: gradient 15s ease infinite;
    min-height: 100vh;
    overflow-x: hidden;
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
  }

  .sub { font-size: 11px; color: var(--text-sec); font-weight: 500; }

  /* ===== LEGEND using Glass Chips ===== */
  .legend-item {
    background: rgba(255, 255, 255, 0.3);
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-sec);
    box-shadow: 0 2px 5px rgba(0,0,0,0.03);
  }

  .dot-required { background: linear-gradient(135deg, #ff4757, #ff6b81); box-shadow: 0 2px 5px rgba(255, 71, 87, 0.3); }
  .dot-caution { background: linear-gradient(135deg, #ffa502, #ffc048); box-shadow: 0 2px 5px rgba(255, 165, 2, 0.3); }
  .dot-info { background: linear-gradient(135deg, #3742fa, #5352ed); box-shadow: 0 2px 5px rgba(55, 66, 250, 0.3); }

  /* ===== IMAGE WRAPPER (Glass Frame) ===== */
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
  .hs-dot {
    background: linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1));
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.5);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }

  .hs.type-required .hs-dot { background: linear-gradient(135deg, #ff4757, #ff6b81); }
  .hs.type-caution .hs-dot { background: linear-gradient(135deg, #ffa502, #ffc048); }
  .hs.type-info .hs-dot { background: linear-gradient(135deg, #3742fa, #5352ed); }

  .hs-ring { border-width: 2px; opacity: 0.6; }

  /* ===== TOOLTIP (Liquid Glass Card) ===== */
  .tip {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
    color: var(--text-main);
    border-radius: 16px;
    padding: 16px 20px;
    width: 280px;
  }

  .tip::before {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px);
    border-left: 1px solid rgba(255, 255, 255, 0.5);
    border-top: 1px solid rgba(255, 255, 255, 0.5);
  }

  .tip-title { color: #1e293b; font-size: 15px; margin-bottom: 8px; }
  .tip-body { color: #475569; font-size: 13px; line-height: 1.6; }
  
  .tip-note {
    background: rgba(255, 165, 2, 0.1);
    border: none;
    border-left: 3px solid #ffa502;
    color: #e67e22;
    margin-top: 10px;
    border-radius: 4px;
  }

  /* Tag styles for Glass */
  .tip-tag {
    font-size: 9px; padding: 3px 8px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.4);
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  /* ===== LINK BUTTON (Glossy) ===== */
  .link-btn {
    background: linear-gradient(135deg, #6366f1, #818cf8);
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255,255,255,0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
    width: 44px; height: 44px; /* Slightly larger */
  }
  .link-btn:hover {
    transform: translate(-50%, -50%) scale(1.1) translateY(-2px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255,255,255,0.4);
  }
  
  .link-label {
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    padding: 6px 10px;
    margin-top: 10px;
  }
  .link-label::before { border-bottom-color: rgba(30, 41, 59, 0.85); }
    border-radius: 0 6px 6px 0;
    font-size: 11px;
    color: #fbbf24;
    line-height: 1.6;
  }

  /* ===== LINK BUTTON ===== */
  .link-btn {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 100;
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    background: #4f46e5;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    color: #fff;
    text-decoration: none;
    transition: transform 0.2s, background 0.2s;
  }
  .link-btn:hover { 
    transform: translate(-50%, -50%) scale(1.1);
    background: #4338ca;
  }
  .link-btn svg { width: 18px; height: 18px; }
  
  .link-label {
    position: absolute;
    top: 100%; left: 50%; transform: translateX(-50%);
    margin-top: 8px;
    background: #1e293b;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  /* Little arrow for tooltip */
  .link-label::before {
    content: '';
    position: absolute;
    top: -4px; left: 50%; margin-left: -4px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 4px solid #1e293b;
  }
  .link-btn:hover .link-label { opacity: 1; }
</style>
</head>
<body>

<div class="page-header">
  <div>
    <h1>📋 マニュアル</h1>
    <div class="sub">🔵 アイコンにマウスを重ねると詳細が表示されます</div>
  </div>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot dot-required"></div>必須・重要</div>
    <div class="legend-item"><div class="legend-dot dot-caution"></div>注意事項</div>
    <div class="legend-item"><div class="legend-dot dot-info"></div>操作説明</div>
  </div>
</div>

<div class="scroll-area">
<div class="img-wrap">
  <img src="${imageSrc}" alt="Manual Screen">

  ${links.map(l => `
    <a href="${l.url}" class="link-btn" style="left:${l.x}%; top:${l.y}%;" target="_blank">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      <div class="link-label">${l.label}</div>
    </a>
  `).join('\n')}

  ${hotspots.map(h => {
    // Intelligent positioning: if hotspot is below 80% of screen, show tip ABOVE
    const isBottom = h.y > 80;
    const tipClass = isBottom ? 'tip above' : 'tip';

    // Tag class
    const typeClass = 'tag-' + h.type;
    const typeLabel = h.type === 'required' ? '必須・重要' : h.type === 'caution' ? '注意' : '情報';

    // Dot content logic
    const dotContent = h.icon === 'dot' ? '●' : h.icon;

    return `
    <div class="hs type-${h.type}" style="left:${h.x}%; top:${h.y}%;" 
         onmouseenter="show('${h.id}')" onmouseleave="hide('${h.id}')">
      <div class="hs-ring"></div><div class="hs-ring hs-ring2"></div>
      <div class="hs-dot">${dotContent}</div>
      <div class="${tipClass}" id="${h.id}">
        <span class="tip-tag ${typeClass}">${typeLabel}</span>
        <div class="tip-title">${h.title}</div>
        <div class="tip-body">${h.content}</div>
        ${h.note ? `<div class="tip-note">${h.note}</div>` : ''}
      </div>
    </div>`;
  }).join('\n')}

</div>
</div>

<script>
  function show(id) {
    const el = document.getElementById(id);
    if(el) el.classList.add('show');
  }

  function hide(id) {
    const el = document.getElementById(id);
    if(el) el.classList.remove('show');
  }
</script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'manual-export.html';
  a.click();
  URL.revokeObjectURL(url);
};
