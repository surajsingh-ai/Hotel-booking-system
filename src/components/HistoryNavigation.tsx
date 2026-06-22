import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const HistoryNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, [location.key]);

  return (
    <div className="fixed bottom-5 left-5 z-[70] flex items-center gap-2 rounded-full border border-border/80 bg-background/95 p-1.5 shadow-elegant backdrop-blur">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-10 rounded-full"
            onClick={() => navigate(-1)}
            disabled={!canGoBack}
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Back</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-10 rounded-full"
            onClick={() => navigate(1)}
            aria-label="Go forward"
          >
            <ArrowRight className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Forward</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default HistoryNavigation;
