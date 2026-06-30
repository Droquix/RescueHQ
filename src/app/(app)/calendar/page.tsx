import { getScheduleBlocks } from "@/actions/ai";
import { autoScheduleAction } from "@/actions/tasks";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const blocks = await getScheduleBlocks();

  return (
    <CalendarView
      blocks={blocks}
      autoScheduleAction={autoScheduleAction}
    />
  );
}
