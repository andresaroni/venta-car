// Tipos y helpers del catálogo público. Los datos vienen de la base de datos
// (ver src/lib/vehicles.ts → getPublicCars).

export type CarStatus = 'available' | 'reserved' | 'sold';

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  color: string;
  vin: string;
  status: CarStatus;
  description: string;
  images: string[];
}

export const statusLabel: Record<CarStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
};

export const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);

export const carWhatsappMessage = (car: Car) =>
  `Hola, me interesa comprar el ${car.year} ${car.make} ${car.model}${car.color ? ` (${car.color})` : ''}${
    car.vin ? `, VIN ${car.vin}` : ''
  } publicado en ${formatPrice(car.price)}. ¿Sigue disponible?`;
