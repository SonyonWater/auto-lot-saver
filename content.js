(() => {
  if (window.__autoLotSaverLoaded) return;
  window.__autoLotSaverLoaded = true;
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers.generic = { extract: extractLot };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'extractLot') {
      Promise.resolve(currentParser().extract(message))
        .then(sendResponse)
        .catch(error => sendResponse({ error: error?.message || 'Не удалось обработать лот.' }));
    }
    return true;
  });

  function currentParser() {
    return window.AutoLotParsers[location.hostname] || window.AutoLotParsers.generic;
  }

  function extractLot() {
    const jsonLd = readJsonLd();
    const vehicle = jsonLd.find(item => /car|vehicle|product/i.test(String(item?.['@type'] || ''))) || {};
    const title = clean(vehicle.name || document.querySelector('h1')?.textContent || document.title.split('|')[0]);
    const media = collectPhotos();
    return { title: cleanLotTitle(title), fields: validateFields(extractFields(vehicle, title)), photos: media.photos, photoApis: media.photoApis };
  }

  function extractFields(vehicle, title) {
    const lookup = {
      brand: ['marka', 'brand', 'make', 'producent'], model: ['model'],
      year: ['rok produkcji', 'rok', 'year', 'first registration', 'data pierwszej rejestracji'],
      mileage: ['przebieg', 'mileage', 'odometer', 'kilometry'], color: ['kolor', 'color', 'barwa'],
      engine: ['pojemność silnika', 'silnik', 'engine', 'engine size', 'capacity'],
      transmission: ['skrzynia biegów', 'transmisja', 'transmission', 'gearbox']
    };
    const fallback = splitTitle(title);
    const value = key => labeledValue(lookup[key]) || textValue(lookup[key], Object.values(lookup).flat());
    return {
      brand: clean(vehicle.brand?.name || value('brand') || fallback.brand),
      model: clean(vehicle.model || value('model') || fallback.model),
      year: clean(vehicle.vehicleModelDate || value('year') || title.match(/\b(?:19|20)\d{2}\b/)?.[0]),
      mileage: clean(vehicle.mileageFromOdometer?.value ? `${vehicle.mileageFromOdometer.value} km` : value('mileage')),
      color: clean(vehicle.color || value('color')),
      engine: clean(vehicle.vehicleEngine?.name || value('engine')),
      transmission: clean(vehicle.vehicleTransmission || value('transmission'))
    };
  }

  // Reads a local label/value pair rather than consuming adjacent page fields.
  function labeledValue(labels) {
    const normalizedLabels = labels.map(normalize);
    const leafs = [...document.querySelectorAll('dt, th, label, [class*="label" i], [class*="name" i], [class*="title" i], div, span')]
      .filter(element => clean(element.textContent).length <= 60);
    for (const label of leafs) {
      if (!normalizedLabels.includes(normalize(label.textContent))) continue;
      const sibling = label.nextElementSibling;
      if (sibling && clean(sibling.textContent) && clean(sibling.textContent).length <= 160) return clean(sibling.textContent);
      const parent = label.parentElement;
      if (!parent) continue;
      const parts = [...parent.children].map(child => clean(child.textContent)).filter(Boolean);
      const index = parts.findIndex(value => normalize(value) === normalize(label.textContent));
      if (index >= 0 && parts[index + 1]) return parts[index + 1];
      const container = label.closest('li, tr, dl, section, article, div');
      if (container && container !== parent) {
        const values = [...container.querySelectorAll('dd, td, [class*="value" i], [class*="detail" i]')]
          .map(element => clean(element.textContent)).filter(value => value && normalize(value) !== normalize(label.textContent));
        if (values[0]) return values[0];
      }
    }
    return '';
  }

  function textValue(labels, allLabels) {
    const text = document.body.innerText || '';
    const boundary = allLabels.map(escapeRegExp).join('|');
    for (const label of labels) {
      const pattern = new RegExp(`(?:^|\\n|\\s)${escapeRegExp(label)}\\s*[:\\-]?\\s*([\\s\\S]{1,100}?)(?=\\n|\\s+(?:${boundary})\\s*[:\\-]|$)`, 'i');
      const match = text.match(pattern);
      const value = clean(match?.[1]).replace(/^[,:\-\s]+/, '');
      if (value) return value;
    }
    return '';
  }

  function validateFields(fields) {
    const valid = { ...fields };
    if (!/^(?:19|20)\d{2}$/.test(valid.year || '')) valid.year = '';
    if (!/\d[\d\s.,]*\s*(?:km|kilometr)/i.test(valid.mileage || '')) valid.mileage = '';
    if (!/\d/.test(valid.engine || '') || (valid.engine || '').length > 45) valid.engine = '';
    if (!/(manual|automat|automatic|mechanic|cvt|dsg)/i.test(valid.transmission || '')) valid.transmission = '';
    if ((valid.color || '').length > 45) valid.color = '';
    return valid;
  }

  function collectPhotos() {
    const candidates = new Set();
    const photoApis = new Set();
    const add = value => {
      const url = absoluteUrl(value);
      if (isVehicleImage(url)) candidates.add(url);
    };
    for (const image of document.images) {
      const inGallery = Boolean(image.closest('[class*="gallery" i], [class*="photo" i], [class*="image" i], [class*="media" i], [data-testid*="image" i]'));
      const large = image.naturalWidth >= 400 || image.naturalHeight >= 300 || image.width >= 400 || image.height >= 300;
      if (!inGallery && !large) continue;
      add(image.currentSrc || image.src);
      ['data-src', 'data-original', 'data-lazy-src', 'data-zoom-image', 'data-full-image'].forEach(attribute => add(image.getAttribute(attribute)));
      addBestSrcset(image.getAttribute('srcset'), add);
    }
    for (const source of document.querySelectorAll('source[srcset]')) addBestSrcset(source.srcset, add);
    for (const element of document.querySelectorAll('[class], [id], [aria-label]')) {
      const hint = `${element.className || ''} ${element.id || ''} ${element.getAttribute('aria-label') || ''}`;
      if (!/(gallery|photo|image|vehicle|car|slider|media|player)/i.test(hint)) continue;
      const match = getComputedStyle(element).backgroundImage.match(/url\(["']?(.+?)["']?\)/i);
      if (match) add(match[1]);
    }
    for (const entry of performance.getEntriesByType('resource')) {
      if (/playerapi.*\/api\/image-set|buyerapi.*\/(?:vehicle|lot|image)/i.test(entry.name)) photoApis.add(entry.name);
      else add(entry.name);
    }
    return { photos: [...candidates], photoApis: [...photoApis] };
  }

  function addBestSrcset(srcset, add) {
    if (!srcset) return;
    add(srcset.split(',').map(part => part.trim().split(/\s+/)[0]).pop());
  }

  function isVehicleImage(url) {
    if (!/^https?:/i.test(url)) return false;
    if (/\.(svg|gif)(\?|$)|logo|favicon|icon|sprite|placeholder|default-car|avatar|banner|cookie/i.test(url)) return false;
    return /\.(jpe?g|png|webp|avif)(\?|$)|image|photo|picture|vehicle|media|gallery|playerapi/i.test(url);
  }

  function readJsonLd() { return [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(node => { try { const value = JSON.parse(node.textContent); return Array.isArray(value) ? value : [value]; } catch { return []; } }); }
  function splitTitle(title) { const [brand = '', ...model] = cleanLotTitle(title).split(' '); return { brand, model: model.join(' ') }; }
  function cleanLotTitle(value) { return clean(value).replace(/\s+(VIN|Pojazd znajduje się|Vehicle is located|Nr rejestracyjny)(?=\s|$|[,:.-]).*$/i, '').slice(0, 160); }
  function absoluteUrl(value) { try { return new URL(value || '', document.baseURI).href; } catch { return ''; } }
  function normalize(value) { return clean(value).replace(/[:*]/g, '').toLocaleLowerCase('pl'); }
  function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
})();
