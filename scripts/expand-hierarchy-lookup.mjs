#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function readArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx < 0 || idx + 1 >= process.argv.length) return ''
  return String(process.argv[idx + 1] || '').trim()
}

const APP_ID = readArg('--appId') || process.env.SPLUNK_APP_ID || 'splunk_globe_app_v2'
const LOOKUP_PATH = path.join('splunk_app', APP_ID, 'lookups', 'geo_points_us_eu_hierarchy.csv')
const DELTA_PATH = path.join('splunk_app', APP_ID, 'lookups', 'geo_points_us_eu_hierarchy.delta.json')
const HEADERS = ['snapshot', 'continent', 'country', 'state', 'county', 'city', 'lat', 'lon', 'value', 'label', 'category', 'source']
const KEY_FIELDS = ['snapshot', 'continent', 'country', 'state', 'county', 'city']
const SNAPSHOTS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']

const EU_REMAINING_COUNTRY_SEEDS = [
  {
    country: 'Cyprus',
    states: [
      { name: 'Nicosia District', center: [35.1856, 33.3823], cityA: 'Nicosia', cityB: 'Strovolos' },
      { name: 'Limassol District', center: [34.7071, 33.0226], cityA: 'Limassol', cityB: 'Ypsonas' },
      { name: 'Larnaca District', center: [34.9003, 33.6232], cityA: 'Larnaca', cityB: 'Aradippou' },
    ],
  },
  {
    country: 'Estonia',
    states: [
      { name: 'Harju County', center: [59.4370, 24.7536], cityA: 'Tallinn', cityB: 'Maardu' },
      { name: 'Tartu County', center: [58.3776, 26.7290], cityA: 'Tartu', cityB: 'Elva' },
      { name: 'Ida-Viru County', center: [59.3592, 27.4211], cityA: 'Narva', cityB: 'Kohtla-Jarve' },
    ],
  },
  {
    country: 'Latvia',
    states: [
      { name: 'Riga Region', center: [56.9496, 24.1052], cityA: 'Riga', cityB: 'Jurmala' },
      { name: 'Kurzeme Region', center: [56.5047, 21.0108], cityA: 'Liepaja', cityB: 'Ventspils' },
      { name: 'Vidzeme Region', center: [57.5411, 25.4272], cityA: 'Valmiera', cityB: 'Cesis' },
    ],
  },
  {
    country: 'Lithuania',
    states: [
      { name: 'Vilnius County', center: [54.6872, 25.2797], cityA: 'Vilnius', cityB: 'Ukmerge' },
      { name: 'Kaunas County', center: [54.8985, 23.9036], cityA: 'Kaunas', cityB: 'Jonava' },
      { name: 'Klaipeda County', center: [55.7033, 21.1443], cityA: 'Klaipeda', cityB: 'Palanga' },
    ],
  },
  {
    country: 'Luxembourg',
    states: [
      { name: 'Luxembourg District', center: [49.6116, 6.1319], cityA: 'Luxembourg City', cityB: 'Esch-sur-Alzette' },
      { name: 'Diekirch District', center: [49.8672, 6.1597], cityA: 'Diekirch', cityB: 'Ettelbruck' },
      { name: 'Grevenmacher District', center: [49.6806, 6.4412], cityA: 'Grevenmacher', cityB: 'Remich' },
    ],
  },
  {
    country: 'Malta',
    states: [
      { name: 'Northern Region', center: [35.9375, 14.3754], cityA: 'Birkirkara', cityB: 'Mosta' },
      { name: 'Harbour Region', center: [35.8989, 14.5146], cityA: 'Valletta', cityB: 'Sliema' },
      { name: 'Gozo Region', center: [36.0443, 14.2512], cityA: 'Victoria', cityB: 'Xaghra' },
    ],
  },
  {
    country: 'Iceland',
    states: [
      { name: 'Capital Region', center: [64.1466, -21.9426], cityA: 'Reykjavik', cityB: 'Kopavogur' },
      { name: 'Southern Peninsula', center: [63.9998, -22.5580], cityA: 'Keflavik', cityB: 'Grindavik' },
      { name: 'North Iceland', center: [65.6885, -18.1262], cityA: 'Akureyri', cityB: 'Husavik' },
    ],
  },
]

const US_REMAINING_STATE_SEEDS = [
  { state: 'Alaska', center: [61.2181, -149.9003], cityA: 'Anchorage', cityB: 'Fairbanks' },
  { state: 'Arkansas', center: [34.7465, -92.2896], cityA: 'Little Rock', cityB: 'Fayetteville' },
  { state: 'Delaware', center: [39.7391, -75.5398], cityA: 'Wilmington', cityB: 'Dover' },
  { state: 'Hawaii', center: [21.3099, -157.8581], cityA: 'Honolulu', cityB: 'Hilo' },
  { state: 'Idaho', center: [43.6150, -116.2023], cityA: 'Boise', cityB: 'Idaho Falls' },
  { state: 'Iowa', center: [41.5868, -93.6250], cityA: 'Des Moines', cityB: 'Cedar Rapids' },
  { state: 'Kansas', center: [37.6872, -97.3301], cityA: 'Wichita', cityB: 'Overland Park' },
  { state: 'Maine', center: [43.6591, -70.2568], cityA: 'Portland', cityB: 'Bangor' },
  { state: 'Mississippi', center: [32.2988, -90.1848], cityA: 'Jackson', cityB: 'Gulfport' },
  { state: 'Montana', center: [45.7833, -108.5007], cityA: 'Billings', cityB: 'Missoula' },
  { state: 'Nebraska', center: [41.2565, -95.9345], cityA: 'Omaha', cityB: 'Lincoln' },
  { state: 'New Hampshire', center: [43.2081, -71.5376], cityA: 'Concord', cityB: 'Manchester' },
  { state: 'New Mexico', center: [35.0844, -106.6504], cityA: 'Albuquerque', cityB: 'Santa Fe' },
  { state: 'North Dakota', center: [46.8083, -100.7837], cityA: 'Bismarck', cityB: 'Fargo' },
  { state: 'Rhode Island', center: [41.8240, -71.4128], cityA: 'Providence', cityB: 'Warwick' },
  { state: 'South Dakota', center: [44.0805, -103.2310], cityA: 'Rapid City', cityB: 'Sioux Falls' },
  { state: 'Utah', center: [40.7608, -111.8910], cityA: 'Salt Lake City', cityB: 'Provo' },
  { state: 'Vermont', center: [44.4759, -73.2121], cityA: 'Burlington', cityB: 'Montpelier' },
  { state: 'West Virginia', center: [38.3498, -81.6326], cityA: 'Charleston', cityB: 'Morgantown' },
  { state: 'Wyoming', center: [41.1400, -104.8202], cityA: 'Cheyenne', cityB: 'Casper' },
]

