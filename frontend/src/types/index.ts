export type ID = string;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type Category = {
  id: ID;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: ID | null;
  children?: Category[];
  /** Only present when requested with ?withCounts=true (sub-categories rolled up). */
  productCount?: number;
};

export type StoreSummary = {
  id: ID;
  name: string;
  slug: string;
  /** Sellers opt in/out of cash at handover; absent on older payloads means allowed. */
  acceptsCashOnDelivery?: boolean;
};

export type Store = StoreSummary & {
  ownerId: ID;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  location: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
  /** Aggregated from reviews by the API (absent when the store has none yet). */
  rating?: number;
  reviewCount?: number;
  productCount?: number;
  verified?: boolean;
  categoryName?: string;
};

export type ProductCondition = "NEW" | "USED" | "REFURBISHED";

export type Product = {
  id: ID;
  storeId: ID;
  categoryId: ID;
  title: string;
  slug: string;
  description: string | null;
  /** Decimal serialised as a string by Prisma. */
  price: string;
  compareAtPrice?: string | null;
  condition: ProductCondition;
  location: string | null;
  images: string[] | null;
  video?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  viewCount: number;
  featuredAt: string | null;
  featuredUntil: string | null;
  createdAt: string;
  store: StoreSummary;
  category: Category;
  /** Presentation-only until reviews land. */
  rating?: number;
  reviewCount?: number;
};

export type UserRole = "CUSTOMER" | "SUPER_ADMIN" | "ACCOUNTANT" | "CUSTOMER_SERVICE";

export type User = {
  id: ID;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  emailVerifiedAt: string | null;
  googleId?: string | null;
  store?: { id: ID; name: string; slug: string; status: Store["status"] } | null;
  createdAt: string;
};

export type SubscriptionPlan = {
  id: ID;
  name: string;
  durationDays: number;
  adQuota: number;
  price: string;
  features: string[] | Record<string, unknown> | null;
  isActive: boolean;
  heroEligible: boolean;
  heroDurationHours: number | null;
};

export type OrderStatus = "PENDING_PAYMENT" | "CONFIRMED" | "PAID" | "COMPLETED" | "CANCELLED" | "DISPUTED" | "REFUNDED";
export type PaymentMethod = "MOBILE_MONEY" | "CASH_ON_DELIVERY";
export type PaymentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type Payment = {
  id: ID;
  status: PaymentStatus;
  provider?: string | null;
  providerReference?: string | null;
  amount: string;
  externalId?: string;
  createdAt: string;
};

export type Order = {
  id: ID;
  buyerId: ID;
  advertisementId: ID;
  quantity: number;
  totalAmount: string;
  status: OrderStatus;
  sellerConfirmedAt: string | null;
  buyerConfirmedAt: string | null;
  paymentMethod: PaymentMethod;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: "BUYER" | "SELLER" | "STAFF" | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  advertisement?: {
    id?: ID;
    title: string;
    slug: string;
    images: string[] | null;
    price?: string;
    store?: StoreSummary & Partial<Store>;
  };
  payment?: Payment | null;
  escrow?: { id: ID; status: string; amount: string; releasedAt?: string | null } | null;
  refund?: Refund | null;
  disputes?: { id: ID; status: string; reason: string; resolution?: string | null; createdAt: string }[];
  review?: { id: ID; rating: number; comment: string | null; createdAt: string } | null;
  /** Present on seller-side order lists/detail. */
  buyer?: { id: ID; firstName: string; lastName: string; phone: string | null; email?: string };
};

export type CartItem = {
  id: ID;
  slug: string;
  title: string;
  price: string;
  image: string | null;
  storeName: string;
  quantity: number;
};

export type WishlistItem = Omit<CartItem, "quantity">;

export type NotificationType =
  | "SUBSCRIPTION_EXPIRING"
  | "ADVERTISEMENT_EXPIRED"
  | "NEW_ORDER"
  | "PAYMENT_CONFIRMED"
  | "DISPUTE_CREATED"
  | "DELIVERY_CONFIRMED"
  | "RECEIPT_CONFIRMED"
  | "ESCROW_RELEASED"
  | "ORDER_COMPLETED"
  | "DISPUTE_RESOLVED"
  | "ORDER_REFUNDED"
  | "WITHDRAWAL_COMPLETED"
  | "WITHDRAWAL_FAILED"
  | "SUBSCRIPTION_ACTIVATED"
  | "REVIEW_RECEIVED"
  | "SUBSCRIPTION_EXPIRED"
  | "REFUND_SENT"
  | "REFUND_FAILED"
  | "ORDER_CONFIRMED"
  | "ORDER_CANCELLED"
  | "FLASH_APPLICATION_APPROVED"
  | "FLASH_APPLICATION_REJECTED"
  | "FLASH_CAMPAIGN_LIVE"
  | "FLASH_CAMPAIGN_ENDED";

export type AppNotification = {
  id: ID;
  type: NotificationType;
  title: string;
  body: string | null;
  data: {
    campaignId?: string;
    campaignName?: string;
    campaignPrice?: number;
    reviewNote?: string | null;
    orderId?: string;
    productTitle?: string;
    productSlug?: string;
    storeName?: string;
    storeSlug?: string;
    amount?: number;
    outcome?: "RELEASED" | "REFUNDED";
    withdrawalId?: string;
    planName?: string | null;
    rating?: number;
    reviewId?: string;
    refundId?: string;
    phoneNumber?: string;
    subscriptionId?: string;
    expiresAt?: string;
    count?: number;
    days?: number;
    paymentMethod?: PaymentMethod;
    cancelledBy?: "BUYER" | "SELLER" | "STAFF";
  } | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type Review = {
  id: ID;
  rating: number;
  comment: string | null;
  createdAt: string;
  buyerName?: string;
  product?: { title: string; slug: string };
};

export type ServerWishlistItem = {
  id: ID;
  savedAt: string;
  advertisement: Product;
};

export type SubscriptionStatus = "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export type Subscription = {
  id: ID;
  storeId: ID;
  planId: ID;
  status: SubscriptionStatus;
  adsUsed: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  plan: SubscriptionPlan;
  payment?: Payment | null;
};

