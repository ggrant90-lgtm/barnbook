/**
 * The extraction prompt sent to Claude along with a horse document image.
 *
 * Kept in its own file so the copy can be iterated over time without
 * touching the API route or action code. Versions should bump
 * EXTRACTION_PROMPT_VERSION when the prompt changes materially — that value
 * is stored alongside each extraction for future debugging.
 */

export const EXTRACTION_PROMPT_VERSION = "2026-04-18-v1";

export const EXTRACTION_PROMPT = `You are extracting structured data from a horse-related document image. The document is likely one of these types:

1. COGGINS TEST (EIA / Equine Infectious Anemia test) — a USDA-format form with horse identification, owner info, veterinarian info, test date, and result. Usually has a line drawing of a horse for marking identification.

2. REGISTRATION PAPERS — from a breed registry like AQHA (American Quarter Horse Association), APHA (American Paint Horse Association), Jockey Club (Thoroughbreds), or similar. Contains the horse's registered name, registration number, sire, dam, foaling date, color, breeder, and owner.

3. HEALTH CERTIFICATE (Certificate of Veterinary Inspection) — required for interstate transport. Contains horse identification, health status, vaccination records, and veterinarian certification.

4. VETERINARY INVOICE or RECORD — an invoice or treatment record from a veterinary clinic.

Extract every field you can identify. Return ONLY a JSON object with no other text, no markdown backticks, no explanation. Use null for any field you cannot read or are not confident about.

{
  "document_type": "coggins | registration | health_certificate | vet_record | unknown",
  "horse_name": "string or null — the horse's registered or common name",
  "breed": "string or null — breed name",
  "foal_date": "YYYY-MM-DD or null — the horse's foaling/birth date",
  "age": "number or null — age in years if explicitly stated",
  "sex": "Mare | Gelding | Stallion | Colt | Filly | null",
  "color": "string or null — coat color (e.g., Bay, Chestnut, Sorrel, Gray, Palomino, Black, Buckskin)",
  "markings": "string or null — facial and leg markings described in text",
  "registration_number": "string or null — the breed registry number (e.g., AQHA number, Jockey Club number)",
  "registry": "string or null — which registry (AQHA, APHA, Jockey Club, etc.)",
  "sire": "string or null — father's registered name",
  "dam": "string or null — mother's registered name",
  "owner_name": "string or null — current owner's name as shown on the document",
  "owner_address": "string or null — owner's address if visible",
  "vet_name": "string or null — veterinarian's name",
  "vet_clinic": "string or null — veterinary clinic or practice name",
  "vet_license": "string or null — veterinarian's license number if visible",
  "test_date": "YYYY-MM-DD or null — date the test was performed (for coggins/health certs)",
  "test_result": "Negative | Positive | null — test result (for coggins)",
  "expiration_date": "YYYY-MM-DD or null — when the document expires (coggins are typically valid for 12 months)",
  "vaccination_list": ["array of strings or null — list of vaccinations noted on the document"],
  "microchip_number": "string or null — if a microchip number is listed",
  "document_date": "YYYY-MM-DD or null — the date the document was issued or signed",
  "overall_confidence": "high | medium | low — your confidence that you read the document correctly",
  "extraction_notes": "string or null — anything you noticed that doesn't fit the fields above, or any uncertainty about specific fields"
}

Important guidance:
- Horse registration papers often have the horse's name in large decorative text at the top. Read it carefully — names can be long and include apostrophes, hyphens, or numbers.
- Coggins tests often have handwritten fields. Do your best to read handwriting but set confidence to medium or low if you're uncertain.
- Registration numbers are critical identifiers. Double-check them. AQHA numbers are typically 7-8 digits. Jockey Club numbers may include letters.
- If the document is rotated, upside down, or at an angle, still attempt to read it.
- If the image is too blurry, too dark, or too partial to extract meaningful data, set overall_confidence to "low" and explain in extraction_notes.
- Color descriptions should use standard equine terminology: Bay, Chestnut, Sorrel, Gray, Palomino, Black, Buckskin, Dun, Grullo, Roan, Paint, Pinto, Appaloosa, Cremello, Perlino, etc.
- Sex terminology: Mare (adult female), Gelding (castrated male), Stallion (intact adult male), Colt (young male), Filly (young female).
- For dates, always use YYYY-MM-DD format. If only a year is visible, use YYYY-01-01.
- If a document contains information about multiple horses (rare but possible on some health certificates), extract only the primary horse. Note others in extraction_notes.`;

// Response type as returned by the API route. Mirrors the JSON schema above.
export interface ExtractedHorseData {
  document_type:
    | "coggins"
    | "registration"
    | "health_certificate"
    | "vet_record"
    | "unknown";
  horse_name: string | null;
  breed: string | null;
  foal_date: string | null;
  age: number | null;
  sex: "Mare" | "Gelding" | "Stallion" | "Colt" | "Filly" | null;
  color: string | null;
  markings: string | null;
  registration_number: string | null;
  registry: string | null;
  sire: string | null;
  dam: string | null;
  owner_name: string | null;
  owner_address: string | null;
  vet_name: string | null;
  vet_clinic: string | null;
  vet_license: string | null;
  test_date: string | null;
  test_result: "Negative" | "Positive" | null;
  expiration_date: string | null;
  vaccination_list: string[] | null;
  microchip_number: string | null;
  document_date: string | null;
  overall_confidence: "high" | "medium" | "low";
  extraction_notes: string | null;
}
