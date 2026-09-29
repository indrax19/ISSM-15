import { useEffect, useState } from "react";
import {
  TextileSurveyData,
  BlowRoomEntry,
  defaultTextileData,
} from "./SurveyTemplateBase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface TextileSurveyFormProps {
  initialData?: TextileSurveyData;
  onSubmit: (data: TextileSurveyData) => Promise<void>;
  isLoading?: boolean;
}

const SectionHeader = ({ number, title }: { number: number; title: string }) => (
  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 sm:p-5 text-white mb-6 mt-8">
    <h2 className="text-lg sm:text-xl font-bold">
      {number}. {title}
    </h2>
  </div>
);

const FormGroup = ({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">
      {label} {required && <span className="text-red-500">*</span>}
    </Label>
    {children}
  </div>
);

export default function TextileSurveyForm({
  initialData = defaultTextileData,
  onSubmit,
  isLoading = false,
}: TextileSurveyFormProps) {
  const [data, setData] = useState<TextileSurveyData>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleInputChange = (field: keyof TextileSurveyData, value: any) => {
    setData({ ...data, [field]: value });
  };

  const handleBlowRoomChange = (
    id: string,
    field: keyof BlowRoomEntry,
    value: string
  ) => {
    setData({
      ...data,
      blowRooms: data.blowRooms.map((room) =>
        room.id === id ? { ...room, [field]: value } : room
      ),
    });
  };

  const addBlowRoomRow = () => {
    const newId = String(Math.max(...data.blowRooms.map((r) => parseInt(r.id) || 0)) + 1);
    setData({
      ...data,
      blowRooms: [
        ...data.blowRooms,
        { id: newId, blowRoomNo: "", entryPoints: "", cameraLocation: "", lightingCondition: "" },
      ],
    });
  };

  const removeBlowRoomRow = (id: string) => {
    setData({
      ...data,
      blowRooms: data.blowRooms.filter((r) => r.id !== id),
    });
  };

  const handleCheckboxChange = (field: string, value: boolean) => {
    setData({ ...data, [field]: value });
  };

  const handleConnectionTypeChange = (type: string, checked: boolean) => {
    setData({
      ...data,
      connectionTypes: checked
        ? [...data.connectionTypes, type]
        : data.connectionTypes.filter((t) => t !== type),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(data);
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* TITLE */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-lg p-4 sm:p-6 text-white text-center">
        <h1 className="text-2xl sm:text-3xl font-bold">
          PRE-INSTALLATION / PRE-DEPLOYMENT SURVEY FORM
        </h1>
        <p className="text-slate-300 mt-2 text-sm sm:text-base">
          Video Analytics System — Spinning Unit / Blow Room Deployment (Pakistan)
        </p>
      </div>

      {/* SECTION 1: Mill/Facility Identification */}
      <Card>
        <SectionHeader number={1} title="Mill / Facility Identification" />
        <CardContent className="space-y-4 sm:space-y-6 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormGroup label="Mill Name" required>
              <Input
                value={data.millName}
                onChange={(e) => handleInputChange("millName", e.target.value)}
                placeholder="Enter mill name"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="Unit Name / Unit No." required>
              <Input
                value={data.unitName}
                onChange={(e) => handleInputChange("unitName", e.target.value)}
                placeholder="Enter unit name or number"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="Full Address / City" required>
              <Input
                value={data.fullAddress}
                onChange={(e) => handleInputChange("fullAddress", e.target.value)}
                placeholder="Enter complete address"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="Total No. of Units under this Facility" required>
              <Input
                value={data.totalUnits}
                onChange={(e) => handleInputChange("totalUnits", e.target.value)}
                placeholder="Number"
                className="text-sm"
                type="number"
              />
            </FormGroup>
            <FormGroup label="Survey Date" required>
              <Input
                type="date"
                value={data.surveyDate}
                onChange={(e) => handleInputChange("surveyDate", e.target.value)}
                className="text-sm"
              />
            </FormGroup>
          </div>

          <div className="border-t pt-4 sm:pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormGroup label="Surveyed By (Name)" required>
                <Input
                  value={data.surveyedByName}
                  onChange={(e) => handleInputChange("surveyedByName", e.target.value)}
                  placeholder="Surveyor name"
                  className="text-sm"
                />
              </FormGroup>
              <FormGroup label="Designation">
                <Input
                  value={data.surveyedByDesignation}
                  onChange={(e) => handleInputChange("surveyedByDesignation", e.target.value)}
                  placeholder="Job title"
                  className="text-sm"
                />
              </FormGroup>
              <FormGroup label="Mill Contact Person" required>
                <Input
                  value={data.millContactPerson}
                  onChange={(e) => handleInputChange("millContactPerson", e.target.value)}
                  placeholder="Contact person name"
                  className="text-sm"
                />
              </FormGroup>
              <FormGroup label="Contact No. / Email">
                <Input
                  value={data.millContactNumber}
                  onChange={(e) => handleInputChange("millContactNumber", e.target.value)}
                  placeholder="Phone or email"
                  className="text-sm"
                />
              </FormGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Blow Room Inventory & Camera Coverage */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-lg text-white">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">
              2. Blow Room Inventory & Camera Coverage
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">
              List every blow room in the facility
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={addBlowRoomRow}
            className="bg-white text-blue-600 hover:bg-blue-50 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Room
          </Button>
        </div>

        <CardContent className="pt-4 sm:pt-6">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="text-xs sm:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-24">Sr. #</TableHead>
                  <TableHead className="min-w-28">Blow Room No.</TableHead>
                  <TableHead className="min-w-32">No. of Entry Points</TableHead>
                  <TableHead className="min-w-40">Camera Location(s)</TableHead>
                  <TableHead className="min-w-40">Lighting Condition</TableHead>
                  <TableHead className="w-12">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.blowRooms.map((room, idx) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={room.blowRoomNo}
                        onChange={(e) =>
                          handleBlowRoomChange(room.id, "blowRoomNo", e.target.value)
                        }
                        placeholder="BR-01"
                        className="text-xs h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={room.entryPoints}
                        onChange={(e) =>
                          handleBlowRoomChange(room.id, "entryPoints", e.target.value)
                        }
                        placeholder="Number"
                        className="text-xs h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={room.cameraLocation}
                        onChange={(e) =>
                          handleBlowRoomChange(room.id, "cameraLocation", e.target.value)
                        }
                        placeholder="Location"
                        className="text-xs h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={room.lightingCondition}
                        onChange={(e) =>
                          handleBlowRoomChange(room.id, "lightingCondition", e.target.value)
                        }
                        placeholder="Condition"
                        className="text-xs h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeBlowRoomRow(room.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t">
            <FormGroup label="Total No. of Blow Rooms in Facility">
              <Input
                value={data.totalBlowRooms}
                onChange={(e) => handleInputChange("totalBlowRooms", e.target.value)}
                placeholder="Number"
                className="text-sm"
                type="number"
              />
            </FormGroup>
            <FormGroup label="Total No of Entry Points in each Blow Room">
              <Input
                value={data.totalEntryPoints}
                onChange={(e) => handleInputChange("totalEntryPoints", e.target.value)}
                placeholder="Number"
                className="text-sm"
                type="number"
              />
            </FormGroup>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: Waste Flow & Entry-Point Cross-Contamination */}
      <Card>
        <SectionHeader number={3} title="Waste Flow & Entry-Point Cross-Contamination Check" />
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-slate-600 mb-4">
            Assess whether cotton waste exits through dedicated door and whether workers/material
            enter through separate entry point, or both flows share same opening.
          </p>

          <div className="space-y-3">
            {[
              {
                id: "dedicated",
                label:
                  "Waste exits through one dedicated door AND workers/material enter through a separate door (two distinct openings)",
              },
              {
                id: "shared",
                label:
                  "Waste exit and personnel/material entry share the SAME single door/point",
              },
              {
                id: "recycling",
                label:
                  "Waste is being brought back into the blow room through the entry point for recycling/re-use (should NOT happen — flag as non-compliant)",
              },
            ].map((option) => (
              <div key={option.id} className="flex items-start gap-3 p-3 rounded border">
                <Checkbox
                  checked={data.wasteFlowOption === option.id}
                  onCheckedChange={(checked) => {
                    if (checked) handleInputChange("wasteFlowOption", option.id);
                  }}
                  className="mt-1"
                />
                <label className="text-sm cursor-pointer flex-1 leading-relaxed">
                  {option.label}
                </label>
              </div>
            ))}
          </div>

          <FormGroup label="Remarks / Observations">
            <Textarea
              value={data.wasteFlowRemarks}
              onChange={(e) => handleInputChange("wasteFlowRemarks", e.target.value)}
              placeholder="Enter any remarks or observations..."
              className="min-h-24 text-sm"
            />
          </FormGroup>
        </CardContent>
      </Card>

      {/* SECTION 4: Network & Internet Connectivity */}
      <Card>
        <SectionHeader number={4} title="Network & Internet Connectivity" />
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded border">
              <Checkbox
                checked={data.internetAvailable}
                onCheckedChange={(checked) =>
                  handleCheckboxChange("internetAvailable", checked as boolean)
                }
              />
              <label className="text-sm cursor-pointer">
                Internet connectivity is available at the mill / site
              </label>
            </div>

            {data.internetAvailable && (
              <div className="ml-6 space-y-3 p-3 rounded bg-blue-50 border border-blue-200">
                <FormGroup label="Internet connection type">
                  <div className="space-y-2">
                    {[
                      { id: "fiber", label: "Fiber" },
                      { id: "dsl", label: "DSL/Broadband" },
                      { id: "wireless", label: "Wireless/Other" },
                    ].map((type) => (
                      <div key={type.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={data.connectionTypes.includes(type.id)}
                          onCheckedChange={(checked) =>
                            handleConnectionTypeChange(type.id, checked as boolean)
                          }
                        />
                        <label className="text-sm cursor-pointer">{type.label}</label>
                      </div>
                    ))}
                  </div>
                </FormGroup>

                {data.connectionTypes.includes("wireless") && (
                  <FormGroup label="Other (Please specify)">
                    <Input
                      value={data.connectionTypesOther}
                      onChange={(e) =>
                        handleInputChange("connectionTypesOther", e.target.value)
                      }
                      placeholder="Specify other type"
                      className="text-sm"
                    />
                  </FormGroup>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 p-3 rounded border">
              <Checkbox
                checked={data.uplinkAvailable}
                onCheckedChange={(checked) =>
                  handleCheckboxChange("uplinkAvailable", checked as boolean)
                }
              />
              <label className="text-sm cursor-pointer">
                Existing network Uplink / LAN connection is available near proposed camera locations
              </label>
            </div>
          </div>

          <div className="border-t pt-6">
            <FormGroup label="Bandwidth Requirement Confirmation">
              <div className="space-y-2">
                {[
                  { id: "10gb", label: "10 MB Dedicated bandwidth available/committed by customer" },
                  {
                    id: "20gb",
                    label:
                      "20–25 MB Shared bandwidth available/committed by customer",
                  },
                ].map((option) => (
                  <div key={option.id} className="flex items-center gap-3 p-2 rounded">
                    <Checkbox
                      checked={data.bandwidthOption === option.id}
                      onCheckedChange={(checked) => {
                        if (checked) handleInputChange("bandwidthOption", option.id);
                      }}
                    />
                    <label className="text-sm cursor-pointer">{option.label}</label>
                  </div>
                ))}
              </div>
            </FormGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
            <FormGroup label="Current Internet Connection Quality">
              <Input
                value={data.internetQuality}
                onChange={(e) => handleInputChange("internetQuality", e.target.value)}
                placeholder="e.g., Good, Fair, Poor"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="ISP / Provider Name">
              <Input
                value={data.ispProviderName}
                onChange={(e) => handleInputChange("ispProviderName", e.target.value)}
                placeholder="Provider name"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="Existing Uplink at Camera Location? (Y/N)">
              <select
                value={data.uplinkAtCamera}
                onChange={(e) => handleInputChange("uplinkAtCamera", e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md"
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </FormGroup>
            <FormGroup label="Distance to Nearest Network Point (approx.)">
              <Input
                value={data.distanceToNearestPoint}
                onChange={(e) => handleInputChange("distanceToNearestPoint", e.target.value)}
                placeholder="e.g., 100m"
                className="text-sm"
              />
            </FormGroup>
          </div>

          <p className="text-xs text-slate-500 italic p-3 rounded bg-slate-50">
            Note: Core network connectivity from Camera to Control Room (Fiber / Cat6) is the
            customer's responsibility.
          </p>
        </CardContent>
      </Card>

      {/* SECTION 5: Power Infrastructure */}
      <Card>
        <SectionHeader number={5} title="Power Infrastructure" />
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-3">
            {[
              { key: "upsAvailable", label: "UPS backup power available at proposed camera locations" },
              { key: "cameraSocket", label: "Dedicated power socket available for Camera" },
              { key: "converterSocket", label: "Dedicated power socket available for Media Converter" },
              { key: "switchSocket", label: "Dedicated power socket available for Network Switch" },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-3 p-3 rounded border">
                <Checkbox
                  checked={data[item.key as keyof TextileSurveyData] as boolean}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(item.key, checked as boolean)
                  }
                />
                <label className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t">
            <FormGroup label="Existing UPS Capacity (if any)">
              <Input
                value={data.upsCapacity}
                onChange={(e) => handleInputChange("upsCapacity", e.target.value)}
                placeholder="e.g., 10 kVA"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="UPS Backup Time (approx.)">
              <Input
                value={data.upsBackupTime}
                onChange={(e) => handleInputChange("upsBackupTime", e.target.value)}
                placeholder="e.g., 2 hours"
                className="text-sm"
              />
            </FormGroup>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 6: GPU / Compute & Equipment Sizing */}
      <Card>
        <SectionHeader number={6} title="GPU / Compute & Equipment Sizing" />
        <CardContent className="space-y-6 pt-6">
          <p className="text-sm text-slate-600">
            Reference guideline: 1 GPU compute unit typically supports approx. 5–6 cameras.
            Confirm final sizing based on actual camera count and analytics load per site.
          </p>
          <FormGroup label="GPU Compute Details">
            <Textarea
              value={data.gpuCompute}
              onChange={(e) => handleInputChange("gpuCompute", e.target.value)}
              placeholder="Enter GPU requirements, camera count, and compute specifications..."
              className="min-h-24 text-sm"
            />
          </FormGroup>
        </CardContent>
      </Card>

      {/* SECTION 7: General Site Remarks */}
      <Card>
        <SectionHeader number={7} title="General Site Remarks / Additional Observations" />
        <CardContent className="space-y-6 pt-6">
          <FormGroup label="General Remarks">
            <Textarea
              value={data.generalRemarks}
              onChange={(e) => handleInputChange("generalRemarks", e.target.value)}
              placeholder="Enter any additional observations, recommendations, or important notes..."
              className="min-h-32 text-sm"
            />
          </FormGroup>
        </CardContent>
      </Card>

      {/* SECTION 8: Signatures */}
      <Card>
        <CardHeader className="bg-slate-100 border-b">
          <CardTitle className="text-lg">Signatures & Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormGroup label="Surveyor Signature">
              <Input
                value={data.surveyorSignature}
                onChange={(e) => handleInputChange("surveyorSignature", e.target.value)}
                placeholder="Enter or draw signature"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="Date">
              <Input
                type="date"
                value={data.surveyorSignatureDate}
                onChange={(e) => handleInputChange("surveyorSignatureDate", e.target.value)}
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="Customer / Mill Representative Signature">
              <Input
                value={data.customerRepresentativeSignature}
                onChange={(e) =>
                  handleInputChange("customerRepresentativeSignature", e.target.value)
                }
                placeholder="Enter or draw signature"
                className="text-sm"
              />
            </FormGroup>
            <FormGroup label="Date">
              <Input
                type="date"
                value={data.customerRepresentativeSignatureDate}
                onChange={(e) =>
                  handleInputChange("customerRepresentativeSignatureDate", e.target.value)
                }
                className="text-sm"
              />
            </FormGroup>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex gap-3 pt-6 sticky bottom-0 bg-white border-t p-4 sm:p-6 rounded-lg shadow-lg">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-10"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Survey Report"
          )}
        </Button>
      </div>
    </form>
  );
}
