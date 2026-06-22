const API_URL = import.meta.env.VITE_API_URL || "/api";
export const LIVE_REFETCH_MS = 3000;

export type Hotel = {
  id: number;
  name: string;
  city: string;
  area: string;
  rating: number;
  reviews: number;
  price: number;
  original_price: number;
  tag: string | null;
  live_price?: number;
  inventory_price?: number;
  available_rooms?: number;
  room_type_count?: number;
};

export type SearchCriteria = {
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
};

export type RoomType = {
  id: number;
  name: string;
  capacity: number;
  bed: string;
  meal_plan: string;
  cancellable: boolean;
  supplier_code: string;
  available_rooms: number;
  nightly_price: number;
  total_price: number;
};

export type Reservation = {
  booking_reference: string;
  status: string;
  payment_status: string;
  amount: number;
  hold_expires_at: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  last_login_at: string | null;
};

export type AdminHotel = Hotel & {
  created_at: string;
  room_type_count: number;
  available_room_nights: number;
};

export type AdminReservation = Reservation & {
  id: number;
  hotel_name: string;
  room_name: string;
  city: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  rooms: number;
  created_at: string;
};

export type AdminRoomType = {
  id: number;
  hotel_id: number;
  hotel_name: string;
  name: string;
  capacity: number;
  bed: string;
  meal_plan: string;
  base_price: number;
  cancellable: boolean;
  supplier_code: string;
};

export type AdminInventoryRow = {
  id: number;
  stay_date: string;
  hotel_name: string;
  room_name: string;
  total_rooms: number;
  available_rooms: number;
  blocked_rooms: number;
  min_stay: number;
  max_stay: number | null;
  stop_sell: boolean;
  price: number;
  currency: string;
  source: string;
  updated_at: string;
};

function adminHeaders() {
  const token = localStorage.getItem("staykart_admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseAdminResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Admin request failed");
  }

  return data as T;
}

export async function loginAdmin(email: string, password: string) {
  const response = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseAdminResponse<{ token: string; admin: AdminUser }>(response);
}

export async function fetchAdminMe() {
  const response = await fetch(`${API_URL}/admin/me`, { headers: adminHeaders() });
  return parseAdminResponse<{ admin: AdminUser }>(response);
}

export async function fetchAdminSummary() {
  const response = await fetch(`${API_URL}/admin/summary`, { headers: adminHeaders() });
  return parseAdminResponse<{
    totals: {
      hotels: number;
      users: number;
      revenue: number;
      availableRoomNights: number;
      stoppedDates: number;
      indexedDates: number;
    };
    reservations: Array<{ status: string; payment_status: string; count: number }>;
    topSearches: Array<{ city: string; count: number }>;
  }>(response);
}

export async function fetchAdminHotels(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const response = await fetch(`${API_URL}/admin/hotels?${params.toString()}`, { headers: adminHeaders() });
  return parseAdminResponse<{ hotels: AdminHotel[] }>(response);
}

export async function createAdminHotel(payload: {
  name: string;
  city: string;
  area: string;
  rating: number;
  reviews: number;
  price: number;
  originalPrice: number;
  tag: string;
}) {
  const response = await fetch(`${API_URL}/admin/hotels`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return parseAdminResponse<{ hotel: AdminHotel }>(response);
}

export async function updateAdminHotel(id: number, payload: Partial<{
  name: string;
  city: string;
  area: string;
  rating: number;
  reviews: number;
  price: number;
  originalPrice: number;
  tag: string;
}>) {
  const response = await fetch(`${API_URL}/admin/hotels/${id}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return parseAdminResponse<{ hotel: AdminHotel }>(response);
}

export async function deleteAdminHotel(id: number) {
  const response = await fetch(`${API_URL}/admin/hotels/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  return parseAdminResponse<{ deleted: boolean }>(response);
}

export async function fetchAdminReservations(filters: { status?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const response = await fetch(`${API_URL}/admin/reservations?${params.toString()}`, { headers: adminHeaders() });
  return parseAdminResponse<{ reservations: AdminReservation[] }>(response);
}

export async function confirmAdminReservation(reference: string) {
  const response = await fetch(`${API_URL}/admin/reservations/${reference}/confirm`, {
    method: "POST",
    headers: adminHeaders(),
  });
  return parseAdminResponse<{ reservation: AdminReservation }>(response);
}

export async function cancelAdminReservation(reference: string) {
  const response = await fetch(`${API_URL}/admin/reservations/${reference}/cancel`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ reason: "Admin cancelled" }),
  });
  return parseAdminResponse<{ reservation: AdminReservation }>(response);
}

export async function fetchAdminRoomTypes(hotelId = 0) {
  const params = new URLSearchParams();
  if (hotelId) params.set("hotelId", String(hotelId));
  const response = await fetch(`${API_URL}/admin/room-types?${params.toString()}`, { headers: adminHeaders() });
  return parseAdminResponse<{ roomTypes: AdminRoomType[] }>(response);
}

export async function fetchAdminInventory(roomTypeId: number) {
  const today = new Date();
  const to = new Date(today);
  to.setDate(today.getDate() + 13);
  const params = new URLSearchParams({
    roomTypeId: String(roomTypeId),
    from: today.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });
  const response = await fetch(`${API_URL}/admin/inventory?${params.toString()}`, { headers: adminHeaders() });
  return parseAdminResponse<{ inventory: AdminInventoryRow[] }>(response);
}

