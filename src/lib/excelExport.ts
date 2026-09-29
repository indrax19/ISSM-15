import * as XLSX from 'xlsx';
import { SiteDetails } from '@/integrations/firebase/siteDetailsAPI';
import { ProjectTracking } from '@/integrations/firebase/projectTrackingAPI';

function getChecklistValue(value?: boolean): string {
  return value ? 'Yes' : 'No';
}

function getSiteRow(site: SiteDetails): (string | number)[] {
  const cameraIPs: (string | undefined)[] = [];
  for (let i = 0; i < 11; i++) {
    cameraIPs.push(site.cameras?.[i]?.ip);
  }

  return [
    site.date || '',
    site.millName || '',
    site.millLocation || '',
    site.unitNo || '',
    site.pocName || '',
    site.pocContact || '',
    site.gpuUserName || '',
    site.gpuPassword || '',
    site.anydeskId || '',
    site.anydeskPassword || '',
    site.anydeskId2 || '',
    site.anydeskPassword2 || '',
    site.tailscaleIp || '',
    site.remoteanydeskPassword || '',
    site.remoteanydeskAccountName || '',
    site.rustdeskId || '',
    site.rustdeskPassword || '',
    site.rustdeskId2 || '',
    site.rustdeskPassword2 || '',
    site.pcNic || '',
    site.subnet || '',
    site.defaultGateway || '',
    site.dns || '',
    site.nvrIp || '',
    site.nvrIp2 || '',
    site.nvrUsername || '',
    site.nvrPassword || '',
    site.cameraUsername || '',
    site.cameraPassword || '',
    cameraIPs[0] || '',
    cameraIPs[1] || '',
    cameraIPs[2] || '',
    cameraIPs[3] || '',
    cameraIPs[4] || '',
    cameraIPs[5] || '',
    cameraIPs[6] || '',
    cameraIPs[7] || '',
    cameraIPs[8] || '',
    cameraIPs[9] || '',
    cameraIPs[10] || '',
    site.additionalDetails || '',
    getChecklistValue(site.hardwareCompleted),
    getChecklistValue(site.dataCopy),
    site.patch1Date || '',
    site.patch2Date || '',
    getChecklistValue(site.completionCertificate),
    getChecklistValue(site.roiCreated),
  ];
}

