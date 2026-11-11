(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['carmarket.ayvens.com'] = { extract };

  async function extract(message = {}) {
    const lotNumber = String(message.lotNumber || '').trim();
    const requestedPhotoCount = Number(message.photoCount);
    if (!/^\d+$/.test(lotNumber)) throw new Error('Для Ayvens укажите номер лота.');
    if (!Number.isInteger(requestedPhotoCount) || requestedPhotoCount < 1) throw new Error('Для Ayvens укажите количество фотографий.');

    const card = document.querySelector(`article.card-vehicle[data-lotnumber="${cssEscape(lotNumber)}"]`);
    if (!card) throw new Error(`Лот №${lotNumber} не найден на загруженной странице Ayvens.`);

    const name = lotName(card);
    if (!name) throw new Error(`Не удалось определить название лота №${lotNumber}.`);
    const version = clean(card.querySelector('.vehicle-make')?.textContent);
    const [brand, ...modelWords] = name.split(' ');
    const model = [modelWords.join(' '), version].filter(Boolean).join(' ');
    const details = await readDetails(card);
    const summary = clean(card.textContent);
    const photos = (await readPhotos(card, name)).slice(0, requestedPhotoCount);

    return {
      title: [name, version].filter(Boolean).join(' '),
      fields: {
        brand,
        model,
        year: details['rok produkcji'] || yearFrom(summary),
        mileage: details.przebieg || mileageFrom(summary),
        color: details['kolor nadwozia'] || '',
        engine: engineValue(details),
        transmission: details['skrzynia biegow'] || '',
        fuel: details.paliwo || ''
      },
      details: {
        registrationDate: dateFrom(summary),
        vin: details.vin || '',
        seats: details.siedzenia || ''
      },
      omitFields: ['storageLocation'],
      photos,
      photoApis: []
    };
  }

  function lotName(card) {
    const title = card.querySelector('.vehicle-title');
    if (!title) return '';
    const directText = [...title.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join(' ');
    return clean(directText || title.textContent).replace(/^\s*\d+\.\s*/, '');
  }

  async function readDetails(card) {
    let panel = detailsPanel(card);
    if (!panel) {
      const trigger = [...card.querySelectorAll('button, a')]
        .find(element => normalize(element.textContent) === 'szczegoly');
      trigger?.click();
      await pause(250);
      panel = detailsPanel(card);
    }
    const values = {};
    for (const row of panel?.querySelectorAll('ul.details-row') || []) {
      const label = normalize(row.querySelector('.details-title')?.textContent);
      const value = clean(row.querySelector('.details-info')?.textContent);
      if (label && value && !/^n\/?a$/i.test(value)) values[label] = value;
    }
    return values;
  }

  function detailsPanel(card) {
    const id = card.id;
    if (!id) return null;
    return document.querySelector(`[data-bs-parent="#${cssEscape(id)}-Recommended-details"]`)
      || document.querySelector(`#${cssEscape(id)}-Recommended-details`)
      || card.parentElement?.querySelector(`[data-bs-parent*="#${cssEscape(id)}"]`)
      || null;
  }

  async function readPhotos(card, name) {
    const expectedAlt = normalize(`Kup ${name} na Ayvens Carmarket`);
    let gallery = document.querySelector('#vehicle-gallery-modal');
    if (!gallery || !galleryImages(gallery, expectedAlt).length) {
      const picture = card.querySelector('img[alt^="Kup "][src], img[src]');
      picture?.click();
      gallery = await waitForGallery(expectedAlt);
    }
    const photos = galleryImages(gallery, expectedAlt);
    if (!photos.length) throw new Error(`Не удалось получить фотографии лота №${card.dataset.lotnumber}. Откройте его фото и повторите сохранение.`);
    return uniqueImages(photos.map(url => url.replace('/medium/', '/large/')));
  }

  async function waitForGallery(expectedAlt) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const gallery = document.querySelector('#vehicle-gallery-modal');
      if (gallery && galleryImages(gallery, expectedAlt).length) return gallery;
      await pause(150);
    }
    return document.querySelector('#vehicle-gallery-modal');
  }

  function galleryImages(root, expectedAlt) {
    if (!root) return [];
    return [...root.querySelectorAll('img[src]')]
      .filter(image => normalize(image.alt) === expectedAlt)
      .filter(image => {
        const slideIndex = image.closest('.slick-slide')?.dataset.index;
        return slideIndex === undefined || Number(slideIndex) >= 0;
      })
      .map(image => image.currentSrc || image.src)
      .filter(url => /^https:\/\/medias-carmarket\.ayvens\.com\//i.test(url));
  }

  // Slick renders copies of boundary slides; image URLs can differ only by a cache query.
  function uniqueImages(urls) {
    const result = new Map();
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        const key = `${parsed.origin}${parsed.pathname}`;
        if (!result.has(key)) result.set(key, url);
      } catch { if (!result.has(url)) result.set(url, url); }
    }
    return [...result.values()];
  }

  function engineValue(details) {
    const parts = [];
    if (details['pojemnosc silnika']) parts.push(`${details['pojemnosc silnika']} ccm`);
    const power = [details['moc silnika (km)'] && `${details['moc silnika (km)']} KM`, details['moc silnika (kw)'] && `${details['moc silnika (kw)']} kW`].filter(Boolean).join(' / ');
    if (power) parts.push(power);
    return parts.join(', ');
  }

  function mileageFrom(text) { return text.match(/\b[\d\s.]+\s*km\b/i)?.[0] || ''; }
  function dateFrom(text) { return text.match(/\b\d{2}[.]\d{2}[.]\d{4}\b/)?.[0] || ''; }
  function yearFrom(text) { return text.match(/\b(?:19|20)\d{2}\b/)?.[0] || ''; }
  function normalize(value) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[:.]/g, '').toLowerCase(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function cssEscape(value) { return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
})();
