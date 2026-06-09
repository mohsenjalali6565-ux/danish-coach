import { notFound } from "next/navigation";
import { curriculum } from "@/app/data/curriculum";
import DayLesson from "@/app/components/DayLesson";

export default async function DayPage({
  params,
}: {
  params: Promise<{ dayNumber: string }>;
}) {
  const { dayNumber } = await params;
  const num = parseInt(dayNumber);
  const day = curriculum.find((d) => d.dayNumber === num);

  if (!day) notFound();

  return <DayLesson day={day} />;
}
