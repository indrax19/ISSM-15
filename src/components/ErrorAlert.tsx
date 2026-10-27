import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: "default" | "destructive";
}

const ErrorAlert = memo(function ErrorAlert({
  title = "Error",
  message,
  onRetry,
  variant = "destructive",
}: ErrorAlertProps) {
  const isBg = variant === "destructive" ? "bg-destructive/5" : "bg-muted";
  const isBorder = variant === "destructive" ? "border-destructive" : "border-muted";
  const isText = variant === "destructive" ? "text-destructive" : "text-foreground";

  return (
    <Card className={`border ${isBorder} ${isBg}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isText}`} />
          <div className="flex-1">
            <p className={`font-semibold ${isText}`}>{title}</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-3 gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ErrorAlert;
