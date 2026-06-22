import { Star, ThumbsUp, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type Review = {
  id: number;
  author: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verified: boolean;
  helpful: number;
};

type GuestReviewsProps = {
  hotelName: string;
  overallRating: number;
  totalReviews: number;
  reviews: Review[];
};

const ratingLabels = {
  5: "Excellent",
  4: "Very Good",
  3: "Good",
  2: "Fair",
  1: "Poor",
};

const getReviewColor = (rating: number): string => {
  if (rating >= 4.5) return "bg-success";
  if (rating >= 3.5) return "bg-yellow-500";
  if (rating >= 2.5) return "bg-orange-500";
  return "bg-destructive";
};

const getRatingDistribution = (reviews: Review[]) => {
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    distribution[r.rating as keyof typeof distribution]++;
  });
  return distribution;
};

const GuestReviews = ({
  hotelName,
  overallRating,
  totalReviews,
  reviews,
}: GuestReviewsProps) => {
  const safeRating = Number.isFinite(overallRating) ? overallRating : 0;
  const safeTotalReviews = Number.isFinite(totalReviews) ? totalReviews : 0;
  const distribution = getRatingDistribution(reviews);
  const maxCount = Math.max(...Object.values(distribution));

  return (
    <section className="py-12">
      <h2 className="font-display text-3xl font-semibold text-foreground dark:text-white mb-8">
        Guest Reviews & Ratings
      </h2>

      {/* Rating Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {/* Overall Rating */}
        <div className="bg-card dark:bg-card/80 rounded-2xl p-8 border border-border dark:border-white/10 shadow-card">
          <div className="text-center">
            <div className={`inline-flex items-center justify-center size-20 rounded-full ${getReviewColor(safeRating)} text-white mb-4`}>
              <span className="text-4xl font-bold">{safeRating.toFixed(1)}</span>
            </div>
            <p className="text-xl font-semibold text-foreground dark:text-white">
              {ratingLabels[Math.round(safeRating) as keyof typeof ratingLabels] || "Not rated"}
            </p>
            <p className="text-sm text-muted-foreground dark:text-white/60 mt-2">
              Based on {safeTotalReviews.toLocaleString()} verified reviews
            </p>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="bg-card dark:bg-card/80 rounded-2xl p-8 border border-border dark:border-white/10 shadow-card md:col-span-2">
          <h3 className="font-semibold text-foreground dark:text-white mb-6">Rating Distribution</h3>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <Star className="size-4 fill-accent text-accent" />
                  <span className="text-sm font-semibold text-foreground dark:text-white">
                    {rating}
                  </span>
                </div>
                <div className="flex-1 h-2 bg-muted dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{
                      width: `${maxCount > 0 ? (distribution[rating as keyof typeof distribution] / maxCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground dark:text-white/60 w-12">
                  {distribution[rating as keyof typeof distribution]}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground dark:text-white text-lg mb-6">
          Recent Guest Reviews
        </h3>
        {reviews.length > 0 ? (
          reviews.slice(0, 5).map((review) => (
            <div
              key={review.id}
              className="bg-card dark:bg-card/80 rounded-xl p-6 border border-border dark:border-white/10 hover:shadow-card transition-smooth"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground dark:text-white">
                      {review.author}
                    </span>
                    {review.verified && (
                      <Badge variant="secondary" className="bg-success/20 text-success text-xs">
                        Verified Guest
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-white/60">
                    {review.date}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`size-4 ${
                        i < review.rating
                          ? "fill-accent text-accent"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <h4 className="font-semibold text-foreground dark:text-white mb-2">
                {review.title}
              </h4>
              <p className="text-sm text-muted-foreground dark:text-white/70 mb-4">
                {review.comment}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-primary hover:bg-primary/10"
              >
                <ThumbsUp className="size-4" />
                Helpful ({review.helpful})
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground dark:text-white/60">
            No reviews yet. Be the first to review this hotel!
          </div>
        )}
      </div>
    </section>
  );
};

export default GuestReviews;
