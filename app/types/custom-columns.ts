/**
 * Custom Columns and Properties Type Definitions
 * Advanced customization system for SHG groups
 */

// Base column data types
export type ColumnDataType = 
  | 'number'
  | 'currency'
  | 'percentage'
  | 'text'
  | 'date'
  | 'boolean'
  | 'dropdown'
  | 'calculated'
  | 'property-driven';

// Column calculation types
export type CalculationType = 
  | 'sum'
  | 'average'
  | 'percentage'
  | 'formula'
  | 'conditional'
  | 'property-based';

// Property types for property-driven columns
export type PropertyType = 
  | 'percentage'
  | 'fixed-amount'
  | 'per-member-amount'
  | 'tiered-amount'
  | 'conditional-amount';

// Conditional operators for formulas
export type ConditionalOperator = 
  | 'greater-than'
  | 'less-than'
  | 'equals'
  | 'not-equals'
  | 'greater-equal'
  | 'less-equal'
  | 'contains'
  | 'starts-with'
  | 'ends-with';

// Property definition for property-driven columns
export interface ColumnProperty {
  id: string;
  name: string;
  type: PropertyType;
  value: number | string | boolean;
  description?: string;
  
  // For tiered properties
  tiers?: {
    condition: string;
    value: number;
    description?: string;
  }[];
  
  // For conditional properties
  conditions?: {
    field: string;
    operator: ConditionalOperator;
    value: number | string | boolean;
    result: number | string | boolean;
  }[];
}

// Formula definition for calculated columns
export interface ColumnFormula {
  id: string;
  expression: string; // e.g., "loanAmount * (loanInsurancePercent / 100)"
  referencedColumns: string[]; // Column IDs referenced in the formula
  referencedProperties: string[]; // Property IDs referenced in the formula
  
  // Conditional logic
  conditions?: {
    if: string; // condition expression
    then: string; // result expression
    else?: string; // fallback expression
  }[];
  
  // Validation rules
  validation?: {
    min?: number;
    max?: number;
    required?: boolean;
    customRule?: string;
  };
}

// Template for common SHG column types
export interface ColumnTemplate {
  id: string;
  name: string;
  description: string;
  category: 'contribution' | 'loan' | 'fine' | 'insurance' | 'social' | 'custom';
  dataType: ColumnDataType;
  defaultProperties: ColumnProperty[];
  defaultFormula?: ColumnFormula;
  icon?: string;
  
  // UI configuration
  displayConfig: {
    showInSummary: boolean;
    aggregateType: 'sum' | 'average' | 'count' | 'none';
    formatType: 'currency' | 'percentage' | 'number' | 'text';
    decimalPlaces: number;
  };
  
  // Permissions
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canReorder: boolean;
    adminOnly: boolean;
  };
}

// Custom column definition
export interface CustomColumn {
  id: string;
  name: string;
  description?: string;
  dataType: ColumnDataType;
  order: number;
  isActive: boolean;
  
  // Template information
  templateId?: string;
  template?: ColumnTemplate;
  
  // Properties for property-driven columns
  properties: ColumnProperty[];
  
  // Formula for calculated columns
  formula?: ColumnFormula;
  
  // Dropdown options for dropdown columns
  dropdownOptions?: {
    value: string;
    label: string;
    color?: string;
  }[];
  
  // Display configuration
  displayConfig: {
    showInTable: boolean;
    showInSummary: boolean;
    showInReports: boolean;
    width?: number;
    alignment: 'left' | 'center' | 'right';
    aggregateType: 'sum' | 'average' | 'count' | 'none';
    formatType: 'currency' | 'percentage' | 'number' | 'text' | 'date';
    decimalPlaces: number;
    prefix?: string;
    suffix?: string;
  };
  
  // Validation rules
  validation: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    customRule?: string;
  };
  
  // Permissions
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canReorder: boolean;
    adminOnly: boolean;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

// Group custom schema definition
export interface GroupCustomSchema {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  version: number;
  
  columns: CustomColumn[];
  
  // Global properties that affect multiple columns
  globalProperties: ColumnProperty[];
  
  // Schema metadata
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
  
  // Backup of previous schema version
  previousVersion?: GroupCustomSchema;
}

// Member data with custom column values
export interface MemberCustomData {
  id: string;
  memberId: string;
  groupId: string;
  schemaId: string;
  periodId?: string; // For period-specific data
  
  // Dynamic data based on custom columns
  columnValues: Record<string, any>;
  
  // Calculated values cache
  calculatedValues: Record<string, any>;
  
  // Metadata
  lastUpdated: Date;
  updatedBy: string;
}

