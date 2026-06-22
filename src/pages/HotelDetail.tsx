import { useMemo, useState } from "react";
import { useParams, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, BedDouble, CalendarClock, Car, CheckCircle2, Coffee, Dumbbell,
  Heart, MapPin, ShieldCheck, Star, Tv, Users, Utensils, Waves, Wifi, Wind, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchHotels, fetchRooms, LIVE_REFETCH_MS, type Hotel, type SearchCriteria } from "@/lib/api";
import { fallbackHotels, findFallbackHotel, getFallbackRooms, getHotelImage } from "@/lib/fallbackData";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoomVariants, { type RoomVariant } from "@/components/RoomVariants";
import GuestReviews from "@/components/GuestReviews";

const amenities = [
  { id: "wifi", icon: Wifi, label: "Free WiFi" },
  { id: "pool", icon: Waves, label: "Swimming Pool" },
  { id: "breakfast", icon: Coffee, label: "Breakfast" },
  { id: "ac", icon: Wind, label: "Air Conditioning" },
  { id: "parking", icon: Car, label: "Free Parking" },
  { id: "gym", icon: Dumbbell, label: "Fitness Center" },
  { id: "restaurant", icon: Utensils, label: "Restaurant" },
  { id: "tv", icon: Tv, label: "Flat-screen TV" },
];

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dayAfter = new Date();
dayAfter.setDate(dayAfter.getDate() + 3);

const fmt = (d: Date) => d.toISOString().slice(0, 10);

const getNights = (checkIn: string, checkOut: string) =>
  Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));

type HotelDetailView = Hotel & {
  img?: string;
  amenities?: string[];
  highlights?: string[];
};

const HotelDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [wishlist, setWishlist] = useState(() => {
    const saved = JSON.parse(localStorage.getItem("staykart_wishlist") || "[]") as string[];
    return id ? saved.includes(id) : false;
  });

  const criteria: SearchCriteria = {
    city: searchParams.get("city") || "",
    checkIn: searchParams.get("checkIn") || fmt(tomorrow),
    checkOut: searchParams.get("checkOut") || fmt(dayAfter),
    adults: Number(searchParams.get("adults") || 2),
    rooms: Number(searchParams.get("rooms") || 1),
  };

  const { data: hotelsData } = useQuery({
    queryKey: ["hotels", criteria],
    queryFn: () => fetchHotels(criteria),
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ["rooms", id, criteria],
    queryFn: () => fetchRooms(Number(id), criteria),
    enabled: !!id,
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const hotel = useMemo(() => {
    const stateHotel = (location.state as { hotel?: HotelDetailView } | null)?.hotel;
    if (stateHotel && String(stateHotel.id) === id) {
      const localByName = fallbackHotels.find((item) => item.name === stateHotel.name);
      return { ...localByName, ...stateHotel };
    }

    const apiHotel = hotelsData?.hotels?.find((h) => String(h.id) === id);
    const fallback = id ? findFallbackHotel(id) : undefined;
    const localByName = apiHotel ? fallbackHotels.find((item) => item.name === apiHotel.name) : undefined;
    return apiHotel ? { ...localByName, ...apiHotel } : fallback;
  }, [hotelsData, id, location.state]);

  const roomTypes = roomsData?.rooms?.length ? roomsData.rooms : getFallbackRooms(id || 1, criteria);

  if (!hotel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Hotel not found.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const viewHotel = hotel as HotelDetailView;
  const img = viewHotel.img || getHotelImage(viewHotel.name);
  const price = Number(viewHotel.live_price || viewHotel.price);
  const off = Math.max(0, Math.round(((Number(hotel.original_price) - price) / Number(hotel.original_price)) * 100));
  const nights = getNights(criteria.checkIn, criteria.checkOut);
  const savedIds = JSON.parse(localStorage.getItem("staykart_wishlist") || "[]") as string[];

  const handleWishlist = () => {
    const hotelId = String(hotel.id);
    const updated = savedIds.includes(hotelId)
      ? savedIds.filter((item) => item !== hotelId)
      : [hotelId, ...savedIds];
    localStorage.setItem("staykart_wishlist", JSON.stringify(updated));
    setWishlist(updated.includes(hotelId));
  };

  const rooms: RoomVariant[] = roomTypes.map((room) => ({
    id: room.id,
    name: room.name || "Room",
    description: `${room.bed || "Comfort bed"} with ${room.meal_plan || "room only"}${room.cancellable ? " - free cancellation" : ""}`,
    capacity: Number(room.capacity) || criteria.adults || 2,
    beds: Number((room.bed || "1").split(" ")[0]) || 1,
    size: (room.name || "").toLowerCase().includes("suite") ? "48 sqm" : "32 sqm",
    price: Number(room.nightly_price) || price,
    originalPrice: Math.floor((Number(room.nightly_price) || price) * 1.25),
    discount: 20,
    amenities: ["Free WiFi", "Air conditioning", "Private bathroom", room.meal_plan || "Room only"],
    available: Number(room.available_rooms) >= criteria.rooms,
    bookings: Math.max(0, 5 - (Number(room.available_rooms) || 0)),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="relative h-[420px] md:h-[520px] mt-0">
        <img src={img} alt={hotel.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#164880]/85 via-[#164880]/30 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-24 left-6 flex items-center gap-2 text-white bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/25 transition-smooth"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <button
          onClick={handleWishlist}
          className="absolute top-24 right-6 size-10 flex items-center justify-center rounded-full bg-white/95 shadow-card hover:bg-white transition-smooth"
          aria-label={wishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`size-5 ${wishlist ? "fill-red-500 text-red-500" : "text-foreground"}`} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <div className="container mx-auto">
            {hotel.tag && <Badge className="mb-3 bg-accent text-accent-foreground">{hotel.tag}</Badge>}
            <h1 className="font-display text-4xl md:text-5xl mb-2">{hotel.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-white/85 text-sm">
              <span className="flex items-center gap-1"><MapPin className="size-4" /> {hotel.city}, {hotel.area}</span>
              <span className="flex items-center gap-1 bg-success px-2 py-0.5 rounded text-success-foreground font-bold text-xs">
                <Star className="size-3 fill-current" /> {Number(hotel.rating).toFixed(1)}
              </span>
              <span>{Number(hotel.reviews).toLocaleString()} reviews</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <div>
              <h2 className="font-display text-2xl mb-4">About this property</h2>
              <p className="text-muted-foreground leading-relaxed">
                Experience a comfortable stay at {hotel.name} in {hotel.area}, {hotel.city}. This property combines verified rooms,
                transparent pricing, trusted guest reviews, and instant booking confirmation for a smooth trip planning experience.
              </p>
            </div>

            <div>
              <h2 className="font-display text-2xl mb-4">Why guests choose it</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {(viewHotel.highlights || ["Verified stay", "Great location", "Instant confirmation"]).map((item: string) => (
                  <div key={item} className="rounded-xl border border-border bg-card p-4 text-sm font-semibold shadow-card">
                    <CheckCircle2 className="mb-2 size-4 text-success" /> {item}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl mb-4">Amenities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {amenities
                  .filter((item) => (viewHotel.amenities || []).includes(item.id))
                  .map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/60 text-sm font-medium">
                      <Icon className="size-5 text-primary shrink-0" />
                      {label}
                    </div>
                  ))}
              </div>
            </div>

            {roomsLoading && !roomsData ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-40 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <RoomVariants
                rooms={rooms}
                nights={nights}
                onSelectRoom={(room) =>
                  navigate(
                    `/booking?hotelId=${hotel.id}&roomTypeId=${room.id}&hotelName=${encodeURIComponent(hotel.name)}&roomName=${encodeURIComponent(room.name)}&totalPrice=${room.price * nights * criteria.rooms}&checkIn=${criteria.checkIn}&checkOut=${criteria.checkOut}&rooms=${criteria.rooms}&adults=${criteria.adults}`
                  )
                }
              />
            )}

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-2xl mb-4">Booking policies</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <p className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Check-in after 2:00 PM</p>
                <p className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Check-out before 11:00 AM</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Free cancellation on selected rooms</p>
                <p className="flex items-center gap-2"><XCircle className="size-4 text-destructive" /> Government ID required at check-in</p>
              </div>
            </div>

            <GuestReviews
              hotelName={hotel.name}
              reviews={[
                {
                  id: 1,
                  author: "Priya Sharma",
                  rating: 4.8,
                  title: "Outstanding experience",
                  comment: "Clean rooms, helpful staff, and a smooth check-in experience. The location made our trip much easier.",
                  date: "2026-05-18",
                  verified: true,
                  helpful: 245,
                },
                {
                  id: 2,
                  author: "Rajesh Kumar",
                  rating: 4.5,
                  title: "Great value for money",
                  comment: "The room matched the photos and the breakfast spread was good. Would stay again.",
                  date: "2026-05-10",
                  verified: true,
                  helpful: 187,
                },
              ]}
              overallRating={Number(hotel.rating) || 0}
              totalReviews={Number(hotel.reviews)}
            />
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-border bg-card shadow-elegant p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Starting from</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold">Rs. {price.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground line-through">Rs. {Number(hotel.original_price).toLocaleString()}</span>
              </div>
              <p className="text-sm font-semibold text-success mb-5">{off}% off - per night</p>

              <div className="space-y-3 text-sm border-t border-border pt-4 mb-5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span className="font-medium">{criteria.checkIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <span className="font-medium">{criteria.checkOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guests</span>
                  <span className="font-medium">{criteria.adults} adults</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rooms</span>
                  <span className="font-medium">{criteria.rooms}</span>
                </div>
              </div>

              <a href="#rooms">
                <Button className="mb-5 w-full gradient-cta border-0 shadow-cta">Choose a room</Button>
              </a>

              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-2"><CheckCircle2 className="size-3 text-success" /> No booking fees</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="size-3 text-success" /> Instant confirmation</p>
                <p className="flex items-center gap-2"><ShieldCheck className="size-3 text-success" /> Secure payment</p>
                <p className="flex items-center gap-2"><Users className="size-3 text-success" /> Verified guest reviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default HotelDetail;
