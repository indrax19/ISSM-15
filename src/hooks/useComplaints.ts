import { useEffect, useRef, useState } from "react";
import { complaintsAPI, type Complaint } from "@/integrations/firebase/complaintsAPI";
import { technicalProjectsAPI, type TechnicalProject } from "@/integrations/firebase/technicalProjectsAPI";
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";

export interface ComplaintWithDetails extends Complaint {
  projectName?: string;
  siteName?: string;
}

export function useAllComplaints() {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{ projects: Map<string, TechnicalProject>; sites: Map<string, SiteDetails> }>({
    projects: new Map(),
    sites: new Map(),
  });

  useEffect(() => {
    setIsLoading(true);

    unsubRef.current = complaintsAPI.subscribeAll(
      async (complaintsData) => {
        const enrichedComplaints = await Promise.all(
          complaintsData.map(async (complaint) => {
            let projectName = complaint.projectId;
            let siteName = complaint.siteId;

            if (cacheRef.current.projects.has(complaint.projectId)) {
              projectName = cacheRef.current.projects.get(complaint.projectId)?.name || complaint.projectId;
            } else {
              try {
                const project = await technicalProjectsAPI.getById(complaint.projectId);
                if (project) {
                  cacheRef.current.projects.set(complaint.projectId, project);
                  projectName = project.name;
                }
              } catch (error) {
                console.error("Failed to fetch project:", error);
              }
            }

            if (cacheRef.current.sites.has(complaint.siteId)) {
              siteName = cacheRef.current.sites.get(complaint.siteId)?.millName || complaint.siteId;
            } else {
              try {
                const site = await siteDetailsAPI.getById(complaint.siteId);
                if (site) {
                  cacheRef.current.sites.set(complaint.siteId, site);
                  siteName = site.millName || complaint.siteId;
                }
              } catch (error) {
                console.error("Failed to fetch site:", error);
              }
            }

            return { ...complaint, projectName, siteName };
          })
        );

        setComplaints(enrichedComplaints);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error loading complaints:", error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubRef.current?.();
    };
  }, []);

  return { complaints, isLoading };
}

export type ComplaintPageSize = 30 | 60 | 100 | "all";

export function usePaginatedComplaints(pageSize: ComplaintPageSize) {
  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<any>(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef<{ projects: Map<string, TechnicalProject>; sites: Map<string, SiteDetails> }>({
    projects: new Map(),
    sites: new Map(),
  });

  const enrichComplaints = async (items: Complaint[]) => Promise.all(items.map(async (complaint) => {
    let projectName = cacheRef.current.projects.get(complaint.projectId)?.name || complaint.projectId;
    let siteName = cacheRef.current.sites.get(complaint.siteId)?.millName || complaint.siteId;

    if (!cacheRef.current.projects.has(complaint.projectId)) {
      const project = await technicalProjectsAPI.getById(complaint.projectId).catch(() => null);
      if (project) {
        cacheRef.current.projects.set(complaint.projectId, project);
        projectName = project.name;
      }
    }

    if (!cacheRef.current.sites.has(complaint.siteId)) {
      const site = await siteDetailsAPI.getById(complaint.siteId).catch(() => null);
      if (site) {
        cacheRef.current.sites.set(complaint.siteId, site);
        siteName = site.millName || complaint.siteId;
      }
    }

    return { ...complaint, projectName, siteName };
  }));

  const loadPage = async (append: boolean) => {
    const requestId = ++requestIdRef.current;
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      if (pageSize === "all") {
        const allComplaints = await complaintsAPI.getAll();
        if (requestId !== requestIdRef.current) return;
        setComplaints(await enrichComplaints(allComplaints));
        setHasMore(false);
        cursorRef.current = null;
        return;
      }

      const page = await complaintsAPI.getPage(pageSize, append ? cursorRef.current : null);
      if (requestId !== requestIdRef.current) return;
      const enriched = await enrichComplaints(page.complaints);
      if (requestId !== requestIdRef.current) return;
      setComplaints((previous) => append ? [...previous, ...enriched] : enriched);
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    cursorRef.current = null;
    setComplaints([]);
    void loadPage(false);
  }, [pageSize]);

  return {
    complaints,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore: () => loadPage(true),
    refresh: () => {
      cursorRef.current = null;
      void loadPage(false);
    },
  };
}
