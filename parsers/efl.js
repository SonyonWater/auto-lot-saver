(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['aukcje.efl.com.pl'] = { extract };

  function extract() {
    const base = window.AutoLotParsers.generic.extract();
    const pairs = tablePairs();
    const productName = clean(document.querySelector('.product-name')?.textContent);
    const brand = value(pairs, ['marka', 'brand']) || brandFromName(productName);
    const rawColor = value(pairs, ['kolor', 'color']);
    const metallic = value(pairs, ['kolor metallic', 'metallic']);
    const color = [rawColor, metallic && !/^nie$/i.test(metallic) ? (metallic === 'Tak' ? 'metallic' : metallic) : ''].filter(Boolean).join(', ');
    const registrationDate = value(pairs, ['data pierwszej rejestracji w kraju', 'data pierwszej rejestracji']);
    const title = base.title || productName;
    return {
      ...base,
      title,
      fields: {
        brand,
        model: value(pairs, ['model']) || modelFromName(productName, brand),
        year: value(pairs, ['rok produkcji']) || title.match(/\b(?:19|20)\d{2}\b/)?.[0] || registrationDate.match(/^\d{4}/)?.[0],
        mileage: value(pairs, ['przebieg odczytany', 'przebieg']),
        color,
        engine: value(pairs, ['silnik', 'pojemność silnika']),
        transmission: value(pairs, ['skrzynia biegów', 'transmisja'])
      },
      details: {
        fuel: value(pairs, ['rodzaj paliwa', 'paliwo']),
        registrationDate,
        vin: value(pairs, ['vin']),
        registrationNumber: value(pairs, ['nr rejestracyjny', 'numer rejestracyjny']),
        vehicleCategory: value(pairs, ['rodzaj pojazdu', 'typ pojazdu']),
        numberOfKeys: value(pairs, ['liczba kluczy', 'number of keys']),
        seats: value(pairs, ['liczba miejsc']),
        co2: value(pairs, ['emisja co2', 'co2 emission']),
        emissionClass: value(pairs, ['klasa emisji spalin', 'greenhouse gas emission class'])
      }
    };
  }

  function tablePairs() {
    const pairs = [];
    for (const row of document.querySelectorAll('.product-details .simple-table tr')) {
      const cells = [...row.querySelectorAll('td')].map(cell => clean(cell.textContent)).filter(Boolean);
      for (let index = 0; index < cells.length - 1; index += 2) {
        if (cells[index] && cells[index + 1]) pairs.push([normalize(cells[index]), cells[index + 1]]);
      }
    }
    return pairs;
  }

  function value(pairs, labels) { return pairs.find(([label]) => labels.includes(label))?.[1] || ''; }
  function brandFromName(name) { return clean(name.replace(/^efl\s+finance\s+/i, '').split(' ')[0]); }
  function modelFromName(name, brand) { return clean(name.replace(/^efl\s+finance\s+/i, '').replace(new RegExp(`^${escapeRegExp(brand)}\\s*`, 'i')).replace(/\b(?:19|20)\d{2}r?\.?\b.*$/i, '')); }
  function normalize(value) { return clean(value).replace(/:$/, '').toLocaleLowerCase('pl'); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
})();
