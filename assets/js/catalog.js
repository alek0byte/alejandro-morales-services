(async()=>{
 const {escapeHtml}=Site;
 const container=document.getElementById('catalog-content');
 const filters=document.getElementById('category-filters');
 const search=document.getElementById('service-search');
 const status=document.getElementById('catalog-status');
 if(!container||!filters||!search)return;
 let catalog;
 try{
  catalog=await Site.loadCatalog();
 }
 catch(error){container.innerHTML='<p class="empty-state">No se pudo cargar el catálogo. Comprueba que data/catalogo.json esté en el repositorio.</p>';return;}
 let active='Todas';
 let interacted=false;
 const categories=['Todas',...catalog.services.map(group=>group.category)];
 filters.innerHTML=categories.map(category=>`<button class="filter-button ${category==='Todas'?'active':''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category==='Todas'}">${escapeHtml(category)}</button>`).join('');
 function announce(count){
  if(!status)return;
  status.textContent=count===0?'No se encontraron servicios':count+(count===1?' servicio encontrado':' servicios encontrados');
 }
 function render(){
  const query=search.value.trim().toLocaleLowerCase('es');
  let visible=0;
  container.innerHTML=catalog.services.map((group,index)=>{
   if(active!=='Todas'&&active!==group.category)return '';
   const items=group.items.filter(item=>(group.category+' '+item.name+' '+(item.description||'')+' '+(item.price||'')+' '+(item.subcategory||'')).toLocaleLowerCase('es').includes(query));
   if(!items.length)return '';
   visible+=items.length;
   const cards=items.map(item=>{
    if(item.type==='capacity')return `<article class="service-item"><div><p>${escapeHtml(item.name)}</p><p class="muted">${escapeHtml(item.description)}</p></div><div class="service-bottom">${item.prices.map(price=>`<span class="service-price">${escapeHtml(price.label)} · ${escapeHtml(price.price)}</span>`).join('<br>')}</div></article>`;
    return `<article class="service-item"><div>${item.offer?'<span class="offer-badge">PAQUETE DE OFERTA</span>':''}${item.subcategory?`<span class="subcat-label">${escapeHtml(item.subcategory)}</span>`:''}<p>${escapeHtml(item.name)}</p></div><div class="service-bottom"><span></span><strong class="service-price">${escapeHtml(item.price||'Consultar')}</strong></div></article>`;
   }).join('');
   return `<section class="category-block" id="${slug(group.category)}"><div class="category-heading"><span>${String(index+1).padStart(2,'0')} /</span><h2>${escapeHtml(group.category)}</h2></div><div class="service-list">${cards}</div>${group.note?`<p class="category-note">${escapeHtml(group.note)}</p>`:''}</section>`;
  }).join('');
  if(!visible)container.innerHTML='<p class="empty-state">No se encontraron servicios con esa búsqueda. <button type="button" class="link-button" id="clear-filters">Ver todos los servicios</button></p>';
  if(interacted)announce(visible);
 }
 function slug(text){return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
 function setActive(category){
  active=category;
  filters.querySelectorAll('button[data-category]').forEach(button=>{
   const isActive=button.dataset.category===category;
   button.classList.toggle('active',isActive);
   button.setAttribute('aria-pressed',String(isActive));
  });
 }
 filters.addEventListener('click',event=>{
  const button=event.target.closest('button[data-category]');
  if(!button)return;
  interacted=true;
  setActive(button.dataset.category);
  render();
 });
 search.addEventListener('input',()=>{interacted=true;render();});
 container.addEventListener('click',event=>{
  if(!event.target.closest('#clear-filters'))return;
  interacted=true;
  search.value='';
  setActive('Todas');
  render();
  search.focus();
 });
 render();

 // Navegar a una categoría concreta cuando se llega desde un enlace (#categoria).
 // El catálogo se pinta después del fetch, así que el destino no existe todavía
 // cuando se ejecuta este script: hay que buscarlo de nuevo tras renderizar.
 async function navigateToCategory(){
  if(!window.location.hash)return;
  if(document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
  let target=null;
  try{target=document.querySelector(window.location.hash);}catch(error){return;}
  if(!target)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
 }
 await navigateToCategory();
 window.addEventListener('hashchange',navigateToCategory);
})();
