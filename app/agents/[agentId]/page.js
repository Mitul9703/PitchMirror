import { notFound } from "next/navigation";
import { AgentDetailPage } from "@/components/agent-detail-page";
import { hasAgent } from "@/lib/agents";

export default function AgentPage({ params }) {
  if (!hasAgent(params.agentId)) {
    notFound();
  }

  return <AgentDetailPage agentId={params.agentId} />;
}
