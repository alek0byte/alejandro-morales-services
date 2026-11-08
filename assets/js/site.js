document.addEventListener('DOMContentLoaded',()=>{
  /* ---------- Menú móvil ---------- */
  const toggle=document.querySelector('.menu-toggle');
  const nav=document.querySelector('.main-nav');
  if(toggle&&nav){
    const setOpen=open=>{
      nav.classList.toggle('open',open);
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
    };
    toggle.addEventListener('click',()=>setOpen(!nav.classList.contains('open')));
    // Cerrar con Escape y devolver el foco al botón.
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&nav.classList.contains('open')){
        setOpen(false);toggle.focus();
      }
    });
    // Cerrar al tocar fuera del menú.
    document.addEventListener('click',event=>{
      if(nav.classList.contains('open')&&!nav.contains(event.target)&&!toggle.contains(event.target))setOpen(false);
    });
    // Cerrar al elegir un enlace.
    nav.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
    // Cerrar si se pasa a escritorio. Debe coincidir con @media(max-width:650px) de site.css.
    const mobile=window.matchMedia('(max-width:650px)');
    const onChange=event=>{if(!event.matches)setOpen(false);};
    if(mobile.addEventListener)mobile.addEventListener('change',onChange);
    else if(mobile.addListener)mobile.addListener(onChange);
  }

  /* ---------- Copiar número de teléfono ---------- */
  document.querySelectorAll('[data-copy]').forEach(button=>{
    const status=document.getElementById(button.getAttribute('data-copy-status')||'');
    const original=button.textContent;
    button.addEventListener('click',async()=>{
      const value=button.getAttribute('data-copy');
      const legacyCopy=()=>{
        const field=document.createElement('textarea');
        field.value=value;
        field.setAttribute('readonly','');
        field.style.position='fixed';
        field.style.opacity='0';
        document.body.appendChild(field);
        field.select();
        let copied=false;
        try{copied=document.execCommand('copy');}catch(error){copied=false;}
        field.remove();
        return copied;
      };
      try{
        let copied=false;
        if(navigator.clipboard&&window.isSecureContext){
          try{await navigator.clipboard.writeText(value);copied=true;}
          catch(error){copied=false;}
        }
        if(!copied)copied=legacyCopy();
        if(!copied)throw new Error('No se pudo copiar');
        button.textContent='Copiado ✓';
        if(status)status.textContent='Número copiado al portapapeles';
        setTimeout(()=>{button.textContent=original;if(status)status.textContent='';},1800);
      }catch(error){
        if(status)status.textContent='No se pudo copiar. El número es '+value;
      }
    });
  });

  /* ---------- Evita que el botón flotante tape el pie de página ---------- */
  const floating=document.querySelector('.floating-whatsapp');
  const footer=document.querySelector('.site-footer');
  if(floating&&footer&&'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      floating.classList.toggle('is-hidden',entries.some(entry=>entry.isIntersecting));
    },{threshold:0.01});
    observer.observe(footer);
  }
});
