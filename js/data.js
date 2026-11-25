// Built-in knowledge: common medicines for elders, health conditions,
// food advice, menu dishes and kitchen items. Names are translated in js/lang/*.

// Common medicines usually prescribed to elderly people in India.
// food: before | after | with | empty | any
export const COMMON_MEDICINES = [
  { name: 'Metformin 500 mg', aka: 'Glycomet', purpose: 'diabetes', food: 'after', times: ['08:30', '20:30'] },
  { name: 'Glimepiride 1 mg', aka: 'Amaryl', purpose: 'diabetes', food: 'before', times: ['08:00'] },
  { name: 'Insulin', aka: 'injection', purpose: 'diabetes', food: 'before', times: ['08:00', '20:00'], dose: '10 units' },
  { name: 'Amlodipine 5 mg', aka: 'Amlong', purpose: 'bp', food: 'any', times: ['09:00'] },
  { name: 'Telmisartan 40 mg', aka: 'Telma', purpose: 'bp', food: 'any', times: ['09:00'] },
  { name: 'Losartan 50 mg', aka: 'Losar', purpose: 'bp', food: 'any', times: ['09:00'] },
  { name: 'Metoprolol 25 mg', aka: 'Met XL', purpose: 'bp', food: 'with', times: ['09:00'] },
  { name: 'Atenolol 50 mg', aka: 'Aten', purpose: 'bp', food: 'any', times: ['09:00'] },
  { name: 'Atorvastatin 10 mg', aka: 'Atorva', purpose: 'cholesterol', food: 'any', times: ['21:30'] },
  { name: 'Rosuvastatin 10 mg', aka: 'Rosuvas', purpose: 'cholesterol', food: 'any', times: ['21:30'] },
  { name: 'Aspirin 75 mg', aka: 'Ecosprin', purpose: 'heart', food: 'after', times: ['14:00'] },
  { name: 'Clopidogrel 75 mg', aka: 'Clopilet', purpose: 'heart', food: 'any', times: ['14:00'] },
  { name: 'Levothyroxine 50 mcg', aka: 'Thyronorm / Eltroxin', purpose: 'thyroid', food: 'empty', times: ['06:30'] },
  { name: 'Pantoprazole 40 mg', aka: 'Pan 40', purpose: 'acidity', food: 'before', times: ['07:30'] },
  { name: 'Omeprazole 20 mg', aka: 'Omez', purpose: 'acidity', food: 'before', times: ['07:30'] },
  { name: 'Calcium + Vitamin D3', aka: 'Shelcal', purpose: 'bones', food: 'after', times: ['14:00'] },
  { name: 'Vitamin D3 60K (weekly)', aka: 'Uprise D3', purpose: 'bones', food: 'after', times: ['09:00'] },
  { name: 'Vitamin B12', aka: 'Methylcobalamin', purpose: 'vitamin', food: 'after', times: ['14:00'] },
  { name: 'Paracetamol 650 mg', aka: 'Dolo 650', purpose: 'pain', food: 'after', times: ['09:00'] },
  { name: 'Furosemide 40 mg', aka: 'Lasix', purpose: 'water', food: 'any', times: ['08:00'] },
  { name: 'Tamsulosin 0.4 mg', aka: 'Urimax', purpose: 'prostate', food: 'after', times: ['21:00'] },
  { name: 'Donepezil 5 mg', aka: 'Donecept', purpose: 'memory', food: 'any', times: ['21:00'] },
];

export const PURPOSES = ['diabetes', 'bp', 'cholesterol', 'heart', 'thyroid', 'acidity', 'bones', 'vitamin', 'pain', 'water', 'memory', 'prostate', 'other'];
export const FOOD_TIMING = ['before', 'after', 'with', 'empty', 'any'];
export const RELATIONS = ['son', 'daughter', 'wife', 'husband', 'grandson', 'granddaughter', 'brother', 'sister', 'neighbour', 'friend', 'other'];

// Health conditions with what to eat more / less of (keys into names).
export const CONDITIONS = {
  diabetes: { more: ['vegetables', 'dal', 'oats', 'ragi', 'moong', 'nuts', 'greens'], less: ['sugar', 'sweets', 'juice', 'white_rice', 'maida', 'potato', 'fried'] },
  bp: { more: ['vegetables', 'fruits', 'banana', 'curd', 'oats', 'greens'], less: ['salt', 'pickle', 'papad', 'packaged', 'fried'] },
  cholesterol: { more: ['oats', 'nuts', 'fish', 'vegetables', 'fruits'], less: ['ghee', 'fried', 'red_meat', 'packaged', 'maida'] },
  heart: { more: ['fish', 'nuts', 'oats', 'vegetables', 'fruits'], less: ['salt', 'ghee', 'fried', 'red_meat', 'packaged'] },
  kidney: { more: ['vegetables', 'rice'], less: ['salt', 'banana', 'potato', 'tomato', 'pickle', 'packaged', 'red_meat'] },
  joints: { more: ['fish', 'milk', 'curd', 'nuts', 'greens'], less: ['sugar', 'fried', 'red_meat', 'maida'] },
  thyroid: { more: ['eggs', 'fish', 'milk', 'nuts'], less: ['packaged', 'sugar'] },
  bones: { more: ['milk', 'curd', 'ragi', 'paneer', 'eggs', 'greens'], less: ['coffee', 'salt', 'packaged'] },
  acidity: { more: ['curd', 'banana', 'oats', 'vegetables'], less: ['spicy', 'fried', 'tea', 'coffee', 'pickle'] },
};

