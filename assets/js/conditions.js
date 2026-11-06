(async()=>{
 try{
  const response=await fetch('data/catalogo.json');const data=await response.json();
  document.getElementById('conditions-list').innerHTML=data.conditions.map(text=>`<li>${escapeHtml(text)}</li>`).join('');
  document.getElementById('procedure-steps').innerHTML=data.procedure.map(step=>`<div class="procedure-step"><span>${escapeHtml(step.number)}</span><strong>${escapeHtml(step.title)}</strong></div>`).join('');
  document.getElementById('procedure-note').textContent=data.procedure_note;
 }catch(error){document.getElementById('conditions-list').innerHTML='<li>No se pudo cargar la información. Comprueba data/catalogo.json.</li>';}
 function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
})();
