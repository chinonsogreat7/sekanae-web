export type CurrencyCode = "USD" | "GBP" | "EUR" | "NGN" | "AED";

export type ProductCategory = string;

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  collection: string;
  price: number;
  colors: string[];
  material: string;
  occasion: string[];
  images: string[];
  description: string;
  details: {
    materials: string;
    dimensions: string;
    care: string;
    shipping: string;
  };
  rating: number;
  reviews: number;
  stock: number;
  tags?: string[];
  isNew?: boolean;
  isBridalPreview?: boolean;
  status?: "draft" | "published";
};

export type Collection = {
  id: string;
  title: string;
  description: string;
  image: string;
  cta: string;
};

export const baseCurrency: CurrencyCode = "EUR";

export const currencies: Record<CurrencyCode, { symbol: string; rate: number; label: string }> = {
  USD: { symbol: "$", rate: 1.09, label: "USD" },
  GBP: { symbol: "£", rate: 0.86, label: "GBP" },
  EUR: { symbol: "€", rate: 1, label: "EUR" },
  NGN: { symbol: "₦", rate: 1700, label: "NGN" },
  AED: { symbol: "د.إ", rate: 4, label: "AED" },
};

export const products: Product[] = [
  {
    id: "p-001",
    slug: "monde-structured-top-handle",
    name: "Monde Structured Top Handle",
    category: "Handbags",
    collection: "Everyday Elegance",
    price: 640,
    colors: ["Espresso", "Ivory", "Black"],
    material: "Italian calf leather",
    occasion: ["Work", "Travel", "Day"],
    images: [
      "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "A sculptural everyday handbag with polished hardware, designed to move from day meetings to evening departures.",
    details: {
      materials: "Full-grain Italian calf leather, microsuede lining, brushed gold hardware.",
      dimensions: "28cm W x 20cm H x 11cm D. Handle drop: 10cm. Detachable strap: 52cm.",
      care: "Store in its dust bag and keep away from direct heat, rain, and prolonged sunlight.",
      shipping: "Ships internationally with tracked delivery and signature confirmation.",
    },
    rating: 4.9,
    reviews: 42,
    stock: 18,
    isNew: true,
  },
  {
    id: "p-002",
    slug: "aure-line-gold-hoops",
    name: "Aure Line Gold Hoops",
    category: "Jewelry",
    collection: "The Gold Collection",
    price: 220,
    colors: ["Gold"],
    material: "18k gold vermeil",
    occasion: ["Evening", "Work", "Wedding Guest"],
    images: [
      "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "Light-catching hoops with a softened architectural curve, made for quiet luxury from breakfast meetings to candlelit dinners.",
    details: {
      materials: "Recycled sterling silver base with 18k gold vermeil finish.",
      dimensions: "Outer diameter: 27mm. Weight: 5g each.",
      care: "Avoid perfume, lotions, and water. Polish gently with a soft jewelry cloth.",
      shipping: "Complimentary gift pouch included. International express options available.",
    },
    rating: 4.8,
    reviews: 67,
    stock: 34,
    isNew: true,
  },
  {
    id: "p-003",
    slug: "lagos-silk-carre",
    name: "Lagos Silk Carré",
    category: "Scarves",
    collection: "The Travel Edit",
    price: 180,
    colors: ["Blush", "Pearl", "Gold"],
    material: "Mulberry silk twill",
    occasion: ["Travel", "Day", "Gift"],
    images: [
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1604176354204-9268737828e4?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "A luminous silk carré inspired by coastal light, gallery afternoons, and the ease of women in motion.",
    details: {
      materials: "100% mulberry silk twill with hand-rolled edges.",
      dimensions: "90cm x 90cm.",
      care: "Dry clean only. Fold loosely and store away from moisture.",
      shipping: "Arrives in a rigid SEKANAE gift box with tissue wrap.",
    },
    rating: 4.7,
    reviews: 29,
    stock: 26,
  },
  {
    id: "p-004",
    slug: "noir-city-sunglasses",
    name: "Noir City Sunglasses",
    category: "Sunglasses",
    collection: "Evening Icons",
    price: 310,
    colors: ["Black", "Tortoise"],
    material: "Acetate",
    occasion: ["Travel", "Day", "Resort"],
    images: [
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "A clean, oversized frame with cosmopolitan polish, built for bright terminals, open-air lunches, and city weekends.",
    details: {
      materials: "Italian acetate with CR39 lenses and UV400 protection.",
      dimensions: "Lens: 54mm. Bridge: 18mm. Temple: 145mm.",
      care: "Use the included lens cloth and hard case. Do not place lenses face down.",
      shipping: "International delivery includes protective hard case packaging.",
    },
    rating: 4.6,
    reviews: 21,
    stock: 40,
  },
  {
    id: "p-005",
    slug: "passport-wallet-in-espresso",
    name: "Passport Wallet in Espresso",
    category: "Travel Accessories",
    collection: "The Travel Edit",
    price: 265,
    colors: ["Espresso", "Oxblood", "Ivory"],
    material: "Pebbled leather",
    occasion: ["Travel", "Gift", "Work"],
    images: [
      "https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "A refined travel companion for passports, boarding passes, cards, and small documents.",
    details: {
      materials: "Pebbled leather, moiré lining, four card slots, document sleeve.",
      dimensions: "11cm W x 15cm H.",
      care: "Wipe gently with a dry cloth. Condition annually with a leather specialist.",
      shipping: "Ships globally. Add complimentary monogramming during future releases.",
    },
    rating: 4.9,
    reviews: 38,
    stock: 22,
  },
  {
    id: "p-006",
    slug: "pearl-evening-clutch",
    name: "Pearl Evening Clutch",
    category: "Handbags",
    collection: "Evening Icons",
    price: 520,
    colors: ["Pearl", "Champagne"],
    material: "Satin and leather",
    occasion: ["Evening", "Wedding Guest", "Bridal"],
    images: [
      "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "An elegant framed clutch made for ceremonies, rooftop dinners, and rooms lit by chandeliers.",
    details: {
      materials: "Silk satin exterior, lambskin trim, brushed gold frame closure.",
      dimensions: "21cm W x 12cm H x 5cm D.",
      care: "Spot clean with a specialist only. Store filled to preserve structure.",
      shipping: "Gift packaging available. Bridal preview item with limited quantities.",
    },
    rating: 4.9,
    reviews: 16,
    stock: 12,
    isBridalPreview: true,
  },
  {
    id: "p-007",
    slug: "signature-card-holder",
    name: "Signature Card Holder",
    category: "Leather Goods",
    collection: "Everyday Elegance",
    price: 145,
    colors: ["Black", "Espresso", "Blush"],
    material: "Smooth leather",
    occasion: ["Work", "Gift", "Day"],
    images: [
      "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "A slim leather essential with enough polish to make every daily gesture feel considered.",
    details: {
      materials: "Smooth calf leather with tonal edge paint and gold foil SEKANAE mark.",
      dimensions: "10cm W x 7cm H. Four slots plus central compartment.",
      care: "Avoid overfilling. Clean with a dry, soft cloth.",
      shipping: "Ready to gift in a SEKANAE envelope box.",
    },
    rating: 4.8,
    reviews: 54,
    stock: 58,
  },
  {
    id: "p-008",
    slug: "ceremony-pearl-drop-earrings",
    name: "Ceremony Pearl Drop Earrings",
    category: "Jewelry",
    collection: "Bridal Atelier Preview",
    price: 285,
    colors: ["Pearl", "Gold"],
    material: "Freshwater pearl and gold vermeil",
    occasion: ["Bridal", "Wedding Guest", "Evening"],
    images: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=85"
    ],
    description:
      "Softly luminous pearl drops for vows, rehearsal dinners, and heirloom photographs still to come.",
    details: {
      materials: "Freshwater pearls, sterling silver posts, 18k gold vermeil setting.",
      dimensions: "Drop length: 31mm. Natural pearls vary slightly.",
      care: "Put pearls on last and store separately in their pouch.",
      shipping: "Part of the Bridal Atelier preview. Ships with keepsake packaging.",
    },
    rating: 5,
    reviews: 11,
    stock: 10,
    isBridalPreview: true,
  },
];

export const collections: Collection[] = [
  {
    id: "travel-edit",
    title: "The Travel Edit",
    description: "Quietly polished companions for departures, arrivals, and days lived between cities.",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
    cta: "Pack beautifully",
  },
  {
    id: "evening-icons",
    title: "Evening Icons",
    description: "Sculptural pieces for dinners, ceremonies, gallery openings, and late departures.",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85",
    cta: "Enter the evening",
  },
  {
    id: "everyday-elegance",
    title: "Everyday Elegance",
    description: "Accessories with presence, proportion, and ease for the modern working wardrobe.",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85",
    cta: "Refine the day",
  },
  {
    id: "gold-collection",
    title: "The Gold Collection",
    description: "Warm metallic accents designed to illuminate the smallest gestures.",
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=85",
    cta: "Discover gold",
  },
  {
    id: "new-arrivals",
    title: "New Arrivals",
    description: "Freshly arrived pieces for women whose calendar moves beautifully.",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85",
    cta: "Shop new",
  },
];

export const categories: ProductCategory[] = [
  "Jewelry",
  "Handbags",
  "Scarves",
  "Sunglasses",
  "Leather Goods",
  "Travel Accessories",
  "Gift Shop",
];

export const occasions = ["Work", "Travel", "Day", "Evening", "Gift", "Wedding Guest", "Bridal", "Resort"];
export const colors = ["Black", "Espresso", "Ivory", "Gold", "Pearl", "Champagne", "Blush", "Tortoise", "Oxblood"];
export const materials = ["Italian calf leather", "18k gold vermeil", "Mulberry silk twill", "Acetate", "Pebbled leather", "Satin and leather", "Smooth leather", "Freshwater pearl and gold vermeil"];
