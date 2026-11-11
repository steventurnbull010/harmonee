// ============================================================================
// JOB PICTURES (js/job-art.js) · drawings for picture jobs (js/picture-jobs.js)
// Original drawings in the buddies' soft 3D style (js/buddy-art.js): lit from
// the top left, chunky rounded shapes, glossy highlights, a soft shadow on
// the floor. 200 x 200 each, keyed like PictureJobs.PICTURES ("teeth",
// "bed"...). A job without a drawing shows its emoji. Each copy on the page
// gets its own gradient names (svgFor), so repeats never draw pale.
// ============================================================================
(function () {
  // ---- Shared pieces ------------------------------------------------------------------
  const st = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ""}/>`).join("");
  // Lit from the top left
  const lit = (id, light, mid, dark, cx = "34%", cy = "28%") => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="80%">${st([[0, light], [0.5, mid], [1, dark]])}</radialGradient>`;
  const lin = (id, list, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${st(list)}</linearGradient>`;
  const defs = (...g) => `<defs><filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>${g.join("")}</defs>`;
  const floor = (rx = 56, y = 184, cx = 100) => `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="8" fill="#0f172a" opacity="0.2" filter="url(#soft)"/>`;
  const shine = (d, w = 4, o = 0.55) => `<path d="${d}" stroke="#fff" stroke-width="${w}" fill="none" opacity="${o}" stroke-linecap="round"/>`;
  const spark = (x, y, r = 8, fill = "#fde047") => `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${fill}"/>`;
  const star5 = (x, y, r, fill) => {
    const p = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; p.push(`${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`); }
    return `<path d="M${p.join(" L")} Z" fill="${fill}" stroke-linejoin="round"/>`;
  };
  const bubble = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#bub)"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.25}" fill="#fff" opacity="0.9"/>`;
  const bubDef = lit("bub", "#ffffff", "#e0f2fe", "#7dd3fc", "35%", "30%");

  const ART = {};

  // ---- Brush teeth: a chunky toothbrush with a swirl of paste ---------------------------
  ART.teeth = () => `
    ${defs(lit("h", "#7dd3fc", "#0ea5e9", "#0369a1"), lin("br", [[0, "#ffffff"], [1, "#cbd5e1"]], 1, 0), lit("pa", "#ffffff", "#bbf7d0", "#4ade80"))}
    ${floor(52)}
    <g transform="translate(12 14) rotate(-38 100 104) scale(0.92)">
      <rect x="88" y="78" width="26" height="104" rx="13" fill="url(#h)"/>
      <rect x="86" y="26" width="30" height="62" rx="14" fill="url(#h)"/>
      <rect x="92" y="96" width="14" height="40" rx="7" fill="#e0f2fe" opacity="0.7"/>
      <rect x="58" y="30" width="30" height="50" rx="8" fill="url(#br)"/>
      ${[64, 71, 78, 85].map(x => `<path d="M${x} 34 V76" stroke="#94a3b8" stroke-width="2" opacity="0.5"/>`).join("")}
      <path d="M40 40 C30 46 36 56 46 54 C38 62 46 72 56 66 C52 74 62 80 66 72 L66 34 C58 30 46 32 40 40 Z" fill="url(#pa)"/>
      <path d="M44 44 C40 48 44 52 50 50" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>
      ${shine("M94 36 V70", 4, 0.6)}${shine("M96 92 V160", 4, 0.45)}
    </g>
    ${spark(150, 50, 10)}${spark(166, 78, 6, "#fff")}${spark(40, 150, 7)}`;

  // ---- Wee and wash hands: a shiny loo and soap bubbles ---------------------------------
  ART.toilet = () => `
    ${defs(lit("cer", "#ffffff", "#f1f5f9", "#94a3b8"), lit("seat", "#ffffff", "#e0f2fe", "#7dd3fc"), lin("water", [[0, "#7dd3fc"], [1, "#0284c7"]]), bubDef)}
    ${floor(46)}
    <rect x="58" y="30" width="84" height="58" rx="16" fill="url(#cer)"/>
    <rect x="118" y="38" width="14" height="10" rx="5" fill="#cbd5e1"/>
    ${shine("M68 40 Q66 60 70 76", 4, 0.8)}
    <path d="M48 104 C48 146 72 166 100 166 C128 166 152 146 152 104 Z" fill="url(#cer)"/>
    <rect x="78" y="156" width="44" height="26" rx="8" fill="url(#cer)"/>
    <ellipse cx="100" cy="104" rx="54" ry="18" fill="url(#seat)"/>
    <ellipse cx="100" cy="106" rx="36" ry="10" fill="url(#water)"/>
    ${shine("M60 116 Q66 140 82 152", 4, 0.7)}
    ${bubble(162, 58, 14)}${bubble(178, 92, 9)}${bubble(30, 66, 11)}${bubble(22, 98, 7)}`;

  // ---- Get dressed: a bright t-shirt with a star ----------------------------------------
  ART.dressed = () => `
    ${defs(lit("tee", "#fdba74", "#f97316", "#c2410c"), lit("sl", "#fb923c", "#ea580c", "#9a3412"))}
    ${floor(58)}
    <path d="M70 38 L44 50 L20 84 L46 104 L60 90 Z" fill="url(#sl)"/>
    <path d="M130 38 L156 50 L180 84 L154 104 L140 90 Z" fill="url(#sl)"/>
    <path d="M70 38 Q100 58 130 38 L144 54 L144 168 Q100 180 56 168 L56 54 Z" fill="url(#tee)"/>
    <path d="M74 38 Q100 62 126 38" stroke="#9a3412" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.5"/>
    ${star5(100, 112, 26, "#fde047")}
    <path d="M100 92 L104 104" stroke="#fff" stroke-width="3" opacity="0.7" stroke-linecap="round"/>
    ${shine("M66 66 Q62 110 68 156", 5, 0.4)}`;

  // ---- Pyjamas on: a cosy pyjama top with moons and stars -------------------------------
  ART.pyjamas = () => `
    ${defs(lit("pj", "#c4b5fd", "#8b5cf6", "#5b21b6"), lit("pjs", "#a78bfa", "#7c3aed", "#4c1d95"), lit("col", "#ede9fe", "#ddd6fe", "#a78bfa"))}
    ${floor(58)}
    <path d="M70 40 L44 52 L22 92 L48 108 L60 92 Z" fill="url(#pjs)"/>
    <path d="M130 40 L156 52 L178 92 L152 108 L140 92 Z" fill="url(#pjs)"/>
    <path d="M70 40 L100 70 L130 40 L144 56 L144 170 Q100 180 56 170 L56 56 Z" fill="url(#pj)"/>
    <path d="M70 40 L100 70 L84 76 L62 48 Z" fill="url(#col)"/><path d="M130 40 L100 70 L116 76 L138 48 Z" fill="url(#col)"/>
    <path d="M100 70 V172" stroke="#4c1d95" stroke-width="3" opacity="0.4"/>
    ${[96, 122, 148].map(y => `<circle cx="100" cy="${y}" r="5" fill="#fef3c7"/>`).join("")}
    <path d="M76 106 a10 10 0 1 0 8 16 a8 8 0 1 1 -8 -16 Z" fill="#fde047"/>
    <path d="M124 136 a9 9 0 1 0 7 14 a7 7 0 1 1 -7 -14 Z" fill="#fde047"/>
    ${spark(128, 100, 7)}${spark(76, 150, 6)}${spark(36, 82, 5, "#fff")}
    ${shine("M64 70 Q60 112 66 158", 5, 0.35)}`;

  // ---- Make your bed: a neat bed with a fluffy pillow -----------------------------------
  ART.bed = () => `
    ${defs(lit("wood", "#fcd34d", "#d97706", "#92400e"), lit("duv", "#7dd3fc", "#38bdf8", "#0369a1"), lit("pil", "#ffffff", "#f8fafc", "#cbd5e1"))}
    ${floor(78, 184)}
    <rect x="26" y="44" width="148" height="80" rx="26" fill="url(#wood)"/>
    ${shine("M44 58 Q100 50 156 58", 5, 0.5)}
    <rect x="28" y="160" width="16" height="24" rx="6" fill="#92400e"/><rect x="156" y="160" width="16" height="24" rx="6" fill="#92400e"/>
    <rect x="18" y="100" width="164" height="68" rx="22" fill="url(#duv)"/>
    <ellipse cx="100" cy="100" rx="46" ry="18" fill="url(#pil)"/>
    <path d="M18 126 Q100 116 182 126" stroke="#e0f2fe" stroke-width="10" fill="none" opacity="0.8"/>
    ${[54, 100, 146].map(x => star5(x, 148, 8, "#fef9c3")).join("")}
    ${shine("M30 136 Q32 152 44 160", 4, 0.5)}`;

  // ---- Get up: a smiley red alarm clock -------------------------------------------------
  ART.wakeup = () => `
    ${defs(lit("rc", "#fca5a5", "#ef4444", "#991b1b"), lit("bell", "#fde68a", "#f59e0b", "#b45309"), lit("face", "#ffffff", "#fff7ed", "#fed7aa"))}
    ${floor(50)}
    <path d="M66 162 L54 182" stroke="#991b1b" stroke-width="10" stroke-linecap="round"/><path d="M134 162 L146 182" stroke="#991b1b" stroke-width="10" stroke-linecap="round"/>
    <circle cx="60" cy="50" r="22" fill="url(#bell)"/><circle cx="140" cy="50" r="22" fill="url(#bell)"/>
    <rect x="94" y="24" width="12" height="16" rx="5" fill="#b45309"/>
    <circle cx="100" cy="110" r="66" fill="url(#rc)"/>
    <circle cx="100" cy="112" r="50" fill="url(#face)"/>
    ${[0, 90, 180, 270].map(a => `<circle cx="${100 + 40 * Math.sin(a * Math.PI / 180)}" cy="${112 - 40 * Math.cos(a * Math.PI / 180)}" r="4" fill="#fca5a5"/>`).join("")}
    <path d="M100 112 V82" stroke="#1f2937" stroke-width="6" stroke-linecap="round"/><path d="M100 112 L122 122" stroke="#1f2937" stroke-width="6" stroke-linecap="round"/>
    <circle cx="100" cy="112" r="6" fill="#ef4444"/>
    ${shine("M56 82 Q66 62 88 56", 6, 0.55)}
    <path d="M26 30 l-10 -8 M22 46 h-12 M174 30 l10 -8 M178 46 h12" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>`;

  // ---- Eat breakfast: a bowl of hoops with a spoon --------------------------------------
  ART.breakfast = () => `
    ${defs(lit("bowl", "#93c5fd", "#3b82f6", "#1e3a8a"), lin("milk", [[0, "#ffffff"], [1, "#e2e8f0"]]), lit("spoon", "#f8fafc", "#cbd5e1", "#64748b"))}
    ${floor(64)}
    <path d="M128 40 L150 20" stroke="url(#spoon)" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="122" cy="62" rx="16" ry="10" transform="rotate(-40 122 62)" fill="url(#spoon)"/>
    <ellipse cx="100" cy="92" rx="72" ry="22" fill="url(#milk)"/>
    ${[[66, 86, "#f59e0b"], [84, 80, "#ef4444"], [104, 84, "#22c55e"], [124, 80, "#f59e0b"], [140, 90, "#ec4899"], [92, 96, "#a855f7"], [116, 98, "#ef4444"], [74, 100, "#22c55e"], [134, 102, "#3b82f6"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${c}" stroke-width="5"/>`).join("")}
    <path d="M28 92 C28 148 62 176 100 176 C138 176 172 148 172 92 C150 108 50 108 28 92 Z" fill="url(#bowl)"/>
    ${shine("M42 112 Q52 146 80 162", 6, 0.5)}
    ${star5(100, 138, 12, "#fde047")}`;

  // ---- Shoes on: a chunky trainer -------------------------------------------------------
  ART.shoes = () => `
    ${defs(lit("up", "#fca5a5", "#ef4444", "#991b1b"), lin("sole", [[0, "#ffffff"], [1, "#cbd5e1"]]), lit("toe", "#ffffff", "#f1f5f9", "#94a3b8"))}
    ${floor(74, 178)}
    <path d="M24 150 C24 130 34 118 52 112 L78 70 C84 60 96 58 106 66 L124 82 C140 92 162 100 174 112 C182 120 182 140 176 150 Z" fill="url(#up)"/>
    <path d="M22 148 H178 C180 160 174 170 160 170 H38 C26 170 20 160 22 148 Z" fill="url(#sole)"/>
    <path d="M24 158 H176" stroke="#94a3b8" stroke-width="3" opacity="0.5"/>
    <path d="M140 102 C160 108 176 118 176 140 L176 148 L132 148 C132 128 134 112 140 102 Z" fill="url(#toe)"/>
    ${[[86, 78], [96, 88], [106, 98]].map(([x, y]) => `<path d="M${x - 8} ${y + 8} L${x + 14} ${y - 6}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`).join("")}
    <path d="M60 116 Q96 100 120 120" stroke="#fde047" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${shine("M56 104 Q66 84 80 76", 5, 0.5)}`;

  // ---- Coat on: a yellow raincoat with a hood -------------------------------------------
  ART.coat = () => `
    ${defs(lit("rc", "#fef08a", "#facc15", "#ca8a04"), lit("rcs", "#fde047", "#eab308", "#a16207"), lit("hood", "#fef9c3", "#fde047", "#ca8a04"))}
    ${floor(60)}
    <path d="M100 18 C72 18 62 40 64 58 L136 58 C138 40 128 18 100 18 Z" fill="url(#hood)"/>
    <path d="M64 50 L36 68 L20 140 L44 146 L58 96 Z" fill="url(#rcs)"/>
    <path d="M136 50 L164 68 L180 140 L156 146 L142 96 Z" fill="url(#rcs)"/>
    <path d="M64 50 Q100 70 136 50 L148 176 Q100 184 52 176 Z" fill="url(#rc)"/>
    <path d="M100 64 V180" stroke="#a16207" stroke-width="3" opacity="0.5"/>
    ${[90, 118, 146].map(y => `<rect x="92" y="${y}" width="16" height="7" rx="3.5" fill="#1e3a8a"/>`).join("")}
    <path d="M66 128 h22 v22 h-22 Z" fill="#eab308" opacity="0.7" rx="4"/>
    <path d="M112 128 h22 v22 h-22 Z" fill="#eab308" opacity="0.7"/>
    ${shine("M72 70 Q66 120 70 166", 5, 0.4)}${shine("M78 28 Q90 22 100 22", 4, 0.6)}`;

  // ---- Pack your bag: a red backpack ----------------------------------------------------
  ART.bag = () => `
    ${defs(lit("bp", "#fca5a5", "#ef4444", "#991b1b"), lit("pk", "#f87171", "#dc2626", "#7f1d1d"), lit("str", "#60a5fa", "#2563eb", "#1e3a8a"))}
    ${floor(56)}
    <path d="M82 34 C82 16 118 16 118 34" stroke="#7f1d1d" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M44 80 C44 44 70 30 100 30 C130 30 156 44 156 80 L156 158 C156 172 146 180 132 180 H68 C54 180 44 172 44 158 Z" fill="url(#bp)"/>
    <path d="M60 116 C60 104 70 98 82 98 H118 C130 98 140 104 140 116 V156 C140 166 132 172 122 172 H78 C68 172 60 166 60 156 Z" fill="url(#pk)"/>
    <path d="M62 118 H138" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
    <rect x="94" y="112" width="12" height="18" rx="4" fill="#fde047"/>
    <path d="M58 60 Q100 46 142 60" stroke="url(#str)" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.9"/>
    ${star5(100, 146, 12, "#fff7ed")}
    ${shine("M54 72 Q52 110 56 150", 5, 0.45)}`;

  // ---- Water bottle ---------------------------------------------------------------------
  ART.bottle = () => `
    ${defs(lin("glass", [[0, "#e0f2fe", 0.95], [1, "#bae6fd", 0.95]], 1, 0), lin("wat", [[0, "#38bdf8"], [1, "#0369a1"]]), lit("cap", "#86efac", "#22c55e", "#15803d"))}
    ${floor(40)}
    <rect x="62" y="48" width="76" height="134" rx="26" fill="url(#glass)" stroke="#7dd3fc" stroke-width="3"/>
    <path d="M65 104 Q100 96 135 104 V158 C135 172 124 179 112 179 H88 C76 179 65 172 65 158 Z" fill="url(#wat)"/>
    <path d="M65 104 Q100 112 135 104" stroke="#bae6fd" stroke-width="4" fill="none"/>
    <rect x="70" y="20" width="60" height="34" rx="12" fill="url(#cap)"/>
    <rect x="82" y="10" width="36" height="16" rx="8" fill="#15803d"/>
    ${shine("M76 64 V160", 6, 0.6)}
    ${bubble(108, 140, 6)}${bubble(120, 122, 4)}
    <path d="M160 70 C150 84 150 96 160 100 C170 96 170 84 160 70 Z" fill="#38bdf8"/>`;

  // ---- Tidy toys: a teddy and a toy block -----------------------------------------------
  ART.toys = () => `
    ${defs(lit("fur", "#e7b98a", "#c08552", "#7c4a1e"), lit("muz", "#fdf0dc", "#f2d3a8", "#c9965e"), lit("blk", "#93c5fd", "#3b82f6", "#1e40af"), lit("blk2", "#fde68a", "#f59e0b", "#b45309"))}
    ${floor(70)}
    <rect x="128" y="120" width="52" height="52" rx="10" fill="url(#blk)"/>${star5(154, 146, 14, "#fde047")}
    <rect x="140" y="80" width="38" height="38" rx="8" fill="url(#blk2)"/><circle cx="159" cy="99" r="9" fill="#fff7ed"/>
    <circle cx="58" cy="38" r="16" fill="url(#fur)"/><circle cx="118" cy="38" r="16" fill="url(#fur)"/>
    <circle cx="58" cy="38" r="8" fill="#f2d3a8"/><circle cx="118" cy="38" r="8" fill="#f2d3a8"/>
    <ellipse cx="88" cy="140" rx="46" ry="42" fill="url(#fur)"/>
    <ellipse cx="88" cy="146" rx="26" ry="24" fill="url(#muz)"/>
    <ellipse cx="50" cy="168" rx="18" ry="14" fill="url(#fur)"/><ellipse cx="126" cy="168" rx="18" ry="14" fill="url(#fur)"/>
    <ellipse cx="50" cy="170" rx="9" ry="7" fill="#f2d3a8"/><ellipse cx="126" cy="170" rx="9" ry="7" fill="#f2d3a8"/>
    <circle cx="88" cy="70" r="42" fill="url(#fur)"/>
    <ellipse cx="88" cy="84" rx="18" ry="14" fill="url(#muz)"/>
    <ellipse cx="88" cy="78" rx="7" ry="5" fill="#3b1d0e"/>
    <path d="M80 90 Q88 96 96 90" stroke="#3b1d0e" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="72" cy="62" r="6" fill="#1f130a"/><circle cx="104" cy="62" r="6" fill="#1f130a"/>
    <circle cx="70" cy="60" r="2.2" fill="#fff"/><circle cx="102" cy="60" r="2.2" fill="#fff"/>
    <path d="M72 112 L88 122 L104 112 L88 104 Z" fill="#ef4444"/>
    ${shine("M60 50 Q68 36 84 32", 4, 0.45)}`;

  // ---- Bath: a tub of bubbles and a rubber duck -----------------------------------------
  ART.bath = () => `
    ${defs(lit("tub", "#ffffff", "#f1f5f9", "#94a3b8"), lit("duck", "#fef08a", "#facc15", "#ca8a04"), bubDef)}
    ${floor(74)}
    ${bubble(60, 78, 18)}${bubble(88, 70, 22)}${bubble(120, 76, 18)}${bubble(146, 84, 14)}${bubble(42, 92, 12)}${bubble(104, 44, 10)}${bubble(70, 46, 8)}
    <path d="M18 96 H182 C182 140 160 168 120 168 H80 C40 168 18 140 18 96 Z" fill="url(#tub)"/>
    <rect x="14" y="88" width="172" height="16" rx="8" fill="#e2e8f0"/>
    <path d="M44 166 L36 182 M156 166 L164 182" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>
    ${shine("M30 112 Q38 146 70 160", 6, 0.6)}
    <g transform="translate(116 46)">
      <ellipse cx="30" cy="40" rx="28" ry="18" fill="url(#duck)"/>
      <circle cx="22" cy="18" r="16" fill="url(#duck)"/>
      <path d="M4 18 Q-6 22 4 26 Q10 24 8 20 Z" fill="#f97316"/>
      <circle cx="18" cy="14" r="3.5" fill="#1f130a"/><circle cx="17" cy="13" r="1.2" fill="#fff"/>
      <path d="M30 40 Q40 32 50 40" stroke="#ca8a04" stroke-width="3" fill="none" opacity="0.6"/>
    </g>`;

  // ---- Story time: an open picture book with stars --------------------------------------
  ART.story = () => `
    ${defs(lit("cov", "#c4b5fd", "#8b5cf6", "#5b21b6"), lin("pgL", [[0, "#ffffff"], [1, "#e2e8f0"]], 1, 0), lin("pgR", [[0, "#e2e8f0"], [1, "#ffffff"]], 1, 0))}
    ${floor(74)}
    <path d="M14 70 Q56 56 100 72 Q144 56 186 70 L186 166 Q144 152 100 168 Q56 152 14 166 Z" fill="url(#cov)"/>
    <path d="M22 64 Q60 52 98 66 L98 158 Q60 146 22 158 Z" fill="url(#pgL)"/>
    <path d="M102 66 Q140 52 178 64 L178 158 Q140 146 102 158 Z" fill="url(#pgR)"/>
    <path d="M100 66 V164" stroke="#5b21b6" stroke-width="3" opacity="0.5"/>
    <circle cx="58" cy="94" r="14" fill="#fde047"/>
    <path d="M32 140 Q48 112 62 132 Q74 116 90 140 Z" fill="#4ade80"/>
    ${[118, 128, 138].map(y => `<path d="M112 ${y - 22} Q140 ${y - 30} 168 ${y - 24}" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" opacity="0.6"/>`).join("")}
    <path d="M114 134 Q140 126 166 132" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    ${star5(70, 34, 10, "#fde047")}${star5(130, 26, 12, "#facc15")}${spark(100, 40, 7, "#fff")}${spark(160, 44, 6)}`;

  // ---- Lights out: a sleepy moon and stars ----------------------------------------------
  ART.lights = () => `
    ${defs(lit("moon", "#fef9c3", "#fde047", "#ca8a04"), `<radialGradient id="glow" cx="50%" cy="50%" r="50%">${st([[0, "#fde68a", 0.55], [1, "#fde68a", 0]])}</radialGradient>`)}
    <circle cx="96" cy="100" r="88" fill="url(#glow)"/>
    <path d="M118 22 C70 26 44 66 50 108 C56 150 98 178 140 166 C104 158 82 126 84 92 C86 60 104 34 118 22 Z" fill="url(#moon)"/>
    <path d="M70 92 Q78 100 86 92" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M78 124 Q88 132 98 126" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="70" cy="110" rx="8" ry="5" fill="#fb923c" opacity="0.45"/>
    ${shine("M64 56 Q72 40 90 32", 5, 0.6)}
    ${star5(150, 54, 14, "#fde047")}${star5(166, 110, 9, "#fef08a")}${star5(136, 92, 6, "#fff")}${spark(40, 40, 8, "#fff")}${spark(30, 150, 6)}
    <path d="M150 140 h14 l-14 14 h14 M168 124 h10 l-10 10 h10" stroke="#a78bfa" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  // ---- Say prayers: two hands together in a warm glow -----------------------------------
  ART.prayers = () => `
    ${defs(lit("skL", "#fde2c4", "#f2b98a", "#c47e4e"), lit("skR", "#fbd5b0", "#e9a877", "#b06c3d", "60%", "28%"), `<radialGradient id="glow" cx="50%" cy="45%" r="50%">${st([[0, "#fef3c7", 0.95], [0.6, "#fde68a", 0.5], [1, "#fde68a", 0]])}</radialGradient>`, lit("cuff", "#bfdbfe", "#60a5fa", "#1d4ed8"))}
    <circle cx="100" cy="94" r="84" fill="url(#glow)"/>
    ${floor(50)}
    <path d="M99 28 C90 28 84 34 82 46 C80 58 74 84 70 108 C66 132 66 152 78 162 L99 166 Z" fill="url(#skL)"/>
    <path d="M101 28 C110 28 116 34 118 46 C120 58 126 84 130 108 C134 132 134 152 122 162 L101 166 Z" fill="url(#skR)"/>
    <path d="M84 50 C88 47 94 47 99 50 M80 66 C86 63 93 63 99 66 M76 82 C83 79 92 79 99 82" stroke="#b06c3d" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M116 50 C112 47 106 47 101 50 M120 66 C114 63 107 63 101 66 M124 82 C117 79 108 79 101 82" stroke="#b06c3d" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M100 30 V164" stroke="#b06c3d" stroke-width="2.4" opacity="0.6"/>
    <path d="M86 100 C80 110 80 130 88 140 C94 144 99 140 99 132 L99 108 C96 100 90 96 86 100 Z" fill="url(#skL)" stroke="#c47e4e" stroke-width="1.5" stroke-opacity="0.5"/>
    <path d="M114 100 C120 110 120 130 112 140 C106 144 101 140 101 132 L101 108 C104 100 110 96 114 100 Z" fill="url(#skR)" stroke="#b06c3d" stroke-width="1.5" stroke-opacity="0.5"/>
    <path d="M64 158 C64 152 70 148 78 150 L100 160 L122 150 C130 148 136 152 136 158 L136 184 H64 Z" fill="url(#cuff)"/>
    ${shine("M88 40 Q84 64 80 92", 4, 0.55)}
    ${spark(42, 50, 9, "#fff")}${spark(160, 44, 8)}${spark(158, 128, 6, "#fff")}${spark(40, 122, 6)}`;

  // ---- Feed the pet: a bowl of food with a paw print ------------------------------------
  ART.pet = () => `
    ${defs(lit("pb", "#fca5a5", "#ef4444", "#991b1b"), lit("kib", "#d6a26b", "#a86a32", "#6b3f17"))}
    ${floor(70)}
    ${[[62, 96], [80, 88], [98, 94], [116, 86], [134, 96], [74, 104], [108, 104], [126, 106], [90, 80], [144, 104], [56, 106]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="10" ry="8" fill="url(#kib)"/>`).join("")}
    <path d="M22 104 C22 112 30 120 40 124 L56 168 C58 174 64 178 72 178 H128 C136 178 142 174 144 168 L160 124 C170 120 178 112 178 104 Z" fill="url(#pb)"/>
    <rect x="18" y="100" width="164" height="14" rx="7" fill="#f87171"/>
    <g fill="#fff7ed" opacity="0.95"><ellipse cx="100" cy="150" rx="13" ry="11"/><circle cx="84" cy="132" r="6"/><circle cx="96" cy="126" r="6"/><circle cx="108" cy="126" r="6"/><circle cx="120" cy="132" r="6"/></g>
    ${shine("M36 122 Q46 150 60 166", 5, 0.45)}
    ${spark(160, 56, 9)}${spark(40, 60, 6, "#fff")}`;

  // ---- Help set the table: plate, knife and fork ----------------------------------------
  ART.table = () => `
    ${defs(lit("mat", "#86efac", "#22c55e", "#15803d"), lit("plate", "#ffffff", "#f8fafc", "#cbd5e1"), lit("met", "#f8fafc", "#cbd5e1", "#64748b"))}
    ${floor(80)}
    <ellipse cx="100" cy="112" rx="92" ry="64" fill="url(#mat)"/>
    <circle cx="100" cy="110" r="50" fill="url(#plate)"/>
    <circle cx="100" cy="110" r="34" fill="none" stroke="#e2e8f0" stroke-width="4"/>
    ${shine("M66 92 Q72 74 90 66", 5, 0.8)}
    <path d="M30 70 V100 M38 70 V100 M46 70 V100 M30 100 Q38 112 46 100" stroke="url(#met)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="34" y="104" width="8" height="58" rx="4" fill="url(#met)"/>
    <path d="M162 68 C172 70 174 96 170 112 L162 112 Z" fill="url(#met)"/>
    <rect x="158" y="108" width="8" height="54" rx="4" fill="url(#met)"/>
    ${star5(100, 110, 10, "#fde047")}`;

  // ---- Clothes in the wash basket -------------------------------------------------------
  ART.laundry = () => `
    ${defs(lit("bask", "#fde68a", "#e2b35a", "#9a6b1e"), lit("shirt", "#93c5fd", "#3b82f6", "#1e40af"), lit("sock", "#f9a8d4", "#ec4899", "#9d174d"))}
    ${floor(68)}
    <path d="M70 76 C66 50 80 30 100 28 L126 40 L118 70 Z" fill="url(#shirt)"/>
    <path d="M118 74 C126 48 148 40 162 52 C170 60 160 70 150 68 L136 80 Z" fill="url(#sock)"/>
    <path d="M52 78 C48 56 58 44 70 46 L84 80 Z" fill="#facc15"/>
    <path d="M30 76 H170 L156 172 C154 178 148 182 140 182 H60 C52 182 46 178 44 172 Z" fill="url(#bask)"/>
    ${[96, 120, 144, 166].map(y => `<path d="M${38 + (y - 76) * 0.14} ${y} H${162 - (y - 76) * 0.14}" stroke="#9a6b1e" stroke-width="3" opacity="0.45"/>`).join("")}
    ${[64, 88, 112, 136].map(x => `<path d="M${x} 82 L${x + (x - 100) * -0.1} 178" stroke="#9a6b1e" stroke-width="3" opacity="0.35"/>`).join("")}
    <rect x="24" y="68" width="152" height="16" rx="8" fill="#e2b35a"/>
    <rect x="72" y="104" width="56" height="20" rx="10" fill="#fff7ed" opacity="0.9"/>
    ${shine("M40 92 Q46 134 58 166", 5, 0.4)}`;

  // ---- Brush your hair ------------------------------------------------------------------
  ART.hair = () => `
    ${defs(lit("hb", "#f9a8d4", "#ec4899", "#9d174d"), lin("pad", [[0, "#fdf2f8"], [1, "#fbcfe8"]]))}
    ${floor(50)}
    <g transform="rotate(30 100 100)">
      <rect x="88" y="104" width="24" height="80" rx="12" fill="url(#hb)"/>
      <ellipse cx="100" cy="66" rx="44" ry="54" fill="url(#hb)"/>
      <ellipse cx="100" cy="64" rx="34" ry="42" fill="url(#pad)"/>
      ${[[86, 40], [100, 36], [114, 40], [80, 56], [93, 54], [107, 54], [120, 56], [80, 72], [93, 72], [107, 72], [120, 72], [86, 88], [100, 92], [114, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#be185d"/>`).join("")}
      ${shine("M64 50 Q66 30 82 20", 5, 0.5)}
    </g>
    ${spark(40, 50, 9)}${spark(160, 160, 7, "#fff")}`;

  // ---- Homework: a pencil and a page with a star ----------------------------------------
  ART.homework = () => `
    ${defs(lin("pg", [[0, "#ffffff"], [1, "#e2e8f0"]]), lit("pen", "#fde68a", "#facc15", "#ca8a04"))}
    ${floor(60)}
    <rect x="34" y="30" width="110" height="146" rx="12" fill="url(#pg)" transform="rotate(-6 89 103)"/>
    ${[66, 88, 110, 132].map(y => `<path d="M${52} ${y + 4} Q90 ${y - 2} ${124} ${y - 8}" stroke="#93c5fd" stroke-width="4" stroke-linecap="round"/>`).join("")}
    ${star5(70, 150, 14, "#f43f5e")}
    <g transform="rotate(35 140 110)">
      <rect x="128" y="34" width="26" height="120" rx="6" fill="url(#pen)"/>
      <rect x="128" y="34" width="26" height="18" rx="6" fill="#f472b6"/><rect x="128" y="48" width="26" height="8" fill="#cbd5e1"/>
      <path d="M128 154 L141 182 L154 154 Z" fill="#fde2c4"/><path d="M136 172 L141 182 L146 172 Z" fill="#1f2937"/>
      ${shine("M134 60 V146", 4, 0.5)}
    </g>`;

  // ---- Practise music: a little keyboard ------------------------------------------------
  ART.music = () => `
    ${defs(lit("kb", "#a5b4fc", "#6366f1", "#3730a3"), lin("key", [[0, "#ffffff"], [1, "#e2e8f0"]]))}
    ${floor(78)}
    <rect x="16" y="70" width="168" height="96" rx="18" fill="url(#kb)"/>
    <rect x="28" y="104" width="144" height="52" rx="6" fill="#1e1b4b"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${30 + i * 17.7}" y="106" width="16" height="48" rx="3" fill="url(#key)"/>`).join("")}
    ${[0, 1, 3, 4, 5].map(i => `<rect x="${41 + i * 17.7}" y="106" width="10" height="28" rx="2" fill="#1e1b4b"/>`).join("")}
    <circle cx="44" cy="86" r="7" fill="#f43f5e"/><circle cx="64" cy="86" r="7" fill="#facc15"/><circle cx="84" cy="86" r="7" fill="#22c55e"/>
    ${shine("M30 80 Q60 74 100 76", 4, 0.5)}
    <path d="M136 22 V52 a9 7 0 1 1 -6 -6 V28 L160 22 V46 a9 7 0 1 1 -6 -6 V30" fill="#f472b6" stroke="#f472b6" stroke-width="4" stroke-linejoin="round"/>`;

  // ---- Vitamins: a smiley gummy jar -----------------------------------------------------
  ART.vitamins = () => `
    ${defs(lin("jar", [[0, "#fff7ed", 0.95], [1, "#fed7aa", 0.95]], 1, 0), lit("lid", "#86efac", "#22c55e", "#15803d"))}
    ${floor(50)}
    <rect x="50" y="56" width="100" height="124" rx="24" fill="url(#jar)" stroke="#fdba74" stroke-width="3"/>
    <rect x="56" y="30" width="88" height="32" rx="12" fill="url(#lid)"/>
    ${[[76, 120, "#f43f5e"], [104, 112, "#facc15"], [128, 128, "#22c55e"], [88, 150, "#a855f7"], [118, 156, "#fb923c"]].map(([x, y, c]) => `<path d="M${x - 10} ${y + 10} C${x - 12} ${y - 6} ${x - 4} ${y - 12} ${x} ${y - 12} C${x + 4} ${y - 12} ${x + 12} ${y - 6} ${x + 10} ${y + 10} Z" fill="${c}"/><circle cx="${x - 4}" cy="${y - 4}" r="2" fill="#1f130a"/><circle cx="${x + 4}" cy="${y - 4}" r="2" fill="#1f130a"/>`).join("")}
    ${shine("M62 72 V164", 6, 0.6)}`;

  let copies = 0;
  function svgFor(key) {
    if (!ART[key]) return "";
    const n = (copies = (copies + 1) % 1e6);
    const art = ART[key]().replace(/id="([^"]+)"/g, `id="$1-j${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-j${n})`);
    return `<svg class="job-svg job-${key}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${art}</svg>`;
  }
  window.JobArt = { ART, svgFor, has: (key) => !!ART[key], keys: () => Object.keys(ART) };
})();
