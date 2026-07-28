/* Gallery — real photos from assets/img/, with graceful placeholders.
   Add or swap images by editing the PHOTOS list below. */
(function () {
  window.DRS = window.DRS || {};

  const PHOTOS = [
    { file: 'conf-icml.jpg',   cap: 'ICML 2026 · with the crew',                cls: 'gcard--wide' },
    { file: 'llnl-cohort.jpg', cap: 'The DSSI cohort at Lawrence Livermore',     cls: 'gcard--wide' },
    { file: 'llnl.jpg',        cap: 'Sierra granite · summer at LLNL',           cls: 'gcard--tall' },
    { file: 'nvidia-gtc.jpg',  cap: 'NVIDIA GTC · repping Hopkins',              cls: '' },
    { file: 'iitm-grad.jpg',   cap: 'M.Tech convocation · IIT Madras',           cls: '' },
    { file: 'poster-icml.jpg', cap: 'Poster session · ICML 2026',               cls: '' },
    { file: 'emi2025.jpg',     cap: 'EMI 2025 · Engineering Mechanics Institute',cls: '' },
    { file: 'wse2025.jpg',     cap: 'Research retreat · Whiting School, JHU',    cls: 'gcard--wide' },
    { file: 'hopkins.jpg',     cap: 'Building the Hopkins coffee-bot ☕',         cls: '' },
    { file: 'team-fun.jpg',    cap: 'The lab, off duty',                         cls: '' },
    { file: 'nvidia-gtc2.jpg', cap: 'On the exhibition floor · GTC',             cls: '' },
  ];

  DRS.gallery = function (grid) {
    if (!grid) return;
    PHOTOS.forEach((ph) => {
      const card = document.createElement('div');
      card.className = 'gcard ' + ph.cls;
      const img = new Image();
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = ph.cap;
      const cap = document.createElement('div');
      cap.className = 'gcard__cap';
      cap.textContent = ph.cap;
      // append immediately so the (lazy) image actually loads; swap to a
      // placeholder only if it genuinely fails.
      card.appendChild(img);
      card.appendChild(cap);
      img.onerror = () => {
        card.innerHTML = '';
        const ph2 = document.createElement('div');
        ph2.className = 'gcard__ph';
        ph2.innerHTML = '<span>🖼️</span><span>' + ph.cap + '</span><span style="opacity:.6">assets/img/' + ph.file + '</span>';
        card.appendChild(ph2);
      };
      img.src = 'assets/img/' + ph.file;
      grid.appendChild(card);
    });
  };
})();
