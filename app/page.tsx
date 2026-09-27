"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChefHat, Minus, Plus, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { menu, type MenuItem } from "@/lib/menu";

type Cart = Record<string, number>;

type Recommendation = {
  itemId: string;
  needsClarification: boolean;
  source: "jev" | "demo";
};

type WebMcpContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

const categories = ["All", ...new Set(menu.map((item) => item.category))];
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function price(cents: number) {
  return currency.format(cents / 100);
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<Cart>({});
  const [request, setRequest] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [fulfillment, setFulfillment] = useState("pickup");
  const orderReference = useRef(
    `DEMO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  );

  const visibleMenu = useMemo(
    () =>
      activeCategory === "All"
        ? menu
        : menu.filter((item) => item.category === activeCategory),
    [activeCategory],
  );

  const cartItems = useMemo(
    () =>
      menu
        .filter((item) => cart[item.id])
        .map((item) => ({ ...item, quantity: cart[item.id] })),
    [cart],
  );

  const totalCents = cartItems.reduce(
    (total, item) => total + item.priceCents * item.quantity,
    0,
  );
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    const context = (
      document as Document & { modelContext?: WebMcpContext }
    ).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    void Promise.resolve(
      context.registerTool(
        {
          name: "stage_restaurant_order",
          title: "Stage restaurant order",
          description:
            "Replace the visible sample cart with validated menu item quantities and optionally select pickup or delivery. This prepares an order for review; it does not send or place it.",
          inputSchema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    itemId: { type: "string", enum: menu.map((item) => item.id) },
                    quantity: { type: "integer", minimum: 1, maximum: 20 },
                  },
                  required: ["itemId", "quantity"],
                  additionalProperties: false,
                },
              },
              fulfillment: { type: "string", enum: ["pickup", "delivery"] },
            },
            required: ["items"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (!input || typeof input !== "object" || !("items" in input)) {
              throw new Error("A non-empty items array is required.");
            }

            const { items, fulfillment: requestedFulfillment } = input as {
              items: Array<{ itemId: string; quantity: number }>;
              fulfillment?: string;
            };
            if (!Array.isArray(items) || items.length === 0) {
              throw new Error("A non-empty items array is required.");
            }

            const nextCart: Cart = {};
            for (const item of items) {
              const isKnownItem = menu.some((menuItem) => menuItem.id === item.itemId);
              if (!isKnownItem || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
                throw new Error("Every item must use a valid menu ID and a quantity from 1 to 20.");
              }
              nextCart[item.itemId] = item.quantity;
            }

            if (requestedFulfillment && !["pickup", "delivery"].includes(requestedFulfillment)) {
              throw new Error("Fulfillment must be pickup or delivery.");
            }

            setCart(nextCart);
            if (requestedFulfillment) setFulfillment(requestedFulfillment);

            return {
              status: "staged",
              itemCount: Object.values(nextCart).reduce((total, quantity) => total + quantity, 0),
              fulfillment: requestedFulfillment ?? fulfillment,
              requiresCustomerReview: true,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, [fulfillment]);

  function changeQuantity(itemId: string, delta: number) {
    setCart((current) => {
      const nextQuantity = Math.max(0, (current[itemId] ?? 0) + delta);
      const next = { ...current };

      if (nextQuantity === 0) {
        delete next[itemId];
      } else {
        next[itemId] = nextQuantity;
      }

      return next;
    });
  }

  async function findMatch() {
    const trimmedRequest = request.trim();
    if (!trimmedRequest) {
      toast.error("Describe what you feel like eating first.");
      return;
    }

    setIsMatching(true);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: trimmedRequest }),
      });
      const result = (await response.json()) as Recommendation & { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to match the menu right now.");
      }

      setRecommendation(result);
      document.getElementById(`dish-${result.itemId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to match the menu.");
    } finally {
      setIsMatching(false);
    }
  }

  function buildOrderMessage() {
    const lines = cartItems.map(
      (item) => `• ${item.quantity}× ${item.name} — ${price(item.priceCents * item.quantity)}`,
    );

    return [
      "Hello! I would like to confirm this sample order:",
      "",
      ...lines,
      "",
      `Subtotal: ${price(totalCents)}`,
      `Fulfillment: ${fulfillment === "pickup" ? "Pickup" : "Delivery — fee and address to confirm"}`,
      `Reference: ${orderReference.current}`,
      "",
      "Please confirm availability, final total, payment, and estimated time.",
    ].join("\n");
  }

  async function handOffToWhatsApp() {
    if (!itemCount) return;

    const message = buildOrderMessage();
    const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");

    if (!phone) {
      await navigator.clipboard.writeText(message);
      toast.success("Sample order copied. Add the restaurant number to enable WhatsApp.");
      return;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#170d17]/92 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#d8ff4f] text-[#241323]">
              <ChefHat className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-lg leading-none">Table & Taste</p>
              <p className="mt-1 text-xs text-white/55">Sample restaurant</p>
            </div>
          </div>
          <a className="text-sm font-semibold text-[#d8ff4f] hover:text-white" href="#order">
            Order · {itemCount}
          </a>
        </div>
      </header>

      <section className="overflow-hidden bg-[#241323] text-white">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-12 lg:px-8">
          <div className="relative z-10">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d8ff4f]/35 bg-[#d8ff4f]/10 px-3 py-1 text-sm font-medium text-[#d8ff4f]">
              <Sparkles className="size-4" aria-hidden="true" />
              Menu matching powered by Jev
            </p>
            <h1 className="font-display max-w-xl text-4xl leading-[.98] tracking-[-.035em] sm:text-5xl lg:text-6xl">
              What sounds good today?
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/68">
              Tell us your mood, budget, or dietary preference. We’ll find the closest option on this sample menu.
            </p>
            <div className="mt-6 rounded-[1.25rem] bg-white p-2 shadow-2xl shadow-black/20">
              <Textarea
                aria-label="Describe what you want to eat"
                className="min-h-24 resize-none border-0 bg-transparent px-3 py-3 text-base text-[#241323] shadow-none placeholder:text-[#806e7f] focus-visible:ring-0"
                maxLength={500}
                onChange={(event) => setRequest(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") findMatch();
                }}
                placeholder="Something comforting under $20, preferably vegetarian…"
                value={request}
              />
              <Button
                className="h-12 w-full rounded-xl bg-[#d8ff4f] text-base font-bold text-[#241323] hover:bg-[#c9f13c]"
                disabled={isMatching}
                onClick={findMatch}
              >
                {isMatching ? "Matching the menu…" : "Find my dish"}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/45">
              Suggestions use menu facts only. Always confirm allergies with the restaurant.
            </p>
          </div>

          <div className="relative min-h-72 overflow-hidden rounded-[2rem] border border-white/10 md:min-h-[430px]">
            <Image
              alt="A sample restaurant table with three plated meals"
              className="object-cover"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 45vw"
              src="/sample-menu-table.png"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#241323]/55 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 rounded-full bg-[#241323]/85 px-3 py-1.5 text-xs font-medium backdrop-blur">
              Demonstration menu and prices
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-12">
        <section aria-labelledby="menu-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.12em] text-[#ae2d45]">Sample menu</p>
              <h2 className="font-display mt-1 text-3xl tracking-tight" id="menu-heading">
                Pick a favorite
              </h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Menu categories">
              {categories.map((category) => (
                <button
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeCategory === category
                      ? "bg-[#241323] text-white"
                      : "border border-[#d8cfd8] bg-white text-[#5d4a5b] hover:border-[#ae2d45]"
                  }`}
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {recommendation && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#bdda45] bg-[#f5ffd3] p-4 text-[#2b3510]">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#d8ff4f]">
                <Check className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold">Closest menu match highlighted below</p>
                <p className="mt-1 text-sm leading-6 text-[#4e5b24]">
                  {recommendation.needsClarification
                    ? "Your request leaves some room for interpretation, so review the dish details before adding it."
                    : "The match uses your request and the menu descriptions. The restaurant still confirms availability."}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {visibleMenu.map((item) => (
              <MenuCard
                isRecommended={recommendation?.itemId === item.id}
                item={item}
                key={item.id}
                onAdd={() => changeQuantity(item.id, 1)}
                quantity={cart[item.id] ?? 0}
              />
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:h-fit" id="order">
          <div className="overflow-hidden rounded-[1.5rem] border border-[#d8cfd8] bg-white shadow-[0_16px_50px_rgba(58,25,49,.08)]">
            <div className="border-b border-[#eee7ed] px-5 py-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Your order</h2>
                <span className="rounded-full bg-[#f0e9ef] px-3 py-1 text-sm font-bold text-[#624f60]">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#776774]">Review everything before opening WhatsApp.</p>
            </div>

            <div className="px-5 py-5">
              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d8cfd8] bg-[#fcfafc] px-5 py-8 text-center">
                  <ChefHat className="mx-auto size-7 text-[#a997a6]" aria-hidden="true" />
                  <p className="mt-3 font-semibold">Your order is empty</p>
                  <p className="mt-1 text-sm leading-6 text-[#776774]">Add a dish to start your WhatsApp order.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div className="flex items-center gap-3" key={item.id}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{item.name}</p>
                        <p className="mt-0.5 text-sm text-[#776774]">{price(item.priceCents * item.quantity)}</p>
                      </div>
                      <QuantityControl
                        onDecrease={() => changeQuantity(item.id, -1)}
                        onIncrease={() => changeQuantity(item.id, 1)}
                        quantity={item.quantity}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-[#eee7ed] pt-5">
                <p className="mb-3 text-sm font-bold">How do you want it?</p>
                <RadioGroup className="grid grid-cols-2 gap-3" onValueChange={setFulfillment} value={fulfillment}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8cfd8] p-3 text-sm font-semibold has-[[data-state=checked]]:border-[#ae2d45] has-[[data-state=checked]]:bg-[#fff1f3]">
                    <RadioGroupItem value="pickup" /> Pickup
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8cfd8] p-3 text-sm font-semibold has-[[data-state=checked]]:border-[#ae2d45] has-[[data-state=checked]]:bg-[#fff1f3]">
                    <RadioGroupItem value="delivery" /> Delivery
                  </label>
                </RadioGroup>
                {fulfillment === "delivery" && (
                  <p className="mt-2 text-xs leading-5 text-[#776774]">The restaurant confirms the delivery area, address, and fee in WhatsApp.</p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#eee7ed] pt-5">
                <div>
                  <p className="text-sm text-[#776774]">Menu subtotal</p>
                  <p className="text-xs text-[#a08f9d]">Delivery fee not included</p>
                </div>
                <p className="font-display text-2xl">{price(totalCents)}</p>
              </div>

              <Button
                className="mt-5 h-13 w-full rounded-xl bg-[#1e8e55] text-base font-bold text-white hover:bg-[#167847]"
                disabled={!itemCount}
                onClick={handOffToWhatsApp}
              >
                <Send className="size-4" aria-hidden="true" />
                {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ? "Open WhatsApp" : "Copy sample order"}
              </Button>
              <p className="mt-3 text-center text-xs leading-5 text-[#776774]">
                This does not place an order. It is accepted only after the restaurant replies.
              </p>
            </div>
          </div>
        </aside>
      </div>
      <Toaster position="bottom-center" richColors />
    </main>
  );
}

function MenuCard({
  item,
  quantity,
  isRecommended,
  onAdd,
}: {
  item: MenuItem;
  quantity: number;
  isRecommended: boolean;
  onAdd: () => void;
}) {
  return (
    <article
      className={`relative flex min-h-64 flex-col rounded-[1.35rem] border bg-white p-5 transition ${
        isRecommended
          ? "border-[#ae2d45] shadow-[0_0_0_3px_rgba(174,45,69,.12)]"
          : "border-[#e6dde5] hover:-translate-y-0.5 hover:border-[#c8bac5] hover:shadow-lg"
      }`}
      id={`dish-${item.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.11em] text-[#ae2d45]">{item.category}</p>
          <h3 className="font-display mt-2 text-2xl leading-tight">{item.name}</h3>
        </div>
        {isRecommended && (
          <span className="shrink-0 rounded-full bg-[#d8ff4f] px-2.5 py-1 text-xs font-bold text-[#2b3510]">Best match</span>
        )}
      </div>
      <p className="mt-3 flex-1 text-sm leading-6 text-[#776774]">{item.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <span className="rounded-full bg-[#f5eff4] px-2.5 py-1 text-xs font-medium text-[#6b5768]" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="font-display text-xl">{price(item.priceCents)}</p>
        <Button className="rounded-full bg-[#241323] px-4 text-white hover:bg-[#ae2d45]" onClick={onAdd} size="sm">
          <Plus className="size-4" aria-hidden="true" />
          {quantity ? `Add another · ${quantity}` : "Add"}
        </Button>
      </div>
    </article>
  );
}

function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center rounded-full border border-[#d8cfd8] bg-white">
      <button aria-label="Decrease quantity" className="grid size-9 place-items-center rounded-full hover:bg-[#f5eff4]" onClick={onDecrease} type="button">
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-6 text-center text-sm font-bold" aria-label={`Quantity ${quantity}`}>
        {quantity}
      </span>
      <button aria-label="Increase quantity" className="grid size-9 place-items-center rounded-full hover:bg-[#f5eff4]" onClick={onIncrease} type="button">
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
