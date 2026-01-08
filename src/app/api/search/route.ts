import { NextRequest, NextResponse } from "next/server";
import { searchGoogleMaps } from "@/lib/scraper";
import { SearchRequest } from "@/types/lead";

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, location } = body;

    if (!query || !location) {
      return NextResponse.json(
        { error: "Query and location are required" },
        { status: 400 }
      );
    }

    console.log(`Searching for: ${query} in ${location}`);
    const leads = await searchGoogleMaps(query, location);
    console.log(`Found ${leads.length} leads`);

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Search failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
