import { NextRequest, NextResponse } from "next/server";
import { enrichFromWebsite } from "@/lib/scraper";
import { EnrichRequest } from "@/types/lead";

export async function POST(request: NextRequest) {
  try {
    const body: EnrichRequest = await request.json();
    const { website, leadId } = body;

    if (!website) {
      return NextResponse.json(
        { error: "Website URL is required" },
        { status: 400 }
      );
    }

    console.log(`Enriching lead ${leadId} from: ${website}`);
    const enrichedData = await enrichFromWebsite(website);
    console.log(`Enrichment result:`, enrichedData);

    return NextResponse.json({ enrichedData, leadId });
  } catch (error) {
    console.error("Enrich API error:", error);
    return NextResponse.json(
      { error: "Enrichment failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
