export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: "Mains" | "Sandwiches" | "Desserts";
  priceCents: number;
  tags: string[];
};

export const menu: MenuItem[] = [
  {
    id: "harvest-bowl",
    name: "Harvest Bowl",
    description: "Brown rice, roasted vegetables, chickpeas, avocado, herbs, and lemon tahini.",
    category: "Mains",
    priceCents: 1850,
    tags: ["Vegetarian", "Fresh", "Gluten-free"],
  },
  {
    id: "tomato-pasta",
    name: "Slow Tomato Pasta",
    description: "Rigatoni, slow-cooked tomato sauce, garlic, basil, parmesan, and toasted breadcrumbs.",
    category: "Mains",
    priceCents: 1950,
    tags: ["Comforting", "Vegetarian"],
  },
  {
    id: "grilled-chicken",
    name: "Herb Grilled Chicken",
    description: "Grilled chicken, crushed potatoes, seasonal greens, and roasted-garlic sauce.",
    category: "Mains",
    priceCents: 2350,
    tags: ["High protein", "Gluten-free"],
  },
  {
    id: "crisp-sandwich",
    name: "Crisp Chicken Sandwich",
    description: "Crispy chicken, cabbage slaw, pickles, and house sauce on a toasted bun with potatoes.",
    category: "Sandwiches",
    priceCents: 2050,
    tags: ["Crispy", "Popular"],
  },
  {
    id: "roasted-mushroom-melt",
    name: "Roasted Mushroom Melt",
    description: "Roasted mushrooms, caramelized onion, cheese, greens, and mustard on country bread.",
    category: "Sandwiches",
    priceCents: 1750,
    tags: ["Vegetarian", "Savory"],
  },
  {
    id: "chocolate-tart",
    name: "Dark Chocolate Tart",
    description: "Silky dark chocolate tart with sea salt and vanilla cream.",
    category: "Desserts",
    priceCents: 950,
    tags: ["Sweet", "Shareable"],
  },
];
