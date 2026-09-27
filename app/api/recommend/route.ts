import { NextResponse } from "next/server";

import { menu } from "@/lib/menu";

const TYPESAFE_API_URL = process.env.TYPESAFE_API_URL ?? "https://api.typesafe.ai/v1/systemone";

function fallbackRecommendation(request: string) {
  const terms = request.toLowerCase();
  const scores = menu.map((item) => {
    const searchable = `${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
    const score = terms
      .split(/\W+/)
      .filter((term) => term.length > 2)
      .reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), 0);
    return { id: item.id, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.id ?? menu[0].id;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const customerRequest =
    typeof body === "object" && body !== null && "request" in body
      ? String(body.request).trim()
      : "";

  if (!customerRequest || customerRequest.length > 500) {
    return NextResponse.json(
      { error: "Describe what you want in 1 to 500 characters." },
      { status: 400 },
    );
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      itemId: fallbackRecommendation(customerRequest),
      needsClarification: true,
      source: "demo",
    });
  }

  const state = {
    customer_request: customerRequest,
    menu: menu.map(({ id, name, description, priceCents, tags }) => ({
      id,
      name,
      description,
      price: priceCents / 100,
      tags,
    })),
  };

  try {
    const response = await fetch(TYPESAFE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jev-1.13.0",
        state,
        questions: {
          best_match: {
            type: "choice",
            instructions:
              "Choose the one menu item that best satisfies the customer's stated preferences. Treat price limits and dietary restrictions as hard constraints. Do not infer missing allergy information.",
            criteria: Object.fromEntries(
              menu.map((item) => [
                item.id,
                `${item.name}: ${item.description} Price ${item.priceCents / 100}. Tags: ${item.tags.join(", ")}.`,
              ]),
            ),
          },
          needs_clarification: {
            type: "noul",
            instructions:
              "The customer request is too ambiguous or lacks information needed to recommend one menu item safely.",
          },
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The menu matching service is temporarily unavailable." },
        { status: 502 },
      );
    }

    const result = (await response.json()) as {
      answers?: {
        best_match?: { choice?: string };
        needs_clarification?: { noul?: number };
      };
    };
    const itemId = result.answers?.best_match?.choice;

    if (!itemId || !menu.some((item) => item.id === itemId)) {
      return NextResponse.json(
        { error: "The menu matching service returned an invalid item." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      itemId,
      needsClarification: (result.answers?.needs_clarification?.noul ?? 1) >= 0.5,
      source: "jev",
    });
  } catch {
    return NextResponse.json(
      { error: "The menu matching service did not respond in time." },
      { status: 504 },
    );
  }
}
