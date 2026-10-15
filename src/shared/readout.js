function parseColor(s) {
  const nums = s.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  return nums.slice(0, 4).map(Number);
}
function hexOf(c) {
  return (
    '#' +
    c
      .slice(0, 3)
      .map(v =>
        Math.min(255, Math.max(0, Math.round(v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function updatePreviewReadout(b) {
  if (!b.isConnected) return;
  const style = getComputedStyle(b),
    stageStyle = getComputedStyle($('liveStage')),
    faceStyle = b.dataset.detail === 'bottomedge' ? getComputedStyle(b, '::before') : style;
  let fg = parseColor(style.color),
    bg = parseColor(faceStyle.backgroundColor),
    under = parseColor(stageStyle.backgroundColor);
  if (fg && bg) {
    if (bg[3] === 0 && under) bg = under;
    else if (bg[3] !== undefined && bg[3] < 1 && under)
      bg = bg.slice(0, 3).map((v, i) => v * bg[3] + under[i] * (1 - bg[3]));
    const factor = style.filter.match(/brightness\(([^)]+)\)/);
    if (factor) {
      const f = parseFloat(factor[1]);
      fg = fg.slice(0, 3).map(v => Math.min(255, v * f));
      bg = bg.slice(0, 3).map(v => Math.min(255, v * f));
    }
    let txt =
      'Text / surface contrast: ' +
      formatNumber(contrast(hexOf(fg), hexOf(bg)), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) +
      ':1';
    if (style.opacity !== '1') txt += ' · before opacity';
    $('contrastReadout').textContent = txt;
  } else $('contrastReadout').textContent = 'Check contrast on the target surface';
  const rect = b.getBoundingClientRect();
  $('sizeReadout').textContent = Math.round(rect.width) + ' × ' + Math.round(rect.height) + ' px';
}