export async function updateAdminInventory(id: number, payload: Partial<{
  availableRooms: number;
  totalRooms: number;
  blockedRooms: number;
  price: number;
  stopSell: boolean;
  minStay: number;
  maxStay: number | null;
}>) {
  const response = await fetch(`${API_URL}/admin/inventory/${id}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  return parseAdminResponse<{ inventory: AdminInventoryRow }>(response);
}

export async function registerUser(name: string, email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user: User = {
    id: Date.now(),
    name: name.trim() || normalizedEmail.split("@")[0] || "User",
    email: normalizedEmail,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };
  localStorage.setItem("staykart_user", JSON.stringify(user));
  return { user };
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("staykart_user") || "null") as User | null;
    } catch {
      return null;
    }
  })();

  if (storedUser?.email === normalizedEmail) {
    const user = { ...storedUser, last_login_at: new Date().toISOString() };
    localStorage.setItem("staykart_user", JSON.stringify(user));
    return { user };
  }

  const user: User = {
    id: Date.now(),
    name: normalizedEmail.split("@")[0] || "User",
    email: normalizedEmail,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };
  localStorage.setItem("staykart_user", JSON.stringify(user));
  return { user };
}

export async function fetchUsers() {
  const response = await fetch(`${API_URL}/auth/users`);
  if (!response.ok) throw new Error("Unable to fetch users");
  return response.json() as Promise<{ users: User[]; total: number }>;
}

export async function fetchHotels(criteria?: Partial<SearchCriteria>) {
  const params = new URLSearchParams();

  if (criteria?.city) {
    params.set("city", criteria.city);
  }

  if (criteria?.checkIn) {
    params.set("checkIn", criteria.checkIn);
  }

  if (criteria?.checkOut) {
    params.set("checkOut", criteria.checkOut);
  }

  if (criteria?.adults) {
    params.set("adults", String(criteria.adults));
  }

  if (criteria?.rooms) {
    params.set("rooms", String(criteria.rooms));
  }

  const response = await fetch(`${API_URL}/hotels?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Unable to load hotels");
  }

  return response.json() as Promise<{ hotels: Hotel[]; meta: { source: string; refreshMs?: number; ttlMs?: number } }>;
}

export async function saveSearch(search: {
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
}) {
  const response = await fetch(`${API_URL}/searches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(search),
  });

  if (!response.ok) {
    throw new Error("Unable to save search");
  }

  return response.json();
}

export async function fetchRooms(hotelId: number, criteria: SearchCriteria) {
  const params = new URLSearchParams({
    checkIn: criteria.checkIn,
    checkOut: criteria.checkOut,
    adults: String(criteria.adults),
    rooms: String(criteria.rooms),
  });

  const response = await fetch(`${API_URL}/hotels/${hotelId}/rooms?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Unable to load rooms");
  }

  return response.json() as Promise<{ rooms: RoomType[]; meta: { nights: number; freshness: string; refreshMs?: number } }>;
}

export async function createReservation(payload: {
  reservationId: string;
  hotelId: number;
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guestName: string;
  guestEmail: string;
}) {
  const makeLocalReservation = (): { reservation: Reservation; idempotentReplay: boolean } => ({
    reservation: {
      booking_reference: payload.reservationId || `SK${Date.now()}`,
      status: "HELD",
      payment_status: "PENDING",
      amount: 0,
      hold_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    idempotentReplay: false,
  });

  try {
    const response = await fetch(`${API_URL}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return makeLocalReservation();
    }

    return response.json() as Promise<{ reservation: Reservation; idempotentReplay: boolean }>;
  } catch {
    return makeLocalReservation();
  }
}

export async function confirmPayment(reservationId: string) {
  const makeLocalPayment = (): { reservation: Reservation } => ({
    reservation: {
      booking_reference: reservationId,
      status: "CONFIRMED",
      payment_status: "PAID",
      amount: 0,
      hold_expires_at: new Date().toISOString(),
    },
  });

  try {
    const response = await fetch(`${API_URL}/payments/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId, success: true }),
    });

    if (!response.ok) {
      return makeLocalPayment();
    }

    return response.json() as Promise<{ reservation: Reservation }>;
  } catch {
    return makeLocalPayment();
  }
}

export async function fetchOpsStatus() {
  const response = await fetch(`${API_URL}/ops/status`);

  if (!response.ok) {
    throw new Error("Unable to load OTA status");
  }

  return response.json();
}

export async function pushSupplierDelta() {
  const response = await fetch(`${API_URL}/suppliers/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceDelta: -350, availableDelta: 1 }),
  });

  if (!response.ok) {
    throw new Error("Unable to process supplier update");
  }

  return response.json();
}

export async function syncInventoryUpdate() {
  const status = await fetchOpsStatus();
  const firstRoomTypeId = Number(status?.sampleRoomTypeId || status?.sample_room_type_id || 1);
  const today = new Date();
  const updates = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);
    return {
      date: date.toISOString().slice(0, 10),
      availableRooms: index === 2 ? 0 : 4 + index,
      totalRooms: 8,
      price: 5200 + index * 450,
      stopSell: index === 2,
      minStay: index === 4 ? 2 : 1,
    };
  });

  const response = await fetch(`${API_URL}/inventory/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      supplier: "CHANNEL_MANAGER_DEMO",
      roomTypeId: firstRoomTypeId,
      updates,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to sync inventory");
  }

  return response.json();
}

export async function expireHolds() {
  const response = await fetch(`${API_URL}/ops/expire-holds`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to expire holds");
  }

  return response.json() as Promise<{ expired: number }>;
}

export async function cancelReservation(reference: string, reason = "Guest cancelled") {
  const response = await fetch(`${API_URL}/reservations/${reference}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error("Unable to cancel reservation");
  }

  return response.json() as Promise<{ reservation: Reservation }>;
}
