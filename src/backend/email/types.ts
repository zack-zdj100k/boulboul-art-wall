export type EmailOrderItem = {
  productName: string;
  productImageUrl: string | null;
  widthCm: number;
  heightCm: number;
  pricingType: "PRESET" | "SUR_MESURE" | null;
  pricingLabel: string | null;
  officialPrice: number;
  promotionType: "PERCENT" | "FIXED" | null;
  promotionValue: number | null;
  promotionDiscount: number;
  priceAfterPromotion: number;
  optionsPrice: number;
  frameName: string | null;
  color: string | null;
  extras: { id: string; name: string; price: number; color?: string | null; note?: string | null }[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type EmailOrder = {
  id: string;
  orderNumber: string;
  /** Private link token so the customer can open the order page from the email. */
  publicToken?: string;
  customerName: string;
  email: string;
  phone: string;
  wilayaCode: string;
  wilayaName: string;
  commune: string;
  address: string;
  notes: string | null;
  subtotal: number;
  negotiatedDiscount: number;
  deliveryFee: number | null;
  deliveryMethod: "HOME" | "STOP_DESK";
  /** Order number this one ships with (grouped delivery), if any. */
  shipsWith: string | null;
  total: number;
  status: string;
  locale: string;
  createdAt: Date;
  items: EmailOrderItem[];
};
