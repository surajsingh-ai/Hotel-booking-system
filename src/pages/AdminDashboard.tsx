import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  Building2,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
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

const statusClass: Record<string, string> = {
  CONFIRMED: "bg-success text-success-foreground",
  HELD: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  PAYMENT_FAILED: "bg-destructive/10 text-destructive",
};

const inr = (value: number) => `INR ${Number(value || 0).toLocaleString("en-IN")}`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hotelSearch, setHotelSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationStatus, setReservationStatus] = useState("");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<number>(0);
  const [hotelForm, setHotelForm] = useState({
    name: "",
    city: "",
    area: "",
    rating: 4.5,
    reviews: 0,
    price: 5999,
    originalPrice: 7499,
    tag: "Admin Added",
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
      setHotelForm({ name: "", city: "", area: "", rating: 4.5, reviews: 0, price: 5999, originalPrice: 7499, tag: "Admin Added" });
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
  const selectedRoom = useMemo(
    () => roomTypesQuery.data?.roomTypes.find((room) => room.id === selectedRoomTypeId),
    [roomTypesQuery.data, selectedRoomTypeId],
  );

  const logout = () => {
    localStorage.removeItem("staykart_admin_token");
    localStorage.removeItem("staykart_admin");
    navigate("/admin/login");
  };

  const handleAddHotel = (event: FormEvent) => {
    event.preventDefault();
    addHotelMutation.mutate(hotelForm);
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

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric icon={Building2} label="Hotels" value={totals?.hotels ?? 0} />
          <Metric icon={Users} label="Users" value={totals?.users ?? 0} />
          <Metric icon={IndianRupee} label="Paid revenue" value={inr(totals?.revenue ?? 0)} />
          <Metric icon={BedDouble} label="Room nights" value={(totals?.availableRoomNights ?? 0).toLocaleString("en-IN")} />
          <Metric icon={XCircle} label="Stop-sell dates" value={totals?.stoppedDates ?? 0} />
        </div>

        <Tabs defaultValue="bookings" className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start rounded-lg">
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="hotels">Hotels</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-64 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search ref, guest, email, hotel" value={reservationSearch} onChange={(event) => setReservationSearch(event.target.value)} />
              </div>
              <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={reservationStatus} onChange={(event) => setReservationStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="HELD">Held</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
                <option value="PAYMENT_FAILED">Payment failed</option>
              </select>
            </div>
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
                {(reservationsQuery.data?.reservations || []).map((reservation) => (
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
                      <p className="mt-1 text-xs text-muted-foreground">{reservation.payment_status}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{inr(reservation.amount)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={!["HELD", "CONFIRMED"].includes(reservation.status)} onClick={() => confirmReservationMutation.mutate(reservation.booking_reference)}>
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" disabled={!["HELD", "CONFIRMED"].includes(reservation.status)} onClick={() => cancelReservationMutation.mutate(reservation.booking_reference)}>
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="hotels" className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <form onSubmit={handleAddHotel} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <h3 className="mb-4 font-display text-2xl">Add Hotel</h3>
              <div className="grid gap-3">
                <Field label="Name" value={hotelForm.name} onChange={(value) => setHotelForm({ ...hotelForm, name: value })} />
                <Field label="City" value={hotelForm.city} onChange={(value) => setHotelForm({ ...hotelForm, city: value })} />
                <Field label="Area" value={hotelForm.area} onChange={(value) => setHotelForm({ ...hotelForm, area: value })} />
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

            <div className="rounded-lg border border-border bg-card p-4 shadow-card">
              <div className="mb-4 flex items-center gap-3">
                <Input placeholder="Search hotels" value={hotelSearch} onChange={(event) => setHotelSearch(event.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hotel</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(hotelsQuery.data?.hotels || []).map((hotel) => (
                    <EditableHotelRow
                      key={hotel.id}
                      hotel={hotel}
                      onSave={(nextHotel) => updateHotelMutation.mutate(nextHotel)}
                      onDelete={(id) => deleteHotelMutation.mutate(id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-80 flex-1 space-y-2">
                <Label>Room type</Label>
                <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={selectedRoomTypeId} onChange={(event) => setSelectedRoomTypeId(Number(event.target.value))}>
                  {(roomTypesQuery.data?.roomTypes || []).map((room) => (
                    <option key={room.id} value={room.id}>{room.hotel_name} - {room.name}</option>
                  ))}
                </select>
              </div>
              {selectedRoom && <p className="pb-2 text-sm text-muted-foreground">{selectedRoom.supplier_code} / {inr(selectedRoom.base_price)}</p>}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Blocked</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stop sell</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(inventoryQuery.data?.inventory || []).map((row) => (
                  <EditableInventoryRow key={row.id} row={row} onSave={(nextRow) => updateInventoryMutation.mutate(nextRow)} />
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-display text-2xl">Reservation mix</h3>
              <div className="space-y-3">
                {(summaryQuery.data?.reservations || []).map((item) => (
                  <div key={`${item.status}-${item.payment_status}`} className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                    <span className="font-medium">{item.status} / {item.payment_status}</span>
                    <Badge>{item.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-display text-2xl">Top searches</h3>
              <div className="space-y-3">
                {(summaryQuery.data?.topSearches || []).map((item) => (
                  <div key={item.city} className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                    <span className="font-medium">{item.city}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

const Metric = ({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) => (
  <div className="rounded-lg border border-border bg-card p-4 shadow-card">
    <Icon className="mb-3 size-5 text-primary" />
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
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

const EditableInventoryRow = ({ row, onSave }: { row: AdminInventoryRow; onSave: (row: AdminInventoryRow) => void }) => {
  const [draft, setDraft] = useState(row);

  useEffect(() => setDraft(row), [row]);

  return (
    <TableRow>
      <TableCell className="font-medium">{row.stay_date?.slice(0, 10)}</TableCell>
      <TableCell>
        <Input className="h-9 w-24" type="number" value={draft.available_rooms} onChange={(event) => setDraft({ ...draft, available_rooms: Number(event.target.value) })} />
      </TableCell>
      <TableCell>
        <Input className="h-9 w-24" type="number" value={draft.total_rooms} onChange={(event) => setDraft({ ...draft, total_rooms: Number(event.target.value) })} />
      </TableCell>
      <TableCell>
        <Input className="h-9 w-24" type="number" value={draft.blocked_rooms} onChange={(event) => setDraft({ ...draft, blocked_rooms: Number(event.target.value) })} />
      </TableCell>
      <TableCell>
        <Input className="h-9 w-28" type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} />
      </TableCell>
      <TableCell>
        <input className="size-4" type="checkbox" checked={draft.stop_sell} onChange={(event) => setDraft({ ...draft, stop_sell: event.target.checked })} />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" onClick={() => onSave(draft)}>Save</Button>
      </TableCell>
    </TableRow>
  );
};

export default AdminDashboard;
