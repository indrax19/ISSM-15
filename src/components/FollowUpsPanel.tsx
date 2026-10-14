import { FollowUp } from "@/integrations/firebase/complaintsAPI";
import { formatInTimeZone } from "date-fns-tz";

interface FollowUpsPanelProps {
  followUps?: FollowUp[];
}

const PAKISTAN_TIMEZONE = "Asia/Karachi";

const formatTimestamp = (timestamp: string): string => {
  return formatInTimeZone(new Date(timestamp), PAKISTAN_TIMEZONE, "MMM dd, yyyy HH:mm");
};

export default function FollowUpsPanel({ followUps }: FollowUpsPanelProps) {
  if (!followUps || followUps.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Follow-ups</p>
      {followUps.map((followUp, index) => (
        <div key={index} className="pl-4 border-l-2 border-blue-400 bg-blue-50 p-3 rounded">
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-2">
            {followUp.description}
          </p>
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-600">
              {followUp.addedByName || followUp.addedBy || "Unknown"}
            </span>
            {" · "}
            {formatTimestamp(followUp.timestamp)}
          </p>
        </div>
      ))}
    </div>
  );
}
