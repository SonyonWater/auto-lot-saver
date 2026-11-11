(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['www.otomoto.pl'] = { extract };

  function extract() {
    const brand = value('make');
    const baseModel = value('model');
    const version = value('version');
    const title = clean(document.querySelector('h1')?.textContent) || [brand, baseModel, version].filter(Boolean).join(' ');
    const color = [value('color'), value('colour_type')].filter(Boolean).join(', ');
    const engine = [value('engine_capacity'), value('engine_power')].filter(Boolean).join(', ');

    return {
      title,
      fields: {
        brand,
        model: [baseModel, version].filter(Boolean).join(' '),
        year: value('year'),
        mileage: value('mileage') || summaryValue('Przebieg'),
        color,
        engine,
        transmission: value('gearbox'),
        fuel: value('fuel_type')
      },
      details: {
        vin: vinValue(),
        seats: value('nr_seats')
      },
      omitFields: ['storageLocation', 'registrationDate'],
      photos: galleryPhotos(),
      photoApis: []
    };
  }

  // The detailed specification uses stable data-testid attributes; each row
  // contains the label followed by its value, so the last paragraph is value.
  function value(testId) {
    const row = document.querySelector(`[data-testid="${testId}"]`);
    if (!row) return '';
    const texts = [...row.querySelectorAll('p')].map(item => clean(item.textContent)).filter(Boolean);
    return texts.at(-1) || '';
  }

  function summaryValue(label) {
    const item = [...document.querySelectorAll('[data-testid="detail"]')]
      .find(element => clean(element.textContent).includes(label));
    const texts = [...item?.querySelectorAll('p') || []].map(element => clean(element.textContent)).filter(Boolean);
    return texts.find(text => text !== label) || '';
  }

  function galleryPhotos() {
    const images = [...document.querySelectorAll('img[data-testid^="gallery-image-"][src]')]
      .map(image => ({
        order: Number(image.dataset.testid.match(/(\d+)$/)?.[1]),
        url: image.currentSrc || image.src
      }))
      .filter(item => Number.isInteger(item.order) && /^https:\/\/[^/]*olxcdn\.com\//i.test(item.url))
      .sort((a, b) => a.order - b.order);

    const unique = new Map();
    for (const image of images) {
      try {
        const url = new URL(image.url);
        const key = `${url.origin}${url.pathname}`;
        if (!unique.has(key)) unique.set(key, image.url);
      } catch { if (!unique.has(image.url)) unique.set(image.url, image.url); }
    }
    return [...unique.values()];
  }

  function vinValue() {
    const text = clean(document.querySelector('[data-testid="advert-vin"]')?.textContent);
    return text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)?.[0] || '';
  }

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
})();