export function exportSiteToExcel(site: SiteDetails) {
  const workbook = XLSX.utils.book_new();

  // Create header row
  const headers = [
    'Date',
    'Mill Name',
    'Mill Location',
    'Unit No',
    'POC Name',
    'POC Contact',
    'GPU User Name',
    'GPU Password',
    'Anydesk ID 1',
    'Anydesk Password 1',
    'Anydesk ID 2',
    'Anydesk Password 2',
    'Tail-Scale IP',
    'Tail-Scale Password',
    'Tail-Scale Account Name',
    'Rustdesk ID 1',
    'Rustdesk Password 1',
    'Rustdesk ID 2',
    'Rustdesk Password 2',
    'PC NIC',
    'Subnet',
    'Default Gateway',
    'DNS',
    'NVR IP-1',
    'NVR IP-2',
    'Username',
    'Password',
    'Camera username',
    'Camera Password',
    'Camera 1',
    'Camera 2',
    'Camera 3',
    'Camera 4',
    'Camera 5',
    'Camera 6',
    'Camera 7',
    'Camera 8',
    'Camera 9',
    'Camera 10',
    'Camera 11',
    'Additional Details',
    'Hardware Completed',
    'Data Copy',
    'Patch 1 Date',
    'Patch 2 Date',
    'Completion Certificate',
    'ROI Created',
  ];

  const data = [headers, getSiteRow(site)];

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 20 }, // Mill Name
    { wch: 18 }, // Mill Location
    { wch: 12 }, // Unit No
    { wch: 18 }, // POC Name
    { wch: 18 }, // POC Contact
    { wch: 18 }, // GPU User Name
    { wch: 18 }, // GPU Password
    { wch: 16 }, // Anydesk ID
    { wch: 18 }, // Anydesk Password
    { wch: 16 }, // Tail Scale IP
    { wch: 22 }, // Remote AnyDesk Password
    { wch: 24 }, // Remote AnyDesk Account Name
    { wch: 16 }, // Rustdesk ID
    { wch: 18 }, // Rustdesk Password
    { wch: 16 }, // PC NIC
    { wch: 16 }, // Subnet
    { wch: 18 }, // Default Gateway
    { wch: 12 }, // DNS
    { wch: 16 }, // NVR IP-1
    { wch: 16 }, // NVR IP-2
    { wch: 12 }, // Username
    { wch: 16 }, // Password
    { wch: 16 }, // Camera username
    { wch: 16 }, // Camera Password
    { wch: 16 }, // Camera 1
    { wch: 16 }, // Camera 2
    { wch: 16 }, // Camera 3
    { wch: 16 }, // Camera 4
    { wch: 16 }, // Camera 5
    { wch: 16 }, // Camera 6
    { wch: 16 }, // Camera 7
    { wch: 16 }, // Camera 8
    { wch: 16 }, // Camera 9
    { wch: 16 }, // Camera 10
    { wch: 16 }, // Camera 11
    { wch: 35 }, // Additional Details
    { wch: 18 }, // Hardware Completed
    { wch: 14 }, // Data Copy
    { wch: 14 }, // Patch 1 Date
    { wch: 14 }, // Patch 2 Date
    { wch: 22 }, // Completion Certificate
    { wch: 14 }, // ROI Created
  ];

  // Freeze header row
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sites');

  // Generate filename with date only
  const filename = `${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function exportSiteDataToExcel(sites: SiteDetails[]) {
  const workbook = XLSX.utils.book_new();

  // Create header row
  const headers = [
    'Date',
    'Mill Name',
    'Mill Location',
    'Unit No',
    'POC Name',
    'POC Contact',
    'GPU User Name',
    'GPU Password',
    'Anydesk ID 1',
    'Anydesk Password 1',
    'Anydesk ID 2',
    'Anydesk Password 2',
    'Tail-Scale IP',
    'Tail-Scale Password',
    'Tail-Scale Account Name',
    'Rustdesk ID 1',
    'Rustdesk Password 1',
    'Rustdesk ID 2',
    'Rustdesk Password 2',
    'PC NIC',
    'Subnet',
    'Default Gateway',
    'DNS',
    'NVR IP-1',
    'NVR IP-2',
    'Username',
    'Password',
    'Camera username',
    'Camera Password',
    'Camera 1',
    'Camera 2',
    'Camera 3',
    'Camera 4',
    'Camera 5',
    'Camera 6',
    'Camera 7',
    'Camera 8',
    'Camera 9',
    'Camera 10',
    'Camera 11',
    'Additional Details',
    'Hardware Completed',
    'Data Copy',
    'Patch 1 Date',
    'Patch 2 Date',
    'Completion Certificate',
    'ROI Created',
  ];

  const data = [headers];

  // Add each site as a row
  sites.forEach((site) => {
    data.push(getSiteRow(site).map(String));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 20 }, // Mill Name
    { wch: 18 }, // Mill Location
    { wch: 12 }, // Unit No
    { wch: 18 }, // POC Name
    { wch: 18 }, // POC Contact
    { wch: 18 }, // GPU User Name
    { wch: 18 }, // GPU Password
    { wch: 16 }, // Anydesk ID 1
    { wch: 18 }, // Anydesk Password 1
    { wch: 16 }, // Anydesk ID 2
    { wch: 18 }, // Anydesk Password 2
    { wch: 16 }, // Tail Scale IP
    { wch: 22 }, // Remote AnyDesk Password
    { wch: 24 }, // Remote AnyDesk Account Name
    { wch: 16 }, // Rustdesk ID 1
    { wch: 18 }, // Rustdesk Password 1
    { wch: 16 }, // Rustdesk ID 2
    { wch: 18 }, // Rustdesk Password 2
    { wch: 16 }, // PC NIC
    { wch: 16 }, // Subnet
    { wch: 18 }, // Default Gateway
    { wch: 12 }, // DNS
    { wch: 16 }, // NVR IP-1
    { wch: 16 }, // NVR IP-2
    { wch: 12 }, // Username
    { wch: 16 }, // Password
    { wch: 16 }, // Camera username
    { wch: 16 }, // Camera Password
    { wch: 16 }, // Camera 1
    { wch: 16 }, // Camera 2
    { wch: 16 }, // Camera 3
    { wch: 16 }, // Camera 4
    { wch: 16 }, // Camera 5
    { wch: 16 }, // Camera 6
    { wch: 16 }, // Camera 7
    { wch: 16 }, // Camera 8
    { wch: 16 }, // Camera 9
    { wch: 16 }, // Camera 10
    { wch: 16 }, // Camera 11
    { wch: 35 }, // Additional Details
    { wch: 18 }, // Hardware Completed
    { wch: 14 }, // Data Copy
    { wch: 14 }, // Patch 1 Date
    { wch: 14 }, // Patch 2 Date
    { wch: 22 }, // Completion Certificate
    { wch: 14 }, // ROI Created
  ];

  // Freeze header row
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sites');

  const filename = `Technical_Sites_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function exportAllSitesToExcel(sites: SiteDetails[]) {
  const workbook = XLSX.utils.book_new();

  // Create header row
  const headers = [
    'Date',
    'Mill Name',
    'Mill Location',
    'Unit No',
    'POC Name',
    'POC Contact',
    'GPU User Name',
    'GPU Password',
    'Anydesk ID 1',
    'Anydesk Password 1',
    'Anydesk ID 2',
    'Anydesk Password 2',
    'Tail-Scale IP',
    'Tail-Scale Password',
    'Tail-Scale Account Name',
    'Rustdesk ID 1',
    'Rustdesk Password 1',
    'Rustdesk ID 2',
    'Rustdesk Password 2',
    'PC NIC',
    'Subnet',
    'Default Gateway',
    'DNS',
    'NVR IP-1',
    'NVR IP-2',
    'Username',
    'Password',
    'Camera username',
    'Camera Password',
    'Camera 1',
    'Camera 2',
    'Camera 3',
    'Camera 4',
    'Camera 5',
    'Camera 6',
    'Camera 7',
    'Camera 8',
    'Camera 9',
    'Camera 10',
    'Camera 11',
    'Additional Details',
    'Hardware Completed',
    'Data Copy',
    'Patch 1 Date',
    'Patch 2 Date',
    'Completion Certificate',
    'ROI Created',
  ];

  const data = [headers];

  // Add each site as a row
  sites.forEach((site) => {
    data.push(getSiteRow(site).map(String));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 20 }, // Mill Name
    { wch: 18 }, // Mill Location
    { wch: 12 }, // Unit No
    { wch: 18 }, // POC Name
    { wch: 18 }, // POC Contact
    { wch: 18 }, // GPU User Name
    { wch: 18 }, // GPU Password
    { wch: 16 }, // Anydesk ID 1
    { wch: 18 }, // Anydesk Password 1
    { wch: 16 }, // Anydesk ID 2
    { wch: 18 }, // Anydesk Password 2
    { wch: 16 }, // Tail Scale IP
    { wch: 22 }, // Tail-Scale Password
    { wch: 24 }, // Tail-Scale Account Name
    { wch: 16 }, // Rustdesk ID 1
    { wch: 18 }, // Rustdesk Password 1
    { wch: 16 }, // Rustdesk ID 2
    { wch: 18 }, // Rustdesk Password 2
    { wch: 16 }, // PC NIC
    { wch: 16 }, // Subnet
    { wch: 18 }, // Default Gateway
    { wch: 12 }, // DNS
    { wch: 16 }, // NVR IP-1
    { wch: 16 }, // NVR IP-2
    { wch: 12 }, // Username
    { wch: 16 }, // Password
    { wch: 16 }, // Camera username
    { wch: 16 }, // Camera Password
    { wch: 16 }, // Camera 1
    { wch: 16 }, // Camera 2
    { wch: 16 }, // Camera 3
    { wch: 16 }, // Camera 4
    { wch: 16 }, // Camera 5
    { wch: 16 }, // Camera 6
    { wch: 16 }, // Camera 7
    { wch: 16 }, // Camera 8
    { wch: 16 }, // Camera 9
    { wch: 16 }, // Camera 10
    { wch: 16 }, // Camera 11
    { wch: 35 }, // Additional Details
    { wch: 18 }, // Hardware Completed
    { wch: 14 }, // Data Copy
    { wch: 14 }, // Patch 1 Date
    { wch: 14 }, // Patch 2 Date
    { wch: 22 }, // Completion Certificate
    { wch: 14 }, // ROI Created
  ];

  // Freeze header row
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sites');

  const filename = `All_Sites_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

function getProjectRow(project: ProjectTracking): (string | number)[] {
  return [
    project.millName || '',
    project.city || '',
    project.district || '',
    project.address || '',
    project.state || '',
    project.unitNo || '',
    project.pocName || '',
    project.pocPhone || '',
    project.projectStatus || '',
    project.supplierName || '',
    project.logisticsStatus || '',
    project.poStatus || '',
    project.poDate || '',
    project.startDate || '',
    project.endDate || '',
    project.projectDurationDays || 0,
    project.supervisorName || '',
    project.technicianNames?.join(', ') || '',
    project.teamStatus || '',
    project.hardwareDeliveryStatus || '',
    project.remarks || '',
    project.created_at ? new Date(project.created_at).toLocaleDateString() : '',
    project.updated_at ? new Date(project.updated_at).toLocaleDateString() : '',
  ];
}

export function exportProjectTrackingToExcel(projects: ProjectTracking[]) {
  const workbook = XLSX.utils.book_new();

  // Create header row with improved field names
  const headers = [
    'Mill Name',
    'City',
    'District',
    'Address',
    'State',
    'Unit No',
    'Point of Contact Name',
    'Point of Contact Phone',
    'Project Status',
    'Supplier Name',
    'Logistics Status',
    'Purchase Order Status',
    'Purchase Order Date',
    'Start Date',
    'End Date',
    'Duration (days)',
    'Supervisor Name',
    'Technician Names',
    'Team Status',
    'Hardware Delivery Status',
    'Remarks',
    'Created Date',
    'Updated Date',
  ];

  const data = [headers];

  // Add each project as a row
  projects.forEach((project) => {
    data.push(getProjectRow(project).map(String));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Professional styling with blue header
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, size: 12 },
    fill: { fgColor: { rgb: '1F4788' } }, // Professional blue
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      left: { style: 'thin' },
      right: { style: 'thin' },
      top: { style: 'thin' },
      bottom: { style: 'thin' },
    },
  };

  // Apply header styling
  headers.forEach((_, colIndex) => {
    const cellAddress = XLSX.utils.encode_col(colIndex) + '1';
    worksheet[cellAddress].s = headerStyle;
  });

  // Apply borders and alignment to all data cells
  const rowCount = data.length;
  const colCount = headers.length;
  for (let r = 1; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const cellAddress = XLSX.utils.encode_col(c) + (r + 1);
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          border: {
            left: { style: 'thin', color: { rgb: 'D3D3D3' } },
            right: { style: 'thin', color: { rgb: 'D3D3D3' } },
            top: { style: 'thin', color: { rgb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
          },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        };
      }
    }
  }

  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 20 }, // Mill Name
    { wch: 15 }, // City
    { wch: 15 }, // District
    { wch: 25 }, // Address
    { wch: 15 }, // State
    { wch: 12 }, // Unit No
    { wch: 22 }, // Point of Contact Name
    { wch: 22 }, // Point of Contact Phone
    { wch: 18 }, // Project Status
    { wch: 18 }, // Supplier Name
    { wch: 18 }, // Logistics Status
    { wch: 20 }, // Purchase Order Status
    { wch: 20 }, // Purchase Order Date
    { wch: 12 }, // Start Date
    { wch: 12 }, // End Date
    { wch: 14 }, // Duration (days)
    { wch: 18 }, // Supervisor Name
    { wch: 30 }, // Technician Names
    { wch: 18 }, // Team Status
    { wch: 22 }, // Hardware Delivery Status
    { wch: 35 }, // Remarks
    { wch: 12 }, // Created Date
    { wch: 12 }, // Updated Date
  ];

  // Set row height for header
  worksheet['!rows'] = [{ hpx: 25 }];

  // Freeze header row
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');

  // Generate filename with date
  const filename = `Project_Tracking_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
