export interface Zone {
  name: string;
  city: string;
  status: 'active' | 'soon' | 'planning';
}

export const zones: Zone[] = [
  { name: 'Bonapriso', city: 'Douala', status: 'active' },
  { name: 'Akwa', city: 'Douala', status: 'active' },
  { name: 'Bonanjo', city: 'Douala', status: 'active' },
  { name: 'Bali', city: 'Douala', status: 'active' },
  { name: 'Makepe', city: 'Douala', status: 'active' },
  { name: 'Bonamoussadi', city: 'Douala', status: 'active' },
  { name: 'Deido', city: 'Douala', status: 'active' },
  { name: 'New Bell', city: 'Douala', status: 'active' },
  { name: 'Bonaberi', city: 'Douala', status: 'soon' },
  { name: 'PK8-PK12', city: 'Douala', status: 'soon' },
  { name: 'Logpom', city: 'Douala', status: 'planning' },
];

export const activeZones = zones.filter((z) => z.status === 'active');
export const upcomingZones = zones.filter((z) => z.status === 'soon');
