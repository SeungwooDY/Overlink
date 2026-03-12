"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface SavedItem {
  id: string;
  type: string;
  data: Record<string, string>;
  created_at: string;
  meeting_id: string;
  meeting_title?: string;
}

export function useSavedItems(type: string) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          setLoading(false);
          return;
        }
        fetch(`/api/dashboard/items?type=${encodeURIComponent(type)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((r) => r.json())
          .then((data) => setItems(Array.isArray(data) ? data : []))
          .finally(() => setLoading(false));
      });
  }, [type]);

  return { items, loading };
}
