import { addDoc, collection } from "firebase/firestore";
import { DeploymentCertificate } from "./firestore";
import { db } from "./config";
import { removeUndefined } from "./utils";

export const sslDeploymentCertificateAPI = {
  async create(certificate: DeploymentCertificate) {
    try {
      const data = removeUndefined({
        ...certificate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "ssl_deployment_certificates"), data);
      return { id: docRef.id, ...data } as DeploymentCertificate;
    } catch (error: any) {
      throw new Error(
        error.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : error.message || "Failed to create SSL deployment certificate"
      );
    }
  },
};
