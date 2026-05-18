export interface ClassMarkerLink {
  link_id: number;
  link_url_id: string;
  link_name: string;
  test_name: string;
}

export interface ClassMarkerResult {
  percentage?: number;
  passed?: boolean;
  test_name?: string | null;
  completed_at?: number | string | null;
  points_scored?: number;
  points_available?: number;
  duration?: string | null;
}
