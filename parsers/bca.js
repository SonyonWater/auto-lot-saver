(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['www.bca.com'] = { extract };

  function extract() {
    const details = readDetails();
    const brand = value(details, ['marka', 'make', 'brand']);
    const model = value(details, ['model']);
    const type = value(details, ['typ', 'wersja', 'type']);
    const exactMileage = boundText('TotalMileageValue');
    const engineParts = [
      value(details, ['silnik', 'pojemnosc silnika', 'engine size', 'enginecapacity']),
      value(details, ['moc', 'power'])
    ].filter(Boolean);

    return {
      title: [brand, model, type].filter(Boolean).join(' ') || clean(document.title),
      fields: {
        brand,
        model,
        year: value(details, ['rok modelowy', 'rok produkcji', 'year']),
        mileage: formatMileage(exactMileage || value(details, ['przebieg', 'stan licznika', 'odometer', 'mileage'])),
        color: value(details, ['kolor', 'color']),
        engine: unique(engineParts).join(', '),
        transmission: value(details, ['skrzynia biegow', 'rodzaj skrzyni biegow', 'transmisja', 'gearbox', 'transmission'])
      },
      details: {
        fuel: value(details, ['paliwo', 'rodzaj paliwa', 'fuel']),
        registrationDate: value(details, ['data pierwszej rejestracji', 'pierwsza rejestracja', 'first registration date', 'firstregistrationdate']),
        vin: value(details, ['vin', 'numer vin', 'vin number', 'vinnumber']),
        storageLocation: value(details, ['lokalizacja', 'miejsce przechowywania', 'storage location']),
        seats: value(details, ['liczba miejsc', 'number of seats', 'seats'])
      },
      photos: collectPhotos(),
      photoApis: []
    };
  }

  function readDetails() {
    const details = [];
    for (const row of document.querySelectorAll('#tabs-1 .col2 .row')) {
      const label = clean(row.querySelector('label')?.textContent);
      const value = clean([...row.querySelectorAll('span')].find(span => clean(span.textContent))?.textContent);
      const binding = row.getAttribute('data-bind')?.match(/visible:\s*([A-Za-z]+)/)?.[1] || '';
      if (label && value) details.push([normalize(label), value]);
      if (binding && value) details.push([normalize(binding), value]);
    }
    return details;
  }

  function collectPhotos() {
    const urls = new Set();
    for (const image of document.querySelectorAll('.details-img-gal img[src], .details-img-gal-thm img[src], img[data-bind*="zoom"][src], img[src*="bcaimage.com/Document"]')) {
      const url = image.currentSrc || image.src || image.getAttribute('src');
      if (!/bcaimage\.com\/Document\?DocType=VehicleImage/i.test(url || '')) continue;
      urls.add(url.replace(/\/(Small|Medium)\//i, '/Medium/'));
    }
    return [...urls];
  }

  function boundText(bindingName) {
    return [...document.querySelectorAll(`[data-bind*="${bindingName}"]`)]
      .map(element => clean(element.textContent))
      .find(value => /\d/.test(value)) || '';
  }

  function formatMileage(value) {
    const text = clean(value);
    return text && !/\bkm\b/i.test(text) ? `${text} km` : text;
  }

  function value(details, names) {
    return details.find(([label]) => names.some(name => label === name || label.includes(name)))?.[1] || '';
  }
  function unique(values) { return [...new Set(values)]; }
  function normalize(value) { return clean(value).replace(/:$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
})();