// Menu dishes. needs = kitchen items; bad = conditions to avoid it for.
export const DISHES = [
  { id: 'idli', slot: 'breakfast', needs: ['rice', 'dal'], nutrients: ['protein', 'fiber'], bad: [] },
  { id: 'oats_porridge', slot: 'breakfast', needs: ['oats', 'milk'], nutrients: ['fiber', 'calcium'], good: ['diabetes', 'cholesterol', 'heart'], bad: [] },
  { id: 'ragi_malt', slot: 'breakfast', needs: ['ragi', 'milk'], nutrients: ['calcium', 'iron', 'fiber'], good: ['bones', 'diabetes'], bad: [] },
  { id: 'poha_dish', slot: 'breakfast', needs: ['poha', 'vegetables', 'onion'], nutrients: ['iron', 'fiber'], bad: [] },
  { id: 'upma', slot: 'breakfast', needs: ['rava', 'vegetables'], nutrients: ['fiber'], bad: [] },
  { id: 'boiled_eggs', slot: 'breakfast', needs: ['eggs', 'bread'], nutrients: ['protein'], good: ['thyroid', 'bones'], bad: [] },
  { id: 'moong_chilla', slot: 'breakfast', needs: ['moong', 'onion'], nutrients: ['protein', 'fiber', 'iron'], good: ['diabetes'], bad: [] },
  { id: 'puttu', slot: 'breakfast', needs: ['rice', 'dal', 'coconut'], nutrients: ['protein', 'fiber'], bad: ['cholesterol'] },
  { id: 'chapati_dal', slot: 'lunch', needs: ['atta', 'dal', 'vegetables'], nutrients: ['protein', 'fiber', 'vitamins'], good: ['diabetes', 'bp', 'heart'], bad: [] },
  { id: 'dal_rice', slot: 'lunch', needs: ['rice', 'dal', 'vegetables'], nutrients: ['protein', 'fiber', 'vitamins'], bad: ['diabetes'] },
  { id: 'fish_curry', slot: 'lunch', needs: ['fish', 'rice', 'coconut'], nutrients: ['protein', 'calcium'], good: ['heart', 'joints', 'thyroid'], bad: [] },
  { id: 'curd_rice', slot: 'lunch', needs: ['rice', 'curd'], nutrients: ['calcium', 'protein'], good: ['acidity'], bad: ['diabetes'] },
  { id: 'chicken_curry', slot: 'lunch', needs: ['chicken', 'atta', 'onion', 'tomato'], nutrients: ['protein', 'iron'], bad: ['kidney'] },
  { id: 'paneer_sabzi', slot: 'lunch', needs: ['paneer', 'atta', 'vegetables'], nutrients: ['protein', 'calcium'], good: ['bones'], bad: ['cholesterol', 'heart'] },
  { id: 'khichdi', slot: 'dinner', needs: ['rice', 'moong'], nutrients: ['protein', 'fiber'], good: ['acidity', 'kidney'], bad: [] },
  { id: 'chapati_veg', slot: 'dinner', needs: ['atta', 'vegetables'], nutrients: ['fiber', 'vitamins'], good: ['diabetes', 'cholesterol'], bad: [] },
  { id: 'veg_soup', slot: 'dinner', needs: ['vegetables', 'tomato'], nutrients: ['vitamins', 'fiber'], good: ['bp', 'heart', 'diabetes'], bad: ['kidney'] },
  { id: 'fruit_bowl', slot: 'snack', needs: ['fruits'], nutrients: ['vitamins', 'fiber'], bad: ['kidney'] },
  { id: 'banana_snack', slot: 'snack', needs: ['banana'], nutrients: ['vitamins'], good: ['bp', 'acidity'], bad: ['kidney', 'diabetes'] },
  { id: 'sprouts', slot: 'snack', needs: ['moong', 'onion', 'tomato'], nutrients: ['protein', 'fiber', 'iron'], good: ['diabetes'], bad: [] },
  { id: 'nuts_snack', slot: 'snack', needs: ['nuts'], nutrients: ['protein', 'iron'], good: ['heart', 'cholesterol', 'diabetes'], bad: [] },
  { id: 'buttermilk', slot: 'snack', needs: ['curd'], nutrients: ['calcium'], good: ['acidity', 'bp'], bad: [] },
  { id: 'milk_glass', slot: 'snack', needs: ['milk'], nutrients: ['calcium', 'protein'], good: ['bones'], bad: [] },
];

