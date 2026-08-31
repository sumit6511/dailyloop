import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatShareText, type ShareData } from "../../lib/share";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["games", "share", "today"],
    queryFn: () => api.get<ShareData>("/games/share/today"),
    enabled: false,
  });

  const handleShare = async () => {
    const result = data ?? (await refetch()).data;
    if (!result) return;
    const text = formatShareText(result);

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // User canceled or the share sheet failed — fall back to clipboard below.
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="secondary" isLoading={isFetching} onClick={() => void handleShare()}>
      <Icon name={copied ? "check" : "share"} className="text-lg" /> {copied ? "Copied to clipboard!" : "Share Result"}
    </Button>
  );
}
