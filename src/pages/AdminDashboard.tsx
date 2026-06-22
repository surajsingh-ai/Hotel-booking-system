import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BadgeIndianRupee,
  BarChart3,
  BedDouble,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  IndianRupee,
  LogOut,
  Percent,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TicketPercent,
  Trash2,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AdminHotel,
  AdminInventoryRow,
  AdminReservation,
  cancelAdminReservation,
  confirmAdminReservation,
  createAdminHotel,
  deleteAdminHotel,
  expireHolds,
  fetchAdminHotels,
  fetchAdminInventory,
  fetchAdminMe,
  fetchAdminReservations,
  fetchAdminRoomTypes,
  fetchAdminSummary,
  updateAdminHotel,
  updateAdminInventory,
} from "@/lib/api";

type BookingStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "HELD" | "EXPIRED" | "PAYMENT_FAILED";
type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
type Role = "Super Admin" | "Admin" | "Hotel Manager";

type RoomDraft = {
  id: number;
  hotelName: string;
  type: string;
  price: number;
  capacity: number;
  available: number;
  amenities: string;
  image: string;
  status: "Active" | "Inactive";
};

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  bookings: number;
  spend: number;
  status: "Active" | "Blocked";
};

type PaymentRecord = {
  id: string;
  bookingRef: string;
  guest: string;
  amount: number;
  status: "PAID" | "PENDING" | "REFUNDED" | "FAILED";
  method: string;
  date: string;
};

type ReviewRecord = {
  id: number;
  hotel: string;
  guest: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
};

type Coupon = {
  id: number;
  code: string;
  discount: number;
  uses: number;
  maxUses: number;
  status: "Active" | "Inactive";
};

type AdminMember = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: "Active" | "Inactive";
};

const statusClass: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-success text-success-foreground",
  CHECKED_IN: "bg-primary/10 text-primary",
  CHECKED_OUT: "bg-muted text-muted-foreground",
  HELD: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  PAYMENT_FAILED: "bg-destructive/10 text-destructive",
  PAID: "bg-success text-success-foreground",
  REFUNDED: "bg-primary/10 text-primary",
  FAILED: "bg-destructive/10 text-destructive",
  APPROVED: "bg-success text-success-foreground",
  REJECTED: "bg-destructive/10 text-destructive",
  Active: "bg-success text-success-foreground",
  Blocked: "bg-destructive/10 text-destructive",
  Inactive: "bg-muted text-muted-foreground",
};

const inr = (value: number) => `INR ${Number(value || 0).toLocaleString("en-IN")}`;
const pageSize = 8;

const analytics = [
  { month: "Jan", revenue: 420000, bookings: 62 },
  { month: "Feb", revenue: 510000, bookings: 74 },
  { month: "Mar", revenue: 610000, bookings: 89 },
  { month: "Apr", revenue: 580000, bookings: 81 },
  { month: "May", revenue: 760000, bookings: 104 },
  { month: "Jun", revenue: 840000, bookings: 118 },
];

const initialCustomers: Customer[] = [
  { id: 1, name: "Priya Sharma", email: "priya@example.com", phone: "+91 98765 12340", bookings: 5, spend: 82000, status: "Active" },
  { id: 2, name: "Rajesh Kumar", email: "rajesh@example.com", phone: "+91 98765 12341", bookings: 3, spend: 46500, status: "Active" },
  { id: 3, name: "Nisha Mehta", email: "nisha@example.com", phone: "+91 98765 12342", bookings: 1, spend: 12999, status: "Blocked" },
];

const initialPayments: PaymentRecord[] = [
  { id: "PAY-1021", bookingRef: "SK-2026-1021", guest: "Priya Sharma", amount: 18500, status: "PAID", method: "UPI", date: "2026-06-20" },
  { id: "PAY-1022", bookingRef: "SK-2026-1022", guest: "Rajesh Kumar", amount: 22900, status: "PENDING", method: "Card", date: "2026-06-21" },
  { id: "PAY-1023", bookingRef: "SK-2026-1023", guest: "Nisha Mehta", amount: 12999, status: "REFUNDED", method: "Net Banking", date: "2026-06-22" },
];

