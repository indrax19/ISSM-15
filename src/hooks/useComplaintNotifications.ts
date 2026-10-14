import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { complaintsAPI, type Complaint } from "@/integrations/firebase/complaintsAPI";
import { siteDetailsAPI, type SiteDetails } from "@/integrations/firebase/siteDetailsAPI";
import { technicalProjectsAPI, type TechnicalProject } from "@/integrations/firebase/technicalProjectsAPI";

const complaintCacheRef = new Map<string, Complaint>();
const sitesCacheRef = new Map<string, SiteDetails>();
const projectsCacheRef = new Map<string, TechnicalProject>();

export function useComplaintNotifications() {
  const unsubRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    unsubRef.current = complaintsAPI.subscribeAll(
      async (complaints) => {
        const newComplaints = complaints.filter((complaint) => {
          const cached = complaintCacheRef.get(complaint.id || "");
          return !cached;
        });

        for (const complaint of newComplaints) {
          try {
            let siteName = "Unknown Site";
            let projectName = "Unknown Project";

            // Get site details
            if (!sitesCacheRef.has(complaint.siteId)) {
              const site = await siteDetailsAPI.getById(complaint.siteId);
              if (site) {
                sitesCacheRef.set(complaint.siteId, site);
                siteName = site.millName || "Unknown Site";
              }
            } else {
              siteName = sitesCacheRef.get(complaint.siteId)?.millName || "Unknown Site";
            }

            // Get project details
            if (!projectsCacheRef.has(complaint.projectId)) {
              const project = await technicalProjectsAPI.getById(complaint.projectId);
              if (project) {
                projectsCacheRef.set(complaint.projectId, project);
                projectName = project.name;
              }
            } else {
              projectName = projectsCacheRef.get(complaint.projectId)?.name || "Unknown Project";
            }

            // Show notification
            const createdByName = complaint.createdByName || "User";
            toast.info(
              `New Support Ticket`,
              {
                description: `"${complaint.subject}"\n${projectName} • ${siteName}\nCreated by: ${createdByName}`,
                duration: 6000,
              }
            );
          } catch (error) {
            console.error("Error processing complaint notification:", error);
          }

          // Cache the complaint
          complaintCacheRef.set(complaint.id || "", complaint);
        }
      },
      (error) => {
        console.error("Error in complaint notifications:", error);
      }
    );

    return () => {
      unsubRef.current?.();
    };
  }, []);
}
