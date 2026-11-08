/* Utilidades compartidas por catalog.js y conditions.js (se carga antes que ellos). */
window.Site=window.Site||{};

// Escapa texto antes de insertarlo como HTML.
Site.escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Una sola petición de data/catalogo.json aunque varias partes de la página lo necesiten.
Site.loadCatalog=()=>{
  if(!Site.catalogPromise){
    Site.catalogPromise=fetch('data/catalogo.json').then(response=>{
      if(!response.ok)throw new Error('No se pudo cargar el catálogo');
      return response.json();
    });
  }
  return Site.catalogPromise;
};
