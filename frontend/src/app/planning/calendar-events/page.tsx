import { EventManagementPage } from "@/components/events/event-management-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    event?: string | string[];
    year?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const eventId = Array.isArray(params.event) ? params.event[0] : params.event;
  const yearValue = Array.isArray(params.year) ? params.year[0] : params.year;
  const year = yearValue ? Number(yearValue) : undefined;
  return (
    <EventManagementPage
      key={`${yearValue ?? "current"}-${eventId ?? "calendar"}`}
      initialEventId={eventId ?? null}
      initialYear={Number.isInteger(year) ? year : undefined}
    />
  );
}