const initialReviews: ReviewRecord[] = [
  { id: 1, hotel: "Pinewood Mountain Lodge", guest: "Priya Sharma", rating: 5, comment: "Clean room and quick check-in.", status: "PENDING" },
  { id: 2, hotel: "Heritage Palace Hotel", guest: "Rajesh Kumar", rating: 4, comment: "Great location and breakfast.", status: "APPROVED" },
  { id: 3, hotel: "Ocean Pearl Resort", guest: "Nisha Mehta", rating: 2, comment: "Room was not ready on time.", status: "REJECTED" },
];

const initialCoupons: Coupon[] = [
  { id: 1, code: "STAY10", discount: 10, uses: 142, maxUses: 500, status: "Active" },
  { id: 2, code: "WEEKEND20", discount: 20, uses: 64, maxUses: 200, status: "Active" },
  { id: 3, code: "WELCOME15", discount: 15, uses: 310, maxUses: 1000, status: "Inactive" },
];

const initialAdmins: AdminMember[] = [
  { id: 1, name: "StayKart Admin", email: "admin@gmail.com", role: "Super Admin", status: "Active" },
  { id: 2, name: "Operations Lead", email: "ops@staykart.local", role: "Admin", status: "Active" },
  { id: 3, name: "Hotel Partner", email: "manager@staykart.local", role: "Hotel Manager", status: "Inactive" },
];

const activityLogs = [
  "Admin updated inventory for Flex Breakfast",
  "Refund initiated for PAY-1023",
  "Coupon WEEKEND20 usage limit reviewed",
  "Hotel Pinewood Mountain Lodge marked active",
];

const notifications = [
  "12 bookings need confirmation",
  "3 reviews are waiting for approval",
  "2 room types have low availability",
  "Monthly revenue report is ready",
];

