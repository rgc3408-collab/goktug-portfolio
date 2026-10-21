document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav) toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  toggle.textContent = open ? '×' : '☰';
});