export type WithdrawalStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type Withdrawal = {
  id: ID;
  amount: string;
  currency: string;
  provider: string | null;
  phoneNumber: string;
  status: WithdrawalStatus;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type SellerDashboard = Store & {
  wallet: { balance: string; currency: string } | null;
  subscription: Subscription | null;
  stats: {
    listings: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", number>;
    ordersToDeliver: number;
    completedOrders: number;
    totalSales: number;
  };
};

// ---------------------------------------------------------------------------
// Admin back-office
// ---------------------------------------------------------------------------

export type AdminStats = {
  users: { total: number; staff: number };
  stores: Partial<Record<Store["status"], number>>;
  listings: Partial<Record<Product["status"], number>>;
  orders: Partial<Record<OrderStatus, number>>;
  escrow: { held: number; count: number };
  disputesOpen: number;
  withdrawalsPending: { amount: number; count: number };
  sales: { amount: number; count: number };
  contactsUnhandled: number;
  subscriptionsActive: number;
};

export type AdminStore = Store & {
  owner: { id: ID; email: string; firstName: string; lastName: string };
  wallet: { balance: string } | null;
  _count: { advertisements: number; reviews: number };
};

export type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";

export type Dispute = {
  id: ID;
  orderId: ID;
  reason: string;
  status: DisputeStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  raisedBy: { id: ID; firstName: string; lastName: string; email?: string; role?: UserRole };
  order: {
    id: ID;
    totalAmount: string;
    status: OrderStatus;
    buyer?: { id: ID; firstName: string; lastName: string; email?: string; phone?: string | null };
    advertisement?: { id?: ID; title: string; slug: string; images?: string[] | null; store?: StoreSummary & { ownerId?: ID; contactPhone?: string | null } };
    escrow?: { status: string; amount: string } | null;
    payment?: { status: PaymentStatus; provider?: string | null; operator?: string | null; phoneNumber?: string | null; providerReference?: string | null } | null;
    refund?: Refund | null;
  };
};

export type RefundStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type Refund = {
  id: ID;
  orderId: ID;
  amount: string;
  currency: string;
  provider: string | null;
  operator: string | null;
  phoneNumber: string;
  providerPayoutId: string | null;
  providerReference: string | null;
  status: RefundStatus;
  failureReason: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  order?: {
    id: ID;
    status: OrderStatus;
    buyer?: { id: ID; firstName: string; lastName: string; email?: string; phone?: string | null };
    advertisement?: { title: string; slug: string; store?: { name: string; slug: string } };
  };
};

export type JobRun = {
  name: string;
  trigger: "schedule" | "manual";
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary?: Record<string, unknown>;
  error?: string;
  skipped?: boolean;
  reason?: string;
};

export type JobInfo = { name: string; description: string; intervalMs: number; last: JobRun | null };

export type AdminPayment = Payment & {
  order?: { id: ID; buyerId: ID; status: OrderStatus; buyer?: { email: string }; advertisement?: { title: string } } | null;
  subscription?: { id: ID; storeId: ID; planId: ID; status: SubscriptionStatus; plan?: { name: string }; store?: { name: string; slug: string } } | null;
};

export type AdminWithdrawal = Withdrawal & { store?: { name: string; slug: string } };

export type ContactMessage = {
  id: ID;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  handledAt: string | null;
  createdAt: string;
};

export type NewsletterSubscriber = { id: ID; email: string; locale: string; createdAt: string };

export type AuditLog = {
  id: ID;
  actorId: ID | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: ID; email: string; firstName: string; lastName: string; role: UserRole } | null;
};

/* ---------------------------------------------------------------- flash-deal campaigns */

export type FlashCampaignStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
/** Stored status, or for a published campaign where its dates put it right now. */
export type FlashCampaignPhase = FlashCampaignStatus | "SCHEDULED" | "ACTIVE" | "ENDED";
export type FlashItemStatus = "PENDING" | "APPROVED" | "REJECTED";

export type FlashListing = Pick<Product, "id" | "title" | "slug" | "price" | "compareAtPrice" | "images" | "condition" | "status"> & {
  store: { id: ID; name: string; slug: string };
  category: { name: string; slug: string } | null;
};

export type FlashCampaignItem = {
  id: ID;
  campaignId: ID;
  advertisementId: ID;
  storeId: ID;
  status: FlashItemStatus;
  /** Decimal serialised as a string. */
  campaignPrice: string;
  originalPrice: string | null;
  originalCompareAtPrice: string | null;
  applied: boolean;
  appliedAt: string | null;
  note: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  discountPercent: number;
  createdAt: string;
  advertisement: FlashListing;
};

export type FlashCampaign = {
  id: ID;
  name: string;
  slug: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: FlashCampaignStatus;
  phase: FlashCampaignPhase;
  minDiscountPercent: number;
  applicationsOpen: boolean;
  activatedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  items?: FlashCampaignItem[];
  /** Admin list only. */
  itemCount?: number;
  pendingCount?: number;
  _count?: { items: number };
};
