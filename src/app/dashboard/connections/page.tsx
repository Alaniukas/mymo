"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  SocialConnectCard,
  type ConnectPlatform,
} from "@/components/dashboard/social-connect-card";
import { useActiveProject } from "@/components/dashboard/project-provider";
import { NoProjectNotice } from "@/components/dashboard/no-project";

const PLATFORMS: ConnectPlatform[] = [
  "linkedin",
  "linkedin_pages",
  "instagram",
  "facebook",
  "tiktok",
  "x",
];

const PLATFORM_LABELS: Record<ConnectPlatform, string> = {
  linkedin: "LinkedIn",
  linkedin_pages: "LinkedIn Page",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
};

interface Connection {
  id: string;
  platform: ConnectPlatform;
  platform_username: string | null;
}

function ConnectionsContent() {
  const searchParams = useSearchParams();
  const { activeProjectId } = useActiveProject();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadConnections = useCallback(async () => {
    if (!activeProjectId) return;
    const supabase = createClient();

    const { data } = await supabase
      .from("social_connections")
      .select("id, platform, platform_username")
      .eq("workspace_id", activeProjectId);

    setConnections(
      (data ?? []).map((c) => ({
        id: c.id,
        platform: c.platform as ConnectPlatform,
        platform_username: c.platform_username,
      })),
    );
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    const successPlatform = searchParams.get("success");
    const errorMsg = searchParams.get("error");

    if (successPlatform) {
      const label =
        PLATFORM_LABELS[successPlatform as ConnectPlatform] ?? successPlatform;
      setMessage({ type: "success", text: `Successfully connected ${label}!` });
    } else if (errorMsg) {
      setMessage({ type: "error", text: errorMsg });
    }

    loadConnections();
  }, [loadConnections, searchParams]);

  function handleConnect(platform: ConnectPlatform) {
    setActionLoading(platform);
    window.location.href = `/api/auth/woopsocial?platform=${platform}`;
  }

  async function handleDisconnect(platform: ConnectPlatform) {
    const conn = connections.find((c) => c.platform === platform);
    if (!conn) return;

    setActionLoading(platform);

    const supabase = createClient();
    await supabase.from("social_connections").delete().eq("id", conn.id);

    setConnections((prev) => prev.filter((c) => c.id !== conn.id));
    setActionLoading(null);
    setMessage({
      type: "success",
      text: `Disconnected ${PLATFORM_LABELS[platform]}`,
    });
  }

  if (!activeProjectId) {
    return <NoProjectNotice />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
        <p className="text-[#666] mt-1">
          Connect your social accounts to publish carousels directly.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLATFORMS.map((p) => {
          const conn = connections.find((c) => c.platform === p);
          return (
            <SocialConnectCard
              key={p}
              platform={p}
              connected={!!conn}
              username={conn?.platform_username}
              onConnect={() => handleConnect(p)}
              onDisconnect={() => handleDisconnect(p)}
              loading={actionLoading === p}
            />
          );
        })}
      </div>

      <div className="bg-white border-2 border-black rounded-xl p-5 shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-5 h-5 text-[var(--ember)]" />
          <h2 className="font-semibold">How connecting works</h2>
        </div>
        <div className="space-y-2 text-sm text-[#666]">
          <p>
            Accounts connect securely through WoopSocial — there are no developer
            apps, API keys, or app-review steps to set up on your end.
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Click <span className="font-medium text-black">Connect</span> and authorize the account in the popup.</li>
            <li>Once connected, open any finished carousel and hit Publish.</li>
            <li>Instagram requires a Business or Creator account; LinkedIn supports both personal profiles and company Pages.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--ember)]" />
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}
