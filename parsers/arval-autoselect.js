(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['autoselect.arval.pl'] = { extract };

  function extract() {
    const details = readDetails();
    const summary = readSummary();
    const headline = clean(document.querySelector('.car-main-info_headline, .template-offer_section-main-info h1, #car-details h1, h1')?.textContent);
    const variant = clean(document.querySelector('.car-main-info_headline + p, .car-main-info p.text-uppercase')?.textContent);
    const brand = value(details, ['marka', 'brand', 'make']) || headline.split(' ')[0];
    const model = value(details, ['model']) || clean(`${modelFromTitle(headline, brand)} ${variant}`);
    const title = clean(`${headline} ${variant}`) || clean(document.title);
    const registrationDate = value(details, ['data pierwszej rejestracji', 'pierwsza rejestracja', 'registration date']) || summary.registrationDate;

    return {
      title,
      fields: {
        brand,
        model,
        year: value(details, ['rok produkcji', 'rok modelowy', 'year']) || registrationDate.match(/(?:19|20)\d{2}$/)?.[0] || title.match(/\b(?:19|20)\d{2}\b/)?.[0],
        mileage: formatMileage(value(details, ['przebieg', 'mileage', 'kilometry']) || summary.mileage),
        color: value(details, ['kolor', 'color']),
        engine: value(details, ['silnik', 'pojemnosc silnika', 'engine', 'engine size']),
        transmission: value(details, ['skrzynia biegow', 'transmisja', 'gearbox', 'transmission']) || summary.transmission
      },
      details: {
        fuel: value(details, ['rodzaj paliwa', 'paliwo', 'fuel']) || summary.fuel,
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

  function readSummary() {
    const text = clean(document.querySelector('.car-info-details > p, .car-info-details > .text-light')?.textContent);
    return {
      mileage: text.match(/\b[\d\s]+\s*km\b/i)?.[0] || '',
      registrationDate: text.match(/\b\d{2}[/.\-]\d{2}[/.\-](?:19|20)\d{2}\b/)?.[0] || '',
      fuel: text.match(/\b(?:Diesel|Benzyna|Petrol|Electric|Elektryczny|Hybrid|Hybryda|LPG)\b/i)?.[0] || '',
      transmission: text.match(/\b(?:Manualna|Manual|Automatyczna|Automatic|CVT|DSG)\b/i)?.[0] || ''
    };
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
  function value(pairs, names) {
    return pairs.find(([label]) => names.some(name => label === name || (name.length >= 5 && label.includes(name))))?.[1] || '';
  }
  function formatMileage(value) { const text = clean(value); return text && !/\bkm\b/i.test(text) ? `${text} km` : text; }
  function modelFromTitle(title, brand) { return clean(title.replace(new RegExp(`^${escapeRegExp(brand)}\\s*`, 'i')).replace(/\b(?:19|20)\d{2}\b.*$/, '')); }
  function normalize(value) { return clean(value).replace(/:$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
})();
