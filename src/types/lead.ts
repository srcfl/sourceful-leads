export interface Lead {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  enriched?: boolean;
  placeId?: string;
}

export interface SearchFilters {
  minRating: number;
  minReviews: number;
  hasWebsite: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
}

export interface SearchRequest {
  query: string;
  location: string;
}

export interface EnrichRequest {
  website: string;
  leadId: string;
}

export interface EnrichedData {
  email?: string;
  phone?: string;
  socialLinks?: {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  };
}
