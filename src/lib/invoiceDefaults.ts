import type { CompanyPaymentDetails } from "@/integrations/firebase/invoiceAPI";

export const DEFAULT_COMPANY_PAYMENT_DETAILS: CompanyPaymentDetails = {
  companyName: "ISSM Labelling Solutions Pvt. Ltd.",
  address: "First Floor, Daftarkhwan North, Plot No. 94, Street 7, Sector I10/3, Islamabad.",
  ntn: "A033994",
  website: "www.issm.ai",
  bankName: "Bank AL Habib Limited (BAHL)",
  accountTitle: "ISSM Labelling Solutions Pvt. Ltd.",
  accountNo: "0086-0981-013092-01-4",
  iban: "PK08BAHL0086098101309201",
  branch: "I-10 Markaz Branch, Plot #9, I-10 Markaz, Islamabad (Branch Code 0086-000)",
};

export const DEFAULT_INVOICE_TERMS = `Taxes & Duties:
- All prices are exclusive of applicable taxes, duties and levies. Any such charges are additional and shall be borne by the client as per prevailing government regulations.
- Sales tax on services will be applied per the client's jurisdiction and preference — 5% under the Punjab Revenue Authority (PRA), 3% under the Sindh Revenue Board (SRB), or a general 15% where applicable.
- Applicable federal sales tax (GST) on hardware/goods will be charged as per prevailing FBR regulations.

Payment Schedule:
- Hardware, Supply, Software & Installation: 100% advance (bank transfer) with the Purchase Order.
- Any applicable SLA fee is billed annually in advance and is payable before installation and commissioning of the hardware/software.
- Payment Mode: direct transfer into the ISSM Labeling Solutions account (details below).
- Additional Items: The invoiced amount includes only the items and services specifically mentioned. Any additional items, accessories, licenses, or services shall be charged separately.
- Invoice Validity: This invoice is valid for five (05) calendar days from the date of issuance. Prices and availability are subject to change thereafter.

Availability & Delivery:
- Deployment activities, including hardware supply and installation, will commence upon receipt of payments as per the payment schedule. Final quantities and the installation schedule are confirmed against the site survey.
- Scope & Site Requirements: Final quantities and specifications will be confirmed based on actual requirements. Installation, cabling, civil work, electrical work, internet/network connectivity, or other site-related requirements are included only when specifically mentioned.

Payment & Cancellation:
- 100% payment is required in advance upon issuance of the PO. In case of partial or complete cancellation after PO issuance, a 25% cancellation charge on the cancelled value shall apply. Specially procured/non-cancellable items shall be subject to applicable vendor terms.

Warranty & Support:
- All applicable taxes, duties and levies are excluded and are to the client's account.
- All other material not included in this invoice is provided by the client, as set out in the note above.
- Core network connectivity from the IT Room to the camera location is to be provided by the client.
- IT Room space for the NVR and network equipment is customer-provided.`;
