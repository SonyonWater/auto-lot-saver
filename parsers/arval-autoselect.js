(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['autoselect.arval.pl'] = { extract };

  function extract() {
    const details = readDetails();
    const title = clean(document.querySelector('.template-offer_section-main-info h1, #car-details h1, h1')?.textContent || document.title);
    const brand = value(details, ['marka', 'brand', 'make']) || title.split(' ')[0];
    const model = value(details, ['model']) || modelFromTitle(title, brand);
    const registrationDate = value(details, ['data pierwszej rejestracji', 'pierwsza rejestracja', 'registration date']);

    return {
      title,
      fields: {
        brand,
        model,
        year: value(details, ['rok produkcji', 'rok', 'year']) || registrationDate.match(/^\d{4}/)?.[0] || title.match(/\b(?:19|20)\d{2}\b/)?.[0],
        mileage: formatMileage(value(details, ['przebieg', 'mileage', 'kilometry'])),
        color: value(details, ['kolor', 'color']),
        engine: value(details, ['silnik', 'pojemnosc silnika', 'engine', 'engine size']),
        transmission: value(details, ['skrzynia biegow', 'transmisja', 'gearbox', 'transmission'])
      },
      details: {
        fuel: value(details, ['rodzaj paliwa', 'paliwo', 'fuel']),
        registrationDate,
        vin: value(details, ['vin', 'numer vin']),
        storageLocation: value(details, ['lokalizacja', 'miejsce przechowywania', 'storage location']),
        seats: value(details, ['liczba miejsc', 'miejsca', 'number of seats', 'seats'])
      },
      photos: collectPhotos(),
      photoApis: []
    };
  }

  function readDetails() {
    const pairs = [];
    for (const block of document.querySelectorAll('#car-details .car-info-details .l-margin-bottom-6, .car-info-details .l-margin-bottom-6')) {
      const label = block.querySelector('span.text-light');
      if (!label) continue;
      const value = clean([...block.childNodes]
        .filter(node => node !== label)
        .map(node => node.textContent)
        .join('')) || clean(block.textContent).replace(clean(label.textContent), '').trim();
      if (clean(label.textContent) && value) pairs.push([normalize(label.textContent), value]);
    }
    return pairs;
  }

  function collectPhotos() {
    const urls = new Set();
    const gallery = document.querySelector('.section-car-media');
    if (!gallery) return [];
    const add = source => {
      if (!source) return;
      try {
        const url = new URL(source, document.baseURI).href;
        if (/^https?:/i.test(url) && !/logo|icon|placeholder|default-car/i.test(url)) urls.add(url);
      } catch { /* Ignore invalid image values. */ }
    };
    for (const image of gallery.querySelectorAll('img')) {
      add(image.currentSrc || image.src);
      ['data-src', 'data-lazy-src', 'data-original', 'data-zoom-image', 'data-full-image'].forEach(name => add(image.getAttribute(name)));
      addBestSrcset(image.getAttribute('srcset'), add);
    }
    for (const source of gallery.querySelectorAll('source[srcset]')) addBestSrcset(source.srcset, add);
    for (const element of gallery.querySelectorAll('*')) {
      const match = getComputedStyle(element).backgroundImage.match(/url\(["']?(.+?)["']?\)/i);
      if (match) add(match[1]);
    }
    return [...urls];
  }

  function addBestSrcset(srcset, add) {
    if (!srcset) return;
    add(srcset.split(',').map(part => part.trim().split(/\s+/)[0]).pop());
  }
  function value(pairs, names) { return pairs.find(([label]) => names.some(name => label === name || label.includes(name)))?.[1] || ''; }
  function formatMileage(value) { const text = clean(value); return text && !/\bkm\b/i.test(text) ? `${text} km` : text; }
  function modelFromTitle(title, brand) { return clean(title.replace(new RegExp(`^${escapeRegExp(brand)}\\s*`, 'i')).replace(/\b(?:19|20)\d{2}\b.*$/, '')); }
  function normalize(value) { return clean(value).replace(/:$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
})();
