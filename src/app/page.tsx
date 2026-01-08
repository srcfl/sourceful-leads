"use client";

import { useState } from "react";
import { Lead, SearchFilters } from "@/types/lead";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("Stockholm, Sweden");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    minRating: 0,
    minReviews: 0,
    hasWebsite: false,
    hasEmail: false,
    hasPhone: false,
  });

  const presetSearches = [
    "Solcellsinstallatörer",
    "Laddstationer installation",
    "Energikonsulter",
    "Elinstallatörer solenergi",
    "Batterilagring energi",
    "Fastighetsförvaltning",
    "Ventilationsföretag",
    "Värmepumpar installation",
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, location }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setLeads(data.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = async (lead: Lead) => {
    if (!lead.website) return;

    setEnriching(lead.id);

    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: lead.website, leadId: lead.id }),
      });

      if (!response.ok) {
        throw new Error("Enrichment failed");
      }

      const data = await response.json();
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, ...data.enrichedData, enriched: true } : l
        )
      );
    } catch (err) {
      console.error("Enrichment failed:", err);
    } finally {
      setEnriching(null);
    }
  };

  const handleEnrichAll = async () => {
    const leadsWithWebsite = leads.filter((l) => l.website && !l.enriched);
    for (const lead of leadsWithWebsite) {
      await handleEnrich(lead);
    }
  };

  const exportCSV = () => {
    const filteredLeads = getFilteredLeads();
    const headers = [
      "Name",
      "Address",
      "Phone",
      "Website",
      "Email",
      "Rating",
      "Reviews",
      "Category",
    ];
    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.address,
      lead.phone || "",
      lead.website || "",
      lead.email || "",
      lead.rating?.toString() || "",
      lead.reviewCount?.toString() || "",
      lead.category || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sourceful-leads-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const getFilteredLeads = () => {
    return leads.filter((lead) => {
      if (filters.minRating > 0 && (lead.rating || 0) < filters.minRating)
        return false;
      if (
        filters.minReviews > 0 &&
        (lead.reviewCount || 0) < filters.minReviews
      )
        return false;
      if (filters.hasWebsite && !lead.website) return false;
      if (filters.hasEmail && !lead.email) return false;
      if (filters.hasPhone && !lead.phone) return false;
      return true;
    });
  };

  const filteredLeads = getFilteredLeads();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Sourceful Lead Finder
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            Find B2B Leads in Sweden
          </h2>

          {/* Preset searches */}
          <div className="flex flex-wrap gap-2 mb-4">
            {presetSearches.map((preset) => (
              <button
                key={preset}
                onClick={() => setSearchQuery(preset)}
                className="px-3 py-1.5 text-sm rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900 dark:hover:text-emerald-300 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Search inputs */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Business type (e.g., Solcellsinstallatörer)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-64 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="px-6 py-3 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-500 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Results Section */}
        {leads.length > 0 && (
          <>
            {/* Filters & Actions */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">
                    Min Rating:
                  </label>
                  <select
                    value={filters.minRating}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        minRating: Number(e.target.value),
                      }))
                    }
                    className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="0">Any</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                    <option value="4.5">4.5+</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">
                    Min Reviews:
                  </label>
                  <select
                    value={filters.minReviews}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        minReviews: Number(e.target.value),
                      }))
                    }
                    className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="0">Any</option>
                    <option value="5">5+</option>
                    <option value="10">10+</option>
                    <option value="25">25+</option>
                    <option value="50">50+</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={filters.hasWebsite}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, hasWebsite: e.target.checked }))
                    }
                    className="rounded"
                  />
                  Has Website
                </label>

                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={filters.hasEmail}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, hasEmail: e.target.checked }))
                    }
                    className="rounded"
                  />
                  Has Email
                </label>

                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={filters.hasPhone}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, hasPhone: e.target.checked }))
                    }
                    className="rounded"
                  />
                  Has Phone
                </label>

                <div className="ml-auto flex gap-2">
                  <button
                    onClick={handleEnrichAll}
                    disabled={enriching !== null}
                    className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                  >
                    Enrich All
                  </button>
                  <button
                    onClick={exportCSV}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                  >
                    Export CSV ({filteredLeads.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Showing {filteredLeads.length} of {leads.length} leads
            </p>

            {/* Results Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Business
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Rating
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {lead.name}
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {lead.address}
                          </p>
                          {lead.category && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              {lead.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {lead.phone && (
                            <p className="text-sm text-zinc-700 dark:text-zinc-300">
                              📞 {lead.phone}
                            </p>
                          )}
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline block truncate max-w-xs"
                            >
                              🌐 {lead.website.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline block"
                            >
                              ✉️ {lead.email}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.rating && (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="text-zinc-900 dark:text-zinc-100">
                              {lead.rating}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400 text-sm">
                              ({lead.reviewCount})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.website && !lead.enriched && (
                          <button
                            onClick={() => handleEnrich(lead)}
                            disabled={enriching === lead.id}
                            className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                          >
                            {enriching === lead.id ? "..." : "Enrich"}
                          </button>
                        )}
                        {lead.enriched && (
                          <span className="text-sm text-emerald-600 dark:text-emerald-400">
                            ✓ Enriched
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Empty state */}
        {leads.length === 0 && !loading && (
          <div className="text-center py-16">
            <p className="text-zinc-500 dark:text-zinc-400">
              Search for businesses to find leads
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
