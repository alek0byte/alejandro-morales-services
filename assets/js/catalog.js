(async()=>{
 const container=document.getElementById('catalog-content');
 const filters=document.getElementById('category-filters');
 const search=document.getElementById('service-search');
 if(!container||!filters||!search)return;
 let catalog;
 try{const response=await fetch('data/catalogo.json');if(!response.ok)throw new Error('No se pudo cargar el catálogo');catalog=await response.json();}
 catch(error){container.innerHTML='<p class="empty-state">No se pudo cargar el catálogo. Comprueba que data/catalogo.json esté en el repositorio.</p>';return;}
 let active='Todas';
 const categories=['Todas',...catalog.services.map(group=>group.category)];
 filters.innerHTML=categories.map(category=>`<button class="filter-button ${category==='Todas'?'active':''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
 function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
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
  if(!visible)container.innerHTML='<p class="empty-state">No se encontraron servicios con esa búsqueda.</p>';
 }
 function slug(text){return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
 filters.addEventListener('click',event=>{const button=event.target.closest('button[data-category]');if(!button)return;active=button.dataset.category;filters.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));render();});
 search.addEventListener('input',render);
 render();
 // Navegar directamente a una categoría mediante el enlace de la URL.
function navigateToCategory() {
    if (!window.location.hash) return;

    const target = document.querySelector(
        window.location.hash
    );

    if (target) {
        target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

requestAnimationFrame(() => {
    requestAnimationFrame(navigateToCategory);
});

window.addEventListener('hashchange', navigateToCategory);
})();
