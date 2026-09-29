export interface BlowRoomEntry {
  id: string;
  blowRoomNo: string;
  entryPoints: string;
  cameraLocation: string;
  lightingCondition: string;
}

export interface TextileSurveyData {
  category: "textile";
  
  // 1. Mill/Facility Identification
  millName: string;
  unitName: string;
  fullAddress: string;
  totalUnits: string;
  surveyDate: string;
  surveyedByName: string;
  surveyedByDesignation: string;
  millContactPerson: string;
  millContactNumber: string;
  
  // 2. Blow Room Inventory & Camera Coverage
  blowRooms: BlowRoomEntry[];
  totalBlowRooms: string;
  totalEntryPoints: string;
  
  // 3. Waste Flow & Entry-Point Cross-Contamination
  wasteFlowOption: "" | "dedicated" | "shared" | "recycling";
  wasteFlowRemarks: string;
  
  // 4. Network & Internet Connectivity
  internetAvailable: boolean;
  connectionTypes: string[]; // "fiber" | "dsl" | "wireless"
  connectionTypesOther: string;
  uplinkAvailable: boolean;
  bandwidthOption: "" | "10gb" | "20gb";
  internetQuality: string;
  ispProviderName: string;
  uplinkAtCamera: "" | "yes" | "no";
  distanceToNearestPoint: string;
  
  // 5. Power Infrastructure
  upsAvailable: boolean;
  cameraSocket: boolean;
  converterSocket: boolean;
  switchSocket: boolean;
  upsCapacity: string;
  upsBackupTime: string;
  
  // 6. GPU / Compute & Equipment Sizing
  gpuCompute: string;
  
  // 7. General Site Remarks / Additional Observations
  generalRemarks: string;
  
  // Signatures
  surveyorSignature: string;
  surveyorSignatureDate: string;
  customerRepresentativeSignature: string;
  customerRepresentativeSignatureDate: string;
}

export const defaultTextileData: TextileSurveyData = {
  category: "textile",
  millName: "",
  unitName: "",
  fullAddress: "",
  totalUnits: "",
  surveyDate: new Date().toISOString().split("T")[0],
  surveyedByName: "",
  surveyedByDesignation: "",
  millContactPerson: "",
  millContactNumber: "",
  blowRooms: [
    { id: "1", blowRoomNo: "BR-01", entryPoints: "", cameraLocation: "", lightingCondition: "" },
    { id: "2", blowRoomNo: "BR-02", entryPoints: "", cameraLocation: "", lightingCondition: "" },
    { id: "3", blowRoomNo: "BR-03", entryPoints: "", cameraLocation: "", lightingCondition: "" },
    { id: "4", blowRoomNo: "BR-04", entryPoints: "", cameraLocation: "", lightingCondition: "" },
    { id: "5", blowRoomNo: "BR-05", entryPoints: "", cameraLocation: "", lightingCondition: "" },
    { id: "6", blowRoomNo: "BR-06", entryPoints: "", cameraLocation: "", lightingCondition: "" },
  ],
  totalBlowRooms: "",
  totalEntryPoints: "",
  wasteFlowOption: "",
  wasteFlowRemarks: "",
  internetAvailable: false,
  connectionTypes: [],
  connectionTypesOther: "",
  uplinkAvailable: false,
  bandwidthOption: "",
  internetQuality: "",
  ispProviderName: "",
  uplinkAtCamera: "",
  distanceToNearestPoint: "",
  upsAvailable: false,
  cameraSocket: false,
  converterSocket: false,
  switchSocket: false,
  upsCapacity: "",
  upsBackupTime: "",
  gpuCompute: "",
  generalRemarks: "",
  surveyorSignature: "",
  surveyorSignatureDate: "",
  customerRepresentativeSignature: "",
  customerRepresentativeSignatureDate: "",
};
