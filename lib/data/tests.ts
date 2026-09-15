import type { UsabilityTest } from "@/lib/types";

/**
 * Demo usability tests for the sandbox. Fictional consumer product — "PitStop",
 * a car-repair / service-booking app — chosen to be unrelated to the rest of
 * the demo. Screens are self-contained SVG mockups in /public/demo/tests, so
 * they render offline and need no cloud Storage.
 *
 * These are test *definitions* only. Participant sessions live in Supabase and
 * are never seeded, so the Results page stays empty in the local sandbox.
 */

const IMG = {
  home: "/demo/tests/pitstop-home.svg",
  quote: "/demo/tests/pitstop-quote.svg",
  cardA: "/demo/tests/pitstop-card-a.svg",
  cardB: "/demo/tests/pitstop-card-b.svg",
} as const;

/**
 * The one demo asset that can't be a local mockup: a figma-proto block only
 * accepts a figma.com URL, so demonstrating it needs a genuinely
 * publicly-viewable prototype. This is Figma's own Embed Kit 2.0 example file
 * (a bakery ordering app) — off-narrative from PitStop on purpose, since the
 * alternative was a link that shows a permission wall.
 *
 * Consequences worth knowing before changing it:
 *  - It's Figma's file, not ours. If they unshare or delete it, the demo shows
 *    Figma's permission wall. Swap in a published PitStop prototype when there
 *    is one — that's the intended end state.
 *  - It makes the demo sandbox load figma.com, the only third-party origin the
 *    demo touches, and only after a visitor presses Start on that block. Noted
 *    in docs/data-protection.md.
 */
const FIGMA_PROTO = "https://www.figma.com/proto/nrPSsILSYjesyc5UHjYYa4/Embed-Kit-2-0-examples?node-id=5-3";

const consent = (id: string) =>
  ({
    id,
    type: "message" as const,
    title: "Welcome — thanks for helping out!",
    bodyMd:
      "You'll try a few things in a demo car-service app called PitStop and share your impressions. It takes about 5 minutes, and there are no wrong answers — we're testing the design, not you.",
    isConsentGate: true,
    consentText:
      "This test records your answers, task outcomes, and anonymous interaction data (clicks and screen navigation) to improve the design. No personal data is collected. You can stop any time by closing the tab.",
  });

