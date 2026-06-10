// Browser and analysis-engine contracts shared by the Selling Analysis sources.
type SellingAnalysisRow = Record<string, unknown> & {
  retailer?: string;
  location?: string;
  brand?: string;
  collection?: string;
  tyUnits?: number;
  tyRetail?: number;
  tyOH?: number;
  tyST?: number;
  msrp?: number;
};

type SellingAnalysisDefinition = {
  id: string;
  name: string;
  priority: number;
  question: string;
  required: string[];
  metrics?: string[];
};

type SellingAnalysisReadiness = {
  id: string;
  name?: string;
  priority?: number;
  question?: string;
  ready: boolean;
  missing: string[];
  metrics: string[];
  missingMetrics: string[];
  availableMetrics: string[];
  [key: string]: unknown;
};

interface SellingAnalysisAPI {
  FIELD_SYNONYMS: Record<string, string[]>;
  OPTIONAL_DIMS: string[];
  FIELD_LABELS: Record<string, string>;
  ANALYSES: SellingAnalysisDefinition[];
  buildColumnMap(headers: unknown[]): Record<string, number>;
  parseRecords(rows: unknown[][]): {
    records: SellingAnalysisRow[];
    foundFields: string[];
    availableOptionalDims: string[];
    analyses: SellingAnalysisReadiness[];
    [key: string]: unknown;
  };
  enrich(
    rows: SellingAnalysisRow[],
    options?: Record<string, unknown>,
    themes?: Record<string, string>
  ): SellingAnalysisRow[];
  evaluateAnalyses(fields: Record<string, unknown>): SellingAnalysisReadiness[];
  applyFilters(rows: SellingAnalysisRow[], filters: Record<string, Set<unknown>>): SellingAnalysisRow[];
  [key: string]: any;
}

interface Window {
  SOA: SellingAnalysisAPI;
  XLSX: any;
  SOA_TOAST?: (message: string) => void;
  SOA_APP?: {
    clearData?: () => void;
    [key: string]: unknown;
  };
  toggleTheme(): void;
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
}

declare const module: {
  exports?: unknown;
};

declare const XLSX: any;
