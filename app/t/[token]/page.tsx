import type { Metadata } from "next";
import { TestRunner } from "./runner";

export const metadata: Metadata = {
  title: "Usability test",
  robots: { index: false, follow: false }, // tokenized links must never be indexed
};

export default async function ParticipantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TestRunner token={token} />;
}
