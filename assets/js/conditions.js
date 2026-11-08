(async()=>{
 const {escapeHtml}=Site;
 try{
  const data=await Site.loadCatalog();
  document.getElementById('conditions-list').innerHTML=data.conditions.map(text=>`<li>${escapeHtml(text)}</li>`).join('');
  document.getElementById('procedure-steps').innerHTML=data.procedure.map(step=>`<div class="procedure-step"><span>${escapeHtml(step.number)}</span><strong>${escapeHtml(step.title)}</strong></div>`).join('');
  document.getElementById('procedure-note').textContent=data.procedure_note;
 }catch(error){
  const message='No se pudo cargar la información. Comprueba data/catalogo.json.';
  document.getElementById('conditions-list').innerHTML=`<li>${message}</li>`;
  document.getElementById('procedure-note').textContent=message;
 }
})();
