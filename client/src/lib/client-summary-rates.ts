export const UBL_YEARLY_RATES = [
  { field: "tea", name: "Tea (All)", rate: 7 },
  { field: "biscuit", name: "Biscuit", rate: 0.5 },
  { field: "breakfast", name: "Breakfast", rate: 20 },
  { field: "contractorBreakfast", name: "Cont. Brkft", rate: 25 },
  { field: "lunch", name: "Lunch", rate: 50 },
  { field: "mutton", name: "Mutton", rate: 149 },
  { field: "tiffin", name: "Tiffin", rate: 25 },
  { field: "boiledEgg", name: "Boiled Egg", rate: 7 },
  { field: "dinner", name: "Dinner", rate: 48 },
] as const;

export const CIPLA_MEAL_RATES = { breakfast: 23, lunch: 58, dinner: 58 } as const;
export const UNICHEM_MEAL_RATES = { breakfast: 15, evening: 15, night: 15, sunday: 10, lunch: 58, dinner: 58 } as const;
export const HUL_MEAL_RATES = { breakfast: 35, lunch: 50, evening: 30, night: 17, guestBreakfast: 40, guestLunch: 70, guestEvening: 40, guestNight: 27 } as const;
export const PEC_DEFAULT_RATES = {
  redLabel: 620, tataTea: 310, coffee: 5.5, sugar: 48, ginger: 180,
  biscuit: 5, teaCup: 0.8, greenElaychi: 3.6, greenTea: 120, blackSalt: 115, milk: 28,
};
