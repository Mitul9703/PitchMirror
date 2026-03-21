import { notFound } from "next/navigation";
import { SessionRoom } from "@/components/session-room";
import { hasAgent } from "@/lib/agents";

export default function SessionPage({ params }) {
  if (!hasAgent(params.agentId)) {
    notFound();
  }

  return <SessionRoom agentId={params.agentId} />;
}
