document.addEventListener('DOMContentLoaded',()=>{
  const toggle=document.querySelector('.menu-toggle');
  const nav=document.querySelector('.main-nav');
  if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});}

  // Evita que el botón flotante tape el pie de página.
  const floating=document.querySelector('.floating-whatsapp');
  const footer=document.querySelector('.site-footer');
  if(floating&&footer&&'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      floating.classList.toggle('is-hidden',entries.some(entry=>entry.isIntersecting));
    },{threshold:0.01});
    observer.observe(footer);
  }
});
