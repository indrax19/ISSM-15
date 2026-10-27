// Export all Firebase APIs and types
export { technicalProjectsAPI, type TechnicalProject } from "./technicalProjectsAPI";
export { siteDetailsAPI, type SiteDetails, type CameraConfig } from "./siteDetailsAPI";
export { projectTrackingAPI, type ProjectTracking } from "./projectTrackingAPI";
export { parentProjectsAPI, type ParentProject } from "./parentProjectsAPI";
export { sslProjectsAPI, type SslProject } from "./sslProjectsAPI";
export { sslSubProjectsAPI, type SslSubProject } from "./sslSubProjectsAPI";
export { invoiceAPI, type Invoice } from "./invoiceAPI";
export { issuesAPI, type Issue } from "./issuesAPI";
export { issueUpdatesAPI, type IssueUpdate } from "./issueUpdatesAPI";
export { paymentAPI, type Payment } from "./paymentAPI";
export { notificationsAPI, type Notification } from "./notificationsAPI";
export { deviceTokensAPI } from "./deviceTokensAPI";
export { usersAPI, type User } from "./usersAPI";
export { knowledgeBaseAPI, type KnowledgeBase } from "./knowledgeBaseAPI";
export { challanAPI, type Challan } from "./challanAPI";
export { pushNotificationAPI } from "./pushNotificationAPI";
export { db } from "./config";
export { handleFirestoreError, removeUndefined, isNetworkAvailable, waitForNetwork } from "./utils";
