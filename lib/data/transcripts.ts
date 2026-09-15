import type { Transcript } from "@/lib/types";

/**
 * Highlight offsets are recomputed from `text` at render time (indexOf within
 * the segment), so start/end here are indicative only.
 */
export const transcripts: Transcript[] = [
  {
    id: "tr-lukas",
    interviewId: "iv-lukas-1",
    language: "English (translated from German)",
    segments: [
      { id: "s-l1", speaker: "Sanne", speakerRole: "researcher", startSeconds: 12, text: "Thanks for letting me ride along today, Lukas. Can you walk me through what happens when a work order comes in?" },
      { id: "s-l2", speaker: "Lukas", speakerRole: "participant", startSeconds: 28, text: "Sure. I get a notification on the phone, open Meridian Go, and there's the work order. The problem starts when I have to climb the turbine. It takes ten, fifteen minutes to get up top." },
      { id: "s-l3", speaker: "Sanne", speakerRole: "researcher", startSeconds: 62, text: "And what happens to the app during that climb?" },
      { id: "s-l4", speaker: "Lukas", speakerRole: "participant", startSeconds: 70, text: "By the time I've climbed up, the app has logged me out and I've lost the work order I opened. So I have to log in again, find it again, up there in the wind. It's frustrating." },
      { id: "s-l5", speaker: "Sanne", speakerRole: "researcher", startSeconds: 130, text: "How do you deal with finding the right asset once you're up there?" },
      { id: "s-l6", speaker: "Lukas", speakerRole: "participant", startSeconds: 140, text: "Honestly? I take a photo of the nameplate because searching for the asset takes longer than the repair itself. The search wants an exact code and I don't have it memorized for every gearbox." },
      { id: "s-l7", speaker: "Sanne", speakerRole: "researcher", startSeconds: 210, text: "Let's talk about saving your work. When you enter findings, how confident are you that it's recorded?" },
      { id: "s-l8", speaker: "Lukas", speakerRole: "participant", startSeconds: 224, text: "Not confident at all. I never really know if my update actually saved when the signal is weak. So I screenshot everything before I hit save, just in case it disappears." },
      { id: "s-l9", speaker: "Sanne", speakerRole: "researcher", startSeconds: 300, text: "If the app worked completely offline and synced later, would that change things for you?" },
      { id: "s-l10", speaker: "Lukas", speakerRole: "participant", startSeconds: 312, text: "That would be huge. As long as I can see clearly that it will sync, and it doesn't just vanish. The uncertainty is the worst part, more than the waiting." },
    ],
    highlights: [
      { id: "hl-l1", transcriptId: "tr-lukas", segmentId: "s-l4", start: 0, end: 62, text: "By the time I've climbed up, the app has logged me out and I've lost the work order I opened.", kind: "pain-point", note: "Session timeout during climb", tagIds: ["tag-mobile-experience", "tag-performance"], createdById: "u-sanne", linkedInsightId: "in-offline-sync" },
      { id: "hl-l2", transcriptId: "tr-lukas", segmentId: "s-l6", start: 0, end: 80, text: "I take a photo of the nameplate because searching for the asset takes longer than the repair itself", kind: "pain-point", note: "Asset search slower than repair", tagIds: ["tag-search"], createdById: "u-sanne", linkedInsightId: "in-search-global" },
      { id: "hl-l3", transcriptId: "tr-lukas", segmentId: "s-l8", start: 0, end: 70, text: "I never really know if my update actually saved when the signal is weak", kind: "insight", note: "Sync distrust → screenshot workaround", tagIds: ["tag-mobile-experience"], createdById: "u-sanne", linkedInsightId: "in-mobile-offline-trust" },
      { id: "hl-l4", transcriptId: "tr-lukas", segmentId: "s-l10", start: 0, end: 40, text: "That would be huge. As long as I can see clearly that it will sync", kind: "opportunity", note: "Offline-first with visible sync state", tagIds: ["tag-mobile-experience"], createdById: "u-sanne" },
    ],
    comments: [
      { id: "cm-l1", segmentId: "s-l4", authorId: "u-julia", text: "This is the moment to prototype — persistent session + resume-where-you-were.", date: "2026-06-19" },
      { id: "cm-l2", segmentId: "s-l8", authorId: "u-marco", text: "The screenshot workaround shows up in 3 other interviews too. Strong signal.", date: "2026-06-20" },
    ],
  },
  {
    id: "tr-fatima",
    interviewId: "iv-fatima-1",
    language: "English (translated from Dutch)",
    segments: [
      { id: "s-f1", speaker: "Tom", speakerRole: "researcher", startSeconds: 20, text: "Walk me through a normal Monday morning on the scheduling board." },
      { id: "s-f2", speaker: "Fatima", speakerRole: "participant", startSeconds: 34, text: "I open the board and it's already full from the weekend. I filter to my area, my week, my technicians — and I do that every single morning from scratch." },
      { id: "s-f3", speaker: "Tom", speakerRole: "researcher", startSeconds: 90, text: "Every morning from scratch? The filters don't persist?" },
      { id: "s-f4", speaker: "Fatima", speakerRole: "participant", startSeconds: 98, text: "No. I rebuild the same filter every morning because it never remembers what I was looking at. Small thing, but it's five minutes of clicking before I even start." },
      { id: "s-f5", speaker: "Tom", speakerRole: "researcher", startSeconds: 160, text: "Now, what happens when something unplanned comes in — a breakdown?" },
      { id: "s-f6", speaker: "Fatima", speakerRole: "participant", startSeconds: 172, text: "That's the real pain. One machine breakdown and I'm dragging thirty jobs around the board by hand for the rest of the morning. Everything downstream shifts, and I have to check each technician's capacity manually." },
      { id: "s-f7", speaker: "Tom", speakerRole: "researcher", startSeconds: 250, text: "If you could wave a wand, what would help most in that moment?" },
      { id: "s-f8", speaker: "Fatima", speakerRole: "participant", startSeconds: 262, text: "If the system could propose a new plan and I just approve it, that's an hour back every single day. I don't need it to be perfect — I need a starting point I can adjust." },
      { id: "s-f9", speaker: "Tom", speakerRole: "researcher", startSeconds: 330, text: "So you'd want to stay in control of the final decision." },
      { id: "s-f10", speaker: "Fatima", speakerRole: "participant", startSeconds: 338, text: "Absolutely. Suggest, don't decide. But suggesting would already save me most of the manual dragging." },
    ],
    highlights: [
      { id: "hl-f1", transcriptId: "tr-fatima", segmentId: "s-f4", start: 0, end: 70, text: "I rebuild the same filter every morning because it never remembers what I was looking at", kind: "pain-point", note: "Filters don't persist", tagIds: ["tag-planning", "tag-usability"], createdById: "u-tom", linkedInsightId: "in-search-recent" },
      { id: "hl-f2", transcriptId: "tr-fatima", segmentId: "s-f6", start: 0, end: 90, text: "One machine breakdown and I'm dragging thirty jobs around the board by hand for the rest of the morning", kind: "pain-point", note: "Rescheduling cascade", tagIds: ["tag-planning", "tag-work-orders"], createdById: "u-tom", linkedInsightId: "in-plan-replan-cost" },
      { id: "hl-f3", transcriptId: "tr-fatima", segmentId: "s-f8", start: 0, end: 80, text: "If the system could propose a new plan and I just approve it, that's an hour back every single day", kind: "opportunity", note: "Approve-a-replan AI concept", tagIds: ["tag-planning", "tag-ai"], createdById: "u-tom", linkedInsightId: "in-plan-ai-opt" },
    ],
    comments: [
      { id: "cm-f1", segmentId: "s-f8", authorId: "u-lena", text: "This is the north-star for the AI planning concept. Let's storyboard it.", date: "2026-06-26" },
    ],
  },
];
