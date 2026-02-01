export interface Zone {
  name: string;
  status: 'active' | 'soon' | 'planning';
}

export const zones: Zone[] = [
  { name: "Bonapriso", status: "active" },
  { name: "Akwa", status: "active" },
  { name: "Bonanjo", status: "active" },
  { name: "Bali", status: "active" },
  { name: "Makepe", status: "active" },
  { name: "Bonamoussadi", status: "active" },
  { name: "Deido", status: "active" },
  { name: "New Bell", status: "active" },
  { name: "Bonaberi", status: "soon" },
  { name: "PK8-PK12", status: "soon" },
  { name: "Logpom", status: "planning" },
];

export const activeZones = zones.filter(zone => zone.status === 'active');
export const upcomingZones = zones.filter(zone => zone.status === 'soon');
