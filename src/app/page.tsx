import { loadCustomerView, searchCustomers } from "@/lib/timeline";
import AppBar from "@/components/AppBar";
import PageShell from "@/components/PageShell";
import CustomerProfile from "@/components/CustomerProfile";
import CustomerResultsList from "@/components/CustomerResultsList";
import Timeline from "@/components/Timeline";
import TimelineFilter, { TimelineFilterValue } from "@/components/TimelineFilter";
import EmptyState from "@/components/EmptyState";
import NotFoundState from "@/components/NotFoundState";

type SearchParams = Promise<{ q?: string; filter?: string; customerId?: string }>;

function parseFilter(raw: string | undefined): TimelineFilterValue {
  return raw === "orders" || raw === "bookings" ? raw : "all";
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, filter, customerId } = await searchParams;
  const trimmed = q?.trim() ?? "";
  const active = parseFilter(filter);
  const appBar = <AppBar initialQuery={trimmed} />;

  if (customerId) {
    const view = await loadCustomerView(customerId);
    if (!view) {
      return <PageShell appBar={appBar} main={<NotFoundState query={customerId} />} />;
    }
    return (
      <PageShell
        appBar={appBar}
        sidebar={
          <CustomerProfile
            customer={view.customer}
            signals={view.signals}
            events={view.events}
          />
        }
        main={
          <>
            <TimelineFilter active={active} />
            <Timeline events={view.events} filter={active} />
          </>
        }
      />
    );
  }

  if (!trimmed) {
    return <PageShell appBar={appBar} main={<EmptyState />} />;
  }

  const result = await searchCustomers(trimmed);
  if (result.kind === "none") {
    return <PageShell appBar={appBar} main={<NotFoundState query={trimmed} />} />;
  }
  return (
    <PageShell
      appBar={appBar}
      main={<CustomerResultsList query={trimmed} results={result.results} />}
    />
  );
}
