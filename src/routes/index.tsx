import { createFileRoute } from "@tanstack/react-router";
import { VesperStage } from "@/components/vesper-stage";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <VesperStage />;
}
