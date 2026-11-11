// ============================================================================
// JOB PICTURES (js/job-art.js) · drawings for picture jobs (js/picture-jobs.js)
// Original drawings in the buddies' soft 3D style (js/buddy-art.js): lit from
// the top left, chunky shapes, soft shadows. 200 x 200 each, keyed like
// PictureJobs.PICTURES ("teeth", "bed"...). A job without a drawing shows its
// emoji. Each copy gets its own gradient names (see svgFor).
// ============================================================================
(function () {
  const ART = {};
  let copies = 0;
  function svgFor(key) {
    if (!ART[key]) return "";
    const n = (copies = (copies + 1) % 1e6);
    const art = ART[key]().replace(/id="([^"]+)"/g, `id="$1-j${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-j${n})`);
    return `<svg class="job-svg job-${key}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${art}</svg>`;
  }
  window.JobArt = { ART, svgFor, has: (key) => !!ART[key] };
})();