// Preset column templates for common SHG needs
export const COLUMN_TEMPLATES: ColumnTemplate[] = [
  {
    id: 'loan-insurance',
    name: 'Loan Insurance',
    description: 'Insurance payment based on loan amount percentage',
    category: 'insurance',
    dataType: 'property-driven',
    defaultProperties: [
      {
        id: 'insurance-percent',
        name: 'Insurance Percentage',
        type: 'percentage',
        value: 0.2,
        description: 'Percentage of loan amount for insurance (e.g., 0.2%)'
      }
    ],
    defaultFormula: {
      id: 'loan-insurance-calc',
      expression: 'loanAmount * (insurancePercent / 100)',
      referencedColumns: ['loanAmount'],
      referencedProperties: ['insurance-percent']
    },
    displayConfig: {
      showInSummary: true,
      aggregateType: 'sum',
      formatType: 'currency',
      decimalPlaces: 2
    },
    permissions: {
      canEdit: true,
      canDelete: true,
      canReorder: true,
      adminOnly: false
    }
  },
  {
    id: 'group-social',
    name: 'Group Social',
    description: 'Social fund contribution per family member',
    category: 'social',
    dataType: 'property-driven',
    defaultProperties: [
      {
        id: 'social-amount-per-member',
        name: 'Amount per Family Member',
        type: 'fixed-amount',
        value: 10,
        description: 'Amount per family member (e.g., ₹10 per person)'
      }
    ],
    defaultFormula: {
      id: 'group-social-calc',
      expression: 'familyMembersCount * socialAmountPerMember',
      referencedColumns: ['familyMembersCount'],
      referencedProperties: ['social-amount-per-member']
    },
    displayConfig: {
      showInSummary: true,
      aggregateType: 'sum',
      formatType: 'currency',
      decimalPlaces: 2
    },
    permissions: {
      canEdit: true,
      canDelete: true,
      canReorder: true,
      adminOnly: false
    }
  },
  {
    id: 'late-fine',
    name: 'Late Fine',
    description: 'Fine for late payments',
    category: 'fine',
    dataType: 'property-driven',
    defaultProperties: [
      {
        id: 'fine-amount',
        name: 'Fine Amount',
        type: 'fixed-amount',
        value: 5,
        description: 'Fixed fine amount for late payment'
      }
    ],
    displayConfig: {
      showInSummary: true,
      aggregateType: 'sum',
      formatType: 'currency',
      decimalPlaces: 2
    },
    permissions: {
      canEdit: true,
      canDelete: true,
      canReorder: true,
      adminOnly: false
    }
  },
  {
    id: 'education-loan',
    name: 'Education Loan',
    description: 'Special loan for education purposes',
    category: 'loan',
    dataType: 'currency',
    defaultProperties: [],
    displayConfig: {
      showInSummary: true,
      aggregateType: 'sum',
      formatType: 'currency',
      decimalPlaces: 2
    },
    permissions: {
      canEdit: true,
      canDelete: true,
      canReorder: true,
      adminOnly: false
    }
  },
  {
    id: 'profit-share',
    name: 'Profit Share',
    description: 'Member\'s share of group profits',
    category: 'contribution',
    dataType: 'calculated',
    defaultProperties: [],
    defaultFormula: {
      id: 'profit-share-calc',
      expression: 'totalGroupProfit / totalMembers',
      referencedColumns: ['totalGroupProfit', 'totalMembers'],
      referencedProperties: []
    },
    displayConfig: {
      showInSummary: true,
      aggregateType: 'sum',
      formatType: 'currency',
      decimalPlaces: 2
    },
    permissions: {
      canEdit: true,
      canDelete: false,
      canReorder: true,
      adminOnly: false
    }
  },
  {
    id: 'attendance',
    name: 'Meeting Attendance',
    description: 'Track member attendance at meetings',
    category: 'custom',
    dataType: 'dropdown',
    defaultProperties: [],
    displayConfig: {
      showInSummary: false,
      aggregateType: 'count',
      formatType: 'text',
      decimalPlaces: 0
    },
    permissions: {
      canEdit: true,
      canDelete: true,
      canReorder: true,
      adminOnly: false
    }
  }
];

// Formula validation and calculation utilities
export interface FormulaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  referencedColumns: string[];
  referencedProperties: string[];
}

export interface CalculationContext {
  memberData: Record<string, any>;
  groupData: Record<string, any>;
  periodData: Record<string, any>;
  properties: Record<string, any>;
  allMembers: Record<string, any>[];
}

// Export/import schema types
export interface SchemaExportData {
  schema: GroupCustomSchema;
  metadata: {
    exportedAt: Date;
    exportedBy: string;
    version: string;
    groupName: string;
  };
}

export interface SchemaImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  importedSchema?: GroupCustomSchema;
  conflictingColumns?: string[];
}
