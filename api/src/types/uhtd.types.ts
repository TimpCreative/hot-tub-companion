/**
 * UHTD Type Definitions
 * Universal Hot Tub Database - TypeScript interfaces for all entities
 */

// =============================================================================
// SCdb Types (Spa Configuration Database)
// =============================================================================

export interface ScdbBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  dataSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBrandInput {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  isActive?: boolean;
  dataSource?: string;
}

export interface UpdateBrandInput {
  name?: string;
  logoUrl?: string;
  websiteUrl?: string;
  isActive?: boolean;
  dataSource?: string;
}

export interface ScdbModelLine {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  dataSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  brandName?: string;
}

export interface CreateModelLineInput {
  brandId: string;
  name: string;
  description?: string;
  isActive?: boolean;
  dataSource?: string;
}

export interface UpdateModelLineInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  dataSource?: string;
}

export interface ScdbSpaModel {
  id: string;
  modelLineId: string;
  brandId: string;
  name: string;
  year: number;
  manufacturerSku: string | null;
  // Specifications
  waterCapacityGallons: number | null;
  jetCount: number | null;
  seatingCapacity: number | null;
  dimensionsLengthInches: number | null;
  dimensionsWidthInches: number | null;
  dimensionsHeightInches: number | null;
  weightDryLbs: number | null;
  weightFilledLbs: number | null;
  electricalRequirement: string | null;
  // Features
  hasOzone: boolean;
  hasUv: boolean;
  hasSaltSystem: boolean;
  hasJacuzziTrue: boolean;
  // Media
  imageUrl: string | null;
  specSheetUrl: string | null;
  // Status
  isDiscontinued: boolean;
  notes: string | null;
  dataSource: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  brandName?: string;
  modelLineName?: string;
}

export interface CreateSpaModelInput {
  modelLineId: string;
  brandId: string;
  name: string;
  year: number;
  manufacturerSku?: string;
  waterCapacityGallons?: number;
  jetCount?: number;
  seatingCapacity?: number;
  dimensionsLengthInches?: number;
  dimensionsWidthInches?: number;
  dimensionsHeightInches?: number;
  weightDryLbs?: number;
  weightFilledLbs?: number;
  electricalRequirement?: string;
  hasOzone?: boolean;
  hasUv?: boolean;
  hasSaltSystem?: boolean;
  hasJacuzziTrue?: boolean;
  imageUrl?: string;
  specSheetUrl?: string;
  isDiscontinued?: boolean;
  notes?: string;
  dataSource?: string;
}

export interface UpdateSpaModelInput extends Partial<CreateSpaModelInput> {}

export interface SpaElectricalConfig {
  id: string;
  spaModelId: string;
  voltage: number;
  voltageUnit: string;
  frequencyHz: number | null;
  amperage: string;
  sortOrder: number;
  createdAt: Date;
}

export interface CreateElectricalConfigInput {
  voltage: number;
  voltageUnit?: string;
  frequencyHz?: number;
  amperage: string;
  sortOrder?: number;
}

export interface DbSpaElectricalConfig {
  id: string;
  spa_model_id: string;
  voltage: number;
  voltage_unit: string;
  frequency_hz: number | null;
  amperage: string;
  sort_order: number;
  created_at: Date;
}

// =============================================================================
// PCdb Types (Parts Catalog Database)
// =============================================================================

export interface PcdbCategory {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  iconName: string | null;
  sortOrder: number;
  parentId: string | null;
  fullPath: string | null;
  depth: number;
  deletedAt: Date | null;
  createdAt: Date;
  children?: PcdbCategory[];
}

export interface CreateCategoryInput {
  name: string;
  displayName: string;
  description?: string;
  iconName?: string;
  sortOrder?: number;
  parentId?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  displayName?: string;
  description?: string;
  iconName?: string;
  sortOrder?: number;
}

export interface PcdbInterchangeGroup {
  id: string;
  name: string | null;
  notes: string | null;
  createdAt: Date;
  // Computed
  partCount?: number;
}

export interface CreateInterchangeGroupInput {
  name?: string;
  notes?: string;
}

