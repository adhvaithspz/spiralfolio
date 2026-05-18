/** Serializable shape for `PortfolioPulse` (built in `getPortfolioData`). */

export type PortfolioPulseBucketCall = {
  clientName: string;
  callDate: string;
  callType: string | null;
};

export type PortfolioPulseBucket = {
  count: number;
  rangeLabel: string;
  calls: PortfolioPulseBucketCall[];
};
