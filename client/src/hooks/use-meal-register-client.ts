import { useEffect, useState } from "react";
import { useClientNames, useCurrentUser } from "@/hooks/use-reports";

export function useMealRegisterClient() {
  const { data: user } = useCurrentUser();
  const { data: clients = [], isLoading: clientsLoading } = useClientNames();
  const [selectedClient, setSelectedClient] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("clientName") || "",
  );

  useEffect(() => {
    if (user && user.role !== "admin") setSelectedClient(user.clientName || "");
  }, [user?.id, user?.role, user?.clientName]);

  return {
    user,
    clients,
    clientsLoading,
    selectedClient,
    setSelectedClient,
    canSelectClient: user?.role === "admin",
    hasClientAssignment: user?.role === "admin" || !!user?.clientName,
  };
}
