# Survey Reports Module - User Guide

## Getting Started

### Creating a New Survey Report

1. Navigate to **Survey Reports** from the main menu
2. Click **"New Report"** button (top right)
3. Select your industry category:
   - 🏭 **Textile** - For textile mills and spinning units
   - 💧 **Beverage** - For beverage manufacturing facilities
   - 🔨 **Steel Mill** - For steel mill operations
   - 🐔 **Hatchery** - For hatchery facilities
   - 🍯 **Sugar** - For sugar processing facilities
   - ➕ **Other Categories** - Coming soon

### Textile Survey Form Overview

The textile survey form contains 8 comprehensive sections:

#### **1. Mill / Facility Identification**
Enter basic information about the facility:
- Mill Name (required)
- Unit Name / Unit No. (required)
- Full Address / City (required)
- Total Units under this facility
- Survey Date
- Surveyor details (Name & Designation)
- Mill contact person and their contact information

#### **2. Blow Room Inventory & Camera Coverage**
Create a detailed list of all blow rooms:
- Pre-populated with 6 example rooms (BR-01 through BR-06)
- **Add Room** button to include additional rooms
- Remove button to delete rows you don't need
- For each room, specify:
  - Blow Room Number (e.g., BR-01, BR-02)
  - Number of Entry Points
  - Proposed Camera Location(s)
  - Sunlight / Lighting Condition Facing Camera
- Add summary totals:
  - Total Blow Rooms in facility
  - Total Entry Points per facility

#### **3. Waste Flow & Entry-Point Cross-Contamination**
Select the waste handling method:
- ✓ Dedicated door for waste exit + Separate entry door
- ✓ Shared single door/point
- ✓ Waste recycling back into blow room (Non-compliant)
- Add remarks and observations about waste flow

#### **4. Network & Internet Connectivity**
Document network infrastructure:
- ✓ Internet availability
- Select connection types: Fiber, DSL/Broadband, Wireless/Other
- ✓ Uplink/LAN availability near camera locations
- Bandwidth commitment: 10GB Dedicated or 20-25GB Shared
- Internet quality rating
- ISP / Provider name
- Uplink availability at camera location
- Distance to nearest network point
- Note: Core network (Fiber/Cat6) is customer responsibility

#### **5. Power Infrastructure**
Confirm power availability:
- ✓ UPS backup power at camera locations
- ✓ Dedicated socket for Camera
- ✓ Dedicated socket for Media Converter
- ✓ Dedicated socket for Network Switch
- UPS capacity details (if available)
- UPS backup time duration

#### **6. GPU / Compute & Equipment Sizing**
Document GPU requirements:
- Reference: 1 GPU unit ≈ 5-6 cameras
- Specify final sizing based on camera count
- Detail analytics load per site
- List all compute requirements

#### **7. General Site Remarks / Additional Observations**
Add any additional information:
- Implementation challenges
- Recommendations
- Special considerations
- Important notes for deployment team

#### **8. Signatures & Approval**
Complete the form with:
- Surveyor signature and date
- Customer/Mill representative signature and date

## Features

### ✅ Full Mobile Responsiveness
- Optimized for smartphones (375px+)
- Tablet-friendly layouts (768px+)
- Desktop full experience (1025px+)
- Touch-friendly buttons and controls

### ✅ Smart Form Handling
- Required fields marked with *
- Helpful placeholder text
- Real-time validation
- Auto-saving capability
- Error messages with guidance

### ✅ Dynamic Tables
- Add rows: Click "Add Room" button
- Remove rows: Click delete icon (🗑️)
- Scroll on mobile devices
- Responsive column layout

### ✅ PDF Export
- Click "Export PDF" button
- Professional formatted document
- Includes all sections and data
- Print-ready quality
- Preserves all formatting

## Workflow

### Creating a Report
```
1. Click "New Report"
   ↓
2. Select "Textile" category
   ↓
3. Fill in all sections
   ↓
4. Click "Save Survey Report"
   ↓
5. Report saved to database ✓
```

### Editing a Report
```
1. Go to Survey Reports list
   ↓
2. Find your report
   ↓
3. Click Edit button (✏️)
   ↓
4. Modify any fields
   ↓
5. Click "Save Survey Report"
   ↓
6. Changes saved ✓
```

### Exporting to PDF
```
1. Open an existing report
   ↓
2. Click "Export PDF" button
   ↓
3. PDF downloads automatically
   ↓
4. Includes all survey data ✓
```

## Tips & Best Practices

### Data Entry
- 📝 Fill in required fields first (marked with *)
- 🔍 Double-check facility identifications
- 📋 Use consistent naming for blow rooms (BR-01, BR-02, etc.)
- 📸 Provide accurate camera location descriptions
- ⚡ Document actual power socket details

### Blow Room Table
- Pre-filled with 6 rooms for textile mills
- Delete unused rows to keep data clean
- Add more rows if facility has additional rooms
- Use consistent numbering (BR-01, BR-02, etc.)

### Network Documentation
- Note all connectivity details for deployment
- Specify bandwidth commitments clearly
- Document existing infrastructure
- Flag limitations for planning team

### Completion
- Review all sections before saving
- Include detailed remarks for complex sites
- Add signatures from both parties
- Export PDF as backup/archive

## Mobile Usage

### Optimized for Small Screens
- Stack form fields vertically
- Scrollable tables with full content
- Large touch buttons (44px minimum)
- Full-width inputs and selects
- Readable font sizes

### Tips for Mobile Entry
- Use autocomplete for repetitive fields
- Take advantage of date pickers
- Keep remarks brief but informative
- Save frequently using sticky button
- Use landscape mode for tables if needed

## Troubleshooting

### Form Won't Save
- Check required fields (marked with *)
- Ensure internet connection is active
- Try refreshing and retry
- Contact support if issue persists

### PDF Export Issues
- Save report first before exporting
- Check browser PDF viewer settings
- Allow pop-ups for PDF downloads
- Try different browser if needed

### Data Loss
- Auto-save is enabled
- Keep internet connection active
- Avoid closing tab without saving
- Recent reports are cached for recovery

## Future Enhancements

Coming Soon:
- Additional categories (Beverage, Steel, Hatchery, Sugar)
- Bulk import from templates
- Signature capture
- Photo attachments
- Report comparison tools
- Advanced analytics and reporting

## Support

For questions or issues:
- Contact your system administrator
- Review form sections carefully
- Check field descriptions
- Refer to this guide for workflows
