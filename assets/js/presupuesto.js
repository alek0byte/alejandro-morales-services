/* Generador de presupuestos (presupuesto.html).
   Carga data/catalogo.json, permite armar un presupuesto con cantidades y
   precios editables, lo guarda en localStorage y lo exporta a PDF (jsPDF,
   incluido localmente en assets/js/vendor) o lo comparte por WhatsApp. */
(()=>{
  const {escapeHtml}=Site;

  /* ---------- constantes y utilidades ---------- */
  const LS_DRAFT='presupuesto-draft-v1';
  const LS_SEQ='presupuesto-seq-v1';
  const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
               'septiembre','octubre','noviembre','diciembre'];

  const $=id=>document.getElementById(id);

  const fmt=n=>{
    const v=Math.round((Number(n)||0)*100)/100;
    return v.toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2});
  };
  const num=v=>{
    const n=parseFloat(String(v).replace(',','.'));
    return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:0;
  };
  const slug=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const parseISO=iso=>{const [y,m,d]=String(iso||'').split('-').map(Number);return Number.isFinite(y)&&m&&d?new Date(y,m-1,d):new Date();};
  const fmtLong=iso=>{const d=parseISO(iso);return d.getDate()+' de '+MESES[d.getMonth()]+' de '+d.getFullYear();};
  const fmtShort=iso=>{const d=parseISO(iso);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();};
  const addDays=(iso,n)=>{const d=parseISO(iso);d.setDate(d.getDate()+Number(n)||0);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const cut=(text,max)=>text.length>max?text.slice(0,max-1).trimEnd()+'…':text;

  /* "5 USD" → 5 · "Desde 10 USD" → 10 (mínimo) · "Gratis" → 0 */
  function parsePrice(text){
    const value=String(text||'');
    const m=value.match(/\d+(?:[.,]\d+)?/);
    return{
      value:m?parseFloat(m[0].replace(',','.')):0,
      desde:/\bdesde\b/i.test(value),
      gratis:/\bgratis\b/i.test(value)||!m
    };
  }

  /* El teléfono del dueño viene del catálogo; se usa tal cual en wa.me. */
  function ownerWaPhone(){
    return String(catalog&&catalog.phone||'').replace(/\D/g,'');
  }

  async function copyText(text){
    try{
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true;}
    }catch(e){}
    try{
      const field=document.createElement('textarea');
      field.value=text;field.setAttribute('readonly','');
      field.style.position='fixed';field.style.opacity='0';
      document.body.appendChild(field);field.select();
      const ok=document.execCommand('copy');field.remove();return ok;
    }catch(e){return false;}
  }

  const status=message=>{const box=$('quote-status');if(box)box.textContent=message;};

  /* ---------- estado ---------- */
  let catalog=null;
  let registry=new Map();   /* id → {category,name,priceText,parsed} */
  let activeFilter='Todas';
  let interacted=false;

  function nextNumber(){
    const year=new Date().getFullYear();
    const key=LS_SEQ+'-'+year;
    const n=parseInt(localStorage.getItem(key)||'0',10)+1;
    try{localStorage.setItem(key,String(n));}catch(e){}
    return 'PR-'+year+'-'+String(n).padStart(4,'0');
  }
  const DEFAULTS={number:'',date:'',validity:7,clientName:'',clientPhone:'',
                  items:[],travel:{on:false,amount:2},discount:0,notes:''};
  const blankState=()=>({...DEFAULTS,number:nextNumber(),date:todayISO(),
                          items:[],travel:{on:false,amount:2},discount:0,notes:''});
  let state=null;

  function restore(){
    try{
      const raw=localStorage.getItem(LS_DRAFT);
      if(!raw)return null;
      const saved=JSON.parse(raw);
      if(!saved||typeof saved!=='object')return null;
      const merged={...DEFAULTS,...saved,travel:{...DEFAULTS.travel,...(saved.travel||{})}};
      merged.validity=parseInt(merged.validity,10)||7;
      merged.discount=num(merged.discount);
      merged.travel.amount=num(merged.travel.amount);
      merged.items=Array.isArray(saved.items)?saved.items
        .filter(it=>it&&it.name&&it.category)
        .map(it=>({id:String(it.id||''),category:String(it.category),name:String(it.name),
                   qty:Math.max(1,Math.round(num(it.qty))||1),unit:num(it.unit),
                   desde:Boolean(it.desde),gratis:Boolean(it.gratis)})):[];
      return merged;
    }catch(e){return null;}
  }
  const persist=()=>{try{localStorage.setItem(LS_DRAFT,JSON.stringify(state));}catch(e){}};

  /* ---------- cálculos ---------- */
  const lineTotal=line=>Math.round(line.qty*line.unit*100)/100;
  const itemsTotal=()=>state.items.reduce((sum,line)=>sum+lineTotal(line),0);
  const grandTotal=()=>Math.max(0,Math.round((itemsTotal()+(state.travel.on?num(state.travel.amount):0)-num(state.discount))*100)/100);
  const deadline=()=>addDays(state.date,state.validity);
  const findLine=id=>state.items.find(line=>line.id===id);

  /* ---------- catálogo interactivo ---------- */
  function buildRegistry(){
    registry=new Map();
    catalog.services.forEach(group=>{
      group.items.forEach(item=>{
        registry.set(slug(group.category)+'/'+slug(item.name),{
          id:slug(group.category)+'/'+slug(item.name),
          category:group.category,name:item.name,
          priceText:item.price||'Consultar',parsed:parsePrice(item.price),
          offer:item.offer||false,subcategory:item.subcategory||''
        });
      });
    });
  }

  function buildFilters(){
    const categories=['Todas',...catalog.services.map(group=>group.category)];
    $('quote-filters').innerHTML=categories.map(category=>
      `<button class="filter-button ${category===activeFilter?'active':''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category===activeFilter}">${escapeHtml(category)}</button>`).join('');
  }

  function controlsHtml(line){
    return `<div class="quote-item-controls">
      <span class="qty-stepper">
        <button type="button" data-q="dec" aria-label="Restar cantidad">−</button>
        <input type="number" min="1" step="1" value="${line.qty}" data-q="qty" aria-label="Cantidad" inputmode="numeric">
        <button type="button" data-q="inc" aria-label="Sumar cantidad">+</button>
      </span>
      <label class="quote-unit">${line.desde?'<span class="from-badge" title="Precio mínimo orientativo">desde</span>':''}<span>USD</span><input type="number" min="0" step="0.5" value="${line.unit}" data-q="unit" aria-label="Precio unitario en USD" inputmode="decimal"></label>
      <strong class="quote-line-total">${fmt(lineTotal(line))} USD</strong>
    </div>`;
  }

  function cardHtml(entry){
    const line=findLine(entry.id);
    const selected=Boolean(line);
    return `<article class="quote-item${selected?' is-selected':''}" data-id="${entry.id}">
      <div class="quote-item-head" role="checkbox" aria-checked="${selected}" tabindex="0" aria-label="${escapeHtml(entry.name)}, ${escapeHtml(entry.priceText)}">
        <span class="quote-check" aria-hidden="true">${selected?'✓':''}</span>
        <div class="quote-item-info">${entry.offer?'<span class="offer-badge">PAQUETE DE OFERTA</span>':''}${entry.subcategory?`<span class="subcat-label">${escapeHtml(entry.subcategory)}</span>`:''}<p>${escapeHtml(entry.name)}</p></div>
        <span class="quote-item-catalog-price">${escapeHtml(entry.priceText)}</span>
      </div>
      ${selected?controlsHtml(line):''}
    </article>`;
  }

  function renderCatalog(){
    const query=$('quote-search').value.trim().toLocaleLowerCase('es');
    let visible=0;
    $('quote-catalog').innerHTML=catalog.services.map(group=>{
      if(activeFilter!=='Todas'&&activeFilter!==group.category)return'';
      const entries=group.items
        .map(item=>registry.get(slug(group.category)+'/'+slug(item.name)))
        .filter(entry=>(entry.category+' '+entry.name+' '+entry.priceText+' '+entry.subcategory).toLocaleLowerCase('es').includes(query));
      if(!entries.length)return'';
      visible+=entries.length;
      return `<section class="category-block quote-category">
        <div class="category-heading"><span>⌗</span><h2>${escapeHtml(group.category)}</h2></div>
        <div class="service-list quote-list">${entries.map(cardHtml).join('')}</div>
        ${group.note?`<p class="category-note">${escapeHtml(group.note)}</p>`:''}
      </section>`;
    }).join('');
    if(!visible)$('quote-catalog').innerHTML='<p class="empty-state">No se encontraron servicios con esa búsqueda. <button type="button" class="link-button" id="quote-clear-filters">Ver todos los servicios</button>';
    if(interacted){
      const count=$('quote-count');
      if(count)count.textContent=visible===0?'No se encontraron servicios':visible+(visible===1?' servicio encontrado':' servicios encontrados');
    }
  }

  /* ---------- desglose / resumen ---------- */
  function renderSummary(){
    const box=$('quote-lines');
    if(!state.items.length){
      box.innerHTML='<p class="empty-state">Aún no hay servicios seleccionados. Marca los servicios solicitados en el catálogo.</p>';
    }else{
      const order=new Map(catalog.services.map((group,i)=>[group.category,i]));
      const groups=[...state.items].sort((a,b)=>(order.get(a.category)??99)-(order.get(b.category)??99))
        .reduce((acc,line)=>{const last=acc[acc.length-1];last&&last.category===line.category?last.lines.push(line):acc.push({category:line.category,lines:[line]});return acc;},[]);
      box.innerHTML=groups.map(group=>`
        <div class="quote-group">
          <p class="quote-group-label">${escapeHtml(group.category)}</p>
          ${group.lines.map(line=>`
          <div class="quote-line" data-id="${line.id}">
            <p class="quote-line-name">${escapeHtml(line.name)}</p>
            <div class="quote-line-meta"><span>${line.qty} × ${fmt(line.unit)} USD</span><strong>${fmt(lineTotal(line))} USD</strong><button type="button" class="quote-remove" aria-label="Quitar ${escapeHtml(cut(line.name,40))}">✕</button></div>
          </div>`).join('')}
        </div>`).join('');
    }

    const sub=itemsTotal(),travel=state.travel.on?num(state.travel.amount):0,disc=num(state.discount),total=grandTotal();
    $('t-sub').textContent=fmt(sub)+' USD';
    $('t-travel-row').hidden=!state.travel.on;
    $('t-travel').textContent=fmt(travel)+' USD';
    $('t-disc-row').hidden=disc<=0;
    $('t-disc').textContent='−'+fmt(disc)+' USD';
    $('t-total').textContent=fmt(total)+' USD';
    $('q-travel-amount').disabled=!state.travel.on;
    persist();
  }

  /* ---------- entradas del panel ---------- */
  function syncInputs(){
    $('q-number').value=state.number;
    $('q-date').value=state.date;
    $('q-validity').value=String(state.validity);
    $('q-client').value=state.clientName;
    $('q-phone').value=state.clientPhone;
    $('q-travel').checked=state.travel.on;
    $('q-travel-amount').value=state.travel.amount;
    $('q-travel-amount').disabled=!state.travel.on;
    $('q-discount').value=state.discount;
    $('q-notes').value=state.notes;
  }

  /* ---------- texto de resumen (WhatsApp / portapapeles) ---------- */
  function summaryText(){
    const total=grandTotal();
    const lines=[
      `*Presupuesto ${state.number}*`,
      `${catalog.owner} · Servicios Informáticos`,
      ''
    ];
    if(state.clientName)lines.push(`*Cliente:* ${state.clientName}`);
    lines.push(`*Fecha:* ${fmtShort(state.date)} · *Válido hasta:* ${fmtShort(deadline())}`);
    lines.push('');
    if(state.items.length){
      lines.push('*Servicios:*');
      state.items.forEach(line=>lines.push(`• ${cut(line.name,68)} ×${line.qty} — ${fmt(lineTotal(line))} USD`));
    }
    if(state.travel.on)lines.push(`• Desplazamiento (visita a domicilio) — ${fmt(num(state.travel.amount))} USD`);
    lines.push('');
    if(state.items.length)lines.push(`Subtotal: ${fmt(itemsTotal())} USD`);
    if(num(state.discount)>0)lines.push(`Descuento: −${fmt(num(state.discount))} USD`);
    lines.push(`*TOTAL: ${fmt(total)} USD*`);
    if(state.notes.trim()){lines.push('');lines.push(`*Observaciones:* ${state.notes.trim()}`);}
    lines.push('');
    lines.push('Te adjunto el PDF con el desglose completo.');
    return lines.join('\n');
  }

  /* ---------- PDF ---------- */
  let pdfLibPromise=null;
  const ensureJsPdf=()=>pdfLibPromise||(pdfLibPromise=new Promise((resolve,reject)=>{
    if(window.jspdf&&window.jspdf.jsPDF)return resolve(window.jspdf.jsPDF);
    const script=document.createElement('script');
    script.src='assets/js/vendor/jspdf.umd.min.js';
    script.onload=()=>window.jspdf&&window.jspdf.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error('la biblioteca no está disponible'));
    script.onerror=()=>reject(new Error('no se pudo cargar el generador de PDF'));
    document.head.appendChild(script);
  }));

  let logoPromise=null;
  const loadLogo=()=>logoPromise||(logoPromise=new Promise((resolve,reject)=>{
    fetch('assets/img/logo.png').then(response=>{
      if(!response.ok)throw new Error('logo');
      return response.blob();
    }).then(blob=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('logo'));
      reader.readAsDataURL(blob);
    }).catch(reject);
  }));

  function drawQuote(doc,logo){
    const hex=color=>[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
    const INK=hex('#101820'),TEAL=hex('#78CFC0'),TEAL_DARK=hex('#245B55'),TEXT=hex('#edf4f3'),
          MUTED=hex('#5c6f6d'),LINE=hex('#dde7e4'),ZEBRA=hex('#f6f9f8'),GROUP_BG=hex('#eaf6f4'),
          BODY=hex('#24313a'),BAND=hex('#101820');
    const left=15,right=195,width=180,bottom=278;
    let y=0;
    const setFill=color=>doc.setFillColor(...color);
    const setDraw=color=>doc.setDrawColor(...color);
    const setTextColor2=color=>doc.setTextColor(...color);
    const ensureSpace=need=>{if(y+need>bottom){doc.addPage();doc.setFont('helvetica','italic');doc.setFontSize(7);setTextColor2(MUTED);doc.text(`Presupuesto ${state.number} — continuación`,left,18);y=26;}};

    /* Cabecera con banda oscura, logo y datos del presupuesto */
    setFill(BAND);doc.rect(0,0,210,38,'F');
    if(logo){try{doc.addImage(logo,'PNG',left,9,13.6,20);}catch(e){}}
    doc.setFont('helvetica','bold');doc.setFontSize(11);setTextColor2(TEXT);
    doc.text(String(catalog.owner).toUpperCase(),32,19);
    doc.setFont('helvetica','normal');doc.setFontSize(7);setTextColor2(hex('#9aacab'));
    doc.text('SERVICIOS INFORMÁTICOS',32,24.5);
    doc.setFont('helvetica','bold');doc.setFontSize(21);setTextColor2(TEXT);
    doc.text('PRESUPUESTO',right,21,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(9);setTextColor2(TEAL);
    doc.text(`${state.number} · ${fmtLong(state.date)}`,right,30,{align:'right'});

    /* Preparado por / cliente */
    y=48;
    doc.setFont('helvetica','bold');doc.setFontSize(7);setTextColor2(TEAL_DARK);
    doc.text('PREPARADO POR',left,y);doc.text('CLIENTE',112,y);
    doc.setFont('helvetica','bold');doc.setFontSize(10);setTextColor2(INK);
    doc.text(catalog.owner,left,y+6);doc.text(state.clientName||'—',112,y+6);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);setTextColor2(MUTED);
    doc.text('Servicios informáticos',left,y+11);
    doc.text(catalog.phone,left,y+16);
    if(state.clientPhone)doc.text(state.clientPhone,112,y+11);
    doc.setFont('helvetica','italic');doc.setFontSize(8.5);setTextColor2(TEAL_DARK);
    doc.text(`Válido hasta el ${fmtLong(deadline())} (${state.validity} días).`,left,y+23);

    /* Tabla de servicios */
    y+=32;
    ensureSpace(20);
    setFill(TEAL);doc.rect(left,y,width,8,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);setTextColor2(INK);
    doc.text('SERVICIO',left+2,y+5.4);doc.text('CANT.',127,y+5.4,{align:'center'});
    doc.text('PRECIO (USD)',163,y+5.4,{align:'right'});doc.text('TOTAL (USD)',right-2,y+5.4,{align:'right'});
    y+=8;

    const order=new Map(catalog.services.map((group,i)=>[group.category,i]));
    const groups=[...state.items].sort((a,b)=>(order.get(a.category)??99)-(order.get(b.category)??99))
      .reduce((acc,line)=>{const last=acc[acc.length-1];last&&last.category===line.category?last.lines.push(line):acc.push({category:line.category,lines:[line]});return acc;},[]);
    let zebra=false,hasDesde=false;

    const tableRow=(name,qtyText,unitText,totalText,options={})=>{
      doc.setFont('helvetica',options.italic?'italic':'normal');
      doc.setFontSize(8.5);
      const nameLines=doc.splitTextToSize(name,90).slice(0,3);
      if(doc.splitTextToSize(name,90).length>3)nameLines[2]=cut(nameLines[2],Math.max(10,nameLines[2].length-1));
      const rowH=Math.max(9,5.6+(nameLines.length-1)*4.3+2.6);
      ensureSpace(rowH);
      if(options.fill){setFill(options.fill);doc.rect(left,y,width,rowH,'F');}
      setDraw(LINE);doc.setLineWidth(0.15);doc.line(left,y+rowH,right,y+rowH);
      setTextColor2(options.color||BODY);
      nameLines.forEach((textLine,i)=>doc.text(textLine,left+2,y+5.9+i*4.3));
      setTextColor2(MUTED);
      doc.text(qtyText,127,y+5.9,{align:'center'});
      if(unitText!=null)doc.text(unitText,163,y+5.9,{align:'right'});
      setTextColor2(options.color||INK);
      doc.setFont('helvetica','bold');
      doc.text(totalText,right-2,y+5.9,{align:'right'});
      y+=rowH;
    };

    groups.forEach(group=>{
      const groupTotal=group.lines.reduce((sum,line)=>sum+lineTotal(line),0);
      ensureSpace(7+9);
      setFill(GROUP_BG);doc.rect(left,y,width,7,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(8);setTextColor2(TEAL_DARK);
      doc.text(group.category.toUpperCase(),left+2,y+4.9);
      doc.setFontSize(7.5);
      doc.text(`SUBTOTAL ${fmt(groupTotal)} USD`,right-2,y+4.9,{align:'right'});
      y+=7;
      group.lines.forEach(line=>{
        if(line.desde)hasDesde=true;
        tableRow(line.name,String(line.qty),fmt(line.unit),fmt(lineTotal(line)),
          {fill:zebra?ZEBRA:null});
        zebra=!zebra;
      });
    });

    if(state.travel.on){
      tableRow('Desplazamiento — visita a domicilio','1',fmt(num(state.travel.amount)),fmt(num(state.travel.amount)),{italic:true,fill:zebra?ZEBRA:null});
      zebra=!zebra;
    }

    if(hasDesde){
      y+=3.5;doc.setFont('helvetica','italic');doc.setFontSize(7);setTextColor2(MUTED);
      doc.text('* Precio mínimo orientativo; se ajusta según la complejidad del trabajo.',left+2,y+3);
      y+=3;
    }

    /* Totales */
    y+=8;ensureSpace(26);
    const totalRow=(label,value)=>{
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);setTextColor2(MUTED);
      doc.text(label,160,y,{align:'right'});doc.text(value,right-2,y,{align:'right'});
      y+=5;
    };
    if(state.items.length)totalRow('Subtotal — mano de obra',fmt(itemsTotal())+' USD');
    if(state.travel.on)totalRow('Desplazamiento',fmt(num(state.travel.amount))+' USD');
    if(num(state.discount)>0)totalRow('Descuento','−'+fmt(num(state.discount))+' USD');
    y+=1;ensureSpace(15);
    setFill(BAND);doc.rect(95,y,100,12,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(11);setTextColor2(TEXT);
    doc.text('TOTAL',100,y+8);
    doc.setFontSize(13);setTextColor2(TEAL);
    doc.text(fmt(grandTotal())+' USD',190,y+8.2,{align:'right'});
    y+=12;

    /* Observaciones */
    if(state.notes.trim()){
      y+=10;ensureSpace(18);
      doc.setFont('helvetica','bold');doc.setFontSize(8);setTextColor2(TEAL_DARK);
      doc.text('OBSERVACIONES',left+2,y);
      y+=2;
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);
      const noteLines=doc.splitTextToSize(state.notes.trim(),width-8);
      const panelH=noteLines.length*4.3+8;
      ensureSpace(panelH+6);
      setFill(ZEBRA);setDraw(LINE);doc.setLineWidth(0.15);
      doc.rect(left,y+2,width,panelH,'FD');
      setTextColor2(BODY);
      noteLines.forEach((textLine,i)=>doc.text(textLine,left+4,y+8+i*4.3));
      y+=panelH+6;
    }

    /* Condiciones del servicio (del catálogo) */
    y+=6;ensureSpace(16);
    doc.setFont('helvetica','bold');doc.setFontSize(8);setTextColor2(TEAL_DARK);
    doc.text('CONDICIONES DEL SERVICIO',left+2,y);
    y+=6;
    (catalog.conditions||[]).forEach((condition,index)=>{
      doc.setFont('helvetica','normal');doc.setFontSize(7.2);
      const conditionLines=doc.splitTextToSize(condition,width-12);
      const itemH=conditionLines.length*3.6+2;
      ensureSpace(itemH);
      doc.setFont('helvetica','bold');setTextColor2(TEAL_DARK);
      doc.text(String(index+1).padStart(2,'0')+'.',left+2,y+3);
      setTextColor2(MUTED);
      conditionLines.forEach((textLine,i)=>doc.text(textLine,left+12,y+3+i*3.6));
      y+=itemH;
    });

    /* Pie de página en todas las hojas */
    const pages=doc.getNumberOfPages();
    for(let p=1;p<=pages;p++){
      doc.setPage(p);
      setDraw(hex('#d9e5e2'));doc.setLineWidth(0.2);doc.line(left,283,right,283);
      doc.setFont('helvetica','normal');doc.setFontSize(6.8);setTextColor2(MUTED);
      doc.text(`${catalog.owner} · Servicios Informáticos · ${catalog.phone}`,left,287);
      doc.text(`Página ${p} de ${pages}`,right,287,{align:'right'});
    }
  }

  async function makePdf(){
    if(!state.items.length&&!state.travel.on){
      status('Añade al menos un servicio o el desplazamiento antes de generar el PDF.');
      $('q-search').focus();
      return;
    }
    const button=$('q-pdf'),original=button.textContent;
    button.disabled=true;button.textContent='Generando PDF…';
    try{
      const jsPDF=await ensureJsPdf();
      const logo=await loadLogo().catch(()=>null);
      const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
      doc.setProperties({title:'Presupuesto '+state.number,author:catalog.owner,
                         subject:'Presupuesto de servicios informáticos',creator:'alek0byte'});
      drawQuote(doc,logo);
      const client=state.clientName?'-'+slug(state.clientName):'';
      doc.save(`Presupuesto-${state.number}${client}.pdf`);
      status('PDF generado y descargado.');
    }catch(error){
      status('No se pudo generar el PDF: '+error.message);
    }finally{
      button.disabled=false;button.textContent=original;
    }
  }

  /* ---------- acciones ---------- */
  async function shareWhatsapp(){
    if(!state.items.length&&!state.travel.on){
      status('Añade al menos un servicio o el desplazamiento antes de compartir.');
      return;
    }
    const text=summaryText();
    const phone=ownerWaPhone();
    if(phone){
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener');
      status('Abriendo WhatsApp con el resumen del presupuesto.');
    }else{
      const copied=await copyText(text);
      status(copied
        ?'No se encontró el teléfono en el catálogo: resumen copiado. Pégalo en el chat de WhatsApp.'
        :'No se encontró el teléfono en el catálogo y no se pudo copiar el resumen.');
    }
  }

  /* ---------- eventos ---------- */
  function toggle(id){
    const existing=findLine(id);
    if(existing){
      state.items=state.items.filter(line=>line.id!==id);
      status('Servicio quitado del presupuesto.');
    }else{
      const entry=registry.get(id);
      if(!entry)return;
      state.items.push({id:entry.id,category:entry.category,name:entry.name,
                        qty:1,unit:entry.parsed.value,desde:entry.parsed.desde,gratis:entry.parsed.gratis});
      status('Servicio añadido al presupuesto.');
    }
    renderCatalog();
    renderSummary();
  }

  function bindEvents(){
    $('quote-filters').addEventListener('click',event=>{
      const button=event.target.closest('button[data-category]');
      if(!button)return;
      interacted=true;activeFilter=button.dataset.category;
      [...$('quote-filters').children].forEach(child=>{
        const isActive=child.dataset.category===activeFilter;
        child.classList.toggle('active',isActive);
        child.setAttribute('aria-pressed',String(isActive));
      });
      renderCatalog();
    });

    $('quote-search').addEventListener('input',()=>{interacted=true;renderCatalog();});

    $('quote-catalog').addEventListener('click',event=>{
      if(event.target.closest('#quote-clear-filters')){
        interacted=true;$('quote-search').value='';activeFilter='Todas';
        [...$('quote-filters').children].forEach(child=>{
          const isActive=child.dataset.category==='Todas';
          child.classList.toggle('active',isActive);
          child.setAttribute('aria-pressed',String(isActive));
        });
        renderCatalog();$('quote-search').focus();
        return;
      }
      const step=event.target.closest('[data-q="dec"],[data-q="inc"]');
      if(step){
        const line=findLine(step.closest('.quote-item').dataset.id);
        if(line){
          line.qty=Math.max(1,line.qty+(step.dataset.q==='inc'?1:-1));
          const input=step.parentElement.querySelector('[data-q="qty"]');
          if(input)input.value=line.qty;
          const totalSpan=step.closest('.quote-item-controls').querySelector('.quote-line-total');
          if(totalSpan)totalSpan.textContent=fmt(lineTotal(line))+' USD';
          renderSummary();
        }
        return;
      }
      if(event.target.closest('input,label,button'))return;
      const head=event.target.closest('.quote-item-head');
      if(head)toggle(head.closest('.quote-item').dataset.id);
    });

    $('quote-catalog').addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const head=event.target.closest('.quote-item-head');
      if(!head)return;
      event.preventDefault();
      toggle(head.closest('.quote-item').dataset.id);
    });

    $('quote-catalog').addEventListener('input',event=>{
      const field=event.target.closest('[data-q="qty"],[data-q="unit"]');
      if(!field)return;
      const line=findLine(field.closest('.quote-item').dataset.id);
      if(!line)return;
      if(field.dataset.q==='qty')line.qty=Math.max(1,Math.round(num(field.value))||1);
      else line.unit=num(field.value);
      const totalSpan=field.closest('.quote-item-controls').querySelector('.quote-line-total');
      if(totalSpan)totalSpan.textContent=fmt(lineTotal(line))+' USD';
      renderSummary();
    });

    $('quote-lines').addEventListener('click',event=>{
      const remove=event.target.closest('.quote-remove');
      if(!remove)return;
      const id=remove.closest('.quote-line').dataset.id;
      state.items=state.items.filter(line=>line.id!==id);
      renderCatalog();renderSummary();
      status('Servicio quitado del presupuesto.');
    });

    const bindField=(id,key,transform)=>{
      $(id).addEventListener('input',event=>{
        state[key]=transform?transform(event.target):event.target.value;
        renderSummary();
      });
    };
    bindField('q-number','number',el=>el.value);
    bindField('q-date','date',el=>el.value||todayISO());
    bindField('q-validity','validity',el=>parseInt(el.value,10)||7);
    bindField('q-client','clientName',el=>el.value);
    bindField('q-phone','clientPhone',el=>el.value);
    bindField('q-notes','notes',el=>el.value);
    $('q-travel').addEventListener('change',event=>{state.travel.on=event.target.checked;renderSummary();});
    $('q-travel-amount').addEventListener('input',event=>{state.travel.amount=num(event.target.value);renderSummary();});
    $('q-discount').addEventListener('input',event=>{state.discount=num(event.target.value);renderSummary();});

    $('q-pdf').addEventListener('click',makePdf);
    $('q-whatsapp').addEventListener('click',shareWhatsapp);
    $('q-copy').addEventListener('click',async()=>{
      const copied=await copyText(summaryText());
      status(copied?'Resumen copiado al portapapeles.':'No se pudo copiar el resumen.');
    });
    $('q-clear').addEventListener('click',()=>{
      if(!confirm('¿Vaciar el presupuesto actual? Se generará un número nuevo.'))return;
      state=blankState();
      syncInputs();renderCatalog();renderSummary();
      status('Presupuesto vaciado. Nº '+state.number+' listo.');
    });
  }

  /* ---------- arranque ---------- */
  (async()=>{
    try{
      catalog=await Site.loadCatalog();
    }catch(error){
      $('quote-catalog').innerHTML='<p class="empty-state">No se pudo cargar el catálogo. Comprueba que data/catalogo.json esté en el repositorio.</p>';
      return;
    }
    const draft=restore();
    state=draft||blankState();
    buildRegistry();
    buildFilters();
    syncInputs();
    bindEvents();
    renderCatalog();
    renderSummary();
    status(draft?'Se recuperó el presupuesto en borrador.':'Nº '+state.number+' listo para trabajar.');
  })();
})();
