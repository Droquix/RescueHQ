import { NextResponse } from "next/server";
import { chatWithAssistant } from "@/actions/ai";

export async function POST(request: Request) {
  const body = await request.json();
  const message = body.message as string;
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const { response } = await chatWithAssistant(message);
  return NextResponse.json({ response });
}