export interface PcdbPart {
  id: string;
  categoryId: string;
  // Identification
  partNumber: string | null;
  manufacturerSku: string | null;
  upc: string | null;
  ean: string | null;
  skuAliases: string[] | null;
  name: string;
  manufacturer: string | null;
  // Classification
  interchangeGroupId: string | null;
  isOem: boolean;
  isUniversal: boolean;
  isDiscontinued: boolean;
  discontinuedAt: Date | null;
  displayImportance: number;
  // Physical
  dimensionsJson: Record<string, unknown> | null;
  // Media
  imageUrl: string | null;
  specSheetUrl: string | null;
  // Metadata
  notes: string | null;
  dataSource: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  categoryName?: string;
  categoryDisplayName?: string;
  interchangeGroupName?: string;
}

export interface CreatePartInput {
  categoryId: string;
  partNumber?: string;
  manufacturerSku?: string;
  upc?: string;
  ean?: string;
  skuAliases?: string[];
  name: string;
  manufacturer?: string;
  interchangeGroupId?: string;
  isOem?: boolean;
  isUniversal?: boolean;
  isDiscontinued?: boolean;
  displayImportance?: number;
  dimensionsJson?: Record<string, unknown>;
  imageUrl?: string;
  specSheetUrl?: string;
  notes?: string;
  dataSource?: string;
}

export interface UpdatePartInput extends Partial<CreatePartInput> {}

// =============================================================================
// Compatibility Types
// =============================================================================

export type CompatibilityStatus = 'pending' | 'confirmed' | 'rejected';
export type CompatibilitySource = 'manual' | 'comp_assignment' | 'bulk_import' | 'auto_detected';

export interface PartSpaCompatibility {
  partId: string;
  spaModelId: string;
  status: CompatibilityStatus;
  fitNotes: string | null;
  quantityRequired: number;
  position: string | null;
  source: CompatibilitySource | null;
  addedBy: string | null;
  addedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  // Joined fields
  partName?: string;
  partNumber?: string;
  spaModelName?: string;
  spaYear?: number;
  brandName?: string;
}

export interface CreateCompatibilityInput {
  partId: string;
  spaModelId: string;
  status?: CompatibilityStatus;
  fitNotes?: string;
  quantityRequired?: number;
  position?: string;
  source?: CompatibilitySource;
}

export interface CompatibilityGroup {
  id: string; // Human-readable: COMP-JAC-FILT-001
  name: string | null;
  description: string | null;
  autoGenerated: boolean;
  sourceCategoryId: string | null;
  createdBy: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Computed
  spaCount?: number;
  partCount?: number;
  sourceCategoryName?: string;
}

export interface CreateCompInput {
  id: string; // Human-readable ID required
  name?: string;
  description?: string;
  spaModelIds?: string[]; // Initial spa membership
}

export interface UpdateCompInput {
  name?: string;
  description?: string;
}

export interface CompSpa {
  compId: string;
  spaModelId: string;
  addedAt: Date;
  // Joined fields
  spaModelName?: string;
  spaYear?: number;
  brandName?: string;
  modelLineName?: string;
}

export interface CompNearMatch {
  comp: CompatibilityGroup;
  matchingSpas: number;
  totalCompSpas: number;
  matchPercentage: number;
}

// =============================================================================
// Qdb Types (Qualifier Database)
// =============================================================================

export type QualifierDataType = 'enum' | 'boolean' | 'number' | 'text';
export type QualifierAppliesTo = 'spa' | 'part' | 'both';

export interface QdbQualifier {
  id: string;
  name: string;
  displayName: string;
  dataType: QualifierDataType;
  allowedValues: string[] | null;
  appliesTo: QualifierAppliesTo;
  description: string | null;
  createdAt: Date;
}

export interface CreateQualifierInput {
  name: string;
  displayName: string;
  dataType: QualifierDataType;
  allowedValues?: string[];
  appliesTo: QualifierAppliesTo;
  description?: string;
}

export interface QdbSpaQualifier {
  spaModelId: string;
  qualifierId: string;
  value: unknown;
  // Joined fields
  qualifierName?: string;
  qualifierDisplayName?: string;
}

export interface QdbPartQualifier {
  partId: string;
  qualifierId: string;
  value: unknown;
  isRequired: boolean;
  // Joined fields
  qualifierName?: string;
  qualifierDisplayName?: string;
}

// =============================================================================
// Operational Types
// =============================================================================

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedBy: string | null;
  changedAt: Date;
  changeReason: string | null;
}

export type CorrectionRequestType = 'missing_model' | 'wrong_specs' | 'wrong_compatibility' | 'missing_part' | 'other';
export type CorrectionRequestStatus = 'pending' | 'in_review' | 'resolved' | 'rejected';

