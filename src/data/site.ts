// Configuración general del sitio.
// Cambia `whatsappNumber` por tu número real: código de país + número, solo dígitos
// (ej. México: 5215512345678, Colombia: 573001234567, España: 34612345678).
export const site = {
  name: 'Velocita',
  tagline: 'Motor Collective',
  title: 'Velocita — Motor Collective',
  description: 'Curated automotive excellence. Discover your next icon.',
  whatsappNumber: '5210000000000',
  contactMessage: 'Hola Velocita, me gustaría recibir información sobre sus vehículos.',
};

export function whatsappLink(message: string): string {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
