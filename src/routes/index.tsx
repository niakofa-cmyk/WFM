import { createFileRoute } from "@tanstack/react-router";
import { WarApp } from "@/game/WarApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <WarApp />;
}