const adminApi = {
  updateBookingStatus: async (_reference: string, _status: BookingStatus) => ({ ok: true }),
  blockCustomer: async (_id: number, _blocked: boolean) => ({ ok: true }),
  updatePaymentStatus: async (_id: string, _status: PaymentRecord["status"]) => ({ ok: true }),
  updateReviewStatus: async (_id: number, _status: ReviewStatus) => ({ ok: true }),
  saveCoupon: async (_coupon: Coupon) => ({ ok: true }),
  saveRoom: async (_room: RoomDraft) => ({ ok: true }),
  exportReport: async (_type: string, _format: "Excel" | "PDF") => ({ ok: true }),
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hotelSearch, setHotelSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationStatus, setReservationStatus] = useState("");
  const [bookingSort, setBookingSort] = useState("created");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<number>(0);
  const [bookingPage, setBookingPage] = useState(1);
  const [hotelPage, setHotelPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [customers, setCustomers] = useState(initialCustomers);
  const [payments, setPayments] = useState(initialPayments);
  const [reviews, setReviews] = useState(initialReviews);
  const [coupons, setCoupons] = useState(initialCoupons);
  const [admins, setAdmins] = useState(initialAdmins);
  const [rooms, setRooms] = useState<RoomDraft[]>([]);
  const [hotelForm, setHotelForm] = useState({
    name: "",
    city: "",
    area: "",
    address: "",
    description: "",
    amenities: "",
    images: "",
    policies: "",
    status: "Active",
    rating: 4.5,
    reviews: 0,
    price: 5999,
    originalPrice: 7499,
    tag: "Admin Added",
  });
  const [roomForm, setRoomForm] = useState({
    hotelName: "",
    type: "",
    price: 4999,
    capacity: 2,
    available: 5,
    amenities: "",
    image: "",
    status: "Active" as RoomDraft["status"],
  });
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount: 10,
    maxUses: 100,
  });

  const meQuery = useQuery({
    queryKey: ["admin-me"],
    queryFn: fetchAdminMe,
    retry: false,
  });
  const summaryQuery = useQuery({ queryKey: ["admin-summary"], queryFn: fetchAdminSummary, enabled: meQuery.isSuccess });
  const hotelsQuery = useQuery({
    queryKey: ["admin-hotels", hotelSearch],
    queryFn: () => fetchAdminHotels(hotelSearch),
    enabled: meQuery.isSuccess,
  });
  const reservationsQuery = useQuery({
    queryKey: ["admin-reservations", reservationStatus, reservationSearch],
    queryFn: () => fetchAdminReservations({ status: reservationStatus, search: reservationSearch }),
    enabled: meQuery.isSuccess,
  });
  const roomTypesQuery = useQuery({
    queryKey: ["admin-room-types"],
    queryFn: () => fetchAdminRoomTypes(),
    enabled: meQuery.isSuccess,
  });
  const inventoryQuery = useQuery({
    queryKey: ["admin-inventory", selectedRoomTypeId],
    queryFn: () => fetchAdminInventory(selectedRoomTypeId),
    enabled: meQuery.isSuccess && selectedRoomTypeId > 0,
  });

  useEffect(() => {
    if (meQuery.isError) {
      localStorage.removeItem("staykart_admin_token");
      localStorage.removeItem("staykart_admin");
      navigate("/admin/login");
    }
  }, [meQuery.isError, navigate]);

  useEffect(() => {
    const firstRoom = roomTypesQuery.data?.roomTypes?.[0]?.id;
    if (!selectedRoomTypeId && firstRoom) {
      setSelectedRoomTypeId(firstRoom);
    }
  }, [roomTypesQuery.data, selectedRoomTypeId]);

  useEffect(() => {
    const nextRooms = (roomTypesQuery.data?.roomTypes || []).map((room) => ({
      id: room.id,
      hotelName: room.hotel_name,
      type: room.name,
      price: Number(room.base_price),
      capacity: Number(room.capacity),
      available: 6,
      amenities: `${room.bed}, ${room.meal_plan}`,
      image: "",
      status: "Active" as const,
    }));
    if (nextRooms.length) {
      setRooms(nextRooms);
    }
  }, [roomTypesQuery.data]);

  const invalidateAdmin = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
    queryClient.invalidateQueries({ queryKey: ["admin-hotels"] });
    queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
    queryClient.invalidateQueries({ queryKey: ["admin-room-types"] });
    queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
  };

  const addHotelMutation = useMutation({
    mutationFn: createAdminHotel,
    onSuccess: () => {
      toast.success("Hotel created");
      setHotelForm({
        name: "",
        city: "",
        area: "",
        address: "",
        description: "",
        amenities: "",
        images: "",
        policies: "",
        status: "Active",
        rating: 4.5,
        reviews: 0,
        price: 5999,
        originalPrice: 7499,
        tag: "Admin Added",
      });
      invalidateAdmin();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to create hotel"),
  });

  const updateHotelMutation = useMutation({
    mutationFn: (hotel: AdminHotel) =>
      updateAdminHotel(hotel.id, {
        price: Number(hotel.price),
        originalPrice: Number(hotel.original_price),
        tag: hotel.tag || "",
      }),
    onSuccess: () => {
      toast.success("Hotel updated");
      invalidateAdmin();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update hotel"),
  });

  const deleteHotelMutation = useMutation({
    mutationFn: deleteAdminHotel,
    onSuccess: () => {
      toast.success("Hotel deleted");
      invalidateAdmin();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to delete hotel"),
  });

  const confirmReservationMutation = useMutation({
    mutationFn: confirmAdminReservation,
    onSuccess: () => {
      toast.success("Booking confirmed");
      invalidateAdmin();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to confirm booking"),
  });

  const cancelReservationMutation = useMutation({
    mutationFn: cancelAdminReservation,
    onSuccess: () => {
      toast.success("Booking cancelled");
      invalidateAdmin();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to cancel booking"),
  });

  const updateInventoryMutation = useMutation({
    mutationFn: (row: AdminInventoryRow) =>
      updateAdminInventory(row.id, {
        availableRooms: Number(row.available_rooms),
        totalRooms: Number(row.total_rooms),
        blockedRooms: Number(row.blocked_rooms),
        price: Number(row.price),
        stopSell: Boolean(row.stop_sell),
        minStay: Number(row.min_stay),
        maxStay: row.max_stay,
      }),
    onSuccess: () => {
      toast.success("Inventory updated");
      invalidateAdmin();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update inventory"),
  });

  const expireMutation = useMutation({
    mutationFn: expireHolds,
    onSuccess: (data) => {
      toast.success("Hold worker completed", { description: `${data.expired} expired holds released.` });
      invalidateAdmin();
    },
    onError: () => toast.error("Unable to expire holds"),
  });

  const totals = summaryQuery.data?.totals;
  const reservations = useMemo(() => reservationsQuery.data?.reservations || [], [reservationsQuery.data?.reservations]);
  const hotels = useMemo(() => hotelsQuery.data?.hotels || [], [hotelsQuery.data?.hotels]);
  const totalBookings = reservations.length;
  const totalRooms = roomTypesQuery.data?.roomTypes?.length || rooms.length;
  const occupancyRate = Math.min(100, Math.round(((totalBookings || 1) / Math.max(totalRooms || 1, 1)) * 18));
  const selectedRoom = useMemo(
    () => roomTypesQuery.data?.roomTypes.find((room) => room.id === selectedRoomTypeId),
    [roomTypesQuery.data, selectedRoomTypeId],
  );

  const filteredReservations = useMemo(() => {
    const query = reservationSearch.toLowerCase();
    return [...reservations]
      .filter((reservation) => {
        if (!query) return true;
        return [reservation.booking_reference, reservation.guest_name, reservation.guest_email, reservation.hotel_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (bookingSort === "amount") return Number(b.amount) - Number(a.amount);
        if (bookingSort === "guest") return String(a.guest_name).localeCompare(String(b.guest_name));
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
  }, [bookingSort, reservationSearch, reservations]);

  const filteredRooms = useMemo(() => {
    const query = roomSearch.toLowerCase();
    return rooms.filter((room) => `${room.hotelName} ${room.type} ${room.amenities}`.toLowerCase().includes(query));
  }, [roomSearch, rooms]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.toLowerCase();
    return customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(query));
  }, [customerSearch, customers]);

  const filteredPayments = useMemo(() => {
    const query = paymentSearch.toLowerCase();
    return payments.filter((payment) => `${payment.id} ${payment.bookingRef} ${payment.guest} ${payment.method}`.toLowerCase().includes(query));
  }, [paymentSearch, payments]);

  const paidRevenue = payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + payment.amount, 0);
  const pagedBookings = paginate(filteredReservations, bookingPage);
  const pagedHotels = paginate(hotels, hotelPage);

  const logout = () => {
    localStorage.removeItem("staykart_admin_token");
    localStorage.removeItem("staykart_admin");
    navigate("/admin/login");
  };

  const handleAddHotel = (event: FormEvent) => {
    event.preventDefault();
    if (!hotelForm.name.trim() || !hotelForm.city.trim() || !hotelForm.area.trim()) {
      toast.error("Hotel name, city, and area are required");
      return;
    }
    addHotelMutation.mutate(hotelForm);
  };

  const handleAddRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (!roomForm.hotelName.trim() || !roomForm.type.trim()) {
      toast.error("Hotel name and room type are required");
      return;
    }
    const room = { id: Date.now(), ...roomForm };
    await adminApi.saveRoom(room);
    setRooms((current) => [room, ...current]);
    setRoomForm({ hotelName: "", type: "", price: 4999, capacity: 2, available: 5, amenities: "", image: "", status: "Active" });
    toast.success("Room saved");
  };

  const handleAddCoupon = async (event: FormEvent) => {
    event.preventDefault();
    if (!couponForm.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    const coupon = { id: Date.now(), code: couponForm.code.toUpperCase(), discount: couponForm.discount, uses: 0, maxUses: couponForm.maxUses, status: "Active" as const };
    await adminApi.saveCoupon(coupon);
    setCoupons((current) => [coupon, ...current]);
    setCouponForm({ code: "", discount: 10, maxUses: 100 });
    toast.success("Coupon created");
  };

  const updateBookingStatus = async (reservation: AdminReservation, status: BookingStatus) => {
    await adminApi.updateBookingStatus(reservation.booking_reference, status);
    toast.success(`Booking marked ${status.replace("_", " ").toLowerCase()}`);
  };

  const updatePaymentStatus = async (id: string, status: PaymentRecord["status"]) => {
    await adminApi.updatePaymentStatus(id, status);
    setPayments((current) => current.map((payment) => (payment.id === id ? { ...payment, status } : payment)));
    toast.success("Payment updated");
  };

  const updateReviewStatus = async (id: number, status: ReviewStatus) => {
    await adminApi.updateReviewStatus(id, status);
    setReviews((current) => current.map((review) => (review.id === id ? { ...review, status } : review)));
    toast.success("Review updated");
  };

  const toggleCustomer = async (id: number) => {
    const customer = customers.find((item) => item.id === id);
    if (!customer) return;
    const blocked = customer.status !== "Blocked";
    await adminApi.blockCustomer(id, blocked);
    setCustomers((current) => current.map((item) => (item.id === id ? { ...item, status: blocked ? "Blocked" : "Active" } : item)));
    toast.success(blocked ? "Customer blocked" : "Customer unblocked");
  };

  const exportReport = async (type: string, format: "Excel" | "PDF") => {
    await adminApi.exportReport(type, format);
    toast.success(`${type} report queued`, { description: `${format} export placeholder is ready for API integration.` });
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg gradient-cta text-white shadow-cta">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent">StayKart Admin</p>
              <h1 className="font-display text-2xl leading-none">Booking Operations</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => invalidateAdmin()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button variant="outline" className="rounded-lg" onClick={logout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as {meQuery.data?.admin.name || "admin"}</p>
            <h2 className="font-display text-4xl">Control bookings and hotel supply</h2>
          </div>
          <Button className="rounded-lg gradient-cta shadow-cta" disabled={expireMutation.isPending} onClick={() => expireMutation.mutate()}>
            <CalendarClock className="size-4" />
            Expire holds
          </Button>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start rounded-lg">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="hotels">Hotels</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="offers">Offers</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Metric icon={Building2} label="Total Hotels" value={totals?.hotels ?? hotels.length} />
              <Metric icon={BedDouble} label="Total Rooms" value={totalRooms} />
              <Metric icon={CalendarClock} label="Total Bookings" value={totalBookings} />
              <Metric icon={IndianRupee} label="Total Revenue" value={inr(totals?.revenue || paidRevenue)} />
              <Metric icon={Percent} label="Occupancy Rate" value={`${occupancyRate}%`} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Revenue Analytics">
                <ChartFrame>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
                      <ChartTooltip formatter={(value) => inr(Number(value))} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </Panel>

              <Panel title="Booking Analytics">
                <ChartFrame>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip />
                      <Bar dataKey="bookings" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFrame>
              </Panel>
            </div>

            <Panel title="Recent Bookings">
              <BookingsTable
                reservations={filteredReservations.slice(0, 6)}
                onConfirm={(reference) => confirmReservationMutation.mutate(reference)}
                onCancel={(reference) => cancelReservationMutation.mutate(reference)}
                onStatus={updateBookingStatus}
              />
            </Panel>
          </TabsContent>

          <TabsContent value="hotels" className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <form onSubmit={handleAddHotel} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <h3 className="mb-4 font-display text-2xl">Add Hotel</h3>
              <div className="grid gap-3">
                <Field label="Name" value={hotelForm.name} onChange={(value) => setHotelForm({ ...hotelForm, name: value })} />
                <Field label="Address" value={hotelForm.address} onChange={(value) => setHotelForm({ ...hotelForm, address: value })} />
                <Field label="City" value={hotelForm.city} onChange={(value) => setHotelForm({ ...hotelForm, city: value })} />
                <Field label="Area" value={hotelForm.area} onChange={(value) => setHotelForm({ ...hotelForm, area: value })} />
                <Field label="Description" value={hotelForm.description} onChange={(value) => setHotelForm({ ...hotelForm, description: value })} />
                <Field label="Amenities" value={hotelForm.amenities} onChange={(value) => setHotelForm({ ...hotelForm, amenities: value })} />
                <Field label="Images" value={hotelForm.images} onChange={(value) => setHotelForm({ ...hotelForm, images: value })} />
                <Field label="Policies" value={hotelForm.policies} onChange={(value) => setHotelForm({ ...hotelForm, policies: value })} />
                <SelectField label="Status" value={hotelForm.status} options={["Active", "Inactive"]} onChange={(value) => setHotelForm({ ...hotelForm, status: value })} />
                <Field label="Tag" value={hotelForm.tag} onChange={(value) => setHotelForm({ ...hotelForm, tag: value })} />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Price" value={hotelForm.price} onChange={(value) => setHotelForm({ ...hotelForm, price: value })} />
                  <NumberField label="Original" value={hotelForm.originalPrice} onChange={(value) => setHotelForm({ ...hotelForm, originalPrice: value })} />
                  <NumberField label="Rating" value={hotelForm.rating} step="0.1" onChange={(value) => setHotelForm({ ...hotelForm, rating: value })} />
                  <NumberField label="Reviews" value={hotelForm.reviews} onChange={(value) => setHotelForm({ ...hotelForm, reviews: value })} />
                </div>
                <Button className="rounded-lg gradient-cta shadow-cta" disabled={addHotelMutation.isPending}>Create hotel</Button>
              </div>
            </form>

            <Panel title="Hotel Management">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Input className="min-w-64 flex-1" placeholder="Search hotels" value={hotelSearch} onChange={(event) => setHotelSearch(event.target.value)} />
                <Pagination page={hotelPage} total={hotels.length} onPageChange={setHotelPage} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hotel</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedHotels.map((hotel) => (
                    <EditableHotelRow
                      key={hotel.id}
                      hotel={hotel}
                      onSave={(nextHotel) => updateHotelMutation.mutate(nextHotel)}
                      onDelete={(id) => deleteHotelMutation.mutate(id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </TabsContent>

          <TabsContent value="rooms" className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <form onSubmit={handleAddRoom} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <h3 className="mb-4 font-display text-2xl">Add Room</h3>
              <div className="grid gap-3">
                <Field label="Hotel" value={roomForm.hotelName} onChange={(value) => setRoomForm({ ...roomForm, hotelName: value })} />
                <Field label="Room Type" value={roomForm.type} onChange={(value) => setRoomForm({ ...roomForm, type: value })} />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Price" value={roomForm.price} onChange={(value) => setRoomForm({ ...roomForm, price: value })} />
                  <NumberField label="Capacity" value={roomForm.capacity} onChange={(value) => setRoomForm({ ...roomForm, capacity: value })} />
                  <NumberField label="Availability" value={roomForm.available} onChange={(value) => setRoomForm({ ...roomForm, available: value })} />
                </div>
                <Field label="Amenities" value={roomForm.amenities} onChange={(value) => setRoomForm({ ...roomForm, amenities: value })} />
                <Field label="Room Image" value={roomForm.image} onChange={(value) => setRoomForm({ ...roomForm, image: value })} />
                <SelectField label="Status" value={roomForm.status} options={["Active", "Inactive"]} onChange={(value) => setRoomForm({ ...roomForm, status: value as RoomDraft["status"] })} />
                <Button className="rounded-lg gradient-cta shadow-cta">Save room</Button>
              </div>
            </form>

            <Panel title="Room Management">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Input className="min-w-64 flex-1" placeholder="Search rooms" value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.map((room) => (
                    <EditableRoomRow key={room.id} room={room} onSave={(nextRoom) => setRooms((current) => current.map((item) => (item.id === nextRoom.id ? nextRoom : item)))} onDelete={(id) => setRooms((current) => current.filter((item) => item.id !== id))} />
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </TabsContent>

          <TabsContent value="bookings" className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-64 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search ref, guest, email, hotel" value={reservationSearch} onChange={(event) => setReservationSearch(event.target.value)} />
              </div>
              <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={reservationStatus} onChange={(event) => setReservationStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="HELD">Held</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_IN">Checked-in</option>
                <option value="CHECKED_OUT">Checked-out</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
              <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={bookingSort} onChange={(event) => setBookingSort(event.target.value)}>
                <option value="created">Newest</option>
                <option value="amount">Amount</option>
                <option value="guest">Guest</option>
              </select>
              <Pagination page={bookingPage} total={filteredReservations.length} onPageChange={setBookingPage} />
            </div>
            <BookingsTable reservations={pagedBookings} onConfirm={(reference) => confirmReservationMutation.mutate(reference)} onCancel={(reference) => cancelReservationMutation.mutate(reference)} onStatus={updateBookingStatus} />
          </TabsContent>

          <TabsContent value="customers" className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Panel title="Customer Management">
              <div className="mb-4">
                <Input placeholder="Search customers" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Bookings</TableHead>
                    <TableHead>Spend</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.email} / {customer.phone}</p>
                      </TableCell>
                      <TableCell>{customer.bookings}</TableCell>
                      <TableCell>{inr(customer.spend)}</TableCell>
                      <TableCell><Badge className={statusClass[customer.status]}>{customer.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => toggleCustomer(customer.id)}>
                          {customer.status === "Blocked" ? "Unblock" : "Block"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <Panel title="Customer Profile">
              <div className="space-y-3 text-sm">
                {(filteredCustomers[0] ? [
                  ["Name", filteredCustomers[0].name],
                  ["Email", filteredCustomers[0].email],
                  ["Phone", filteredCustomers[0].phone],
                  ["Bookings", filteredCustomers[0].bookings],
                  ["Lifetime spend", inr(filteredCustomers[0].spend)],
                  ["Recent booking", reservations[0]?.booking_reference || "No booking yet"],
                ] : [["No customer selected", "Search or select a customer"]]).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 rounded-md bg-muted/50 p-3">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Metric icon={BadgeIndianRupee} label="Paid Revenue" value={inr(paidRevenue)} />
              <Metric icon={RefreshCw} label="Refunds" value={payments.filter((payment) => payment.status === "REFUNDED").length} />
              <Metric icon={CalendarClock} label="Pending Payments" value={payments.filter((payment) => payment.status === "PENDING").length} />
            </div>
            <Panel title="Payment Records">
              <div className="mb-4">
                <Input placeholder="Search payments" value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <p className="font-mono font-semibold">{payment.id}</p>
                        <p className="text-xs text-muted-foreground">{payment.bookingRef} / {payment.method}</p>
                      </TableCell>
                      <TableCell>{payment.guest}</TableCell>
                      <TableCell>{inr(payment.amount)}</TableCell>
                      <TableCell><Badge className={statusClass[payment.status]}>{payment.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={payment.status === "REFUNDED"} onClick={() => updatePaymentStatus(payment.id, "REFUNDED")}>
                          Refund
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </TabsContent>

          <TabsContent value="reviews" className="rounded-lg border border-border bg-card p-4 shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Review</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      <p className="font-semibold">{review.hotel}</p>
                      <p className="text-xs text-muted-foreground">{review.guest}: {review.comment}</p>
                    </TableCell>
                    <TableCell><span className="inline-flex items-center gap-1"><Star className="size-4 fill-accent text-accent" /> {review.rating}</span></TableCell>
                    <TableCell><Badge className={statusClass[review.status]}>{review.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateReviewStatus(review.id, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => updateReviewStatus(review.id, "REJECTED")}>Reject</Button>
                        <Button size="sm" variant="outline" onClick={() => setReviews((current) => current.filter((item) => item.id !== review.id))}><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="offers" className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <form onSubmit={handleAddCoupon} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <h3 className="mb-4 font-display text-2xl">Create Coupon</h3>
              <div className="grid gap-3">
                <Field label="Code" value={couponForm.code} onChange={(value) => setCouponForm({ ...couponForm, code: value })} />
                <NumberField label="Discount %" value={couponForm.discount} onChange={(value) => setCouponForm({ ...couponForm, discount: value })} />
                <NumberField label="Max Uses" value={couponForm.maxUses} onChange={(value) => setCouponForm({ ...couponForm, maxUses: value })} />
                <Button className="rounded-lg gradient-cta shadow-cta">Create coupon</Button>
              </div>
            </form>
            <Panel title="Offers & Coupon Usage">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-semibold">{coupon.code}</TableCell>
                      <TableCell>{coupon.discount}%</TableCell>
                      <TableCell>{coupon.uses} / {coupon.maxUses}</TableCell>
                      <TableCell><Badge className={statusClass[coupon.status]}>{coupon.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setCoupons((current) => current.filter((item) => item.id !== coupon.id))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </TabsContent>

          <TabsContent value="reports" className="grid gap-4 lg:grid-cols-3">
            {["Revenue", "Booking", "Occupancy"].map((report) => (
              <Panel key={report} title={`${report} Reports`}>
                <p className="mb-4 text-sm text-muted-foreground">Generate filtered reports and export them for finance or hotel operations.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => exportReport(report, "Excel")}><FileSpreadsheet className="size-4" /> Excel</Button>
                  <Button variant="outline" onClick={() => exportReport(report, "PDF")}><Download className="size-4" /> PDF</Button>
                </div>
              </Panel>
            ))}
          </TabsContent>

          <TabsContent value="admin" className="grid gap-4 xl:grid-cols-3">
            <Panel title="Role-Based Access">
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div key={admin.id} className="rounded-md bg-muted/50 p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{admin.name}</p>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                      </div>
                      <Badge className={statusClass[admin.status]}>{admin.status}</Badge>
                    </div>
                    <select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" value={admin.role} onChange={(event) => setAdmins((current) => current.map((item) => item.id === admin.id ? { ...item, role: event.target.value as Role } : item))}>
                      <option>Super Admin</option>
                      <option>Admin</option>
                      <option>Hotel Manager</option>
                    </select>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Activity Logs">
              <div className="space-y-3">
                {activityLogs.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-sm">
                    <Activity className="mt-0.5 size-4 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Notification Center">
              <div className="space-y-3">
                {notifications.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-sm">
                    <Bell className="mt-0.5 size-4 text-accent" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

const paginate = <T,>(items: T[], page: number) => items.slice((page - 1) * pageSize, page * pageSize);

const Metric = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) => (
  <div className="rounded-lg border border-border bg-card p-4 shadow-card">
    <Icon className="mb-3 size-5 text-primary" />
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-lg border border-border bg-card p-4 shadow-card">
    <h3 className="mb-4 font-display text-2xl">{title}</h3>
    {children}
  </section>
);

const ChartFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="h-72 w-full overflow-hidden rounded-md border border-border bg-background p-3">
    {children}
  </div>
);

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input value={value} onChange={(event) => onChange(event.target.value)} required />
  </div>
);

const NumberField = ({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  onChange: (value: number) => void;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} required />
  </div>
);

const SelectField = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  </div>
);

const Pagination = ({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
      <span className="text-sm text-muted-foreground">{page} / {pages}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</Button>
    </div>
  );
};

const BookingsTable = ({
  reservations,
  onConfirm,
  onCancel,
  onStatus,
}: {
  reservations: AdminReservation[];
  onConfirm: (reference: string) => void;
  onCancel: (reference: string) => void;
  onStatus: (reservation: AdminReservation, status: BookingStatus) => void;
}) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Reference</TableHead>
        <TableHead>Guest</TableHead>
        <TableHead>Stay</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Amount</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {reservations.map((reservation) => (
        <TableRow key={reservation.booking_reference}>
          <TableCell>
            <p className="font-mono font-semibold">{reservation.booking_reference}</p>
            <p className="text-xs text-muted-foreground">{reservation.hotel_name} - {reservation.room_name}</p>
          </TableCell>
          <TableCell>
            <p className="font-medium">{reservation.guest_name}</p>
            <p className="text-xs text-muted-foreground">{reservation.guest_email}</p>
          </TableCell>
          <TableCell className="text-sm">
            {reservation.check_in?.slice(0, 10)} to {reservation.check_out?.slice(0, 10)}
          </TableCell>
          <TableCell>
            <Badge className={statusClass[reservation.status] || "bg-muted text-muted-foreground"}>{reservation.status}</Badge>
            <select className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs" value={reservation.status} onChange={(event) => onStatus(reservation, event.target.value as BookingStatus)}>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked-in</option>
              <option value="CHECKED_OUT">Checked-out</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="HELD">Held</option>
            </select>
          </TableCell>
          <TableCell className="text-right font-semibold">{inr(reservation.amount)}</TableCell>
          <TableCell>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={!["HELD", "CONFIRMED"].includes(reservation.status)} onClick={() => onConfirm(reservation.booking_reference)}>
                <CheckCircle2 className="size-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={!["HELD", "CONFIRMED"].includes(reservation.status)} onClick={() => onCancel(reservation.booking_reference)}>
                <XCircle className="size-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const EditableHotelRow = ({
  hotel,
  onSave,
  onDelete,
}: {
  hotel: AdminHotel;
  onSave: (hotel: AdminHotel) => void;
  onDelete: (id: number) => void;
}) => {
  const [draft, setDraft] = useState(hotel);
  const [status, setStatus] = useState("Active");

  useEffect(() => setDraft(hotel), [hotel]);

  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold">{hotel.name}</p>
        <p className="text-xs text-muted-foreground">{hotel.room_type_count} room types / {hotel.available_room_nights} room nights</p>
      </TableCell>
      <TableCell>{hotel.city}</TableCell>
      <TableCell>
        <Input className="h-9 w-28" type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} />
      </TableCell>
      <TableCell>
        <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </TableCell>
      <TableCell>
        <Input className="h-9 min-w-32" value={draft.tag || ""} onChange={(event) => setDraft({ ...draft, tag: event.target.value })} />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onSave(draft)}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(hotel.id)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const EditableRoomRow = ({ room, onSave, onDelete }: { room: RoomDraft; onSave: (room: RoomDraft) => void; onDelete: (id: number) => void }) => {
  const [draft, setDraft] = useState(room);

  useEffect(() => setDraft(room), [room]);

  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold">{room.type}</p>
        <p className="text-xs text-muted-foreground">{room.hotelName} / {room.amenities}</p>
      </TableCell>
      <TableCell><Input className="h-9 w-28" type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></TableCell>
      <TableCell><Input className="h-9 w-20" type="number" value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: Number(event.target.value) })} /></TableCell>
      <TableCell><Input className="h-9 w-20" type="number" value={draft.available} onChange={(event) => setDraft({ ...draft, available: Number(event.target.value) })} /></TableCell>
      <TableCell><Badge className={statusClass[draft.status]}>{draft.status}</Badge></TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onSave(draft)}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(room.id)}><Trash2 className="size-4" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default AdminDashboard;