const PHASES = [
  {
    id: 'us-eu-expansion-001',
    description: 'Add additional US states and major EU countries for deeper country/state/county/city drilldown.',
    regions: [
      {
        continent: 'North America',
        country: 'United States',
        states: [
          {
            name: 'Washington',
            counties: [
              { name: 'King County', center: [47.6062, -122.3321], cities: ['Seattle', 'Bellevue'] },
              { name: 'Pierce County', center: [47.2529, -122.4443], cities: ['Tacoma', 'Puyallup'] },
              { name: 'Snohomish County', center: [47.9789, -122.2021], cities: ['Everett', 'Lynnwood'] },
            ],
          },
          {
            name: 'Pennsylvania',
            counties: [
              { name: 'Philadelphia County', center: [39.9526, -75.1652], cities: ['Philadelphia', 'University City'] },
              { name: 'Allegheny County', center: [40.4406, -79.9959], cities: ['Pittsburgh', 'McKeesport'] },
              { name: 'Montgomery County', center: [40.2290, -75.3877], cities: ['Norristown', 'Lansdale'] },
            ],
          },
          {
            name: 'Ohio',
            counties: [
              { name: 'Cuyahoga County', center: [41.4993, -81.6944], cities: ['Cleveland', 'Parma'] },
              { name: 'Franklin County', center: [39.9612, -82.9988], cities: ['Columbus', 'Dublin'] },
              { name: 'Hamilton County', center: [39.1031, -84.5120], cities: ['Cincinnati', 'Norwood'] },
            ],
          },
          {
            name: 'Georgia',
            counties: [
              { name: 'Fulton County', center: [33.7490, -84.3880], cities: ['Atlanta', 'Sandy Springs'] },
              { name: 'Cobb County', center: [33.9526, -84.5499], cities: ['Marietta', 'Smyrna'] },
              { name: 'DeKalb County', center: [33.7710, -84.2952], cities: ['Decatur', 'Stone Mountain'] },
            ],
          },
          {
            name: 'Massachusetts',
            counties: [
              { name: 'Suffolk County', center: [42.3601, -71.0589], cities: ['Boston', 'Revere'] },
              { name: 'Middlesex County', center: [42.3736, -71.1097], cities: ['Cambridge', 'Lowell'] },
              { name: 'Essex County', center: [42.6334, -70.7829], cities: ['Salem', 'Lynn'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Italy',
        states: [
          {
            name: 'Lombardy',
            counties: [
              { name: 'Milan Metro', center: [45.4642, 9.1900], cities: ['Milan', 'Sesto San Giovanni'] },
              { name: 'Brescia Province', center: [45.5416, 10.2118], cities: ['Brescia', 'Desenzano'] },
              { name: 'Bergamo Province', center: [45.6983, 9.6773], cities: ['Bergamo', 'Treviglio'] },
            ],
          },
          {
            name: 'Lazio',
            counties: [
              { name: 'Rome Metro', center: [41.9028, 12.4964], cities: ['Rome', 'Tivoli'] },
              { name: 'Latina Province', center: [41.4676, 12.9037], cities: ['Latina', 'Formia'] },
              { name: 'Frosinone Province', center: [41.6397, 13.3426], cities: ['Frosinone', 'Sora'] },
            ],
          },
          {
            name: 'Emilia-Romagna',
            counties: [
              { name: 'Bologna Metro', center: [44.4949, 11.3426], cities: ['Bologna', 'Imola'] },
              { name: 'Parma Province', center: [44.8015, 10.3279], cities: ['Parma', 'Fidenza'] },
              { name: 'Ravenna Province', center: [44.4184, 12.2035], cities: ['Ravenna', 'Faenza'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Netherlands',
        states: [
          {
            name: 'North Holland',
            counties: [
              { name: 'Amsterdam Region', center: [52.3676, 4.9041], cities: ['Amsterdam', 'Haarlem'] },
              { name: 'Alkmaar Region', center: [52.6324, 4.7534], cities: ['Alkmaar', 'Heerhugowaard'] },
              { name: 'Hilversum Region', center: [52.2292, 5.1669], cities: ['Hilversum', 'Bussum'] },
            ],
          },
          {
            name: 'South Holland',
            counties: [
              { name: 'Rotterdam Region', center: [51.9244, 4.4777], cities: ['Rotterdam', 'Schiedam'] },
              { name: 'The Hague Region', center: [52.0705, 4.3007], cities: ['The Hague', 'Delft'] },
              { name: 'Leiden Region', center: [52.1601, 4.4970], cities: ['Leiden', 'Alphen aan den Rijn'] },
            ],
          },
          {
            name: 'North Brabant',
            counties: [
              { name: 'Eindhoven Region', center: [51.4416, 5.4697], cities: ['Eindhoven', 'Helmond'] },
              { name: 'Breda Region', center: [51.5719, 4.7683], cities: ['Breda', 'Oosterhout'] },
              { name: 'Tilburg Region', center: [51.5555, 5.0913], cities: ['Tilburg', 'Waalwijk'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Poland',
        states: [
          {
            name: 'Masovian',
            counties: [
              { name: 'Warsaw Area', center: [52.2297, 21.0122], cities: ['Warsaw', 'Pruszkow'] },
              { name: 'Radom Area', center: [51.4027, 21.1471], cities: ['Radom', 'Pionki'] },
              { name: 'Plock Area', center: [52.5468, 19.7064], cities: ['Plock', 'Gostynin'] },
            ],
          },
          {
            name: 'Lesser Poland',
            counties: [
              { name: 'Krakow Area', center: [50.0647, 19.9450], cities: ['Krakow', 'Skawina'] },
              { name: 'Tarnow Area', center: [50.0121, 20.9858], cities: ['Tarnow', 'Debica'] },
              { name: 'Nowy Sacz Area', center: [49.6219, 20.6970], cities: ['Nowy Sacz', 'Grybow'] },
            ],
          },
          {
            name: 'Silesian',
            counties: [
              { name: 'Katowice Area', center: [50.2649, 19.0238], cities: ['Katowice', 'Sosnowiec'] },
              { name: 'Gliwice Area', center: [50.2945, 18.6714], cities: ['Gliwice', 'Zabrze'] },
              { name: 'Czestochowa Area', center: [50.8118, 19.1203], cities: ['Czestochowa', 'Myszkow'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Sweden',
        states: [
          {
            name: 'Stockholm County',
            counties: [
              { name: 'Stockholm Metro', center: [59.3293, 18.0686], cities: ['Stockholm', 'Solna'] },
              { name: 'Sodertalje Area', center: [59.1955, 17.6252], cities: ['Sodertalje', 'Nykvarn'] },
              { name: 'Norrtalje Area', center: [59.7580, 18.7050], cities: ['Norrtalje', 'Rimbo'] },
            ],
          },
          {
            name: 'Vastra Gotaland',
            counties: [
              { name: 'Gothenburg Metro', center: [57.7089, 11.9746], cities: ['Gothenburg', 'Molndal'] },
              { name: 'Borås Area', center: [57.7210, 12.9401], cities: ['Borås', 'Ulricehamn'] },
              { name: 'Skovde Area', center: [58.3913, 13.8451], cities: ['Skovde', 'Lidkoping'] },
            ],
          },
          {
            name: 'Skane County',
            counties: [
              { name: 'Malmö Area', center: [55.604981, 13.003822], cities: ['Malmö', 'Lund'] },
              { name: 'Helsingborg Area', center: [56.0465, 12.6945], cities: ['Helsingborg', 'Angelholm'] },
              { name: 'Kristianstad Area', center: [56.0294, 14.1567], cities: ['Kristianstad', 'Hassleholm'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Ireland',
        states: [
          {
            name: 'Leinster',
            counties: [
              { name: 'Dublin County', center: [53.3498, -6.2603], cities: ['Dublin', 'Swords'] },
              { name: 'Kildare County', center: [53.1596, -6.9092], cities: ['Naas', 'Newbridge'] },
              { name: 'Wicklow County', center: [53.0100, -6.3331], cities: ['Bray', 'Wicklow'] },
            ],
          },
          {
            name: 'Munster',
            counties: [
              { name: 'Cork County', center: [51.8985, -8.4756], cities: ['Cork', 'Cobh'] },
              { name: 'Limerick County', center: [52.6680, -8.6305], cities: ['Limerick', 'Shannon'] },
              { name: 'Waterford County', center: [52.2593, -7.1101], cities: ['Waterford', 'Tramore'] },
            ],
          },
          {
            name: 'Connacht',
            counties: [
              { name: 'Galway County', center: [53.2707, -9.0568], cities: ['Galway', 'Tuam'] },
              { name: 'Mayo County', center: [53.8570, -9.2982], cities: ['Castlebar', 'Ballina'] },
              { name: 'Sligo County', center: [54.2766, -8.4761], cities: ['Sligo', 'Tubbercurry'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'us-eu-expansion-002',
    description: 'Densify US+EU locality detail with derived city sectors for deeper city-level drilldown.',
    kind: 'variants',
    variantLabels: ['North Sector', 'South Sector'],
    maxAbsJitter: 0.08,
    valueMultipliers: [1.06, 0.95],
    source: 'all-current',
  },
  {
    id: 'us-eu-expansion-003',
    description: 'Add a tertiary pulse layer across current rows to scale timeline and local drill density toward ~10k rows.',
    kind: 'variants',
    variantLabels: ['Pulse'],
    maxAbsJitter: 0.05,
    valueMultipliers: [1.02],
    source: 'all-current',
  },
  {
    id: 'us-eu-expansion-004',
    description: 'Add real-country enrichment for Canada/Mexico and additional European countries for broader administrative drilldown coverage.',
    regions: [
      {
        continent: 'North America',
        country: 'Canada',
        states: [
          {
            name: 'Ontario',
            counties: [
              { name: 'Greater Toronto Area', center: [43.6532, -79.3832], cities: ['Toronto', 'Mississauga'] },
              { name: 'Ottawa Division', center: [45.4215, -75.6972], cities: ['Ottawa', 'Kanata'] },
              { name: 'Waterloo Region', center: [43.4516, -80.4925], cities: ['Kitchener', 'Waterloo'] },
            ],
          },
          {
            name: 'Quebec',
            counties: [
              { name: 'Montreal Agglomeration', center: [45.5017, -73.5673], cities: ['Montreal', 'Laval'] },
              { name: 'Quebec City Area', center: [46.8139, -71.2080], cities: ['Quebec City', 'Levis'] },
              { name: 'Gatineau Region', center: [45.4765, -75.7013], cities: ['Gatineau', 'Aylmer'] },
            ],
          },
          {
            name: 'British Columbia',
            counties: [
              { name: 'Metro Vancouver', center: [49.2827, -123.1207], cities: ['Vancouver', 'Burnaby'] },
              { name: 'Capital Region', center: [48.4284, -123.3656], cities: ['Victoria', 'Saanich'] },
              { name: 'Kelowna Area', center: [49.8880, -119.4960], cities: ['Kelowna', 'West Kelowna'] },
            ],
          },
        ],
      },
      {
        continent: 'North America',
        country: 'Mexico',
        states: [
          {
            name: 'Ciudad de Mexico',
            counties: [
              { name: 'Cuauhtemoc', center: [19.4326, -99.1332], cities: ['Mexico City', 'Centro'] },
              { name: 'Coyoacan', center: [19.3467, -99.1617], cities: ['Coyoacan', 'Del Carmen'] },
              { name: 'Iztapalapa', center: [19.3553, -99.0622], cities: ['Iztapalapa', 'Santa Martha'] },
            ],
          },
          {
            name: 'Jalisco',
            counties: [
              { name: 'Guadalajara Metro', center: [20.6597, -103.3496], cities: ['Guadalajara', 'Zapopan'] },
              { name: 'Puerto Vallarta', center: [20.6534, -105.2253], cities: ['Puerto Vallarta', 'Ixtapa'] },
              { name: 'Tlaquepaque Area', center: [20.6400, -103.3110], cities: ['Tlaquepaque', 'Tonalá'] },
            ],
          },
          {
            name: 'Nuevo Leon',
            counties: [
              { name: 'Monterrey Metro', center: [25.6866, -100.3161], cities: ['Monterrey', 'San Nicolas'] },
              { name: 'Guadalupe Area', center: [25.6775, -100.2590], cities: ['Guadalupe', 'Apodaca'] },
              { name: 'San Pedro Garza Garcia', center: [25.6573, -100.4027], cities: ['San Pedro', 'Valle'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Belgium',
        states: [
          {
            name: 'Flanders',
            counties: [
              { name: 'Antwerp Province', center: [51.2194, 4.4025], cities: ['Antwerp', 'Mechelen'] },
              { name: 'East Flanders', center: [51.0543, 3.7174], cities: ['Ghent', 'Aalst'] },
              { name: 'West Flanders', center: [51.2093, 3.2247], cities: ['Bruges', 'Kortrijk'] },
            ],
          },
          {
            name: 'Wallonia',
            counties: [
              { name: 'Liege Province', center: [50.6326, 5.5797], cities: ['Liege', 'Seraing'] },
              { name: 'Hainaut Province', center: [50.4108, 4.4446], cities: ['Charleroi', 'Mons'] },
              { name: 'Namur Province', center: [50.4674, 4.8718], cities: ['Namur', 'Dinant'] },
            ],
          },
          {
            name: 'Brussels Region',
            counties: [
              { name: 'Brussels-Capital', center: [50.8503, 4.3517], cities: ['Brussels', 'Anderlecht'] },
              { name: 'Ixelles Area', center: [50.8333, 4.3667], cities: ['Ixelles', 'Uccle'] },
              { name: 'Schaerbeek Area', center: [50.8676, 4.3795], cities: ['Schaerbeek', 'Evere'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Austria',
        states: [
          {
            name: 'Vienna',
            counties: [
              { name: 'Innere Stadt', center: [48.2082, 16.3738], cities: ['Vienna', 'Leopoldstadt'] },
              { name: 'Favoriten District', center: [48.1742, 16.3748], cities: ['Favoriten', 'Simmering'] },
              { name: 'Donaustadt District', center: [48.2333, 16.4500], cities: ['Donaustadt', 'Kagran'] },
            ],
          },
          {
            name: 'Upper Austria',
            counties: [
              { name: 'Linz Area', center: [48.3069, 14.2858], cities: ['Linz', 'Steyr'] },
              { name: 'Wels Area', center: [48.1575, 14.0289], cities: ['Wels', 'Marchtrenk'] },
              { name: 'Salzkammergut', center: [47.8030, 13.7850], cities: ['Gmunden', 'Bad Ischl'] },
            ],
          },
          {
            name: 'Styria',
            counties: [
              { name: 'Graz Area', center: [47.0707, 15.4395], cities: ['Graz', 'Seiersberg'] },
              { name: 'Leoben Area', center: [47.3765, 15.0910], cities: ['Leoben', 'Bruck an der Mur'] },
              { name: 'Murtal Area', center: [47.1960, 14.7000], cities: ['Judenburg', 'Knittelfeld'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Portugal',
        states: [
          {
            name: 'Lisbon District',
            counties: [
              { name: 'Lisbon Metro', center: [38.7223, -9.1393], cities: ['Lisbon', 'Amadora'] },
              { name: 'Sintra Area', center: [38.8029, -9.3817], cities: ['Sintra', 'Queluz'] },
              { name: 'Cascais Area', center: [38.6979, -9.4215], cities: ['Cascais', 'Estoril'] },
            ],
          },
          {
            name: 'Porto District',
            counties: [
              { name: 'Porto Metro', center: [41.1579, -8.6291], cities: ['Porto', 'Gaia'] },
              { name: 'Matosinhos Area', center: [41.1800, -8.6900], cities: ['Matosinhos', 'Leça da Palmeira'] },
              { name: 'Maia Area', center: [41.2350, -8.6190], cities: ['Maia', 'Moreira'] },
            ],
          },
          {
            name: 'Setubal District',
            counties: [
              { name: 'Setubal Area', center: [38.5244, -8.8882], cities: ['Setubal', 'Palmela'] },
              { name: 'Almada Area', center: [38.6790, -9.1569], cities: ['Almada', 'Caparica'] },
              { name: 'Barreiro Area', center: [38.6631, -9.0724], cities: ['Barreiro', 'Moita'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Czechia',
        states: [
          {
            name: 'Prague',
            counties: [
              { name: 'Prague Center', center: [50.0755, 14.4378], cities: ['Prague', 'Smichov'] },
              { name: 'Prague East', center: [50.0833, 14.4667], cities: ['Karlin', 'Vysocany'] },
              { name: 'Prague South', center: [50.0500, 14.4200], cities: ['Nusle', 'Krc'] },
            ],
          },
          {
            name: 'South Moravian',
            counties: [
              { name: 'Brno Area', center: [49.1951, 16.6068], cities: ['Brno', 'Modrice'] },
              { name: 'Znojmo Area', center: [48.8555, 16.0488], cities: ['Znojmo', 'Miroslav'] },
              { name: 'Breclav Area', center: [48.7589, 16.8820], cities: ['Breclav', 'Mikulov'] },
            ],
          },
          {
            name: 'Moravian-Silesian',
            counties: [
              { name: 'Ostrava Area', center: [49.8209, 18.2625], cities: ['Ostrava', 'Havířov'] },
              { name: 'Opava Area', center: [49.9387, 17.9026], cities: ['Opava', 'Krnov'] },
              { name: 'Frydek-Mistek Area', center: [49.6850, 18.3490], cities: ['Frydek-Mistek', 'Trinec'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Romania',
        states: [
          {
            name: 'Bucharest-Ilfov',
            counties: [
              { name: 'Bucharest Center', center: [44.4268, 26.1025], cities: ['Bucharest', 'Sector 3'] },
              { name: 'Ilfov North', center: [44.5350, 26.2200], cities: ['Otopeni', 'Voluntari'] },
              { name: 'Ilfov West', center: [44.4300, 25.9900], cities: ['Chiajna', 'Bragadiru'] },
            ],
          },
          {
            name: 'Cluj',
            counties: [
              { name: 'Cluj-Napoca Area', center: [46.7712, 23.6236], cities: ['Cluj-Napoca', 'Floresti'] },
              { name: 'Turda Area', center: [46.5667, 23.7833], cities: ['Turda', 'Campia Turzii'] },
              { name: 'Dej Area', center: [47.1417, 23.8750], cities: ['Dej', 'Gherla'] },
            ],
          },
          {
            name: 'Timis',
            counties: [
              { name: 'Timisoara Area', center: [45.7489, 21.2087], cities: ['Timisoara', 'Dumbravita'] },
              { name: 'Lugoj Area', center: [45.6886, 21.9031], cities: ['Lugoj', 'Buzias'] },
              { name: 'Sannicolau Mare Area', center: [46.0700, 20.6300], cities: ['Sannicolau Mare', 'Jimbolia'] },
            ],
          },
        ],
      },
      {
        continent: 'Europe',
        country: 'Finland',
        states: [
          {
            name: 'Uusimaa',
            counties: [
              { name: 'Helsinki Area', center: [60.1699, 24.9384], cities: ['Helsinki', 'Espoo'] },
              { name: 'Vantaa Area', center: [60.2934, 25.0378], cities: ['Vantaa', 'Kerava'] },
              { name: 'Porvoo Area', center: [60.3923, 25.6651], cities: ['Porvoo', 'Sipoo'] },
            ],
          },
          {
            name: 'Pirkanmaa',
            counties: [
              { name: 'Tampere Area', center: [61.4978, 23.7610], cities: ['Tampere', 'Nokia'] },
              { name: 'Valkeakoski Area', center: [61.2642, 24.0315], cities: ['Valkeakoski', 'Akaa'] },
              { name: 'Sastamala Area', center: [61.3400, 22.9100], cities: ['Sastamala', 'Punkalaidun'] },
            ],
          },
          {
            name: 'Southwest Finland',
            counties: [
              { name: 'Turku Area', center: [60.4518, 22.2666], cities: ['Turku', 'Kaarina'] },
              { name: 'Salo Area', center: [60.3833, 23.1333], cities: ['Salo', 'Paimio'] },
              { name: 'Rauma Area', center: [61.1300, 21.5100], cities: ['Rauma', 'Eurajoki'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'us-eu-expansion-005',
    description: 'EU country backfill tranche 1 for missing-country coverage (Nordics/Balkans/Baltics/Central Europe).',
    regions: [
      {
        continent: 'Europe',
        country: 'Denmark',
        states: [
          { name: 'Capital Region', counties: [
            { name: 'Copenhagen Area', center: [55.6761, 12.5683], cities: ['Copenhagen', 'Frederiksberg'] },
            { name: 'North Zealand', center: [56.0435, 12.6130], cities: ['Hillerod', 'Helsingor'] },
            { name: 'Bornholm', center: [55.1600, 14.8660], cities: ['Ronne', 'Nexo'] },
          ]},
          { name: 'Central Denmark', counties: [
            { name: 'Aarhus Area', center: [56.1629, 10.2039], cities: ['Aarhus', 'Randers'] },
            { name: 'Viborg Area', center: [56.4532, 9.4020], cities: ['Viborg', 'Silkeborg'] },
            { name: 'Herning Area', center: [56.1393, 8.9732], cities: ['Herning', 'Holstebro'] },
          ]},
          { name: 'Southern Denmark', counties: [
            { name: 'Odense Area', center: [55.4038, 10.4024], cities: ['Odense', 'Svendborg'] },
            { name: 'Esbjerg Area', center: [55.4765, 8.4594], cities: ['Esbjerg', 'Varde'] },
            { name: 'Kolding Area', center: [55.4904, 9.4722], cities: ['Kolding', 'Vejle'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Norway',
        states: [
          { name: 'Oslo', counties: [
            { name: 'Oslo Municipality', center: [59.9139, 10.7522], cities: ['Oslo', 'Bærum'] },
            { name: 'Romerike', center: [60.1000, 11.1000], cities: ['Lillestrom', 'Jessheim'] },
            { name: 'Follo', center: [59.7400, 10.7800], cities: ['Ski', 'Drøbak'] },
          ]},
          { name: 'Vestland', counties: [
            { name: 'Bergen Area', center: [60.3913, 5.3221], cities: ['Bergen', 'Askoy'] },
            { name: 'Sogn Area', center: [61.2290, 6.0720], cities: ['Sogndal', 'Floro'] },
            { name: 'Hardanger Area', center: [60.3700, 6.1400], cities: ['Odda', 'Voss'] },
          ]},
          { name: 'Trondelag', counties: [
            { name: 'Trondheim Area', center: [63.4305, 10.3951], cities: ['Trondheim', 'Stjordal'] },
            { name: 'Steinkjer Area', center: [64.0149, 11.4954], cities: ['Steinkjer', 'Levanger'] },
            { name: 'Namdal Area', center: [64.4700, 11.5100], cities: ['Namsos', 'Rorvik'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Switzerland',
        states: [
          { name: 'Zurich', counties: [
            { name: 'Zurich District', center: [47.3769, 8.5417], cities: ['Zurich', 'Winterthur'] },
            { name: 'Uster District', center: [47.3500, 8.7200], cities: ['Uster', 'Wetzikon'] },
            { name: 'Horgen District', center: [47.2600, 8.6000], cities: ['Horgen', 'Thalwil'] },
          ]},
          { name: 'Geneva', counties: [
            { name: 'Geneva District', center: [46.2044, 6.1432], cities: ['Geneva', 'Carouge'] },
            { name: 'Meyrin Area', center: [46.2300, 6.0800], cities: ['Meyrin', 'Vernier'] },
            { name: 'Nyon Area', center: [46.3800, 6.2400], cities: ['Nyon', 'Gland'] },
          ]},
          { name: 'Vaud', counties: [
            { name: 'Lausanne District', center: [46.5197, 6.6323], cities: ['Lausanne', 'Renens'] },
            { name: 'Montreux Area', center: [46.4312, 6.9107], cities: ['Montreux', 'Vevey'] },
            { name: 'Yverdon Area', center: [46.7785, 6.6412], cities: ['Yverdon', 'Orbe'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Greece',
        states: [
          { name: 'Attica', counties: [
            { name: 'Athens Metro', center: [37.9838, 23.7275], cities: ['Athens', 'Piraeus'] },
            { name: 'East Attica', center: [38.0000, 24.0000], cities: ['Rafina', 'Marathon'] },
            { name: 'West Attica', center: [38.0700, 23.5800], cities: ['Elefsina', 'Megara'] },
          ]},
          { name: 'Central Macedonia', counties: [
            { name: 'Thessaloniki Area', center: [40.6401, 22.9444], cities: ['Thessaloniki', 'Kalamaria'] },
            { name: 'Serres Area', center: [41.0850, 23.5490], cities: ['Serres', 'Sidirokastro'] },
            { name: 'Katerini Area', center: [40.2700, 22.5000], cities: ['Katerini', 'Litochoro'] },
          ]},
          { name: 'Crete', counties: [
            { name: 'Heraklion Area', center: [35.3387, 25.1442], cities: ['Heraklion', 'Gazi'] },
            { name: 'Chania Area', center: [35.5138, 24.0180], cities: ['Chania', 'Souda'] },
            { name: 'Rethymno Area', center: [35.3669, 24.4741], cities: ['Rethymno', 'Atsipopoulo'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Hungary',
        states: [
          { name: 'Central Hungary', counties: [
            { name: 'Budapest Area', center: [47.4979, 19.0402], cities: ['Budapest', 'Budaors'] },
            { name: 'Pest County', center: [47.1625, 19.5033], cities: ['Szentendre', 'Vecses'] },
            { name: 'Csepel Area', center: [47.4300, 19.0700], cities: ['Csepel', 'Szigetszentmiklos'] },
          ]},
          { name: 'Northern Hungary', counties: [
            { name: 'Miskolc Area', center: [48.1035, 20.7784], cities: ['Miskolc', 'Kazincbarcika'] },
            { name: 'Eger Area', center: [47.9025, 20.3772], cities: ['Eger', 'Fuzesabony'] },
            { name: 'Salgotarjan Area', center: [48.0935, 19.8024], cities: ['Salgotarjan', 'Bátonyterenye'] },
          ]},
          { name: 'Western Transdanubia', counties: [
            { name: 'Gyor Area', center: [47.6875, 17.6504], cities: ['Gyor', 'Mosonmagyarovar'] },
            { name: 'Sopron Area', center: [47.6817, 16.5845], cities: ['Sopron', 'Kapuvár'] },
            { name: 'Szombathely Area', center: [47.2307, 16.6218], cities: ['Szombathely', 'Kormend'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Bulgaria',
        states: [
          { name: 'Sofia City', counties: [
            { name: 'Sofia Center', center: [42.6977, 23.3219], cities: ['Sofia', 'Mladost'] },
            { name: 'Sofia West', center: [42.7000, 23.2500], cities: ['Lyulin', 'Bankya'] },
            { name: 'Sofia South', center: [42.6300, 23.3200], cities: ['Lozenets', 'Boyana'] },
          ]},
          { name: 'Plovdiv', counties: [
            { name: 'Plovdiv Center', center: [42.1354, 24.7453], cities: ['Plovdiv', 'Asenovgrad'] },
            { name: 'Karlovo Area', center: [42.6400, 24.8000], cities: ['Karlovo', 'Sopot'] },
            { name: 'Pazardzhik Area', center: [42.1900, 24.3300], cities: ['Pazardzhik', 'Velingrad'] },
          ]},
          { name: 'Varna', counties: [
            { name: 'Varna Center', center: [43.2141, 27.9147], cities: ['Varna', 'Aksakovo'] },
            { name: 'Dobrich Area', center: [43.5700, 27.8300], cities: ['Dobrich', 'Balchik'] },
            { name: 'Shumen Area', center: [43.2700, 26.9300], cities: ['Shumen', 'Novi Pazar'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Croatia',
        states: [
          { name: 'City of Zagreb', counties: [
            { name: 'Zagreb Center', center: [45.8150, 15.9819], cities: ['Zagreb', 'Sesvete'] },
            { name: 'Zagreb West', center: [45.8000, 15.9000], cities: ['Zapresic', 'Samobor'] },
            { name: 'Zagreb South', center: [45.7300, 16.0000], cities: ['Velika Gorica', 'Dugo Selo'] },
          ]},
          { name: 'Split-Dalmatia', counties: [
            { name: 'Split Area', center: [43.5081, 16.4402], cities: ['Split', 'Solin'] },
            { name: 'Makarska Area', center: [43.2969, 17.0176], cities: ['Makarska', 'Omis'] },
            { name: 'Sinj Area', center: [43.7030, 16.6390], cities: ['Sinj', 'Trilj'] },
          ]},
          { name: 'Primorje-Gorski Kotar', counties: [
            { name: 'Rijeka Area', center: [45.3271, 14.4422], cities: ['Rijeka', 'Opatija'] },
            { name: 'Krk Area', center: [45.0270, 14.5750], cities: ['Krk', 'Malinska'] },
            { name: 'Delnice Area', center: [45.4000, 14.8000], cities: ['Delnice', 'Vrbovsko'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Slovakia',
        states: [
          { name: 'Bratislava Region', counties: [
            { name: 'Bratislava Center', center: [48.1486, 17.1077], cities: ['Bratislava', 'Petrzalka'] },
            { name: 'Senec Area', center: [48.2200, 17.4000], cities: ['Senec', 'Pezinok'] },
            { name: 'Malacky Area', center: [48.4400, 17.0300], cities: ['Malacky', 'Stupava'] },
          ]},
          { name: 'Kosice Region', counties: [
            { name: 'Kosice Center', center: [48.7164, 21.2611], cities: ['Kosice', 'Presov'] },
            { name: 'Michalovce Area', center: [48.7500, 21.9200], cities: ['Michalovce', 'Sobrance'] },
            { name: 'Spis Area', center: [48.9400, 20.5600], cities: ['Spisska Nova Ves', 'Levoca'] },
          ]},
          { name: 'Zilina Region', counties: [
            { name: 'Zilina Area', center: [49.2231, 18.7394], cities: ['Zilina', 'Cadca'] },
            { name: 'Martin Area', center: [49.0660, 18.9230], cities: ['Martin', 'Vrutky'] },
            { name: 'Liptov Area', center: [49.0900, 19.6100], cities: ['Liptovsky Mikulas', 'Ruzomberok'] },
          ]},
        ],
      },
      {
        continent: 'Europe',
        country: 'Slovenia',
        states: [
          { name: 'Central Slovenia', counties: [
            { name: 'Ljubljana Area', center: [46.0569, 14.5058], cities: ['Ljubljana', 'Domzale'] },
            { name: 'Kamnik Area', center: [46.2200, 14.6100], cities: ['Kamnik', 'Mengeš'] },
            { name: 'Grosuplje Area', center: [45.9600, 14.6600], cities: ['Grosuplje', 'Ivančna Gorica'] },
          ]},
          { name: 'Drava', counties: [
            { name: 'Maribor Area', center: [46.5547, 15.6459], cities: ['Maribor', 'Ptuj'] },
            { name: 'Slovenska Bistrica', center: [46.3900, 15.5700], cities: ['Slovenska Bistrica', 'Poljčane'] },
            { name: 'Ormoz Area', center: [46.4100, 16.1500], cities: ['Ormoz', 'Ljutomer'] },
          ]},
          { name: 'Coastal-Karst', counties: [
            { name: 'Koper Area', center: [45.5481, 13.7302], cities: ['Koper', 'Izola'] },
            { name: 'Nova Gorica Area', center: [45.9560, 13.6480], cities: ['Nova Gorica', 'Ajdovščina'] },
            { name: 'Postojna Area', center: [45.7800, 14.2100], cities: ['Postojna', 'Pivka'] },
          ]},
        ],
      },
    ],
  },
  {
    id: 'us-eu-expansion-006',
    description: 'US state backfill tranche 1 (20 states) for broader national state/county/city drilldown coverage.',
    regions: [
      {
        continent: 'North America',
        country: 'United States',
        states: [
          { name: 'Arizona', counties: [
            { name: 'Maricopa County', center: [33.4484, -112.0740], cities: ['Phoenix', 'Mesa'] },
            { name: 'Pima County', center: [32.2226, -110.9747], cities: ['Tucson', 'Oro Valley'] },
            { name: 'Pinal County', center: [32.8795, -111.7574], cities: ['Casa Grande', 'Maricopa'] },
          ]},
          { name: 'Colorado', counties: [
            { name: 'Denver County', center: [39.7392, -104.9903], cities: ['Denver', 'Glendale'] },
            { name: 'El Paso County', center: [38.8339, -104.8214], cities: ['Colorado Springs', 'Manitou Springs'] },
            { name: 'Arapahoe County', center: [39.6750, -104.8320], cities: ['Aurora', 'Centennial'] },
          ]},
          { name: 'New Jersey', counties: [
            { name: 'Essex County', center: [40.7357, -74.1724], cities: ['Newark', 'East Orange'] },
            { name: 'Bergen County', center: [40.9150, -74.1620], cities: ['Hackensack', 'Fort Lee'] },
            { name: 'Middlesex County', center: [40.4862, -74.4518], cities: ['New Brunswick', 'Edison'] },
          ]},
          { name: 'Virginia', counties: [
            { name: 'Fairfax County', center: [38.8462, -77.3064], cities: ['Fairfax', 'Reston'] },
            { name: 'Richmond City', center: [37.5407, -77.4360], cities: ['Richmond', 'Highland Park'] },
            { name: 'Virginia Beach County', center: [36.8529, -75.9780], cities: ['Virginia Beach', 'Norfolk'] },
          ]},
          { name: 'North Carolina', counties: [
            { name: 'Mecklenburg County', center: [35.2271, -80.8431], cities: ['Charlotte', 'Huntersville'] },
            { name: 'Wake County', center: [35.7796, -78.6382], cities: ['Raleigh', 'Cary'] },
            { name: 'Durham County', center: [35.9940, -78.8986], cities: ['Durham', 'Chapel Hill'] },
          ]},
          { name: 'Michigan', counties: [
            { name: 'Wayne County', center: [42.3314, -83.0458], cities: ['Detroit', 'Dearborn'] },
            { name: 'Oakland County', center: [42.5803, -83.0302], cities: ['Troy', 'Pontiac'] },
            { name: 'Kent County', center: [42.9634, -85.6681], cities: ['Grand Rapids', 'Wyoming'] },
          ]},
          { name: 'Minnesota', counties: [
            { name: 'Hennepin County', center: [44.9778, -93.2650], cities: ['Minneapolis', 'Bloomington'] },
            { name: 'Ramsey County', center: [44.9537, -93.0900], cities: ['Saint Paul', 'Maplewood'] },
            { name: 'Dakota County', center: [44.8041, -93.1669], cities: ['Eagan', 'Burnsville'] },
          ]},
          { name: 'Missouri', counties: [
            { name: 'St. Louis County', center: [38.6270, -90.1994], cities: ['St. Louis', 'Florissant'] },
            { name: 'Jackson County', center: [39.0997, -94.5786], cities: ['Kansas City', 'Independence'] },
            { name: 'Greene County', center: [37.2089, -93.2923], cities: ['Springfield', 'Republic'] },
          ]},
          { name: 'Tennessee', counties: [
            { name: 'Davidson County', center: [36.1627, -86.7816], cities: ['Nashville', 'Belle Meade'] },
            { name: 'Shelby County', center: [35.1495, -90.0490], cities: ['Memphis', 'Germantown'] },
            { name: 'Knox County', center: [35.9606, -83.9207], cities: ['Knoxville', 'Farragut'] },
          ]},
          { name: 'Indiana', counties: [
            { name: 'Marion County', center: [39.7684, -86.1581], cities: ['Indianapolis', 'Carmel'] },
            { name: 'Lake County', center: [41.5934, -87.3464], cities: ['Gary', 'Hammond'] },
            { name: 'Allen County', center: [41.0793, -85.1394], cities: ['Fort Wayne', 'New Haven'] },
          ]},
          { name: 'Wisconsin', counties: [
            { name: 'Milwaukee County', center: [43.0389, -87.9065], cities: ['Milwaukee', 'West Allis'] },
            { name: 'Dane County', center: [43.0731, -89.4012], cities: ['Madison', 'Fitchburg'] },
            { name: 'Brown County', center: [44.5133, -88.0133], cities: ['Green Bay', 'De Pere'] },
          ]},
          { name: 'Maryland', counties: [
            { name: 'Baltimore City', center: [39.2904, -76.6122], cities: ['Baltimore', 'Towson'] },
            { name: 'Montgomery County', center: [39.1547, -77.2405], cities: ['Rockville', 'Gaithersburg'] },
            { name: 'Prince George County', center: [38.8300, -76.8500], cities: ['Bowie', 'Hyattsville'] },
          ]},
          { name: 'Oregon', counties: [
            { name: 'Multnomah County', center: [45.5152, -122.6784], cities: ['Portland', 'Gresham'] },
            { name: 'Washington County', center: [45.5229, -122.9898], cities: ['Hillsboro', 'Beaverton'] },
            { name: 'Lane County', center: [44.0521, -123.0868], cities: ['Eugene', 'Springfield'] },
          ]},
          { name: 'Louisiana', counties: [
            { name: 'Orleans Parish', center: [29.9511, -90.0715], cities: ['New Orleans', 'Metairie'] },
            { name: 'East Baton Rouge', center: [30.4515, -91.1871], cities: ['Baton Rouge', 'Zachary'] },
            { name: 'Jefferson Parish', center: [29.9888, -90.0820], cities: ['Kenner', 'Marrero'] },
          ]},
          { name: 'Kentucky', counties: [
            { name: 'Jefferson County', center: [38.2527, -85.7585], cities: ['Louisville', 'Shively'] },
            { name: 'Fayette County', center: [38.0406, -84.5037], cities: ['Lexington', 'Nicholasville'] },
            { name: 'Kenton County', center: [39.0837, -84.5086], cities: ['Covington', 'Erlanger'] },
          ]},
          { name: 'Connecticut', counties: [
            { name: 'Hartford County', center: [41.7658, -72.6734], cities: ['Hartford', 'West Hartford'] },
            { name: 'New Haven County', center: [41.3083, -72.9279], cities: ['New Haven', 'Hamden'] },
            { name: 'Fairfield County', center: [41.1792, -73.1894], cities: ['Bridgeport', 'Stamford'] },
          ]},
          { name: 'Alabama', counties: [
            { name: 'Jefferson County', center: [33.5186, -86.8104], cities: ['Birmingham', 'Hoover'] },
            { name: 'Mobile County', center: [30.6954, -88.0399], cities: ['Mobile', 'Prichard'] },
            { name: 'Madison County', center: [34.7304, -86.5861], cities: ['Huntsville', 'Madison'] },
          ]},
          { name: 'South Carolina', counties: [
            { name: 'Charleston County', center: [32.7765, -79.9311], cities: ['Charleston', 'Mount Pleasant'] },
            { name: 'Richland County', center: [34.0007, -81.0348], cities: ['Columbia', 'Forest Acres'] },
            { name: 'Greenville County', center: [34.8526, -82.3940], cities: ['Greenville', 'Mauldin'] },
          ]},
          { name: 'Oklahoma', counties: [
            { name: 'Oklahoma County', center: [35.4676, -97.5164], cities: ['Oklahoma City', 'Edmond'] },
            { name: 'Tulsa County', center: [36.1540, -95.9928], cities: ['Tulsa', 'Broken Arrow'] },
            { name: 'Cleveland County', center: [35.2226, -97.4395], cities: ['Norman', 'Moore'] },
          ]},
          { name: 'Nevada', counties: [
            { name: 'Clark County', center: [36.1699, -115.1398], cities: ['Las Vegas', 'Henderson'] },
            { name: 'Washoe County', center: [39.5296, -119.8138], cities: ['Reno', 'Sparks'] },
            { name: 'Carson City County', center: [39.1638, -119.7674], cities: ['Carson City', 'Minden'] },
          ]},
        ],
      },
    ],
  },
  {
    id: 'us-eu-expansion-007',
    description: 'Final EU country closure tranche based on remaining-country seeds.',
    kind: 'seeded-regions',
    continent: 'Europe',
    countrySeeds: EU_REMAINING_COUNTRY_SEEDS,
  },
  {
    id: 'us-eu-expansion-008',
    description: 'Final US state closure tranche based on remaining-state seeds.',
    kind: 'seeded-us-states',
    continent: 'North America',
    country: 'United States',
    stateSeeds: US_REMAINING_STATE_SEEDS,
  },
]

function pseudoRand(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function hashString(value) {
  let hash = 0
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(idx)
    hash |= 0
  }
  return Math.abs(hash)
}

function quoteCsv(value) {
  const v = String(value ?? '')
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function parseCsv(text) {
  const rows = []
  let i = 0
  let cell = ''
  let row = []
  let inQuotes = false

  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (ch === ',') {
      row.push(cell)
      cell = ''
      i += 1
      continue
    }

    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i += 1
      continue
    }

    if (ch === '\r') {
      i += 1
      continue
    }

    cell += ch
    i += 1
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function readLookup() {
  if (!fs.existsSync(LOOKUP_PATH)) {
    throw new Error(`Lookup file not found: ${LOOKUP_PATH}`)
  }
  const content = fs.readFileSync(LOOKUP_PATH, 'utf8')
  const rows = parseCsv(content)
  if (!rows.length) return []

  const headers = rows[0]
  const data = []
  for (let idx = 1; idx < rows.length; idx += 1) {
    const raw = rows[idx]
    if (!raw.length || raw.every((item) => item === '')) continue
    const item = {}
    headers.forEach((h, i) => {
      item[h] = raw[i] ?? ''
    })
    data.push(item)
  }
  return data
}

function writeLookup(rows) {
  const lines = [HEADERS.join(',')]
  for (const row of rows) {
    lines.push(HEADERS.map((h) => quoteCsv(row[h] ?? '')).join(','))
  }
  fs.writeFileSync(LOOKUP_PATH, `${lines.join('\n')}\n`, 'utf8')
}

function createKey(row) {
  return KEY_FIELDS.map((key) => String(row[key] ?? '').trim()).join('|')
}

function loadDelta(existingRows) {
  const baseline = {
    version: 1,
    lookupFile: LOOKUP_PATH.replace(/\\/g, '/'),
    keyFields: KEY_FIELDS,
    appliedPhases: [],
    baselineRowCount: existingRows.length,
    lastRowCount: existingRows.length,
    lastUpdatedAt: new Date().toISOString(),
  }

  if (!fs.existsSync(DELTA_PATH)) {
    return baseline
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DELTA_PATH, 'utf8'))
    return {
      ...baseline,
      ...parsed,
      appliedPhases: Array.isArray(parsed.appliedPhases) ? parsed.appliedPhases : [],
    }
  } catch {
    return baseline
  }
}

function saveDelta(delta) {
  fs.writeFileSync(DELTA_PATH, `${JSON.stringify(delta, null, 2)}\n`, 'utf8')
}

function buildRowsForRegionPhase(phase) {
  const rows = []
  let seed = 100 + phase.id.length

  for (const snapshot of SNAPSHOTS) {
    const snapshotIndex = SNAPSHOTS.indexOf(snapshot)
    const monthFactor = 1 + snapshotIndex * 0.07

    for (const region of phase.regions) {
      const countryWeight = 0.9 + pseudoRand(++seed) * 0.45

      for (const state of region.states) {
        const stateWeight = 0.85 + pseudoRand(++seed) * 0.5

        for (const county of state.counties) {
          for (let cityIndex = 0; cityIndex < county.cities.length; cityIndex += 1) {
            const city = county.cities[cityIndex]
            const jitterLat = (pseudoRand(++seed) - 0.5) * 0.30
            const jitterLon = (pseudoRand(++seed) - 0.5) * 0.30
            const lat = county.center[0] + jitterLat
            const lon = county.center[1] + jitterLon

            const baseline = 38 + pseudoRand(++seed) * 84
            const seasonal = (Math.sin((snapshotIndex + cityIndex + 1) * 1.17) + 1) * 12
            const value = Math.round((baseline * stateWeight * countryWeight * monthFactor + seasonal) * 10) / 10

            rows.push({
              snapshot,
              continent: region.continent,
              country: region.country,
              state: state.name,
              county: county.name,
              city,
              lat: lat.toFixed(4),
              lon: lon.toFixed(4),
              value: value.toFixed(1),
              label: city,
              category: state.name,
              source: region.country,
            })
          }
        }
      }
    }
  }

  return rows
}

function buildRowsForVariantPhase(phase, sourceRows) {
  const labels = Array.isArray(phase.variantLabels) ? phase.variantLabels : []
  if (!labels.length) return []

  const maxAbsJitter = Number(phase.maxAbsJitter)
  const jitter = Number.isFinite(maxAbsJitter) ? Math.max(0.01, Math.min(0.2, maxAbsJitter)) : 0.06
  const multipliers = Array.isArray(phase.valueMultipliers) ? phase.valueMultipliers : []

  const output = []
  for (const row of sourceRows) {
    const baseCity = String(row.city ?? '').trim()
    if (!baseCity) continue

    const baseLat = Number.parseFloat(String(row.lat ?? ''))
    const baseLon = Number.parseFloat(String(row.lon ?? ''))
    const baseValue = Number.parseFloat(String(row.value ?? '1'))
    if (!Number.isFinite(baseLat) || !Number.isFinite(baseLon)) continue

    for (let labelIdx = 0; labelIdx < labels.length; labelIdx += 1) {
      const label = labels[labelIdx]
      const multiplierRaw = Number(multipliers[labelIdx] ?? 1)
      const multiplier = Number.isFinite(multiplierRaw) ? multiplierRaw : 1
      const seed = hashString(`${createKey(row)}|${label}|${phase.id}`)

      const latJitter = (pseudoRand(seed + 11) - 0.5) * jitter * 2
      const lonJitter = (pseudoRand(seed + 23) - 0.5) * jitter * 2
      const season = (Math.sin((seed % 37) * 0.4) + 1) * 0.045

      const nextLat = Math.max(-89.8, Math.min(89.8, baseLat + latJitter))
      const nextLon = Math.max(-179.8, Math.min(179.8, baseLon + lonJitter))
      const nextValue = Math.max(1, ((Number.isFinite(baseValue) ? baseValue : 1) * (multiplier + season)))

      const nextCity = `${baseCity} - ${label}`
      output.push({
        snapshot: row.snapshot,
        continent: row.continent,
        country: row.country,
        state: row.state,
        county: row.county,
        city: nextCity,
        lat: nextLat.toFixed(4),
        lon: nextLon.toFixed(4),
        value: nextValue.toFixed(1),
        label: nextCity,
        category: row.category || row.state,
        source: row.source || row.country,
      })
    }
  }

  return output
}

function normalizeStateSeedToState(seed) {
  const stateName = seed.name || seed.state || 'Unknown State'
  const center = Array.isArray(seed.center) ? seed.center : [0, 0]
  const cityA = seed.cityA || `${stateName} City`
  const cityB = seed.cityB || `${stateName} Town`

  return {
    name: stateName,
    counties: [
      { name: `${stateName} North County`, center: [center[0] + 0.18, center[1] - 0.12], cities: [cityA, `${cityA} North`] },
      { name: `${stateName} Central County`, center: [center[0], center[1]], cities: [cityB, `${cityB} Central`] },
      { name: `${stateName} South County`, center: [center[0] - 0.16, center[1] + 0.14], cities: [`${cityA} South`, `${cityB} West`] },
    ],
  }
}

function buildRegionsFromCountrySeeds(continent, countrySeeds) {
  return countrySeeds.map((countrySeed) => {
    const states = (countrySeed.states || []).map((stateSeed) => normalizeStateSeedToState(stateSeed))
    return {
      continent,
      country: countrySeed.country,
      states,
    }
  })
}

function buildRowsForSeededRegionPhase(phase) {
  const generatedRegions = buildRegionsFromCountrySeeds(phase.continent || 'Europe', phase.countrySeeds || [])
  return buildRowsForRegionPhase({ id: phase.id, regions: generatedRegions })
}

function buildRowsForSeededUsStatePhase(phase) {
  const states = (phase.stateSeeds || []).map((stateSeed) => normalizeStateSeedToState(stateSeed))
  const generatedRegions = [
    {
      continent: phase.continent || 'North America',
      country: phase.country || 'United States',
      states,
    },
  ]
  return buildRowsForRegionPhase({ id: phase.id, regions: generatedRegions })
}

function buildRowsForPhase(phase, sourceRows) {
  if (phase.kind === 'variants') {
    return buildRowsForVariantPhase(phase, sourceRows)
  }
  if (phase.kind === 'seeded-regions') {
    return buildRowsForSeededRegionPhase(phase)
  }
  if (phase.kind === 'seeded-us-states') {
    return buildRowsForSeededUsStatePhase(phase)
  }
  return buildRowsForRegionPhase(phase)
}

function getArg(name) {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function main() {
  const existingRows = readLookup()
  const delta = loadDelta(existingRows)
  const existingKeys = new Set(existingRows.map(createKey))

  const targetPhaseId = getArg('phase')
  const applyAll = hasFlag('all')

  const alreadyApplied = new Set(delta.appliedPhases.map((item) => item.id))
  const candidates = PHASES.filter((phase) => !alreadyApplied.has(phase.id))

  const selected = targetPhaseId
    ? PHASES.filter((phase) => phase.id === targetPhaseId && !alreadyApplied.has(phase.id))
    : applyAll
      ? candidates
      : candidates.slice(0, 1)

  if (!selected.length) {
    delta.lastRowCount = existingRows.length
    delta.lastUpdatedAt = new Date().toISOString()
    saveDelta(delta)
    console.log('No new phases to apply. Dataset unchanged.')
    console.log(`Current row count: ${existingRows.length}`)
    return
  }

  const allRows = [...existingRows]

  for (const phase of selected) {
    const generated = buildRowsForPhase(phase, allRows)
    let added = 0

    for (const row of generated) {
      const key = createKey(row)
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      allRows.push(row)
      added += 1
    }

    delta.appliedPhases.push({
      id: phase.id,
      description: phase.description,
      generatedRows: generated.length,
      addedRows: added,
      appliedAt: new Date().toISOString(),
    })

    console.log(`Applied phase ${phase.id}: generated=${generated.length}, added=${added}`)
  }

  const sortKey = (row) => `${row.snapshot}|${row.continent}|${row.country}|${row.state}|${row.county}|${row.city}`
  allRows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  writeLookup(allRows)

  delta.lastRowCount = allRows.length
  delta.lastUpdatedAt = new Date().toISOString()
  saveDelta(delta)

  console.log(`Updated dataset row count: ${allRows.length}`)
  console.log(`Delta control file: ${DELTA_PATH}`)
}

main()