export const NUTRIENTS = ['protein', 'fiber', 'calcium', 'iron', 'vitamins'];
// Easy food suggestions to fill a missing nutrient.
export const NUTRIENT_FOODS = {
  protein: ['dal', 'eggs', 'moong'], fiber: ['vegetables', 'oats'], calcium: ['milk', 'curd', 'ragi'],
  iron: ['greens', 'ragi'], vitamins: ['fruits', 'vegetables'],
};

export const PANTRY_ITEMS = ['rice', 'atta', 'ragi', 'oats', 'dal', 'moong', 'milk', 'curd', 'eggs', 'vegetables', 'greens',
  'fruits', 'banana', 'onion', 'tomato', 'oil', 'salt', 'sugar', 'tea', 'nuts', 'fish', 'chicken', 'paneer', 'poha', 'rava', 'bread', 'coconut'];

// Every food word Sitara can recognise in a question like "can I eat banana?"
export const ALL_FOOD_KEYS = [...new Set([...PANTRY_ITEMS, 'sweets', 'pickle', 'fried', 'maida', 'ghee', 'red_meat', 'packaged',
  'juice', 'potato', 'spicy', 'papad', 'coffee', ...DISHES.map((d) => d.id)])];

export const MEAL_TIMES = { breakfast: '09:00', lunch: '13:30', snack: '17:00', dinner: '20:00' };

const id = () => Math.random().toString(36).slice(2, 9);
const addDays = (n, h, m) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d.toISOString(); };

export function demoData() {
  return {
    profile: { name: 'Kamala', conditions: ['diabetes', 'bp'] },
    meds: [
      { id: id(), name: 'Metformin 500 mg', purpose: 'diabetes', dose: '1 tablet', times: ['08:30', '20:30'], food: 'after', stock: 40 },
      { id: id(), name: 'Amlodipine 5 mg', purpose: 'bp', dose: '1 tablet', times: ['09:00'], food: 'any', stock: 5 },
      { id: id(), name: 'Calcium + Vitamin D3', purpose: 'bones', dose: '1 tablet', times: ['14:00'], food: 'after', stock: 20 },
      { id: id(), name: 'Atorvastatin 10 mg', purpose: 'cholesterol', dose: '1 tablet', times: ['21:30'], food: 'any', stock: 25 },
    ],
    contacts: [
      { id: id(), name: 'Ravi', relation: 'son', phone: '+91 90000 00001', aliases: 'रवि, രവി', emergency: true },
      { id: id(), name: 'Priya', relation: 'daughter', phone: '+91 90000 00002', aliases: 'प्रिया, പ്രിയ', emergency: false },
      { id: id(), name: 'Arjun', relation: 'grandson', phone: '+91 90000 00003', aliases: 'अर्जुन, അർജുൻ', emergency: false },
      { id: id(), name: 'Lakshmi', relation: 'neighbour', phone: '+91 90000 00004', aliases: 'लक्ष्मी, ലക്ഷ്മി', emergency: false },
    ],
    doctors: [
      { id: id(), name: 'Dr. Suresh Nair', speciality: 'General physician', phone: '+91 90000 00010', hospital: 'City Clinic' },
      { id: id(), name: 'Dr. Meera Joshi', speciality: 'Heart specialist', phone: '+91 90000 00011', hospital: 'Care Hospital' },
    ],
    appointments: [
      { id: id(), patient: 'Kamala', doctor: 'Dr. Suresh Nair', at: addDays(3, 10, 30), phone: '+91 90000 00010' },
    ],
    events: [
      { id: id(), title: "Arjun's birthday", at: addDays(5, 18, 0), remindDays: 1 },
      { id: id(), title: 'Temple festival', at: addDays(12, 7, 0), remindDays: 2 },
    ],
    pantry: Object.fromEntries(PANTRY_ITEMS.map((k) => [k, ['milk', 'fruits', 'dal'].includes(k) ? 'low' : ['rice', 'vegetables'].includes(k) ? 'half' : 'full'])),
    playlist: [
      { id: id(), title: 'Old Hindi songs', url: 'https://www.youtube.com/results?search_query=old+hindi+songs', lang: 'hi' },
      { id: id(), title: 'Malayalam devotional songs', url: 'https://www.youtube.com/results?search_query=malayalam+devotional+songs', lang: 'ml' },
      { id: id(), title: 'Marathi abhang', url: 'https://www.youtube.com/results?search_query=marathi+abhang', lang: 'mr' },
      { id: id(), title: 'Old English classics', url: 'https://www.youtube.com/results?search_query=old+english+classic+songs', lang: 'en' },
    ],
  };
}
