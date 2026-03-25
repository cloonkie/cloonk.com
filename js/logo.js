/* logo.js — unified logo with random kaomoji hover variants */
(function () {
  const VARIANTS = [
    'cloonk ʕ·ᴥ·ʔ⭐',
    'cloonk ʕง•ᴥ•ʔง',
    'cloonk ʕ༼ƈل͜ƈ༽ʔ',
    'cloonk ʕ⊙ᴥ⊙ʔ',
    'cloonk ʕ´•㈨•`ʔ',
    'cloonk ʕ◉ᴥ◉ʔ',
    'cloonk ʕっ•ᴥ•ʔっ',
    'cloonk ʕ´•ᴥ•`ʔ',
  ];
  const DEFAULT = 'cloonk ʕ·ᴥ·ʔ';

  function pickVariant(exclude) {
    let v;
    do { v = VARIANTS[Math.floor(Math.random() * VARIANTS.length)]; }
    while (v === exclude && VARIANTS.length > 1);
    return v;
  }

  document.querySelectorAll('.nav__logo').forEach(logo => {
    logo.addEventListener('mouseenter', () => {
      logo.textContent = pickVariant(logo.textContent);
    });
    logo.addEventListener('mouseleave', () => {
      logo.textContent = DEFAULT;
    });
  });
})();
