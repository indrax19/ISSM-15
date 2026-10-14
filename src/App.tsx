import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ActivityProvider } from "@/context/ActivityContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { NetworkStatusBar } from "@/components/NetworkStatusBar";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Lazy load all route components for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Categories = lazy(() => import("@/pages/Categories"));
const CategoryDetail = lazy(() => import("@/pages/CategoryDetail"));
const SubCategoryDetail = lazy(() => import("@/pages/SubCategoryDetail"));
const InventoryStatus = lazy(() => import("@/pages/InventoryStatus"));
const Scan = lazy(() => import("@/pages/Scan"));
const Transactions = lazy(() => import("@/pages/Transactions"));
const PersonalInventory = lazy(() => import("@/pages/PersonalInventory"));
const PersonDetail = lazy(() => import("@/pages/PersonDetail"));
const DeliveryChallans = lazy(() => import("@/pages/DeliveryChallans"));
const NewDeliveryChallans = lazy(() => import("@/pages/NewDeliveryChallans"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const NewInvoice = lazy(() => import("@/pages/NewInvoice"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const ManageUsers = lazy(() => import("@/pages/ManageUsers"));
const Sites = lazy(() => import("@/pages/Sites"));
const SiteDetailsForm = lazy(() => import("@/pages/SiteDetailsForm"));
const DeploymentCertificates = lazy(() => import("@/pages/DeploymentCertificates"));
const TechnicalProjectDetail = lazy(() => import("@/pages/TechnicalProjectDetail"));
const ProjectTracking = lazy(() => import("@/pages/ProjectTracking"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const ProjectSiteForm = lazy(() => import("@/pages/ProjectSiteForm"));
const Ssl = lazy(() => import("@/pages/Ssl"));
const SslProjectDetail = lazy(() => import("@/pages/SslProjectDetail"));
const SslSubProjectForm = lazy(() => import("@/pages/SslSubProjectForm"));
const KnowledgeBase = lazy(() => import("@/pages/KnowledgeBase"));
const KnowledgeBaseDocumentView = lazy(() => import("@/pages/KnowledgeBaseDocumentView"));
const Complaints = lazy(() => import("@/pages/Complaints"));
const SiteSurveyReports = lazy(() => import("@/pages/SiteSurveyReports"));
const SiteSurveyReport = lazy(() => import("@/pages/SiteSurveyReport"));
const SurveyReportCategorySelect = lazy(() => import("@/pages/SurveyReportCategorySelect"));
const TextileSurveyReport = lazy(() => import("@/pages/TextileSurveyReport"));
const OutreachMill = lazy(() => import("@/pages/OutreachMill"));
const OutreachMillHierarchy = lazy(() => import("@/pages/OutreachMillHierarchy"));
const CustomerData = lazy(() => import("@/pages/CustomerData"));

// Loading Fallback Component
const PageLoader = () => (
  <Card className="mt-8">
    <CardContent className="flex flex-col items-center justify-center py-12">
      <div className="space-y-3 text-center">
        <img src="/avira-logo.webp" alt="Avira Technologies" className="h-12 w-auto mx-auto mb-4 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </CardContent>
  </Card>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - cache retention time (increased from 10)
      retry: 1,
      // Prevent Firebase AbortError by disabling query cancellation
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <NetworkStatusBar />
      <BrowserRouter>
        <AuthProvider>
          <ActivityProvider>
            <NotificationPermissionPrompt />
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<ProtectedRoute requiredPermission="dashboard"><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute requiredPermission="inventory"><Suspense fallback={<PageLoader />}><Categories /></Suspense></ProtectedRoute>} />
              <Route path="/categories/:id" element={<ProtectedRoute requiredPermission="inventory"><Suspense fallback={<PageLoader />}><CategoryDetail /></Suspense></ProtectedRoute>} />
              <Route path="/subcategories/:id" element={<ProtectedRoute requiredPermission="inventory"><Suspense fallback={<PageLoader />}><SubCategoryDetail /></Suspense></ProtectedRoute>} />
              <Route path="/inventory/:status" element={<ProtectedRoute requiredPermission="inventory"><Suspense fallback={<PageLoader />}><InventoryStatus /></Suspense></ProtectedRoute>} />
              <Route path="/scan" element={<ProtectedRoute requiredPermission="scan"><Suspense fallback={<PageLoader />}><Scan /></Suspense></ProtectedRoute>} />
              <Route path="/personal-inventory" element={<ProtectedRoute requiredPermission="personal-inventory"><Suspense fallback={<PageLoader />}><PersonalInventory /></Suspense></ProtectedRoute>} />
              <Route path="/personal-inventory/:id" element={<ProtectedRoute requiredPermission="personal-inventory"><Suspense fallback={<PageLoader />}><PersonDetail /></Suspense></ProtectedRoute>} />
              <Route path="/delivery-challans" element={<ProtectedRoute requiredPermission="delivery-challans"><Suspense fallback={<PageLoader />}><DeliveryChallans /></Suspense></ProtectedRoute>} />
              <Route path="/delivery-challans/new" element={<ProtectedRoute requiredPermission="delivery-challans"><Suspense fallback={<PageLoader />}><NewDeliveryChallans /></Suspense></ProtectedRoute>} />
              <Route path="/delivery-challans/:id" element={<ProtectedRoute requiredPermission="delivery-challans"><Suspense fallback={<PageLoader />}><NewDeliveryChallans /></Suspense></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><Invoices /></Suspense></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><NewInvoice /></Suspense></ProtectedRoute>} />
              <Route path="/invoices/:id" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><NewInvoice /></Suspense></ProtectedRoute>} />
              <Route path="/sites" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><Sites /></Suspense></ProtectedRoute>} />
              <Route path="/sites/new" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><SiteDetailsForm /></Suspense></ProtectedRoute>} />
              <Route path="/sites/:id" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><SiteDetailsForm /></Suspense></ProtectedRoute>} />
              <Route path="/technical-projects/:id" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><TechnicalProjectDetail /></Suspense></ProtectedRoute>} />
              <Route path="/technical-projects/:technicalProjectId/sites/new" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><SiteDetailsForm /></Suspense></ProtectedRoute>} />
              <Route path="/technical-projects/:technicalProjectId/sites/:id" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><SiteDetailsForm /></Suspense></ProtectedRoute>} />
              <Route path="/certificates/:siteId" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><DeploymentCertificates /></Suspense></ProtectedRoute>} />
              <Route path="/project-tracking" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectTracking /></Suspense></ProtectedRoute>} />
              <Route path="/outreach-mill" element={<ProtectedRoute requiredPermission="outreach-mill"><Suspense fallback={<PageLoader />}><OutreachMillHierarchy /></Suspense></ProtectedRoute>} />
              <Route path="/outreach-mill/:id" element={<ProtectedRoute requiredPermission="outreach-mill"><Suspense fallback={<PageLoader />}><OutreachMillHierarchy /></Suspense></ProtectedRoute>} />
              <Route path="/customer-data" element={<ProtectedRoute requiredPermission="customer-data"><Suspense fallback={<PageLoader />}><CustomerData /></Suspense></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><Projects /></Suspense></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectDetail /></Suspense></ProtectedRoute>} />
              <Route path="/project-sites/new/:projectId" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectSiteForm /></Suspense></ProtectedRoute>} />
              <Route path="/project-sites/:siteId/:projectId" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectSiteForm /></Suspense></ProtectedRoute>} />
              <Route path="/sla" element={<ProtectedRoute requiredPermission="sla"><Suspense fallback={<PageLoader />}><Ssl /></Suspense></ProtectedRoute>} />
              <Route path="/sla/:id" element={<ProtectedRoute requiredPermission="sla"><Suspense fallback={<PageLoader />}><SslProjectDetail /></Suspense></ProtectedRoute>} />
              <Route path="/sla-sub-projects/new/:projectId" element={<ProtectedRoute requiredPermission="sla"><Suspense fallback={<PageLoader />}><SslSubProjectForm /></Suspense></ProtectedRoute>} />
              <Route path="/sla-sub-projects/:siteId/:projectId" element={<ProtectedRoute requiredPermission="sla"><Suspense fallback={<PageLoader />}><SslSubProjectForm /></Suspense></ProtectedRoute>} />
              <Route path="/knowledge-base" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><KnowledgeBase /></Suspense></ProtectedRoute>} />
              <Route path="/knowledge-base/:id" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><KnowledgeBaseDocumentView /></Suspense></ProtectedRoute>} />
              <Route path="/complaints" element={<ProtectedRoute requiredPermission="complaints"><Suspense fallback={<PageLoader />}><Complaints /></Suspense></ProtectedRoute>} />
              <Route path="/survey-reports" element={<ProtectedRoute requiredPermission="survey-reports"><Suspense fallback={<PageLoader />}><SiteSurveyReports /></Suspense></ProtectedRoute>} />
              <Route path="/survey-reports/category" element={<ProtectedRoute requiredPermission="survey-reports"><Suspense fallback={<PageLoader />}><SurveyReportCategorySelect /></Suspense></ProtectedRoute>} />
              <Route path="/survey-reports/new" element={<ProtectedRoute requiredPermission="survey-reports"><Suspense fallback={<PageLoader />}><SiteSurveyReport /></Suspense></ProtectedRoute>} />
              <Route path="/survey-reports/new/:category" element={<ProtectedRoute requiredPermission="survey-reports"><Suspense fallback={<PageLoader />}><TextileSurveyReport /></Suspense></ProtectedRoute>} />
              <Route path="/survey-reports/edit/textile/:id" element={<ProtectedRoute requiredPermission="survey-reports"><Suspense fallback={<PageLoader />}><TextileSurveyReport /></Suspense></ProtectedRoute>} />
              <Route path="/survey-reports/:id" element={<ProtectedRoute requiredPermission="survey-reports"><Suspense fallback={<PageLoader />}><SiteSurveyReport /></Suspense></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute requiredPermission="transactions"><Suspense fallback={<PageLoader />}><Transactions /></Suspense></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredPermission="settings"><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={<PageLoader />}><Profile /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-users"
                element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={<PageLoader />}><ManageUsers /></Suspense>
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ActivityProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
