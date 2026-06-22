import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BedDouble, Coffee, Heart, MapPin, Star, Waves, Wifi } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchHotels, LIVE_REFETCH_MS, type Hotel, type SearchCriteria } from "@/lib/api";
import { fallbackHotels, filterFallbackHotels, getHotelImage } from "@/lib/fallbackData";
import { FilterState } from "./FilterSidebar";
import { SortOption } from "./SortBar";

type PopularHotelsProps = {
  criteria: SearchCriteria;
  filters?: FilterState;
  sortBy?: SortOption;
};

type HotelCard = Hotel & {
  img?: string;
  amenities?: string[];
  type?: string;
};

const PopularHotels = ({ criteria, filters, sortBy = "popular" }: PopularHotelsProps) => {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["hotels", criteria],
    queryFn: () => fetchHotels(criteria),
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const hotels = useMemo(
    () =>
      (data?.hotels?.length ? data.hotels : filterFallbackHotels(criteria)).map((hotel: HotelCard) => {
        const local = fallbackHotels.find((item) => item.name === hotel.name || item.id === hotel.id);
        return {
          ...hotel,
          img: hotel.img || local?.img || getHotelImage(hotel.name),
          amenities: hotel.amenities || local?.amenities || [],
          type: hotel.type || local?.type || "Mid-Range",
        };
      }),
    [criteria, data]
  );

  const filteredAndSorted = useMemo(() => {
    let filtered = hotels;

    if (filters) {
      filtered = filtered.filter((h) => {
        const price = Number(h.live_price || h.price);
        const rating = Number(h.rating);

        if (price < filters.priceRange[0] || price > filters.priceRange[1]) return false;

        if (filters.ratings.length > 0 && !filters.ratings.some((r) => rating >= r)) {
          return false;
        }

        if (filters.amenities.length > 0) {
          const amenities = h.amenities || [];
          if (!filters.amenities.every((amenity) => amenities.includes(amenity))) return false;
        }

        if (filters.hotelType.length > 0 && !filters.hotelType.includes(h.type || "")) {
          return false;
        }

        return true;
      });
    }

    return [...filtered].sort((a, b) => {
      const priceA = Number(a.live_price || a.price);
      const priceB = Number(b.live_price || b.price);
      const ratingA = Number(a.rating);
      const ratingB = Number(b.rating);
      const reviewsA = Number(a.reviews);
      const reviewsB = Number(b.reviews);

      switch (sortBy) {
        case "price-low":
          return priceA - priceB;
        case "price-high":
          return priceB - priceA;
        case "rating":
          return ratingB - ratingA;
        case "newest":
          return b.id - a.id;
        case "popular":
        default:
          return reviewsB - reviewsA;
      }
    });
  }, [hotels, filters, sortBy]);

  const openHotel = (hotel: HotelCard) => {
    navigate(
      `/hotel/${hotel.id}?city=${encodeURIComponent(criteria.city || hotel.city)}&checkIn=${criteria.checkIn}&checkOut=${criteria.checkOut}&adults=${criteria.adults}&rooms=${criteria.rooms}`,
      { state: { hotel } },
    );
  };

  return (
    <section id="hotels">
      <div className="space-y-6">
        {filteredAndSorted.length > 0 ? (
          filteredAndSorted.map((h) => {
            const price = Number(h.live_price || h.price);
            const off = Math.max(0, Math.round(((Number(h.original_price) - price) / Number(h.original_price)) * 100));

            return (
              <article
                key={h.id}
                className="overflow-hidden rounded-2xl bg-card border border-border shadow-card transition-smooth hover:shadow-elegant group"
              >
                <div className="grid md:grid-cols-[280px_1fr] gap-0">
                  <button
                    type="button"
                    onClick={() => openHotel(h)}
                    className="relative h-64 md:h-auto overflow-hidden text-left"
                    aria-label={`View rooms at ${h.name}`}
                  >
                    <img
                      src={h.img}
                      alt={h.name}
                      loading="lazy"
                      width={800}
                      height={600}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded-xl bg-accent/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground shadow-cta">
                      {h.tag}
                    </span>
                    <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/95 shadow-card transition-smooth hover:bg-white">
                      <Heart className="size-4 text-foreground" />
                    </span>
                  </button>

                  <div className="p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="font-display text-2xl font-semibold text-foreground leading-tight">
                            {h.name}
                          </h3>
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="size-3" /> {h.city}, {h.area}
                          </p>
                        </div>
                        <span className="flex items-center gap-1 rounded-lg bg-success/20 text-success px-2.5 py-1 text-xs font-bold whitespace-nowrap">
                          <Star className="size-3 fill-current" /> {Number(h.rating).toFixed(1)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-muted-foreground">
                        <Wifi className="size-4" />
                        <Waves className="size-4" />
                        <Coffee className="size-4" />
                        <span className="flex items-center gap-1 text-xs">
                          <BedDouble className="size-4" /> {h.room_type_count || 3} room types
                        </span>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {h.type}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-3xl font-bold text-foreground">
                            Rs. {price.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-through">
                          Rs. {Number(h.original_price).toLocaleString()}
                        </p>
                        <span className="text-xs font-semibold text-success mt-1 block">{off}% off - lowest live nightly rate</span>
                      </div>
                      <Button
                        type="button"
                        className="rounded-xl gradient-cta border-0 shadow-cta"
                        onClick={() => openHotel(h)}
                      >
                        View rooms
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">No hotels found matching your filters.</p>
            <Button onClick={() => window.location.reload()}>Reset Filters</Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularHotels;
