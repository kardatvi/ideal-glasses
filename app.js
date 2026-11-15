'use strict';
(() => {
  const D = window.GLASSES;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  const external = (url, label, className='') => `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  const stateKey = 'ideal-glasses-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(stateKey) || '{}') || {}; } catch (_) { saved = {}; }
  const validFrameIds = new Set(D.frames.map(frame => frame.id));
  const validPlanIds = new Set(D.plan.map(step => step.id));
  const safeIds = (value, valid) => new Set(Array.isArray(value) ? value.filter(id => valid.has(id)) : []);
  const favorites = safeIds(saved.favorites, validFrameIds);
  const completed = safeIds(saved.completed, validPlanIds);
  const compared = new Set();
  const visited = new Set();
  let currentChapter = 0;
  let city = 'all';
  let toastTimer;
  let storageFailed = false;
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
  }
  function persist() {
    try { localStorage.setItem(stateKey, JSON.stringify({favorites:[...favorites],completed:[...completed]})); }
    catch (_) { if (!storageFailed) { toast('Браузер не разрешил сохранение. Выбор останется до закрытия страницы.'); storageFailed = true; } }
  }
  const names = ['Два рецепта','Линзы','Оправа','Что примерить','Где заказать','Следующие шаги'];
  const nextNames = ['Как выбрать линзы →','Как выбрать оправу →','Посмотреть оправы →','Выбрать оптику →','Собрать план действий →',''];
  function keepActiveNavVisible() {
    const nav = $('.chapters');
    const active = $('.chapters a[aria-current]');
    if (active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({left:Math.max(0,active.offsetLeft-nav.offsetLeft-(nav.clientWidth-active.offsetWidth)/2),behavior:'instant'});
    }
  }
  function route(scroll = true) {
    const hash = location.hash.slice(1);
    if (hash === 'content') { $('#content').focus(); return; }
    const parsed = /^\d$/.test(hash) ? Number(hash) : 0;
    currentChapter = parsed >= 0 && parsed <= 5 ? parsed : 0;
    if (hash && String(currentChapter) !== hash) history.replaceState(null, '', '#0');
    visited.add(currentChapter);
    $$('.episode').forEach((episode,index) => episode.hidden = index !== currentChapter);
    $$('.chapters a').forEach((link,index) => {
      if (index === currentChapter) link.setAttribute('aria-current','step');
      else link.removeAttribute('aria-current');
      link.classList.toggle('visited', visited.has(index));
    });
    $('#chapter-count').textContent = `Шаг ${currentChapter} из 5`;
    $('#bottom-count').textContent = `${currentChapter} / 5`;
    $('#progress-fill').style.width = `${(currentChapter + 1) / 6 * 100}%`;
    $('#prev-chapter').classList.toggle('inactive', currentChapter === 0);
    $('#prev-chapter').setAttribute('aria-hidden', String(currentChapter === 0));
    $('#prev-chapter').tabIndex = currentChapter === 0 ? -1 : 0;
    $('#prev-chapter').href = `#${Math.max(0,currentChapter - 1)}`;
    $('#next-chapter').hidden = currentChapter === 5;
    $('#next-chapter').href = `#${Math.min(5,currentChapter + 1)}`;
    $('#next-chapter').textContent = nextNames[currentChapter];
    document.title = `${names[currentChapter]} — Твои очки`;
    keepActiveNavVisible();
    if (scroll) {
      window.scrollTo({top:0, behavior:'instant'});
      const heading = $(`#heading-${currentChapter}`);
      heading.tabIndex = -1;
      heading.focus({preventScroll:true});
    }
  }
  window.addEventListener('hashchange', () => route());
  window.addEventListener('resize', keepActiveNavVisible);
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link && link.getAttribute('href') === '#'+currentChapter) {event.preventDefault();route();}
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName) || $('dialog[open]')) return;
    if (event.key === 'ArrowRight' && currentChapter < 5) {event.preventDefault(); location.hash = String(currentChapter + 1);}
    if (event.key === 'ArrowLeft' && currentChapter > 0) {event.preventDefault(); location.hash = String(currentChapter - 1);}
  });

  function rxView(mode) {
    const near = mode === 'near';
    const eyes = [
      {id:'OD',name:'Правый глаз',old:near?1.25:.5,now:near?1.5:.5,change:near?'Сфера +0,25 D; ось цилиндра +5°':'Сфера без изменений; ось цилиндра +5°'},
      {id:'OS',name:'Левый глаз',old:near?4.25:3.5,now:near?4.75:3.75,change:near?'Сфера +0,50 D: +0,25 вдаль и +0,25 ADD':'Сфера +0,25 D'}
    ];
    const diopters = value => '+' + value.toFixed(2).replace('.',',');
    $('#rx-comparison').innerHTML = eyes.map(eye => `<article class="rx-card"><div class="rx-eye"><span class="eye-icon">${eye.id}</span>${eye.name} · сфера</div><div class="rx-numbers"><div><span>ПРЕЖНИЙ РЕЦЕПТ</span><strong>${diopters(eye.old)}</strong></div><div class="arrow" aria-hidden="true">→</div><div><span>24.08.2026</span><strong>${diopters(eye.now)}</strong></div></div><div class="rx-change ${eye.old !== eye.now?'changed':''}">${eye.change}</div></article>`).join('');
    $('#rx-caption').textContent = near ? 'Сфера вблизи = сфера вдаль + ADD. Это объяснение арифметики рецепта, не рекомендация самостоятельно заказывать ближнюю пару.' : 'D — диоптрия. OD — правый глаз, OS — левый. Показываем сферу отдельно; цилиндр и ось — в таблице ниже.';
    $$('[data-rx]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rx === mode)));
  }
  $$('[data-rx]').forEach(button => button.addEventListener('click', () => rxView(button.dataset.rx)));

  function switchPanel(prefix, value) {
    $$(`[data-${prefix}-tab]`).forEach(button => button.setAttribute('aria-pressed', String(button.getAttribute(`data-${prefix}-tab`) === value)));
    $$(`[data-${prefix}-panel]`).forEach(panel => panel.hidden = panel.getAttribute(`data-${prefix}-panel`) !== value);
  }
  $$('[data-lens-tab]').forEach(button => button.addEventListener('click', () => switchPanel('lens',button.dataset.lensTab)));
  $$('[data-frame-tab]').forEach(button => button.addEventListener('click', () => switchPanel('frame',button.dataset.frameTab)));
  const zoneText = {
    far:'Верхняя часть помогает смотреть вдаль. Для прогулки важны актуальная коррекция, точная посадка и устойчивость оправы.',
    mid:'Промежуточная зона соединяет даль и близь. Дизайн, коридор, рабочая дистанция и положение монитора влияют на удобство.',
    near:'Нижняя зона — для чтения. Её сила связана с ADD. Не нужно считать более высокую добавку доказательством заболевания или менять её самостоятельно.'
  };
  function selectZone(zone) {
    $$('[data-zone]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.zone === zone)));
    $$('.zone').forEach(element => element.classList.toggle('active',element.classList.contains('zone-'+zone)));
    $('#zone-explanation').textContent = zoneText[zone];
  }
  $$('[data-zone]').forEach(button => button.addEventListener('click', () => selectZone(button.dataset.zone)));
  const indexText = {
    '1.60':'MR-8: число Аббе 41. Имеет смысл включить в расчёт, если нужный дизайн и рецепт доступны. По сравнению с некоторыми более высокими индексами — меньшая дисперсия, но возможна другая толщина. Итог зависит от оправы.',
    '1.67':'MR-7 / MR-10: число Аббе 31. Такой индекс указан у нынешних ODV. Он не объясняет сам по себе ни сильные блики, ни тяжёлую адаптацию. Материал, покрытие, рецепт и разметку проверяем отдельно.',
    '1.74':'MR-174: число Аббе 32. По твоему рассказу, такой индекс был у прежних Nikon. Нельзя считать его заведомо хуже 1.67 по дисперсии: в этих примерах число Аббе чуть выше. Более тонкая линза не обязательно легче.'
  };
  function selectIndex(index) {
    $$('[data-index]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.index === index)));
    $('#index-explanation').textContent = indexText[index];
  }
  $$('[data-index]').forEach(button => button.addEventListener('click', () => selectIndex(button.dataset.index)));
  function selectBrand(id) {
    const brand = D.brands.find(item => item.id === id);
    $('#brand-tabs').innerHTML = D.brands.map(item => `<button data-brand="${item.id}" aria-pressed="${item.id === id}">${esc(item.name)}</button>`).join('');
    $('#brand-detail').innerHTML = `<article class="brand-detail"><span class="badge blue">${esc(brand.badge)}</span><h3>${esc(brand.title)}</h3><p>${esc(brand.why)}</p><dl><dt>Дизайн</dt><dd>${esc(brand.design)}</dd><dt>Покрытие и опции</dt><dd>${esc(brand.coating)}</dd><dt>Вопрос салону</dt><dd>${esc(brand.ask)}</dd></dl>${external(brand.url,'Описание производителя','source-link')}</article>`;
  }
  $('#brand-tabs').addEventListener('click', event => { const button = event.target.closest('[data-brand]'); if (button) {selectBrand(button.dataset.brand); $(`[data-brand="${button.dataset.brand}"]`).focus({preventScroll:true});} });


  function icon(type) {
    const path = type === 'phone'
      ? '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z"/>'
      : '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>';
    return '<span class="contact-icon '+(type === 'phone' ? 'phone-icon' : '')+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg></span>';
  }
  function contactInfo(address, phone, tel) {
    return '<div class="contact-line">'+icon('pin')+'<div class="contact-value"><span class="contact-label">Адрес</span>'+esc(address)+'</div></div>'
      +(phone?'<div class="contact-line">'+icon('phone')+'<div class="contact-value"><span class="contact-label">Телефон</span><a class="phone-link" href="tel:'+esc(tel)+'">'+esc(phone)+'</a></div></div>':'');
  }
  function place(name,address,phone,tel) {
    return '<div class="place-card">'+(name?'<div class="place-name">'+esc(name)+'</div>':'')+contactInfo(address,phone,tel)+'</div>';
  }
  function planLocations(id,fallback) {
    const localFrames = [
      ['Seiko · «Оптик-Центр»','Васенко, 4','8-800-333-43-40','+78003334340'],
      ['Stepper · «Оптик-Центр»','Труда, 203 («Родник»); Блюхера, 55А','8-800-333-43-40','+78003334340'],
      ['Bergen · Family Optic, «Горки»','Артиллерийская, 136','+7 (351) 200-36-26','+73512003626'],
      ['Roy Robson · Family Optic, «Космос»','Чичерина, 28','+7 (351) 200-36-26','+73512003626']
    ];
    if(id === 'health')return '<p>Выбери офтальмолога. Для «Кормед» сначала уточни нужный приём и филиал.</p>'+place('«Кормед»','Ленина, 62; Гагарина, 11','+7 (351) 225-38-38','+73512253838');
    if(id === 'callframes' || id === 'fitting')return localFrames.map(item=>place(...item)).join('');
    if(id === 'ekb')return D.ekb.slice(0,3).map(item=>place(item.name,item.address,item.phone,item.tel)).join('');
    if(id === 'quotes')return D.salons.map(item=>place(item.name,item.address,item.phone,item.tel)).join('');
    return '<div class="contact-line">'+icon('pin')+'<div class="contact-value"><span class="contact-label">Место</span>'+esc(fallback)+'</div></div>';
  }
  function disclosure(title) {
    return '<span class="disclosure-title">'+esc(title)+'</span><span class="disclosure-action"><span class="disclosure-text">Подробнее</span><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function filteredFrames() {
    return D.frames.filter(frame => (city === 'all' || frame.city === city) && (!$('#full-rim').checked || frame.rim) && (!$('#favorites-only').checked || favorites.has(frame.id)));
  }
  function renderGallery(focusId) {
    const frames = filteredFrames();
    $('#gallery-count').textContent = `Показано ${frames.length} из ${D.frames.length} · в сравнении ${compared.size} из 3`;
    $('#gallery').innerHTML = frames.length ? frames.map(frame => `<article class="frame-card"><div class="frame-photo"><button class="favorite" id="favorite-${frame.id}" data-favorite="${frame.id}" aria-label="${favorites.has(frame.id)?'Убрать из избранного':'В избранное'}: ${esc(frame.name)}" aria-pressed="${favorites.has(frame.id)}">${favorites.has(frame.id)?'★':'☆'}</button><button class="photo-button" data-photo="${frame.id}" aria-label="Увеличить фото ${esc(frame.name)}"><img src="${esc(frame.image)}" alt="${esc(frame.name+' — '+frame.color)}" loading="lazy" width="480" height="180"></button></div><div class="frame-card-body"><span class="badge ${frame.city==='ekb'?'amber':'blue'}">${esc(frame.status)}</span><h3>${esc(frame.name)}</h3><div class="frame-color">${esc(frame.color)}</div><div class="price">${money(frame.price)}</div><p class="price-unit">только оправа · ориентир на ${D.date}</p><div class="frame-size"><b>${esc(frame.size)} мм</b><span>Высота: ${esc(frame.height)}</span></div><p class="fact">${esc(frame.material)}</p><p class="fact">${esc(frame.note)}</p><div class="contact-line frame-location">${icon('pin')}<div class="contact-value"><span class="contact-label">Где примерить</span>${esc(frame.where)}</div></div><p class="evidence">${esc(frame.evidence)}</p><div class="frame-card-actions"><label class="check-inline"><input type="checkbox" data-compare="${frame.id}" ${compared.has(frame.id)?'checked':''}> Сравнить</label>${external(frame.url,'Карточка')}</div>${frame.tech?external(frame.tech,'Состав и размеры','source-link'):''}<div class="image-credit">${esc(frame.credit)}</div></div></article>`).join('') : '<p class="empty-state">В этой подборке нет оправ по выбранным фильтрам. Снимите фильтр «Избранное» или выберите «Все».</p>';
    $$('#gallery img').forEach(img => img.addEventListener('error', () => {
      const placeholder = document.createElement('span'); placeholder.className='missing-photo'; placeholder.textContent='Фото пока недоступно. Откройте точную карточку модели ниже.';
      img.parentElement.replaceWith(placeholder);
    }, {once:true}));
    if (focusId) $('#'+focusId)?.focus({preventScroll:true});
  }
  function renderCompare() {
    $('#compare-area').hidden = compared.size === 0;
    const frames = D.frames.filter(frame => compared.has(frame.id));
    const rows = [
      ['Цена оправы', frame => money(frame.price)],
      ['Размер / высота', frame => frame.size + ' мм / ' + frame.height],
      ['Конструкция', frame => frame.rim?'Ободковая':'Полуободковая'],
      ['Материал и отделка', frame => frame.material],
      ['Где примерить', frame => frame.where],
      ['Подтверждение', frame => frame.evidence]
    ];
    $('#comparison').innerHTML = frames.length ? `<table><thead><tr><th>Параметр</th>${frames.map(frame => `<th>${esc(frame.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,getValue]) => `<tr><th>${label}</th>${frames.map(frame => `<td>${esc(getValue(frame))}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  }
  $$('[data-city]').forEach(button => button.addEventListener('click', () => {
    city=button.dataset.city; $$('[data-city]').forEach(item => item.setAttribute('aria-pressed',String(item === button))); renderGallery();
  }));
  ['#full-rim','#favorites-only'].forEach(selector => $(selector).addEventListener('change', () => renderGallery()));
  $('#gallery').addEventListener('click',event => {
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) {
      const id=favorite.dataset.favorite; favorites.has(id)?favorites.delete(id):favorites.add(id); persist(); renderGallery('favorite-'+id); return;
    }
    const photo = event.target.closest('[data-photo]');
    if (photo) {
      const frame = D.frames.find(item => item.id === photo.dataset.photo);
      $('#large-photo').src=frame.image; $('#large-photo').alt=frame.name+' — '+frame.color; $('#photo-title').textContent=frame.name;
      $('#photo-dialog').showModal();
    }
  });
  $('#gallery').addEventListener('change',event => {
    const checkbox=event.target.closest('[data-compare]'); if(!checkbox) return;
    const id=checkbox.dataset.compare;
    if(checkbox.checked && compared.size >= 3) {checkbox.checked=false; toast('Для понятного сравнения выберите не больше трёх оправ.'); return;}
    checkbox.checked?compared.add(id):compared.delete(id);
    renderCompare(); $('#gallery-count').textContent=`Показано ${filteredFrames().length} из ${D.frames.length} · в сравнении ${compared.size} из 3`;
    if(checkbox.checked) toast('Оправа добавлена. Сравнение — под подборкой.');
  });
  $('#clear-compare').addEventListener('click',() => {compared.clear();renderGallery();renderCompare();$('#heading-3').focus({preventScroll:true});});

  $('#ekb-contacts').innerHTML=D.ekb.map(contact => `<article class="contact-card"><h3>${esc(contact.name)}</h3>${contactInfo(contact.address,contact.phone,contact.tel)}<p>${esc(contact.purpose)}</p>${external(contact.url,'Контакты','source-link')}</article>`).join('');
  $('#salon-cards').innerHTML=D.salons.map(salon => `<article class="salon-card"><div><h3>${esc(salon.name)}</h3><div class="contact">${contactInfo(salon.address,salon.phone,salon.tel)}${external(salon.url,'Официальная страница')}</div></div><div><p><b>Подтверждено:</b> ${esc(salon.confirmed)}</p><p><b>Цель разговора:</b> ${esc(salon.goal)}</p><p><b>Ещё спросить:</b> ${esc(salon.unknown)}</p><p class="caption">${esc(salon.note)}</p></div></article>`).join('');
  function updatePlanProgress() { $('#plan-progress').textContent = `Выполнено ${completed.size} из ${D.plan.length}`; }
  function renderPlan() {
    $('#plan-list').innerHTML=D.plan.map((step,index) => `<article class="plan-step ${completed.has(step.id)?'done':''}" id="plan-${step.id}"><div class="plan-head"><input class="plan-check" id="check-${step.id}" type="checkbox" data-plan="${step.id}" ${completed.has(step.id)?'checked':''} aria-label="Выполнено: ${esc(step.title)}"><h2><label for="check-${step.id}">${index + 1}. ${esc(step.title)}</label></h2></div><div class="plan-body"><div class="plan-locations">${planLocations(step.id,step.where)}</div><p>${esc(step.goal)}</p><div class="decision"><div><span>Ты решаешь сейчас</span><p>${esc(step.yes)}</p></div><div><span>Пока отложи</span><p>${esc(step.no)}</p></div></div><details class="script"><summary>${disclosure('Твой текст для разговора')}</summary><pre id="script-${step.id}">${esc(step.script)}</pre><button class="text-btn" data-copy="${step.id}">Скопировать текст</button></details></div></article>`).join('');
    updatePlanProgress();
  }
  $('#plan-list').addEventListener('change',event => {const input=event.target.closest('[data-plan]'); if(!input) return;const id=input.dataset.plan;input.checked?completed.add(id):completed.delete(id);$('#plan-'+id).classList.toggle('done',input.checked);persist();updatePlanProgress();});
  $('#plan-list').addEventListener('click', async event => {
    const button=event.target.closest('[data-copy]'); if(!button) return;
    const step=D.plan.find(item => item.id === button.dataset.copy);
    try {await navigator.clipboard.writeText(step.script); toast('Текст скопирован — можешь использовать его в разговоре.');}
    catch(_) {toast('Браузер не разрешил копирование. Выделите текст разговора и скопируйте вручную.');}
  });
  function planText() {
    return `ТВОИ ОЧКИ — ПЛАН ДЕЙСТВИЙ\nПроверка источников: ${D.date}\nЦены и наличие подтвердить звонком. Записи и заказы не оформлены.\n\n`+D.plan.map((step,index) => `${completed.has(step.id)?'[x]':'[ ]'} ${index+1}. ${step.title}\nГде: ${step.where}\nЦель: ${step.goal}\nРешаем: ${step.yes}\nПока отложи: ${step.no}\nТекст разговора: ${step.script}\n`).join('\n')+'\nПеред заказом обсудить симптомы с офтальмологом. Внезапное исчезновение зрения требует неотложной помощи.\n';
  }
  $('#download-plan').addEventListener('click',() => {
    const blob=new Blob(['\uFEFF'+planText()],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='tvoi-ochki-plan.txt';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('План подготовлен для скачивания.');
  });
  function print(mode) {
    document.body.classList.toggle('print-plan',mode === 'plan');
    const previous = $$('details').map(element => [element,element.open]);
    $$('details').forEach(element => element.open=true);
    const restore = () => {previous.forEach(([element,open])=>element.open=open);document.body.classList.remove('print-plan');};
    window.addEventListener('afterprint',restore,{once:true});window.print();
  }
  $('#print-all').addEventListener('click',()=>print('all'));
  $('#print-plan').addEventListener('click',()=>print('plan'));

  $('#sources-list').innerHTML=D.sources.map(group => `<section class="sources-group"><h3>${esc(group.title)}</h3><ul>${group.links.map(([label,url])=>`<li>${external(url,label)}</li>`).join('')}</ul></section>`).join('');
  $$('[data-open]').forEach(button => button.addEventListener('click',()=>$('#'+button.dataset.open+'-dialog').showModal()));
  $$('[data-close]').forEach(button => button.addEventListener('click',()=>$('#'+button.dataset.close+'-dialog').close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}));
  $$('details').forEach(details => {
    details.addEventListener('toggle', () => {
      const label = details.querySelector('summary .disclosure-text');
      if (label) label.textContent = details.open ? 'Свернуть' : 'Подробнее';
    });
  });
  rxView('far');selectZone('far');selectIndex('1.67');selectBrand('nikon');renderGallery();renderCompare();renderPlan();route(false);
})();
