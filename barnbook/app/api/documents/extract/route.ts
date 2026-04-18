import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerComponentClient } from "@/lib/supabase-server";
import { createAnthropicClient } from "@/lib/anthropic-client";
import { getClaudeVisionModel } from "@/lib/anthropic-config";
import {
  EXTRACTION_PROMPT,
  EXTRACTION_PROMPT_VERSION,
  type ExtractedHorseData,
} from "@/lib/document-extraction-prompt";
import { canUserUseDocumentScanner } from "@/lib/document-scanner/access";
import {
  matchExtractedHorse,
  type MatchResult,
} from "@/lib/document-scanner/horse-matcher";
import { checkRateLimit, logApiCall } from "@/lib/rate-limit";
import { canUserAccessHorse } from "@/lib/horse-access";

export const runtime = "nodejs";
export const maxDuration = 30;

// Next.js route segment config — allow up to 15 MB of base64 image per request.
export const dynamic = "force-dynamic";

const ENDPOINT = "documents/extract";
const RATE_LIMITS = { hour: 20, day: 100 };
const MAX_OUTPUT_TOKENS = 1500;
const MAX_BODY_BYTES = 15 * 1024 * 1024;

interface ExtractRequestBody {
  image_base64: string;
  mime_type: string;
  barn_id: string;
  horse_id?: string;
}

// Anthropic vision accepts these as base64 source media types.
const VISION_MIME_TYPES = new Set<Anthropic.Base64ImageSource["media_type"]>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function friendlyExtractionError(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Couldn't read the document. Try again with a clearer photo or enter the information manually.",
    },
    { status: 502 },
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse body — reject oversize early.
  let body: ExtractRequestBody;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          error: `Image is too large. Maximum size is ${
            MAX_BODY_BYTES / (1024 * 1024)
          } MB.`,
        },
        { status: 413 },
      );
    }
    body = JSON.parse(raw) as ExtractRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.image_base64 || !body.mime_type || !body.barn_id) {
    return NextResponse.json(
      { error: "Missing required fields: image_base64, mime_type, barn_id." },
      { status: 400 },
    );
  }

  if (!VISION_MIME_TYPES.has(body.mime_type as Anthropic.Base64ImageSource["media_type"])) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG or PNG." },
      { status: 415 },
    );
  }

  // Access gate — paid barn OR has_document_scanner flag.
  const allowed = await canUserUseDocumentScanner(
    supabase,
    user.id,
    body.barn_id,
  );
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Document scanning requires a paid plan or explicit access. Please contact admin@barnbook.us.",
      },
      { status: 403 },
    );
  }

  // Rate limit.
  const rl = await checkRateLimit(supabase, user.id, ENDPOINT, RATE_LIMITS);
  if (!rl.ok) {
    const res = NextResponse.json(
      {
        error:
          rl.reason === "hour"
            ? "You've scanned a lot of documents in the last hour. Try again soon or enter the information manually."
            : "Daily scan limit reached. Try again tomorrow or enter the information manually.",
      },
      { status: 429 },
    );
    res.headers.set("Retry-After", String(rl.retryAfterSeconds));
    return res;
  }

  // If a specific horse was specified, verify access up front.
  if (body.horse_id) {
    const canAccess = await canUserAccessHorse(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      user.id,
      body.horse_id,
    );
    if (!canAccess) {
      return NextResponse.json(
        { error: "You don't have access to that horse." },
        { status: 403 },
      );
    }
  }

  // Call Claude.
  let extracted: ExtractedHorseData;
  let costCents: number | null = null;
  try {
    const client = createAnthropicClient();
    const response = await client.messages.create({
      model: getClaudeVisionModel(),
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.mime_type as Anthropic.Base64ImageSource["media_type"],
                data: body.image_base64,
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    // Find the text block — the response may also contain thinking blocks.
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    if (!textBlock) {
      await logApiCall(supabase, {
        user_id: user.id,
        endpoint: ENDPOINT,
        success: false,
        error: "no_text_block",
      });
      return friendlyExtractionError();
    }

    // Strip any accidental code fences before parsing.
    const cleaned = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    try {
      extracted = JSON.parse(cleaned) as ExtractedHorseData;
    } catch {
      await logApiCall(supabase, {
        user_id: user.id,
        endpoint: ENDPOINT,
        success: false,
        error: "json_parse_failed",
      });
      return NextResponse.json(
        {
          error:
            "Couldn't parse the document. The photo might be blurry or partial — try again with a clearer image.",
        },
        { status: 422 },
      );
    }

    // Approximate cost in cents (Opus 4.6: $5/1M in, $25/1M out).
    const usage = response.usage;
    const inCents = (usage.input_tokens * 500) / 1_000_000;
    const outCents = (usage.output_tokens * 2500) / 1_000_000;
    costCents = Math.max(1, Math.round(inCents + outCents));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[documents/extract] anthropic error:", err);
    await logApiCall(supabase, {
      user_id: user.id,
      endpoint: ENDPOINT,
      success: false,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return friendlyExtractionError();
  }

  // Horse matching — only if no horse was specified up front.
  let matchResult: MatchResult;
  if (body.horse_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: horse } = await (supabase as any)
      .from("horses")
      .select(
        "id, name, barn_id, breed, sex, color, registration_number, photo_url, owner_name",
      )
      .eq("id", body.horse_id)
      .maybeSingle();
    matchResult = horse
      ? {
          status: "exact_match",
          matched_horse: horse,
          possible_horses: null,
          match_confidence: "high",
          match_reason: "Scan initiated from this horse's profile.",
        }
      : {
          status: "no_match",
          matched_horse: null,
          possible_horses: null,
          match_confidence: "low",
          match_reason: "Horse not found.",
        };
  } else {
    matchResult = await matchExtractedHorse(supabase, user.id, extracted);
  }

  // Log success. Best-effort audit log alongside.
  await logApiCall(supabase, {
    user_id: user.id,
    endpoint: ENDPOINT,
    success: true,
    confidence: extracted.overall_confidence,
    cost_cents: costCents,
  });

  // admin_audit_log insert — fire-and-forget.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("admin_audit_log").insert({
      admin_user_id: user.id,
      action: "extract_document",
      target_type: "document",
      target_id: null,
      details: {
        document_type: extracted.document_type,
        confidence: extracted.overall_confidence,
        match_status: matchResult.status,
        cost_cents: costCents,
        prompt_version: EXTRACTION_PROMPT_VERSION,
        barn_id: body.barn_id,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[admin_audit_log] insert failed:", e);
  }

  return NextResponse.json({
    extracted_data: extracted,
    match_result: matchResult,
    prompt_version: EXTRACTION_PROMPT_VERSION,
  });
}
