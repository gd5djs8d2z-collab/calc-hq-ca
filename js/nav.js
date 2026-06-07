/* ── Hamburger menu toggle ────────────────────────────────────────────────── */

(function () {
  'use strict';

  var hamburger = document.querySelector('.hamburger');
  var mobileNav = document.getElementById('mobile-nav');
  var overlay = document.getElementById('mobile-overlay');

  if (!hamburger || !mobileNav || !overlay) {
    return;
  }

  function closeMenu() {
    hamburger.classList.remove('active');
    mobileNav.classList.remove('active');
    overlay.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function toggleMenu() {
    var isOpen = hamburger.classList.toggle('active');
    mobileNav.classList.toggle('active', isOpen);
    overlay.classList.toggle('active', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  hamburger.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', closeMenu);

  mobileNav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });
})();