export interface CorrectionRequest {
  id: string;
  tenantId: string;
  requestType: CorrectionRequestType;
  description: string;
  sourceReference: string | null;
  affectedEntityType: string | null;
  affectedEntityId: string | null;
  status: CorrectionRequestStatus;
  resolutionNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface CreateCorrectionRequestInput {
  tenantId: string;
  requestType: CorrectionRequestType;
  description: string;
  sourceReference?: string;
  affectedEntityType?: string;
  affectedEntityId?: string;
}

export type MappingStatus = 'unmapped' | 'auto_suggested' | 'confirmed';

export interface PosProduct {
  id: string;
  tenantId: string;
  posProductId: string;
  posVariantId: string | null;
  title: string;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[] | null;
  price: number; // Cents
  compareAtPrice: number | null;
  sku: string | null;
  barcode: string | null;
  images: string[];
  variants: unknown[];
  inventoryQuantity: number;
  weight: number | null;
  weightUnit: string | null;
  isHidden: boolean;
  hiddenAt: Date | null;
  hiddenBy: string | null;
  uhtdPartId: string | null;
  mappingStatus: MappingStatus;
  mappingConfidence: number | null;
  mappedBy: string | null;
  mappedAt: Date | null;
  posStatus: string | null;
  posUpdatedAt: Date | null;
  lastSyncedAt: Date;
  syncHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  uhtdPartName?: string;
  uhtdPartNumber?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface UhtdStats {
  totalBrands: number;
  totalModelLines: number;
  totalSpaModels: number;
  totalParts: number;
  totalComps: number;
  totalCategories: number;
  pendingCompatibility: number;
  autoGeneratedComps: number;
}

export interface SearchResult {
  type: 'brand' | 'model_line' | 'spa_model' | 'part' | 'comp';
  id: string;
  name: string;
  subtitle?: string;
  matchScore?: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// Bulk Import Types
// =============================================================================

export interface BulkImportPartRow {
  partNumber?: string;
  name: string;
  category: string;
  manufacturer?: string;
  upc?: string;
  ean?: string;
  isOem?: boolean;
  compIds?: string; // Comma-separated
  dataSource?: string;
}

export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
  createdParts: string[];
  createdCompatibilities: number;
}

// =============================================================================
// Database Row Types (snake_case for direct DB mapping)
// =============================================================================

export interface DbScdbBrand {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  deleted_at: Date | null;
  data_source: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbScdbModelLine {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  deleted_at: Date | null;
  data_source: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbScdbSpaModel {
  id: string;
  model_line_id: string;
  brand_id: string;
  name: string;
  year: number;
  manufacturer_sku: string | null;
  water_capacity_gallons: number | null;
  jet_count: number | null;
  seating_capacity: number | null;
  dimensions_length_inches: number | null;
  dimensions_width_inches: number | null;
  dimensions_height_inches: number | null;
  weight_dry_lbs: number | null;
  weight_filled_lbs: number | null;
  electrical_requirement: string | null;
  has_ozone: boolean;
  has_uv: boolean;
  has_salt_system: boolean;
  has_jacuzzi_true: boolean;
  image_url: string | null;
  spec_sheet_url: string | null;
  is_discontinued: boolean;
  notes: string | null;
  data_source: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbPcdbPart {
  id: string;
  category_id: string;
  part_number: string | null;
  manufacturer_sku: string | null;
  upc: string | null;
  ean: string | null;
  sku_aliases: string[] | null;
  name: string;
  manufacturer: string | null;
  interchange_group_id: string | null;
  is_oem: boolean;
  is_universal: boolean;
  is_discontinued: boolean;
  discontinued_at: Date | null;
  display_importance: number;
  dimensions_json: Record<string, unknown> | null;
  image_url: string | null;
  spec_sheet_url: string | null;
  notes: string | null;
  data_source: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbPartSpaCompatibility {
  part_id: string;
  spa_model_id: string;
  status: CompatibilityStatus;
  fit_notes: string | null;
  quantity_required: number;
  position: string | null;
  source: CompatibilitySource | null;
  added_by: string | null;
  added_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
}

export interface DbCompatibilityGroup {
  id: string;
  name: string | null;
  description: string | null;
  auto_generated: boolean;
  source_category_id: string | null;
  created_by: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