export const tests: UsabilityTest[] = [
  {
    id: "ut-pitstop-booking",
    projectId: "pr-pitstop",
    name: "Book-a-service flow",
    status: "active",
    shareToken: "demo-pitstop-booking",
    createdById: "u-sanne",
    createdAt: "2026-07-14T09:20:00.000Z",
    blocks: [
      consent("b-bk-consent"),
      {
        id: "b-bk-firstclick",
        type: "first-click",
        instructions: "Your car is due for an oil change. Where would you tap first to book one?",
        description: "This is the PitStop home screen. Just click where you'd start.",
        imageUrl: IMG.home,
        followUpQuestions: [
          { id: "q-bk-fc1", type: "rating", prompt: "How confident were you about where to tap?", scale: 5 },
        ],
      },
      {
        id: "b-bk-task",
        type: "app-task",
        instructions: "Book a brake inspection for your car next week.",
        description: "The app opens in a new tab. Do the task there, then come back and tell us how it went.",
        url: IMG.home,
        previewImageUrl: IMG.home,
        successUrlPattern: "/confirmation*",
        routeScreenshots: [{ pattern: "", imageUrl: IMG.home }],
        followUpQuestions: [
          { id: "q-bk-t1", type: "rating", prompt: "How easy was it to complete the booking?", scale: 5 },
          {
            id: "q-bk-t2",
            type: "choice",
            prompt: "What, if anything, slowed you down?",
            options: ["Finding the right service", "Choosing a garage", "Picking a time slot", "Nothing — it was smooth"],
          },
        ],
      },
      {
        id: "b-bk-questions",
        type: "questions",
        questions: [
          { id: "q-bk-1", type: "yes-no", prompt: "Would you use PitStop to book your next car service?" },
          {
            id: "q-bk-2",
            type: "choice",
            prompt: "Which of these matter most when choosing a garage? (pick up to two)",
            options: ["Price", "Distance", "Ratings & reviews", "Earliest available slot", "Courtesy car"],
            multiple: true,
          },
          { id: "q-bk-3", type: "open", prompt: "What would make booking a service easier for you?" },
        ],
      },
    ],
  },
  {
    id: "ut-pitstop-card",
    projectId: "pr-pitstop",
    name: "Garage card redesign",
    status: "active",
    shareToken: "demo-pitstop-card",
    createdById: "u-tom",
    createdAt: "2026-07-16T13:05:00.000Z",
    blocks: [
      consent("b-cd-consent"),
      {
        id: "b-cd-pref",
        type: "preference",
        instructions: "Which garage card layout do you prefer?",
        description: "Both show the same garage — just laid out differently.",
        options: [
          { id: "opt-a", label: "Layout A — photo first", imageUrl: IMG.cardA },
          { id: "opt-b", label: "Layout B — info first", imageUrl: IMG.cardB },
        ],
        followUpQuestions: [
          { id: "q-cd-p1", type: "open", prompt: "What made you pick that one?" },
        ],
      },
      {
        id: "b-cd-feedback",
        type: "design-feedback",
        instructions: "What's your first impression of this quote screen?",
        description: "Tap the image to see it full size.",
        imageUrl: IMG.quote,
        questions: [
          { id: "q-cd-f1", type: "rating", prompt: "How clear is the price breakdown?", scale: 5 },
          { id: "q-cd-f2", type: "yes-no", prompt: "Would you feel confident confirming this booking?" },
          { id: "q-cd-f3", type: "open", prompt: "Anything you'd add or remove from this screen?" },
        ],
      },
      {
        id: "b-cd-five",
        type: "five-second",
        instructions: "You'll see a screen for 5 seconds. Try to remember what it's for.",
        imageUrl: IMG.home,
        seconds: 5,
        questions: [
          { id: "q-cd-5a", type: "open", prompt: "What do you think this app is for?" },
          {
            id: "q-cd-5b",
            type: "choice",
            prompt: "What was the most prominent action on the screen?",
            options: ["Book a service", "View my car", "Find a garage", "See my bookings"],
          },
        ],
      },
    ],
  },
  {
    id: "ut-pitstop-figma",
    projectId: "pr-pitstop",
    name: "Prototype walkthrough (Figma)",
    status: "active",
    shareToken: "demo-pitstop-figma",
    createdById: "u-tom",
    createdAt: "2026-07-24T10:15:00.000Z",
    blocks: [
      consent("b-fg-consent"),
      {
        id: "b-fg-task",
        type: "figma-proto",
        instructions: "Order a chocolate croissant for pickup tomorrow morning.",
        description: "The prototype opens right here — click through it as you normally would.",
        url: FIGMA_PROTO,
        frame: "phone",
        followUpQuestions: [
          { id: "q-fg-t1", type: "rating", prompt: "How easy was that to do?", scale: 5, required: true },
          {
            id: "q-fg-t2",
            type: "choice",
            prompt: "What, if anything, got in your way?",
            options: ["Finding the item", "Choosing a pickup time", "Understanding the price", "Nothing — it was smooth"],
          },
        ],
      },
      {
        id: "b-fg-explore",
        type: "figma-proto",
        taskType: "explore",
        instructions: "Now have a look around on your own — there's nothing to get right.",
        description: "Open anything that catches your eye.",
        url: FIGMA_PROTO,
        frame: "phone",
        followUpQuestions: [
          { id: "q-fg-e1", type: "open", prompt: "What stood out to you, good or bad?" },
          { id: "q-fg-e2", type: "yes-no", prompt: "Did anything feel like it was missing?" },
        ],
      },
    ],
  },
  {
    id: "ut-pitstop-onboarding",
    projectId: "pr-pitstop",
    name: "Onboarding first impressions",
    status: "draft",
    shareToken: "demo-pitstop-onboarding",
    createdById: "u-sanne",
    createdAt: "2026-07-20T08:40:00.000Z",
    blocks: [
      consent("b-ob-consent"),
      {
        id: "b-ob-five",
        type: "five-second",
        instructions: "Glance at this screen for 5 seconds.",
        imageUrl: IMG.home,
        seconds: 5,
        questions: [
          { id: "q-ob-1", type: "rating", prompt: "How trustworthy did the app feel at a glance?", scale: 5 },
          { id: "q-ob-2", type: "open", prompt: "What three words describe your first impression?" },
        ],
      },
    ],
  },
];
