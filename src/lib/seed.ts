// Vehículos de ejemplo que se cargan la primera vez (si SEED_DEMO no es "false").
// Se pueden eliminar desde el panel.

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=85`;

export const demoVehicles = [
  {
    make: 'Porsche', model: '911', version: 'Carrera S', year: 2022, mileage: 8420,
    color: 'Agate Grey', vin: 'WP0AB2A99NS241782', owners: 1, purchasePlace: 'Subasta Manheim',
    description: 'Twin-turbo flat-six, PDK transmission and Sport Chrono package. One owner, full dealer service history.',
    costs: { purchase: 104500, taxes: 3200, mechanical: 1400, parts: 900, repair: 700 }, salePrice: 128900,
    images: [img('1503376780353-7e6692767b70'), img('1614162692292-7ac56d7f7f1e')],
  },
  {
    make: 'BMW', model: 'M4', version: 'Competition', year: 2023, mileage: 5180,
    color: 'Black Sapphire', vin: 'WBS33BA09PCM59321', owners: 1, purchasePlace: 'Concesionario',
    description: '503 hp inline-six, carbon bucket seats and M Drive Professional. Ceramic coated and garage kept.',
    costs: { purchase: 73500, taxes: 2100, mechanical: 800, parts: 500, repair: 400 }, salePrice: 89900,
    images: [img('1555215695-3004980ad54e'), img('1580273916550-e323be2ae537'), img('1617531653332-bd46c24f2068')],
  },
  {
    make: 'Mercedes-Benz', model: 'AMG GT', version: '53', year: 2021, mileage: 14260,
    color: 'Obsidian Black', vin: 'W1K7X8KB2MA041927', owners: 2, purchasePlace: 'Particular',
    description: 'EQ Boost inline-six with 4MATIC+, Burmester audio and AMG Night Package. Clean history report.',
    costs: { purchase: 82800, taxes: 2600, mechanical: 1200, parts: 700, repair: 600 }, salePrice: 101500,
    images: [img('1618843479313-40f8afb4b4d8'), img('1617814076367-b759c7d7e738'), img('1605559424843-9e4c228bf1c2')],
  },
  {
    make: 'Lamborghini', model: 'Urus', version: '', year: 2020, mileage: 19870,
    color: 'Nero Noctis', vin: 'ZPBUA1ZL0LLA08342', owners: 2, purchasePlace: 'Subasta Copart',
    description: 'Twin-turbo V8 with 641 hp, 23" wheels, carbon ceramic brakes and Bang & Olufsen sound system.',
    costs: { purchase: 176000, taxes: 5400, mechanical: 2600, parts: 1800, repair: 1200 }, salePrice: 209900,
    images: [img('1544829099-b9a0c07fad1a'), img('1511919884226-fd3cad34687c'), img('1621135802920-133df287f89c')],
  },
  {
    make: 'Toyota', model: 'GR Supra', version: '3.0', year: 2023, mileage: 3920,
    color: 'Renaissance Red', vin: 'WZ1DB0C04PW044182', owners: 1, purchasePlace: 'Concesionario',
    description: 'Turbocharged 3.0L inline-six, adaptive suspension and JBL premium audio. Practically new.',
    costs: { purchase: 46200, taxes: 1500, mechanical: 400, parts: 300, repair: 200 }, salePrice: 56900,
    images: [img('1614200187524-dc4b892acf16'), img('1583121274602-3e2820c69888')],
  },
];
