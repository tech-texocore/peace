// Seeded system master lists for a new store. Each list defines its own
// configurable `fields` (an attribute schema); items fill those fields via
// metadata. Admins can edit fields, items and add their own lists.
export interface MasterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'color' | 'select';
  unit?: string;
  options?: string[];
}
export interface DefaultMasterList {
  key: string;
  label: string;
  fields?: MasterField[];
  usage?: ('variant' | 'spec')[];
  items: { value: string; label: string; metadata?: Record<string, unknown> }[];
}

const plain = (value: string) => ({ value, label: value });

const SIZES: [string, number, number, number, number][] = [
  ['XS', 34, 34, 30, 26],
  ['S', 36, 36, 32, 27],
  ['M', 38, 38, 34, 27.5],
  ['L', 40, 40, 36, 28],
  ['XL', 42, 42, 38, 29],
  ['XXL', 44, 44, 40, 29.5],
];

export const DEFAULT_MASTER_LISTS: DefaultMasterList[] = [
  {
    key: 'uom',
    label: 'Unit of Measure',
    fields: [{ key: 'symbol', label: 'Symbol', type: 'text' }],
    items: [
      { value: 'PIECE', label: 'Piece', metadata: { symbol: 'pc' } },
      { value: 'METRE', label: 'Metre', metadata: { symbol: 'm' } },
      { value: 'SET', label: 'Set', metadata: { symbol: 'set' } },
      { value: 'PAIR', label: 'Pair', metadata: { symbol: 'pair' } },
      { value: 'DOZEN', label: 'Dozen', metadata: { symbol: 'dz' } },
      { value: 'YARD', label: 'Yard', metadata: { symbol: 'yd' } },
      { value: 'KG', label: 'Kilogram', metadata: { symbol: 'kg' } },
    ],
  },
  {
    key: 'business_type',
    label: 'Business Type',
    items: ['Proprietorship', 'Partnership', 'Private Limited', 'LLP', 'Public Limited', 'HUF', 'Trust / Society', 'Individual'].map(plain),
  },
  {
    key: 'hsn',
    label: 'HSN / GST',
    fields: [{ key: 'gst', label: 'GST %', type: 'number', unit: '%' }],
    items: [
      { value: '5007', label: 'Silk fabric (5007)', metadata: { gst: 5 } },
      { value: '5208', label: 'Cotton woven fabric (5208)', metadata: { gst: 5 } },
      { value: '6109', label: 'T-shirts, singlets (6109)', metadata: { gst: 5 } },
      { value: '6204', label: "Women's suits, dresses (6204)", metadata: { gst: 12 } },
      { value: '6211', label: 'Track suits, other garments (6211)', metadata: { gst: 12 } },
      { value: '5810', label: 'Embroidery (5810)', metadata: { gst: 12 } },
    ],
  },
  {
    key: 'size',
    label: 'Size',
    usage: ['variant', 'spec'],
    fields: [
      { key: 'numeric', label: 'Size number', type: 'number' },
      { key: 'chest', label: 'Chest', type: 'number', unit: 'in' },
      { key: 'waist', label: 'Waist', type: 'number', unit: 'in' },
      { key: 'length', label: 'Length', type: 'number', unit: 'in' },
    ],
    items: [
      ...SIZES.map(([v, numeric, chest, waist, length]) => ({ value: v, label: v, metadata: { numeric, chest, waist, length } })),
      { value: 'Free Size', label: 'Free Size', metadata: {} },
    ],
  },
  {
    key: 'colour',
    label: 'Colour',
    usage: ['variant', 'spec'],
    fields: [{ key: 'hex', label: 'Swatch', type: 'color' }],
    items: [
      { value: 'Red', label: 'Red', metadata: { hex: '#c0392b' } },
      { value: 'Maroon', label: 'Maroon', metadata: { hex: '#7a2e33' } },
      { value: 'Blue', label: 'Blue', metadata: { hex: '#2c3e77' } },
      { value: 'Green', label: 'Green', metadata: { hex: '#3c5341' } },
      { value: 'Black', label: 'Black', metadata: { hex: '#1a1a1a' } },
      { value: 'White', label: 'White', metadata: { hex: '#f5f5f5' } },
      { value: 'Yellow', label: 'Yellow', metadata: { hex: '#d4a017' } },
      { value: 'Pink', label: 'Pink', metadata: { hex: '#d16ba5' } },
      { value: 'Grey', label: 'Grey', metadata: { hex: '#6b7280' } },
      { value: 'Beige', label: 'Beige', metadata: { hex: '#d8c3a5' } },
    ],
  },
  {
    key: 'fabric',
    label: 'Fabric',
    usage: ['variant', 'spec'],
    items: ['Cotton', 'Silk', 'Linen', 'Georgette', 'Chiffon', 'Rayon', 'Wool', 'Denim', 'Velvet'].map(plain),
  },
  {
    key: 'pattern',
    label: 'Pattern',
    usage: ['variant', 'spec'],
    items: ['Solid', 'Printed', 'Embroidered', 'Woven', 'Striped', 'Checked', 'Floral'].map(plain),
  },
  {
    key: 'occasion',
    label: 'Occasion',
    usage: ['spec'],
    items: ['Casual', 'Formal', 'Festive', 'Wedding', 'Party'].map(plain),
  },
  {
    key: 'season',
    label: 'Season',
    usage: ['spec'],
    items: ['Summer', 'Winter', 'Monsoon', 'All Season'].map(plain),
  },
];
